import { beforeEach, describe, expect, it, vi } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import type { GenerationVariant } from "../../../shared/src/world/generation-variant.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import type { HellCameraValidation } from "../../src/postcards/geometry.js";
import type { HellReadability } from "../../src/postcards/hell-readability.js";
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
  passAlways: false,
  sourceHash: "a".repeat(64),
  resolverHash: "c".repeat(64),
  readability: {} as HellReadability,
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
  writeFile: async (_path: string, content: string) => {
    state.document = JSON.parse(content);
  },
}));
vi.mock("../../src/build/metadata.js", () => ({
  sourceFingerprints: () => ({ cacheTag: state.sourceHash }),
  postcardResolverHash: () => state.resolverHash,
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
    passed: ++state.inspections === state.passAt || state.passAlways,
  }),
}));
vi.mock("../../src/postcards/hell-visible-instances.js", () => ({
  createVisibleThornResolver: () => () => ({ instances: [], receipt: {} }),
}));
vi.mock("../../src/postcards/hell-readability.js", () => ({
  inspectHellReadability: () => state.readability,
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
  state.passAlways = false;
  state.sourceHash = "a".repeat(64);
  state.resolverHash = "c".repeat(64);
  state.readability = {
    objective: "hell1-readable-forms-v1",
    passed: true,
    reasons: [],
    score: 82,
    dominantId: 1,
    dominantComplete: true,
    groundTransition: true,
    sizeClasses: [0, 1, 2],
    families: { curved: [1], hooked: [2], branched: [3], broken: [4] },
    parents: [],
    visibilityRays: 4,
    voxelQueries: 4,
    rayBudgetExhausted: false,
  };
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
      ).rejects.toThrow("passed geometry");
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
      ).rejects.toThrow("passed geometry");
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
  function unclearComposition() {
    state.readability = {
      ...state.readability,
      passed: false,
      reasons: ["hooked-witness-unreadable"],
      score: 72,
      families: { ...state.readability.families, hooked: [] },
    };
    state.passAlways = true;
  }
  const resolve = () =>
    resolveHellCameras(1, "/synthetic-camera-budget", ["HELL-1"], "production");
  it("saves the best safe ungraded view with failed diagnostics only after its bounded search", async () => {
    unclearComposition();
    storedViews("HELL-1", "production", true, false);
    const result = await resolve();
    expect(state.inspections).toBe(50);
    expect(
      state.events.some(
        (e) => e.stage === "production-framing-validation-selected",
      ),
    ).toBe(true);
    expect(result.resolution.entries[0]?.reused).toBe(false);
    expect(result.cameras[0]).toMatchObject({
      ungraded: true,
      validation: { passed: true },
      readability: { passed: false, reasons: ["hooked-witness-unreadable"] },
      completedSearch: {
        schema: 1,
        fullGridCandidates: 50,
        fullGridBudget: 50,
        termination: "budget",
      },
    });
  });
  it("reuses an exactly bound completed ungraded search after fresh geometry/readability checks", async () => {
    unclearComposition();
    const first = await resolve();
    state.inspections = 0;
    state.events = [];
    const again = await resolve();
    expect(state.inspections).toBe(1);
    expect(again.resolution.entries[0]?.reused).toBe(true);
    expect(again.cameras[0]?.completedSearch).toEqual(
      first.cameras[0]?.completedSearch,
    );
    expect(again.cameras[0]?.readability?.passed).toBe(false);
    expect(
      state.events.some(
        (e) => e.stage === "production-framing-validation-selected",
      ),
    ).toBe(false);
  });
  it.each([
    "source",
    "resolver",
    "seed",
    "generation",
    "variant",
    "pose",
    "target",
    "budget",
    "missing",
  ] as const)(
    "does not reuse a completed search after %s evidence changes",
    async (change) => {
      unclearComposition();
      await resolve();
      const manifest = state.document.phase13 as {
        cameras: {
          completedSearch?: {
            seed: number;
            worldgenVersion: number;
            variant: string;
            fullGridCandidates: number;
          };
          position: { x: number };
          targetFeature: { fissureId?: number };
        }[];
      };
      const camera = manifest.cameras[0];
      const search = camera?.completedSearch;
      if (!camera || !search) throw Error("Missing completed search fixture");
      if (change === "source") state.sourceHash = "d".repeat(64);
      else if (change === "resolver") state.resolverHash = "e".repeat(64);
      else if (change === "seed") search.seed = 2;
      else if (change === "generation") search.worldgenVersion++;
      else if (change === "variant") search.variant = "primitive";
      else if (change === "pose") camera.position.x += 1;
      else if (change === "target") camera.targetFeature.fissureId = 9;
      else if (change === "budget") search.fullGridCandidates = 51;
      else delete camera.completedSearch;
      state.inspections = 0;
      state.events = [];
      const again = await resolve();
      expect(state.inspections).toBe(50);
      expect(again.resolution.entries[0]?.reused).toBe(false);
      expect(
        state.events.some(
          (e) => e.stage === "production-framing-validation-selected",
        ),
      ).toBe(true);
    },
  );
  it("cannot reuse completed search evidence when fresh geometry fails", async () => {
    unclearComposition();
    await resolve();
    state.inspections = 0;
    state.events = [];
    state.passAlways = false;
    await expect(resolve()).rejects.toThrow("passed geometry");
    expect(state.inspections).toBe(50);
  });
  it("inspects primitive comparison without inheriting production composition or search evidence", async () => {
    unclearComposition();
    const production = await resolve();
    expect(production.cameras[0]?.completedSearch?.variant).toBe("production");
    expect(production.cameras[0]?.readability).toBeDefined();
    state.inspections = 0;
    const primitive = await resolveHellCameras(
      1,
      "/synthetic-camera-budget",
      ["HELL-1"],
      "primitive",
    );
    expect(state.inspections).toBe(1);
    expect(primitive.cameras[0]?.comparison?.productionView).toBe("matched");
    expect(primitive.cameras[0]).not.toHaveProperty("completedSearch");
    expect(primitive.cameras[0]).not.toHaveProperty("readability");
    expect(primitive.cameras[0]).not.toHaveProperty("readabilitySetup");
    expect(primitive.cameras[0]).toMatchObject({
      ungraded: true,
      validation: { passed: true },
    });
  });
  it("retains HELL-2 search evidence only for the exact resolver while geometry reuse stays cheap", async () => {
    state.passAlways = true;
    const resolveCaldera = () =>
      resolveHellCameras(
        1,
        "/synthetic-camera-budget",
        ["HELL-2"],
        "production",
      );
    const first = await resolveCaldera();
    expect(first.cameras[0]?.completedSearch?.resolverHash).toBe(
      state.resolverHash,
    );
    state.inspections = 0;
    const same = await resolveCaldera();
    expect(state.inspections).toBe(1);
    expect(same.cameras[0]?.completedSearch).toEqual(
      first.cameras[0]?.completedSearch,
    );
    state.resolverHash = "e".repeat(64);
    state.inspections = 0;
    const changed = await resolveCaldera();
    expect(state.inspections).toBe(1);
    expect(changed.resolution.entries[0]?.reused).toBe(true);
    expect(changed.cameras[0]?.validatedByResolverHash).toBe(
      state.resolverHash,
    );
    expect(changed.cameras[0]).not.toHaveProperty("completedSearch");
    expect(changed.cameras[0]).not.toHaveProperty("readability");
    expect(changed.cameras[0]).not.toHaveProperty("readabilitySetup");
  });
});
