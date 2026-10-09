import {
  BufferGeometry,
  DepthTexture,
  Group,
  LineBasicMaterial,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Scene,
  ShaderLib,
  UnsignedIntType,
  Vector2,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorldRenderer } from "../../../client/src/engine/renderer.js";
import {
  createTerrainMaterials,
  waterDepthRange,
} from "../../../client/src/engine/terrain-material.js";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const terrain = createTerrainMaterials(
      new Plane(new Vector3(0, -1, 0), 100000),
    ),
    waterDepthTarget = new WebGLRenderTarget(1, 1, {
      depthTexture: new DepthTexture(1, 1, UnsignedIntType),
    }),
    sourceTarget = new WebGLRenderTarget(7, 9),
    camera = new PerspectiveCamera(70, 16 / 9, 0.2, 1600),
    sky = new Sky(),
    scene = new Scene(),
    depthScene = new Scene(),
    marks = new Scene();
  terrain.uniforms.waterDepth.value = waterDepthTarget.depthTexture;
  const calls: {
    scene: Scene | "composer";
    target: WebGLRenderTarget | null;
    ready: number;
    autoClear: boolean;
  }[] = [];
  const state = {
    target: sourceTarget as WebGLRenderTarget | null,
    throwOn: null as Scene | null,
    pixelRatio: 1,
    width: 1,
    height: 1,
  };
  const driver = {
    autoClear: false,
    info: { reset() {} },
    getRenderTarget: () => state.target,
    setRenderTarget(target: WebGLRenderTarget | null) {
      state.target = target;
    },
    render(drawing: Scene) {
      calls.push({
        scene: drawing,
        target: state.target,
        ready: terrain.uniforms.waterDepthReady.value,
        autoClear: driver.autoClear,
      });
      if (drawing === state.throwOn) throw new Error("fixture draw failure");
    },
    getContext: () => ({
      isContextLost: () => false,
      getError: () => 0,
      NO_ERROR: 0,
    }),
    setPixelRatio(value: number) {
      state.pixelRatio = value;
    },
    getPixelRatio: () => state.pixelRatio,
    setSize(width: number, height: number) {
      state.width = width;
      state.height = height;
    },
    getDrawingBufferSize: (out: Vector2) =>
      out.set(state.width * state.pixelRatio, state.height * state.pixelRatio),
    dispose: vi.fn(),
  };
  const composer = {
    passes: [{ renderToScreen: true }],
    render() {
      calls.push({
        scene: "composer",
        target: state.target,
        ready: terrain.uniforms.waterDepthReady.value,
        autoClear: driver.autoClear,
      });
    },
    setSize: vi.fn(),
    dispose: vi.fn(),
  };
  const chunks = new Map([
    ["water", { worldId: 1, hasFluid: true, group: new Group() }],
  ]);
  const renderer = Object.assign(
    Object.create(WorldRenderer.prototype) as object,
    {
      camera,
      sky,
      scene,
      depthScene,
      marks,
      chunks,
      terrain,
      waterDepthTarget,
      worldId: 1,
      cut: Infinity,
      ready: true,
      contextLost: false,
      postcard: true,
      hud: false,
      composer,
      renderer: driver,
      canvas: { clientWidth: 320, clientHeight: 180, removeEventListener() {} },
      resizeObserver: { disconnect() {} },
      avatar: { dispose() {} },
      effects: { dispose() {} },
      outline: {
        geometry: new BufferGeometry(),
        material: new MeshBasicMaterial(),
      },
      borderMaterial: new LineBasicMaterial(),
      depthMaterial: new MeshBasicMaterial(),
      compile() {},
    },
  ) as unknown as WorldRenderer;
  const dispose = () => {
    chunks.clear();
    renderer.dispose();
    sourceTarget.dispose();
  };
  return {
    renderer,
    terrain,
    waterDepthTarget,
    sourceTarget,
    camera,
    sky,
    scene,
    depthScene,
    chunks,
    calls,
    state,
    driver,
    composer,
    dispose,
  };
}

