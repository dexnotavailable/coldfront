import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TerrainViewMode,
  WorldSession,
} from "../../../client/src/contracts/game-ui.js";
import type {
  ChunkStore,
  ChunkViewPlan,
  StoredChunk,
} from "../../../client/src/engine/chunk-store.js";
import type { FarWorld } from "../../../client/src/engine/far-world.js";
import type {
  Address,
  ChunkResult,
  VoxelEdit,
} from "../../../client/src/engine/worker-protocol.js";
import {
  type WorldSave,
  worldKey,
} from "../../../client/src/game/world-save.js";
import { createUiController } from "../../../client/src/ui/controller.js";
import type {
  LayerId,
  WorldContext,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
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
    chunks: Map<string, StoredChunk>;
  }[],
  frames: new Map<number, FrameRequestCallback>(),
  nextFrame: 0,
  errors: [] as unknown[],
  viewGate: null as Promise<void> | null,
  prepareFailure: false,
  drawFailure: false,
  prepareCalls: 0,
  pools: 0,
  maxPools: 0,
  worldVisible: true,
  captures: 0,
  capturePlan: [] as Address[],
  plans: [] as ChunkViewPlan[],
  requestedPlans: [] as ChunkViewPlan[],
  retained: [] as string[][],
  uploaded: [] as string[],
  removed: [] as string[],
  validUploaded: new Set<string>(),
  planFailure: false,
  workerFailure: false,
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
vi.mock(
  "../../../client/src/engine/chunk-store.js",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../client/src/engine/chunk-store.js")
    >()),
    ChunkStore: class {
      poolActive = true;
      disposed = false;
      chunks = new Map<string, StoredChunk>();
      uploads: ChunkResult[] = [];
      edits = new Map<string, VoxelEdit>();
      workers = { queues: { generate: 0, light: 0, mesh: 0 }, memoryBytes: 0 };
      memoryBytes = 0;
      queueSize = 0;
      workTotals = { generate: 0, light: 0, mesh: 0 };
      constructor(
        readonly world: WorldSession,
        readonly context: WorldContext,
        _plan: WorldPlanData | null,
        saved: readonly VoxelEdit[],
      ) {
        fixture.pools++;
        fixture.maxPools = Math.max(fixture.maxPools, fixture.pools);
        for (const edit of saved)
          this.edits.set(`${edit.x},${edit.y},${edit.z}`, edit);
        fixture.stores.push(this);
      }
      get seed() {
        return this.world.identity.seed;
      }
      hasView(addresses: readonly Address[], uploaded = false) {
        return (
          !uploaded ||
          addresses.every((a) =>
            fixture.validUploaded.has(`${a.cx},${a.cy},${a.cz}`),
          )
        );
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
      async requestCamera() {
        return this.requestView();
      }
      planView(): ChunkViewPlan {
        if (fixture.planFailure) throw new Error("fixture plan failure");
        const addresses = fixture.capturePlan;
        const plan = {
          world: this.world,
          addresses,
          jobs: addresses.map((a, d) => ({ a, d })),
        };
        fixture.plans.push(plan);
        return plan;
      }
      planCamera() {
        return this.planView();
      }
      async requestPlannedView(plan: ChunkViewPlan) {
        fixture.requestedPlans.push(plan);
        await fixture.viewGate;
        if (fixture.workerFailure)
          throw new Error("fixture missing chunk failed");
        for (const address of plan.addresses) {
          const key = `${address.cx},${address.cy},${address.cz}`;
          if (this.chunks.has(key)) continue;
          const result: ChunkResult = {
            type: "chunk",
            id: this.chunks.size,
            address,
            world: this.world,
            revision: 0,
            blocks: new Uint16Array(32768),
            light: new Uint16Array(32768),
            mesh: {
              parts: [],
              quads: 0,
              skirts: {
                positions: new Float32Array(),
                normals: new Int8Array(),
                expansions: new Int8Array(),
                packedPositions: new Float32Array(),
                surfaces: new Float32Array(),
                featureIdParts: new Uint16Array(),
                indices: new Uint32Array(),
              },
            },
            regionColor: [100, 100, 100],
            timings: { generate: 0, light: 0, mesh: 0 },
            cacheBytes: 0,
          };
          this.chunks.set(key, {
            address,
            result,
            revision: 0,
            state: "meshing",
            touched: 0,
          });
          this.uploads.push(result);
        }
        return plan.addresses;
      }
      retain(addresses: readonly Address[]) {
        const keep = new Set(addresses.map((a) => `${a.cx},${a.cy},${a.cz}`)),
          removed: string[] = [];
        fixture.retained.push([...keep]);
        for (const key of this.chunks.keys())
          if (!keep.has(key)) {
            this.chunks.delete(key);
            removed.push(key);
          }
        return removed;
      }
      suspendWorkers() {
        if (this.poolActive) {
          this.poolActive = false;
          fixture.pools--;
        }
      }
      async resumeWorkers() {
        if (!this.poolActive && !this.disposed) {
          this.poolActive = true;
          fixture.pools++;
          fixture.maxPools = Math.max(fixture.maxPools, fixture.pools);
        }
      }
      evict() {
        return [];
      }
      edit(edit: VoxelEdit) {
        this.edits.set(`${edit.x},${edit.y},${edit.z}`, edit);
      }
      dispose() {
        this.suspendWorkers();
        this.disposed = true;
      }
    },
  }),
);
vi.mock("../../../client/src/engine/renderer.js", async () => {
  const { PerspectiveCamera } = await import("three");
  const { createFarWorldFixture } = await import(
    "../bootstrap/ibara-atmosphere-fixture.js"
  );
  return {
    WorldRenderer: class {
      camera = new PerspectiveCamera(40, 1, 0.2, 1600);
      contextLost = false;
      activeFar: FarWorld | null = null;
      farWorlds = new Set<FarWorld>();
      viewMode: TerrainViewMode = "normal";
      statistics = { draws: 0, triangles: 0, memory: 0 };
      effects = {
        placementActive: () => false,
        placed() {},
        broken() {},
        reset() {},
      };
      avatar = { step() {}, swing() {} };
      constructor() {
        this.camera.position.set(0, 24, 24);
      }
      createFarWorld(near: ChunkStore, layer: LayerId = "surface") {
        const far = createFarWorldFixture(near, layer);
        this.farWorlds.add(far);
        return far;
      }
      useFar(far: FarWorld | null) {
        this.activeFar = far;
      }
      releaseFar(far: FarWorld) {
        if (this.activeFar === far) this.activeFar = null;
        far.dispose();
        this.farWorlds.delete(far);
      }
      setView(position: { x: number; y: number; z: number }) {
        this.camera.position.set(position.x, position.y, position.z);
      }
      pointerRay() {
        return {
          origin: { x: 0.5, y: 24, z: -2.5 },
          direction: { x: 0, y: -1, z: 0 },
        };
      }
      setPostcard(active: boolean) {
        this.camera.fov = active ? 70 : 40;
      }
      setViewMode(mode: TerrainViewMode) {
        this.viewMode = mode;
      }
      setHud() {}
      setWorld() {}
      removeWorld() {}
      prepareView() {
        fixture.prepareCalls++;
        if (fixture.prepareFailure)
          throw new Error("fixture GPU preparation failed");
      }
      compile() {}
      render() {
        if (fixture.drawFailure) throw new Error("fixture final draw failed");
      }
      async capturePng() {
        this.render();
        this.render();
        fixture.captures++;
        return new Blob(["unit-test renderer seam; not image evidence"], {
          type: "image/png",
        });
      }
      update() {}
      upload(result: ChunkResult) {
        const key = `${result.address.cx},${result.address.cy},${result.address.cz}`;
        fixture.uploaded.push(key);
        fixture.validUploaded.add(key);
      }
      remove(key: string) {
        fixture.removed.push(key);
        fixture.validUploaded.delete(key);
      }
      dispose() {
        for (const far of [...this.farWorlds]) this.releaseFar(far);
      }
    },
  };
});

