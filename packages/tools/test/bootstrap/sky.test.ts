import { Box3, PerspectiveCamera, Scene, Vector3 } from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { describe, expect, it } from "vitest";
import { WorldRenderer } from "../../../client/src/engine/renderer.js";

/** Real renderer view/restore methods and Three transforms, with GPU calls stubbed.
 * This is a spatial invariant check, not shader/pixel acceptance. */
function fixture(failDraw = false) {
  const camera = new PerspectiveCamera(70, 16 / 9, 0.2, 1600),
    sky = new Sky();
  sky.scale.setScalar(4500);
  const scene = new Scene();
  scene.add(sky);
  const terrain = {
    uniforms: {
      origin: { value: new Vector3() },
      waterDepthReady: { value: 0 },
    },
  };
  const observed: {
    sky: Vector3;
    origin: Vector3;
    waterDepthReady: number;
  }[] = [];
  const observe = () => {
    observed.push({
      sky: sky.position.clone(),
      origin: terrain.uniforms.origin.value.clone(),
      waterDepthReady: terrain.uniforms.waterDepthReady.value,
    });
  };
  const renderer = Object.assign(
    Object.create(WorldRenderer.prototype) as object,
    {
      camera,
      sky,
      scene,
      depthScene: new Scene(),
      marks: new Scene(),
      chunks: new Map(),
      worldId: 1,
      cut: Infinity,
      contextLost: false,
      terrain,
      composer: {
        passes: [],
        render() {
          observe();
        },
      },
      renderer: {
        getRenderTarget: () => null,
        setRenderTarget() {},
        render() {
          observe();
          if (failDraw) throw new Error("Destination draw failed");
        },
        getContext: () => ({
          isContextLost: () => false,
          getError: () => 0,
          NO_ERROR: 0,
        }),
      },
      compile() {},
    },
  ) as unknown as WorldRenderer;
  return { renderer, camera, sky, terrain, observed };
}
describe("main-world sky spatial invariants", () => {
  it("keeps the camera inside the actual Sky box across distant world positions", () => {
    const { renderer, camera, sky } = fixture();
    for (const position of [
      { x: -22000, y: 920, z: 21500 },
      { x: 21900, y: 35, z: -21000 },
    ]) {
      renderer.setView(position, {
        x: position.x + 60,
        y: position.y - 5,
        z: position.z,
      });
      expect(new Box3().setFromObject(sky).containsPoint(camera.position)).toBe(
        true,
      );
      expect(sky.position.equals(camera.position)).toBe(true);
    }
  });
  it.each([false, true])(
    "centres Sky during offscreen preparation and restores the source view (draw failure=%s)",
    (failDraw) => {
      const { renderer, camera, sky, terrain, observed } = fixture(failDraw);
      const source = { x: -16000, y: 100, z: -11000 },
        target = { x: 20000, y: 800, z: 19000 };
      renderer.setView(source, { x: source.x, y: 80, z: source.z - 30 });
      const sourceQuaternion = camera.quaternion.clone();
      const sourceOrigin = new Vector3(-16384, 0, -11264);
      terrain.uniforms.origin.value.copy(sourceOrigin);
      terrain.uniforms.waterDepthReady.value = 1;
      const prepare = () =>
        renderer.prepareView(1, target, {
          x: target.x + 30,
          y: target.y - 10,
          z: target.z,
        });
      if (failDraw) expect(prepare).toThrow("Destination draw failed");
      else expect(prepare).not.toThrow();
      expect(observed.length).toBeGreaterThan(0);
      expect(
        observed.every((view) =>
          view.sky.equals(new Vector3(target.x, target.y, target.z)),
        ),
      ).toBe(true);
      for (const view of observed) {
        expect(view.origin.toArray()).toEqual([19456, 0, 18432]);
        expect(view.waterDepthReady).toBe(0);
      }
      expect(camera.position.toArray()).toEqual([source.x, source.y, source.z]);
      expect(camera.quaternion.equals(sourceQuaternion)).toBe(true);
      expect(sky.position.equals(camera.position)).toBe(true);
      expect(new Box3().setFromObject(sky).containsPoint(camera.position)).toBe(
        true,
      );
      expect(terrain.uniforms.origin.value.equals(sourceOrigin)).toBe(true);
      expect(terrain.uniforms.waterDepthReady.value).toBe(1);
    },
  );
});
