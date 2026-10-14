import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import {
  CHUNK_VOLUME,
  HALO_VOLUME,
} from "../../../shared/src/world/constants.js";
import {
  haloIndex,
  voxelIndex,
} from "../../../shared/src/world/coordinates.js";
import type { VoxelChunk } from "../../../shared/src/worldgen/chunk.js";
import {
  type DenseSurfaceEvidence,
  denseSurfaceEvidence,
} from "../../src/bench/pipeline.js";
import {
  type BenchmarkCase,
  DENSE_CANDIDATES_PER_STRATUM,
  DENSE_VERTICAL_OFFSETS,
  selectVisibleDenseCases,
} from "../../src/bench/samples.js";

const TARGET = 8958598;
function submergedChunk(): VoxelChunk {
  const blocks = new Uint16Array(CHUNK_VOLUME),
    haloBlocks = new Uint16Array(HALO_VOLUME),
    featureIds = new Uint32Array(HALO_VOLUME);
  for (let y = -1; y < 40; y++)
    for (let z = -1; z <= 32; z++)
      for (let x = -1; x <= 32; x++) {
        const block = y < 28 ? Block.Basalt : Block.Lava;
        haloBlocks[haloIndex(x, y, z)] = block;
        if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32)
          blocks[voxelIndex(x, y, z)] = block;
      }
  featureIds[haloIndex(16, 27, 16)] = TARGET;
  return { blocks, haloBlocks, featureIds } as VoxelChunk;
}
function setBlock(
  chunk: VoxelChunk,
  x: number,
  y: number,
  z: number,
  block: number,
  feature = 0,
) {
  chunk.haloBlocks[haloIndex(x, y, z)] = block;
  if (!chunk.featureIds) throw new Error("Missing fixture feature IDs");
  chunk.featureIds[haloIndex(x, y, z)] = feature;
  if (x >= 0 && x < 32 && y >= 0 && y < 32 && z >= 0 && z < 32)
    chunk.blocks[voxelIndex(x, y, z)] = block;
}
function sample(n: number): BenchmarkCase {
  return {
    id: `dense-${n}`,
    world: "main",
    region: "hellscape",
    seed: 1,
    cx: n,
    cy: 0,
    cz: 0,
    lod: 0,
    spacing: 1,
    category: "dense-ibara",
    denseEvidence: {
      mask: 1,
      weight: 1,
      acceptedRootsWithin96m: 8,
      featureId: TARGET + n,
    },
  };
}
const visible: DenseSurfaceEvidence = {
  solidVoxels: 100,
  openVoxels: 32668,
  featureVoxels: 10,
  selectedFeatureVoxels: 10,
  visibleFeatureFaces: 6,
  selectedFeatureFaces: 6,
};
const submerged = {
  ...visible,
  visibleFeatureFaces: 0,
  selectedFeatureFaces: 0,
};

