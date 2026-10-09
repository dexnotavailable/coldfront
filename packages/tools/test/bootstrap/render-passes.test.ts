import {
  BoxGeometry,
  EdgesGeometry,
  FogExp2,
  Frustum,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Scene,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { SunLight } from "three/addons/lights/SunLight.js";
import { describe, expect, it } from "vitest";
import type { ToolState } from "../../../client/src/contracts/game-ui.js";
import { Avatar } from "../../../client/src/engine/avatar.js";
import { BlockEffects } from "../../../client/src/engine/effects.js";
import { IbaraEffects } from "../../../client/src/engine/ibara-effects.js";
import { WorldRenderer } from "../../../client/src/engine/renderer.js";
import { createTerrainMaterials } from "../../../client/src/engine/terrain-material.js";
import type { ChunkResult } from "../../../client/src/engine/worker-protocol.js";
import { makeBody } from "../../../client/src/game/controller.js";
import type { BlockHit, Point } from "../../../client/src/game/raycast.js";
import type { MeshPart } from "../../../shared/src/meshing/greedy.js";

/** Runs the real upload/update/render methods and Three transforms with GPU draws
 * recorded. These tests prove pass scheduling/state, not shader or pixel output. */
function fixture() {
  const camera = new PerspectiveCamera(40, 1, 0.2, 1600),
    scene = new Scene(),
    depthScene = new Scene(),
    marks = new Scene(),
    avatar = new Avatar(0xaaaaaa, 0x222222),
    effects = new BlockEffects(),
    outline = new LineSegments(
      new EdgesGeometry(new BoxGeometry()),
      new LineBasicMaterial(),
    ),
    clip = new Plane(new Vector3(0, -1, 0), 100000),
    ibaraEffects = new IbaraEffects(clip),
    terrain = createTerrainMaterials(clip),
    sun = new SunLight(),
    waterDepthTarget = new WebGLRenderTarget(1, 1);
  sun.castShadow = true;
  scene.add(ibaraEffects.flames, ibaraEffects.embers);
  ibaraEffects.setWorld(1);
  marks.add(avatar.silhouette, effects.ghost, outline);
  const calls: (Scene | "composer" | "clearDepth")[] = [],
    state = { throwOn: null as Scene | null };
  const driver = {
    autoClear: true,
    shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false },
    info: { reset() {} },
    getPixelRatio: () => 1,
    getRenderTarget: () => null,
    setRenderTarget() {},
    clearDepth() {
      calls.push("clearDepth");
    },
    render(drawing: Scene) {
      calls.push(drawing);
      if (drawing === state.throwOn) throw new Error("fixture draw failure");
    },
    dispose() {},
  };
  const renderer = Object.assign(
    Object.create(WorldRenderer.prototype) as object,
    {
      camera,
      scene,
      depthScene,
      marks,
      avatar,
      effects,
      ibaraEffects,
      outline,
      clip,
      terrain,
      sun,
      fog: new FogExp2(0xaab5b4),
      waterDepthTarget,
      waterFrustum: new Frustum(),
      waterViewProjection: new Matrix4(),
      chunks: new Map(),
      worldId: 1,
      cut: Infinity,
      ready: true,
      hud: true,
      postcard: false,
      viewMode: "normal",
      contextLost: false,
      colors: { cap: 0x222222 },
      borderMaterial: new LineBasicMaterial(),
      depthMaterial: new MeshBasicMaterial({
        colorWrite: false,
        clippingPlanes: [clip],
      }),
      resizeObserver: { disconnect() {} },
      sky: { geometry: { dispose() {} }, material: { dispose() {} } },
      canvas: { clientHeight: 720, removeEventListener() {} },
      renderer: driver,
      composer: {
        render() {
          calls.push("composer");
        },
        dispose() {},
      },
      setTime() {},
    },
  ) as unknown as WorldRenderer;
  const body = makeBody();
  function update(
    options: {
      hit?: BlockHit;
      ghost?: Point;
      occluded?: boolean;
      shadows?: boolean;
      cut?: number;
    } = {},
  ) {
    const tools: ToolState = {
      viewMode: "normal",
      timeHours: 12,
      clockRuns: false,
      fog: true,
      shadows: options.shadows ?? true,
      chunkBorders: false,
      wireframe: false,
      flying: false,
      flySpeed: 1,
    };
    renderer.update(
      body,
      body,
      0,
      0,
      options.cut ?? Infinity,
      tools,
      options.hit ?? null,
      options.ghost ?? null,
      2,
      options.occluded ?? false,
    );
  }
  update();
  return {
    renderer,
    calls,
    state,
    driver,
    depthScene,
    marks,
    camera,
    terrain,
    clip,
    sun,
    update,
  };
}

