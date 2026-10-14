import {
  Color,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Plane,
  Scene,
  Vector3,
} from "three";
import { SunLight } from "three/addons/lights/SunLight.js";
import { Sky } from "three/addons/objects/Sky.js";
import type { ToolState } from "../../../client/src/contracts/game-ui.js";
import {
  IbaraAtmosphere,
  type WorldAtmosphereSource,
} from "../../../client/src/engine/ibara-atmosphere.js";
import type { WorldRenderer } from "../../../client/src/engine/renderer.js";
import { makeBody } from "../../../client/src/game/controller.js";
import type { Point } from "../../../client/src/game/raycast.js";

const point = { x: 5670.5, y: 30.62, z: 5459.5 };
const focus = {
  x: 5607.596772355778,
  y: 25.863978448565145,
  z: 5471.297624843125,
};
/** Real update/setWorld/setView/prepareView/setTime methods and Three state;
 * only GPU drawing and unrelated avatar/effects work are stubbed. */
export function createAtmosphereRenderer(
  Renderer: typeof WorldRenderer,
  failDraw = false,
) {
  const atmosphere = new IbaraAtmosphere(),
    camera = new PerspectiveCamera(),
    scene = new Scene(),
    sky = new Sky(),
    sun = new SunLight(),
    ambient = new HemisphereLight(),
    fog = new FogExp2(0),
    skyIbara = { value: 0 },
    skyDay = { value: 1 },
    skyIbaraZenith = { value: new Color() },
    skyIbaraHorizon = { value: new Color() };
  const draws: ReturnType<typeof snapshot>[] = [];
  function snapshot() {
    return {
      skyWeight: skyIbara.value,
      sun: sun.color.toArray(),
      sunIntensity: sun.intensity,
      sunPosition: sun.position.toArray(),
      ambient: ambient.color.toArray(),
      ground: ambient.groundColor.toArray(),
      ambientIntensity: ambient.intensity,
      fog: fog.color.toArray(),
      density: fog.density,
      day: skyDay.value,
      rayleigh: sky.material.uniforms.rayleigh?.value as number,
    };
  }
  const observe = () => draws.push(snapshot());
  const renderer = Object.assign(Object.create(Renderer.prototype) as object, {
    atmosphere,
    camera,
    scene,
    sky,
    sun,
    ambient,
    fog,
    skyIbara,
    skyDay,
    skyIbaraZenith,
    skyIbaraHorizon,
    airColor: new Color(),
    airHours: 12,
    airDisplayMs: 0,
    airSnap: true,
    airSnapView: true,
    fogEnabled: true,
    worldId: 0,
    cut: Infinity,
    viewMode: "normal",
    postcard: false,
    hud: true,
    ready: true,
    contextLost: false,
    chunks: new Map(),
    clip: new Plane(),
    depthScene: new Scene(),
    marks: new Scene(),
    canvas: { clientHeight: 720 },
    bloom: { intensity: 0.2 },
    avatar: { update() {}, group: {}, depth: {}, silhouette: {} },
    effects: {
      update() {},
      setGhost() {},
      particles: {},
      pop: { visible: false, position: new Vector3() },
    },
    ibaraEffects: { setWorld() {}, setMode() {}, update() {} },
    outline: { position: new Vector3(), visible: false },
    terrain: {
      materials: [],
      uniforms: {
        cut: { value: 0 },
        display: { value: 0 },
        origin: { value: new Vector3() },
        pop: { value: new Vector3() },
        popActive: { value: 0 },
        night: { value: 0 },
        viewMode: { value: 0 },
        waterDepthReady: { value: 0 },
      },
    },
    composer: { passes: [], render: observe },
    renderer: {
      getPixelRatio: () => 1,
      shadowMap: {},
      getRenderTarget: () => null,
      setRenderTarget() {},
      render() {
        observe();
        if (failDraw) throw new Error("destination draw failed");
      },
      getContext: () => ({
        isContextLost: () => false,
        getError: () => 0,
        NO_ERROR: 0,
      }),
    },
    compile() {},
    resize() {},
  }) as unknown as WorldRenderer;
  const body = makeBody();
  const tools: { -readonly [K in keyof ToolState]: ToolState[K] } = {
    viewMode: "normal",
    timeHours: 17.25,
    clockRuns: false,
    fog: true,
    shadows: true,
    chunkBorders: false,
    wireframe: false,
    flying: false,
    flySpeed: 1,
  };
  function update(
    source?: WorldAtmosphereSource,
    displayMs = 0,
    cut = Infinity,
    preparingAtmosphere = false,
  ) {
    renderer.update(
      body,
      body,
      1,
      displayMs,
      cut,
      tools,
      null,
      null,
      2,
      false,
      source,
      preparingAtmosphere,
    );
  }
  function select(source: WorldAtmosphereSource, position: Point = point) {
    update(source);
    renderer.setWorld(source.world.id);
    renderer.setView(position, focus);
    update(source);
  }
  return {
    renderer,
    atmosphere,
    sky,
    sun,
    ambient,
    fog,
    tools,
    update,
    select,
    snapshot,
    draws,
  };
}
