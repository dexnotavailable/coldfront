import { MeshLambertMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../client/src/contracts/game-ui.js";
import { FarTerrainRenderer } from "../../client/src/engine/far-terrain-renderer.js";
import {
  type FarSelectionNode,
  type FarSelectionPlan,
  farTileBounds,
} from "../../client/src/engine/far-terrain-selection.js";
import {
  type FarGenerationRequest,
  type FarGenerationResult,
  type FarScheduler,
  FarTerrainStore,
  type FarUploadAdapter,
} from "../../client/src/engine/far-terrain-store.js";
import { packFarTileKey } from "../src/worldgen/far/coordinates.js";
import type {
  FarMeshPart,
  FarStatistics,
  FarTileAddress,
} from "../src/worldgen/far/types.js";

const world: WorldSession = {
  id: 12,
  identity: { kind: "test", seed: 3, generation: "test-generation" },
};
const statistics: FarStatistics = {
  densityCalls: 0,
  columns: 1156,
  runs: 0,
  quads: 0,
  skirtQuads: 0,
  typedArrayBytes: 0,
};
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
function result(
  request: FarGenerationRequest,
  nonempty = true,
): FarGenerationResult {
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
      parts: [part(nonempty), part(), part(), part(), part()],
      skirts: Array.from({ length: 4 }, () =>
        Array.from({ length: 5 }, () => part()),
      ),
      quads: nonempty ? 1 : 0,
      statistics,
    },
  };
}
function node(
  address: FarTileAddress,
  children: FarSelectionNode[] = [],
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
function plans(): {
  coarse: FarSelectionPlan;
  fine: FarSelectionPlan;
  children: FarSelectionNode[];
} {
  const children = [
    node({ tx: 0, tz: 0, lod: 2 }),
    node({ tx: 1, tz: 0, lod: 2 }),
    node({ tx: 0, tz: 1, lod: 2 }),
    node({ tx: 1, tz: 1, lod: 2 }),
  ];
  const parent = node({ tx: 0, tz: 0, lod: 3 });
  const coarse: FarSelectionPlan = {
    layer: "surface",
    roots: [parent],
    requests: [parent],
    leaves: [parent],
    refined: new Set(),
  };
  const branch = { ...parent, children };
  return {
    coarse,
    children,
    fine: {
      layer: "surface",
      roots: [branch],
      requests: [branch, ...children],
      leaves: children,
      refined: new Set([parent.key]),
    },
  };
}
function scheduler() {
  const jobs: {
    request: FarGenerationRequest;
    resolve(value: FarGenerationResult): void;
    reject(error: Error): void;
  }[] = [];
  const cancel = vi.fn();
  const api: FarScheduler = {
    request: (request) =>
      new Promise((resolve, reject) => jobs.push({ request, resolve, reject })),
    cancel,
  };
  return { api, jobs, cancel };
}
function uploads() {
  let serial = 0;
  const prepare = vi.fn();
  const release = vi.fn();
  const commit = vi.fn();
  const api: FarUploadAdapter<number> = {
    begin: (value) => {
      const count = value.mesh.parts.filter((p) => p.indices.length).length;
      let uploaded = 0;
      return {
        partCount: count,
        uploadPart: () => {
          uploaded++;
        },
        prepare: () => {
          if (uploaded !== count) throw new Error("Part missing");
          prepare();
          return ++serial;
        },
        cancel: vi.fn(),
      };
    },
    release,
    commit,
  };
  return { api, prepare, release, commit };
}
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("far store lifecycle (injected worker and GPU boundaries)", () => {
  it("retains the parent through partial upload, and counts an empty child as ready", async () => {
    const work = scheduler();
    const gpu = uploads();
    const { coarse, fine } = plans();
    const store = new FarTerrainStore(world, "surface", work.api, gpu.api);
    const first = store.requestPlan(coarse);
    const parentJob = work.jobs[0];
    if (!parentJob) throw new Error("Missing parent request");
    parentJob.resolve(result(parentJob.request));
    await first;
    expect(store.status.ready).toBe(false);
    expect(store.drainUploads(1)).toBe(1);
    const parent = store.commitVisible().tiles[0]?.key;
    const second = store.requestPlan(fine);
    for (const [index, job] of work.jobs.slice(1).entries())
      job.resolve(result(job.request, index !== 3));
    await second;
    expect(store.drainUploads(2)).toBe(2);
    expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual([
      parent,
    ]);
    expect(store.drainUploads(1)).toBe(1);
    expect(store.commitVisible().tiles).toHaveLength(4);
    expect(store.status.ready).toBe(true);
    expect(gpu.prepare).toHaveBeenCalledTimes(5);
    store.dispose();
    expect(gpu.release).toHaveBeenCalledTimes(5);
  });
  it("rejects an edited in-flight result and accepts only the new revision", async () => {
    const work = scheduler();
    const gpu = uploads();
    const { coarse } = plans();
    const store = new FarTerrainStore(world, "surface", work.api, gpu.api);
    const pending = store.requestPlan(coarse);
    const old = work.jobs[0];
    if (!old) throw new Error("Missing old request");
    store.invalidateEdit({ x: 0, y: 20, z: 0 });
    const replacement = store.requestPlan(coarse);
    const fresh = work.jobs[1];
    if (!fresh) throw new Error("Missing new request");
    expect(fresh.request.revision).toBe(1);
    old.resolve(result(old.request));
    await pending;
    expect(store.drainUploads(8)).toBe(0);
    fresh.resolve(result(fresh.request));
    await replacement;
    store.drainUploads(8);
    store.commitVisible();
    expect(store.status.ready).toBe(true);
    expect(work.cancel).toHaveBeenCalledWith(old.request.id);
    store.dispose();
  });
  it.each(["world", "layer"] as const)(
    "rejects a mismatched %s result",
    async (mismatch) => {
      const work = scheduler();
      const gpu = uploads();
      const { coarse } = plans();
      const store = new FarTerrainStore(world, "surface", work.api, gpu.api);
      const pending = store.requestPlan(coarse);
      const job = work.jobs[0];
      if (!job) throw new Error("Missing request");
      const value = result(job.request);
      job.resolve(
        mismatch === "world"
          ? { ...value, world: { ...world, id: 99 } }
          : { ...value, layer: "upper_deep" },
      );
      await pending;
      expect(store.status.failed).toBe(1);
      expect(store.drainUploads(8)).toBe(0);
      store.dispose();
    },
  );
  it("keeps a prepared ancestor on capacity failure and does not retry every frame", async () => {
    const work = scheduler();
    const gpu = uploads();
    const { coarse, fine } = plans();
    const store = new FarTerrainStore(world, "surface", work.api, gpu.api);
    const pending = store.requestPlan(coarse);
    const first = work.jobs[0];
    if (!first) throw new Error("Missing request");
    first.resolve(result(first.request));
    await pending;
    store.drainUploads(8);
    const previous = store.commitVisible().tiles;
    const refined = store.requestPlan(fine);
    for (const [index, job] of work.jobs.slice(1).entries())
      if (index === 0)
        job.reject(new Error("Far densityCalls capacity exceeded"));
      else job.resolve(result(job.request));
    await refined;
    store.drainUploads(8);
    expect(store.commitVisible().tiles.map((tile) => tile.key)).toEqual(
      previous.map((tile) => tile.key),
    );
    expect(store.status.ready).toBe(false);
    await store.requestPlan(fine);
    expect(work.jobs).toHaveLength(5);
    store.dispose();
  });
  it("does not resurrect cancelled out-of-view work or expose unprepared context data", async () => {
    const work = scheduler();
    const gpu = uploads();
    const { coarse } = plans();
    const store = new FarTerrainStore(world, "surface", work.api, gpu.api);
    const pending = store.requestPlan(coarse);
    const job = work.jobs[0];
    if (!job) throw new Error("Missing request");
    store.setPlan({
      layer: "surface",
      roots: [],
      requests: [],
      leaves: [],
      refined: new Set(),
    });
    store.commitVisible();
    store.retainPlan();
    job.resolve(result(job.request));
    await pending;
    expect(store.drainUploads(8)).toBe(0);
    store.contextLost();
    expect(store.status.ready).toBe(false);
    store.contextRestored();
    await settle();
    store.dispose();
  });
});

describe("far batch owner CPU lifecycle (no GPU proof)", () => {
  it("packs the real attribute ABI, rebases, recreates context data and releases ownership", () => {
    const materials = Array.from(
      { length: 5 },
      () => new MeshLambertMaterial(),
    );
    const prepareGpu = vi.fn(); // Explicit test double, not a rendered acceptance.
    const renderer = new FarTerrainRenderer({
      materials,
      prepareGpu,
      pageVertices: 16,
      pageIndices: 24,
      pageInstances: 4,
    });
    const value = result({
      id: 1,
      world,
      address: { tx: -1, tz: 0, lod: 2 },
      layer: "surface",
      revision: 0,
      priority: 0,
      postcard: false,
    });
    const ticket = renderer.begin(value);
    ticket.uploadPart(0);
    const handle = ticket.prepare();
    renderer.commit([{ handle, skirts: 15 }]);
    expect(renderer.statistics(false).submissionUpperBound).toBe(1);
    const batch = renderer.group.children[0];
    expect(batch?.type).toBe("Mesh");
    renderer.setOrigin(-1024, 0, 0);
    expect(batch?.position.x).toBe(-1024);
    renderer.contextLost();
    expect(renderer.group.children).toHaveLength(0);
    expect(renderer.restoreContext(0).ready).toBe(false);
    expect(renderer.restoreContext(1)).toEqual({
      parts: 1,
      remaining: 0,
      ready: true,
    });
    expect(prepareGpu).toHaveBeenCalledTimes(2);
    expect(renderer.statistics(false).visibleParts).toBe(1);
    renderer.release(handle);
    expect(renderer.group.children).toHaveLength(0);
    expect(renderer.statistics(false).runBytes).toBe(0);
    renderer.dispose();
    materials.forEach((material) => {
      material.dispose();
    });
  });
  it("does not pretend one Firefox batch equals one draw for multiple visible parts", () => {
    const materials = Array.from(
      { length: 5 },
      () => new MeshLambertMaterial(),
    );
    const renderer = new FarTerrainRenderer({
      materials,
      prepareGpu: () => {},
      pageVertices: 16,
      pageIndices: 24,
    });
    const handles = [0, 1].map((tx) => {
      const ticket = renderer.begin(
        result({
          id: tx + 1,
          world,
          address: { tx, tz: 0, lod: 2 },
          layer: "surface",
          revision: 0,
          priority: 0,
          postcard: false,
        }),
      );
      ticket.uploadPart(0);
      return ticket.prepare();
    });
    renderer.commit(handles.map((handle) => ({ handle, skirts: 15 })));
    expect(renderer.statistics(false).submissionUpperBound).toBe(2);
    expect(renderer.statistics(true).submissionUpperBound).toBe(1);
    renderer.dispose();
    materials.forEach((material) => {
      material.dispose();
    });
  });
});