describe("water transmission and opaque depth ownership", () => {
  it("keeps coplanar transparent quads unexpanded while retaining opaque/cutout crack coverage", () => {
    const terrain = createTerrainMaterials(new Plane());
    try {
      for (const [kind, material] of terrain.materials.entries()) {
        const shader = {
          uniforms: {},
          vertexShader: ShaderLib.lambert.vertexShader,
          fragmentShader: ShaderLib.lambert.fragmentShader,
        };
        material.onBeforeCompile(
          shader as unknown as Parameters<typeof material.onBeforeCompile>[0],
          {} as WebGLRenderer,
        );
        expect(shader.vertexShader.includes("transformed += aExpand")).toBe(
          kind < 2,
        );
        expect(shader.fragmentShader.includes("float waterPath=")).toBe(
          kind === 3,
        );
        if (kind === 3) {
          expect(material.transparent).toBe(true);
          expect(material.depthWrite).toBe(false);
          expect(material.opacity).toBe(0.76);
          expect(shader.fragmentShader).toContain("if(uWaterDepthReady>0.5)");
        }
      }
    } finally {
      terrain.texture.dispose();
      for (const material of terrain.materials) material.dispose();
    }
  });
  it("recovers near/far and intermediate view distances from the real perspective projection, including cleared sky depth1", () => {
    for (const [near, far] of [
      [0.2, 1600],
      [1, 200],
    ]) {
      const camera = new PerspectiveCamera(70, 16 / 9, near, far),
        coefficients = waterDepthRange(
          near as number,
          far as number,
          new Vector2(),
        );
      for (const distance of [near as number, 12, 85, far as number]) {
        const clip = new Vector3(0, 0, -distance).applyMatrix4(
            camera.projectionMatrix,
          ),
          depth = (clip.z + 1) / 2;
        expect(1 / coefficients.dot(new Vector2(1, depth))).toBeCloseTo(
          distance,
          5,
        );
      }
      expect(1 / coefficients.dot(new Vector2(1, 0))).toBeCloseTo(
        near as number,
        8,
      );
      expect(1 / coefficients.dot(new Vector2(1, 1))).toBeCloseTo(
        far as number,
        5,
      );
    }
    expect(() => waterDepthRange(0, 1600, new Vector2())).toThrow("range");
    expect(() => waterDepthRange(1, 1, new Vector2())).toThrow("range");
  });
  it("clears and renders only opaque depth before the water pass, then restores the prior framebuffer and autoClear", () => {
    const f = fixture();
    try {
      f.renderer.render();
      expect(f.calls).toEqual([
        {
          scene: f.depthScene,
          target: f.waterDepthTarget,
          ready: 0,
          autoClear: true,
        },
        {
          scene: "composer",
          target: f.sourceTarget,
          ready: 1,
          autoClear: false,
        },
      ]);
      expect(f.state.target).toBe(f.sourceTarget);
      expect(f.driver.autoClear).toBe(false);
      // No opaque geometry is needed: auto-clear leaves depth1 for open water/sky.
      expect(f.depthScene.children).toHaveLength(0);
    } finally {
      f.dispose();
    }
  });
  it("does not leave stale depth or framebuffer state after a failed prepass, and rejects feedback into its own target", () => {
    const f = fixture();
    try {
      f.state.throwOn = f.depthScene;
      expect(() => f.renderer.render()).toThrow("draw failure");
      expect(f.terrain.uniforms.waterDepthReady.value).toBe(0);
      expect(f.state.target).toBe(f.sourceTarget);
      expect(f.driver.autoClear).toBe(false);
      f.state.throwOn = null;
      f.state.target = f.waterDepthTarget;
      expect(() => f.renderer.render()).toThrow("active scene target");
      expect(f.calls).toHaveLength(1);
    } finally {
      f.dispose();
    }
  });
  it("skips the additional depth draw when the active world has no visible fluid", () => {
    const f = fixture();
    try {
      for (const chunk of f.chunks.values()) chunk.group.visible = false;
      f.renderer.render();
      expect(f.calls).toEqual([
        {
          scene: "composer",
          target: f.sourceTarget,
          ready: 0,
          autoClear: false,
        },
      ]);
    } finally {
      f.dispose();
    }
  });
  it("resizes depth to drawing-buffer pixels and disposes its owned target", () => {
    const f = fixture();
    try {
      f.renderer.setPostcard(true);
      expect(f.waterDepthTarget.width).toBe(320);
      expect(f.waterDepthTarget.height).toBe(180);
      vi.stubGlobal("devicePixelRatio", 2);
      f.renderer.setPostcard(false);
      expect(f.waterDepthTarget.width).toBe(640);
      expect(f.waterDepthTarget.height).toBe(360);
      expect(f.terrain.uniforms.waterDepthSize.value.toArray()).toEqual([
        640, 360,
      ]);
      expect(f.terrain.uniforms.waterDepthReady.value).toBe(0);
      const disposed = vi.fn();
      f.waterDepthTarget.addEventListener("dispose", disposed);
      f.chunks.clear();
      f.renderer.dispose();
      expect(disposed).toHaveBeenCalledOnce();
      expect(f.driver.dispose).toHaveBeenCalledOnce();
    } finally {
      f.sourceTarget.dispose();
    }
  });
  it.each([false, true])(
    "disables source depth during offscreen preparation and restores it with the camera (draw failure=%s)",
    (fail) => {
      const f = fixture();
      try {
        f.chunks.clear();
        const position = new Vector3(10, 40, 20);
        f.renderer.setView(position, { x: 0, y: 0, z: 0 });
        f.terrain.uniforms.waterDepthReady.value = 1;
        if (fail) f.state.throwOn = f.scene;
        const prepare = () =>
          f.renderer.prepareView(
            2,
            { x: 200, y: 60, z: 400 },
            { x: 200, y: 0, z: 300 },
          );
        if (fail) expect(prepare).toThrow("draw failure");
        else prepare();
        expect(f.calls.length).toBeGreaterThan(0);
        expect(
          f.calls.every(
            (call) => call.ready === 0 && call.target !== f.waterDepthTarget,
          ),
        ).toBe(true);
        expect(f.terrain.uniforms.waterDepthReady.value).toBe(1);
        expect(f.state.target).toBe(f.sourceTarget);
        expect(f.camera.position.equals(position)).toBe(true);
        expect(f.sky.position.equals(position)).toBe(true);
        expect(f.composer.passes[0]?.renderToScreen).toBe(true);
      } finally {
        f.dispose();
      }
    },
  );
});
