import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// GPU calls are isolated here; actual WorldRenderer construction/lost handler,
// Three resources, EffectPass/Bloom and their disposal events remain real.
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      shadowMap = {
        enabled: false,
        type: 0,
        autoUpdate: true,
        needsUpdate: false,
      };
      info = {
        autoReset: true,
        render: { calls: 0, triangles: 0 },
        memory: { geometries: 0, textures: 0 },
        reset() {},
      };
      debug = {};
      pixelRatio = 1;
      constructor(readonly options: { context: unknown }) {}
      getContext() {
        return this.options.context;
      }
      setPixelRatio(value: number) {
        this.pixelRatio = value;
      }
      getPixelRatio() {
        return this.pixelRatio;
      }
      setSize() {}
      getDrawingBufferSize(value: { set(x: number, y: number): unknown }) {
        return value.set(1280, 720);
      }
      compile() {}
      dispose() {}
    },
  };
});
vi.mock("postprocessing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("postprocessing")>();
  const { WebGLRenderTarget } = await import("three");
  return {
    ...actual,
    EffectComposer: class {
      inputBuffer = new WebGLRenderTarget(1280, 720);
      outputBuffer = new WebGLRenderTarget(1280, 720);
      passes: import("postprocessing").Pass[] = [];
      addPass(pass: import("postprocessing").Pass) {
        this.passes.push(pass);
      }
      setSize(width: number, height: number) {
        this.inputBuffer.setSize(width, height);
        this.outputBuffer.setSize(width, height);
        for (const pass of this.passes) pass.setSize(width, height);
      }
      dispose() {
        for (const pass of this.passes) pass.dispose();
        this.passes.length = 0;
        this.inputBuffer.dispose();
        this.outputBuffer.dispose();
      }
    },
  };
});

import type { BloomEffect, EffectPass, Pass } from "postprocessing";
import {
  DataTexture,
  Mesh,
  type MeshBasicMaterial,
  type Texture,
  WebGLRenderTarget,
} from "three";
import type { SunLight } from "three/addons/lights/SunLight.js";
import { WorldRenderer } from "../../../client/src/engine/renderer.js";
import type { createTerrainMaterials } from "../../../client/src/engine/terrain-material.js";
import type { ChunkResult } from "../../../client/src/engine/worker-protocol.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import { meshChunk } from "../../../shared/src/meshing/greedy.js";
import { HALO_VOLUME } from "../../../shared/src/world/constants.js";
import {
  haloIndex,
  voxelIndex,
} from "../../../shared/src/world/coordinates.js";

