import type { LayerId } from "../../../shared/src/world/types.js";
import {
  farSpacing,
  packFarTileKey,
} from "../../../shared/src/worldgen/far/coordinates.js";
import type {
  FarTileAddress,
  FarTileMesh,
  FarTileRequest,
  FarTileRuns,
} from "../../../shared/src/worldgen/far/types.js";
import type { WorldSession } from "../contracts/game-ui.js";
import { sameSession } from "../game/session.js";
import {
  type FarCoverage,
  type FarSelectionNode,
  type FarSelectionPlan,
  farSkirtMask,
  selectFarCoverage,
} from "./far-terrain-selection.js";

export interface FarGenerationRequest extends FarTileRequest {
  readonly id: number;
  readonly world: WorldSession;
  readonly priority: number;
  readonly postcard: boolean;
}
export interface FarGenerationResult extends FarTileRequest {
  readonly id: number;
  readonly world: WorldSession;
  readonly runs: FarTileRuns;
  readonly mesh: FarTileMesh;
}
/** The caller injects the existing shared worker pool; this store spawns none. */
export interface FarScheduler {
  request(request: FarGenerationRequest): Promise<FarGenerationResult>;
  /** Remove queued work; running synchronous work may finish and be rejected. */
  cancel(id: number): void;
}
export interface FarUploadTicket<Handle> {
  readonly partCount: number;
  uploadPart(index: number): void;
  /** Must perform/attest an actual offscreen GPU draw, not merely compile. */
  prepare(): Handle;
  cancel(): void;
}
export interface FarVisibleTile<Handle> {
  readonly handle: Handle;
  readonly skirts: number;
}
export interface FarUploadAdapter<Handle> {
  begin(result: FarGenerationResult): FarUploadTicket<Handle>;
  /** One synchronous transaction; no frame may see half of this replacement. */
  commit(tiles: readonly FarVisibleTile<Handle>[]): void;
  release(handle: Handle): void;
}
interface StoredFarTile<Handle> {
  readonly address: FarTileAddress;
  revision: number;
  wanted: boolean;
  request: FarGenerationRequest | null;
  result: FarGenerationResult | null;
  upload: FarUploadTicket<Handle> | null;
  uploadedParts: number;
  ready: { handle: Handle; revision: number } | null;
  failedRevision: number | null;
  error: Error | null;
}
export interface FarStoreStatus {
  readonly requested: number;
  readonly awaitingUpload: number;
  readonly prepared: number;
  readonly failed: number;
  readonly visible: readonly number[];
  readonly ready: boolean;
}
export class FarTerrainStore<Handle> {
  private readonly tiles = new Map<number, StoredFarTile<Handle>>();
  private readonly retired: Handle[] = [];
  private readonly pending = new Map<number, Promise<void>>();
  private plan: FarSelectionPlan | null = null;
  private serial = 0;
  private stopped = false;
  private lost = false;
  private drawn: readonly number[] = [];
  private visibleNodes: readonly FarSelectionNode[] = [];
  private balanced = false;
  onFailure: (error: Error, request: FarTileRequest) => void = () => {};
  constructor(
    readonly world: WorldSession,
    readonly layer: LayerId,
    private readonly scheduler: FarScheduler,
    private readonly uploads: FarUploadAdapter<Handle>,
  ) {}
  setPlan(plan: FarSelectionPlan): void {
    if (this.stopped) throw new Error("Far store disposed");
    if (plan.layer !== this.layer)
      throw new Error("Far plan belongs to another layer");
    this.plan = plan;
    const wanted = new Set(plan.requests.map((node) => node.key));
    for (const [key, tile] of this.tiles) {
      tile.wanted = wanted.has(key);
      if (!tile.wanted) this.cancel(tile);
    }
    for (const node of plan.requests)
      if (!this.tiles.has(node.key))
        this.tiles.set(node.key, {
          address: node.address,
          revision: 0,
          wanted: true,
          request: null,
          result: null,
          upload: null,
          uploadedParts: 0,
          ready: null,
          failedRevision: null,
          error: null,
        });
  }
  /** Resolves after generation; Ready additionally requires drainUploads+commit. */
  async requestPlan(plan: FarSelectionPlan, postcard = false): Promise<void> {
    this.setPlan(plan);
    if (this.lost) return;
    await Promise.all(
      plan.requests.map((node, priority) => {
        const tile = this.tiles.get(node.key);
        return tile
          ? this.request(tile, priority, postcard)
          : Promise.resolve();
      }),
    );
  }
  private request(
    tile: StoredFarTile<Handle>,
    priority: number,
    postcard: boolean,
  ): Promise<void> {
    if (tile.request)
      return this.pending.get(tile.request.id) ?? Promise.resolve();
    if (
      this.stopped ||
      this.lost ||
      !tile.wanted ||
      tile.result ||
      tile.upload ||
      tile.ready?.revision === tile.revision ||
      tile.failedRevision === tile.revision
    )
      return Promise.resolve();
    const request: FarGenerationRequest = {
      world: this.world,
      layer: this.layer,
      address: tile.address,
      revision: tile.revision,
      id: ++this.serial,
      priority,
      postcard,
    };
    tile.request = request;
    const pending = this.runRequest(tile, request);
    this.pending.set(request.id, pending);
    void pending.then(
      () => this.pending.delete(request.id),
      () => this.pending.delete(request.id),
    );
    return pending;
  }
  private async runRequest(
    tile: StoredFarTile<Handle>,
    request: FarGenerationRequest,
  ): Promise<void> {
    try {
      const result = await this.scheduler.request(request);
      if (
        this.stopped ||
        this.lost ||
        !tile.wanted ||
        tile.request !== request ||
        tile.revision !== request.revision
      )
        return;
      if (
        !sameSession(this.world, result.world) ||
        result.id !== request.id ||
        result.layer !== this.layer ||
        result.revision !== tile.revision ||
        packFarTileKey(result.address) !== packFarTileKey(tile.address) ||
        result.runs.layer !== this.layer ||
        result.runs.revision !== tile.revision ||
        packFarTileKey(result.runs.address) !== packFarTileKey(tile.address)
      )
        throw new Error("Far result identity mismatch");
      tile.result = result;
      tile.error = null;
    } catch (error) {
      if (
        !this.stopped &&
        !this.lost &&
        tile.wanted &&
        tile.request === request &&
        tile.revision === request.revision
      )
        this.fail(tile, error);
    } finally {
      if (tile.request === request) tile.request = null;
    }
  }
  private fail(tile: StoredFarTile<Handle>, error: unknown): void {
    tile.error = error instanceof Error ? error : new Error(String(error));
    tile.failedRevision = tile.revision;
    tile.upload?.cancel();
    tile.upload = null;
    tile.result = null;
    tile.uploadedParts = 0;
    this.onFailure(tile.error, {
      address: tile.address,
      layer: this.layer,
      revision: tile.revision,
    });
  }
  /** Pass the REMAINING shared eight-part frame budget, or Infinity for postcards. */
  drainUploads(partBudget: number): number {
    if (
      (!Number.isInteger(partBudget) && partBudget !== Infinity) ||
      partBudget < 0
    )
      throw new RangeError("Invalid far upload budget");
    if (this.stopped || this.lost || !this.plan) return 0;
    let spent = 0;
    for (const node of this.plan.requests) {
      const tile = this.tiles.get(node.key);
      if (!tile?.wanted || (!tile.result && !tile.upload)) continue;
      try {
        if (!tile.upload && tile.result)
          tile.upload = this.uploads.begin(tile.result);
        const upload = tile.upload;
        if (!upload) continue;
        while (tile.uploadedParts < upload.partCount && spent < partBudget) {
          upload.uploadPart(tile.uploadedParts++);
          spent++;
        }
        // An empty generated child still crosses the preparation boundary.
        if (tile.uploadedParts === upload.partCount) {
          const handle = upload.prepare();
          if (tile.ready) this.retired.push(tile.ready.handle);
          tile.ready = { handle, revision: tile.revision };
          tile.upload = null;
          tile.result = null;
          tile.uploadedParts = 0;
        }
      } catch (error) {
        this.fail(tile, error);
      }
    }
    return spent;
  }
  commitVisible(): FarCoverage {
    if (this.stopped || this.lost || !this.plan)
      return { tiles: [], covered: false, atTarget: false, balanced: false };
    const drawable = (node: FarSelectionNode) =>
      !!this.tiles.get(node.key)?.ready;
    const covered = (node: FarSelectionNode): boolean =>
      drawable(node) ||
      (node.children.length > 0 && node.children.every(covered));
    let retained = false;
    const roots = this.plan.roots.map((root) => {
      if (covered(root)) return root;
      // A coarser plan can omit the children that still supply its only
      // drawable coverage. Retain that root's committed cut while other roots
      // continue loading. Roots outside the new view are deliberately omitted.
      const children = this.visibleNodes.filter(
        (node) =>
          drawable(node) &&
          node.bounds.minX >= root.bounds.minX &&
          node.bounds.maxX <= root.bounds.maxX &&
          node.bounds.minZ >= root.bounds.minZ &&
          node.bounds.maxZ <= root.bounds.maxZ,
      );
      if (!children.length) return root;
      retained = true;
      // Retain exactly the drawn cut, not its old refinement descendants.
      return {
        ...root,
        children: children.map((node) => ({ ...node, children: [] })),
      };
    });
    const cut = selectFarCoverage(
      retained
        ? {
            ...this.plan,
            roots,
            // Keep the normal neighbor-balancing pass over the combined cut.
            // Current nodes take precedence when an address occurs in both.
            requests: [
              ...new Map(
                [...this.visibleNodes, ...this.plan.requests].map((node) => [
                  node.key,
                  node,
                ]),
              ).values(),
            ],
          }
        : this.plan,
      drawable,
    );
    if (!cut.balanced) {
      this.balanced = false;
      // Readiness races must not expose a several-level seam for one frame.
      // Existing geometry remains pinned until a balanced replacement exists.
      return {
        tiles: this.visibleNodes,
        covered: false,
        atTarget: false,
        balanced: false,
      };
    }
    const visible = cut.tiles.map((node) => {
      const ready = this.tiles.get(node.key)?.ready;
      if (!ready) throw new Error("Far coverage lost its prepared tile");
      return { handle: ready.handle, skirts: farSkirtMask(node, cut.tiles) };
    });
    this.uploads.commit(visible);
    this.drawn = cut.tiles.map((node) => node.key);
    this.visibleNodes = cut.tiles;
    this.balanced = cut.balanced;
    for (const handle of this.retired.splice(0)) this.uploads.release(handle);
    // A stale visual fallback is allowed; it can never satisfy readiness.
    // Retained children can cover only the previous view's part of a root.
    return {
      ...cut,
      covered: cut.covered && !retained,
      atTarget: cut.atTarget && !retained && this.freshLeaves(),
    };
  }
  private freshLeaves(): boolean {
    return (
      !!this.plan &&
      this.plan.leaves.every((node) => {
        const tile = this.tiles.get(node.key);
        return !!tile?.ready && tile.ready.revision === tile.revision;
      })
    );
  }
  /** Invalidate ancestors AND neighboring tiles whose one-column halo sees it. */
  invalidateEdit(edit: Readonly<{ x: number; y: number; z: number }>): void {
    if (![edit.x, edit.y, edit.z].every(Number.isInteger))
      throw new RangeError("Invalid far edit");
    for (const tile of this.tiles.values()) {
      const spacing = farSpacing(tile.address);
      const width = spacing * 32;
      const x = tile.address.tx * width;
      const z = tile.address.tz * width;
      if (
        edit.x < x - spacing ||
        edit.x >= x + width + spacing ||
        edit.z < z - spacing ||
        edit.z >= z + width + spacing
      )
        continue;
      this.cancel(tile);
      tile.revision++;
      tile.failedRevision = null;
      tile.error = null;
    }
  }
  /** Call after commit: previous visibility may still reference these handles. */
  retainPlan(): void {
    const visible = new Set(this.drawn);
    for (const [key, tile] of this.tiles)
      if (!tile.wanted && !visible.has(key)) {
        this.cancel(tile);
        if (tile.ready) this.uploads.release(tile.ready.handle);
        this.tiles.delete(key);
      }
  }
  retryFailures(): void {
    for (const tile of this.tiles.values()) tile.failedRevision = null;
  }
  private cancel(tile: StoredFarTile<Handle>): void {
    const request = tile.request;
    tile.request = null;
    if (request) this.scheduler.cancel(request.id);
    tile.upload?.cancel();
    tile.upload = null;
    tile.result = null;
    tile.uploadedParts = 0;
  }
  /** Renderer retains/recreates its batch CPU data; in-flight work is cancelled. */
  contextLost(): void {
    this.lost = true;
    for (const tile of this.tiles.values()) this.cancel(tile);
  }
  /** Call only after renderer.restoreContext completed its real GPU preparation. */
  contextRestored(): void {
    if (!this.stopped) this.lost = false;
  }
  /** Current selection/revision authority; retained historical failures and
   * explicitly retried revisions must not become permanent runtime errors. */
  get currentFailure(): Error | null {
    for (const tile of this.tiles.values())
      if (tile.wanted && tile.failedRevision === tile.revision && tile.error)
        return tile.error;
    return null;
  }
  get status(): FarStoreStatus {
    const tiles = [...this.tiles.values()];
    return {
      requested: tiles.filter((tile) => tile.request).length,
      awaitingUpload: tiles.filter((tile) => tile.result || tile.upload).length,
      prepared: tiles.filter((tile) => tile.ready).length,
      failed: tiles.filter((tile) => tile.error).length,
      visible: [...this.drawn],
      ready:
        !this.stopped &&
        !this.lost &&
        this.balanced &&
        this.freshLeaves() &&
        !!this.plan &&
        this.plan.leaves.every((node) => this.drawn.includes(node.key)),
    };
  }
  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.uploads.commit([]);
    for (const tile of this.tiles.values()) {
      this.cancel(tile);
      if (tile.ready) this.uploads.release(tile.ready.handle);
    }
    for (const handle of this.retired.splice(0)) this.uploads.release(handle);
    this.tiles.clear();
    this.drawn = [];
    this.visibleNodes = [];
    this.plan = null;
  }
}
