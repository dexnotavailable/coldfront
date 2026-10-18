import {
  Group,
  type Mesh,
  type MeshBasicMaterial,
  ShaderLib,
  Vector3,
  type WebGLRenderer,
} from "three";
import { describe, expect, it, vi } from "vitest";
import {
  FarCutCaps,
  farCutOccupancy,
} from "../../../client/src/engine/far-cut-cap.js";
import {
  FAR_NEAR_COVERAGE_GLSL,
  FarTerrainCoverage,
} from "../../../client/src/engine/far-terrain-coverage.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import {
  FAR_COLUMN_COUNT,
  farColumnIndex,
  quantizeFarY,
} from "../../../shared/src/worldgen/far/coordinates.js";
import type {
  FarRun,
  FarTileRuns,
} from "../../../shared/src/worldgen/far/types.js";

function runs(
  columns: ReadonlyMap<
    number,
    readonly Pick<FarRun, "bottom" | "top" | "block">[]
  >,
): FarTileRuns {
  const offsets = new Uint32Array(FAR_COLUMN_COUNT + 1);
  const words: number[] = [];
  for (let column = 0; column < FAR_COLUMN_COUNT; column++) {
    offsets[column] = words.length / 4;
    for (const run of columns.get(column) ?? [])
      words.push(
        (quantizeFarY(run.bottom) | (quantizeFarY(run.top) << 16)) >>> 0,
        (run.block | (0xffff << 16)) >>> 0,
        0xdeadbeef,
        7,
      );
  }
  offsets[FAR_COLUMN_COUNT] = words.length / 4;
  return {
    address: { tx: -1, tz: 0, lod: 6 },
    layer: "surface",
    revision: 0,
    offsets,
    words: new Uint32Array(words),
    statistics: {
      densityCalls: 0,
      columns: FAR_COLUMN_COUNT,
      runs: words.length / 4,
      quads: 0,
      skirtQuads: 0,
      typedArrayBytes: 0,
    },
  };
}

