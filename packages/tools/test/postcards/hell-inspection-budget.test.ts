import { beforeEach, describe, expect, it, vi } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import type { GenerationVariant } from "../../../shared/src/world/generation-variant.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import type { HellCameraValidation } from "../../src/postcards/geometry.js";
import {
  type HellPostcardId,
  resolveHellCameras,
} from "../../src/postcards/hell-resolve.js";

// Exercise the real resolver's admission, ordering and receipts. Synthetic
// terrain and validation keep this regression independent of world generation.
const state = vi.hoisted(() => ({
  document: {} as Record<string, unknown>,
  events: [] as Record<string, unknown>[],
  inspections: 0,
  passAt: Infinity,
  refinementCount: 18,
  validation: {} as HellCameraValidation,
}));
const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20, minY: 0, maxY: 100 };
const roots = [1, 2, 3].map((id) => ({
  id,
  base: [id * 10, 0, 10],
  height: 80,
  baseRadius: 4,
}));
const lava = () => ({
  kind: "lava",
  source: "fissure",
  bodyId: 7,
  bed: -3,
  level: 0,
});
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  appendFileSync: (_path: unknown, text: string) =>
    state.events.push(JSON.parse(text)),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: async () => undefined,
  readFile: async () => JSON.stringify(state.document),
  writeFile: async () => undefined,
}));
vi.mock("../../src/build/metadata.js", () => ({
  sourceFingerprints: () => ({ cacheTag: "a".repeat(64) }),
  postcardResolverHash: () => "c".repeat(64),
}));
vi.mock("../../src/postcards/main-resolve.js", () => ({
  loadPlan: async () => ({
    sites: { bridges: [] },
    ibara: {
      calderas: [{ id: 7, x: 0, z: 0, radius: 20, bounds }],
    },
  }),
}));
vi.mock("../../../shared/src/world/world-context.js", () => ({
  createWorldContext: () => ({ regionAnchor: () => ({ x: 0, z: 0 }) }),
}));
vi.mock("../../../shared/src/worldgen/main/surface.js", () => ({
  createMainField: () => ({
    ibara: { height: () => 0, lavaQuery: lava, lavaAt: lava },
  }),
}));
vi.mock("../../../shared/src/worldgen/main/features.js", () => ({
  createMainIbaraField: () => ({
    parametersForCell: () => roots,
    collect: () => roots.map((parameters) => ({ parameters, bounds })),
  }),
}));
vi.mock("../../../shared/src/worldgen/main/ibara-volcanic.js", () => ({
  PLATE_CELL: 192,
  createIbaraAnalytic: () => ({
    weight: () => 1,
    fissures: () => [{ id: 7, ax: 0, az: 0, bx: 0, bz: 0, hot: true }],
  }),
}));
vi.mock("../../../shared/src/worldgen/main/ibara-primitive.js", () => ({
  PRIMITIVE_IBARA_HEIGHT: 80,
  PRIMITIVE_IBARA_RADIUS: 4,
  createPrimitiveIbaraBatch: () => ({
    instances: roots.map((root) => ({
      featureId: root.id,
      x: root.base[0],
      z: root.base[2],
      bounds,
    })),
  }),
}));
vi.mock("../../src/postcards/query.js", () => ({
  walkableEye: () => true,
  cameraQuery: () => ({
    voxel: (_x: number, y: number) => ({
      density: -1,
      block: y < 0 ? Block.Lava : Block.Air,
      fluid: y < 0 ? Block.Lava : 0,
    }),
    region: () => "hellscape",
    ground: () => 0,
    walkableFeet: () => 0,
    bounds: () => ({ minSurfaceY: 0, maxSolidY: 0 }),
    clear() {},
  }),
}));
vi.mock("../../src/postcards/geometry.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/postcards/geometry.js")>()),
  cameraPoseRejections: () => [],
  inspectHellCamera: () => ({
    ...state.validation,
    passed: ++state.inspections === state.passAt,
  }),
}));
vi.mock("../../src/postcards/hell-visible-instances.js", () => ({
  createVisibleThornResolver: () => () => ({ instances: [], receipt: {} }),
}));
vi.mock("../../src/postcards/hell-readability.js", () => ({
  inspectHellReadability: () => ({ passed: true, score: 0 }),
}));
vi.mock("../../src/postcards/hell-framing-camera.js", () => ({
  FOREST_CAMERA_PITCHES: [-5, 0, 4.25],
  PRODUCTION_CAMERA_BUDGET: { coarse: 32, refinements: 18 },
  productionFramingCandidates: (observations: unknown[]) =>
    Array.from({ length: state.refinementCount }, () => observations[0]),
}));
vi.mock("../../src/postcards/hell-primitive-camera.js", () => ({
  PRIMITIVE_CAMERA_BUDGET: { coarse: 32, refinements: 18 },
  primitiveCameraRefinements: (observations: unknown[]) =>
    Array.from({ length: state.refinementCount }, () => observations[0]),
}));

