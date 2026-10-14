import { expect, it, vi } from "vitest";
import type { WorldSession } from "../../../client/src/contracts/game-ui.js";
import type {
  WorkerRequest,
  WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import * as lighting from "../../../shared/src/lighting/flood.js";
import { voxelIndex } from "../../../shared/src/world/coordinates.js";
import { generationKey } from "../../../shared/src/world/generation-variant.js";
import type { WorldPlanData } from "../../../shared/src/world/types.js";
import { syntheticCrumbContext } from "../../../shared/test/fixtures/crumb-context.js";
import { cameraQuery } from "../../src/postcards/query.js";

it("feeds one cleaned field to camera, collision, chunk halos and worker lighting; keeps subsequent edits", async () => {
  const context = await syntheticCrumbContext({
    cells: [
      [5, 5, 5],
      [6, 35, 6],
      [7, 50, 7],
      [8, 100, 8],
      [31, 5, 5],
    ],
  });
  const world: WorldSession = {
    id: 8,
    identity: {
      kind: "main",
      seed: 7,
      generation: generationKey(4, "a".repeat(64)),
    },
  };
  const volumes: lighting.LightVolume[] = [];
  const messages: WorkerResponse[] = [];
  vi.doMock("../../../shared/src/world/world-context.js", () => ({
    createWorldContext: () => context,
  }));
  vi.doMock("../../../shared/src/lighting/flood.js", () => ({
    ...lighting,
    createLightVolume: (width: number, height: number, depth: number) => {
      const volume = lighting.createLightVolume(width, height, depth);
      volumes.push(volume);
      return volume;
    },
  }));
  vi.doMock("../../../client/src/engine/worker-pool.js", () => ({
    TerrainWorkers: class {
      ready = Promise.resolve();
      queued = 0;
      memoryBytes = 0;
      edit() {}
      dispose() {}
    },
  }));
  const worker = {
    onmessage: null as ((event: MessageEvent<WorkerRequest>) => void) | null,
    postMessage: (message: WorkerResponse) => messages.push(message),
  };
  vi.stubGlobal("self", worker);
  try {
    const { ChunkStore } = await import(
      "../../../client/src/engine/chunk-store.js"
    );
    const store = new ChunkStore(world, context, null, []);
    const camera = cameraQuery(context);
    for (const [x, y, z] of [
      [5, 5, 5],
      [6, 35, 6],
      [7, 50, 7],
      [8, 100, 8],
    ]) {
      expect(store.get(x as number, y as number, z as number)).toBe(Block.Air);
      expect(camera.voxel(x as number, y as number, z as number).block).toBe(
        Block.Air,
      );
    }
    expect(store.get(31, 5, 5)).toBe(Block.EmberCrust);
    expect(camera.voxel(31, 5, 5).block).toBe(Block.EmberCrust);
    await import("../../../client/src/engine/terrain-worker.js");
    const send = (message: WorkerRequest) =>
      worker.onmessage?.({ data: message } as MessageEvent<WorkerRequest>);
    send({ type: "init", world, plan: {} as WorldPlanData, edits: [] });
    send({
      type: "chunk",
      world,
      id: 1,
      address: { cx: 0, cy: 0, cz: 0 },
      revision: 0,
    });
    expect(messages.filter((message) => message.type === "error")).toEqual([]);
    const first = messages.find((message) => message.type === "chunk");
    if (first?.type !== "chunk") throw new Error("Missing worker chunk");
    expect(first.blocks[voxelIndex(5, 5, 5)]).toBe(Block.Air);
    expect(first.blocks[voxelIndex(31, 5, 5)]).toBe(Block.EmberCrust);
    const volume = volumes[0];
    if (!volume) throw new Error("Missing worker lighting volume");
    // y35 is the upper chunk halo; y50 is the area-only lighting extension.
    for (const [x, y, z] of [
      [5, 5, 5],
      [6, 35, 6],
      [7, 50, 7],
    ] as const)
      expect(
        volume.opacity[lighting.lightIndex(volume, x + 32, y + 32, z + 32)],
      ).toBe(0);
    // y100 is beyond the volume itself but within its 64m incoming-sky window.
    expect(
      (volume.sources[lighting.lightIndex(volume, 40, 95, 40)] as number) >>>
        12,
    ).toBe(15);
    expect(volume.opacity[lighting.lightIndex(volume, 63, 37, 37)]).toBe(
      BLOCK_REGISTRY[Block.EmberCrust]?.lightFiltering,
    );
    const edit = { x: 5, y: 5, z: 5, block: Block.Stone };
    store.edit(edit);
    expect(store.get(5, 5, 5)).toBe(Block.Stone);
    send({ type: "edit", world, edit });
    send({
      type: "chunk",
      world,
      id: 2,
      address: { cx: 0, cy: 0, cz: 0 },
      revision: 1,
    });
    const last = messages.at(-1);
    expect(last?.type).toBe("chunk");
    if (last?.type === "chunk")
      expect(last.blocks[voxelIndex(5, 5, 5)]).toBe(Block.Stone);
    expect(
      context.sampleVoxel(5.5, 5.5, 5.5, { density: 0, block: 0, fluid: 0 })
        .block,
    ).toBe(Block.Air);
    camera.clear();
    store.dispose();
  } finally {
    vi.doUnmock("../../../shared/src/world/world-context.js");
    vi.doUnmock("../../../shared/src/lighting/flood.js");
    vi.doUnmock("../../../client/src/engine/worker-pool.js");
    vi.unstubAllGlobals();
  }
});
