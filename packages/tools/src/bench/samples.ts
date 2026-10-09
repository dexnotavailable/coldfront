import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import type {
  SurfaceRegionId,
  WorldContext,
  WorldKind,
} from "../../../shared/src/world/types.js";
import type { ChunkRequest } from "../../../shared/src/worldgen/chunk.js";
import {
  Column,
  createColumnSample,
  sampleTestColumn,
} from "../../../shared/src/worldgen/test-world.js";
import { regionSurfaceAddresses } from "../golden/worlds.js";
import { censusParameters } from "../terrain-report/ibara.js";
import { ibaraReviewFromContext } from "../terrain-review/source.js";

export const BENCH_SAMPLE_SET_VERSION = 3;
export interface BenchmarkCase extends ChunkRequest {
  readonly id: string;
  readonly world: WorldKind;
  readonly region: SurfaceRegionId | "test";
  readonly lod: 0 | 1;
  readonly spacing: 1 | 2;
  readonly category?: "dense-ibara";
  readonly denseEvidence?: {
    readonly mask: number;
    readonly weight: number;
    readonly acceptedRootsWithin96m: number;
    readonly featureId: number;
  };
}
/** Additional cases only. Select from accepted production roots without creating
 * curves; actual pipeline measurements later prove the chunks contain features. */
