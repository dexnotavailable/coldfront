import { Frustum, Matrix4, PerspectiveCamera, Vector3 } from "three";
import type { LayerId } from "../../../shared/src/world/types.js";
import type { Point } from "../game/raycast.js";
import type { ChunkStore } from "./chunk-store.js";
import {
  type FarRendererOptions,
  type FarRenderHandle,
  FarTerrainRenderer,
} from "./far-terrain-renderer.js";
import {
  type FarSelectionPlan,
  type FarView,
  type NearCoverageColumn,
  planFarTerrain,
} from "./far-terrain-selection.js";
import { FarTerrainStore } from "./far-terrain-store.js";
import { createFarVisibilityBounds } from "./far-visibility-bounds.js";

/** docs04 §13.5 and catalogue set.video.reach; this is the shipped default. */
export const DEFAULT_FAR_REACH = 16_000;
export const FAR_NEAR_PLANE = 200;
export const FRAME_UPLOAD_PARTS = 8;
export const DEFAULT_NEAR_REACH = 192;

export function renderOrigin(position: Point): Point {
  return {
    x: Math.floor(position.x / 1024) * 1024,
    y: 0,
    z: Math.floor(position.z / 1024) * 1024,
  };
}

/** Complete column bounds must fit the depth range. A nominal XZ radius is not proof. */
export function columnFitsNearDepth(
  column: NearCoverageColumn,
  camera: PerspectiveCamera,
): boolean {
  const point = new Vector3();
  for (const x of [column.minX, column.maxX])
    for (const y of [column.minY, column.maxY])
      for (const z of [column.minZ, column.maxZ]) {
        const depth = -point
          .set(x, y, z)
          .applyMatrix4(camera.matrixWorldInverse).z;
        if (depth < camera.near || depth > camera.far) return false;
      }
  return true;
}

export interface FarWorldView {
  readonly position: Point;
  readonly target: Point;
  readonly fov: number;
  readonly aspect: number;
  readonly pixelHeight: number;
  readonly reach?: number;
  /** Candidate cut must be known before its first selection/preparation. */
  readonly cut?: number;
}

/** One candidate/active session and layer. A candidate has its own store and
 * batches, but always shares the near store's existing terrain worker pool. */
