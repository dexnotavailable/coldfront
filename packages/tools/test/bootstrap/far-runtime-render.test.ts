import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Scene,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import { describe, expect, it, vi } from "vitest";
import type { ChunkStore } from "../../../client/src/engine/chunk-store.js";
import type { FarGpuPreparation } from "../../../client/src/engine/far-terrain-renderer.js";
import type { FarWorld } from "../../../client/src/engine/far-world.js";
import { WorldRenderer } from "../../../client/src/engine/renderer.js";

/** Real pass methods/Three objects; draw recording is explicitly NOT GPU proof. */
describe("far runtime render transactions", () => {
  it("draws far, clears only depth, and draws near into the same composer target", () => {
    const near = new Scene(),
      far = new Scene(),
      camera = new PerspectiveCamera(),
      farCamera = new PerspectiveCamera();
    const background = new Color(0x123456);
    near.background = background;
    const target = new WebGLRenderTarget(4, 4);
    const calls: unknown[] = [];
    const driver = {
      autoClear: true,
      setRenderTarget: (value: unknown) => calls.push(["target", value]),
      clear: (...flags: boolean[]) => calls.push(["clear", ...flags]),
      clearDepth: () => calls.push("clearDepth"),
      render: (scene: Scene, eye: PerspectiveCamera) => {
        expect(driver.autoClear).toBe(false);
        expect(near.background).toBeNull();
        calls.push([scene, eye]);
      },
    };
    const renderer = Object.assign(Object.create(WorldRenderer.prototype), {
      scene: near,
      farScene: far,
      camera,
      farCamera,
      renderer: driver,
    }) as { drawTerrain(target: WebGLRenderTarget): void };
    renderer.drawTerrain(target);
    expect(calls).toEqual([
      ["target", target],
      ["clear", true, true, true],
      [far, farCamera],
      "clearDepth",
      [near, camera],
    ]);
    expect(driver.autoClear).toBe(true);
    expect(near.background).toBe(background);
    target.dispose();
  });
  it("restores source target, viewport, scissor, shadow and origin after a failed real-draw boundary", () => {
    const sourceTarget = new WebGLRenderTarget(4, 4),
      privateTarget = new WebGLRenderTarget(8, 8);
    const sourceGroup = new Group(),
      candidateGroup = new Group();
    sourceGroup.visible = true;
    candidateGroup.visible = false;
    const camera = new PerspectiveCamera(70, 1, 200, 16_000);
    camera.position.set(-0.1, 500, 1025);
    const origin = new Vector3(2048, 0, 2048),
      sky = { position: new Vector3(15, 20, 25) };
    const waterReady = { value: 1 };
    const cut = { value: 37 },
      clip = new Plane(new Vector3(0, -1, 0), 37);
    const source = { renderer: { group: sourceGroup } };
    const candidate = {
      camera,
      cutHeight: -42,
      renderer: { group: candidateGroup, setOrigin: vi.fn() },
    } as unknown as FarWorld;
    const scene = new Scene();
    const viewport = new Vector4(10, 20, 300, 200),
      scissor = new Vector4(11, 21, 100, 90);
    const state = {
      target: sourceTarget,
      viewport: viewport.clone(),
      scissor: scissor.clone(),
      test: true,
    };
    const driver = {
      autoClear: false,
      shadowMap: { autoUpdate: true, needsUpdate: true },
      getRenderTarget: () => state.target,
      setRenderTarget: (value: WebGLRenderTarget) => {
        state.target = value;
      },
      getViewport: (out: Vector4) => out.copy(state.viewport),
      setViewport: (value: Vector4) => state.viewport.copy(value),
      getScissor: (out: Vector4) => out.copy(state.scissor),
      setScissor: (value: Vector4) => state.scissor.copy(value),
      getScissorTest: () => state.test,
      setScissorTest: (value: boolean) => {
        state.test = value;
      },
      render: vi.fn(() => {
        expect(state.target).toBe(privateTarget);
        expect(origin.toArray()).toEqual([-1024, 0, 1024]);
        expect(candidateGroup.visible).toBe(true);
        expect(sourceGroup.visible).toBe(false);
        expect(waterReady.value).toBe(0);
        expect(cut.value).toBe(-42);
        expect(clip.constant).toBe(-42);
        throw new Error("test GPU draw failure");
      }),
    };
    const resources = new Map<unknown, unknown>([
      [source, { world: source }],
      [
        candidate,
        {
          world: candidate,
          terrain: { uniforms: { waterDepthReady: waterReady } },
        },
      ],
    ]);
    const renderer = Object.assign(Object.create(WorldRenderer.prototype), {
      contextLost: false,
      renderer: driver,
      farResources: resources,
      farScene: scene,
      terrain: { uniforms: { origin: { value: origin }, cut } },
      clip,
      sky,
      farPreparationTarget: privateTarget,
    }) as { prepareFarGpu(world: FarWorld, probe: FarGpuPreparation): void };
    const probe: FarGpuPreparation = {
      group: candidateGroup,
      batches: [],
      handle: {
        id: 1,
        world: {
          id: 7,
          identity: {
            kind: "test",
            seed: 1,
            generation: "far-runtime-fixture",
          },
        },
        runs: {
          address: { tx: 0, tz: 0, lod: 2 },
          layer: "surface",
          revision: 0,
          offsets: new Uint32Array(34 * 34 + 1),
          words: new Uint32Array(),
          statistics: {
            densityCalls: 0,
            columns: 34 * 34,
            runs: 0,
            quads: 0,
            skirtQuads: 0,
            typedArrayBytes: (34 * 34 + 1) * Uint32Array.BYTES_PER_ELEMENT,
          },
        },
      },
    };
    expect(() => renderer.prepareFarGpu(candidate, probe)).toThrow(
      "test GPU draw failure",
    );
    expect(driver.render).toHaveBeenCalledTimes(1);
    expect(state.target).toBe(sourceTarget);
    expect(state.viewport).toEqual(viewport);
    expect(state.scissor).toEqual(scissor);
    expect(state.test).toBe(true);
    expect(driver.autoClear).toBe(false);
    expect(driver.shadowMap).toEqual({ autoUpdate: true, needsUpdate: true });
    expect(origin.toArray()).toEqual([2048, 0, 2048]);
    expect(sky.position.toArray()).toEqual([15, 20, 25]);
    expect(waterReady.value).toBe(1);
    expect(cut.value).toBe(37);
    expect(clip.constant).toBe(37);
    expect(sourceGroup.visible).toBe(true);
    expect(candidateGroup.visible).toBe(false);
    sourceTarget.dispose();
    privateTarget.dispose();
  });
  it("uses original far shaders/caps for water depth and restores hidden classes even when empty", () => {
    const materials = Array.from({ length: 5 }, () => new MeshBasicMaterial());
    const cap = new MeshBasicMaterial();
    const group = new Group();
    group.add(new Mesh(undefined, materials[0]), new Mesh(undefined, cap));
    const far = { renderer: { group } };
    const ready = { value: 0 },
      coefficients = { value: new Vector2() };
    const terrain = {
      materials,
      uniforms: { waterDepthReady: ready, waterDepthLinearize: coefficients },
    };
    const scene = new Scene();
    scene.background = new Color(0x123456);
    scene.add(group);
    const background = scene.background;
    const sourceTarget = new WebGLRenderTarget(4, 4),
      farTarget = new WebGLRenderTarget(8, 8);
    let target = sourceTarget;
    const driver = {
      autoClear: false,
      getRenderTarget: () => target,
      setRenderTarget: (value: WebGLRenderTarget) => {
        target = value;
      },
      render: () => {
        expect(target).toBe(farTarget);
        expect(scene.overrideMaterial).toBeNull();
        expect(materials[0]?.colorWrite).toBe(false);
        expect(cap.colorWrite).toBe(false);
        expect(materials[2]?.visible).toBe(false);
        expect(materials[3]?.visible).toBe(false);
      },
    };
    const renderer = Object.assign(Object.create(WorldRenderer.prototype), {
      activeFar: far,
      farResources: new Map([[far, { terrain }]]),
      farScene: scene,
      farCamera: new PerspectiveCamera(40, 1, 200, 16_000),
      sky: { visible: true },
      renderer: driver,
      farWaterDepthTarget: farTarget,
    }) as { prepareFarWaterDepth(): void };
    renderer.prepareFarWaterDepth();
    expect(target).toBe(sourceTarget);
    expect(driver.autoClear).toBe(false);
    expect(scene.background).toBe(background);
    expect(ready.value).toBe(1);
    expect(coefficients.value.toArray()).toEqual([
      1 / 200,
      1 / 16_000 - 1 / 200,
    ]);
    expect(
      materials.every((material) => material.visible && material.colorWrite),
    ).toBe(true);
    expect(cap.colorWrite).toBe(true);
    for (const material of [...materials, cap]) material.dispose();
    for (const mesh of group.children)
      if (mesh instanceof Mesh) mesh.geometry.dispose();
    sourceTarget.dispose();
    farTarget.dispose();
  });
  it("requires every current band chunk to be freshly uploaded and drawn before masking", () => {
    const nearChunks = new Map(),
      renderChunks = new Map();
    for (const cy of [-1, 0]) {
      const result = { revision: 0 };
      const address = { cx: 0, cy, cz: 0 };
      nearChunks.set(`0,${cy},0`, {
        address,
        result,
        revision: 0,
        state: "visible",
      });
      renderChunks.set(`7:0,${cy},0`, {
        result,
        group: { visible: true },
        drawnParts: new Set<number>(),
        partCount: 1,
      });
    }
    const near = {
      world: { id: 7 },
      chunks: nearChunks,
      edits: new Map(),
      context: {
        conservativeBounds: (_bounds: unknown, out: object) =>
          Object.assign(out, {
            minSurfaceY: 0,
            maxSurfaceY: 0,
            maxSolidY: 0,
            maxFluidY: 0,
          }),
      },
    } as unknown as ChunkStore;
    const camera = new PerspectiveCamera(40, 1, 0.2, 1600);
    camera.position.set(16, 100, 16);
    camera.lookAt(16, 0, 16);
    camera.updateMatrixWorld();
    const renderer = Object.assign(Object.create(WorldRenderer.prototype), {
      worldId: 7,
      chunks: renderChunks,
      camera,
      cut: Infinity,
    }) as { nearCoverage(store: ChunkStore): unknown[]; cut: number };
    expect(renderer.nearCoverage(near)).toEqual([]);
    for (const chunk of renderChunks.values()) chunk.drawnParts.add(0);
    expect(renderer.nearCoverage(near)).toHaveLength(1);
    nearChunks.get("0,0,0").revision++;
    expect(renderer.nearCoverage(near)).toEqual([]);
    nearChunks.get("0,0,0").revision--;
    renderer.cut = -40;
    expect(renderer.nearCoverage(near)).toEqual([]); // Newly exposed lower band was never loaded.
  });
});
