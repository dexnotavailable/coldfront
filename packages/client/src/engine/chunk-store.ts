import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { voxelIndex } from "../../../shared/src/world/coordinates.js";
import type {
  VoxelSample,
  WorldAreaSampler,
  WorldBounds,
  WorldContext,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import type { WorldSession } from "../contracts/game-ui.js";
import { type PostcardView, postcardColumnVisible } from "../game/postcard.js";
import { sameSession } from "../game/session.js";
import { insideFrame } from "../game/world-save.js";
import { planBytes } from "./plan-transport.js";
import { TerrainWorkers } from "./worker-pool.js";
import {
  type Address,
  type ChunkResult,
  chunkKey,
  editKey,
  type VoxelEdit,
} from "./worker-protocol.js";
export type ChunkState =
  | "requested"
  | "generating"
  | "generated"
  | "lighting"
  | "meshing"
  | "uploaded"
  | "visible"
  | "evicted";
export interface StoredChunk {
  readonly address: Address;
  result: ChunkResult | null;
  revision: number;
  state: ChunkState;
  touched: number;
}
export class ChunkStore {
  readonly chunks = new Map<string, StoredChunk>();
  readonly edits = new Map<number, VoxelEdit>();
  readonly uploads: ChunkResult[] = [];
  workers: TerrainWorkers;
  onFailure: (error: Error) => void = () => {};
  private tick = 0;
  private readonly completedWork = { generate: 0, light: 0, mesh: 0 };
  get workTotals(): Readonly<{
    generate: number;
    light: number;
    mesh: number;
  }> {
    return { ...this.completedWork };
  }
  private readonly pending = new Map<string, Promise<void>>();
  private readonly pointColumns = new Map<
    string,
    { c: Float64Array; area: WorldAreaSampler }
  >();
  private readonly pointAreas = new Map<string, WorldAreaSampler>();
  private readonly voxel: VoxelSample = { density: 0, block: 0, fluid: 0 };
  private stopped = false;
  private suspended = false;
  suspendWorkers(): void {
    if (this.suspended || this.stopped) return;
    this.suspended = true;
    this.workers.dispose();
  }
  async resumeWorkers(): Promise<void> {
    if (!this.suspended || this.stopped) return;
    await Promise.allSettled(this.pending.values());
    if (this.stopped) return;
    this.workers = new TerrainWorkers(
      this.world,
      this.context.plan?.data ?? null,
      [...this.edits.values()],
    );
    this.suspended = false;
    await this.workers.ready;
  }
  constructor(
    readonly world: WorldSession,
    readonly context: WorldContext,
    plan: WorldPlanData | null,
    saved: readonly VoxelEdit[],
  ) {
    for (const edit of saved)
      this.edits.set(editKey(edit.x, edit.y, edit.z), edit);
    this.workers = new TerrainWorkers(world, plan, saved);
  }
  get seed(): number {
    return this.world.identity.seed;
  }
  private queryColumn(
    x: number,
    z: number,
  ): { c: Float64Array; area: WorldAreaSampler } {
    const key = `${x},${z}`;
    let value = this.pointColumns.get(key);
    if (!value) {
      const cx = Math.floor(x / 32),
        cz = Math.floor(z / 32),
        tile = `${cx},${cz}`;
      let area = this.pointAreas.get(tile);
      if (!area) {
        area = this.context.prepareArea({
          minX: cx * 32 + 0.5,
          minZ: cz * 32 + 0.5,
          maxX: cx * 32 + 31.5,
          maxZ: cz * 32 + 31.5,
        });
        this.pointAreas.set(tile, area);
        if (this.pointAreas.size > 64)
          this.pointAreas.delete(this.pointAreas.keys().next().value as string);
      }
      value = {
        c: area.sampleColumn(x + 0.5, z + 0.5, area.createColumn()),
        area,
      };
      this.pointColumns.set(key, value);
      if (this.pointColumns.size > 8192)
        this.pointColumns.delete(
          this.pointColumns.keys().next().value as string,
        );
    }
    return value;
  }
  get = (x: number, y: number, z: number): number => {
    // Solid frame prevents body/picking from escaping; generation's external
    // lighting halo still comes from the canonical shared boundary policy.
    if (!insideFrame(x, y, z)) return Block.Worldstone;
    const edit = this.edits.get(editKey(x, y, z));
    if (edit) return edit.block;
    const cx = Math.floor(x / 32),
      cy = Math.floor(y / 32),
      cz = Math.floor(z / 32);
    const chunk = this.chunks.get(`${cx},${cy},${cz}`)?.result;
    if (chunk)
      return chunk.blocks[
        voxelIndex(x - cx * 32, y - cy * 32, z - cz * 32)
      ] as number;
    const { c, area } = this.queryColumn(x, z);
    return area.sampleVoxel(x + 0.5, y + 0.5, z + 0.5, this.voxel, c).block;
  };
  lightAt(x: number, y: number, z: number): number {
    const cx = Math.floor(x / 32),
      cy = Math.floor(y / 32),
      cz = Math.floor(z / 32);
    return (
      this.chunks.get(`${cx},${cy},${cz}`)?.result?.light[
        voxelIndex(x - cx * 32, y - cy * 32, z - cz * 32)
      ] ?? 0
    );
  }
  surface = (wx: number, wz: number, cut = Infinity): number => {
    const x = Math.max(-22528, Math.min(22527, Math.floor(wx))),
      z = Math.max(-22528, Math.min(22527, Math.floor(wz)));
    const { c, area } = this.queryColumn(x, z);
    const sky = area.skyInput(
      x + 0.5,
      z + 0.5,
      { solidBelowY: 0, highestFilterY: 0 },
      c,
    );
    let top = Math.ceil(sky.highestFilterY);
    for (const edit of this.edits.values())
      if (edit.x === x && edit.z === z && edit.block !== Block.Air)
        top = Math.max(top, edit.y + 1);
    top = Math.min(1023, top, Math.floor(cut));
    for (let y = top; y >= -1536; y--)
      if (this.get(x, y, z) !== Block.Air) return Math.min(y + 1, cut);
    return -1536;
  };
  hasView(addresses: readonly Address[], uploaded = false): boolean {
    return addresses.every((address) => {
      const chunk = this.chunks.get(chunkKey(address));
      return (
        !!chunk?.result &&
        sameSession(this.world, chunk.result.world) &&
        chunk.result.revision === chunk.revision &&
        (!uploaded || chunk.state === "visible")
      );
    });
  }
  request(address: Address, priority = 0): Promise<void> {
    if (this.stopped || this.suspended)
      return Promise.reject(new Error("Chunk store unavailable"));
    if (
      ![address.cx, address.cy, address.cz].every(Number.isInteger) ||
      address.cy < -48 ||
      address.cy >= 32 ||
      address.cx < -704 ||
      address.cx >= 704 ||
      address.cz < -704 ||
      address.cz >= 704
    )
      return Promise.reject(new RangeError("Chunk outside world frame"));
    const key = chunkKey(address),
      pending = this.pending.get(key);
    if (pending) return pending;
    let stored = this.chunks.get(key);
    if (stored?.result && stored.result.revision === stored.revision) {
      stored.touched = ++this.tick;
      return Promise.resolve();
    }
    if (!stored) {
      stored = {
        address,
        result: null,
        revision: 0,
        state: "requested",
        touched: ++this.tick,
      };
      this.chunks.set(key, stored);
    }
    stored.state = "generating";
    const revision = stored.revision;
    const promise = this.workers
      .request(address, revision, priority, (stage) => {
        const current = this.chunks.get(key);
        if (current) current.state = stage;
      })
      .then((result) => {
        if (this.stopped) return;
        for (const key of ["generate", "light", "mesh"] as const)
          this.completedWork[key] += result.timings[key];
        const current = this.chunks.get(key);
        if (!current) return;
        if (
          !sameSession(this.world, result.world) ||
          result.revision !== current.revision
        )
          return;
        current.result = result;
        current.state = "meshing";
        this.uploads.push(result);
      })
      .catch((error) => {
        if (!this.stopped && !this.suspended)
          this.onFailure(
            error instanceof Error ? error : new Error(String(error)),
          );
        throw error;
      })
      .finally(() => {
        this.pending.delete(key);
        const current = this.chunks.get(key);
        if (
          !this.stopped &&
          !this.suspended &&
          current &&
          current.revision !== revision
        )
          void this.request(address, priority).catch(() => {});
      });
    this.pending.set(key, promise);
    return promise;
  }
  /** Surface columns plus body band, with a one-chunk light halo in each worker. */
  async requestView(
    x: number,
    y: number,
    z: number,
    radius: number,
    includeColumn?: (cx: number, cz: number) => boolean,
  ): Promise<readonly Address[]> {
    if (
      !insideFrame(x, y, z) ||
      !Number.isFinite(radius) ||
      radius <= 0 ||
      radius > 600
    )
      throw new RangeError("View outside world frame");
    await this.workers.ready;
    const cx = Math.floor(x / 32),
      cz = Math.floor(z / 32),
      cy = Math.floor(y / 32),
      r = Math.ceil(radius / 32);
    const jobs: { a: Address; d: number }[] = [];
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > (r + 0.4) * (r + 0.4)) continue;
        const ax = cx + dx,
          az = cz + dz;
        if (ax < -704 || ax >= 704 || az < -704 || az >= 704) continue;
        if (includeColumn && !includeColumn(ax, az)) continue;
        const bounds: WorldBounds = {
          minSurfaceY: 0,
          maxSurfaceY: 0,
          maxSolidY: 0,
          maxFluidY: 0,
        };
        this.context.conservativeBounds(
          {
            minX: ax * 32,
            minZ: az * 32,
            maxX: ax * 32 + 32,
            maxZ: az * 32 + 32,
          },
          bounds,
        );
        const low = bounds.minSurfaceY;
        let high = Math.max(
          bounds.maxSurfaceY,
          bounds.maxSolidY,
          bounds.maxFluidY,
        );
        for (const edit of this.edits.values())
          if (
            Math.floor(edit.x / 32) === ax &&
            Math.floor(edit.z / 32) === az &&
            edit.block !== Block.Air
          )
            high = Math.max(high, edit.y + 1);
        const levels = new Set<number>();
        const minY = Math.max(-48, Math.floor((low - 3) / 32));
        const maxY = Math.min(31, Math.floor(high / 32));
        for (let ay = minY; ay <= maxY; ay++) levels.add(ay);
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)
          for (let ay = Math.max(-48, cy - 1); ay <= Math.min(31, cy + 1); ay++)
            levels.add(ay);
        // Surface and body bands stay separate: flight must not generate all
        // the empty vertical chunks between the ground and the avatar.
        for (const ay of levels)
          jobs.push({
            a: { cx: ax, cy: ay, cz: az },
            d: dx * dx + dz * dz + 2 * (ay - cy) * (ay - cy),
          });
      }
    jobs.sort(
      (a, b) =>
        a.d - b.d || a.a.cx - b.a.cx || a.a.cz - b.a.cz || a.a.cy - b.a.cy,
    );
    await Promise.all(jobs.map((j) => this.request(j.a, j.d)));
    const addresses = jobs.map((j) => j.a);
    // A racing edit may have invalidated a first result. Await the queued refill
    // and check real mesh revisions rather than treating resolved jobs as ready.
    await this.settled();
    if (!this.hasView(addresses))
      throw new Error("Requested terrain is not complete");
    return addresses;
  }
  requestCamera(view: PostcardView): Promise<readonly Address[]> {
    return this.requestView(
      view.position.x,
      Math.max(-1535, Math.min(1023, view.position.y)),
      view.position.z,
      view.radius,
      (cx, cz) => postcardColumnVisible(view, cx, cz),
    );
  }
  retain(addresses: readonly Address[]): string[] {
    const keep = new Set(addresses.map(chunkKey)),
      removed: string[] = [];
    for (const [key, chunk] of this.chunks)
      if (!keep.has(key) && !this.pending.has(key)) {
        chunk.state = "evicted";
        this.chunks.delete(key);
        removed.push(key);
      }
    return removed;
  }
  edit(edit: VoxelEdit): void {
    if (
      !insideFrame(edit.x, edit.y, edit.z) ||
      ![edit.x, edit.y, edit.z].every(Number.isInteger)
    )
      throw new RangeError("Edit outside world frame");
    if (!BLOCK_REGISTRY[edit.block]) throw new RangeError("Unknown block edit");
    this.edits.set(editKey(edit.x, edit.y, edit.z), edit);
    this.workers.edit(edit);
    const cx = Math.floor(edit.x / 32),
      cy = Math.floor(edit.y / 32),
      cz = Math.floor(edit.z / 32);
    for (const stored of this.chunks.values()) {
      if (
        Math.abs(stored.address.cx - cx) > 1 ||
        Math.abs(stored.address.cz - cz) > 1 ||
        Math.abs(stored.address.cy - cy) > 1
      )
        continue;
      stored.revision++;
      if (
        stored.result &&
        stored.address.cx === cx &&
        stored.address.cy === cy &&
        stored.address.cz === cz
      )
        stored.result.blocks[
          voxelIndex(edit.x - cx * 32, edit.y - cy * 32, edit.z - cz * 32)
        ] = edit.block;
      void this.request(stored.address, -1).catch(() => {});
    }
  }
  get queueSize(): number {
    return this.workers.queued;
  }
  get memoryBytes(): number {
    let size = this.workers.memoryBytes + planBytes(this.context.plan?.data);
    for (const column of this.pointColumns.values())
      size += column.c.byteLength;
    for (const c of this.chunks.values())
      if (c.result) {
        size += c.result.blocks.byteLength + c.result.light.byteLength;
        for (const p of [...c.result.mesh.parts, c.result.mesh.skirts])
          size +=
            p.positions.byteLength +
            p.normals.byteLength +
            p.expansions.byteLength +
            p.packedPositions.byteLength +
            p.surfaces.byteLength +
            p.indices.byteLength;
      }
    return size;
  }
  evict(x: number, z: number, radius: number): string[] {
    const removed: string[] = [];
    for (const [key, chunk] of this.chunks)
      if (
        Math.hypot(
          chunk.address.cx * 32 + 16 - x,
          chunk.address.cz * 32 + 16 - z,
        ) > radius &&
        !this.pending.has(key)
      ) {
        chunk.state = "evicted";
        this.chunks.delete(key);
        removed.push(key);
      }
    return removed;
  }
  async settled(): Promise<void> {
    while (this.pending.size) await Promise.all(this.pending.values());
  }
  dispose(): void {
    this.stopped = true;
    this.workers.dispose();
    this.chunks.clear();
    this.uploads.length = 0;
    this.pointColumns.clear();
    this.pointAreas.clear();
  }
}