export class FarWorld {
  readonly renderer: FarTerrainRenderer;
  readonly store: FarTerrainStore<FarRenderHandle>;
  readonly camera = new PerspectiveCamera(
    40,
    1,
    FAR_NEAR_PLANE,
    DEFAULT_FAR_REACH,
  );
  private readonly scheduler: ReturnType<ChunkStore["createFarScheduler"]>;
  private readonly unsubscribe: () => void;
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private plan: FarSelectionPlan | null = null;
  private selectionView: FarWorldView | null = null;
  private cut = Infinity;
  private boundsDirty = false;
  private selectionCommitted = false;
  private signature = "";
  private frozen = false;
  private postcardWork = false;
  private disposed = false;
  private restoring = false;
  private suspended = false;
  constructor(
    readonly near: ChunkStore,
    readonly layer: LayerId,
    options: FarRendererOptions,
  ) {
    this.scheduler = near.createFarScheduler(layer);
    this.renderer = new FarTerrainRenderer(options);
    this.store = new FarTerrainStore(
      near.world,
      layer,
      this.scheduler,
      this.renderer,
    );
    this.unsubscribe = near.subscribeEdits((edit) => {
      this.store.invalidateEdit(edit);
      this.refreshSelection();
    });
  }
  get worldId(): number {
    return this.near.world.id;
  }
  get reach(): number {
    return this.camera.far;
  }
  get cutHeight(): number {
    return this.cut;
  }
  /** Frozen captures and navigation select once before their unbounded/bounded upload loop. */
  select(view: FarWorldView, frozen = false, postcard = frozen): Promise<void> {
    if (this.disposed) throw new Error("Far world disposed");
    this.frozen = frozen;
    this.postcardWork = postcard;
    this.cut = view.cut ?? this.cut;
    this.renderer.setCut(this.cut);
    this.selectionView = {
      ...view,
      position: { ...view.position },
      target: { ...view.target },
      cut: this.cut,
    };
    this.boundsDirty = false;
    this.selectionCommitted = false;
    this.camera.position.set(view.position.x, view.position.y, view.position.z);
    this.camera.lookAt(view.target.x, view.target.y, view.target.z);
    this.camera.fov = view.fov;
    this.camera.aspect = view.aspect;
    this.camera.near = FAR_NEAR_PLANE;
    this.camera.far = view.reach ?? DEFAULT_FAR_REACH;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      ),
      this.camera.coordinateSystem,
      this.camera.reversedDepth,
    );
    const selection: FarView = {
      x: view.position.x,
      y: view.position.y,
      z: view.position.z,
      fovYRadians: (view.fov * Math.PI) / 180,
      pixelHeight: view.pixelHeight,
      reach: this.camera.far,
      planes: this.frustum.planes.map((p) => ({
        x: p.normal.x,
        y: p.normal.y,
        z: p.normal.z,
        constant: p.constant,
      })),
    };
    this.plan = planFarTerrain(selection, {
      layer: this.layer,
      heightBounds: createFarVisibilityBounds(this.near.context, {
        layer: this.layer,
        camera: view.position,
        cut: this.cut,
        edits: this.near.edits.values(),
      }),
      ...(this.plan ? { previouslyRefined: this.plan.refined } : {}),
    });
    this.signature = this.viewSignature(view);
    return this.store.requestPlan(this.plan, postcard);
  }
  private viewSignature(view: FarWorldView): string {
    const dx = view.target.x - view.position.x,
      dy = view.target.y - view.position.y,
      dz = view.target.z - view.position.z;
    return [
      Math.floor(view.position.x / 16),
      Math.floor(view.position.y / 8),
      Math.floor(view.position.z / 16),
      Math.round((Math.atan2(dx, dz) * 180) / Math.PI),
      Math.round((Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI),
      view.fov,
      view.aspect,
      view.pixelHeight,
      view.reach ?? DEFAULT_FAR_REACH,
      view.cut ?? this.cut,
    ].join(",");
  }
  /** Stream on a 16 m / 1 degree grid; frozen views always plan the exact camera. */
  stream(view: FarWorldView): void {
    if (this.frozen || this.disposed || this.suspended || this.restoring)
      return;
    if (this.signature !== this.viewSignature(view)) void this.select(view);
  }
  unfreeze(): void {
    this.frozen = false;
    this.postcardWork = false;
    this.signature = "";
  }
  private refreshSelection(): void {
    this.boundsDirty = true;
    this.selectionCommitted = false;
    if (
      !this.selectionView ||
      this.disposed ||
      this.suspended ||
      this.restoring
    )
      return;
    // Frozen means fixed camera/quality, not stale cuts or edited geometry.
    void this.select(
      { ...this.selectionView, cut: this.cut },
      this.frozen,
      this.postcardWork,
    );
  }
  setPresentation(
    origin: Point,
    cut: number,
    coverage: readonly NearCoverageColumn[],
  ): void {
    const old = this.renderer.origin;
    if (old.x !== origin.x || old.y !== origin.y || old.z !== origin.z)
      this.renderer.setOrigin(origin.x, origin.y, origin.z);
    const changed = this.cut !== cut;
    this.cut = cut;
    this.renderer.setCut(cut);
    this.renderer.setNearCoverage(coverage);
    if (changed) this.refreshSelection();
  }
  drain(partBudget: number): number {
    if (partBudget === Infinity && !(this.frozen && this.postcardWork))
      throw new Error(
        "Unbounded far uploads require a frozen postcard selection",
      );
    if (this.disposed || this.suspended) return 0;
    let spent = 0;
    if (this.restoring) {
      const restored = this.renderer.restoreContext(partBudget);
      spent = restored.parts;
      if (!restored.ready) return spent;
      this.restoring = false;
      this.store.contextRestored();
      this.store.retryFailures();
      if (this.boundsDirty) this.refreshSelection();
      else if (this.plan)
        void this.store.requestPlan(this.plan, this.postcardWork);
    }
    spent += this.store.drainUploads(partBudget - spent);
    this.store.commitVisible();
    this.store.retainPlan();
    this.selectionCommitted = true;
    return spent;
  }
  assertPrepared(): void {
    const error = this.error;
    if (error) throw error;
    if (!this.ready) throw new Error("Far target is not prepared");
  }
  get error(): Error | null {
    return this.store.currentFailure;
  }
  get ready(): boolean {
    return (
      !this.suspended &&
      !this.restoring &&
      this.selectionCommitted &&
      this.store.status.ready
    );
  }
  suspend(): void {
    this.suspended = true;
    this.store.contextLost();
  }
  resume(): void {
    if (!this.suspended || this.disposed) return;
    this.suspended = false;
    if (this.restoring) return;
    this.store.contextRestored();
    this.store.retryFailures();
    if (this.boundsDirty) this.refreshSelection();
    else if (this.plan)
      void this.store.requestPlan(this.plan, this.postcardWork);
  }
  contextLost(): void {
    this.store.contextLost(); // Cancel partial tickets before batch recovery.
    this.renderer.contextLost();
    this.restoring = true;
  }
  get telemetry() {
    const status = this.store.status;
    const lod = [0, 0, 0, 0, 0, 0, 0];
    for (const key of status.visible) {
      // Canonical packFarTileKey: the lod occupies the quotient above 352².
      // Decode the committed keys, including retained nodes from an older plan.
      const level = Math.floor(key / (352 * 352)) + 2;
      lod[level] = (lod[level] ?? 0) + 1;
    }
    return {
      ...status,
      ready: this.ready,
      layer: this.layer,
      reach: this.reach,
      targetTiles: this.plan?.leaves.length ?? 0,
      lod,
      frozen: this.frozen,
      restoring: this.restoring,
      cut: Number.isFinite(this.cut) ? this.cut : null,
      error: this.error?.message ?? null,
    };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.store.dispose();
    this.scheduler.dispose();
    this.renderer.dispose();
  }
}