const hit: BlockHit = {
  x: 0,
  y: 0,
  z: -5,
  block: 2,
  point: { x: 0, y: 0, z: -5 },
  normal: { x: 0, y: 1, z: 0 },
  distance: 5,
  cap: false,
};

describe("conditional render passes", () => {
  it("skips depth and marks with no visible mark, then draws each existing mark kind", () => {
    const f = fixture();
    try {
      f.renderer.render();
      expect(f.calls).toEqual(["composer"]);
      for (const options of [
        { hit },
        { ghost: { x: 0, y: 0, z: -5 } },
        { occluded: true },
      ]) {
        f.calls.length = 0;
        f.update(options);
        f.renderer.render();
        expect(f.calls).toEqual([
          "composer",
          "clearDepth",
          f.depthScene,
          f.marks,
        ]);
        expect(f.driver.autoClear).toBe(true);
      }
      f.calls.length = 0;
      f.update();
      f.renderer.render();
      expect(f.calls).toEqual(["composer"]);
    } finally {
      f.renderer.dispose();
    }
  });

  it("respects hidden HUD and postcard capture even with visible marks", () => {
    const f = fixture();
    try {
      f.update({ hit, occluded: true, ghost: hit.point });
      f.renderer.setHud(false);
      f.renderer.render();
      expect(f.calls).toEqual(["composer"]);
      f.calls.length = 0;
      f.renderer.setHud(true);
      Object.assign(f.renderer, { postcard: true });
      f.renderer.render();
      expect(f.calls).toEqual(["composer"]);
    } finally {
      f.renderer.dispose();
    }
  });

  it.each([true, false])(
    "restores autoClear=%s after successful and failed mark draws",
    (autoClear) => {
      const f = fixture();
      try {
        f.update({ hit });
        f.driver.autoClear = autoClear;
        f.renderer.render();
        expect(f.driver.autoClear).toBe(autoClear);
        for (const drawing of [f.depthScene, f.marks]) {
          f.state.throwOn = drawing;
          expect(() => f.renderer.render()).toThrow("draw failure");
          expect(f.driver.autoClear).toBe(autoClear);
        }
      } finally {
        f.renderer.dispose();
      }
    },
  );

  it.each([false, true])(
    "initializes an absent shadow map once, then suspends updates until re-enabled (existing map=%s)",
    (initialized) => {
      const f = fixture(),
        map = initialized ? new WebGLRenderTarget(1, 1) : null;
      f.sun.shadow.map = map;
      try {
        f.driver.shadowMap.needsUpdate = true;
        f.update({ shadows: false });
        expect(f.driver.shadowMap).toEqual({
          enabled: true,
          autoUpdate: false,
          needsUpdate: !initialized,
        });
        expect(f.sun.shadow.intensity).toBe(0);
        expect(f.sun.castShadow).toBe(true);
        expect(f.sun.shadow.map).toBe(map);
        // Three consumes needsUpdate and creates the required depth sampler on
        // the first scene draw, even if its contribution is intensity zero.
        const initializedMap = map ?? new WebGLRenderTarget(1, 1);
        f.sun.shadow.map = initializedMap;
        f.driver.shadowMap.needsUpdate = false;
        f.camera.position.set(100, 20, -10);
        f.renderer.setWorld(2);
        f.update({ shadows: false, cut: 12 });
        expect(f.driver.shadowMap.autoUpdate).toBe(false);
        expect(f.driver.shadowMap.needsUpdate).toBe(false);
        f.update({ shadows: true, cut: 12 });
        expect(f.driver.shadowMap).toEqual({
          enabled: true,
          autoUpdate: true,
          needsUpdate: true,
        });
        expect(f.sun.shadow.intensity).toBe(1);
        expect(f.sun.shadow.map).toBe(initializedMap);
      } finally {
        f.sun.shadow.map?.dispose();
        f.renderer.dispose();
      }
    },
  );

  it("keeps a restored-context refresh pending through disabled updates and failed draws", () => {
    const f = fixture(),
      map = new WebGLRenderTarget(1, 1);
    f.sun.shadow.map = map;
    try {
      // The native loss/restore probe exercises the event; here its pending state
      // must survive update(false) and a failed main-scene draw.
      Object.assign(f.renderer, {
        shadowMapInvalid: true,
        composer: {
          render() {
            throw new Error("fixture main draw failure");
          },
          dispose() {},
        },
      });
      f.update({ shadows: false });
      expect(f.driver.shadowMap.needsUpdate).toBe(true);
      expect(() => f.renderer.render()).toThrow("main draw failure");
      f.update({ shadows: false });
      expect(f.driver.shadowMap.needsUpdate).toBe(true);
      Object.assign(f.renderer, {
        composer: {
          render() {
            f.driver.shadowMap.needsUpdate = false;
          },
          dispose() {},
        },
      });
      f.renderer.render();
      f.update({ shadows: false });
      expect(f.driver.shadowMap.needsUpdate).toBe(false);
      expect(f.driver.shadowMap.autoUpdate).toBe(false);
      expect(f.sun.shadow.intensity).toBe(0);
    } finally {
      map.dispose();
      f.renderer.dispose();
    }
  });

  it("retains uploaded water and cut depth on the first draw and after world switching", () => {
    const f = fixture();
    const empty: MeshPart = {
      positions: new Float32Array(),
      normals: new Int8Array(),
      expansions: new Int8Array(),
      packedPositions: new Float32Array(),
      surfaces: new Float32Array(),
      featureIdParts: new Uint16Array(),
      indices: new Uint32Array(),
    };
    const part: MeshPart = {
      positions: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]),
      normals: new Int8Array(9),
      expansions: new Int8Array(9),
      packedPositions: new Float32Array([0, 2, 128]),
      surfaces: new Float32Array(9),
      featureIdParts: new Uint16Array(6),
      indices: new Uint32Array([0, 1, 2]),
    };
    const result: ChunkResult = {
      type: "chunk",
      world: { id: 1, identity: { kind: "test", seed: 1, generation: "4" } },
      id: 1,
      address: { cx: 0, cy: 0, cz: -1 },
      revision: 0,
      blocks: new Uint16Array(32768),
      light: new Uint16Array(32768),
      mesh: {
        parts: [part, empty, empty, part, empty],
        skirts: empty,
        quads: 2,
      },
      regionColor: [80, 100, 120],
      timings: { generate: 0, light: 0, mesh: 0 },
      cacheBytes: 0,
    };
    try {
      f.renderer.upload(result);
      f.update({ hit, cut: 1 });
      f.renderer.render();
      expect(f.calls).toEqual([
        f.depthScene,
        "composer",
        "clearDepth",
        f.depthScene,
        f.marks,
      ]);
      expect(f.clip.constant).toBe(1);
      expect(f.terrain.uniforms.cut.value).toBe(1);
      const depthCap = f.depthScene.children[1];
      expect(depthCap?.visible).toBe(true);
      expect(depthCap?.position.y).toBe(1);
      f.renderer.setWorld(2);
      f.calls.length = 0;
      f.update();
      f.renderer.render();
      expect(f.calls).toEqual(["composer"]);
      expect(f.terrain.uniforms.waterDepthReady.value).toBe(0);
      f.renderer.setWorld(1);
      f.update({ cut: 2 });
      f.calls.length = 0;
      f.renderer.render();
      expect(f.calls).toEqual([f.depthScene, "composer"]);
      expect(depthCap?.visible).toBe(true);
      expect(depthCap?.position.y).toBe(2);
      expect(f.terrain.uniforms.waterDepthReady.value).toBe(1);
    } finally {
      f.renderer.dispose();
    }
  });
});
