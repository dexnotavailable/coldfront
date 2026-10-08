import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { voxelIndex } from "../../../shared/src/world/coordinates.js";
import {
  Column,
  collectTestTrees,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
} from "../../../shared/src/worldgen/test-world.js";
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
  readonly workers: TerrainWorkers;
  onFailure: (error: Error) => void = () => {};
  private tick = 0;
  private readonly pending = new Map<string, Promise<void>>();
  private readonly pointColumns = new Map<
    string,
    { c: Float64Array; trees: ReturnType<typeof collectTestTrees> }
  >();
  private readonly voxel = createVoxelSample();
  private stopped = false;
  constructor(
    readonly seed: number,
    saved: readonly VoxelEdit[],
  ) {
    for (const edit of saved)
      this.edits.set(editKey(edit.x, edit.y, edit.z), edit);
    this.workers = new TerrainWorkers(seed, saved);
  }
  private queryColumn(
    x: number,
    z: number,
  ): { c: Float64Array; trees: ReturnType<typeof collectTestTrees> } {
    const key = `${x},${z}`;
    let value = this.pointColumns.get(key);
    if (!value) {
      value = {
        c: sampleTestColumn(this.seed, x + 0.5, z + 0.5, createColumnSample()),
        trees: collectTestTrees(this.seed, x + 0.5, z + 0.5, x + 0.5, z + 0.5),
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
    const edit = this.edits.get(editKey(x, y, z));
    if (edit) return edit.block;
    const cx = Math.floor(x / 32),
      cy = Math.floor(y / 32),
      cz = Math.floor(z / 32),
      chunk = this.chunks.get(`${cx},${cy},${cz}`)?.result;
    if (chunk)
      return chunk.blocks[
        voxelIndex(x - cx * 32, y - cy * 32, z - cz * 32)
      ] as number;
    const { c, trees } = this.queryColumn(x, z);
    return sampleTestVoxel(
      this.seed,
      x + 0.5,
      y + 0.5,
      z + 0.5,
      this.voxel,
      c,
      trees,
    ).block;
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
    const x = Math.floor(wx),
      z = Math.floor(wz),
      { c, trees } = this.queryColumn(x, z);
    let top = Math.ceil(c[Column.Height] as number);
    for (const t of trees)
      top = Math.max(top, Math.ceil(t.crownY + t.crownHeight));
    for (const edit of this.edits.values())
      if (edit.x === x && edit.z === z && edit.block !== Block.Air)
        top = Math.max(top, edit.y + 1);
    top = Math.min(top, Math.floor(cut));
    for (let y = top; y >= Math.max(-1536, top - 256); y--) {
      const b = this.get(x, y, z);
      if (b !== Block.Air) return Math.min(y + 1, cut);
    }
    return Math.min(c[Column.Height] as number, cut);
  };
  request(address: Address, priority = 0): Promise<void> {
    if (this.stopped || address.cy < -48 || address.cy >= 32)
      return Promise.resolve();
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
        const current = this.chunks.get(key);
        if (!current) return;
        if (result.revision !== current.revision) return;
        current.result = result;
        current.state = "meshing";
        this.uploads.push(result);
      })
      .catch((error) => {
        if (!this.stopped)
          this.onFailure(
            error instanceof Error ? error : new Error(String(error)),
          );
      })
      .finally(() => {
        this.pending.delete(key);
        const current = this.chunks.get(key);
        if (!this.stopped && current && current.revision !== revision)
          void this.request(address, priority);
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
  ): Promise<readonly Address[]> {
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
        let low = Infinity,
          high = -Infinity;
        for (const oz of [0, 16, 31])
          for (const ox of [0, 16, 31]) {
            const h = this.surface(ax * 32 + ox, az * 32 + oz);
            low = Math.min(low, h);
            high = Math.max(high, h);
          }
        const levels = new Set<number>();
        const minY = Math.max(-48, Math.floor((low - 3) / 32));
        const maxY = Math.min(31, Math.floor((high + 12) / 32));
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
    return jobs.map((j) => j.a);
  }
  edit(edit: VoxelEdit): void {
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
      void this.request(stored.address, -1);
    }
  }
  get queueSize(): number {
    return this.workers.queued;
  }
  get memoryBytes(): number {
    let size = this.workers.memoryBytes;
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
  }
}
