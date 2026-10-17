import { describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../client/src/contracts/game-ui.js";
import {
  type FarSelectionNode,
  type FarSelectionPlan,
  farTileBounds,
} from "../../client/src/engine/far-terrain-selection.js";
import {
  type FarGenerationRequest,
  type FarGenerationResult,
  FarTerrainStore,
  type FarVisibleTile,
} from "../../client/src/engine/far-terrain-store.js";
import { packFarTileKey } from "../src/worldgen/far/coordinates.js";
import type { FarMeshPart, FarTileAddress } from "../src/worldgen/far/types.js";

const world: WorldSession = {
  id: 12,
  identity: { kind: "test", seed: 3, generation: "test-generation" },
};

function node(
  address: FarTileAddress,
  children: readonly FarSelectionNode[] = [],
): FarSelectionNode {
  return {
    address,
    key: packFarTileKey(address),
    bounds: farTileBounds(address),
    distance: 1000,
    errorPixels: 5,
    children,
  };
}

function plan(roots: readonly FarSelectionNode[]): FarSelectionPlan {
  const requests: FarSelectionNode[] = [];
  const leaves: FarSelectionNode[] = [];
  const refined = new Set<number>();
  const visit = (entry: FarSelectionNode) => {
    requests.push(entry);
    if (entry.children.length) {
      refined.add(entry.key);
      entry.children.forEach(visit);
    } else leaves.push(entry);
  };
  roots.forEach(visit);
  return { layer: "surface", roots, requests, leaves, refined };
}

function part(nonempty = false): FarMeshPart {
  return {
    positions: new Float32Array(
      nonempty ? [0, 1536, 0, 4, 1536, 0, 0, 1536, 4] : [],
    ),
    normals: new Float32Array(nonempty ? [0, 1, 0, 0, 1, 0, 0, 1, 0] : []),
    expansions: new Int8Array(nonempty ? 9 : 0),
    surfaces: new Float32Array(
      nonempty ? [1, 3, 61440, 1, 3, 61440, 1, 3, 61440] : [],
    ),
    featureIdParts: new Uint16Array(nonempty ? 6 : 0),
    indices: new Uint32Array(nonempty ? [0, 1, 2] : []),
  };
}

function result(request: FarGenerationRequest): FarGenerationResult {
  const statistics = {
    densityCalls: 0,
    columns: 1156,
    runs: 0,
    quads: 1,
    skirtQuads: 0,
    typedArrayBytes: 0,
  };
  return {
    ...request,
    runs: {
      address: request.address,
      layer: request.layer,
      revision: request.revision,
      offsets: new Uint32Array(1157),
      words: new Uint32Array(),
      statistics,
    },
    mesh: {
      parts: [part(true), part(), part(), part(), part()],
      skirts: Array.from({ length: 4 }, () =>
        Array.from({ length: 5 }, () => part()),
      ),
      quads: 1,
      statistics,
    },
  };
}

function fixture() {
  const unavailable = new Set<number>();
  const drawn: number[][] = [];
  const released: number[] = [];
  let serial = 0;
  const request = vi.fn(async (value: FarGenerationRequest) => {
    if (unavailable.has(packFarTileKey(value.address)))
      throw new Error("Far densityCalls capacity exceeded");
    return result(value);
  });
  const store = new FarTerrainStore<number>(
    world,
    "surface",
    { request, cancel() {} },
    {
      begin: () => ({
        partCount: 1,
        uploadPart() {},
        prepare: () => ++serial,
        cancel() {},
      }),
      commit(tiles: readonly FarVisibleTile<number>[]) {
        drawn.push(tiles.map((tile) => tile.handle));
      },
      release(handle) {
        released.push(handle);
      },
    },
  );
  const children = [
    node({ tx: 0, tz: 0, lod: 2 }),
    node({ tx: 1, tz: 0, lod: 2 }),
    node({ tx: 0, tz: 1, lod: 2 }),
    node({ tx: 1, tz: 1, lod: 2 }),
  ];
  const parent = node({ tx: 0, tz: 0, lod: 3 });
  const fine = plan([{ ...parent, children }]);
  return {
    store,
    unavailable,
    request,
    drawn,
    released,
    children,
    parent,
    fine,
  };
}

// Author-only lifecycle guards; root executes these with the independent witness.
describe("far retained coverage progress", () => {
  it("draws cold roots incrementally while another root is unavailable", async () => {
    const { store, unavailable } = fixture();
    const a = node({ tx: -4, tz: 0, lod: 3 });
    const b = node({ tx: 0, tz: 0, lod: 3 });
    const c = node({ tx: 4, tz: 0, lod: 3 });
    unavailable.add(b.key);
    try {
      await store.requestPlan(plan([a, b]));
      store.drainUploads(8);
      expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual([
        a.key,
      ]);
      expect(store.status.ready).toBe(false);

      await store.requestPlan(plan([a, b, c]));
      store.drainUploads(8);
      expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual([
        a.key,
        c.key,
      ]);
      expect(store.status.ready).toBe(false);

      unavailable.delete(b.key);
      store.retryFailures();
      await store.requestPlan(plan([a, b, c]));
      store.drainUploads(8);
      expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual([
        a.key,
        b.key,
        c.key,
      ]);
      expect(store.status.ready).toBe(true);
    } finally {
      store.dispose();
    }
  });

  it("advances other roots, retains stale children, and releases them only after parent recovery", async () => {
    const {
      store,
      unavailable,
      request,
      drawn,
      released,
      children,
      parent,
      fine,
    } = fixture();
    const other = node({ tx: 2, tz: 0, lod: 3 });
    const target = plan([parent, other]);
    unavailable.add(parent.key);
    try {
      await store.requestPlan(fine);
      store.drainUploads(8);
      store.commitVisible();
      const oldHandles = [...(drawn.at(-1) ?? [])];
      expect(oldHandles).toHaveLength(4);

      await store.requestPlan(target);
      store.drainUploads(8);
      const fallback = store.commitVisible();
      store.retainPlan();
      expect(fallback.tiles.map((tile) => tile.key)).toEqual([
        ...children.map((child) => child.key),
        other.key,
      ]);
      expect(fallback.atTarget).toBe(false);
      expect(store.status.ready).toBe(false);
      expect(drawn.at(-1)).toHaveLength(5);
      expect(released).toEqual([]);
      const attempts = request.mock.calls.length;
      await store.requestPlan(target);
      expect(request).toHaveBeenCalledTimes(attempts);

      store.invalidateEdit({ x: 64, y: 20, z: 64 });
      await store.requestPlan(target);
      expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual(
        fallback.tiles.map((tile) => tile.key),
      );
      store.retainPlan();
      expect(store.status.ready).toBe(false);
      expect(released).toEqual([]);

      unavailable.delete(parent.key);
      store.retryFailures();
      await store.requestPlan(target);
      store.drainUploads(8);
      expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual([
        parent.key,
        other.key,
      ]);
      expect(drawn.at(-1)).toHaveLength(2);
      expect(released).toEqual([]);
      expect(store.status.ready).toBe(true);
      store.retainPlan();
      expect(released).toEqual(oldHandles);
    } finally {
      store.dispose();
    }
  });

  it.each(["empty", "another root"] as const)(
    "releases retained coverage when the next view is %s",
    async (destination) => {
      const { store, unavailable, released, parent, fine } = fixture();
      unavailable.add(parent.key);
      try {
        await store.requestPlan(fine);
        store.drainUploads(8);
        store.commitVisible();
        await store.requestPlan(plan([parent]));
        expect(store.commitVisible().tiles).toHaveLength(4);
        store.retainPlan();
        expect(released).toEqual([]);

        const roots =
          destination === "empty" ? [] : [node({ tx: 4, tz: 0, lod: 3 })];
        await store.requestPlan(plan(roots));
        store.drainUploads(8);
        expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual(
          roots.map((root) => root.key),
        );
        store.retainPlan();
        expect(released).toHaveLength(4);
        expect(store.status.ready).toBe(true);
      } finally {
        store.dispose();
      }
    },
  );
});
