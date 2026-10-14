/** Deterministic feature-addressed additions. No random global chunk guesses,
 * primitive substitution, or changes to the original 300-case prefix. */
import type { ThornInstance } from "../../../shared/src/features/ibara/types.js";
import type { WorldContext } from "../../../shared/src/world/types.js";
import { createMainIbaraField } from "../../../shared/src/worldgen/main/features.js";
import { createMainField } from "../../../shared/src/worldgen/main/surface.js";
import type { GoldenCase } from "./core.js";

type Point = Readonly<{ x: number; y: number; z: number }>;

export function featureAddress(
  point: Point,
  lod: 0 | 1,
): Pick<GoldenCase, "cx" | "cy" | "cz" | "lod" | "spacing"> {
  const spacing = lod === 0 ? 1 : 2,
    width = 32 * spacing;
  return {
    cx: Math.floor(point.x / width),
    cy: Math.floor(point.y / width),
    cz: Math.floor(point.z / width),
    lod,
    spacing,
  };
}
export function thornGoldenCases(
  seed: number,
  thorn: ThornInstance,
  branch: ThornInstance,
): GoldenCase[] {
  const cases: GoldenCase[] = [];
  const add = (
    name: string,
    owner: ThornInstance,
    point: Point,
    lod: 0 | 1,
  ) => {
    cases.push({
      id: `ibara-s${seed}-lod${lod}-${name}`,
      world: "main",
      seed,
      region: "hellscape",
      ...featureAddress(point, lod),
      coverage: name,
      targetFeatureId: owner.parameters.id,
    });
  };
  const point = (
    owner: ThornInstance,
    sweep: number,
    fraction: number,
  ): Point => {
    const points = owner.sweeps[sweep]?.spine.points;
    if (!points?.length) throw new Error("Missing deterministic thorn sweep");
    const index = Math.floor((points.length / 3 - 1) * fraction) * 3;
    return {
      x: Number(points[index]),
      y: Number(points[index + 1]),
      z: Number(points[index + 2]),
    };
  };
  for (const lod of [0, 1] as const) {
    add("thorn-root", thorn, point(thorn, 0, 0.1), lod);
    add("thorn-mid", thorn, point(thorn, 0, 0.5), lod);
    add("thorn-branch", branch, point(branch, 1, 0.5), lod);
    // The same feature supplies both sides of a real X chunk seam, with the
    // nearest polyline point used for Y/Z. Coarse cells share this world address.
    const points = thorn.sweeps[0]?.spine.points;
    if (!points) throw new Error("Missing thorn spine");
    let seam: Point | undefined;
    for (let i = 3; i < points.length && !seam; i += 3) {
      const ax = Number(points[i - 3]),
        bx = Number(points[i]);
      const x = Math.ceil(Math.min(ax, bx) / 64) * 64;
      if (ax !== bx && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)) {
        const t = (x - ax) / (bx - ax);
        seam = {
          x,
          y:
            Number(points[i - 2]) +
            (Number(points[i + 1]) - Number(points[i - 2])) * t,
          z:
            Number(points[i - 1]) +
            (Number(points[i + 2]) - Number(points[i - 1])) * t,
        };
      }
    }
    if (!seam)
      throw new Error("Selected thorn does not cross an X chunk boundary");
    add("thorn-boundary-left", thorn, { ...seam, x: seam.x - 0.01 }, lod);
    add("thorn-boundary-right", thorn, { ...seam, x: seam.x + 0.01 }, lod);
  }
  return cases;
}
export function ibaraGoldenCases(context: WorldContext): GoldenCase[] {
  if (context.kind !== "main" || !context.plan)
    throw new Error("Ibara goldens require a production main plan");
  const plan = context.plan.data,
    terrain = createMainField(plan, plan.sites.bridges, plan.ibara),
    field = createMainIbaraField(terrain);
  const anchor = context.regionAnchor("hellscape");
  if (!anchor) throw new Error("Missing Ibara golden anchor");
  let root: ThornInstance | undefined, branch: ThornInstance | undefined;
  // Fixed expansion order and sorted feature IDs make selection independent of
  // cache warmness. This is invoked only by the coordinator's heavy golden run.
  for (const radius of [192, 384, 768]) {
    const instances = [
      ...field.collect(
        {
          minX: anchor.x - radius,
          maxX: anchor.x + radius,
          minZ: anchor.z - radius,
          maxZ: anchor.z + radius,
          minY: -1536,
          maxY: 1024,
        },
        1,
      ),
    ].sort((a, b) => a.parameters.id - b.parameters.id);
    root ??= instances.find((thorn) => {
      const p = thorn.sweeps[0]?.spine.points;
      if (!p || thorn.parameters.height < 32) return false;
      // A 64m seam is also a 32m seam, giving a real boundary at both LODs.
      for (let i = 3; i < p.length; i += 3)
        if (Math.floor(Number(p[i - 3]) / 64) !== Math.floor(Number(p[i]) / 64))
          return true;
      return false;
    });
    branch ??= instances.find(
      (thorn) =>
        thorn.parameters.branchCount > 0 &&
        thorn.sweeps.length > 1 &&
        thorn.parameters.height >= 16,
    );
    if (root && branch) break;
  }
  if (!root || !branch)
    throw new Error(
      "No deterministic thorn/branch/boundary witnesses; do not silently omit Ibara goldens",
    );
  const cases = thornGoldenCases(context.seed, root, branch);
  const caldera = [...plan.ibara.calderas].sort((a, b) => a.id - b.id)[0];
  if (!caldera) throw new Error("No caldera golden witness");
  for (const lod of [0, 1] as const)
    for (const [name, point] of [
      ["caldera-lava", { x: caldera.x, y: caldera.lavaLevel, z: caldera.z }],
      [
        "caldera-rim",
        {
          x: caldera.x + caldera.radius,
          y: terrain.height(caldera.x + caldera.radius, caldera.z),
          z: caldera.z,
        },
      ],
    ] as const)
      cases.push({
        id: `ibara-s${context.seed}-lod${lod}-${name}`,
        world: "main",
        seed: context.seed,
        region: "hellscape",
        ...featureAddress(point, lod),
        coverage: name,
        targetCalderaId: caldera.id,
      });
  return cases;
}
