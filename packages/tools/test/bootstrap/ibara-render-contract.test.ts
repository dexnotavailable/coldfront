import { readFileSync } from "node:fs";
import {
  FloatType,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Scene,
  ShaderLib,
  Vector3,
  type WebGLRenderer,
} from "three";
import { describe, expect, it } from "vitest";
import {
  IBARA_EFFECT_LIMITS,
  IbaraEffects,
  ventAnchors,
} from "../../../client/src/engine/ibara-effects.js";
import { WorldRenderer } from "../../../client/src/engine/renderer.js";
import {
  createTerrainMaterials,
  TERRAIN_BLOOM_THRESHOLD,
  TERRAIN_REFLECTED_CEILING,
} from "../../../client/src/engine/terrain-material.js";
import type { ChunkResult } from "../../../client/src/engine/worker-protocol.js";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import { HALO_VOLUME } from "../../../shared/src/world/constants.js";
import {
  haloIndex,
  voxelIndex,
} from "../../../shared/src/world/coordinates.js";

function meshFixture(): ChunkResult {
  const blocks = new Uint16Array(HALO_VOLUME),
    ids = new Uint32Array(HALO_VOLUME),
    light = new Uint16Array(HALO_VOLUME).fill(0xf731),
    core = new Uint16Array(32768);
  for (const [x, block, id] of [
    [2, Block.Obsidian, 0x80000001],
    [4, Block.Basalt, 0xffffffff],
    [6, Block.Lava, 0x02000001],
    [8, Block.Water, 0],
    [10, Block.VentMouth, 0x02000002],
  ]) {
    const i = haloIndex(x as number, 2, 2);
    blocks[i] = block as number;
    ids[i] = id as number;
    core[voxelIndex(x as number, 2, 2)] = block as number;
  }
  return {
    type: "chunk",
    id: 1,
    world: {
      id: 1,
      identity: { kind: "test", seed: 1, generation: "p6-fixture" },
    },
    address: { cx: -400, cy: 0, cz: 400 },
    revision: 0,
    blocks: core,
    light,
    mesh: meshChunk(blocks, light, ids),
    regionColor: [100, 100, 100],
    timings: { generate: 0, light: 0, mesh: 0 },
    cacheBytes: 0,
  };
}

