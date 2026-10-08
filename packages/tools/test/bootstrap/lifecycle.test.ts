import { signal } from "@preact/signals";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindWorldLifecycle,
  rememberedSeed,
  rememberedWorld,
} from "../../../client/src/bootstrap/lifecycle.js";
import type {
  GameEvent,
  GamePort,
  GameSnapshot,
} from "../../../client/src/contracts/game-ui.js";

afterEach(() => vi.unstubAllGlobals());
describe("world-only unload guard and seed storage", () => {
  it("remembers world kind independently and gives an explicit query precedence", () => {
    const values = new Map([
      ["coldfront.seed", "0004294967297"],
      ["coldfront.world", "test"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
    });
    expect(rememberedWorld(new URLSearchParams())).toBe("test");
    expect(rememberedWorld(new URLSearchParams("world=main"))).toBe("main");
    expect(rememberedSeed(new URLSearchParams())).toBe("0004294967297");
    values.set("coldfront.world", "future");
    expect(rememberedWorld(new URLSearchParams())).toBe("main");
  });
  it("attaches only for ready play and drops immediately on title, before asynchronous quit finishes", () => {
    const target = new EventTarget();
    const added = vi.spyOn(target, "addEventListener");
    const removed = vi.spyOn(target, "removeEventListener");
    const save = vi.fn();
    vi.stubGlobal("localStorage", { setItem: save });
    let snapshot = { lifecycle: "idle", seed: 1 } as GameSnapshot;
    let listener: ((event: GameEvent) => void) | undefined;
    const port = {
      read: () => snapshot,
      subscribe: (next: (event: GameEvent) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    } as GamePort;
    const visible = signal(true);
    const dispose = bindWorldLifecycle(
      port,
      target as unknown as Window,
      () => visible.value,
    );
    expect(added).not.toHaveBeenCalled();
    snapshot = { ...snapshot, lifecycle: "loading" };
    listener?.({ type: "snapshot", snapshot });
    expect(added).not.toHaveBeenCalled();
    snapshot = { ...snapshot, lifecycle: "ready" };
    listener?.({ type: "snapshot", snapshot });
    listener?.({ type: "snapshot", snapshot });
    expect(added).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    visible.value = false;
    expect(removed).toHaveBeenCalledTimes(1);
    dispose();
  });
  it("honors decimal query seeds and tolerates blocked local storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(rememberedSeed(new URLSearchParams())).toBe("1");
    expect(rememberedSeed(new URLSearchParams("seed=4294967297"))).toBe(
      "4294967297",
    );
    expect(rememberedSeed(new URLSearchParams("seed=bad"))).toBe("1");
    expect(rememberedSeed(new URLSearchParams("seed="))).toBe("");
  });
  it("persists and restores the successful raw long draft, even when later drafts normalize to the same engine seed", () => {
    const target = new EventTarget();
    let stored: string | null = null;
    const save = vi.fn((_key: string, value: string) => {
      stored = value;
    });
    vi.stubGlobal("localStorage", { setItem: save, getItem: () => stored });
    let snapshot = { lifecycle: "idle", seed: 1 } as GameSnapshot;
    let listener: ((event: GameEvent) => void) | undefined;
    const port = {
      read: () => snapshot,
      subscribe: (next: (event: GameEvent) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    } as GamePort;
    const draft = signal("0004294967297");
    const dispose = bindWorldLifecycle(
      port,
      target as unknown as Window,
      () => true,
      () => draft.value,
    );
    const emit = (lifecycle: GameSnapshot["lifecycle"]): void => {
      snapshot = { ...snapshot, lifecycle };
      listener?.({ type: "snapshot", snapshot });
    };
    emit("loading");
    expect(save).not.toHaveBeenCalled();
    // An attempt's successful seed remembers what was submitted, not later draft edits.
    draft.value = "2";
    emit("ready");
    expect(stored).toBe("0004294967297");
    expect(rememberedSeed(new URLSearchParams())).toBe("0004294967297");
    expect(snapshot.seed).toBe(1);
    emit("idle");
    draft.value = "0001";
    emit("loading");
    emit("ready");
    expect(stored).toBe("0001");
    expect(save).toHaveBeenCalledTimes(2);
    emit("idle");
    draft.value = "999999999999999999999999";
    emit("loading");
    emit("failed");
    expect(stored).toBe("0001");
    emit("idle");
    draft.value = "";
    emit("loading");
    emit("ready");
    expect(stored).toBe("");
    expect(rememberedSeed(new URLSearchParams())).toBe("");
    dispose();
  });
});
