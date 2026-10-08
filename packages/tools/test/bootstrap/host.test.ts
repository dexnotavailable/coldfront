import { describe, expect, it, vi } from "vitest";
import {
  appRoute,
  createFullscreenState,
  type FullscreenDocument,
} from "../../../client/src/bootstrap/host.js";

class FullscreenFixture extends EventTarget implements FullscreenDocument {
  fullscreenElement: Element | null = null;
  readonly documentElement = {
    requestFullscreen: vi.fn(async () => {
      this.fullscreenElement = {} as Element;
      this.dispatchEvent(new Event("fullscreenchange"));
    }),
  };
  exitFullscreen = vi.fn(async () => {
    this.fullscreenElement = null;
    this.dispatchEvent(new Event("fullscreenchange"));
  });
}
const flush = async (): Promise<void> => {
  for (let step = 0; step < 8; step++) await Promise.resolve();
};

describe("trusted fullscreen and browser services", () => {
  it("does not permit Ctrl sprint before lock resolves, and never after fullscreen exits", async () => {
    const doc = new FullscreenFixture();
    let resolveLock: (() => void) | undefined;
    const keyboard = {
      lock: () =>
        new Promise<void>((resolve) => {
          resolveLock = resolve;
        }),
      unlock: vi.fn(),
    };
    const state = createFullscreenState(doc, keyboard, vi.fn(), vi.fn());
    state.enter();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledWith({
      keyboardLock: "browser",
    });
    expect(state.locked()).toBe(false);
    await flush();
    resolveLock?.();
    await flush();
    expect(state.locked()).toBe(true);
    await doc.exitFullscreen();
    expect(state.locked()).toBe(false);
    state.dispose();
  });
  it("does not toggle out of fullscreen on Play/Resume and does exit on F11", async () => {
    const doc = new FullscreenFixture();
    const exited = vi.fn();
    const state = createFullscreenState(
      doc,
      { lock: async () => {}, unlock: vi.fn() },
      exited,
      vi.fn(),
    );
    state.enter();
    await flush();
    state.enter();
    await flush();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
    state.toggle();
    await flush();
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(exited).not.toHaveBeenCalled();
    state.dispose();
  });
  it("a late lock response from an exited fullscreen session cannot grant a new session", async () => {
    const doc = new FullscreenFixture();
    const resolves: (() => void)[] = [];
    const state = createFullscreenState(
      doc,
      {
        lock: () => new Promise<void>((resolve) => resolves.push(resolve)),
        unlock: vi.fn(),
      },
      vi.fn(),
      vi.fn(),
    );
    state.enter();
    await flush();
    state.toggle();
    await flush();
    state.enter();
    await flush();
    resolves[0]?.();
    await flush();
    expect(state.locked()).toBe(false);
    resolves[1]?.();
    await flush();
    expect(state.locked()).toBe(true);
    state.dispose();
  });
  it("resolves Esc exactly once in either fullscreen-event ordering", async () => {
    const doc = new FullscreenFixture();
    const exited = vi.fn();
    let now = 1000;
    const state = createFullscreenState(
      doc,
      undefined,
      exited,
      vi.fn(),
      () => now,
    );
    state.enter();
    await flush();
    expect(state.claimEscape()).toBe(true);
    now += 2000;
    await doc.exitFullscreen();
    expect(exited).not.toHaveBeenCalled();
    state.releaseEscape();
    now += 1000;
    state.enter();
    await flush();
    await doc.exitFullscreen();
    expect(exited).toHaveBeenCalledTimes(1);
    expect(state.claimEscape()).toBe(false);
    state.releaseEscape();
    now += 1000;
    expect(state.claimEscape()).toBe(true);
    state.dispose();
  });
  it("a rejected request stays windowed and reports the real fallback", async () => {
    const doc = new FullscreenFixture();
    doc.documentElement.requestFullscreen.mockRejectedValueOnce(
      new Error("denied"),
    );
    const windowed = vi.fn();
    const state = createFullscreenState(doc, undefined, vi.fn(), windowed);
    state.enter();
    await flush();
    expect(state.locked()).toBe(false);
    expect(windowed).toHaveBeenCalledTimes(1);
    state.dispose();
  });
  it("uses the configured base for gallery and local licences", () => {
    expect(appRoute("/coldfront/", "?gallery", "https://dex.place")).toBe(
      "https://dex.place/coldfront/?gallery",
    );
    expect(appRoute("/coldfront/", "licenses/", "https://dex.place")).toBe(
      "https://dex.place/coldfront/licenses/",
    );
    expect(appRoute("/", "licenses/", "http://localhost:5173")).toBe(
      "http://localhost:5173/licenses/",
    );
  });
});
