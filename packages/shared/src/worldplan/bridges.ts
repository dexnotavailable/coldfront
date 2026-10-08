import { detSinCos } from "../math/det.js";
import { hash3, rand01 } from "../math/hash.js";
import type { BridgeSite, XZBounds } from "../world/types.js";
export const BRIDGE_TOP = 18;
const BEARINGS = new Float64Array([20, 140, 255]);
/** Centreline is interleaved XZ; gaps are [startArc,endArc] metre pairs. */
export function createBridges(seed: number): readonly BridgeSite[] {
  const bridges: BridgeSite[] = [];
  const sc = new Float64Array(2);
  for (let b = 0; b < 3; b++) {
    const bearing = Number(BEARINGS[b]) + 4 * (rand01(hash3(seed, b, 1)) - 0.5);
    detSinCos((bearing * Math.PI) / 180, sc);
    const sx = Number(sc[0]);
    const sz = -Number(sc[1]);
    const points = new Float64Array(26);
    for (let i = 0; i < 13; i++) {
      const r = 4400 + i * 200;
      const offset =
        i === 0 || i === 12
          ? 0
          : 32 * (rand01(hash3(seed ^ 0x651ce47d, b, i)) - 0.5);
      points[i * 2] = sx * r - sz * offset;
      points[i * 2 + 1] = sz * r + sx * offset;
    }
    const count = 1 + (hash3(seed, b, 2) % 3);
    const gaps = new Float64Array(count * 2);
    for (let i = 0; i < count; i++) {
      // All gaps lie inside the Blackwater crossing, well apart from one another.
      const centre = 850 + ((i + 0.5) * 700) / count;
      const length = 20 + 60 * rand01(hash3(seed ^ 0x715517a3, b, i));
      gaps[i * 2] = centre - length / 2;
      gaps[i * 2 + 1] = centre + length / 2;
    }
    bridges.push(
      Object.freeze({
        id: `causeway-${b + 1}`,
        bearing,
        centreline: points,
        halfWidth: 20 + 8 * rand01(hash3(seed, b, 3)),
        gaps,
      }),
    );
  }
  return Object.freeze(bridges);
}
/** Write [top,signed horizontal margin]. Negative margin means outside every intact causeway. */
export function sampleBridges(
  bridges: readonly BridgeSite[],
  x: number,
  z: number,
  out: Float64Array,
): void {
  if (x * x + z * z < 4200 * 4200 || x * x + z * z > 7000 * 7000) {
    out[0] = BRIDGE_TOP;
    out[1] = -Infinity;
    return;
  }
  let best = -Infinity;
  for (const bridge of bridges) {
    let arc = 0;
    let nearest = Infinity;
    let position = 0;
    let total = 0;
    const p = bridge.centreline;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = Number(p[i]);
      const az = Number(p[i + 1]);
      const dx = Number(p[i + 2]) - ax;
      const dz = Number(p[i + 3]) - az;
      const length = Math.sqrt(dx * dx + dz * dz);
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (z - az) * dz) / (length * length)),
      );
      const ex = x - ax - t * dx;
      const ez = z - az - t * dz;
      const distance = Math.sqrt(ex * ex + ez * ez);
      if (distance < nearest) {
        nearest = distance;
        position = arc + t * length;
      }
      arc += length;
      total = arc;
    }
    let margin = Math.min(
      bridge.halfWidth - nearest,
      position,
      total - position,
    );
    for (let i = 0; i < bridge.gaps.length; i += 2) {
      const a = Number(bridge.gaps[i]);
      const b = Number(bridge.gaps[i + 1]);
      const gapMargin =
        position < a
          ? a - position
          : position > b
            ? position - b
            : -Math.min(position - a, b - position);
      margin = Math.min(margin, gapMargin);
    }
    best = Math.max(best, margin);
  }
  out[0] = BRIDGE_TOP;
  out[1] = best;
}
export function bridgeIntersects(
  bridge: BridgeSite,
  bounds: XZBounds,
): boolean {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < bridge.centreline.length; i += 2) {
    minX = Math.min(minX, Number(bridge.centreline[i]));
    maxX = Math.max(maxX, Number(bridge.centreline[i]));
    minZ = Math.min(minZ, Number(bridge.centreline[i + 1]));
    maxZ = Math.max(maxZ, Number(bridge.centreline[i + 1]));
  }
  return (
    minX - bridge.halfWidth <= bounds.maxX &&
    maxX + bridge.halfWidth >= bounds.minX &&
    minZ - bridge.halfWidth <= bounds.maxZ &&
    maxZ + bridge.halfWidth >= bounds.minZ
  );
}
