/** Lava-only ownership and nearest-hot-source queries. WaterPlan is never read or mutated. */
import type {
  IbaraLavaChannelData,
  IbaraPlanData,
  LavaSample,
  XZBounds,
} from "../world/types.js";
import {
  createIbaraAnalytic,
  distanceToBox,
  type Fissure,
  type IbaraAnalytic,
  intersectsXZ,
  PLATE_CELL,
  projectSegment,
} from "../worldgen/main/ibara-volcanic.js";
import { smoothUnit } from "./geometry.js";

export function clearLava(out: LavaSample): LavaSample {
  out.bodyId = 0;
  out.kind = "none";
  out.source = "none";
  out.bed = -Infinity;
  out.level = -Infinity;
  return out;
}
export function createLavaSample(): LavaSample {
  return clearLava({
    bodyId: 0,
    kind: "none",
    source: "none",
    bed: -Infinity,
    level: -Infinity,
  });
}
export interface ChannelSegment extends XZBounds {
  readonly channel: IbaraLavaChannelData;
  readonly index: number;
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly bedA: number;
  readonly bedB: number;
  readonly levelA: number;
  readonly levelB: number;
  readonly halfWidth: number;
}
export interface LavaQueries {
  readonly analytic: IbaraAnalytic;
  segmentsAt(x: number, z: number): readonly ChannelSegment[];
  fissuresAt(x: number, z: number): readonly Fissure[];
  /** heightBeforeFissures is the volcanic plain outside protected major shapes. */
  query(
    x: number,
    z: number,
    heightBeforeFissures: number,
    out: LavaSample,
  ): LavaSample;
  nearest(x: number, z: number, out: Float64Array): Float64Array;
}
function channelT(s: ChannelSegment, t: number): number {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const length = Math.sqrt(dx * dx + dz * dz);
  // A shared node has one head throughout its round junction. Descending
  // reaches begin outside that overlap, avoiding crosswise uphill ripples.
  const flat = Math.min(0.45, (3 * s.halfWidth) / Math.max(1, length));
  return smoothUnit((t - flat) / (1 - 2 * flat));
}
/** Scratch lanes: owner ID, level, complete channel floor/bank, wet flag.
 * A partition of unity joins capsules continuously. Hard winner selection of
 * independently descending levels creates vertical fluid walls at inside bends.
 * The weights vanish at wet boundaries; the dry-bank extension has the same
 * limiting level, then closes against the unmodified ground. */
