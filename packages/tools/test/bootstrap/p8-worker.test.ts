import { describe, expect, it, vi } from "vitest";
import type {
  WorkerRequest,
  WorkerResponse,
} from "../../../client/src/engine/worker-protocol.js";
import { sameSession } from "../../../client/src/game/session.js";
import { generationKey } from "../../../shared/src/world/generation-variant.js";
import type {
  WorldContextOptions,
  WorldPlanData,
} from "../../../shared/src/world/types.js";

describe("P8 terrain-worker identity hydration", () => {
  it("decodes the same authoritative variant, rejects primitive TEST, and refuses old namespace messages", async () => {
    const calls: WorldContextOptions[] = [],
      messages: WorkerResponse[] = [];
    vi.doMock("../../../shared/src/world/world-context.js", () => ({
      createWorldContext: (options: WorldContextOptions) => {
        calls.push(options);
        return {};
      },
    }));
    const worker = {
      onmessage: null as ((event: MessageEvent<WorkerRequest>) => void) | null,
      postMessage: (message: WorkerResponse) => messages.push(message),
    };
    vi.stubGlobal("self", worker);
    try {
      await import("../../../client/src/engine/terrain-worker.js");
      const send = (message: WorkerRequest) =>
        worker.onmessage?.({ data: message } as MessageEvent<WorkerRequest>);
      const production = {
        id: 7,
        identity: {
          kind: "main" as const,
          seed: 1,
          generation: generationKey(4, "a".repeat(64)),
        },
      };
      const primitive = {
        ...production,
        identity: {
          ...production.identity,
          generation: generationKey(4, "a".repeat(64), "primitive"),
        },
      };
      const plan = {} as WorldPlanData;
      send({ type: "init", world: production, plan, edits: [] });
      send({ type: "init", world: primitive, plan, edits: [] });
      expect(calls).toEqual([
        { kind: "main", seed: 1, plan, variant: "production" },
        { kind: "main", seed: 1, plan, variant: "primitive" },
      ]);
      expect(sameSession(production, primitive)).toBe(false);
      const count = messages.length;
      send({
        type: "chunk",
        world: production,
        id: 1,
        address: { cx: 0, cy: 0, cz: 0 },
        revision: 0,
      });
      expect(messages).toHaveLength(count);
      send({
        type: "init",
        world: {
          ...primitive,
          identity: { ...primitive.identity, kind: "test" },
        },
        plan: null,
        edits: [],
      });
      expect(messages.at(-1)).toMatchObject({
        type: "error",
        id: -1,
        message: "Primitive generation requires a main world",
      });
      expect(calls).toHaveLength(2);
    } finally {
      vi.doUnmock("../../../shared/src/world/world-context.js");
      vi.unstubAllGlobals();
    }
  });
});
