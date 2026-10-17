import type { LayerId } from "../../../shared/src/world/types.js";
import { sameSession } from "../game/session.js";
import type {
  FarGenerationRequest,
  FarGenerationResult,
  FarScheduler,
} from "./far-terrain-store.js";
import {
  FarWorkerCancelledError,
  type FarWorkerTicket,
  type TerrainWorkers,
} from "./worker-pool.js";

/** One adapter per store lifetime. Store IDs never enter the pool's namespace. */
export class FarWorkerScheduler implements FarScheduler {
  private readonly pending = new Map<number, FarWorkerTicket>();
  private stopped = false;
  constructor(
    private readonly pool: TerrainWorkers,
    readonly layer: LayerId,
  ) {}
  request(request: FarGenerationRequest): Promise<FarGenerationResult> {
    if (this.stopped)
      return Promise.reject(new Error("Far scheduler disposed"));
    if (
      !sameSession(this.pool.world, request.world) ||
      request.layer !== this.layer
    )
      return Promise.reject(
        new Error("Far scheduler world session or layer mismatch"),
      );
    if (
      !Number.isSafeInteger(request.id) ||
      request.id < 0 ||
      this.pending.has(request.id)
    )
      return Promise.reject(
        new Error("Invalid or duplicate far store request ID"),
      );
    const ticket = this.pool.requestFar(request);
    this.pending.set(request.id, ticket);
    return ticket.result
      .then((result) => {
        if (this.stopped || this.pending.get(request.id) !== ticket)
          throw new FarWorkerCancelledError();
        return { ...result, id: request.id };
      })
      .finally(() => {
        // A cancelled local ID can already belong to a newer request.
        if (this.pending.get(request.id) === ticket)
          this.pending.delete(request.id);
      });
  }
  cancel(id: number): void {
    const ticket = this.pending.get(id);
    if (!ticket) return;
    this.pending.delete(id);
    ticket.cancel();
  }
  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const ticket of this.pending.values()) ticket.cancel();
    this.pending.clear();
  }
}
