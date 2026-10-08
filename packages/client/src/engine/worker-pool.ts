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
}
export function workerCount(concurrency: number): number {
  return Math.min(Math.max(Math.floor(concurrency) - 1, 1), 6);
}
export class TerrainWorkers {
  private readonly lanes: Lane[];
  private serial = 0;
  constructor(seed: number, edits: readonly VoxelEdit[]) {
    this.lanes = Array.from(
      { length: workerCount(navigator.hardwareConcurrency || 2) },
      () => {
        const worker = new Worker(
          new URL("./terrain-worker.ts", import.meta.url),
          { type: "module" },
        );
        const lane: Lane = {
          worker,
          jobs: [],
          current: null,
          cacheBytes: 0,
          stage: "generating",
        };
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const message = event.data,
            job = lane.current;
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
        worker.onerror = (event) => {
          lane.current?.reject(new Error(event.message));
          lane.current = null;
          this.dispatch(lane);
        };
        worker.postMessage({
          type: "init",
          seed,
          edits,
        } satisfies WorkerRequest);
        return lane;
      },
    );
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
    if (lane.current || lane.jobs.length === 0) return;
    const job = lane.jobs.shift() as Job;
    lane.current = job;
    lane.worker.postMessage({
      type: "chunk",
      id: job.id,
      address: job.address,
      revision: job.revision,
    } satisfies WorkerRequest);
  }
  edit(edit: VoxelEdit): void {
    for (const lane of this.lanes)
      lane.worker.postMessage({ type: "edit", edit } satisfies WorkerRequest);
  }
  get queued(): number {
    return this.lanes.reduce(
      (n, l) => n + l.jobs.length + (l.current ? 1 : 0),
      0,
    );
  }
  get memoryBytes(): number {
    return this.lanes.reduce((n, l) => n + l.cacheBytes, 0);
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
  dispose(): void {
    for (const lane of this.lanes) {
      lane.worker.terminate();
      lane.current?.reject(new Error("Worker pool disposed"));
      for (const job of lane.jobs)
        job.reject(new Error("Worker pool disposed"));
    }
  }
}
