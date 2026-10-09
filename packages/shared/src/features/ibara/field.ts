import { smoothIntersection } from "../../sdf/ops.js";
import { type Aabb, boundsOverlap, pointInBounds } from "../../sdf/types.js";
import {
  createIbaraPlacement,
  emptyIbaraCellDiagnostics,
  IBARA_CELL_SIZE,
  IBARA_LANDMARK_CELL_SIZE,
  IBARA_MAX_REACH,
  inspectIbaraLandmarks,
} from "./cells.js";
import { EMPTY_IBARA_CONTRAST } from "./neighbour-contrast.js";
import {
  createIbaraWorkspace,
  type IbaraWorkspace,
  sampleThorn,
  sweepLowerBound,
  thornVisibleAtSpacing,
} from "./sample.js";
import { instantiateThorn } from "./shape.js";
import {
  clearIbaraSample,
  createIbaraSample,
  type IbaraCellDiagnostics,
  type IbaraEnvironment,
  type IbaraNeighbourContrastDiagnostics,
  type IbaraSample,
  type ThornInstance,
  type ThornParameters,
} from "./types.js";

export interface IbaraField {
  parametersForCell(
    cellX: number,
    cellZ: number,
    landmark?: boolean,
  ): readonly ThornParameters[];
  /** Cell-owned production placement counts, before LOD or curve construction. */
  diagnosticsForCell(
    cellX: number,
    cellZ: number,
    landmark?: boolean,
  ): IbaraCellDiagnostics;
  /** Pair-owned contrast outcomes; independent of geometry and LOD. */
  contrastForCell(
    cellX: number,
    cellZ: number,
    landmark?: boolean,
  ): IbaraNeighbourContrastDiagnostics;
  collect(bounds: Aabb, spacing?: number): readonly ThornInstance[];
  cell(cellX: number, cellZ: number): readonly ThornInstance[];
  landmarks(cellX: number, cellZ: number): readonly ThornInstance[];
  readonly cachedCellCount: number;
  readonly cachedInstanceCount: number;
  readonly cachedPlacementCellCount: number;
}
/** Canonical order is deliberately independent of cache and request order. */
export function compareThorns(a: ThornInstance, b: ThornInstance): number {
  return (
    Number(b.parameters.landmark) - Number(a.parameters.landmark) ||
    a.parameters.cellZ - b.parameters.cellZ ||
    a.parameters.cellX - b.parameters.cellX ||
    a.parameters.cluster - b.parameters.cluster ||
    a.parameters.index - b.parameters.index
  );
}
export function createIbaraField(
  environment: IbaraEnvironment,
  capacity = 256,
): IbaraField {
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new RangeError("Invalid feature cache capacity");
  // Geometry is populated lazily after the spacing predicate. A coarse-first query
  // must never pay for, or fail on, a small thorn it will immediately discard.
  interface CellEntry {
    readonly parameters: readonly ThornParameters[];
    readonly diagnostics: IbaraCellDiagnostics;
    readonly contrast: IbaraNeighbourContrastDiagnostics;
    readonly instances: Map<number, ThornInstance>;
  }
  const cache = new Map<number, CellEntry>();
  const placement = createIbaraPlacement(environment, capacity);
  const get = (x: number, z: number, landmark: boolean): CellEntry => {
    if (!Number.isInteger(x) || !Number.isInteger(z))
      throw new RangeError("Feature cells must be integers");
    // Check before computing the packed key: outside-domain coordinates alias it.
    if (x < -128 || x > 127 || z < -128 || z > 127)
      return {
        parameters: [],
        diagnostics: emptyIbaraCellDiagnostics(x, z, landmark),
        contrast: EMPTY_IBARA_CONTRAST,
        instances: new Map(),
      };
    const key = ((z + 128) * 256 + x + 128) * 2 + Number(landmark);
    const old = cache.get(key);
    if (old) {
      cache.delete(key);
      cache.set(key, old);
      return old;
    }
    const ordinary = landmark ? undefined : placement.inspectCell(x, z);
    const selected = ordinary
      ? {
          parameters: ordinary.clusters.flatMap((cluster) => cluster.thorns),
          diagnostics: ordinary.diagnostics,
          contrast: ordinary.contrast,
        }
      : {
          ...inspectIbaraLandmarks(environment, x, z),
          contrast: EMPTY_IBARA_CONTRAST,
        };
    const made: CellEntry = { ...selected, instances: new Map() };
    cache.set(key, made);
    if (cache.size > capacity) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return made;
  };
  const instantiate = (entry: CellEntry, p: ThornParameters): ThornInstance => {
    const old = entry.instances.get(p.id);
    if (old) return old;
    const made = instantiateThorn(p, environment);
    entry.instances.set(p.id, made);
    return made;
  };
  const all = (
    x: number,
    z: number,
    landmark: boolean,
  ): readonly ThornInstance[] => {
    const entry = get(x, z, landmark);
    return entry.parameters.map((p) => instantiate(entry, p));
  };
  return {
    parametersForCell: (x, z, landmark = false) =>
      get(x, z, landmark).parameters,
    diagnosticsForCell: (x, z, landmark = false) =>
      get(x, z, landmark).diagnostics,
    contrastForCell: (x, z, landmark = false) => get(x, z, landmark).contrast,
    cell: (x, z) => all(x, z, false),
    landmarks: (x, z) => all(x, z, true),
    get cachedCellCount(): number {
      return cache.size;
    },
    get cachedPlacementCellCount(): number {
      return placement.cachedCellCount;
    },
    get cachedInstanceCount(): number {
      let count = 0;
      for (const entry of cache.values()) count += entry.instances.size;
      return count;
    },
    collect(bounds, spacing = 1): readonly ThornInstance[] {
      if (!(spacing >= 1 && spacing <= 64))
        throw new RangeError("Unsupported Ibara sample spacing");
      if (
        ![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(
          Number.isFinite,
        ) ||
        bounds.minX > bounds.maxX ||
        bounds.minZ > bounds.maxZ ||
        !(bounds.minY <= bounds.maxY)
      )
        throw new RangeError("Invalid Ibara query bounds");
      // Validate both grids before building any landmark geometry. Checking the
      // finer ordinary grid second used to do work before rejecting a huge tile.
      for (const size of [IBARA_LANDMARK_CELL_SIZE, IBARA_CELL_SIZE]) {
        const nx =
          Math.floor((bounds.maxX + IBARA_MAX_REACH) / size) -
          Math.floor((bounds.minX - IBARA_MAX_REACH) / size) +
          1;
        const nz =
          Math.floor((bounds.maxZ + IBARA_MAX_REACH) / size) -
          Math.floor((bounds.minZ - IBARA_MAX_REACH) / size) +
          1;
        if (nx * nz > 4096) throw new RangeError("Tile large feature queries");
      }
      const result: ThornInstance[] = [];
      for (const landmark of [true, false]) {
        const size = landmark ? IBARA_LANDMARK_CELL_SIZE : IBARA_CELL_SIZE;
        const minX = Math.floor((bounds.minX - IBARA_MAX_REACH) / size),
          maxX = Math.floor((bounds.maxX + IBARA_MAX_REACH) / size);
        const minZ = Math.floor((bounds.minZ - IBARA_MAX_REACH) / size),
          maxZ = Math.floor((bounds.maxZ + IBARA_MAX_REACH) / size);
        if ((maxX - minX + 1) * (maxZ - minZ + 1) > 4096)
          throw new RangeError("Tile large feature queries");
        for (let z = minZ; z <= maxZ; z++)
          for (let x = minX; x <= maxX; x++) {
            const entry = get(x, z, landmark);
            for (const p of entry.parameters) {
              if (!p.landmark && p.height < 2 * spacing) continue;
              const thorn = instantiate(entry, p);
              if (boundsOverlap(thorn.bounds, bounds)) result.push(thorn);
            }
          }
      }
      return result.sort(compareThorns);
    },
  };
}
export interface IbaraBatch {
  readonly instances: readonly ThornInstance[];
  sample(
    x: number,
    y: number,
    z: number,
    spacing: number,
    out: IbaraSample,
  ): IbaraSample;
  /** Compose in canonical order. Density uses positive-inside terrain convention. */
  density(
    terrain: number,
    x: number,
    y: number,
    z: number,
    spacing: number,
    out: IbaraSample,
  ): number;
  readonly diagnostics: {
    coarseSamples: number;
    exactSamples: number;
    capsuleRejects: number;
  };
}
function copySample(out: IbaraSample, source: IbaraSample): void {
  out.distance = source.distance;
  out.featureId = source.featureId;
  out.t = source.t;
  out.fillet = source.fillet;
  out.core = source.core;
  out.crust = source.crust;
  out.kind = source.kind;
  out.broken = source.broken;
}
/** A bounded chunk/tile evaluator. The global 4m lattice never depends on chunk origin.
 * Exterior narrow-band rejection uses a capsule certificate as well as |f|,
 * because twisted polygons and roughness need not obey a global 1.3 Lipschitz bound.
 * Deep solid samples retain exact t/material identity; no interior interpolation seam.
 */
export function createIbaraBatch(
  instances: readonly ThornInstance[],
  narrowBand = true,
): IbaraBatch {
  const ordered = instances.slice().sort(compareThorns);
  const coarse = ordered.map(() => new Map<string, number>());
  const work: IbaraWorkspace = createIbaraWorkspace(),
    candidate = createIbaraSample();
  const diagnostics = { coarseSamples: 0, exactSamples: 0, capsuleRejects: 0 };
  const evaluate = (
    thorn: ThornInstance,
    i: number,
    x: number,
    y: number,
    z: number,
    spacing: number,
  ): boolean => {
    if (
      !thornVisibleAtSpacing(thorn, spacing) ||
      !pointInBounds(thorn.bounds, x, y, z)
    )
      return false;
    if (narrowBand) {
      const gx = Math.round(x / 4) * 4,
        gy = Math.round(y / 4) * 4,
        gz = Math.round(z / 4) * 4;
      const key = `${gx},${gy},${gz},${spacing}`;
      const grid = coarse[i] as Map<string, number>;
      let value = grid.get(key);
      if (value === undefined) {
        sampleThorn(thorn, gx, gy, gz, spacing, candidate, work);
        value = candidate.distance;
        if (grid.size >= 4096) grid.clear();
        grid.set(key, value);
        diagnostics.coarseSamples++;
      }
      if (value > 4.6 + thorn.fillet) {
        const thickening =
          spacing <= 1 || thorn.lodPolicy === "landmark"
            ? 0
            : Math.min(0.5 * spacing, 0.3 * thorn.parameters.height);
        let lower = Infinity;
        for (const sweep of thorn.sweeps)
          lower = Math.min(lower, sweepLowerBound(sweep, x, y, z, thickening));
        for (const sweep of thorn.debris)
          lower = Math.min(lower, sweepLowerBound(sweep, x, y, z, thickening));
        for (const rock of thorn.rubble) {
          const dx = x - rock.centre[0],
            dy = y - rock.centre[1],
            dz = z - rock.centre[2];
          lower = Math.min(
            lower,
            // The clipped-box plane field is not Euclidean distance at corners.
            (Math.sqrt(dx * dx + dy * dy + dz * dz) - rock.boundRadius) /
              Math.sqrt(3),
          );
        }
        // Account for all intra-thorn smooth unions before declaring empty space.
        lower -=
          Math.max(0, thorn.sweeps.length - 1) *
          Math.max(1, 0.18 * thorn.parameters.baseRadius) *
          0.25;
        if (lower > thorn.fillet + 4.6) {
          diagnostics.capsuleRejects++;
          return false;
        }
      }
    }
    sampleThorn(thorn, x, y, z, spacing, candidate, work);
    diagnostics.exactSamples++;
    return true;
  };
  return {
    instances: ordered,
    diagnostics,
    sample(x, y, z, spacing, out): IbaraSample {
      if (!(spacing >= 1 && spacing <= 64))
        throw new RangeError("Unsupported Ibara sample spacing");
      clearIbaraSample(out);
      for (let i = 0; i < ordered.length; i++) {
        const thorn = ordered[i] as ThornInstance;
        if (
          evaluate(thorn, i, x, y, z, spacing) &&
          candidate.distance < out.distance
        )
          copySample(out, candidate);
      }
      return out;
    },
    density(terrain, x, y, z, spacing, out): number {
      if (!(spacing >= 1 && spacing <= 64))
        throw new RangeError("Unsupported Ibara sample spacing");
      let density = terrain,
        dominance = terrain;
      if (!(spacing >= 1 && spacing <= 64))
        throw new RangeError("Unsupported Ibara sample spacing");
      clearIbaraSample(out);
      for (let i = 0; i < ordered.length; i++) {
        const thorn = ordered[i] as ThornInstance;
        if (!evaluate(thorn, i, x, y, z, spacing)) continue;
        if (-candidate.distance > dominance) {
          copySample(out, candidate);
          dominance = -candidate.distance;
        }
        density = smoothIntersection(
          density,
          -candidate.distance,
          candidate.fillet,
        );
      }
      return density;
    },
  };
}
