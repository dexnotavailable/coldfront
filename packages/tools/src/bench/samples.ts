import type { ChunkRequest } from "../../../shared/src/worldgen/chunk.js";
import {
  Column,
  createColumnSample,
  sampleTestColumn,
} from "../../../shared/src/worldgen/test-world.js";

export const BENCH_SAMPLE_SET_VERSION = 1;
export interface BenchmarkCase extends ChunkRequest {
  readonly id: string;
  readonly world: "test";
  readonly lod: 0 | 1;
  readonly spacing: 1 | 2;
}
/** Fixed XZ positions, centre-column cy: every case intersects its current surface band. */
export function benchmarkCases(seed: number, lod: 0 | 1): BenchmarkCase[] {
  if (!Number.isInteger(seed) || seed < -2147483648 || seed > 4294967295)
    throw new Error("Benchmark seed must be a 32-bit word");
  const count = lod === 0 ? 50 : 20;
  const spacing = lod === 0 ? 1 : 2;
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
  readonly seed: number;
  readonly repetitions: number;
  readonly warmup: number;
}
export function benchmarkOptions(args: readonly string[]): BenchmarkOptions {
  const options = { seed: 1, repetitions: 3, warmup: 5 };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (flag !== "--seed" && flag !== "--repetitions" && flag !== "--warmup")
      throw new Error(`Unknown benchmark flag: ${flag}`);
    if (seen.has(flag)) throw new Error(`Duplicate benchmark flag: ${flag}`);
    seen.add(flag);
    const raw = args[i + 1];
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
  return options;
}