export function sampleChannelColumn(
  segments: readonly ChannelSegment[],
  x: number,
  z: number,
  ground: number,
  out: Float64Array,
  projection: Float64Array,
): Float64Array {
  out[0] = 0;
  out[1] = -Infinity;
  out[2] = ground;
  out[3] = 0;
  let largest = -Infinity;
  for (const s of segments) {
    projectSegment(x, z, s.ax, s.az, s.bx, s.bz, projection);
    const d = Number(projection[0]);
    if (d < s.halfWidth + s.channel.leveeWidth)
      largest = Math.max(largest, 1 - (d * d) / (s.halfWidth * s.halfWidth));
  }
  if (largest === -Infinity) return out;
  let sum = 0;
  let levelSum = 0;
  let floorSum = 0;
  for (const s of segments) {
    projectSegment(x, z, s.ax, s.az, s.bx, s.bz, projection);
    const d = Number(projection[0]);
    const t = channelT(s, Number(projection[3]));
    const cross = d / s.halfWidth;
    const support = 1 - cross * cross;
    const w = Math.max(0, support - 2 * Math.min(largest, 0));
    const edge = (d - s.halfWidth) / s.channel.leveeWidth;
    const weight = w * w * (1 - smoothUnit((edge - 0.5) * 2));
    if (weight <= 0) continue;
    const level = s.levelA + (s.levelB - s.levelA) * t;
    const bed = s.bedA + (s.bedB - s.bedA) * t;
    const shoulder = level + s.channel.leveeHeight;
    const floor =
      support > 0
        ? bed + (level - bed) * cross * cross
        : edge < 0.35
          ? level + s.channel.leveeHeight * smoothUnit(edge / 0.35)
          : shoulder + (ground - shoulder) * smoothUnit((edge - 0.35) / 0.65);
    sum += weight;
    levelSum += weight * level;
    floorSum += weight * floor;
    if (out[0] === 0 || s.channel.id < Number(out[0])) out[0] = s.channel.id;
  }
  if (sum > 0) {
    out[1] = levelSum / sum;
    out[2] = floorSum / sum;
    out[3] = largest > 0 ? 1 : 0;
  } else {
    // Exactly on the wet boundary: all positive weights vanish. Canonical
    // nearest segment gives the common limiting shore, never a fluid owner.
    for (const s of segments) {
      projectSegment(x, z, s.ax, s.az, s.bx, s.bz, projection);
      if (Number(projection[0]) !== s.halfWidth) continue;
      const t = channelT(s, Number(projection[3]));
      out[2] = s.levelA + (s.levelB - s.levelA) * t;
      break;
    }
  }
  return out;
}
const INDEX_SIZE = 128;
function fissureBounds(f: Fissure): XZBounds {
  return {
    minX: Math.min(f.ax, f.bx) - f.halfWidth,
    minZ: Math.min(f.az, f.bz) - f.halfWidth,
    maxX: Math.max(f.ax, f.bx) + f.halfWidth,
    maxZ: Math.max(f.az, f.bz) + f.halfWidth,
  };
}
/** Runtime indexes are deliberately absent from the serialized plan. */
export function createLavaQueries(
  plan: IbaraPlanData,
  analytic = createIbaraAnalytic(plan.seed),
): LavaQueries {
  const segments: ChannelSegment[] = [];
  const buckets = new Map<string, ChannelSegment[]>();
  const projection = new Float64Array(6);
  const column = new Float64Array(4);
  for (const channel of plan.channels) {
    const p = channel.points;
    for (let i = 0; i + 5 < p.length; i += 5) {
      const ax = Number(p[i]);
      const az = Number(p[i + 1]);
      const bx = Number(p[i + 5]);
      const bz = Number(p[i + 6]);
      // One width per segment gives an exact capsule and exact nearest-source
      // distance; adjacent endpoint discs overlap and have a common level.
      const halfWidth = Math.max(Number(p[i + 4]), Number(p[i + 9]));
      const padding = halfWidth + channel.leveeWidth;
      const segment: ChannelSegment = {
        channel,
        index: i / 5,
        ax,
        az,
        bx,
        bz,
        bedA: Number(p[i + 2]),
        bedB: Number(p[i + 7]),
        levelA: Number(p[i + 3]),
        levelB: Number(p[i + 8]),
        halfWidth,
        minX: Math.min(ax, bx) - padding,
        minZ: Math.min(az, bz) - padding,
        maxX: Math.max(ax, bx) + padding,
        maxZ: Math.max(az, bz) + padding,
      };
      segments.push(segment);
      for (
        let z = Math.floor(segment.minZ / INDEX_SIZE);
        z <= Math.floor(segment.maxZ / INDEX_SIZE);
        z++
      ) {
        for (
          let x = Math.floor(segment.minX / INDEX_SIZE);
          x <= Math.floor(segment.maxX / INDEX_SIZE);
          x++
        ) {
          const key = `${x},${z}`;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = [];
            buckets.set(key, bucket);
          }
          bucket.push(segment);
        }
      }
    }
  }
  segments.sort((a, b) => a.channel.id - b.channel.id || a.index - b.index);
  for (const bucket of buckets.values())
    bucket.sort((a, b) => a.channel.id - b.channel.id || a.index - b.index);
  const protectedBounds = [
    ...plan.calderas,
    ...plan.channels,
    ...plan.vents,
  ].map((item) => item.bounds);
  const fissureCache = new Map<string, readonly Fissure[]>();
  const fissures = (cx: number, cz: number): readonly Fissure[] => {
    const key = `${cx},${cz}`;
    let found = fissureCache.get(key);
    if (!found) {
      found = analytic.fissures(cx, cz).filter((f) => {
        const bounds = fissureBounds(f);
        // Never clip a wet capsule at plan/shape boundaries: omit the complete
        // small crack where a caldera, channel or vent owns the ground instead.
        return (
          bounds.minX >= plan.bounds.minX &&
          bounds.maxX <= plan.bounds.maxX &&
          bounds.minZ >= plan.bounds.minZ &&
          bounds.maxZ <= plan.bounds.maxZ &&
          !protectedBounds.some((b) => intersectsXZ(b, bounds))
        );
      });
      if (fissureCache.size >= 4096) fissureCache.clear();
      fissureCache.set(key, found);
    }
    return found;
  };
  const fissuresAt = (x: number, z: number): readonly Fissure[] => {
    if (
      x < plan.bounds.minX ||
      x > plan.bounds.maxX ||
      z < plan.bounds.minZ ||
      z > plan.bounds.maxZ
    )
      return [];
    const result: Fissure[] = [];
    const cx = Math.floor(x / PLATE_CELL);
    const cz = Math.floor(z / PLATE_CELL);
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        for (const f of fissures(cx + dx, cz + dz)) {
          if (distanceToBox(x, z, fissureBounds(f)) === 0) result.push(f);
        }
      }
    return result.sort((a, b) => a.id - b.id);
  };
  const segmentsAt = (x: number, z: number): readonly ChannelSegment[] =>
    buckets.get(
      `${Math.floor(x / INDEX_SIZE)},${Math.floor(z / INDEX_SIZE)}`,
    ) ?? [];

  return {
    analytic,
    segmentsAt,
    fissuresAt,
    query(x, z, plainHeight, out) {
      clearLava(out);
      if (!Number.isFinite(x) || !Number.isFinite(z))
        throw new RangeError("Lava point must be finite");
      for (const c of plan.calderas) {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz < c.lavaRadius * c.lavaRadius) {
          out.bodyId = c.id;
          out.kind = "lava";
          out.source = "caldera";
          out.bed = c.floorY;
          out.level = c.lavaLevel;
          return out;
        }
      }
      sampleChannelColumn(
        segmentsAt(x, z),
        x,
        z,
        plainHeight,
        column,
        projection,
      );
      if (column[3] === 1) {
        out.bodyId = Number(column[0]);
        out.kind = "lava";
        out.source = "channel";
        out.bed = Number(column[2]);
        out.level = Number(column[1]);
        return out;
      }
      for (const f of fissuresAt(x, z)) {
        if (!f.hot) continue;
        projectSegment(x, z, f.ax, f.az, f.bx, f.bz, projection);
        if (Number(projection[0]) >= f.halfWidth * 0.5) continue;
        out.bodyId = f.id;
        out.kind = "lava";
        out.source = "fissure";
        out.bed = plainHeight - f.depth;
        out.level = plainHeight - 0.75 * f.depth;
        return out;
      }
      return out;
    },
    nearest(x, z, out) {
      if (!Number.isFinite(x) || !Number.isFinite(z) || out.length < 3)
        throw new RangeError("Invalid lava proximity query");
      out[0] = Infinity;
      out[1] = 0;
      out[2] = 0;
      let bestKind = Infinity;
      let bestId = Infinity;
      let bestSegment = Infinity;
      const consider = (
        distance: number,
        nx: number,
        nz: number,
        kind: number,
        id: number,
        segment: number,
      ): void => {
        const best = Number(out[0]);
        if (
          distance > best ||
          (distance === best &&
            (kind > bestKind ||
              (kind === bestKind &&
                (id > bestId || (id === bestId && segment >= bestSegment)))))
        )
          return;
        out[0] = distance;
        out[1] = nx;
        out[2] = nz;
        bestKind = kind;
        bestId = id;
        bestSegment = segment;
      };
      for (const c of plan.calderas) {
        const dx = x - c.x;
        const dz = z - c.z;
        const r = Math.sqrt(dx * dx + dz * dz);
        consider(
          Math.max(0, r - c.lavaRadius),
          r > 0 ? dx / r : 0,
          r > 0 ? dz / r : 0,
          0,
          c.id,
          0,
        );
      }
      for (const s of segments) {
        if (distanceToBox(x, z, s) > Number(out[0])) continue;
        projectSegment(x, z, s.ax, s.az, s.bx, s.bz, projection);
        consider(
          Math.max(0, Number(projection[0]) - s.halfWidth),
          Number(projection[4]),
          Number(projection[5]),
          1,
          s.channel.id,
          s.index,
        );
      }
      // Implicit finite quadtree over analytic source cells. The three-cell
      // bounds contain every clipped edge and its wet radius. Branch-and-bound
      // proves nearest even outside Ibara, without a guessed search radius.
      const visit = (ax: number, az: number, bx: number, bz: number): void => {
        const bounds = {
          minX: (ax - 1) * PLATE_CELL - 2,
          minZ: (az - 1) * PLATE_CELL - 2,
          maxX: (bx + 2) * PLATE_CELL + 2,
          maxZ: (bz + 2) * PLATE_CELL + 2,
        };
        if (distanceToBox(x, z, bounds) > Number(out[0])) return;
        if (ax === bx && az === bz) {
          for (const f of fissures(ax, az)) {
            if (!f.hot) continue;
            projectSegment(x, z, f.ax, f.az, f.bx, f.bz, projection);
            consider(
              Math.max(0, Number(projection[0]) - f.halfWidth * 0.5),
              Number(projection[4]),
              Number(projection[5]),
              2,
              f.id,
              0,
            );
          }
          return;
        }
        const mx = Math.floor((ax + bx) / 2);
        const mz = Math.floor((az + bz) / 2);
        const children = [
          [ax, az, mx, mz],
          [mx + 1, az, bx, mz],
          [ax, mz + 1, mx, bz],
          [mx + 1, mz + 1, bx, bz],
        ].filter(
          (v) => Number(v[0]) <= Number(v[2]) && Number(v[1]) <= Number(v[3]),
        );
        children.sort((a, b) => {
          const d = (v: number[]): number =>
            distanceToBox(x, z, {
              minX: (Number(v[0]) - 1) * PLATE_CELL - 2,
              minZ: (Number(v[1]) - 1) * PLATE_CELL - 2,
              maxX: (Number(v[2]) + 2) * PLATE_CELL + 2,
              maxZ: (Number(v[3]) + 2) * PLATE_CELL + 2,
            });
          return (
            d(a) - d(b) ||
            Number(a[0]) - Number(b[0]) ||
            Number(a[1]) - Number(b[1])
          );
        });
        for (const v of children)
          visit(Number(v[0]), Number(v[1]), Number(v[2]), Number(v[3]));
      };
      visit(
        Math.floor(plan.bounds.minX / PLATE_CELL) - 1,
        Math.floor(plan.bounds.minZ / PLATE_CELL) - 1,
        Math.floor(plan.bounds.maxX / PLATE_CELL) + 1,
        Math.floor(plan.bounds.maxZ / PLATE_CELL) + 1,
      );
      return out;
    },
  };
}
