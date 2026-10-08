/** Isolated engine harness. Root replaces the provisional entry with the UI shell. */

import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { createGameHandle } from "../game/create-game.js";
import { EditPersistence } from "../game/persistence.js";
import { testScene } from "./test-scenes.js";

const canvas = document.createElement("canvas");
canvas.style.width = "100vw";
canvas.style.height = "100vh";
canvas.style.display = "block";
document.body.style.margin = "0";
document.body.append(canvas);
const params = new URLSearchParams(location.search),
  camera = params.has("camera")
    ? (JSON.parse(params.get("camera") as string) as {
        position: { x: number; y: number; z: number };
        target: { x: number; y: number; z: number };
        hours: number;
        radius: number;
      })
    : undefined;
const options = {
  colors: { ink: "#11151a", steel: "#8fb3d9", cap: "#11151a" },
  keyboardLocked: () => false,
  onWindowedSprint: () => {},
  build: { version: "0.1.0", commit: "engine-isolated" },
  cacheTag: "engine-isolated-v1",
  ...(camera ? { postcard: camera } : {}),
};
const game = createGameHandle(canvas, options);
if (params.has("scene")) {
  const saved = new EditPersistence(`${WORLDGEN_VERSION}:${options.cacheTag}`);
  await saved.open();
  await saved.save(
    Number(params.get("seed") ?? "1"),
    testScene(params.get("scene") as string),
  );
  await saved.close();
}
const cf = Object.create(null) as Record<string, unknown>;
for (const key of [
  "camera",
  "body",
  "target",
  "ghost",
  "loaded",
  "queued",
  "ready",
  "displayTimeMs",
  "worldTimeSeconds",
  "rendered",
] as const)
  Object.defineProperty(cf, key, {
    get: () => game.telemetry()[key],
    enumerable: true,
  });
Object.defineProperty(cf, "telemetry", {
  get: () => game.telemetry(),
  enumerable: true,
});
Object.defineProperty(cf, "renderStill", {
  value: async (time: number) => {
    const blob = await game.renderStill(time);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  },
});
Object.defineProperty(window, "__cf", {
  value: Object.freeze(cf),
  writable: false,
});
game.port.apply({ type: "input-scope", scope: "world" });
game.port.apply({ type: "start", seed: Number(params.get("seed") ?? "1") });
