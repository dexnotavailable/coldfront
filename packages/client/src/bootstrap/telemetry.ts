import type { GameHandle } from "../game/create-game.js";

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
export function exposeTelemetry(
  game: GameHandle,
  keyboardLocked: () => boolean,
): void {
  const telemetry = (): ReturnType<GameHandle["telemetry"]> =>
    freezeDeep(structuredClone(game.telemetry()));
  const hook = Object.freeze({
    get ready() {
      return game.telemetry().ready;
    },
    get queued() {
      return game.telemetry().queued;
    },
    get camera() {
      return telemetry().camera;
    },
    get telemetry() {
      return telemetry();
    },
    get snapshot() {
      return freezeDeep(structuredClone(game.port.read()));
    },
    get fullscreen() {
      return document.fullscreenElement !== null;
    },
    get keyboardLocked() {
      return keyboardLocked();
    },
    renderStill: async (displayTimeMs = 0): Promise<string> =>
      dataUrl(await game.renderStill(displayTimeMs)),
  });
  Object.defineProperty(window, "__cf", {
    value: hook,
    writable: false,
    configurable: false,
  });
}
