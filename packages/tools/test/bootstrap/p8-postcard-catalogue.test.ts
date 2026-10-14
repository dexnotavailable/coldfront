import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadPostcardCatalogue,
  validatePostcardSelection,
} from "../../../client/src/bootstrap/postcard.js";
import {
  parseTerrainViewMode,
  postcardPresentations,
} from "../../../client/src/game/postcard.js";
import {
  emptyWorldSave,
  parseWorldSave,
  sameIdentity,
  validIdentity,
  worldKey,
} from "../../../client/src/game/world-save.js";
import type { GenerationVariant } from "../../../shared/src/world/generation-variant.js";
import {
  generationKey,
  generationVariant,
} from "../../../shared/src/world/generation-variant.js";

const hash = "a".repeat(64),
  resolver = "b".repeat(64);
function document(variant: GenerationVariant = "production") {
  return {
    [variant === "primitive" ? "phase13Primitive" : "phase13"]: {
      schema: 1,
      worldKind: "main",
      seed: 1,
      worldgenVersion: 4,
      sourceHash: hash,
      resolverHash: resolver,
      variant,
      cameras: [1, 2].map((i) => ({
        id: `HELL-${i}`,
        seed: 1,
        region: "hellscape",
        kind: "eye-level",
        position: { x: 6200, y: 100, z: 6100 },
        target: { x: 6300, y: 110, z: 6000 },
        hours: 18,
        radius: 512,
        validation: { passed: true },
        validatedByResolverHash: resolver,
        targetFeature: {
          ...(i === 1
            ? { kind: "thorn-cluster", featureIds: [43, 99] }
            : { kind: "caldera", calderaId: 2 }),
          bounds: {
            minX: 6250,
            maxX: 6350,
            minY: 0,
            maxY: 200,
            minZ: 5900,
            maxZ: 6050,
          },
        },
      })),
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("P8 manifest and namespace boundary", () => {
  it("validates only source/resolver/variant-bound HELL views and labels with region names", () => {
    for (const variant of ["production", "primitive"] as const) {
      const selection = validatePostcardSelection(
        document(variant),
        "HELL-1",
        1,
        hash,
        variant,
      );
      expect(generationVariant(selection.initial.identity)).toBe(variant);
      expect(postcardPresentations(selection.cameras)).toEqual([
        { id: "HELL-1", name: "Ibara 1" },
        { id: "HELL-2", name: "Ibara 2" },
      ]);
    }
  });
  it.each([
    "source",
    "resolver",
    "variant",
    "seed",
    "version",
    "target",
    "camera",
    "duplicate",
  ])("rejects %s drift", (key) => {
    const data = document(),
      manifest = data.phase13!;
    if (key === "source") manifest.sourceHash = resolver;
    if (key === "resolver") manifest.cameras[0]!.validatedByResolverHash = hash;
    if (key === "variant") manifest.variant = "primitive";
    if (key === "seed") manifest.seed = 2;
    if (key === "version") manifest.worldgenVersion = 3;
    if (key === "target")
      Object.assign(manifest.cameras[0]!.targetFeature, { featureIds: [] });
    if (key === "camera") manifest.cameras[0]!.position.x = Number.NaN;
    if (key === "duplicate") manifest.cameras.push(manifest.cameras[0]!);
    expect(() => validatePostcardSelection(data, "HELL-1", 1, hash)).toThrow();
  });
  it("never substitutes production or TEST cameras into primitive", () => {
    expect(() =>
      validatePostcardSelection(document(), "HELL-1", 1, hash, "primitive"),
    ).toThrow();
    expect(() =>
      validatePostcardSelection(
        document(),
        "P12-hellscape",
        1,
        hash,
        "primitive",
      ),
    ).toThrow();
    expect(() =>
      validatePostcardSelection(document(), "TEST-1", 1, hash, "primitive"),
    ).toThrow();
  });
  it("loads matching ordinary-play catalogues and hides unavailable/stale files", async () => {
    vi.stubGlobal("location", { origin: "http://localhost" });
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => document(),
    }));
    vi.stubGlobal("fetch", fetcher);
    const identity = {
      kind: "main" as const,
      seed: 1,
      generation: generationKey(4, hash),
    };
    expect(
      (await loadPostcardCatalogue(identity, "/coldfront/", hash)).map(
        (camera) => camera.id,
      ),
    ).toEqual(["HELL-1", "HELL-2"]);
    expect(fetcher.mock.calls).toHaveLength(1);
    expect(
      await loadPostcardCatalogue(
        { ...identity, generation: generationKey(4, resolver) },
        "/",
        hash,
      ),
    ).toEqual([]);
    expect(
      await loadPostcardCatalogue(
        { ...identity, generation: generationKey(4, hash, "primitive") },
        "/",
        hash,
      ),
    ).toEqual([]);
    fetcher.mockRejectedValueOnce(new Error("missing file"));
    expect(await loadPostcardCatalogue(identity, "/", hash)).toEqual([]);
  });
  it("separates edits, pose, discoveries and cache/session keys while retaining production keys", () => {
    const production = {
      kind: "main" as const,
      seed: 1,
      generation: generationKey(4, hash),
    };
    const primitive = {
      ...production,
      generation: generationKey(4, hash, "primitive"),
    };
    expect(production.generation).toBe(`4:${hash}`);
    expect(sameIdentity(production, primitive)).toBe(false);
    expect(worldKey(production)).not.toBe(worldKey(primitive));
    const saved = {
      ...emptyWorldSave(production),
      discoveries: ["hellscape" as const],
      pose: { x: 0, y: 0, z: 0, yaw: 0, flying: false },
      edits: [{ x: 0, y: 0, z: 0, block: 1 }],
    };
    expect(() => parseWorldSave(saved, primitive, false)).toThrow("identity");
    expect(parseWorldSave(undefined, primitive, false)).toMatchObject({
      edits: [],
      pose: null,
      discoveries: [],
    });
    expect(validIdentity({ ...primitive, kind: "test" })).toBe(false);
    expect(() => generationVariant({ ...primitive, kind: "test" })).toThrow();
  });
  it("accepts only the three view modes", () => {
    expect(
      ["normal", "clay", "features", "wire", null, 2].map(parseTerrainViewMode),
    ).toEqual(["normal", "clay", "features", "normal", "normal", "normal"]);
  });
});
