import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TerrainViewMode,
  WorldSession,
} from "../../../client/src/contracts/game-ui.js";
import type { VoxelEdit } from "../../../client/src/engine/worker-protocol.js";
import type { WorldPostcard } from "../../../client/src/game/postcard.js";
import { Block } from "../../../shared/src/blocks/registry.js";
import type {
  WorldContext,
  WorldContextOptions,
  WorldIdentity,
} from "../../../shared/src/world/types.js";

const probe = vi.hoisted(() => ({
  contexts: [] as WorldContextOptions[],
  identities: [] as WorldIdentity[],
  modes: [] as string[],
  views: [] as unknown[],
  edits: [] as VoxelEdit[],
  hold: null as Promise<void> | null,
  uploaded: true,
  failPreparation: false,
  capture: 0,
  draws: [] as {
    camera: { x: number; y: number; z: number };
    flames: number;
  }[],
}));
vi.mock("../../../shared/src/world/world-context.js", () => ({
  createWorldContext: (options: WorldContextOptions) => {
    probe.contexts.push(options);
    return {
      kind: options.kind,
      seed: options.seed,
      regions: [],
      plan: null,
      spawn: { x: 0, y: 0, z: 0 },
      waterQuery: (_x: number, _z: number, out: object) =>
        Object.assign(out, { kind: "none", bodyId: 0, level: -Infinity }),
    };
  },
}));
vi.mock("../../../client/src/engine/prepare-plan.js", () => ({
  PlanPreparation: class {
    async prepare(identity: WorldIdentity) {
      probe.identities.push(identity);
      return {};
    }
    cancel() {}
    async dispose() {}
  },
}));
vi.mock("../../../client/src/game/persistence.js", () => ({
  EditPersistence: class {
    blocked = false;
    async open() {}
    async close() {}
    async loadWorld(identity: WorldIdentity) {
      return { identity, edits: probe.edits, pose: null, discoveries: [] };
    }
    async save() {
      return true;
    }
    async savePose() {
      return true;
    }
    async discover() {
      return true;
    }
  },
}));
vi.mock("../../../client/src/game/input.js", () => ({
  FLY_SPEEDS: [1, 2, 4, 8, 16],
  WorldInput: class {
    pointer = { x: 0, y: 0, inside: false };
    release() {}
    setScope() {}
    dispose() {}
    cancelDrag() {
      return false;
    }
  },
}));
vi.mock("../../../client/src/game/world-map.js", () => ({
  regionViewpoints: () => new Map(),
  topRegions: () => [],
  regionAt: () => null,
}));
vi.mock("../../../client/src/engine/chunk-store.js", () => ({
  ChunkStore: class {
    edits = new Map<number, VoxelEdit>();
    chunks = new Map();
    uploads = [];
    workers = { queues: { generate: 0, light: 0, mesh: 0 } };
    workTotals = { generate: 0, light: 0, mesh: 0 };
    memoryBytes = 0;
    queueSize = 0;
    constructor(
      readonly world: WorldSession,
      readonly context: WorldContext,
      _plan: unknown,
      edits: VoxelEdit[],
    ) {
      edits.forEach((edit, i) => {
        this.edits.set(i, edit);
      });
    }
    get = (x: number, y: number, z: number) =>
      [...this.edits.values()].find(
        (edit) => edit.x === x && edit.y === y && edit.z === z,
      )?.block ?? (y < 0 ? Block.Stone : Block.Air);
    surface = () => 0;
    lightAt() {
      return 0;
    }
    async requestView() {
      await probe.hold;
      return [];
    }
    async requestCamera(view: WorldPostcard) {
      probe.views.push(view);
      await probe.hold;
      return [];
    }
    hasView() {
      return probe.uploaded;
    }
    async settled() {}
    retain() {
      return [];
    }
    suspendWorkers() {}
    async resumeWorkers() {}
    dispose() {}
  },
}));
vi.mock("../../../client/src/engine/renderer.js", async () => {
  const { IbaraEffects } = await import(
    "../../../client/src/engine/ibara-effects.js"
  );
  const { Plane } = await import("three");
  return {
    WorldRenderer: class {
      camera = { position: { x: 0, y: 10, z: 0 }, fov: 40 };
      statistics = { draws: 0, triangles: 0, memory: 0 };
      effects = { reset() {}, placementActive: () => false };
      ibara = new IbaraEffects(new Plane());
      mode: TerrainViewMode = "normal";
      postcard = false;
      world = 0;
      setViewMode(mode: TerrainViewMode) {
        this.mode = mode;
        probe.modes.push(mode);
      }
      setPostcard(on: boolean) {
        this.postcard = on;
        this.camera.fov = on ? 70 : 40;
      }
      setView(position: { x: number; y: number; z: number }) {
        this.camera.position = { ...position };
      }
      prepareView(
        worldId: number,
        position: { x: number; y: number; z: number },
      ) {
        if (probe.failPreparation) throw new Error("GPU preparation failed");
        const oldPosition = { ...this.camera.position },
          oldWorld = this.world;
        // Match the real offscreen boundary: draw preparation temporarily selects
        // destination effects, then restores source camera and its effect selection.
        try {
          this.setWorld(worldId);
          this.setView(position);
          this.update();
        } finally {
          this.setWorld(oldWorld);
          this.setView(oldPosition);
          this.update();
        }
      }
      pointerRay() {
        return {
          origin: { x: 0, y: 10, z: 0 },
          direction: { x: 0, y: -1, z: 0 },
        };
      }
      setWorld(worldId: number) {
        this.world = worldId;
        this.ibara.register("destination", worldId, [
          { x: 6200, y: 0, z: 6100, phase: 0 },
        ]);
        this.ibara.setWorld(worldId);
      }
      update() {
        this.ibara.setMode(this.mode, this.postcard);
        this.ibara.update(0, Infinity, this.camera.position);
      }
      render() {
        probe.draws.push({
          camera: { ...this.camera.position },
          flames: this.ibara.flames.count,
        });
      }
      upload() {}
      remove() {}
      removeWorld() {}
      compile() {}
      setHud() {}
      dispose() {
        this.ibara.dispose();
      }
      async capturePng() {
        probe.capture++;
        return new Blob();
      }
    },
  };
});

