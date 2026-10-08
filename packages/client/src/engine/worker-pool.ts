import type { WorldPlanData } from "../../../shared/src/world/types.js";
import type { WorldSession } from "../contracts/game-ui.js";
import { sameSession } from "../game/session.js";
import { clonePlanBuffers, planBytes } from "./plan-transport.js";
import type {
  Address,
  ChunkResult,
  VoxelEdit,
  WorkerRequest,
  WorkerResponse,
  WorkerStage,
} from "./worker-protocol.js";

interface Job {
  id: number;
  address: Address;
  revision: number;
  priority: number;
  resolve: (result: ChunkResult) => void;
  reject: (error: Error) => void;
  progress: (stage: WorkerStage) => void;
}
interface Lane {
  worker: Worker;
  jobs: Job[];
  current: Job | null;
  cacheBytes: number;
  stage: WorkerStage;
  ready: boolean;
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
          job.progress(message.stage);
          return;
        }
        lane.current = null;
        if (message.type === "error") job.reject(new Error(message.message));
        else {
          lane.cacheBytes = message.cacheBytes;
          job.resolve(message);
        }
        this.dispatch(lane);
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
    const hash = (Math.imul(a.cx, 73856093) ^ Math.imul(a.cz, 19349663)) >>> 0;
    return this.lanes[hash % this.lanes.length] as Lane;
  }
  request(
    address: Address,
    revision: number,
    priority: number,
    progress: (stage: WorkerStage) => void,
  ): Promise<ChunkResult> {
    if (this.stopped) return Promise.reject(this.stopped);
    return new Promise((resolve, reject) => {
      const lane = this.affinity(address);
      lane.jobs.push({
        id: ++this.serial,
        address,
        revision,
        priority,
        resolve,
        reject,
        progress,
      });
      lane.jobs.sort((a, b) => a.priority - b.priority || a.id - b.id);
      this.dispatch(lane);
    });
  }
  private dispatch(lane: Lane): void {
    if (this.stopped || !lane.ready || lane.current || lane.jobs.length === 0)
      return;
    const job = lane.jobs.shift() as Job;
    lane.current = job;
    lane.worker.postMessage({
      type: "chunk",
      world: this.world,
      id: job.id,
      address: job.address,
      revision: job.revision,
    } satisfies WorkerRequest);
  }
  edit(edit: VoxelEdit): void {
    if (this.stopped) return;
    for (const lane of this.lanes)
      lane.worker.postMessage({
        type: "edit",
        world: this.world,
        edit,
      } satisfies WorkerRequest);
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
      for (const job of lane.jobs) job.reject(error);
      lane.jobs.length = 0;
    }
  }
  dispose(): void {
    this.fail(new Error("Worker pool disposed"));
  }
}
