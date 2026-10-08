import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VoxelEdit } from "../../../client/src/engine/worker-protocol.js";
import { createUiController } from "../../../client/src/ui/controller.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { StorageFixture } from "./storage-fixture.js";

const fixture = vi.hoisted(() => ({
  inputs: [] as {
    buttons: Set<number>;
    pointer: { inside: boolean };
    scope: string;
  }[],
  stores: [] as {
    seed: number;
    disposed: boolean;
    edits: Map<string, VoxelEdit>;
  }[],
  frames: new Map<number, FrameRequestCallback>(),
  nextFrame: 0,
  errors: [] as unknown[],
  viewGate: null as Promise<void> | null,
}));
vi.mock("../../../client/src/engine/effects.js", () => ({
  blockIcon: () => "fixture-icon",
}));
vi.mock("../../../client/src/game/input.js", () => ({
  FLY_SPEEDS: [1, 2, 4, 8, 16],
  WorldInput: class {
    scope = "inactive";
    held = new Set<string>();
    buttons = new Set<number>();
    pointer = { x: 0, y: 0, inside: true };
    forward = 0;
    right = 0;
    turn = 0;
    tilt = 0;
    sprint = false;
    constructor() {
      fixture.inputs.push(this);
    }
    setScope(scope: string) {
      if (scope !== this.scope) this.release();
      this.scope = scope;
    }
    release() {
      this.held.clear();
      this.buttons.clear();
    }
    dispose() {
      this.release();
    }
    keydown() {}
    keyup() {}
    cancelDrag() {
      return false;
    }
  },
}));
vi.mock("../../../client/src/engine/chunk-store.js", () => ({
  ChunkStore: class {
    disposed = false;
    chunks = new Map();
    uploads = [];
    edits = new Map<string, VoxelEdit>();
    workers = { queues: { generate: 0, light: 0, mesh: 0 }, memoryBytes: 0 };
    memoryBytes = 0;
    queueSize = 0;
    constructor(
      readonly seed: number,
      saved: readonly VoxelEdit[],
    ) {
      for (const edit of saved)
        this.edits.set(`${edit.x},${edit.y},${edit.z}`, edit);
      fixture.stores.push(this);
    }
    get = (x: number, y: number, z: number) =>
      this.edits.get(`${x},${y},${z}`)?.block ?? (y < 6 ? 3 : 0);
    surface = () => 6;
    lightAt() {
      return 0xffff;
    }
    async requestView() {
      await fixture.viewGate;
      return [];
    }
    async settled() {}
    evict() {
      return [];
    }
    edit(edit: VoxelEdit) {
      this.edits.set(`${edit.x},${edit.y},${edit.z}`, edit);
    }
    dispose() {
      this.disposed = true;
    }
  },
}));
vi.mock("../../../client/src/engine/renderer.js", () => ({
  WorldRenderer: class {
    camera = { position: { x: 0, y: 24, z: 24 }, fov: 40 };
    statistics = { draws: 0, triangles: 0, memory: 0 };
    effects = { placementActive: () => false, placed() {}, broken() {} };
    avatar = { step() {}, swing() {} };
    setView(position: { x: number; y: number; z: number }) {
      this.camera.position = { ...position };
    }
    pointerRay() {
      return {
        origin: { x: 0.5, y: 24, z: -2.5 },
        direction: { x: 0, y: -1, z: 0 },
      };
    }
    setPostcard() {}
    setHud() {}
    compile() {}
    render() {}
    update() {}
    upload() {}
    remove() {}
    dispose() {}
  },
}));

import {
  createGameHandle,
  type GameHandle,
} from "../../../client/src/game/create-game.js";