describe("far cut caps (CPU occupancy/resources, not GPU validation)", () => {
  it("retains overhang gaps and fractional half-open crossings and hides every material identity", () => {
    const tile = runs(
      new Map([
        [
          farColumnIndex(0, 0),
          [
            { bottom: -12.5, top: -2.25, block: Block.Stone },
            { bottom: 3.125, top: 10.5, block: Block.GoldOre },
          ],
        ],
        [farColumnIndex(1, 0), [{ bottom: -20, top: 20, block: Block.Leaves }]],
        [farColumnIndex(2, 0), [{ bottom: -20, top: 20, block: Block.Water }]],
        [farColumnIndex(3, 0), [{ bottom: -20, top: 20, block: Block.Lava }]],
        [farColumnIndex(4, 0), [{ bottom: -20, top: 20, block: Block.Glass }]],
        [
          farColumnIndex(-1, 0),
          [{ bottom: -20, top: 20, block: Block.GoldOre }],
        ],
      ]),
    );
    for (const height of [-12.5, -3, 3.125, 10.499])
      expect(farCutOccupancy(tile, height)[0]).toBe(255);
    for (const height of [-13, -2.25, 0, 10.5, Infinity])
      expect(farCutOccupancy(tile, height)[0]).toBe(0);
    const slice = farCutOccupancy(tile, 5);
    expect([...slice.subarray(0, 5)]).toEqual([255, 0, 0, 0, 255]);
    expect(new Set(slice)).toEqual(new Set([255, 0]));
    expect(slice.filter((value) => value === 255)).toHaveLength(2);
    // A gold run and a plain stone run produce identical GPU occupancy.
    const stoneWords = tile.words.slice();
    for (let i = 1; i < stoneWords.length; i += 4)
      if (((stoneWords[i] ?? 0) & 0xffff) === Block.GoldOre)
        stoneWords[i] = ((stoneWords[i] ?? 0) & 0xffff0000) | Block.Stone;
    expect(farCutOccupancy({ ...tile, words: stoneWords }, 5)).toEqual(slice);
    expect(() => farCutOccupancy(tile, Number.NaN)).toThrow("cut");
    expect(() =>
      farCutOccupancy({ ...tile, offsets: new Uint32Array(3) }, 0),
    ).toThrow("buffers");
  });

  it("shares the exact fragment coverage mask so a 32 m near footprint cuts only half of a 64 m far cell", () => {
    const tile = runs(
      new Map([
        [farColumnIndex(0, 0), [{ bottom: -10, top: 10, block: Block.Stone }]],
      ]),
    );
    const coverage = new FarTerrainCoverage();
    const origin = { value: new Vector3(-2048, 0, 0) };
    const caps = new FarCutCaps({ color: 0x333333, coverage, origin });
    const group = new Group();
    const handle = { id: 1, runs: tile };
    try {
      const near = [
        {
          minX: -2048,
          minZ: 0,
          maxX: -2016,
          maxZ: 32,
          ready: true,
          drawn: true,
        },
      ];
      caps.setCut(0, near);
      caps.prepare(handle, group);
      caps.setVisible(handle, true);
      const mesh = group.children[0] as Mesh;
      expect(mesh.visible).toBe(true);
      expect(mesh.position.toArray()).toEqual([-1024, 0, 1024]);
      expect(mesh.scale.toArray()).toEqual([2048, 2048, 1]);
      expect(coverage.covers(-2040, 8)).toBe(true);
      expect(coverage.covers(-2000, 8)).toBe(false);
      expect(coverage.covers(-2040, 40)).toBe(false);
      const material = mesh.material as MeshBasicMaterial;
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        vertexShader: ShaderLib.basic.vertexShader,
        fragmentShader: ShaderLib.basic.fragmentShader,
      };
      material.onBeforeCompile(
        shader as unknown as Parameters<typeof material.onBeforeCompile>[0],
        {} as WebGLRenderer,
      );
      expect(shader.uniforms.uFarNearMask).toBe(coverage.mask);
      expect(shader.uniforms.uRenderOrigin).toBe(origin);
      expect(shader.fragmentShader).toContain(FAR_NEAR_COVERAGE_GLSL);
      expect(shader.fragmentShader).toContain(
        "cfNearCovers(vFarCapWorld+uRenderOrigin.xz)",
      );
      expect(shader.fragmentShader).not.toContain("uTiles");
      expect(material.toneMapped).toBe(false);
      expect(material.color.getHex()).toBe(0x333333);
      caps.setCut(11, near);
      expect(mesh.visible).toBe(false);
      caps.setCut(0, []);
      expect(mesh.visible).toBe(true);
      expect(coverage.covers(-2040, 8)).toBe(false);
      caps.setCut(Infinity, []);
      expect(mesh.visible).toBe(false);
    } finally {
      caps.dispose();
      coverage.dispose();
    }
  });

  it("rebuilds from retained runs after loss and releases only owned resources, once", () => {
    const tile = runs(
      new Map([
        [farColumnIndex(0, 0), [{ bottom: -10, top: 10, block: Block.Stone }]],
      ]),
    );
    const coverage = new FarTerrainCoverage();
    const caps = new FarCutCaps({
      color: 0x333333,
      coverage,
      origin: { value: new Vector3() },
    });
    const group = new Group();
    const first = { id: 1, runs: tile };
    const second = { id: 2, runs: tile };
    const maskDisposed = vi.fn();
    coverage.mask.value.addEventListener("dispose", maskDisposed);
    try {
      caps.setCut(0, []);
      caps.prepare(first, group);
      caps.prepare(second, group);
      caps.setVisible(first, true);
      const mesh = group.children[0] as Mesh;
      const otherMesh = group.children[1] as Mesh;
      expect(mesh.geometry).toBe(otherMesh.geometry);
      const geometryDisposed = vi.fn();
      const materialDisposed = vi.fn();
      mesh.geometry.addEventListener("dispose", geometryDisposed);
      (mesh.material as MeshBasicMaterial).addEventListener(
        "dispose",
        materialDisposed,
      );
      caps.contextLost();
      caps.contextLost();
      expect(group.children).toHaveLength(0);
      expect(geometryDisposed).toHaveBeenCalledOnce();
      expect(materialDisposed).toHaveBeenCalledOnce();
      expect(maskDisposed).not.toHaveBeenCalled();
      caps.contextRestored(first);
      caps.contextRestored(first);
      expect(group.children).toHaveLength(1);
      const restored = group.children[0] as Mesh;
      expect(restored).not.toBe(mesh);
      expect(restored.geometry).not.toBe(mesh.geometry);
      expect(restored.visible).toBe(true);
      caps.release(first);
      caps.release(first);
      expect(group.children).toHaveLength(0);
      caps.contextRestored(second);
      expect(group.children).toHaveLength(1);
      expect(group.children[0]?.visible).toBe(false);
      caps.dispose();
      caps.dispose();
      expect(group.children).toHaveLength(0);
      expect(maskDisposed).not.toHaveBeenCalled();
      coverage.dispose();
      expect(maskDisposed).toHaveBeenCalledOnce();
    } finally {
      caps.dispose();
      coverage.dispose();
    }
  });
});