function saved(id: HellPostcardId, variant: GenerationVariant) {
  return {
    schema: 1,
    worldKind: "main",
    seed: 1,
    worldgenVersion: WORLDGEN_VERSION,
    sourceHash: "a".repeat(64),
    resolverHash: "b".repeat(64),
    variant,
    cameras: [
      {
        id,
        seed: 1,
        region: "hellscape",
        kind: "eye-level",
        ungraded: true,
        position: { x: 10, y: 1.62, z: 0 },
        target: { x: 0, y: 1.62, z: 20 },
        radius: 512,
        hours: 17.25,
        validatedByResolverHash: "b".repeat(64),
        validation: { ...state.validation, passed: true },
        targetFeature:
          id === "HELL-1"
            ? { kind: "thorn-cluster", featureIds: [1, 2, 3], bounds }
            : { kind: "caldera", calderaId: 7, bounds },
      },
    ],
  };
}
function storedViews(
  id: HellPostcardId,
  variant: GenerationVariant,
  retained: boolean,
  comparison: boolean,
) {
  if (retained)
    state.document[variant === "primitive" ? "phase13Primitive" : "phase13"] =
      saved(id, variant);
  if (comparison) state.document.phase13 = saved(id, "production");
}
beforeEach(() => {
  state.document = {};
  state.events = [];
  state.inspections = 0;
  state.passAt = Infinity;
  state.refinementCount = 18;
  state.validation = {
    eyeClear: true,
    walkable: true,
    centralClear: true,
    skyFraction: 0.3,
    featureFraction: 0.1,
    targetFraction: 0.1,
    waterFraction: 0,
    horizonFraction: 0.5,
    sunOffsetDegrees: 90,
    sunElevationDegrees: 10,
    highestVisibleSample: 80,
    altitudeAboveHighestSample: null,
    rayColumns: 64,
    rayRows: 36,
    visibleFeatureIds: [1],
    lavaFraction: 0.01,
    fissureFraction: 0.01,
    targetFissureFraction: 0.01,
    targetLavaFraction: 0,
    visibleLavaOwners: [{ source: "fissure", bodyId: 7 }],
    passed: false,
  };
});
const cases = (["HELL-1", "HELL-2"] as const).flatMap((id) => [
  { id, variant: "production" as const, retained: false, comparison: false },
  { id, variant: "production" as const, retained: true, comparison: false },
  { id, variant: "primitive" as const, retained: false, comparison: false },
  { id, variant: "primitive" as const, retained: true, comparison: false },
  { id, variant: "primitive" as const, retained: false, comparison: true },
  { id, variant: "primitive" as const, retained: true, comparison: true },
]);
describe("HELL resolution total full-grid inspection budget", () => {
  it.each(cases)(
    "caps $id/$variant retained=$retained comparison=$comparison at 50 actual calls",
    async ({ id, variant, retained, comparison }) => {
      storedViews(id, variant, retained, comparison);
      await expect(
        resolveHellCameras(1, "/synthetic-camera-budget", [id], variant),
      ).rejects.toThrow("passed geometry and selection");
      expect(state.inspections).toBe(50);
      const started = state.events.filter(
        (event) => event.stage === "validation-started",
      );
      expect(started).toHaveLength(50);
      expect(started.map((event) => event.fullGridOrdinal)).toEqual(
        Array.from({ length: 50 }, (_, i) => i + 1),
      );
      expect(state.events.at(-1)?.stage).toBe("failed");
    },
  );
  it.each(["production", "primitive"] as const)(
    "keeps fallback coarse inspections in the same %s limit",
    async (variant) => {
      storedViews("HELL-1", variant, true, variant === "primitive");
      state.refinementCount = 0;
      await expect(
        resolveHellCameras(1, "/synthetic-camera-budget", ["HELL-1"], variant),
      ).rejects.toThrow("passed geometry and selection");
      expect(state.inspections).toBe(50);
      expect(
        state.events.find(
          (event) =>
            event.stage ===
            (variant === "production"
              ? "production-framing-summary"
              : "primitive-refinement-summary"),
        ),
      ).toMatchObject({
        fullGridCandidates: 50,
        fallbackCoarseCandidates: variant === "production" ? 17 : 16,
      });
    },
  );
  it.each([
    {
      variant: "production" as const,
      retained: true,
      comparison: false,
      passAt: 1,
    },
    {
      variant: "primitive" as const,
      retained: false,
      comparison: true,
      passAt: 1,
    },
    {
      variant: "primitive" as const,
      retained: true,
      comparison: true,
      passAt: 2,
    },
    {
      variant: "primitive" as const,
      retained: true,
      comparison: true,
      passAt: 50,
    },
  ])(
    "reports $variant reuse/comparison success at actual inspection $passAt",
    async ({ variant, retained, comparison, passAt }) => {
      storedViews("HELL-1", variant, retained, comparison);
      state.passAt = passAt;
      const result = await resolveHellCameras(
        1,
        "/synthetic-camera-budget",
        ["HELL-1"],
        variant,
      );
      expect(state.inspections).toBe(passAt);
      expect(result.resolution.entries[0]).toMatchObject({
        candidates: passAt,
        reused: passAt < 50,
      });
      if (comparison)
        expect(result.cameras[0]?.comparison?.productionView).toBe(
          passAt === 1 ? "matched" : "diverged",
        );
    },
  );
});
