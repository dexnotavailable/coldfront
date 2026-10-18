import { describe, expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import {
  type FarTileResult,
  farTransfers,
  type WorkerRequest,
  type WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import type { LayerId, WorldContext } from "../../../shared/src/world/types.js";
import { readFarRun } from "../../../shared/src/worldgen/far/columns.js";
import { farColumnIndex } from "../../../shared/src/worldgen/far/coordinates.js";
import {
  type FarAreaSampler,
  FarCapacityError,
  type FarMeshPart,
  type FarStatistics,
  type FarTileMesh,
  type FarTileRuns,
} from "../../../shared/src/worldgen/far/types.js";

const world: WorldSession = {
  id: 7,
  identity: { kind: "test", seed: 1, generation: "4:fixture" },
};
const emptyStatistics: FarStatistics = {
  densityCalls: 0,
  columns: 0,
  runs: 0,
  quads: 0,
  skirtQuads: 0,
  typedArrayBytes: 0,
};
function runsAt(tile: FarTileRuns, x = 0, z = 0) {
  const ci = farColumnIndex(x, z);
  return Array.from(
    { length: Number(tile.offsets[ci + 1]) - Number(tile.offsets[ci]) },
    (_, i) => readFarRun(tile, Number(tile.offsets[ci]) + i),
  );
}
describe("far worker generation and ownership", () => {
  it("transfers aliased run/mesh views exactly once without touching unrelated buffers", () => {
    const indices = new Uint32Array([0, 1, 2]),
      surfaces = new Float32Array([1, 2, 3]);
    const part: FarMeshPart = {
      positions: surfaces,
      normals: surfaces.subarray(0),
      expansions: new Int8Array([1, 0, 0]),
      surfaces,
      featureIdParts: new Uint16Array([0xabcd, 0xef98]),
      indices,
    };
    const runs: FarTileRuns = {
      address: { tx: 0, tz: 0, lod: 2 },
      layer: "surface",
      revision: 3,
      offsets: indices,
      words: indices.subarray(0),
      statistics: emptyStatistics,
    };
    const mesh: FarTileMesh = {
      parts: [part],
      skirts: [[part]],
      quads: 1,
      statistics: emptyStatistics,
    };
    const plan = new Float64Array([12, 34]),
      nearCache = new Uint16Array([7, 8]);
    const transfer = farTransfers(runs, mesh);
    expect(transfer).toHaveLength(4);
    expect(new Set(transfer).size).toBe(transfer.length);
    expect(transfer).not.toContain(plan.buffer);
    expect(transfer).not.toContain(nearCache.buffer);
    const copy = structuredClone({ runs, mesh }, { transfer });
    expect(indices.byteLength).toBe(0);
    expect(surfaces.byteLength).toBe(0);
    expect(copy.mesh.parts[0]?.featureIdParts).toEqual(
      new Uint16Array([0xabcd, 0xef98]),
    );
    expect(copy.runs.words.buffer).toBe(copy.mesh.parts[0]?.indices.buffer);
    expect(plan).toEqual(new Float64Array([12, 34]));
    expect(nearCache).toEqual(new Uint16Array([7, 8]));
  });
  it("runs the real far generator and mesher with initial edits, broadcasts, revisions and session reset", async () => {
    // Only context creation is replaced: a bounded 8m rock slab exercises the
    // real worker, FarEditIndex, column generator, mesher and transferable path.
    const messages: WorkerResponse[] = [],
      detached: ArrayBuffer[][] = [],
      layers: LayerId[] = [];
    const columnArrays: Float64Array[] = [];
    let failCapacity = false;
    const area: FarAreaSampler = {
      columns: {
        stride: 1,
        height: 0,
        gradientX: 0,
        gradientZ: 0,
        waterLevel: 0,
      },
      featureBounds: [],
      createColumn: () => {
        const values = new Float64Array(1),
          terrainValues = new Float64Array(1);
        columnArrays.push(values, terrainValues);
        return {
          values,
          terrainValues,
          heightDelta: 0,
          canopyTop: -Infinity,
          minY: -8,
          maxY: 16,
          certifiedBase: true,
          fluids: [],
        };
      },
      sampleColumn: (_x, _z, out) => out,
      sampleVoxel: (_x, y, _z, out) => {
        out.density = Math.min(y, 8 - y);
        out.block = out.density > 0 ? Block.Stone : Block.Air;
        out.fluid = Block.Air;
        out.featureId = out.density > 0 ? 0xfedcba98 : 0;
        out.featureT = 0;
        return out;
      },
      baseRuns: () => [],
    };
    const context = {
      regions: [],
      prepareFarArea: (_bounds: unknown, options: { layer: LayerId }) => {
        layers.push(options.layer);
        if (failCapacity)
          throw new FarCapacityError("runs", 12, {
            ...emptyStatistics,
            runs: 12,
          });
        return area;
      },
      prepareArea: () => {
        throw new Error("Far request entered near lighting path");
      },
    } as unknown as WorldContext;
    vi.doMock("../../../shared/src/world/world-context.js", () => ({
      createWorldContext: () => context,
    }));
    const worker = {
      onmessage: null as ((event: MessageEvent<WorkerRequest>) => void) | null,
      postMessage: (
        message: WorkerResponse,
        options?: { transfer: ArrayBuffer[] },
      ) => {
        if (options) {
          expect(new Set(options.transfer).size).toBe(options.transfer.length);
          detached.push(options.transfer);
        }
        messages.push(structuredClone(message, options));
      },
    };
    vi.stubGlobal("self", worker);
    try {
      await import("../../../client/src/engine/terrain-worker.js");
      const send = (message: WorkerRequest) =>
        worker.onmessage?.({ data: message } as MessageEvent<WorkerRequest>);
      const edit = { x: 1, y: 20, z: 1, block: Block.StoneBricks };
      send({ type: "init", world, plan: null, edits: [edit] });
      expect(messages.at(-1)).toEqual({ type: "ready", world });
      let serial = 0;
      const generate = (
        revision: number,
        session = world,
        layer: LayerId = "surface",
      ): FarTileResult => {
        const id = ++serial;
        send({
          type: "far",
          id,
          world: session,
          address: { tx: 0, tz: 0, lod: 2 },
          layer,
          revision,
          priority: 3,
          postcard: true,
        });
        const result = messages.at(-1);
        if (result?.type !== "far") throw new Error(JSON.stringify(result));
        expect(result).toMatchObject({
          world: session,
          id,
          layer,
          revision,
          address: { tx: 0, tz: 0, lod: 2 },
        });
        expect(result.runs).toMatchObject({
          layer,
          revision,
          address: result.address,
        });
        return result;
      };
      const first = generate(0);
      expect(runsAt(first.runs)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            bottom: 0,
            top: 8,
            block: Block.Stone,
            featureId: 0xfedcba98,
          }),
          expect.objectContaining({
            bottom: 20,
            top: 21,
            block: Block.StoneBricks,
            featureId: 0,
          }),
        ]),
      );
      expect(first.mesh.quads).toBeGreaterThan(0);
      expect(first.mesh.parts[0]?.featureIdParts).toContain(0xba98);
      expect(first.mesh.parts[0]?.featureIdParts).toContain(0xfedc);
      expect(first.farCacheStats).toEqual({
        editCount: 1,
        retainedTiles: 0,
        typedArrayBytes: 0,
      });
      expect(first.cacheBytes).toBe(BLOCK_REGISTRY.length * 2);
      expect(first.blockSampleCacheStats?.typedArrayBytes).toBe(0);
      expect(first.runs.statistics.typedArrayBytes).toBe(
        first.runs.offsets.byteLength + first.runs.words.byteLength,
      );
      expect(first.mesh.statistics.typedArrayBytes).toBe(
        farTransfers(first.runs, first.mesh).reduce(
          (sum, buffer) => sum + buffer.byteLength,
          0,
        ) - first.runs.statistics.typedArrayBytes,
      );
      expect(detached[0]?.every((buffer) => buffer.byteLength === 0)).toBe(
        true,
      );
      expect(columnArrays.every((array) => array.byteLength === 8)).toBe(true);
      expect(
        messages
          .filter((message) => message.type === "progress")
          .map((message) => message.stage),
      ).toEqual(["generating", "generated", "meshing"]);

      const beforeStale = messages.length;
      send({
        type: "far",
        id: 100,
        world: { ...world, id: 6 },
        address: first.address,
        layer: "surface",
        revision: 99,
        priority: 0,
        postcard: false,
      });
      send({
        type: "edit",
        world: { ...world, id: 6 },
        edit: { ...edit, block: Block.Air },
      });
      expect(messages).toHaveLength(beforeStale);
      expect(runsAt(generate(1).runs)).toEqual(runsAt(first.runs));
      send({ type: "edit", world, edit: { ...edit, block: Block.Obsidian } });
      const changed = generate(2);
      expect(runsAt(changed.runs)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            bottom: 20,
            top: 21,
            block: Block.Obsidian,
          }),
        ]),
      );
      expect(changed.farCacheStats.editCount).toBe(1);
      send({ type: "edit", world, edit: { ...edit, block: Block.Air } });
      expect(runsAt(generate(3).runs).some((run) => run.bottom === 20)).toBe(
        false,
      );

      failCapacity = true;
      send({
        type: "far",
        id: 200,
        world,
        address: first.address,
        layer: "surface",
        revision: 4,
        priority: 0,
        postcard: false,
      });
      expect(messages.at(-1)).toMatchObject({
        type: "error",
        world,
        id: 200,
        far: { address: first.address, layer: "surface", revision: 4 },
        capacity: { capacity: "runs", limit: 12, statistics: { runs: 12 } },
      });
      failCapacity = false;
      const nextWorld: WorldSession = {
        id: 8,
        identity: { ...world.identity, seed: 2 },
      };
      send({ type: "init", world: nextWorld, plan: null, edits: [] });
      const reset = generate(0, nextWorld, "upper_deep");
      expect(reset.farCacheStats.editCount).toBe(0);
      expect(runsAt(reset.runs).some((run) => run.bottom === 20)).toBe(false);
      expect(layers.at(-1)).toBe("upper_deep");
      expect(reset.cacheBytes).toBe(BLOCK_REGISTRY.length * 2);
      expect(
        detached.every((buffers) =>
          buffers.every((buffer) => buffer.byteLength === 0),
        ),
      ).toBe(true);
      expect(columnArrays.every((array) => array.byteLength === 8)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      vi.doUnmock("../../../shared/src/world/world-context.js");
    }
  });
});