describe("dense benchmark visible-surface qualification", () => {
  it("rejects the opaque-lava failure despite solid/open coverage and feature IDs", () => {
    const chunk = submergedChunk(),
      evidence = denseSurfaceEvidence(chunk, TARGET);
    expect(evidence.solidVoxels).toBeGreaterThan(0);
    expect(evidence.openVoxels).toBeGreaterThan(0);
    expect(evidence.selectedFeatureVoxels).toBe(1);
    expect(evidence.selectedFeatureFaces).toBe(0);
    expect(
      meshChunk(
        chunk.haloBlocks,
        new Uint16Array(HALO_VOLUME),
        chunk.featureIds,
      ).quads,
    ).toBe(0);
  });
  it("counts an actual feature face at the halo boundary, not a clipped internal face", () => {
    const chunk = submergedChunk();
    setBlock(chunk, 16, 31, 16, Block.Obsidian, TARGET);
    expect(denseSurfaceEvidence(chunk, TARGET).selectedFeatureFaces).toBe(0);
    setBlock(chunk, 16, 32, 16, Block.Air);
    const evidence = denseSurfaceEvidence(chunk, TARGET);
    expect(evidence.selectedFeatureFaces).toBe(1);
    expect(
      meshChunk(
        chunk.haloBlocks,
        new Uint16Array(HALO_VOLUME),
        chunk.featureIds,
      ).quads,
    ).toBe(1);
  });
  it("requires the selected feature rather than an unrelated visible neighbour", () => {
    const chunk = submergedChunk();
    setBlock(chunk, 16, 31, 16, Block.Obsidian, TARGET + 1);
    setBlock(chunk, 16, 32, 16, Block.Air);
    const evidence = denseSurfaceEvidence(chunk, TARGET);
    expect(evidence.visibleFeatureFaces).toBe(1);
    expect(evidence.selectedFeatureFaces).toBe(0);
  });
  it("retains fifty unique deterministic strata and all production density evidence", () => {
    const candidates = Array.from({ length: 200 }, (_, i) => sample(i));
    const first = selectVisibleDenseCases(candidates, 50, () => visible);
    const second = selectVisibleDenseCases(candidates, 50, () => visible);
    expect(first).toEqual(second);
    expect(first).toHaveLength(50);
    expect(new Set(first.map((p) => `${p.cx},${p.cy},${p.cz}`)).size).toBe(50);
    expect(first.map((p) => p.cx)).toEqual(
      Array.from({ length: 50 }, (_, i) => i * 4 + 2),
    );
    for (const p of first)
      expect(p.denseEvidence).toMatchObject({
        mask: 1,
        weight: 1,
        acceptedRootsWithin96m: 8,
      });
  });
  it("tries the same root's adjacent vertical interface before another candidate", () => {
    const calls: number[] = [];
    const result = selectVisibleDenseCases([sample(0)], 1, (p) => {
      calls.push(p.cy);
      return p.cy === 1 ? visible : submerged;
    });
    expect(calls).toEqual([0, 1]);
    expect(result[0]).toMatchObject({ id: "dense-0", cy: 1 });
    expect(
      result[0]?.denseEvidence?.selection?.attempts.map((a) => a.reason),
    ).toEqual(["selected-feature-occluded", "accepted"]);
  });
  it("preserves original midpoints when strata contain fewer than two candidates", () => {
    for (const [size, count] of [
      [4, 3],
      [11, 10],
    ]) {
      const candidates = Array.from({ length: size as number }, (_, i) =>
        sample(i),
      );
      const result = selectVisibleDenseCases(
        candidates,
        count as number,
        () => visible,
      );
      expect(result.map((p) => p.cx)).toEqual(
        Array.from({ length: count as number }, (_, i) =>
          Math.floor(((i + 0.5) * (size as number)) / (count as number)),
        ),
      );
    }
  });
  it("advances only within the current stratum after all bounded vertical probes", () => {
    const calls: string[] = [];
    const result = selectVisibleDenseCases([sample(0), sample(1)], 1, (p) => {
      calls.push(`${p.id}:${p.cy}`);
      return p.id === "dense-0" ? visible : submerged;
    });
    expect(calls).toEqual([
      "dense-1:0",
      "dense-1:1",
      "dense-1:-1",
      "dense-0:0",
    ]);
    expect(result[0]?.id).toBe("dense-0");
  });
  it("fails honestly at the finite bound instead of inspecting the whole root pool", () => {
    let calls = 0;
    expect(() =>
      selectVisibleDenseCases(
        Array.from({ length: 1000 }, (_, i) => sample(i)),
        1,
        () => {
          calls++;
          return submerged;
        },
      ),
    ).toThrow("completed 0/1; stratum 0 exhausted");
    expect(calls).toBe(
      DENSE_CANDIDATES_PER_STRATUM * DENSE_VERTICAL_OFFSETS.length,
    );
  });
  it("never catches kernel failures as rejected candidate data", () => {
    const error = new Error("production geometry failed");
    expect(() =>
      selectVisibleDenseCases([sample(0)], 1, () => {
        throw error;
      }),
    ).toThrow(error);
  });
  it("retains unique chunks when a vertical adjustment reaches another stratum", () => {
    const calls: number[] = [];
    const result = selectVisibleDenseCases(
      [sample(0), { ...sample(1), cx: 0, cy: 1 }],
      2,
      (p) => {
        calls.push(p.cy);
        return p.cy === 0 ? submerged : visible;
      },
    );
    expect(calls).toEqual([0, 1, 2]);
    expect(result.map((p) => p.cy)).toEqual([1, 2]);
    expect(result[1]?.denseEvidence?.selection?.attempts[0]?.reason).toBe(
      "duplicate-chunk",
    );
  });
});