let storage: StorageFixture;
let game: GameHandle;
const key = (seed: number) => `${WORLDGEN_VERSION}:fixture:${seed}`;
async function drain<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  const observed = promise.finally(() => {
    done = true;
  });
  for (let step = 0; step < 80 && !done; step++) {
    await storage.flush();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(done, "Lifecycle promise did not settle").toBe(true);
  return observed;
}
async function start(seed = 1) {
  game.port.apply({ type: "start", seed });
  await drain(game.ready());
}
function tick(time: number) {
  const callbacks = [...fixture.frames.values()];
  fixture.frames.clear();
  for (const callback of callbacks) callback(time);
}
beforeEach(async () => {
  fixture.inputs.length = 0;
  fixture.stores.length = 0;
  fixture.frames.clear();
  fixture.nextFrame = 0;
  fixture.errors.length = 0;
  fixture.viewGate = null;
  storage = new StorageFixture();
  vi.stubGlobal("indexedDB", storage.factory);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++fixture.nextFrame;
    fixture.frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    fixture.frames.delete(id),
  );
  vi.spyOn(console, "error").mockImplementation((error) =>
    fixture.errors.push(error),
  );
  game = createGameHandle({} as HTMLCanvasElement, {
    colors: { ink: "black", steel: "white", cap: "black" },
    keyboardLocked: () => false,
    onWindowedSprint: () => {},
    build: { version: "test", commit: "test" },
    cacheTag: "fixture",
    externalKeyboard: true,
  });
  game.port.apply({ type: "input-scope", scope: "world" });
  await start();
});
afterEach(async () => {
  await drain(game.port.dispose());
  await new Promise((resolve) => setTimeout(resolve, 60));
  fixture.frames.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("real game-port lifecycle serialization with deferred storage", () => {
  it("publishes postcard entry before waiting so Esc requests exit instead of opening Menu", async () => {
    let releaseView = () => {};
    fixture.viewGate = new Promise<void>((resolve) => {
      releaseView = resolve;
    });
    const ui = createUiController(
      game.port,
      {
        enterFullscreen() {},
        toggleFullscreen() {},
        reload() {},
        openRoute() {},
        downloadPng() {},
        randomSeed: () => 1,
      },
      { manageInputScope: false },
    );
    try {
      ui.postcard();
      await Promise.resolve();
      await Promise.resolve();
      expect(game.port.read().mode).toBe("postcard");
      expect(ui.game.value.mode).toBe("postcard");
      ui.escape();
      expect(ui.blocking.value).toBeNull();
    } finally {
      releaseView();
      fixture.viewGate = null;
      await drain(game.ready());
      ui.dispose();
    }
    expect(game.port.read().mode).toBe("overhead");
  });
  it("does not publish the old world's ready state after a queued Play request", () => {
    game.port.apply({ type: "quit" });
    game.port.apply({ type: "start", seed: 2 });
    expect(game.port.read().lifecycle).toBe("loading");
    expect(game.telemetry().ready).toBe(false);
  });
  it("quick Quit then Play cannot let old cleanup destroy the next world", async () => {
    game.port.apply({ type: "quit" });
    game.port.apply({ type: "start", seed: 2 });
    await drain(game.ready());
    expect(game.port.read().lifecycle).toBe("ready");
    expect(game.port.read().seed).toBe(2);
    expect(fixture.stores.at(-1)?.disposed).toBe(false);
    expect(fixture.errors).toEqual([]);
  });
  it("a Clear begun in one seed cannot restart over a later Quit/Play seed", async () => {
    const saved = { x: 3, y: 6, z: 0, block: 2 };
    storage.records.set(key(2), [saved]);
    game.port.apply({ type: "clear-edits", seed: 1 });
    game.port.apply({ type: "quit" });
    game.port.apply({ type: "start", seed: 2 });
    await drain(game.ready());
    expect(game.port.read().lifecycle).toBe("ready");
    expect(game.port.read().seed).toBe(2);
    expect(game.telemetry().editCount).toBe(1);
    expect(game.telemetry().lastEdit).toEqual(saved);
    expect(fixture.errors).toEqual([]);
  });
  it("does not accept a block edit while Clear is waiting to commit", async () => {
    game.port.apply({ type: "select-slot", index: 2 });
    game.port.apply({ type: "clear-edits", seed: 1 });
    fixture.inputs.at(-1)?.buttons.add(2);
    tick(1);
    tick(61);
    expect(game.telemetry().editCount).toBe(0);
    await drain(game.ready());
    expect(storage.records.get(key(1))).toEqual([]);
  });
  it("a failed Clear keeps the current in-memory edits and reports failure", async () => {
    storage.abortWrite = true;
    game.port.apply({ type: "select-slot", index: 2 });
    fixture.inputs.at(-1)?.buttons.add(2);
    tick(1);
    tick(61);
    fixture.inputs.at(-1)?.buttons.clear();
    await storage.flush();
    const saved = game.telemetry().lastEdit;
    expect(saved).not.toBeNull();
    const events: unknown[] = [];
    const stop = game.port.subscribe((event) => {
      if (event.type === "clear-edits-finished") events.push(event);
    });
    storage.abortWrite = true;
    game.port.apply({ type: "clear-edits", seed: 1 });
    await drain(game.ready());
    expect(game.telemetry().lastEdit).toEqual(saved);
    expect(events).toEqual([
      { type: "clear-edits-finished", seed: 1, ok: false },
    ]);
    stop();
  });
});
