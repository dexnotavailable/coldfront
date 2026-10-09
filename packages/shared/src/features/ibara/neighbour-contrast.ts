import type { Vec3 } from "../../sdf/types.js";
import type { IbaraNeighbourContrastDiagnostics } from "./types.js";

/** A fixed work bound, not an assumption about observed nearest distances. */
export const IBARA_CONTRAST_RADIUS = 192;
const CERTIFIED_RADIUS = IBARA_CONTRAST_RADIUS - 1;
const ANGLE_GUARD = 8.000001;
export interface IbaraContrastPoint {
  readonly id: number;
  readonly base: Vec3;
  readonly height: number;
  readonly leanDegrees: number;
  readonly bend: number;
  readonly landmark: boolean;
}
/** Must return every ORIGINAL accepted ordinary base in the closed radius.
 * It must never call contrast/adjusted placement, and must not build curves. */
export type IbaraContrastQuery = (
  x: number,
  z: number,
  radius: number,
) => readonly IbaraContrastPoint[];
export interface IbaraContrastDecision {
  readonly status:
    | "unchanged"
    | "uncertified-nearest"
    | "protected-inclination"
    | "adjusted"
    | "uncertified"
    | "no-legal-adjustment";
  readonly ownerId: number;
  readonly partnerId: number;
  readonly adjustedId: number;
  readonly angle: number;
}
export const EMPTY_IBARA_CONTRAST: IbaraNeighbourContrastDiagnostics =
  Object.freeze({
    candidatePairs: 0,
    adjustedPairs: 0,
    uncertifiedPairs: 0,
    noLegalAdjustmentPairs: 0,
    protectedInclinationPairs: 0,
    uncertifiedNearestInstances: 0,
    changedInstances: 0,
  });
export function ibaraParametersDifferent(
  a: IbaraContrastPoint,
  b: IbaraContrastPoint,
  aLean = a.leanDegrees,
  bLean = b.leanDegrees,
): boolean {
  return (
    Math.abs(a.height - b.height) >= 0.2 * a.height ||
    Math.abs(aLean - bLean) >= 8 ||
    Math.abs(a.bend - b.bend) >= 0.1 * a.height
  );
}
function distanceSquared(a: IbaraContrastPoint, b: IbaraContrastPoint): number {
  const x = a.base[0] - b.base[0],
    z = a.base[2] - b.base[2];
  return x * x + z * z;
}
/** For each quadrant choose a witness b relative to p. For every unit direction
 * u in that quadrant, u.b >= min(|bx|,|bz|). Thus r>|b|²/(2min) makes b strictly
 * closer than p to r*u. Four finite bounds contain p's entire Voronoi cell.
 * Requiring <=191m leaves 1m numerical/search slack inside the 192m query.
 * Missing sectors retain the source unchanged; sample maxima are never proof. */
export function certifyIbaraIncomingRadius(
  p: IbaraContrastPoint,
  neighbours: readonly IbaraContrastPoint[],
): number | null {
  const bounds = [Infinity, Infinity, Infinity, Infinity];
  for (const other of neighbours) {
    if (other.id === p.id || other.landmark) continue;
    const x = other.base[0] - p.base[0],
      z = other.base[2] - p.base[2],
      minimum = Math.min(Math.abs(x), Math.abs(z));
    if (minimum === 0) continue;
    const quadrant = Number(x > 0) + 2 * Number(z > 0);
    bounds[quadrant] = Math.min(
      Number(bounds[quadrant]),
      (x * x + z * z) / (2 * minimum),
    );
  }
  const radius = Math.max(...bounds);
  return radius <= CERTIFIED_RADIUS ? radius : null;
}
export interface IbaraNeighbourContrast {
  decision(point: IbaraContrastPoint): IbaraContrastDecision;
  apply<T extends IbaraContrastPoint>(
    parameters: readonly T[],
  ): {
    readonly parameters: readonly T[];
    readonly diagnostics: IbaraNeighbourContrastDiagnostics;
  };
  readonly cachedNearestCount: number;
  readonly cachedDecisionCount: number;
}
/** Decisions use only original parameters. True mutual pairs are disjoint. If
 * c's nearest is a repaired endpoint a, c cannot belong to a different mutual
 * pair because a's nearest is its own partner. Therefore every protected
 * incoming operand stays unchanged while independently owned pairs are fixed. */