import {
  createGameHandle,
  type GameHandle,
  type GameOptions,
} from "../../../client/src/game/create-game.js";

const handles: GameHandle[] = [];
const camera = (
  identity: WorldIdentity,
  id: "HELL-1" | "HELL-2" = "HELL-1",
): WorldPostcard => ({
  id,
  identity,
  position: { x: 100, y: 1.62, z: 100 },
  target: { x: 140, y: 20, z: 110 },
  hours: 18,
  radius: 128,
});
async function boot(options: Partial<GameOptions> = {}) {
  const game = createGameHandle(
    { style: { removeProperty() {} } } as unknown as HTMLCanvasElement,
    {
      colors: { ink: "#000", steel: "#aaa", cap: "#222" },
      keyboardLocked: () => false,
      onWindowedSprint() {},
      build: { version: "test", commit: "test" },
      cacheTag: "a".repeat(64),
      resolvePostcards: async (identity) => [camera(identity)],
      ...options,
    },
  );
  handles.push(game);
  game.port.apply({ type: "start", seed: 1, worldKind: "main" });
  await game.ready();
  await Promise.resolve();
  return game;
}
beforeEach(() => {
  probe.contexts.length =
    probe.identities.length =
    probe.views.length =
    probe.modes.length =
    probe.edits.length =
      0;
  probe.hold = null;
  probe.uploaded = true;
  probe.failPreparation = false;
  probe.capture = 0;
  probe.draws.length = 0;
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(async () => {
  probe.hold = null;
  await Promise.all(handles.splice(0).map((game) => game.port.dispose()));
  vi.unstubAllGlobals();
});
describe("P8 runtime transaction boundary (GPU and jobs mocked)", () => {
  it("draws real destination flame selection after restoring offscreen source state", async () => {
    const eye = { x: 6200, y: 1.62, z: 6100 };
    const game = await boot({
      resolvePostcards: async (identity) => [
        {
          ...camera(identity),
          position: eye,
          target: { x: 6230, y: 12, z: 6150 },
        },
      ],
    });
    expect(probe.draws.at(-1)?.flames).toBe(0);
    const world = game.port.read().world;
    if (!world) throw new Error("Missing loaded fixture world");
    probe.draws.length = 0;
    expect(
      await game.port.goToPostcard({ sessionId: world.id, id: "HELL-1" }),
    ).toMatchObject({ committed: true });
    expect(game.telemetry().camera.position).toEqual(eye);
    expect(probe.draws.slice(-2)).toEqual([
      { camera: eye, flames: 1 },
      { camera: eye, flames: 1 },
    ]);
  });
  it("decodes primitive into the runtime field and keeps view presentation out of identity", async () => {
    const game = await boot({
      generationVariant: "primitive",
      initialViewMode: "clay",
    });
    const identity = game.port.read().world!.identity;
    expect(identity.generation).toBe(`4:${"a".repeat(64)}:primitive-v1`);
    expect(probe.contexts[0]).toMatchObject({
      kind: "main",
      variant: "primitive",
    });
    expect(probe.modes).toContain("clay");
    game.port.apply({ type: "set-view", value: "features" });
    expect(game.port.read().tools.viewMode).toBe("features");
    expect(game.port.read().world!.identity).toEqual(identity);
  });
  it("travels in an edited world, presents the exact eye, and resumes Overhead at the new body", async () => {
    probe.edits.push({ x: 300, y: 0, z: 300, block: Block.Stone });
    const game = await boot(),
      world = game.port.read().world!;
    expect(
      await game.port.goToPostcard({ sessionId: world.id, id: "HELL-1" }),
    ).toEqual({ sessionId: world.id, committed: true });
    expect(game.telemetry().body).toMatchObject({ x: 100, y: 0, z: 100 });
    expect(game.telemetry().camera.position).toEqual(
      camera(world.identity).position,
    );
    expect(game.telemetry().camera.focus).toEqual(
      camera(world.identity).target,
    );
    expect(game.telemetry().camera.fov).toBe(70);
    expect(game.telemetry().editCount).toBe(1);
    expect(probe.capture).toBe(0);
    game.port.apply({ type: "postcard", active: false });
    await game.ready();
    expect(game.port.read().mode).toBe("overhead");
    expect(game.port.read().activePostcardId).toBeNull();
    expect(game.telemetry().body).toMatchObject({ x: 100, y: 0, z: 100 });
    expect(game.telemetry().camera.fov).toBe(40);
    await expect(game.renderPostcard(camera(world.identity))).rejects.toThrow(
      "unedited",
    );
  });
  it("resolves body clearance against edits without changing the postcard eye", async () => {
    probe.edits.push({ x: 100, y: 0, z: 100, block: Block.Stone });
    const game = await boot(),
      world = game.port.read().world!;
    await game.port.goToPostcard({ sessionId: world.id, id: "HELL-1" });
    expect(game.telemetry().body.y).toBe(1);
    expect(game.telemetry().camera.position.y).toBe(1.62);
  });
  it("lands an aerial postcard body safely instead of leaving a nonflying body in the air", async () => {
    const game = await boot({
      resolvePostcards: async (identity) => [
        { ...camera(identity), position: { x: 100, y: 101.62, z: 100 } },
      ],
    });
    const world = game.port.read().world!;
    await game.port.goToPostcard({ sessionId: world.id, id: "HELL-1" });
    expect(game.telemetry().body).toMatchObject({ y: 0, flying: false });
    expect(game.telemetry().camera.position.y).toBe(101.62);
  });
  it("keeps the TEST world production even when the main-world primitive URL option is set", async () => {
    const game = await boot({ generationVariant: "primitive" });
    game.port.apply({ type: "start", seed: 1, worldKind: "test" });
    await game.ready();
    expect(game.port.read().world!.identity).toMatchObject({
      kind: "test",
      generation: `4:${"a".repeat(64)}`,
    });
    expect(probe.contexts.at(-1)).toEqual({ kind: "test", seed: 1 });
  });
  it("does not publish a body before readiness or after cancellation/quit", async () => {
    const game = await boot(),
      world = game.port.read().world!;
    let release!: () => void;
    probe.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const travel = game.port.goToPostcard({
      sessionId: world.id,
      id: "HELL-1",
    });
    await Promise.resolve();
    expect(game.telemetry().body.x).toBe(0);
    expect(
      await game.port.goToPostcard({ sessionId: world.id, id: "HELL-2" }),
    ).toMatchObject({ committed: false });
    game.port.apply({ type: "quit" });
    release();
    expect(await travel).toMatchObject({ committed: false });
    await game.ready();
    expect(game.port.read().world).toBeNull();
  });
  it("rejects stale/unknown selection and preserves the body on failed GPU preparation", async () => {
    const game = await boot(),
      world = game.port.read().world!;
    expect(
      await game.port.goToPostcard({ sessionId: world.id + 1, id: "HELL-1" }),
    ).toMatchObject({ committed: false });
    expect(
      await game.port.goToPostcard({ sessionId: world.id, id: "HELL-2" }),
    ).toMatchObject({ committed: false });
    probe.failPreparation = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      game.port.goToPostcard({ sessionId: world.id, id: "HELL-1" }),
    ).rejects.toThrow("GPU preparation");
    expect(game.telemetry().body.x).toBe(0);
    log.mockRestore();
  });
  it("discards a delayed catalogue from the previous loaded world", async () => {
    let release!: (views: readonly WorldPostcard[]) => void;
    let old!: WorldIdentity;
    const game = await boot({
      resolvePostcards: (identity) => {
        if (identity.seed === 1) {
          old = identity;
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        return Promise.resolve([camera(identity, "HELL-2")]);
      },
    });
    expect(game.port.read().postcards).toEqual([]);
    game.port.apply({ type: "start", seed: 2, worldKind: "main" });
    await game.ready();
    release([camera(old)]);
    await Promise.resolve();
    expect(game.port.read().postcards.map((item) => item.id)).toEqual([
      "HELL-2",
    ]);
  });
});