type Resource = {
  addEventListener(type: "dispose", listener: () => void): void;
  removeEventListener(type: "dispose", listener: () => void): void;
};
type Internal = {
  terrain: ReturnType<typeof createTerrainMaterials>;
  drawnEffectTextures: Set<Texture>;
  waterDepthTarget: WebGLRenderTarget;
  farWaterDepthTarget: WebGLRenderTarget;
  farPreparationTarget: WebGLRenderTarget;
  sun: SunLight;
  bloom: BloomEffect;
  postPass: EffectPass;
  composer: {
    inputBuffer: WebGLRenderTarget;
    outputBuffer: WebGLRenderTarget;
    passes: Pass[];
  };
  chunks: Map<
    string,
    {
      geometries: import("three").BufferGeometry[];
      cap: { texture: Texture; mesh: Mesh };
      depthCap: Mesh;
    }
  >;
};
function fixture() {
  const native = {
    lost: false,
    MAX_ARRAY_TEXTURE_LAYERS: 0x88ff,
    getParameter: () => 4096,
    getError: vi.fn(() => 0),
    isContextLost: () => native.lost,
  };
  const canvas = Object.assign(new EventTarget(), {
    clientWidth: 1280,
    clientHeight: 720,
    getContext: () => native,
  }) as unknown as HTMLCanvasElement;
  const renderer = new WorldRenderer(canvas, {
    ink: "#141b23",
    steel: "#718394",
    cap: "#535b61",
  });
  const internals = renderer as unknown as Internal;
  const disposed: string[] = [],
    wrongGeneration: string[] = [];
  const own = (resource: Resource, name: string) => {
    const listener = () => {
      if (!native.lost) wrongGeneration.push(name);
      disposed.push(name);
      resource.removeEventListener("dispose", listener);
    };
    resource.addEventListener("dispose", listener);
  };
  const loss = () => {
    native.lost = true;
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  };
  return {
    renderer,
    internals,
    native,
    canvas,
    own,
    disposed,
    wrongGeneration,
    loss,
  };
}
function chunk(): ChunkResult {
  const blocks = new Uint16Array(HALO_VOLUME),
    light = new Uint16Array(HALO_VOLUME).fill(0xf000),
    ids = new Uint32Array(HALO_VOLUME),
    core = new Uint16Array(32768);
  blocks[haloIndex(16, 0, 16)] = Block.Basalt;
  core[voxelIndex(16, 0, 16)] = Block.Basalt;
  return {
    type: "chunk",
    id: 1,
    world: {
      id: 1,
      identity: { kind: "test", seed: 1, generation: "context-resource-unit" },
    },
    address: { cx: 0, cy: 0, cz: 0 },
    revision: 0,
    blocks: core,
    light,
    mesh: meshChunk(blocks, light, ids),
    regionColor: [100, 100, 100],
    timings: { generate: 0, light: 0, mesh: 0 },
    cacheBytes: 0,
  };
}
beforeEach(() => {
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("lost-context resource ownership (CPU event proof; native matrix is separate)", () => {
  it("releases old resource callbacks while lost, before the owner's loss callback, and keeps CPU state", () => {
    const f = fixture(),
      input = chunk();
    f.renderer.upload(input);
    f.renderer.setWorld(1);
    f.renderer.effects.broken({ x: 0, y: 0, z: 0 }, Block.Basalt, 0);
    f.renderer.effects.update(0, Infinity, { x: 10, y: 10, z: 10 });
    const part = f.internals.chunks.get("1:0,0,0");
    if (!part) throw new Error("Missing uploaded chunk");
    const geometry = part.geometries[0];
    if (!geometry) throw new Error("Missing geometry");
    const positions = geometry.getAttribute("position").array;
    const capData = part.cap.texture.image;
    const particleMatrix = f.renderer.effects.particles.instanceMatrix.array;
    const particleCount = f.renderer.effects.particles.count;
    const morph = new DataTexture(new Uint8Array([1, 2, 3, 4]), 1, 1);
    f.renderer.effects.particles.morphTexture = morph;
    const materials = [...f.internals.terrain.materials];
    f.own(geometry, "chunk geometry");
    f.own(part.cap.texture, "cap occupancy");
    f.own(part.cap.mesh.geometry, "cap plane");
    f.own(part.depthCap.material as MeshBasicMaterial, "depth cap material");
    f.own(f.renderer.effects.particles, "instance buffers");
    f.own(morph, "morph texture");
    f.own(f.internals.terrain.texture, "terrain tiles");
    const terrainMaterial = materials[0];
    if (!terrainMaterial) throw new Error("Missing terrain material");
    f.own(terrainMaterial, "terrain/shadow material");
    f.own(f.internals.waterDepthTarget, "water target");
    f.own(f.internals.farWaterDepthTarget, "far water target");
    f.own(f.internals.farPreparationTarget, "far preparation target");
    f.internals.sun.shadow.map = new WebGLRenderTarget(16, 16);
    f.own(f.internals.sun.shadow.map, "shadow target");
    f.own(f.internals.composer.inputBuffer, "composer input");
    f.own(f.internals.composer.outputBuffer, "composer output");
    const bloomDispose = vi.spyOn(f.internals.bloom, "dispose");
    f.own(f.internals.postPass.fullscreenMaterial, "post material");
    const postGraph = [...f.internals.composer.passes];
    const bloom = {
      intensity: f.internals.bloom.intensity,
      threshold: f.internals.bloom.luminanceMaterial.threshold,
      texture: f.internals.bloom.texture,
    };
    f.renderer.onLost = () => expect(f.disposed).toContain("post material");
    try {
      f.loss();
      expect(f.disposed).toHaveLength(15);
      expect(f.disposed).toContain("far water target");
      expect(f.disposed).toContain("far preparation target");
      expect(bloomDispose).toHaveBeenCalledTimes(1);
      expect(f.wrongGeneration).toEqual([]);
      expect(geometry.getAttribute("position").array).toBe(positions);
      expect(part.cap.texture.image).toBe(capData);
      expect(f.renderer.effects.particles.instanceMatrix.array).toBe(
        particleMatrix,
      );
      expect(f.renderer.effects.particles.count).toBe(particleCount);
      expect(particleCount).toBeGreaterThan(0);
      expect(f.renderer.effects.particles.morphTexture).toBe(morph);
      expect(f.internals.terrain.materials).toEqual(materials);
      expect(f.internals.composer.passes).toEqual(postGraph);
      expect(f.internals.bloom.intensity).toBe(bloom.intensity);
      expect(f.internals.bloom.luminanceMaterial.threshold).toBe(
        bloom.threshold,
      );
      expect(f.internals.bloom.texture).toBe(bloom.texture);
      expect(f.native.getError).not.toHaveBeenCalled();
      // Replacing the formerly shared colour/depth geometry after restoration
      // must not invoke any callbacks belonging to the old context generation.
      f.native.lost = false;
      f.renderer.upload(input);
      f.renderer.dispose();
      expect(f.wrongGeneration).toEqual([]);
    } finally {
      f.renderer.dispose();
    }
  });
  it("tracks drawn cached maps through material replacement, chains the prior callback, then clears ownership", () => {
    const prior = vi.spyOn(Mesh.prototype, "onBeforeRender");
    const f = fixture(),
      mesh = f.renderer.effects.pop;
    const material = (mesh.material as MeshBasicMaterial[])[0];
    if (!material?.map) throw new Error("Missing tile map");
    const texture = material.map;
    try {
      mesh.onBeforeRender(
        f.renderer.renderer,
        f.renderer.scene,
        f.renderer.camera,
        mesh.geometry,
        material,
        null as never,
      );
      expect(prior).toHaveBeenCalled();
      expect(prior.mock.contexts.at(-1)).toBe(mesh);
      expect(f.internals.drawnEffectTextures.size).toBe(1);
      texture.dispose();
      expect(f.internals.drawnEffectTextures.size).toBe(0);
      mesh.onBeforeRender(
        f.renderer.renderer,
        f.renderer.scene,
        f.renderer.camera,
        mesh.geometry,
        material,
        null as never,
      );
      expect(f.internals.drawnEffectTextures.size).toBe(1);
      f.own(texture, "historical drawn tile");
      f.renderer.effects.placed({ x: 0, y: 0, z: 0 }, Block.Basalt, 0);
      expect((mesh.material as MeshBasicMaterial[])[0]?.map).not.toBe(texture);
      f.loss();
      expect(f.disposed).toContain("historical drawn tile");
      expect(f.internals.drawnEffectTextures.size).toBe(0);
      expect(f.renderer.effects.pop.visible).toBe(true);
      f.native.lost = false;
      texture.dispose();
      expect(f.wrongGeneration).toEqual([]);
    } finally {
      f.renderer.dispose();
    }
  });
  it("tracks the map selected by an existing before-render callback", () => {
    const selected = new DataTexture(new Uint8Array([1, 2, 3, 4]), 1, 1);
    vi.spyOn(Mesh.prototype, "onBeforeRender").mockImplementation(
      (_renderer, _scene, _camera, _geometry, material) => {
        (material as MeshBasicMaterial).map = selected;
      },
    );
    const f = fixture(),
      mesh = f.renderer.effects.pop;
    const material = (mesh.material as MeshBasicMaterial[])[0];
    if (!material) throw new Error("Missing material");
    try {
      mesh.onBeforeRender(
        f.renderer.renderer,
        f.renderer.scene,
        f.renderer.camera,
        mesh.geometry,
        material,
        null as never,
      );
      expect(f.internals.drawnEffectTextures.has(selected)).toBe(true);
      selected.dispose();
      expect(f.internals.drawnEffectTextures.size).toBe(0);
    } finally {
      f.renderer.dispose();
    }
  });
});
