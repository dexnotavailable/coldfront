import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Block } from "../../../shared/src/blocks/registry.js";
import {
  Column,
  collectTestTrees,
  createColumnSample,
  createVoxelSample,
  sampleTestColumn,
  sampleTestVoxel,
  TEST_POND,
} from "../../../shared/src/worldgen/test-world.js";
import { isSupportingGroundHit, supportingVoxelTop } from "./geometry.js";
import { walkableEye } from "./query.js";

interface Point {
  x: number;
  y: number;
  z: number;
}
interface TestCameraQuery {
  get(x: number, y: number, z: number): number;
  voxel(
    x: number,
    y: number,
    z: number,
  ): Readonly<{
    density: number;
    block: number;
    fluid: number;
    featureId?: number | undefined;
  }>;
  ground(x: number, z: number): number;
  clear(): void;
}
export interface PostcardCamera {
  id: "TEST-1";
  seed: number;
  position: Point;
  target: Point;
  hours: number;
  radius: number;
  validation: {
    eyeClear: boolean;
    walkable: boolean;
    centralClear: boolean;
    skyFraction: number;
    waterFraction: number;
    treeFraction: number;
    horizonFraction: number;
    sunOffsetDegrees: number;
  };
  score: number;
}
function query(seed: number): TestCameraQuery {
  const columns = new Map<
      string,
      { column: Float64Array; trees: ReturnType<typeof collectTestTrees> }
    >(),
    voxel = createVoxelSample();
  const column = (x: number, z: number) => {
    const key = `${x},${z}`;
    let c = columns.get(key);
    if (!c) {
      c = {
        column: sampleTestColumn(seed, x + 0.5, z + 0.5, createColumnSample()),
        trees: collectTestTrees(seed, x, z, x + 1, z + 1),
      };
      columns.set(key, c);
    }
    return c;
  };
  const sample = (x: number, y: number, z: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      iz = Math.floor(z),
      c = column(ix, iz);
    const result = sampleTestVoxel(
      seed,
      ix + 0.5,
      iy + 0.5,
      iz + 0.5,
      voxel,
      c.column,
      c.trees,
    );
    // This legacy backend contains ordinary terrain, fluid and Log/Leaves
    // trees. Supply explicit non-feature identity only for its non-tree cells;
    // do not fabricate a feature ID for the trees.
    return Object.assign(result, {
      featureId:
        result.block === Block.Log || result.block === Block.Leaves
          ? undefined
          : 0,
    });
  };
  const ground = (x: number, z: number) =>
    Math.ceil(
      (column(Math.floor(x), Math.floor(z)).column[Column.Height] as number) -
        0.5,
    );
  return {
    get: (x, y, z) => sample(x, y, z).block,
    voxel: sample,
    ground,
    clear: () => columns.clear(),
  };
}
function normalize(p: Point): Point {
  const d = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / d, y: p.y / d, z: p.z / d };
}
function cross(a: Point, b: Point): Point {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
export function inspectTestCamera(
  camera: Omit<PostcardCamera, "validation" | "score">,
  q: TestCameraQuery,
): PostcardCamera {
  const direction = normalize({
    x: camera.target.x - camera.position.x,
    y: camera.target.y - camera.position.y,
    z: camera.target.z - camera.position.z,
  });
  const right = normalize(cross(direction, { x: 0, y: 1, z: 0 })),
    up = cross(right, direction),
    tangent = Math.tan((35 * Math.PI) / 180),
    aspect = 16 / 9;
  const eyeClear =
    q.get(camera.position.x, camera.position.y, camera.position.z) ===
    Block.Air;
  const walkable = walkableEye(
    q,
    camera.position.x,
    camera.position.y,
    camera.position.z,
  );
  const supportTop =
    eyeClear && walkable ? supportingVoxelTop(camera.position.y) : null;
  let sky = 0,
    water = 0,
    trees = 0,
    centralClear = true;
  for (let py = 0; py < 36; py++)
    for (let px = 0; px < 64; px++) {
      const nx = (((px + 0.5) / 64) * 2 - 1) * tangent * aspect,
        ny = (1 - ((py + 0.5) / 36) * 2) * tangent;
      const ray = normalize({
        x: direction.x + right.x * nx + up.x * ny,
        y: direction.y + right.y * nx + up.y * ny,
        z: direction.z + right.z * nx + up.z * ny,
      });
      let hit = 0,
        distance = 0,
        hitX = camera.position.x,
        hitY = camera.position.y,
        hitZ = camera.position.z,
        hitFluid = 0;
      let hitFeatureId: number | undefined;
      for (distance = 0; distance <= 300; distance += 2) {
        hitX = camera.position.x + ray.x * distance;
        hitY = camera.position.y + ray.y * distance;
        hitZ = camera.position.z + ray.z * distance;
        const voxel = q.voxel(hitX, hitY, hitZ);
        hit = voxel.block;
        hitFluid = voxel.fluid;
        hitFeatureId = voxel.featureId;
        if (hit) break;
      }
      if (!hit) sky++;
      if (hit === Block.Water) water++;
      if (hit === Block.Log || hit === Block.Leaves) trees++;
      if (
        hit &&
        distance < 5 &&
        px >= 13 &&
        px < 51 &&
        py >= 7 &&
        py < 29 &&
        !isSupportingGroundHit(
          {
            x: hitX,
            y: hitY,
            z: hitZ,
            block: hit,
            fluid: hitFluid,
            featureId: hitFeatureId,
          },
          supportTop,
          q.ground,
        )
      )
        centralClear = false;
    }
  const total = 64 * 36,
    yaw = Math.atan2(direction.x, -direction.z),
    angle = ((camera.hours - 6) / 12) * Math.PI;
  const sunYaw = Math.atan2(-Math.cos(angle) * 0.75, -Math.cos(angle) * 0.65);
  const sunOffsetDegrees =
    (Math.abs(Math.atan2(Math.sin(sunYaw - yaw), Math.cos(sunYaw - yaw))) *
      180) /
    Math.PI;
  const pitch = Math.asin(direction.y),
    horizonFraction = 0.5 + Math.tan(pitch) / (2 * tangent);
  const validation = {
    eyeClear,
    walkable,
    centralClear,
    skyFraction: sky / total,
    waterFraction: water / total,
    treeFraction: trees / total,
    horizonFraction,
    sunOffsetDegrees,
  };
  const legal =
    eyeClear &&
    walkable &&
    centralClear &&
    sky / total > 0.2 &&
    sky / total < 0.65 &&
    water / total >= 0.15 &&
    sunOffsetDegrees >= 60 &&
    sunOffsetDegrees <= 150;
  const score =
    (legal ? 100 : 0) +
    (water / total) * 20 +
    Math.min(0.15, trees / total) * 40;
  return { ...camera, validation, score };
}
export async function resolveTestCamera(
  seed: number,
  root = process.cwd(),
): Promise<PostcardCamera> {
  const path = resolve(
      root,
      "packages/tools/postcards/cameras",
      `seed-${seed}.json`,
    ),
    q = query(seed);
  let document: Record<string, unknown> = {};
  try {
    document = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
    const old = document as unknown as PostcardCamera;
    if (old.id !== "TEST-1" || old.seed !== seed)
      throw new Error("No matching TEST-1 camera");
    const checked = inspectTestCamera(
      {
        id: old.id,
        seed: old.seed,
        position: old.position,
        target: old.target,
        hours: old.hours,
        radius: old.radius,
      },
      q,
    );
    if (checked.score >= 100) return checked;
    console.log("Stored TEST-1 camera failed validation; resolving again");
  } catch {
    /* First camera for this seed. */
  }
  let best: PostcardCamera | null = null;
  for (let candidate = 0; candidate < 50; candidate++) {
    const angle = (candidate * Math.PI * 2) / 25,
      radius = candidate < 25 ? 25 : 28;
    const x = TEST_POND.x + Math.cos(angle) * radius,
      z = TEST_POND.z + Math.sin(angle) * radius * 0.82;
    const camera = inspectTestCamera(
      {
        id: "TEST-1",
        seed,
        position: { x, y: q.ground(x, z) + 1.62, z },
        target: { x: TEST_POND.x, y: -0.5, z: TEST_POND.z },
        hours: 17.25,
        radius: 160,
      },
      q,
    );
    if (!best || camera.score > best.score) best = camera;
    q.clear();
  }
  if (!best || best.score < 100)
    throw new Error(
      `No TEST-1 camera passed all geometric checks: ${JSON.stringify(best)}`,
    );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ ...document, ...best }, null, 2)}\n`,
  );
  return best;
}
