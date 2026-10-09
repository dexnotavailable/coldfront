import type {
  VoxelSample,
  WorldAreaSampler,
} from "../../../shared/src/world/types.js";

const EDGE = 32;
const CELLS = EDGE ** 3;
/** Uint16 block IDs plus one validity bit per cell. Air (0) is a valid value. */
export const BLOCK_SAMPLE_PAGE_BYTES = CELLS * 2 + CELLS / 8;
export const BLOCK_SAMPLE_PAGE_LIMIT = 64;

export interface BlockSampleCacheStats {
  readonly pages: number;
  readonly pageLimit: number;
  /** Cumulative lookup counts since the current world's init. */
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  /** Retained typed-array payload only; excludes Maps, objects and JS heap. */
  readonly typedArrayBytes: number;
}

interface Page {
  x: number;
  y: number;
  z: number;
  readonly blocks: Uint16Array;
  readonly valid: Uint32Array;
}

/** Generation-only, spacing-1 integer world cells. The owner must clear this
 * cache on every context init (world, seed, generation or variant). Never feed
 * edits or chunk buffers here: those buffers can be edited or transferred.
 * Pages are lazy so a sky query does not generate the rest of its 32³ owner. */
export class BlockSampleCache {
  private readonly pages = new Map<string, Page>();
  private last: Page | undefined;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private readonly pageLimit = BLOCK_SAMPLE_PAGE_LIMIT) {
    if (!Number.isSafeInteger(pageLimit) || pageLimit < 1)
      throw new RangeError(
        "Block sample page limit must be a positive integer",
      );
  }

  clear(): void {
    this.pages.clear();
    this.last = undefined;
    this.hits = this.misses = this.evictions = 0;
  }

  sample(
    area: WorldAreaSampler,
    x: number,
    y: number,
    z: number,
    column: Float64Array,
    voxel: VoxelSample,
  ): number {
    let page = this.last;
    // Consecutive vertical samples usually share a page. It is already MRU;
    // avoiding key creation and Map updates here does not change LRU order.
    if (
      !page ||
      x < page.x ||
      x >= page.x + EDGE ||
      y < page.y ||
      y >= page.y + EDGE ||
      z < page.z ||
      z >= page.z + EDGE
    ) {
      const px = Math.floor(x / EDGE) * EDGE,
        py = Math.floor(y / EDGE) * EDGE,
        pz = Math.floor(z / EDGE) * EDGE,
        key = `${px},${py},${pz}`;
      page = this.pages.get(key);
      if (page) this.pages.delete(key);
      else if (this.pages.size === this.pageLimit) {
        const oldest = this.pages.keys().next().value as string;
        page = this.pages.get(oldest) as Page;
        this.pages.delete(oldest);
        page.x = px;
        page.y = py;
        page.z = pz;
        page.valid.fill(0);
        this.evictions++;
      } else
        page = {
          x: px,
          y: py,
          z: pz,
          blocks: new Uint16Array(CELLS),
          valid: new Uint32Array(CELLS / 32),
        };
      this.pages.set(key, page);
      this.last = page;
    }
    const i = x - page.x + EDGE * (z - page.z + EDGE * (y - page.y)),
      word = i >>> 5,
      bit = 1 << (i & 31);
    if (((page.valid[word] as number) & bit) !== 0) {
      this.hits++;
      return page.blocks[i] as number;
    }
    this.misses++;
    // Keep the existing prepared sampler, exact cell centre and Float64 column.
    // In MAIN this includes canonical crumb cleanup and owned-fluid refill.
    const block = area.sampleVoxel(
      x + 0.5,
      y + 0.5,
      z + 0.5,
      voxel,
      column,
    ).block;
    page.blocks[i] = block;
    page.valid[word] = (page.valid[word] as number) | bit;
    return block;
  }

  statistics(): BlockSampleCacheStats {
    return {
      pages: this.pages.size,
      pageLimit: this.pageLimit,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      typedArrayBytes: this.pages.size * BLOCK_SAMPLE_PAGE_BYTES,
    };
  }
}
