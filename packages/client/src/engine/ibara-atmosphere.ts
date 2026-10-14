import { Region } from "../../../shared/src/world/regions.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import { createRegionWeights } from "../../../shared/src/worldplan/geometry.js";
import type { Point } from "../game/raycast.js";

/** Only the existing, allocation-free region query crosses into presentation.
 * No voxel, feature, plan-building, postcard-ID or ToolState dependency. */
export interface WorldAtmosphereSource {
  readonly world: { readonly id: number };
  readonly context: Pick<WorldContext, "kind" | "surfaceWeights">;
}

/** Client-only standing air. World selection follows the renderer, including its
 * temporary offscreen destination and its restored source. */
export class IbaraAtmosphere {
  private readonly worlds = new Map<number, WorldAtmosphereSource["context"]>();
  private readonly weights = createRegionWeights();
  private sampledWorld = -1;
  private sampledContext: WorldAtmosphereSource["context"] | undefined;
  private x = NaN;
  private z = NaN;
  private target = 0;
  private value = 0;
  private displayMs = NaN;

  register(source: WorldAtmosphereSource): void {
    this.worlds.set(source.world.id, source.context);
  }
  remove(worldId: number): void {
    this.worlds.delete(worldId);
    if (this.sampledWorld === worldId) {
      this.sampledContext = undefined;
      this.sampledWorld = -1;
    }
  }
  clear(): void {
    this.worlds.clear();
    this.sampledContext = undefined;
    this.sampledWorld = -1;
    this.value = this.target = 0;
    this.displayMs = NaN;
  }
  /** Only offscreen preparation allocates a checkpoint; per-frame sampling
   * remains allocation-free. Candidate registration is retained separately. */
  checkpoint(): () => void {
    const { sampledWorld, sampledContext, x, z, target, value, displayMs } =
      this;
    return () => {
      this.sampledWorld = sampledWorld;
      this.sampledContext = sampledContext;
      this.x = x;
      this.z = z;
      this.target = target;
      this.value = value;
      this.displayMs = displayMs;
    };
  }
  sample(
    worldId: number,
    position: Point,
    displayMs: number,
    snap = false,
  ): number {
    const context = this.worlds.get(worldId),
      changedWorld =
        worldId !== this.sampledWorld || context !== this.sampledContext,
      valid =
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Number.isFinite(position.z);
    if (
      changedWorld ||
      position.x !== this.x ||
      position.z !== this.z ||
      !valid
    ) {
      this.target = 0;
      if (valid && context?.kind === "main") {
        const found = context.surfaceWeights(
          position.x,
          position.z,
          this.weights,
        );
        for (let i = 0; i < found.count; i++)
          if (found.ids[i] === Region.Hellscape) {
            const weight = found.weights[i] ?? 0;
            this.target = Number.isFinite(weight)
              ? Math.max(0, Math.min(1, weight))
              : 0;
            break;
          }
      }
      this.sampledWorld = worldId;
      this.sampledContext = context;
      this.x = valid ? position.x : NaN;
      this.z = valid ? position.z : NaN;
    }
    const now = Number.isFinite(displayMs) ? displayMs : 0;
    if (
      snap ||
      changedWorld ||
      !valid ||
      !Number.isFinite(this.displayMs) ||
      now < this.displayMs
    )
      this.value = this.target;
    else {
      // ~95% settled at two seconds; independent of frame rate. A stopped
      // display clock leaves standing air deterministic, just like the scene.
      this.value +=
        (this.target - this.value) *
        (1 - Math.exp(-(now - this.displayMs) / 650));
      if (Math.abs(this.target - this.value) < 0.0001) this.value = this.target;
    }
    this.displayMs = now;
    return this.value;
  }
}

/** Bound the existing distance fog by camera altitude. This is the phase-1.3
 * standing-air approximation, not phase-1.4's per-ray aerial perspective.
 * At ground level it transmits 95% at 50m and 82% at 100m, leaving nearby forms
 * readable. Rising above the ash plain thins the air rather than hiding ground. */
export function ibaraFogDensity(cameraY: number): number {
  const height = Number.isFinite(cameraY) ? Math.max(0, cameraY - 40) : 0;
  return 0.0017 + 0.0028 * Math.exp(-height / 140);
}
