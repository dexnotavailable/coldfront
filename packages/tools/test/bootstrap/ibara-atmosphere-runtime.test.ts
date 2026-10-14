import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
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
  renderer: null as
    | import("../../../client/src/engine/renderer.js").WorldRenderer
    | null,
  snapshot: null as (() => { skyWeight: number }) | null,
  preparedWeights: [] as number[],
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
      surfaceWeights(
        x: number,
        _z: number,
        out: import("../../../shared/src/world/types.js").RegionWeights,
      ) {
        out.count = 1;
        out.ids[0] = 9;
        out.weights[0] = options.seed === 3 ? 0.4 : x > 50 ? options.seed : 0;
        return out;
      },
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

// Actual renderer atmosphere methods, with only GPU/effects seams replaced.
// The runtime itself decides which candidate/store to propagate and when.
vi.mock("../../../client/src/engine/renderer.js", async (importOriginal) => {
  const { WorldRenderer } =
    await importOriginal<
      typeof import("../../../client/src/engine/renderer.js")
    >();
  const { createAtmosphereRenderer } = await import(
    "./ibara-atmosphere-fixture.js"
  );
  return {
    WorldRenderer: function RendererFixture() {
      const f = createAtmosphereRenderer(WorldRenderer);
      probe.renderer = f.renderer;
      probe.snapshot = f.snapshot;
      Object.defineProperty(f.renderer, "statistics", {
        get: () => ({ draws: 0, triangles: 0, memory: 0 }),
      });
      f.renderer.render = () => {};
      f.renderer.renderer.render = () => {
        probe.preparedWeights.push(f.snapshot().skyWeight);
        if (probe.failPreparation) throw new Error("GPU preparation failed");
      };
      f.renderer.effects.placementActive = () => false;
      f.renderer.effects.reset = () => {};
      f.renderer.upload = () => {};
      f.renderer.pointerRay = () => ({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
      });
      f.renderer.dispose = () => f.atmosphere.clear();
      return f.renderer;
    },
  };
});

import {
  createGameHandle,
  type GameHandle,
} from "../../../client/src/game/create-game.js";

const handles: GameHandle[] = [];
async function boot(seed = 1) {
  const game = createGameHandle(
    { style: { removeProperty() {} } } as unknown as HTMLCanvasElement,
    {
      colors: { ink: "#000", steel: "#aaa", cap: "#222" },
      keyboardLocked: () => false,
      onWindowedSprint() {},
      build: { version: "test", commit: "test" },
      cacheTag: "a".repeat(64),
      resolvePostcards: async (identity) => [
        {
          id: "HELL-1",
          identity,
          position: { x: 100, y: 1.62, z: 100 },
          target: { x: 140, y: 20, z: 110 },
          hours: 17.25,
          radius: 128,
        },
      ],
    },
  );
  handles.push(game);
  game.port.apply({ type: "start", seed, worldKind: "main" });
  await game.ready();
  await Promise.resolve();
  return game;
}
beforeEach(() => {
  probe.contexts.length = probe.identities.length = probe.edits.length = 0;
  probe.renderer = null;
  probe.snapshot = null;
  probe.preparedWeights.length = 0;
  probe.failPreparation = false;
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("localStorage", { getItem: () => null, setItem() {} });
});
afterEach(async () => {
  for (const game of handles.splice(0)) await game.port.dispose();
  vi.unstubAllGlobals();
});
describe("runtime atmosphere propagation through existing travel/restore callbacks", () => {
  it.each(["new-world", "same-world", "same-world-success"] as const)(
    "preserves partial source air through actual %s travel",
    async (kind) => {
      const game = await boot();
      if (!probe.renderer) throw new Error("missing ready fixture");
      const runtime = game.port as unknown as {
        camera: {
          position: { x: number; y: number; z: number };
          focus: { x: number; y: number; z: number };
        };
        clocks: { displayMs: number };
        updatePicture(alpha: number): void;
      };
      Object.assign(runtime.camera.position, { x: 100, y: 40, z: 0 });
      probe.renderer.setView(runtime.camera.position, runtime.camera.focus);
      runtime.clocks.displayMs = 650;
      runtime.updatePicture(1);
      const before = probe.snapshot?.();
      expect(before?.skyWeight).toBeCloseTo(1 - Math.exp(-1), 12);
      probe.failPreparation = kind !== "same-world-success";
      const warning = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        if (kind === "new-world") {
          game.port.apply({ type: "start", seed: 2, worldKind: "test" });
          await game.ready();
        } else {
          const world = game.port.read().world;
          if (!world) throw new Error("missing world");
          const travel = game.port.goToPostcard({
            sessionId: world.id,
            id: "HELL-1",
          });
          if (kind === "same-world-success") {
            expect(await travel).toMatchObject({ committed: true });
            expect(probe.snapshot?.().skyWeight).toBe(1);
            probe.renderer.onLost();
            probe.renderer.onRestored();
            expect(probe.snapshot?.().skyWeight).toBe(1);
            return;
          }
          await expect(travel).rejects.toThrow("GPU preparation failed");
        }
        expect(probe.snapshot?.()).toEqual(before);
        runtime.clocks.displayMs = 666;
        runtime.updatePicture(1);
        expect(probe.snapshot?.().skyWeight).toBeCloseTo(
          1 - Math.exp(-666 / 650),
          12,
        );
      } finally {
        warning.mockRestore();
      }
    },
  );
  it("registers initial candidate air before its very first offscreen draw", async () => {
    await boot(3);
    expect(probe.preparedWeights.length).toBeGreaterThan(0);
    expect(probe.preparedWeights.every((weight) => weight === 0.4)).toBe(true);
    expect(probe.snapshot?.().skyWeight).toBe(0.4);
  });
  it("uses the final postcard eye and retains the actual context/pose after graphics restoration", async () => {
    const game = await boot(),
      world = game.port.read().world;
    if (!world || !probe.renderer) throw new Error("missing ready fixture");
    expect(probe.snapshot?.().skyWeight).toBe(0);
    expect(
      await game.port.goToPostcard({ sessionId: world.id, id: "HELL-1" }),
    ).toMatchObject({ committed: true });
    expect(probe.snapshot?.().skyWeight).toBe(1);
    const eye = { ...probe.renderer.camera.position };
    probe.renderer.onLost();
    probe.renderer.onRestored();
    expect(probe.snapshot?.().skyWeight).toBe(1);
    expect({ ...probe.renderer.camera.position }).toEqual(eye);
  });
  it.each([false, true])(
    "registers the new world before prewarm and restores the old context when it fails (failure=%s)",
    async (fail) => {
      const game = await boot(),
        world = game.port.read().world;
      if (!world) throw new Error("missing ready fixture");
      await game.port.goToPostcard({ sessionId: world.id, id: "HELL-1" });
      expect(probe.snapshot?.().skyWeight).toBe(1);
      probe.failPreparation = fail;
      const warning = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        game.port.apply({ type: "start", seed: 2, worldKind: "test" });
        await game.ready();
        expect(probe.snapshot?.().skyWeight).toBe(fail ? 1 : 0);
        if (!fail) expect(game.port.read().world?.identity.kind).toBe("test");
        probe.renderer?.onRestored();
        expect(probe.snapshot?.().skyWeight).toBe(fail ? 1 : 0);
      } finally {
        warning.mockRestore();
      }
    },
  );
});
