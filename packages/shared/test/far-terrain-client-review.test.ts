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
} from "../../client/src/engine/far-terrain-store.js";
import { packFarTileKey } from "../src/worldgen/far/coordinates.js";
import type { FarMeshPart, FarTileAddress } from "../src/worldgen/far/types.js";

function node(address: FarTileAddress): FarSelectionNode {
  return {
    address,
    key: packFarTileKey(address),
    bounds: farTileBounds(address),
    distance: 1000,
    errorPixels: 5,
    children: [],
  };
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

describe("far client review regression", () => {
  it("retains drawn children when coarsening to an unavailable parent", async () => {
    const world: WorldSession = {
      id: 12,
      identity: { kind: "test", seed: 3, generation: "test-generation" },
    };
    const children = [
      node({ tx: 0, tz: 0, lod: 2 }),
      node({ tx: 1, tz: 0, lod: 2 }),
      node({ tx: 0, tz: 1, lod: 2 }),
      node({ tx: 1, tz: 1, lod: 2 }),
    ];
    const parent = node({ tx: 0, tz: 0, lod: 3 });
    const branch = { ...parent, children };
    const fine: FarSelectionPlan = {
      layer: "surface",
      roots: [branch],
      requests: [branch, ...children],
      leaves: children,
      refined: new Set([parent.key]),
    };
    const coarse: FarSelectionPlan = {
      layer: "surface",
      roots: [parent],
      requests: [parent],
      leaves: [parent],
      refined: new Set(),
    };
    const commit = vi.fn();
    const release = vi.fn();
    let serial = 0;
    const store = new FarTerrainStore<number>(
      world,
      "surface",
      {
        async request(request) {
          if (request.address.lod === 3)
            throw new Error("Far densityCalls capacity exceeded");
          return result(request);
        },
        cancel() {},
      },
      {
        begin: () => ({
          partCount: 1,
          uploadPart() {},
          prepare: () => ++serial,
          cancel() {},
        }),
        commit,
        release,
      },
    );
    try {
      await store.requestPlan(fine);
      store.drainUploads(8);
      const previous = store.commitVisible();
      expect(previous.tiles.map((tile) => tile.key)).toEqual(
        children.map((child) => child.key),
      );
      expect(store.status.ready).toBe(true);

      await store.requestPlan(coarse);
      const replacement = store.commitVisible();
      store.retainPlan();

      expect(replacement.tiles.map((tile) => tile.key)).toEqual(
        previous.tiles.map((tile) => tile.key),
      );
      expect(store.status.ready).toBe(false);
      expect(commit.mock.calls.at(-1)?.[0]).toHaveLength(4);
      expect(release).not.toHaveBeenCalled();
    } finally {
      store.dispose();
    }
  });
});
