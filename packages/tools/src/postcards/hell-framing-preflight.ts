import type { HellTarget, MainCameraCandidate } from "./geometry.js";

export interface FramingPreflightResult {
  readonly reasons: readonly string[];
  readonly cachedGeometry: boolean;
  readonly cachedRejected: boolean;
  readonly targetEvaluated: boolean;
}
const GEOMETRY_REASONS = new Set([
  "horizon",
  "dusk-light",
  "eye-solid",
  "body-or-support",
  "central-ground",
  "central-five-metres",
]);
function exactGeometryKey(view: MainCameraCandidate): string | undefined {
  const numbers = [
    view.position.x,
    view.position.y,
    view.position.z,
    view.target.x,
    view.target.y,
    view.target.z,
    view.hours,
    view.radius,
  ];
  if (
    !numbers.every(Number.isFinite) ||
    (view.terrainUpperBound !== undefined &&
      !Number.isFinite(view.terrainUpperBound))
  )
    return undefined;
  // Exact pose values, not the rounded dedup key used by proposal generation.
  // This cache lives inside one immutable seed/variant field resolution only.
  return JSON.stringify([
    view.region,
    view.kind,
    ...numbers,
    view.terrainUpperBound ?? null,
  ]);
}
/** Geometry is target-independent; region and named-fissure/witness checks are
 * deliberately NEVER cached here. A cached geometry pass still checks the
 * supplied target afresh. Returned arrays cannot mutate a cached result. */
export function createFramingPreflight(
  geometry: (view: MainCameraCandidate) => readonly string[],
  target: (
    view: MainCameraCandidate,
    targetFeature: HellTarget,
  ) => readonly string[],
) {
  const cache = new Map<string, readonly string[]>();
  return {
    remember(event: Readonly<Record<string, unknown>>): void {
      if (event.stage !== "preflight" || !event.view) return;
      const key = exactGeometryKey(event.view as MainCameraCandidate);
      if (key === undefined) return;
      if (event.status === "eligible-for-full-grid") {
        cache.set(key, []);
        return;
      }
      if (event.status !== "rejected") return;
      const reasons = Array.isArray(event.reasons)
        ? event.reasons
        : typeof event.reason === "string"
          ? event.reason.split(",")
          : [];
      if (
        reasons.length &&
        reasons.every(
          (reason) =>
            typeof reason === "string" && GEOMETRY_REASONS.has(reason),
        )
      )
        cache.set(key, [...reasons] as string[]);
    },
    inspect(
      view: MainCameraCandidate,
      targetFeature: HellTarget,
    ): FramingPreflightResult {
      const key = exactGeometryKey(view),
        saved = key === undefined ? undefined : cache.get(key);
      const cachedGeometry = saved !== undefined;
      const reasons = saved ?? [...geometry(view)];
      if (
        !cachedGeometry &&
        key !== undefined &&
        reasons.every((reason) => GEOMETRY_REASONS.has(reason))
      )
        cache.set(key, [...reasons]);
      if (reasons.length)
        return {
          reasons: [...reasons],
          cachedGeometry,
          cachedRejected: cachedGeometry,
          targetEvaluated: false,
        };
      return {
        reasons: [...target(view, targetFeature)],
        cachedGeometry,
        cachedRejected: false,
        targetEvaluated: true,
      };
    },
  };
}