export async function denseIbaraBenchmarkCases(
  context: WorldContext,
  count = 50,
): Promise<BenchmarkCase[]> {
  if (context.kind !== "main") return [];
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new Error("Dense benchmark case count must be 1..100");
  const review = ibaraReviewFromContext(context),
    census = await censusParameters(review),
    ordinary = census.parameters.filter((p) => !p.landmark);
  const buckets = new Map<string, typeof ordinary>();
  for (const p of ordinary) {
    const k = `${Math.floor(p.base[0] / 32)},${Math.floor(p.base[2] / 32)}`;
    const bucket = buckets.get(k) ?? [];
    bucket.push(p);
    buckets.set(k, bucket);
  }
  const candidates: BenchmarkCase[] = [],
    seen = new Set<string>();
  for (const p of ordinary) {
    const cx = Math.floor(p.base[0] / 32),
      cz = Math.floor(p.base[2] / 32),
      cy = Math.floor((p.base[1] + Math.min(8, p.height * 0.25)) / 32),
      k = `${cx},${cy},${cz}`;
    if (seen.has(k)) continue;
    const weight = review.environment.weightAt(p.base[0], p.base[2]),
      mask = review.mask(p.base[0], p.base[2]);
    if (weight < 0.85 || mask < weight * (1 - 1e-12)) continue;
    let roots = 0;
    for (let z = cz - 1; z <= cz + 1; z++)
      for (let x = cx - 1; x <= cx + 1; x++)
        roots += (buckets.get(`${x},${z}`) ?? []).length;
    if (roots < 3) continue;
    seen.add(k);
    candidates.push({
      id: `main-s${context.seed}-dense-ibara-${p.id}`,
      world: "main",
      region: "hellscape",
      seed: context.seed,
      cx,
      cy,
      cz,
      lod: 0,
      spacing: 1,
      category: "dense-ibara",
      denseEvidence: {
        mask,
        weight,
        acceptedRootsWithin96m: roots,
        featureId: p.id,
      },
    });
  }
  if (candidates.length < count)
    throw new Error(
      `Dense Ibara selection found ${candidates.length}/${count} cases; no sparse substitutions allowed`,
    );
  return Array.from(
    { length: count },
    (_, i) =>
      candidates[
        Math.floor(((i + 0.5) * candidates.length) / count)
      ] as BenchmarkCase,
  );
}
/** Fixed XZ positions, centre-column cy: every case intersects its current surface band. */
export function benchmarkCases(
  context: WorldContext,
  lod: 0 | 1,
  regions: readonly SurfaceRegionId[] = SURFACE_REGIONS.map(
    (region) => region.id,
  ),
): BenchmarkCase[] {
  const seed = context.seed;
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 4294967295)
    throw new Error("Benchmark seed must be a 32-bit word");
  const count = lod === 0 ? 50 : 20;
  const spacing = lod === 0 ? 1 : 2;
  if (context.kind === "main") {
    if (
      regions.length === 0 ||
      new Set(regions).size !== regions.length ||
      regions.some((id) => !SURFACE_REGIONS.some((region) => region.id === id))
    )
      throw new Error("Expected distinct surface region IDs");
    return regions.flatMap((region) =>
      regionSurfaceAddresses(context, region, lod, count).map((address, i) => ({
        id: `main-s${seed}-${region}-lod${lod}-${i.toString().padStart(2, "0")}`,
        world: "main" as const,
        region,
        seed,
        ...address,
        lod,
        spacing,
      })),
    );
  }
  const near: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [-1, -1],
    [-2, 1],
    [0, -1],
    [3, 0],
    [-3, -2],
  ];
  const samples: BenchmarkCase[] = [];
  const column = createColumnSample();
  for (let i = 0; i < count; i++) {
    const [cx, cz] = near[i] ?? [
      ((i * 37 + 7) % 101) - 50,
      ((i * 61 + 13) % 103) - 51,
    ];
    const x = ((cx as number) * 32 + 16.5) * spacing;
    const z = ((cz as number) * 32 + 16.5) * spacing;
    sampleTestColumn(seed, x, z, column);
    samples.push({
      id: `test-s${seed}-lod${lod}-${i.toString().padStart(2, "0")}`,
      world: "test",
      region: "test",
      seed,
      cx: cx as number,
      cy: Math.floor((column[Column.Height] as number) / (32 * spacing)),
      cz: cz as number,
      lod,
      spacing,
    });
  }
  return samples;
}
export interface BenchmarkOptions {
  readonly world: WorldKind;
  readonly regions: readonly SurfaceRegionId[];
  readonly seed: number;
  readonly repetitions: number;
  readonly warmup: number;
}
export function benchmarkOptions(args: readonly string[]): BenchmarkOptions {
  const options = {
    world: "main" as WorldKind,
    regions: SURFACE_REGIONS.map((region) => region.id),
    seed: 1,
    repetitions: 3,
    warmup: 5,
  };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (
      flag !== "--seed" &&
      flag !== "--repetitions" &&
      flag !== "--warmup" &&
      flag !== "--world" &&
      flag !== "--region"
    )
      throw new Error(`Unknown benchmark flag: ${flag}`);
    if (seen.has(flag)) throw new Error(`Duplicate benchmark flag: ${flag}`);
    seen.add(flag);
    const raw = args[i + 1];
    if (flag === "--world") {
      if (raw !== "main" && raw !== "test")
        throw new Error("--world requires main or test");
      options.world = raw;
      continue;
    }
    if (flag === "--region") {
      const ids = raw?.split(",") ?? [];
      if (
        !ids.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !SURFACE_REGIONS.some((region) => region.id === id))
      )
        throw new Error(
          "--region requires distinct surface IDs separated by commas",
        );
      options.regions = ids as SurfaceRegionId[];
      continue;
    }
    if (!raw || !/^-?\d+$/.test(raw))
      throw new Error(`${flag} requires an integer`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value))
      throw new Error(`${flag} exceeds integer range`);
    if (flag === "--seed") options.seed = value;
    else if (flag === "--repetitions") options.repetitions = value;
    else options.warmup = value;
  }
  if (
    options.seed < -2147483648 ||
    options.seed > 4294967295 ||
    options.repetitions < 1 ||
    options.repetitions > 20 ||
    options.warmup < 1 ||
    options.warmup > 50
  )
    throw new Error(
      "Seed must be a 32-bit word, repetitions 1..20 and warmup 1..50",
    );
  if (options.world === "test") {
    if (seen.has("--region"))
      throw new Error("The test world has no named regions");
    options.regions = [];
  }
  return options;
}
