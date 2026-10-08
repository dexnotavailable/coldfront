import { afterEach, describe, expect, it, vi } from "vitest";
import type { FullscreenState } from "../../../client/src/bootstrap/host.js";
import {
  bindInput,
  inputScope,
  reservedKey,
} from "../../../client/src/bootstrap/input.js";
import type { GameHandle } from "../../../client/src/game/create-game.js";
import { fixtureController } from "../../src/ui-harness/sample.js";

afterEach(() => vi.unstubAllGlobals());
const key = (
  code: string,
  fields: Partial<KeyboardEvent> = {},
): KeyboardEvent =>
  Object.assign(
    new Event("keydown", { cancelable: true }),
    {
      code,
      key: code === "Escape" ? "Escape" : code,
      repeat: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    },
    fields,
  ) as KeyboardEvent;

describe("production input arbitration", () => {
  it("blocks world input for fields, modals, loading, small windows and postcards", () => {
    const state = {
      active: true,
      systemBlocked: false,
      modal: false,
      blocking: false,
      field: false,
      ready: true,
      postcard: false,
    };
    expect(inputScope(state)).toBe("world");
    expect(inputScope({ ...state, field: true })).toBe("field");
    expect(inputScope({ ...state, modal: true })).toBe("modal");
    expect(inputScope({ ...state, systemBlocked: true })).toBe(
      "blocking-screen",
    );
    expect(inputScope({ ...state, blocking: true })).toBe("blocking-screen");
    expect(inputScope({ ...state, postcard: true })).toBe("inactive");
    expect(inputScope({ ...state, active: false })).toBe("inactive");
  });
  it("preserves platform shortcuts but owns windowed Ctrl+D and unbound world keys", () => {
    expect(reservedKey(key("KeyW", { ctrlKey: true }), false, false)).toBe(
      true,
    );
    expect(reservedKey(key("KeyW", { ctrlKey: true }), false, true)).toBe(
      false,
    );
    expect(reservedKey(key("KeyD", { ctrlKey: true }), false, false)).toBe(
      false,
    );
    expect(reservedKey(key("F5"), false, false)).toBe(false);
    expect(reservedKey(key("F11"), true, false)).toBe(true);
    expect(reservedKey(key("F12"), false, true)).toBe(true);
    expect(reservedKey(key("KeyR", { metaKey: true }), true, true)).toBe(true);
  });
  it("routes shell keys once, releases held input on palette/blur, and closes E without moving", () => {
    class ElementFixture extends EventTarget {
      closest() {
        return null;
      }
    }
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), {
      hidden: false,
      activeElement: null,
      hasFocus: () => true,
    });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("navigator", { platform: "Win32" });
    vi.stubGlobal("innerWidth", 1280);
    vi.stubGlobal("innerHeight", 720);
    for (const name of [
      "Element",
      "HTMLElement",
      "HTMLInputElement",
      "HTMLTextAreaElement",
      "HTMLSelectElement",
    ])
      vi.stubGlobal(name, ElementFixture);
    const fixture = fixtureController("hud");
    const apply = vi.fn();
    const engine = {
      port: { apply },
      input: {
        blur: vi.fn(),
        keydown: vi.fn(),
        keyup: vi.fn(),
        cancelDrag: () => false,
      },
    } as unknown as GameHandle;
    const fullscreen = {
      locked: () => false,
      claimEscape: () => true,
      releaseEscape: () => {},
    } as FullscreenState;
    const arbiter = bindInput(fixture.ui, engine, fullscreen);
    const movement = key("KeyW");
    win.dispatchEvent(movement);
    expect(engine.input.keydown).toHaveBeenCalledTimes(1);
    expect(movement.defaultPrevented).toBe(true);
    const e = key("KeyE");
    win.dispatchEvent(e);
    expect(fixture.ui.blocking.value).toBe("blocks");
    expect(arbiter.scope()).toBe("blocking-screen");
    expect(engine.input.keydown).toHaveBeenCalledTimes(1);
    win.dispatchEvent(key("KeyE", { repeat: true }));
    expect(fixture.ui.blocking.value).toBe("blocks");
    win.dispatchEvent(key("KeyE"));
    expect(fixture.ui.blocking.value).toBeNull();
    win.dispatchEvent(new Event("blur"));
    expect(arbiter.scope()).toBe("inactive");
    expect(apply).toHaveBeenLastCalledWith({
      type: "input-scope",
      scope: "inactive",
    });
    expect(engine.input.blur).toHaveBeenCalled();
    arbiter.dispose();
    fixture.ui.dispose();
  });
});