describe("Ibara renderer contracts (CPU/source proof; real pixels are a separate gate)", () => {
  it("consumes registry emission/gloss, preserves water, and composes all five Lambert variants with exact flat feature halves", () => {
    const terrain = createTerrainMaterials(new Plane());
    try {
      expect(terrain.materials).toHaveLength(5);
      expect(
        new Set(terrain.materials.map((m) => m.customProgramCacheKey())).size,
      ).toBe(5);
      expect(TERRAIN_REFLECTED_CEILING).toBeLessThan(TERRAIN_BLOOM_THRESHOLD);
      for (const [kind, material] of terrain.materials.entries()) {
        const shader = {
          uniforms: {} as Record<string, { value: unknown }>,
          vertexShader: ShaderLib.lambert.vertexShader,
          fragmentShader: ShaderLib.lambert.fragmentShader,
        };
        material.onBeforeCompile(
          shader as Parameters<typeof material.onBeforeCompile>[0],
          {} as WebGLRenderer,
        );
        expect(shader.vertexShader).toContain(
          "flat varying highp vec2 vFeatureIdParts",
        );
        expect(shader.fragmentShader).toContain(
          "uint(vFeatureIdParts.x) | (uint(vFeatureIdParts.y) << 16u)",
        );
        expect(shader.fragmentShader).toContain("highp uint cfFeatureId()");
        for (const shift of [12, 8, 4])
          expect(shader.fragmentShader).toContain(`packedLight>>${shift}u`);
        expect(shader.uniforms.uViewMode).toBe(terrain.uniforms.viewMode);
        expect(
          (shader.uniforms.uGloss?.value as number[] | undefined)?.[
            Block.Obsidian
          ],
        ).toBe(BLOCK_REGISTRY[Block.Obsidian]?.gloss);
        const source = (
          shader.uniforms.uEmission?.value as
            | {
                x: number;
                y: number;
                z: number;
                w: number;
              }[]
            | undefined
        )?.[Block.Lava];
        expect(source).toMatchObject({ x: 1, y: 7 / 15, z: 2 / 15, w: 3.2 });
        expect(
          shader.fragmentShader.indexOf("outgoingLight=min(outgoingLight"),
        ).toBeLessThan(
          shader.fragmentShader.indexOf("outgoingLight += pow(source.rgb"),
        );
        expect(shader.fragmentShader.includes("float waterPath=")).toBe(
          kind === 3,
        );
        expect(material.transparent).toBe(kind === 2 || kind === 3);
        expect(material.depthWrite).toBe(kind < 2 || kind === 4);
        expect(shader.vertexShader.includes("transformed += aExpand")).toBe(
          kind < 2,
        );
      }
    } finally {
      terrain.texture.dispose();
      for (const material of terrain.materials) material.dispose();
    }
  });
  it("uploads both ID halves without normalization or integer-pointer conversion and includes lava in depth occlusion", () => {
    const result = meshFixture(),
      terrain = createTerrainMaterials(new Plane()),
      effects = new IbaraEffects(new Plane());
    const chunks = new Map();
    const renderer = Object.assign(
      Object.create(WorldRenderer.prototype) as object,
      {
        chunks,
        scene: new Scene(),
        depthScene: new Scene(),
        terrain,
        ibaraEffects: effects,
        depthMaterial: new MeshBasicMaterial(),
        borderMaterial: new MeshBasicMaterial(),
        colors: { cap: 0x222222 },
        cut: Infinity,
        worldId: 1,
      },
    ) as unknown as WorldRenderer;
    try {
      renderer.upload(result);
      const chunk = chunks.values().next().value;
      expect(chunk.group.position.toArray()).toEqual([-12800, 0, 12800]);
      expect(chunk.depth.children).toHaveLength(2); // opaque + lava, never water
      const opaque = chunk.group.children.find(
        (m: Mesh) => m.material === terrain.materials[0],
      ) as Mesh;
      const attribute = opaque.geometry.getAttribute("aFeatureIdParts");
      expect(attribute.itemSize).toBe(2);
      expect(attribute.normalized).toBe(false);
      expect((attribute as unknown as { gpuType: number }).gpuType).toBe(
        FloatType,
      );
      const reconstructed = new Set<number>();
      for (let i = 0; i < attribute.count; i++)
        reconstructed.add(
          (attribute.getX(i) | (attribute.getY(i) << 16)) >>> 0,
        );
      expect(reconstructed.has(0x80000001)).toBe(true);
      expect(reconstructed.has(0xffffffff)).toBe(true);
      const lava = chunk.group.children.find(
        (m: Mesh) => m.material === terrain.materials[4],
      ) as Mesh;
      expect(lava.castShadow).toBe(true);
      expect(lava.receiveShadow).toBe(true);
      const before = chunk.group.children.map((m: Mesh) => m.geometry);
      Object.assign(renderer, {
        bloom: { intensity: 0.2 },
        effects: { particles: { visible: true }, pop: { visible: true } },
      });
      for (const [mode, value] of [
        ["clay", 1],
        ["features", 2],
        ["normal", 0],
      ] as const) {
        renderer.setViewMode(mode);
        expect(terrain.uniforms.viewMode.value).toBe(value);
        expect(chunk.group.children.map((m: Mesh) => m.geometry)).toEqual(
          before,
        );
      }
      renderer.remove("-400,0,400", 1);
      expect(effects.statistics.sourceAnchors).toBe(0);
    } finally {
      renderer.removeWorld(1);
      effects.dispose();
      terrain.texture.dispose();
      for (const material of terrain.materials) material.dispose();
    }
  });
  it("uses only exposed upward vent faces as decoration anchors", () => {
    const result = meshFixture(),
      part = result.mesh.parts[0];
    if (!part) throw new Error("Missing fixture opaque mesh");
    const anchors = ventAnchors(part, { x: -12800, y: 0, z: 12800 });
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toMatchObject({ x: -12789.5, y: 3, z: 12802.5 });
  });
  it("caps effects, freezes at identical display times, suppresses postcard particles and diagnostic decoration, and cleans worlds", () => {
    const effects = new IbaraEffects(new Plane(new Vector3(0, -1, 0), 100000));
    try {
      for (let c = 0; c < 20; c++)
        effects.register(
          String(c),
          1,
          Array.from({ length: 20 }, (_, i) => ({
            x: c * 2,
            y: 2,
            z: i * 2,
            phase: i * 0.3,
          })),
        );
      effects.register("other", 2, [{ x: 0, y: 2, z: 0, phase: 0 }]);
      effects.setWorld(1);
      effects.setMode("normal", false);
      effects.update(2200, Infinity, { x: 0, y: 5, z: 0 });
      expect(effects.statistics.sourceAnchors).toBe(
        20 * IBARA_EFFECT_LIMITS.anchorsPerChunk + 1,
      );
      expect(effects.statistics.flames).toBe(24);
      expect(effects.statistics.embers).toBe(192);
      const pose = Array.from(effects.embers.instanceMatrix.array),
        flamePose = Array.from(effects.flames.instanceMatrix.array);
      effects.update(2200, Infinity, { x: 0, y: 5, z: 0 });
      expect(Array.from(effects.embers.instanceMatrix.array)).toEqual(pose);
      expect(Array.from(effects.flames.instanceMatrix.array)).toEqual(
        flamePose,
      );
      effects.update(3200, Infinity, { x: 0, y: 5, z: 0 });
      expect(Array.from(effects.embers.instanceMatrix.array)).not.toEqual(pose);
      effects.setMode("normal", true);
      effects.update(2200, Infinity, { x: 0, y: 5, z: 0 });
      expect(effects.statistics.embers).toBe(0);
      expect(effects.statistics.flames).toBe(24);
      for (const mode of ["clay", "features"] as const) {
        effects.setMode(mode, false);
        effects.update(2200, Infinity, { x: 0, y: 5, z: 0 });
        expect(effects.statistics.flames).toBe(0);
        expect(effects.statistics.embers).toBe(0);
      }
      effects.setMode("normal", false);
      effects.update(2200, 2, { x: 0, y: 5, z: 0 });
      expect(effects.statistics.flames).toBe(0);
      effects.setWorld(2);
      effects.update(2200, Infinity, { x: 0, y: 5, z: 0 });
      expect(effects.statistics.flames).toBe(1);
      effects.remove("other");
      expect(effects.flames.count).toBe(0);
    } finally {
      effects.dispose();
    }
    expect(effects.statistics.sourceAnchors).toBe(0);
  });
  it("keeps HDR composition and after-post marks on the existing renderer path", () => {
    const source = readFileSync(
      "packages/client/src/engine/renderer.ts",
      "utf8",
    );
    expect(source).toContain("frameBufferType: HalfFloatType");
    expect(source).toContain("mode: ToneMappingMode.ACES_FILMIC");
    expect(source).toContain("luminanceThreshold: TERRAIN_BLOOM_THRESHOLD");
    expect(source).toContain("this.renderer.render(this.marks, this.camera)");
  });
  it("prepares all material classes and effect variants even for an empty destination, and restores visibility on compiler failure", () => {
    const terrain = createTerrainMaterials(new Plane()),
      ibaraEffects = new IbaraEffects(new Plane()),
      scene = new Scene();
    scene.add(ibaraEffects.flames, ibaraEffects.embers);
    const effects = { pop: new Mesh(), ghost: new Mesh() },
      avatar = { silhouette: new Mesh() },
      outline = new Mesh();
    effects.pop.visible =
      effects.ghost.visible =
      avatar.silhouette.visible =
      outline.visible =
        false;
    let fail = false,
      visited = 0;
    const renderer = Object.assign(
      Object.create(WorldRenderer.prototype) as object,
      {
        terrain,
        ibaraEffects,
        scene,
        depthScene: new Scene(),
        marks: new Scene(),
        camera: new PerspectiveCamera(),
        chunks: new Map(),
        effects,
        avatar,
        outline,
        renderer: {
          compile(drawing: Scene) {
            if (drawing === scene) {
              const variants = drawing.children.filter(
                (o) =>
                  o instanceof Mesh &&
                  terrain.materials.includes(
                    o.material as (typeof terrain.materials)[number],
                  ),
              ) as Mesh[];
              expect(variants).toHaveLength(10);
              expect(variants.filter((m) => m.receiveShadow)).toHaveLength(5);
              expect(
                ibaraEffects.flames.visible && ibaraEffects.embers.visible,
              ).toBe(true);
              for (const mesh of variants)
                expect(
                  mesh.geometry.getAttribute("aFeatureIdParts").itemSize,
                ).toBe(2);
              visited++;
              if (fail) throw new Error("compile failed");
            }
          },
        },
      },
    ) as unknown as WorldRenderer;
    try {
      renderer.compile();
      fail = true;
      expect(() => renderer.compile()).toThrow("compile failed");
      expect(visited).toBe(2);
      expect(scene.children).toEqual([
        ibaraEffects.flames,
        ibaraEffects.embers,
      ]);
      expect(
        ibaraEffects.flames.visible ||
          ibaraEffects.embers.visible ||
          effects.pop.visible ||
          effects.ghost.visible ||
          avatar.silhouette.visible ||
          outline.visible,
      ).toBe(false);
    } finally {
      terrain.texture.dispose();
      for (const material of terrain.materials) material.dispose();
      ibaraEffects.dispose();
    }
  });
});