import {
  createGameHandle,
  type GameHandle,
} from "../../../client/src/game/create-game.js";

let storage: StorageFixture;
let game: GameHandle;
const key = (seed: number) => `${WORLDGEN_VERSION}:fixture:${seed}`;
function currentWorld(): WorldSession {
  const world = game.port.read().world;
  if (!world) throw new Error("No ready world");
  return world;
}
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
  game.port.apply({ type: "start", seed, worldKind: "test" });
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
  fixture.prepareFailure = false;
  fixture.drawFailure = false;
  fixture.prepareCalls = 0;
  fixture.pools = fixture.maxPools = 0;
  fixture.worldVisible = true;
  fixture.captures = 0;
  fixture.capturePlan = [];
  fixture.plans.length = fixture.requestedPlans.length = 0;
  fixture.retained.length =
    fixture.uploaded.length =
    fixture.removed.length =
      0;
  fixture.validUploaded.clear();
  fixture.planFailure = fixture.workerFailure = false;
  storage = new StorageFixture();
  vi.stubGlobal("indexedDB", storage.factory);
  vi.stubGlobal("devicePixelRatio", 1);
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
  game = createGameHandle(
    { clientWidth: 1280, clientHeight: 720 } as HTMLCanvasElement,
    {
      colors: { ink: "black", steel: "white", cap: "black" },
      keyboardLocked: () => false,
      onWindowedSprint: () => {},
      build: { version: "test", commit: "test" },
      cacheTag: "fixture",
      externalKeyboard: true,
      worldVisible: () => fixture.worldVisible,
    },
  );
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
  it("keeps overlap GPU ownership, removes only obsolete meshes and uses its one planned destination", async () => {
    const world = currentWorld(),
      store = fixture.stores[0];
    if (!store) throw new Error("Missing store");
    const camera = {
      id: "TEST-1" as const,
      identity: world.identity,
      position: { x: 10, y: 10, z: 10 },
      target: { x: 0, y: 6, z: 0 },
      hours: 17.25,
      radius: 96,
    };
    fixture.capturePlan = [
      { cx: 0, cy: 0, cz: 0 },
      { cx: 1, cy: 0, cz: 0 },
    ];
    await game.renderPostcard(camera);
    const overlap = store.chunks.get("1,0,0");
    fixture.uploaded.length = fixture.removed.length = 0;
    fixture.capturePlan = [
      { cx: 1, cy: 0, cz: 0 },
      { cx: 2, cy: 0, cz: 0 },
    ];
    await game.renderPostcard({ ...camera, position: { x: 50, y: 10, z: 10 } });
    expect(fixture.retained.at(-1)).toEqual(["1,0,0"]);
    expect(fixture.removed).toEqual(["0,0,0"]);
    expect(fixture.uploaded).toEqual(["2,0,0"]);
    expect(store.chunks.get("1,0,0")).toBe(overlap);
    expect([...store.chunks.keys()]).toEqual(["1,0,0", "2,0,0"]);
    expect(fixture.plans).toHaveLength(2);
    expect(fixture.requestedPlans[0]).toBe(fixture.plans[0]);
    expect(fixture.requestedPlans[1]).toBe(fixture.plans[1]);
    expect(fixture.pools).toBe(1);
    expect(fixture.maxPools).toBe(1);
    expect(fixture.captures).toBe(2);
  });
  it("invalid planning fails before retention or renderer eviction", async () => {
    const world = currentWorld();
    fixture.planFailure = true;
    await expect(
      game.renderPostcard({
        id: "TEST-1",
        identity: world.identity,
        position: { x: 10, y: 10, z: 10 },
        target: { x: 0, y: 6, z: 0 },
        hours: 17.25,
        radius: 96,
      }),
    ).rejects.toThrow("plan failure");
    expect(fixture.retained).toEqual([]);
    expect(fixture.removed).toEqual([]);
    expect(fixture.requestedPlans).toEqual([]);
    expect(fixture.captures).toBe(0);
  });
  it.each(["worker", "GPU"])(
    "rejects %s failure without publishing a new successful capture",
    async (kind) => {
      const world = currentWorld(),
        camera = {
          id: "TEST-1" as const,
          identity: world.identity,
          position: { x: 10, y: 10, z: 10 },
          target: { x: 0, y: 6, z: 0 },
          hours: 17.25,
          radius: 96,
        };
      await game.renderPostcard(camera);
      const report = game.telemetry().postcard;
      fixture.workerFailure = kind === "worker";
      fixture.prepareFailure = kind === "GPU";
      await expect(
        game.renderPostcard({ ...camera, position: { x: 50, y: 10, z: 10 } }),
      ).rejects.toThrow(
        kind === "worker" ? "missing chunk failed" : "GPU preparation",
      );
      expect(fixture.captures).toBe(1);
      expect(game.telemetry().postcard).toEqual(report);
      expect(game.telemetry().ready).toBe(false);
    },
  );
  it("cancels held capture before Quit/Play without publishing into or disposing the next world", async () => {
    const old = currentWorld();
    let release = () => {};
    fixture.viewGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const capture = game.renderPostcard({
      id: "TEST-1",
      identity: old.identity,
      position: { x: 10, y: 10, z: 10 },
      target: { x: 0, y: 6, z: 0 },
      hours: 17.25,
      radius: 96,
    });
    const rejected = expect(capture).rejects.toThrow("cancelled");
    await Promise.resolve();
    await Promise.resolve();
    game.port.apply({ type: "quit" });
    game.port.apply({ type: "start", seed: 2, worldKind: "test" });
    release();
    fixture.viewGate = null;
    await rejected;
    await drain(game.ready());
    expect(fixture.captures).toBe(0);
    expect(currentWorld().identity.seed).toBe(2);
    expect(currentWorld().id).not.toBe(old.id);
    expect(fixture.pools).toBe(1);
    expect(fixture.stores.at(-1)?.disposed).toBe(false);
  });
  it("switches validated postcard views in one world/pool, waits for requested terrain and resumes the original free camera", async () => {
    const world = currentWorld(),
      stores = fixture.stores.length;
    let release = () => {};
    fixture.viewGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const camera = {
      id: "TEST-1" as const,
      identity: world.identity,
      position: { x: 10, y: 10, z: 10 },
      target: { x: 0, y: 6, z: 0 },
      hours: 17.25,
      radius: 96,
    };
    const capture = game.renderPostcard(camera);
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.captures).toBe(0);
    expect(game.telemetry().ready).toBe(false);
    release();
    fixture.viewGate = null;
    expect((await capture).type).toBe("image/png");
    expect(currentWorld()).toEqual(world);
    expect(fixture.stores).toHaveLength(stores);
    expect(fixture.pools).toBe(1);
    expect(fixture.frames.size).toBe(0);
    expect(game.telemetry().camera.fov).toBe(70);
    expect(game.telemetry().camera.focus).toEqual(camera.target);
    expect(game.telemetry().displayTimeMs).toBe(0);
    expect(game.telemetry().postcard?.planReused).toBe(true);
    await game.renderPostcard({
      ...camera,
      position: { x: 50, y: 16, z: 50 },
      target: { x: 60, y: 6, z: 60 },
    });
    expect(fixture.stores).toHaveLength(stores);
    expect(fixture.captures).toBe(2);
    game.port.apply({ type: "postcard", active: false });
    await drain(game.ready());
    expect(game.port.read().mode).toBe("overhead");
    expect(game.telemetry().camera.fov).toBe(40);
  });
  it("rejects a resolved postcard from another world generation without queuing a capture", async () => {
    const world = currentWorld();
    await expect(
      game.renderPostcard({
        id: "TEST-1",
        identity: { ...world.identity, generation: "stale" },
        position: { x: 1, y: 8, z: 1 },
        target: { x: 2, y: 7, z: 2 },
        hours: 17.25,
        radius: 96,
      }),
    ).rejects.toThrow("loaded world");
    expect(fixture.captures).toBe(0);
    expect(currentWorld()).toEqual(world);
  });
  it("keeps the committed teleport destination after postcard capture resets the display clock", async () => {
    tick(1);
    for (let now = 251; now <= 10001; now += 250) tick(now);
    const world = currentWorld(),
      before = game.telemetry(),
      target = { x: before.body.x + 8, z: before.body.z + 4 };
    expect(before.displayTimeMs).toBe(10000);
    expect(
      await drain(
        game.port.teleport({
          sessionId: world.id,
          target: { kind: "point", ...target },
        }),
      ),
    ).toEqual({ sessionId: world.id, committed: true });
    // The250ms glide has committed its destination, but has not had a RAF yet.
    expect(game.telemetry().camera.position).toEqual(before.camera.position);
    expect(game.telemetry().body).toMatchObject(target);
    await game.renderPostcard({
      id: "TEST-1",
      identity: world.identity,
      position: { x: 50, y: 16, z: 50 },
      target: { x: 60, y: 6, z: 60 },
      hours: 17.25,
      radius: 96,
    });
    expect(game.telemetry().displayTimeMs).toBe(0);
    game.port.apply({ type: "postcard", active: false });
    await drain(game.ready());
    const restored = game.telemetry().camera;
    expect(restored.position).not.toEqual(before.camera.position);
    expect(restored.focus).toMatchObject(target);
    tick(11001); // Resume the single animation clock without a catch-up step.
    tick(11251);
    tick(11501);
    const resumed = game.telemetry();
    expect(resumed.displayTimeMs).toBe(500);
    expect(resumed.camera.position.x).toBeCloseTo(restored.position.x, 10);
    expect(resumed.camera.position.z).toBeCloseTo(restored.position.z, 10);
    expect(resumed.camera.focus).toMatchObject(target);
    expect(resumed.body).toMatchObject(target);
    await storage.flush();
    const saved = storage.records.get(worldKey(world.identity)) as WorldSave;
    expect(saved.pose).toMatchObject(target);
  });
  it("keeps clocks and exact map queries active while an opaque map suppresses hidden3D draws", async () => {
    const world = currentWorld();
    game.port.apply({ type: "input-scope", scope: "blocking-screen" });
    fixture.worldVisible = false;
    const before = game.telemetry();
    tick(1);
    tick(61);
    tick(121);
    const hidden = game.telemetry();
    expect(hidden.worldTimeSeconds).toBeGreaterThan(before.worldTimeSeconds);
    expect(hidden.rendering.animationRenders).toBe(
      before.rendering.animationRenders,
    );
    expect(hidden.rendering.hiddenFrames).toBeGreaterThan(
      before.rendering.hiddenFrames,
    );
    expect(
      game.port.inspectMap({ sessionId: world.id, x: 1, z: 1 }),
    ).not.toBeNull();
    expect(
      await game.port.readMap({
        sessionId: world.id,
        bounds: { minX: 0, minZ: 0, maxX: 2, maxZ: 2 },
        width: 2,
        height: 2,
      }),
    ).not.toBeNull();
    fixture.worldVisible = true;
    game.port.apply({ type: "input-scope", scope: "world" });
    tick(181);
    expect(game.telemetry().rendering.animationRenders).toBeGreaterThan(
      hidden.rendering.animationRenders,
    );
  });
  it("retains source chunks while staging only one terrain pool, and restores one source pool on failure", async () => {
    await start(2);
    expect(fixture.pools).toBe(1);
    expect(fixture.maxPools).toBe(1);
    fixture.prepareFailure = true;
    await start(3);
    fixture.prepareFailure = false;
    expect(fixture.pools).toBe(1);
    expect(fixture.maxPools).toBe(1);
    expect(game.port.read().lifecycle).toBe("failed");
  });
  it("retains the source body and store if a replacement world's final draw fails before commit", async () => {
    const before = game.telemetry().body,
      source = fixture.stores.at(-1);
    fixture.drawFailure = true;
    game.port.apply({ type: "start", seed: 2, worldKind: "test" });
    await drain(game.ready());
    expect(game.port.read().lifecycle).toBe("failed");
    expect(game.telemetry().body).toEqual(before);
    expect(source?.disposed).toBe(false);
    expect(fixture.stores.at(-1)?.disposed).toBe(true);
    fixture.drawFailure = false;
  });
  it("retains source pose when the final destination draw fails even after GPU preparation", async () => {
    const before = game.telemetry().body,
      world = currentWorld();
    fixture.drawFailure = true;
    await expect(
      game.port.teleport({
        sessionId: world.id,
        target: { kind: "point", x: 5, z: 5 },
      }),
    ).rejects.toThrow("final draw");
    expect(game.telemetry().body).toEqual(before);
    fixture.drawFailure = false;
  });
  it("keeps source pose through pending and cancelled travel and does not call GPU preparation", async () => {
    const world = currentWorld(),
      before = game.telemetry().body,
      prepared = fixture.prepareCalls;
    let release = () => {};
    fixture.viewGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const travel = game.port.teleport({
      sessionId: world.id,
      target: { kind: "point", x: 20, z: 25 },
    });
    expect(game.telemetry().body).toEqual(before);
    game.port.cancelTeleport(world.id);
    release();
    fixture.viewGate = null;
    expect(await travel).toEqual({ sessionId: world.id, committed: false });
    expect(game.telemetry().body).toEqual(before);
    expect(fixture.prepareCalls).toBe(prepared);
  });
  it("requires successful actual-render preparation before moving, and preserves old pose on render failure", async () => {
    const world = currentWorld(),
      before = game.telemetry().body;
    fixture.prepareFailure = true;
    await expect(
      game.port.teleport({
        sessionId: world.id,
        target: { kind: "point", x: -3.5, z: 6.5 },
      }),
    ).rejects.toThrow("GPU preparation");
    expect(game.telemetry().body).toEqual(before);
    fixture.prepareFailure = false;
    const result = await game.port.teleport({
      sessionId: world.id,
      target: { kind: "point", x: -3.5, z: 6.5 },
    });
    expect(result.committed).toBe(true);
    expect(game.telemetry().body.x).toBe(-3.5);
    expect(game.telemetry().body.z).toBe(6.5);
    expect(game.telemetry().body.vx).toBe(0);
    expect(game.telemetry().camera.requestedDistance).toBe(24);
  });
  it("rejects stale same-seed session map/teleport/clear requests after reentry", async () => {
    const old = currentWorld();
    await start();
    const current = currentWorld();
    expect(current.id).not.toBe(old.id);
    expect(
      await game.port.readMap({
        sessionId: old.id,
        bounds: { minX: -2, minZ: -2, maxX: 2, maxZ: 2 },
        width: 2,
        height: 2,
      }),
    ).toBeNull();
    expect(game.port.inspectMap({ sessionId: old.id, x: 0, z: 0 })).toBeNull();
    expect(
      (
        await game.port.teleport({
          sessionId: old.id,
          target: { kind: "point", x: 2, z: 2 },
        })
      ).committed,
    ).toBe(false);
    const currentFrame = game.port.readMap({
      sessionId: current.id,
      bounds: { minX: -2, minZ: -2, maxX: 2, maxZ: 2 },
      width: 2,
      height: 32,
    });
    await game.port.readMap({
      sessionId: old.id,
      bounds: { minX: -2, minZ: -2, maxX: 2, maxZ: 2 },
      width: 2,
      height: 2,
    });
    expect(await currentFrame).not.toBeNull();
    game.port.apply({ type: "clear-edits", world: old });
    await drain(game.ready());
    expect(currentWorld()).toEqual(current);
  });
  it("keeps ordinary snapshots from invalidating a real pending teleport and commits only the newest request", async () => {
    const world = currentWorld();
    let release = () => {};
    fixture.viewGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = game.port.teleport({
      sessionId: world.id,
      target: { kind: "point", x: 5, z: 6 },
    });
    const second = game.port.teleport({
      sessionId: world.id,
      target: { kind: "point", x: 7, z: 8 },
    });
    game.port.apply({ type: "set-time", hours: 10 });
    release();
    fixture.viewGate = null;
    expect((await first).committed).toBe(false);
    expect((await second).committed).toBe(true);
    expect(game.telemetry().body.x).toBe(7);
    expect(currentWorld()).toEqual(world);
  });
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
    game.port.apply({ type: "start", seed: 2, worldKind: "test" });
    expect(game.port.read().lifecycle).toBe("loading");
    expect(game.telemetry().ready).toBe(false);
  });
  it("quick Quit then Play cannot let old cleanup destroy the next world", async () => {
    game.port.apply({ type: "quit" });
    game.port.apply({ type: "start", seed: 2, worldKind: "test" });
    await drain(game.ready());
    expect(game.port.read().lifecycle).toBe("ready");
    expect(game.port.read().seed).toBe(2);
    expect(fixture.stores.at(-1)?.disposed).toBe(false);
    expect(fixture.errors).toEqual([]);
  });
  it("a Clear begun in one seed cannot restart over a later Quit/Play seed", async () => {
    const saved = { x: 3, y: 6, z: 0, block: 2 };
    storage.records.set(key(2), [saved]);
    game.port.apply({ type: "clear-edits", world: currentWorld() });
    game.port.apply({ type: "quit" });
    game.port.apply({ type: "start", seed: 2, worldKind: "test" });
    await drain(game.ready());
    expect(game.port.read().lifecycle).toBe("ready");
    expect(game.port.read().seed).toBe(2);
    expect(game.telemetry().editCount).toBe(1);
    expect(game.telemetry().lastEdit).toEqual(saved);
    expect(fixture.errors).toEqual([]);
  });
  it("does not accept a block edit while Clear is waiting to commit", async () => {
    game.port.apply({ type: "select-slot", index: 2 });
    game.port.apply({ type: "clear-edits", world: currentWorld() });
    fixture.inputs.at(-1)?.buttons.add(2);
    tick(1);
    tick(61);
    expect(game.telemetry().editCount).toBe(0);
    await drain(game.ready());
    expect(
      (
        storage.records.get(worldKey(currentWorld().identity)) as {
          edits: unknown[];
        }
      ).edits,
    ).toEqual([]);
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
    const cleared = currentWorld();
    game.port.apply({ type: "clear-edits", world: cleared });
    await drain(game.ready());
    expect(game.telemetry().lastEdit).toEqual(saved);
    expect(events).toEqual([
      { type: "clear-edits-finished", world: cleared, ok: false },
    ]);
    stop();
  });
});
