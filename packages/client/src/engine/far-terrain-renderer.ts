import {
  BatchedMesh,
  BufferAttribute,
  BufferGeometry,
  Group,
  type Material,
  Matrix4,
  Vector3,
} from "three";
import { WORLD_MIN_Y } from "../../../shared/src/world/constants.js";
import { farSpacing } from "../../../shared/src/worldgen/far/coordinates.js";
import type {
  FarMeshPart,
  FarTileRuns,
} from "../../../shared/src/worldgen/far/types.js";
import type { WorldSession } from "../contracts/game-ui.js";
import type { NearCoverageColumn } from "./far-terrain-selection.js";
import type {
  FarGenerationResult,
  FarUploadAdapter,
  FarUploadTicket,
  FarVisibleTile,
} from "./far-terrain-store.js";

export interface FarRenderHandle {
  readonly id: number;
  readonly world: WorldSession;
  /** Retained compact occupancy for cut caps; never a synthetic tall voxel cube. */
  readonly runs: FarTileRuns;
}
export interface FarGpuPreparation {
  readonly handle: FarRenderHandle;
  readonly group: Group;
  readonly batches: readonly BatchedMesh[];
}
export interface FarCapHooks {
  prepare(handle: FarRenderHandle, group: Group): void;
  setVisible(handle: FarRenderHandle, visible: boolean): void;
  setCut(height: number, coverage: readonly NearCoverageColumn[]): void;
  release(handle: FarRenderHandle): void;
  contextLost(): void;
  contextRestored(handle: FarRenderHandle): void;
}
export interface FarRendererOptions {
  /** Five FAR-mode material variants supplied by the existing terrain factory. */
  readonly materials: readonly Material[];
  /** Synchronous offscreen draw + GL/context check; compilation alone is invalid. */
  readonly prepareGpu: (probe: FarGpuPreparation) => void;
  readonly caps?: FarCapHooks;
  readonly onNearCoverage?: (columns: readonly NearCoverageColumn[]) => void;
  readonly pageVertices?: number;
  readonly pageIndices?: number;
  readonly pageInstances?: number;
  readonly maxPages?: number;
  readonly maxGeometryBytes?: number;
}
interface Page {
  readonly batch: BatchedMesh;
  readonly key: string;
  readonly vertices: number;
  readonly indices: number;
  readonly bytes: number;
  usedVertices: number;
  usedIndices: number;
  live: number;
}
interface Slot {
  readonly kind: number;
  readonly side: number;
  readonly origin: Vector3;
  readonly indexCount: number;
  page: Page | null;
  geometryId: number;
  instanceId: number;
  /** Present before first upload or during context recovery only. */
  geometry: BufferGeometry | null;
}
interface Tile {
  readonly handle: FarRenderHandle;
  readonly slots: Slot[];
  readonly expectedParts: number;
  ready: boolean;
  visible: boolean;
  skirts: number;
  capsPrepared: boolean;
}
export class FarRenderCapacityError extends Error {
  override readonly name = "FarRenderCapacityError";
}
function makeGeometry(part: FarMeshPart): BufferGeometry {
  const count = part.positions.length / 3;
  if (
    !Number.isInteger(count) ||
    part.normals.length !== count * 3 ||
    part.expansions.length !== count * 3 ||
    part.surfaces.length !== count * 3 ||
    part.featureIdParts.length !== count * 2 ||
    part.indices.length % 3 !== 0
  )
    throw new Error("Far mesh attributes do not share the vertex ABI");
  if (
    !part.positions.every(Number.isFinite) ||
    part.indices.some((index) => index >= count)
  )
    throw new Error("Far mesh has invalid positions or indices");
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(part.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(part.normals, 3));
  geometry.setAttribute("aExpand", new BufferAttribute(part.expansions, 3));
  geometry.setAttribute("aSurface", new BufferAttribute(part.surfaces, 3));
  geometry.setAttribute(
    "aFeatureIdParts",
    new BufferAttribute(part.featureIdParts, 2, false),
  );
  geometry.setIndex(new BufferAttribute(part.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
/** Copies a live range from public combined CPU attributes, with local indices. */
function recoverGeometry(slot: Slot): BufferGeometry {
  const page = slot.page;
  const range = page?.batch.getGeometryRangeAt(slot.geometryId);
  if (!page || !range)
    throw new Error("Cannot recover missing far batch geometry");
  const geometry = new BufferGeometry();
  for (const [name, raw] of Object.entries(page.batch.geometry.attributes)) {
    const attribute = raw as BufferAttribute;
    const start = range.vertexStart * attribute.itemSize;
    const end = start + range.vertexCount * attribute.itemSize;
    geometry.setAttribute(
      name,
      new BufferAttribute(
        attribute.array.slice(start, end),
        attribute.itemSize,
        attribute.normalized,
      ),
    );
  }
  const source = page.batch.geometry.getIndex();
  if (!source) throw new Error("Far batch index missing");
  const indices = new Uint32Array(range.indexCount);
  for (let index = 0; index < indices.length; index++)
    indices[index] = source.getX(range.indexStart + index) - range.vertexStart;
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** GPU page owner only. No scene pass, material taste, or worker ownership. */
export class FarTerrainRenderer implements FarUploadAdapter<FarRenderHandle> {
  readonly group = new Group();
  readonly origin = new Vector3();
  private readonly pages: Page[] = [];
  private readonly tiles = new Map<number, Tile>();
  private readonly matrix = new Matrix4();
  private serial = 0;
  private lost = false;
  private disposed = false;
  private coverage: readonly NearCoverageColumn[] = [];
  private cut = Infinity;
  private readonly pageVertices: number;
  private readonly pageIndices: number;
  private readonly pageInstances: number;
  private readonly maxPages: number;
  private readonly maxBytes: number;
  constructor(private readonly options: FarRendererOptions) {
    if (options.materials.length !== 5)
      throw new Error("Far renderer needs five material classes");
    this.pageVertices = options.pageVertices ?? 65_536;
    this.pageIndices = options.pageIndices ?? 98_304;
    this.pageInstances = options.pageInstances ?? 64;
    this.maxPages = options.maxPages ?? 64;
    this.maxBytes = options.maxGeometryBytes ?? 256 * 1024 * 1024;
    if (
      ![
        this.pageVertices,
        this.pageIndices,
        this.pageInstances,
        this.maxPages,
        this.maxBytes,
      ].every((n) => Number.isSafeInteger(n) && n > 0)
    )
      throw new RangeError("Invalid far page capacity");
    this.group.name = "far-terrain";
  }
  begin(result: FarGenerationResult): FarUploadTicket<FarRenderHandle> {
    if (this.disposed || this.lost) throw new Error("Far renderer unavailable");
    const spacing = farSpacing(result.address);
    const origin = new Vector3(
      result.address.tx * 32 * spacing,
      WORLD_MIN_Y,
      result.address.tz * 32 * spacing,
    );
    const parts: { part: FarMeshPart; kind: number; side: number }[] = [];
    if (
      result.mesh.parts.length !== 5 ||
      result.mesh.skirts.length !== 4 ||
      result.mesh.skirts.some((side) => side.length !== 5)
    )
      throw new Error("Far mesh draw classes do not match the contract");
    result.mesh.parts.forEach((part, kind) => {
      if (part.indices.length) parts.push({ part, kind, side: -1 });
    });
    result.mesh.skirts.forEach((sideParts, side) => {
      sideParts.forEach((part, kind) => {
        if (part.indices.length) parts.push({ part, kind, side });
      });
    });
    const tile: Tile = {
      handle: Object.freeze({
        id: ++this.serial,
        world: result.world,
        runs: result.runs,
      }),
      slots: [],
      expectedParts: parts.length,
      ready: false,
      visible: false,
      skirts: 0,
      capsPrepared: false,
    };
    this.tiles.set(tile.handle.id, tile);
    const count = parts.length;
    let cancelled = false;
    return {
      partCount: count,
      uploadPart: (index) => {
        if (cancelled || tile.ready || this.lost || this.disposed)
          throw new Error("Far upload is no longer active");
        if (index !== tile.slots.length || index >= count)
          throw new RangeError("Far parts must upload once in order");
        const item = parts[index];
        if (!item) throw new Error("Far upload part missing");
        const slot: Slot = {
          kind: item.kind,
          side: item.side,
          origin,
          indexCount: item.part.indices.length,
          page: null,
          geometryId: -1,
          instanceId: -1,
          geometry: makeGeometry(item.part),
        };
        tile.slots.push(slot);
        this.allocate(slot);
      },
      prepare: () => {
        if (
          cancelled ||
          this.lost ||
          this.disposed ||
          tile.slots.length !== count
        )
          throw new Error("Far upload is not complete");
        this.prepareTile(tile, false);
        parts.length = 0;
        return tile.handle;
      },
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        parts.length = 0;
        this.release(tile.handle);
      },
    };
  }
  private allocate(slot: Slot): void {
    const geometry = slot.geometry;
    if (!geometry) throw new Error("Far upload geometry missing");
    const vertices = geometry.getAttribute("position").count;
    const indices = geometry.getIndex()?.count ?? 0;
    const key = `${Math.floor(slot.origin.x / 4096)},${Math.floor(slot.origin.z / 4096)},${slot.kind}`;
    let page = this.pages.find(
      (p) =>
        p.key === key &&
        p.live < this.pageInstances &&
        p.usedVertices + vertices <= p.vertices &&
        p.usedIndices + indices <= p.indices,
    );
    if (!page) {
      const maxVertices = Math.max(this.pageVertices, vertices);
      const maxIndices = Math.max(this.pageIndices, indices);
      // Position/normal/surface float3 + expand int8x3 + feature uint16x2.
      const bytes =
        maxVertices * 43 + maxIndices * (maxVertices > 65_535 ? 4 : 2);
      if (
        this.pages.length >= this.maxPages ||
        this.pages.reduce((sum, p) => sum + p.bytes, bytes) > this.maxBytes
      )
        throw new FarRenderCapacityError(
          "Far batch capacity exceeded; retain the prepared ancestor",
        );
      const material = this.options.materials[slot.kind];
      if (!material) throw new Error("Far material class missing");
      const batch = new BatchedMesh(
        this.pageInstances,
        maxVertices,
        maxIndices,
        material,
      );
      batch.name = `far-page:${key}`;
      batch.position.copy(this.origin);
      batch.castShadow = false;
      batch.receiveShadow = false;
      // Per-object bounds are maintained; the aggregate bound is not cached.
      batch.frustumCulled = false;
      batch.perObjectFrustumCulled = true;
      batch.sortObjects = true;
      page = {
        batch,
        key,
        vertices: maxVertices,
        indices: maxIndices,
        bytes,
        usedVertices: 0,
        usedIndices: 0,
        live: 0,
      };
      this.pages.push(page);
      this.group.add(batch);
    }
    const geometryId = page.batch.addGeometry(geometry);
    let instanceId: number;
    try {
      instanceId = page.batch.addInstance(geometryId);
    } catch (error) {
      page.batch.deleteGeometry(geometryId);
      // addGeometry advanced its append cursor even if instance allocation failed.
      page.usedVertices += vertices;
      page.usedIndices += indices;
      throw error;
    }
    page.usedVertices += vertices;
    page.usedIndices += indices;
    page.live++;
    slot.page = page;
    slot.geometryId = geometryId;
    slot.instanceId = instanceId;
    page.batch.setMatrixAt(
      instanceId,
      this.matrix.makeTranslation(
        slot.origin.x - this.origin.x,
        slot.origin.y - this.origin.y,
        slot.origin.z - this.origin.z,
      ),
    );
    page.batch.setVisibleAt(instanceId, false);
    geometry.dispose();
    slot.geometry = null;
  }
  private prepareTile(tile: Tile, restoring: boolean): void {
    if (tile.ready) return;
    if (
      tile.slots.length !== tile.expectedParts ||
      tile.slots.some((slot) => !slot.page)
    )
      throw new Error("Far tile has missing upload parts");
    if (restoring && tile.capsPrepared)
      this.options.caps?.contextRestored(tile.handle);
    if (!tile.capsPrepared) {
      this.options.caps?.prepare(tile.handle, this.group);
      tile.capsPrepared = true;
      this.options.caps?.setCut(this.cut, this.coverage);
    }
    const batches = [
      ...new Set(tile.slots.map((slot) => slot.page?.batch)),
    ].filter((batch): batch is BatchedMesh => !!batch);
    const culling = batches.map((batch) => batch.perObjectFrustumCulled);
    const visible = this.group.visible;
    const slots = tile.slots.map(
      (slot) => slot.page?.batch.getVisibleAt(slot.instanceId) ?? false,
    );
    try {
      this.group.visible = true;
      batches.forEach((batch) => {
        batch.perObjectFrustumCulled = false;
      });
      tile.slots.forEach((slot) => {
        slot.page?.batch.setVisibleAt(slot.instanceId, true);
      });
      this.options.caps?.setVisible(tile.handle, true);
      // Caller owns the actual offscreen target, cameras and context validation.
      this.options.prepareGpu({
        handle: tile.handle,
        group: this.group,
        batches,
      });
      tile.ready = true;
    } finally {
      this.group.visible = visible;
      batches.forEach((batch, index) => {
        batch.perObjectFrustumCulled = culling[index] ?? true;
      });
      tile.slots.forEach((slot, index) => {
        slot.page?.batch.setVisibleAt(slot.instanceId, slots[index] ?? false);
      });
      this.options.caps?.setVisible(tile.handle, tile.visible && tile.ready);
    }
  }
  commit(visible: readonly FarVisibleTile<FarRenderHandle>[]): void {
    if (this.disposed) return;
    const wanted = new Map(visible.map((item) => [item.handle.id, item]));
    for (const item of visible) {
      const tile = this.tiles.get(item.handle.id);
      if (!tile || tile.handle !== item.handle || !tile.ready || this.lost)
        throw new Error("Cannot expose unprepared far tile");
    }
    for (const tile of this.tiles.values()) {
      const item = wanted.get(tile.handle.id);
      tile.visible = !!item;
      tile.skirts = item?.skirts ?? 0;
      this.applyVisibility(tile);
    }
  }
  private applyVisibility(tile: Tile): void {
    for (const slot of tile.slots)
      slot.page?.batch.setVisibleAt(
        slot.instanceId,
        tile.visible &&
          tile.ready &&
          (slot.side < 0 || (tile.skirts & (1 << slot.side)) !== 0),
      );
    this.options.caps?.setVisible(tile.handle, tile.visible && tile.ready);
  }
  setOrigin(x: number, y: number, z: number): void {
    if (![x, y, z].every(Number.isFinite))
      throw new RangeError("Invalid far render origin");
    this.origin.set(x, y, z);
    for (const page of this.pages) page.batch.position.copy(this.origin);
    for (const tile of this.tiles.values())
      for (const slot of tile.slots)
        slot.page?.batch.setMatrixAt(
          slot.instanceId,
          this.matrix.makeTranslation(
            slot.origin.x - x,
            slot.origin.y - y,
            slot.origin.z - z,
          ),
        );
    this.group.updateWorldMatrix(true, true);
  }
  setNearCoverage(columns: readonly NearCoverageColumn[]): void {
    // Root supplies the actual near camera's drawn coverage, including its far clip.
    this.coverage = columns
      .filter((column) => column.ready && column.drawn)
      .map((column) => Object.freeze({ ...column }));
    this.options.onNearCoverage?.(this.coverage);
    this.options.caps?.setCut(this.cut, this.coverage);
  }
  setCut(height: number): void {
    if (!Number.isFinite(height) && height !== Infinity)
      throw new RangeError("Invalid far cut");
    this.cut = height;
    this.options.caps?.setCut(height, this.coverage);
  }
  release(handle: FarRenderHandle): void {
    const tile = this.tiles.get(handle.id);
    if (!tile || tile.handle !== handle) return;
    this.options.caps?.release(handle);
    for (const slot of tile.slots) {
      slot.geometry?.dispose();
      const page = slot.page;
      if (!page) continue;
      page.batch.deleteGeometry(slot.geometryId); // Also deletes its instances.
      page.live--;
      if (page.live === 0) {
        this.group.remove(page.batch);
        page.batch.dispose();
        this.pages.splice(this.pages.indexOf(page), 1);
      }
    }
    this.tiles.delete(handle.id);
    // Also collect an empty page when a first addGeometry/addInstance failed.
    for (const page of [...this.pages])
      if (page.live === 0) {
        this.group.remove(page.batch);
        page.batch.dispose();
        this.pages.splice(this.pages.indexOf(page), 1);
      }
  }
  /** Explicit maintenance only; never rebuild an entire mutable batch per frame. */
  compact(): void {
    for (const page of this.pages) {
      page.batch.optimize();
      page.usedVertices = 0;
      page.usedIndices = 0;
    }
    for (const tile of this.tiles.values())
      for (const slot of tile.slots) {
        const page = slot.page;
        const range = page?.batch.getGeometryRangeAt(slot.geometryId);
        if (page && range) {
          page.usedVertices += range.reservedVertexCount;
          page.usedIndices += range.reservedIndexCount;
        }
      }
  }
  contextLost(): void {
    if (this.lost || this.disposed) return;
    this.lost = true;
    this.group.visible = false;
    this.options.caps?.contextLost();
    for (const tile of this.tiles.values()) {
      tile.ready = false;
      for (const slot of tile.slots) {
        if (slot.page) slot.geometry = recoverGeometry(slot);
        slot.page = null;
        slot.geometryId = slot.instanceId = -1;
      }
    }
    for (const page of this.pages) {
      this.group.remove(page.batch);
      page.batch.dispose();
    }
    this.pages.length = 0;
  }
  /** Uses the same shared part budget; restores real new batches, never disposed textures. */
  restoreContext(partBudget: number): {
    parts: number;
    remaining: number;
    ready: boolean;
  } {
    if (
      (!Number.isInteger(partBudget) && partBudget !== Infinity) ||
      partBudget < 0
    )
      throw new RangeError("Invalid far restore budget");
    if (this.disposed) throw new Error("Far renderer disposed");
    if (!this.lost) return { parts: 0, remaining: 0, ready: true };
    let parts = 0;
    for (const tile of this.tiles.values()) {
      for (const slot of tile.slots)
        if (!slot.page && parts < partBudget) {
          this.allocate(slot);
          parts++;
        }
      if (
        tile.slots.length === tile.expectedParts &&
        tile.slots.every((slot) => !!slot.page)
      )
        this.prepareTile(tile, true);
    }
    const remaining = [...this.tiles.values()].reduce(
      (sum, tile) =>
        sum +
        tile.slots.filter((slot) => !slot.page).length +
        tile.expectedParts -
        tile.slots.length,
      0,
    );
    const ready = [...this.tiles.values()].every((tile) => tile.ready);
    if (ready) {
      this.lost = false;
      this.group.visible = true;
      for (const tile of this.tiles.values()) this.applyVisibility(tile);
    }
    return { parts, remaining, ready };
  }
  /** Upper bounds before frustum culling; actual draws remain renderer.info's job. */
  statistics(multiDraw: boolean): {
    visibleParts: number;
    visiblePages: number;
    submissionUpperBound: number;
    trianglesUpperBound: number;
    geometryBytes: number;
    runBytes: number;
  } {
    let visibleParts = 0;
    let trianglesUpperBound = 0;
    let runBytes = 0;
    const visiblePages = new Set<Page>();
    for (const tile of this.tiles.values()) {
      runBytes +=
        tile.handle.runs.offsets.byteLength + tile.handle.runs.words.byteLength;
      for (const slot of tile.slots)
        if (
          tile.visible &&
          tile.ready &&
          slot.page &&
          (slot.side < 0 || (tile.skirts & (1 << slot.side)) !== 0)
        ) {
          visibleParts++;
          trianglesUpperBound += slot.indexCount / 3;
          visiblePages.add(slot.page);
        }
    }
    return {
      visibleParts,
      visiblePages: visiblePages.size,
      submissionUpperBound: multiDraw ? visiblePages.size : visibleParts,
      trianglesUpperBound,
      geometryBytes: this.pages.reduce((n, p) => n + p.bytes, 0),
      runBytes,
    };
  }
  dispose(): void {
    if (this.disposed) return;
    for (const tile of [...this.tiles.values()]) this.release(tile.handle);
    this.disposed = true;
    this.group.removeFromParent();
    // Materials and generated texture arrays belong to the shared material factory.
  }
}
