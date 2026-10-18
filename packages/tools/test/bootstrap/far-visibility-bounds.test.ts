import { Frustum, Matrix4, PerspectiveCamera } from "three";
import { describe, expect, it, vi } from "vitest";
import {
  type FarView,
  planFarTerrain,
} from "../../../client/src/engine/far-terrain-selection.js";
import { createFarVisibilityBounds } from "../../../client/src/engine/far-visibility-bounds.js";
import {
  WORLD_MAX_Y,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import type {
  FarVisibilityCertificate,
  WorldContext,
  XZBounds,
} from "../../../shared/src/world/types.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { buildWorldPlan } from "../../../shared/src/worldplan/build.js";

const full = { minY: WORLD_MIN_Y, maxY: WORLD_MAX_Y };
const tile = { tx: 0, tz: 0, lod: 2 as const };
const camera = { x: 0, y: 1000, z: 0 };
function source(displacement = 0) {
  const certificate: FarVisibilityCertificate = {
    layer: "surface",
    solidBase: true,
    displacement,
  };
  const conservativeBounds = vi.fn(
    (
      _bounds: XZBounds,
      out: {
        minSurfaceY: number;
        maxSurfaceY: number;
        maxSolidY: number;
        maxFluidY: number;
      },
    ) =>
      Object.assign(out, {
        minSurfaceY: 0,
        maxSurfaceY: 10,
        maxSolidY: 10,
        maxFluidY: -Infinity,
      }),
  );
  return {
    certificate,
    context: {
      conservativeBounds,
      farVisibilityCertificate: () => certificate,
    },
  };
}

describe("source-certified far visibility bounds", () => {
  it("reproduces the failed 502-node ground pose then selects the genuinely empty exterior target", () => {
    const context = createWorldContext({ kind: "test", seed: 1 });
    // Root's exact candidate reconstruction matched 502 far requests/516 near jobs.
    const eye = new PerspectiveCamera(40, 960 / 640, 200, 16_000);
    eye.position.set(0, 26.659649062935802, 13.765834472425105);
    eye.lookAt(0, 7, 0);
    eye.updateMatrixWorld();
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(
        eye.projectionMatrix,
        eye.matrixWorldInverse,
      ),
      eye.coordinateSystem,
      eye.reversedDepth,
    );
    const view: FarView = {
      x: eye.position.x,
      y: eye.position.y,
      z: eye.position.z,
      fovYRadians: (40 * Math.PI) / 180,
      pixelHeight: 640,
      reach: 16_000,
      planes: frustum.planes.map((p) => ({
        x: p.normal.x,
        y: p.normal.y,
        z: p.normal.z,
        constant: p.constant,
      })),
    };
    const before = planFarTerrain(view, { layer: "surface" });
    expect(before.requests).toHaveLength(502);
    expect(before.leaves).toHaveLength(356);
    const after = planFarTerrain(view, {
      layer: "surface",
      heightBounds: createFarVisibilityBounds(context, {
        layer: "surface",
        camera: eye.position,
        cut: Infinity,
        edits: [],
      }),
    });
    expect(after.requests).toHaveLength(0);
    expect(after.leaves).toHaveLength(0);
  });
  it("shares exact source padding and includes the balanced neighbor footprint", () => {
    const f = source(29.5);
    const bound = createFarVisibilityBounds(f.context, {
      layer: "surface",
      camera,
      cut: Infinity,
      edits: [],
    })(tile);
    expect(bound).toEqual({ minY: -45.5, maxY: 47.5 });
    expect(f.context.conservativeBounds.mock.calls[0]?.[0]).toEqual({
      minX: -8,
      minZ: -8,
      maxX: 136,
      maxZ: 136,
    });
  });
  it("keeps lower cliff geometry when the neighboring footprint is lower", () => {
    const f = source();
    f.context.conservativeBounds.mockImplementation((bounds, out) =>
      Object.assign(out, {
        minSurfaceY: bounds.minX < 0 ? -500 : 0,
        maxSurfaceY: 10,
        maxSolidY: 20,
        maxFluidY: 30,
      }),
    );
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera,
        cut: Infinity,
        edits: [],
      })(tile),
    ).toEqual({ minY: -516, maxY: 38 });
  });
  it("falls back for absent, disabled, other-layer and below-world authority", () => {
    const f = source();
    const uncertified: Pick<
      WorldContext,
      "conservativeBounds" | "farVisibilityCertificate"
    > = { conservativeBounds: f.context.conservativeBounds };
    expect(
      createFarVisibilityBounds(uncertified, {
        layer: "surface",
        camera,
        cut: Infinity,
        edits: [],
      })(tile),
    ).toEqual(full);
    const disabled = {
      ...f.context,
      farVisibilityCertificate: () => ({ ...f.certificate, solidBase: false }),
    };
    expect(
      createFarVisibilityBounds(disabled, {
        layer: "surface",
        camera,
        cut: Infinity,
        edits: [],
      })(tile),
    ).toEqual(full);
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "upper_deep",
        camera,
        cut: Infinity,
        edits: [],
      })(tile),
    ).toEqual(full);
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera: { ...camera, y: WORLD_MIN_Y - 1 },
        cut: -100,
        edits: [],
      })(tile),
    ).toEqual(full);
    expect(f.context.conservativeBounds).not.toHaveBeenCalled();
  });
  it("retains world-edge walls and unproved lower-camera views", () => {
    const f = source();
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera,
        cut: Infinity,
        edits: [],
      })({ tx: -176, tz: 0, lod: 2 }),
    ).toEqual({ minY: WORLD_MIN_Y, maxY: 18 });
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera: { ...camera, y: -100 },
        cut: Infinity,
        edits: [],
      })(tile),
    ).toEqual({ minY: WORLD_MIN_Y, maxY: 18 });
  });
  it("preserves low edited cavities, high towers and edits in the neighboring halo", () => {
    const f = source();
    const edits = [
      { x: 1, y: -900, z: 1 },
      { x: 1, y: 900, z: 1 },
      { x: 130, y: -1000, z: 1 },
      { x: 1000, y: 1022, z: 1 },
    ];
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera,
        cut: Infinity,
        edits,
      })(tile),
    ).toEqual({ minY: -1001, maxY: 902 });
  });
  it("keeps the active cap at a deep cut and still includes edited voids below it", () => {
    const f = source();
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera,
        cut: -200,
        edits: [],
      })(tile),
    ).toEqual({ minY: -200, maxY: -200 });
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera,
        cut: -200,
        edits: [{ x: 1, y: -300, z: 1 }],
      })(tile),
    ).toEqual({ minY: -301, maxY: -200 });
    expect(
      createFarVisibilityBounds(f.context, {
        layer: "surface",
        camera,
        cut: -200,
        edits: [],
      })({ tx: -176, tz: 0, lod: 2 }),
    ).toEqual({ minY: WORLD_MIN_Y, maxY: -200 });
  });
  it("uses the real source certificate but declines MAIN bridge footprints", () => {
    const plan = buildWorldPlan(1);
    const context = createWorldContext({ kind: "main", seed: 1, plan });
    const bridge = plan.sites.bridges[0];
    if (!bridge) throw new Error("Expected real source bridge");
    const x = Number(bridge.centreline[0]),
      z = Number(bridge.centreline[1]);
    expect(
      context.farVisibilityCertificate?.("surface", {
        minX: x - 1,
        minZ: z - 1,
        maxX: x + 1,
        maxZ: z + 1,
      }),
    ).toBeNull();
    const away = { minX: -20_000, minZ: -20_000, maxX: -19_900, maxZ: -19_900 };
    const certificate = context.farVisibilityCertificate?.("surface", away);
    expect(certificate).toEqual({
      layer: "surface",
      solidBase: true,
      displacement: 29.5,
    });
    expect(context.farVisibilityCertificate?.("upper_deep", away)).toBeNull();
    const area = context.prepareFarArea?.(away, {
      spacing: 4,
      layer: "surface",
    });
    if (!area) throw new Error("Expected real far area");
    const column = area.sampleColumn(-19_950, -19_950, area.createColumn());
    expect(column.certifiedBase).toBe(certificate?.solidBase);
  });
});