export function createIbaraNeighbourContrast(
  query: IbaraContrastQuery,
  capacity = 4096,
  minimumLean: (point: IbaraContrastPoint) => 5 | 18 = () => 5,
): IbaraNeighbourContrast {
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new RangeError("Invalid contrast cache capacity");
  const nearestCache = new Map<number, IbaraContrastPoint | null>();
  const decisions = new Map<string, IbaraContrastDecision>();
  const retain = <K, V>(cache: Map<K, V>, key: K, value: V): V => {
    cache.delete(key);
    cache.set(key, value);
    if (cache.size > capacity) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    return value;
  };
  const neighbours = (p: IbaraContrastPoint) =>
    query(p.base[0], p.base[2], IBARA_CONTRAST_RADIUS);
  const nearest = (p: IbaraContrastPoint): IbaraContrastPoint | null => {
    const cached = nearestCache.get(p.id);
    if (cached !== undefined) return retain(nearestCache, p.id, cached);
    let best: IbaraContrastPoint | null = null,
      squared = IBARA_CONTRAST_RADIUS * IBARA_CONTRAST_RADIUS;
    for (const other of neighbours(p)) {
      if (other.id === p.id || other.landmark) continue;
      const distance = distanceSquared(p, other);
      if (
        distance < squared ||
        (distance === squared && (best === null || other.id < best.id))
      ) {
        best = other;
        squared = distance;
      }
    }
    // With any candidate inside R, unqueried points beyond R cannot be closer.
    // No candidate is unresolved, never silently interpreted as a singleton.
    return retain(nearestCache, p.id, best);
  };
  const attempt = (a: IbaraContrastPoint, b: IbaraContrastPoint) => {
    const around = neighbours(a);
    if (certifyIbaraIncomingRadius(a, around) === null)
      return { certified: false, angle: null };
    const protectedIncoming: IbaraContrastPoint[] = [];
    for (const other of around) {
      if (
        other.id === a.id ||
        other.landmark ||
        distanceSquared(a, other) >
          IBARA_CONTRAST_RADIUS * IBARA_CONTRAST_RADIUS
      )
        continue;
      // Its own complete R query contains a, so this incoming-nearest decision
      // is exact even if a closer point lies outside a's original query disk.
      if (nearest(other)?.id === a.id && ibaraParametersDifferent(other, a))
        protectedIncoming.push(other);
    }
    const barriers = [b.leanDegrees];
    for (const other of protectedIncoming)
      if (
        Math.abs(other.height - a.height) < 0.2 * other.height &&
        Math.abs(other.bend - a.bend) < 0.1 * other.height
      )
        barriers.push(other.leanDegrees);
    // Feasible intervals are bounded by the legal range or a barrier +/-8.
    // Checking those endpoints finds the smallest legal change, with 1e-6deg
    // slack above the unchanged threshold. No resampling or instance rejection.
    // Placement owns the authored category. Its existing small blades retain
    // their 18deg floor; other normal thorns retain the full 5..35deg domain.
    const lower = minimumLean(a);
    const candidates = [lower, 35];
    for (const angle of barriers)
      candidates.push(angle - ANGLE_GUARD, angle + ANGLE_GUARD);
    candidates.sort(
      (x, y) =>
        Math.abs(x - a.leanDegrees) - Math.abs(y - a.leanDegrees) || x - y,
    );
    for (const angle of candidates)
      if (
        angle >= lower &&
        angle <= 35 &&
        ibaraParametersDifferent(a, b, angle, b.leanDegrees) &&
        ibaraParametersDifferent(b, a, b.leanDegrees, angle) &&
        protectedIncoming.every((other) =>
          ibaraParametersDifferent(other, a, other.leanDegrees, angle),
        )
      )
        return { certified: true, angle };
    return { certified: true, angle: null };
  };
  const decision = (p: IbaraContrastPoint): IbaraContrastDecision => {
    const empty = (status: "unchanged" | "uncertified-nearest") =>
      Object.freeze({
        status,
        ownerId: p.id,
        partnerId: 0,
        adjustedId: 0,
        angle: 0,
      });
    if (p.landmark) return empty("unchanged");
    const other = nearest(p);
    if (other === null) return empty("uncertified-nearest");
    // Both nearest searches have independent complete extents. Never infer
    // mutuality from the first endpoint's query or from adjusted neighbours.
    if (nearest(other)?.id !== p.id) return empty("unchanged");
    if (
      ibaraParametersDifferent(p, other) &&
      ibaraParametersDifferent(other, p)
    )
      return empty("unchanged");
    const a = p.id < other.id ? p : other,
      b = p.id < other.id ? other : p,
      key = `${a.id},${b.id}`;
    const cached = decisions.get(key);
    if (cached) return retain(decisions, key, cached);
    let status: IbaraContrastDecision["status"] = "protected-inclination",
      adjustedId = 0,
      angle = 0;
    if (
      a.leanDegrees >= 5 &&
      a.leanDegrees <= 35 &&
      b.leanDegrees >= 5 &&
      b.leanDegrees <= 35
    ) {
      const aa = attempt(a, b),
        bb = attempt(b, a);
      if (
        aa.angle !== null &&
        (bb.angle === null ||
          Math.abs(aa.angle - a.leanDegrees) <=
            Math.abs(bb.angle - b.leanDegrees))
      ) {
        adjustedId = a.id;
        angle = aa.angle;
      } else if (bb.angle !== null) {
        adjustedId = b.id;
        angle = bb.angle;
      }
      status = adjustedId
        ? "adjusted"
        : !aa.certified || !bb.certified
          ? "uncertified"
          : "no-legal-adjustment";
    }
    return retain(
      decisions,
      key,
      Object.freeze({
        status,
        ownerId: a.id,
        partnerId: b.id,
        adjustedId,
        angle,
      }),
    );
  };
  return {
    decision,
    get cachedNearestCount() {
      return nearestCache.size;
    },
    get cachedDecisionCount() {
      return decisions.size;
    },
    apply(parameters) {
      const diagnostics = { ...EMPTY_IBARA_CONTRAST };
      const adjusted = parameters.map((p) => {
        const found = decision(p);
        if (found.status === "uncertified-nearest")
          diagnostics.uncertifiedNearestInstances++;
        if (found.ownerId === p.id) {
          if (found.status === "protected-inclination")
            diagnostics.protectedInclinationPairs++;
          if (
            found.status === "adjusted" ||
            found.status === "uncertified" ||
            found.status === "no-legal-adjustment"
          )
            diagnostics.candidatePairs++;
          if (found.status === "adjusted") diagnostics.adjustedPairs++;
          if (found.status === "uncertified") diagnostics.uncertifiedPairs++;
          if (found.status === "no-legal-adjustment")
            diagnostics.noLegalAdjustmentPairs++;
        }
        if (found.adjustedId !== p.id) return p;
        diagnostics.changedInstances++;
        return { ...p, leanDegrees: found.angle };
      });
      return { parameters: adjusted, diagnostics: Object.freeze(diagnostics) };
    },
  };
}
