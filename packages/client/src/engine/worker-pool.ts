import type {
  LayerId,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import { farSpacing } from "../../../shared/src/worldgen/far/coordinates.js";
import {
  FarCapacityError,
  type FarTileAddress,
  type FarTileRequest,
} from "../../../shared/src/worldgen/far/types.js";
import type { WorldSession } from "../contracts/game-ui.js";
import { sameSession } from "../game/session.js";
import { clonePlanBuffers, planBytes } from "./plan-transport.js";
import type {
  Address,
  ChunkResult,
  FarTileResult,
  FarWorkerRequest,
  VoxelEdit,
  WorkerRequest,
  WorkerResponse,
  WorkerStage,
} from "./worker-protocol.js";

interface JobBase {
  id: number;
  revision: number;
  priority: number;
  postcard: boolean;
  reject: (error: Error) => void;
  progress: (stage: WorkerStage) => void;
}
interface ChunkJob extends JobBase {
  type: "chunk";
  address: Address;
  resolve: (result: ChunkResult) => void;
}
interface FarJob extends JobBase {
  type: "far";
  address: FarTileAddress;
  layer: LayerId;
  cancelled: boolean;
  resolve: (result: FarTileResult) => void;
}
type Job = ChunkJob | FarJob;
type PostcardBatch =
  | { type: "chunk"; cx: number; cy: number; cz: number; remaining: number }
  | {
      type: "far";
      tx: number;
      tz: number;
      lod: number;
      layer: LayerId;
      remaining: number;
    };
interface Lane {
  worker: Worker;
  jobs: Job[];
  current: Job | null;
  cacheBytes: number;
  stage: WorkerStage;
  ready: boolean;
  batch: PostcardBatch | null;
  acknowledge(): void;
}
export function workerCount(concurrency: number): number {
  return Math.min(Math.max(Math.floor(concurrency) - 1, 1), 6);
}
export interface WorkerPoolOptions {
  readonly concurrency?: number;
  readonly shared?: boolean;
  readonly factory?: () => Worker;
}
export interface FarWorkerTicket {
  readonly id: number;
  readonly result: Promise<FarTileResult>;
  cancel(): void;
}
export class FarWorkerCancelledError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Far tile request cancelled");
  }
}
function sameFarRequest(a: FarTileRequest, b: FarTileRequest): boolean {
  return (
    a.layer === b.layer &&
    a.revision === b.revision &&
    a.address.tx === b.address.tx &&
    a.address.tz === b.address.tz &&
    a.address.lod === b.address.lod
  );
}
function inBatch(job: Job, batch: PostcardBatch): boolean {
  if (job.type === "chunk" && batch.type === "chunk")
    return (
      Math.floor(job.address.cx / 2) === batch.cx &&
      job.address.cy === batch.cy &&
      Math.floor(job.address.cz / 2) === batch.cz
    );
  return (
    job.type === "far" &&
    batch.type === "far" &&
    Math.floor(job.address.tx / 2) === batch.tx &&
    Math.floor(job.address.tz / 2) === batch.tz &&
    job.address.lod === batch.lod &&
    job.layer === batch.layer
  );
}
function postcardBatch(job: Job): PostcardBatch | null {
  if (!job.postcard || job.priority < 0) return null;
  return job.type === "chunk"
    ? {
        type: "chunk",
        cx: Math.floor(job.address.cx / 2),
        cy: job.address.cy,
        cz: Math.floor(job.address.cz / 2),
        remaining: 3,
      }
    : {
        type: "far",
        tx: Math.floor(job.address.tx / 2),
        tz: Math.floor(job.address.tz / 2),
        lod: job.address.lod,
        layer: job.layer,
        remaining: 3,
      };
}
export class TerrainWorkers {
  private readonly lanes: Lane[] = [];
  private serial = 0;
  private stopped: Error | null = null;
  readonly ready: Promise<void>;
  private rejectReady: (error: Error) => void = () => {};
  private readonly planMemory: number;
  constructor(
    readonly world: WorldSession,
    plan: WorldPlanData | null,
    edits: readonly VoxelEdit[],
    options: WorkerPoolOptions = {},
  ) {
    if ((world.identity.kind === "main") !== (plan !== null))
      throw new Error("WorldPlan does not match world kind");
    const shared =
      options.shared ??
      (globalThis.crossOriginIsolated &&
        typeof SharedArrayBuffer !== "undefined");
    // Never transfer/detach the owner's plan. SAB is a single read-only owned
    // copy; postMessage makes a private structured copy for each fallback worker.
    const distribution = plan ? clonePlanBuffers(plan, shared) : null;
    const count = workerCount(
      options.concurrency ?? navigator.hardwareConcurrency ?? 2,
    );
    this.planMemory = planBytes(distribution) * (shared ? 1 : count);
    const acknowledgements: Promise<void>[] = [];
    const failed = new Promise<never>((_, reject) => {
      this.rejectReady = reject;
    });
    // A synchronous constructor/postMessage fault happens before ready exists.
    // Observe this rejection immediately, then terminate every constructed lane.
    void failed.catch(() => {});
    const constructionFailed: (error: unknown) => never = (error) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.fail(failure);
      throw failure;
    };
    for (let index = 0; index < count; index++) {
      let worker: Worker;
      try {
        worker =
          options.factory?.() ??
          new Worker(new URL("./terrain-worker.ts", import.meta.url), {
            type: "module",
          });
      } catch (error) {
        constructionFailed(error);
      }
      let acknowledge = () => {};
      acknowledgements.push(
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
      );
      const lane: Lane = {
        worker,
        jobs: [],
        current: null,
        cacheBytes: 0,
        stage: "generating",
        ready: false,
        batch: null,
        acknowledge,
      };
      this.lanes.push(lane);
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (this.stopped || !sameSession(this.world, message.world)) return;
        if (message.type === "ready") {
          lane.ready = true;
          lane.acknowledge();
          this.dispatch(lane);
          return;
        }
        if (message.type === "error" && message.id === -1) {
          this.fail(new Error(message.message));
          return;
        }
        const job = lane.current;
        if (!job || message.id !== job.id) return;
        if (message.type === "progress") {
          lane.stage = message.stage;
          if (job.type !== "far" || !job.cancelled) job.progress(message.stage);
          return;
        }
        lane.current = null;
        if (message.type !== "error") lane.cacheBytes = message.cacheBytes;
        if (job.type === "far" && job.cancelled) {
          // Cancellation settled its promise. The synchronous worker still had
          // to finish before this lane could safely accept another job.
        } else if (message.type === "error") {
          if (
            message.far &&
            (job.type !== "far" || !sameFarRequest(job, message.far))
          )
            job.reject(new Error("Far error identity mismatch"));
          else if (job.type === "far" && message.capacity)
            job.reject(
              new FarCapacityError(
                message.capacity.capacity,
                message.capacity.limit,
                message.capacity.statistics,
              ),
            );
          else job.reject(new Error(message.message));
        } else if (job.type === "chunk" && message.type === "chunk") {
          job.resolve(message);
        } else if (
          job.type === "far" &&
          message.type === "far" &&
          sameFarRequest(job, message) &&
          sameFarRequest(job, message.runs)
        ) {
          job.resolve(message);
        } else {
          job.reject(new Error("Terrain worker result identity mismatch"));
        }
        this.dispatch(lane);
        this.dispatchIdle();
      };
      worker.onerror = (event) =>
        this.fail(new Error(event.message || "Terrain worker failed"));
      worker.onmessageerror = () =>
        this.fail(new Error("Terrain worker message could not be decoded"));
      try {
        worker.postMessage({
          type: "init",
          world,
          plan: distribution,
          edits,
        } satisfies WorkerRequest);
      } catch (error) {
        constructionFailed(error);
      }
      if (this.stopped) throw this.stopped;
    }
    this.ready = Promise.race([
      Promise.all(acknowledgements).then(() => {}),
      failed,
    ]);
    // Constructor can precede requestView; attach a rejection handler immediately.
    void this.ready.catch(() => {});
  }
  private affinity(a: Address): Lane {
    // Prefer one cache owner for four neighboring columns and every Y level.
    // Stagger successive 2x2 rows across the lanes: hashing these small cells
    // can leave nearby views with idle workers and very uneven queues.
    const count = this.lanes.length;
    const cell =
      Math.floor(a.cx / 2) + Math.floor(a.cz / 2) * Math.ceil(count / 2);
    return this.lanes[((cell % count) + count) % count] as Lane;
  }
  request(
    address: Address,
    revision: number,
    priority: number,
    progress: (stage: WorkerStage) => void,
    postcard = false,
  ): Promise<ChunkResult> {
    if (this.stopped) return Promise.reject(this.stopped);
    return new Promise((resolve, reject) => {
      const lane = this.affinity(address);
      lane.jobs.push({
        type: "chunk",
        id: ++this.serial,
        address,
        revision,
        priority,
        postcard,
        resolve,
        reject,
        progress,
      });
      lane.jobs.sort((a, b) => a.priority - b.priority || a.id - b.id);
      this.dispatch(lane);
    });
  }
  /** All near/far jobs share the same IDs, lanes, priorities and worker cap. */
  requestFar(request: Omit<FarWorkerRequest, "type" | "id">): FarWorkerTicket {
    const id = ++this.serial;
    let job: FarJob | undefined;
    const result = new Promise<FarTileResult>((resolve, reject) => {
      if (this.stopped) {
        reject(this.stopped);
        return;
      }
      if (!sameSession(this.world, request.world)) {
        reject(new Error("Far request world session mismatch"));
        return;
      }
      // Validate before putting a malformed address in the affinity queue.
      farSpacing(request.address);
      if (
        !Number.isFinite(request.priority) ||
        !Number.isSafeInteger(request.revision) ||
        request.revision < 0
      )
        throw new RangeError("Invalid far request priority or revision");
      job = {
        type: "far",
        id,
        address: { ...request.address },
        layer: request.layer,
        revision: request.revision,
        priority: request.priority,
        postcard: request.postcard,
        cancelled: false,
        resolve,
        reject,
        progress: () => {},
      };
      const lane = this.affinity({
        cx: request.address.tx,
        cy: 0,
        cz: request.address.tz,
      });
      lane.jobs.push(job);
      lane.jobs.sort((a, b) => a.priority - b.priority || a.id - b.id);
      this.dispatch(lane);
    });
    return {
      id,
      result,
      cancel: () => {
        if (job) this.cancelFar(job);
      },
    };
  }
  private cancelFar(job: FarJob): void {
    if (job.cancelled) return;
    for (const lane of this.lanes) {
      const index = lane.jobs.indexOf(job);
      if (lane.current !== job && index < 0) continue;
      job.cancelled = true;
      job.reject(new FarWorkerCancelledError());
      if (index >= 0) lane.jobs.splice(index, 1);
      // A running task is never terminated or replaced by cancellation.
      this.dispatch(lane);
      this.dispatchIdle();
      return;
    }
  }
  private dispatch(lane: Lane): void {
    if (this.stopped || !lane.ready || lane.current) return;
    if (lane.jobs.length === 0) {
      lane.batch = null;
      return;
    }
    const batch = lane.batch;
    // Only already-pending postcard work may bypass the priority head. Keep
    // ordinary requests and urgent revisions on their existing priority path.
    const index =
      batch &&
      batch.remaining > 0 &&
      lane.jobs.every(
        (job) => job.type === batch.type && job.postcard && job.priority >= 0,
      )
        ? lane.jobs.findIndex((job) => inBatch(job, batch))
        : -1;
    const job = lane.jobs.splice(index < 0 ? 0 : index, 1)[0] as Job;
    if (index >= 0 && batch) batch.remaining--;
    else lane.batch = postcardBatch(job);
    lane.current = job;
    lane.stage = "generating";
    try {
      if (job.type === "chunk")
        lane.worker.postMessage({
          type: "chunk",
          world: this.world,
          id: job.id,
          address: job.address,
          revision: job.revision,
        } satisfies WorkerRequest);
      else
        lane.worker.postMessage({
          type: "far",
          world: this.world,
          id: job.id,
          address: job.address,
          layer: job.layer,
          revision: job.revision,
          priority: job.priority,
          postcard: job.postcard,
        } satisfies WorkerRequest);
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
  private dispatchIdle(): void {
    // Wait for a completion so the initial request batch can establish locality.
    // Only pending work may move; a running job keeps its worker and callbacks.
    if (this.stopped || !this.lanes.every((lane) => lane.ready)) return;
    for (const lane of this.lanes) {
      if (lane.current || lane.jobs.length > 0) continue;
      let donor: Lane | undefined;
      let next: Job | undefined;
      for (const source of this.lanes) {
        const head = source.jobs[0];
        if (
          head &&
          (!next || (head.priority - next.priority || head.id - next.id) < 0)
        ) {
          donor = source;
          next = head;
        }
      }
      if (!donor) return;
      lane.jobs.push(donor.jobs.shift() as Job);
      this.dispatch(lane);
    }
  }
  edit(edit: VoxelEdit): void {
    if (this.stopped) return;
    try {
      for (const lane of this.lanes)
        lane.worker.postMessage({
          type: "edit",
          world: this.world,
          edit,
        } satisfies WorkerRequest);
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
  get queued(): number {
    return this.lanes.reduce(
      (n, l) => n + l.jobs.length + (l.current ? 1 : 0),
      0,
    );
  }
  get memoryBytes(): number {
    if (this.stopped) return 0;
    return this.planMemory + this.lanes.reduce((n, l) => n + l.cacheBytes, 0);
  }
  get queues(): { generate: number; light: number; mesh: number } {
    const queues = { generate: 0, light: 0, mesh: 0 };
    for (const lane of this.lanes) {
      queues.generate += lane.jobs.length;
      if (lane.current) {
        if (lane.stage === "lighting") queues.light++;
        else if (lane.stage === "meshing") queues.mesh++;
        else queues.generate++;
      }
    }
    return queues;
  }
  private fail(error: Error): void {
    if (this.stopped) return;
    this.stopped = error;
    this.rejectReady(error);
    for (const lane of this.lanes) {
      lane.worker.terminate();
      lane.current?.reject(error);
      lane.current = null;
      lane.batch = null;
      for (const job of lane.jobs) job.reject(error);
      lane.jobs.length = 0;
    }
  }
  dispose(): void {
    this.fail(new Error("Worker pool disposed"));
  }
}
