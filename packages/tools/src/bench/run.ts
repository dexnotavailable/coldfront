import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  availableParallelism,
  cpus,
  freemem,
  release,
  totalmem,
} from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { buildWorldPlan } from "../../../shared/src/worldplan/index.js";
import { contentHash, sourceFiles } from "../build/metadata.js";
import { goldenSourceProvenance, REPO_ROOT } from "../golden/fixture.js";
import {
  type GenerationMeasurement,
  measureGeneration,
  measurePipeline,
  type PipelineMeasurement,
} from "./pipeline.js";
import {
  BENCH_SAMPLE_SET_VERSION,
  type BenchmarkCase,
  benchmarkCases,
  benchmarkOptions,
} from "./samples.js";
import {
  compareBudget,
  summariseTimings,
  type TimingBudget,
  type TimingSummary,
} from "./statistics.js";

const options = benchmarkOptions(process.argv.slice(2));
const lod0: BenchmarkCase[] = [];
const lod1: BenchmarkCase[] = [];
const output = join(REPO_ROOT, "out/step4/bench-gen.json");
const startedAt = new Date().toISOString();
const attemptOutput = join(
  REPO_ROOT,
  `out/step4/bench-gen-${startedAt.replaceAll(":", "-")}.json`,
);
const rawLOD0: PipelineMeasurement[] = [];
const rawLOD1: GenerationMeasurement[] = [];
const hardware = cpus();
const summary: Record<
  string,
  { timing: TimingSummary; budget: ReturnType<typeof compareBudget> }
> = {};
const receipt = {
  schema: 2,
  status: "running",
  startedAt,
  attemptOutput,
  options,
  worldPlanColdBuildMs: null as number | null,
  worldContextPreparationMs: null as number | null,
  sampleSelectionMs: null as number | null,
  source: goldenSourceProvenance(),
  harnessHash: contentHash(
    REPO_ROOT,
    [
      ...sourceFiles(fileURLToPath(new URL("./", import.meta.url))),
      fileURLToPath(new URL("../golden/worlds.ts", import.meta.url)),
    ].filter((path) => path.endsWith(".ts")),
  ),
  hardware: {
    platform: process.platform,
    arch: process.arch,
    osRelease: release(),
    node: process.version,
    v8: process.versions.v8,
    cpuModels: [...new Set(hardware.map((cpu) => cpu.model))],
    logicalCpus: hardware.length,
    availableParallelism: availableParallelism(),
    totalMemoryBytes: totalmem(),
    freeMemoryBeforeBytes: freemem(),
  },
  methodology: {
    execution:
      "One Node process, sequential synchronous shared kernels; no rendering, workers, transfer or GPU timing",
    sampleSetVersion: BENCH_SAMPLE_SET_VERSION,
    uniqueSurfaceCases: { lod0: lod0.length, lod1: lod1.length },
    sampleSetHash: "",
    warmup:
      "Separate initial pipeline and LOD1 calls are discarded; each measured repetition regenerates and relights fresh data",
    generation:
      "generateWorldChunk from the selected context: 32-cubed core plus 34x41x34 halo and context-layout Float64 columns; one WorldPlan per run",
    lighting:
      "solveLight over a real, unedited 96-cubed volume spanning 3x3x3 LOD0 chunks; preparation and halo extraction reported separately",
    meshing:
      "meshChunk using generated halo blocks and solved halo light; includes kernel allocations",
    coldPlan:
      "First buildWorldPlan call in this fresh process, before sample selection or warmup; hydration/context creation separately timed",
    sampleSelection:
      options.world === "main"
        ? "50 LOD0 and 20 LOD1 meaningful terrain interfaces per selected region; anchor plus a fixed permuted 512m lattice, filtered by actual dominant region and solid/open centre-column endpoints"
        : "50 LOD0 and 20 LOD1 fixed signed test-world surface addresses; original pond/origin/trees and distant relief selection",
    darkness:
      "A zero-skylight halo fails unless every open sample is water with enough additional water above to extinguish level-15 sunlight; raw rows retain the proof",
    median: "Middle value, averaging the two middle values for even N",
    p95: "Nearest rank: sorted[ceil(0.95*N)-1]",
    policy:
      "Budgets informational until phase 1.10; exceeding them does not fail this command",
    externalActivity:
      "Unknown to the process; caller must reserve the sampling/render lane before running",
  },
  unavailable: [
    ...(options.world === "test"
      ? ["WorldPlan cold-build timing: not applicable to the test world"]
      : []),
    "Detailed Ibara feature-dense benchmark: phase 1.3; current region cases measure first-pass terrain",
    "LOD2–6 full-height column tiles: phase 1.4; LOD1 voxel timings are not tile timings",
    "Lighting edits, worker-cache/transfer/upload, rendering and FPS are outside this kernel benchmark",
  ],
  warmupCompleted: { lod0: 0, lod1: 0 },
  rawLOD0,
  rawLOD1,
  summary,
  elapsedMs: 0,
  error: null as string | null,
};
await mkdir(join(REPO_ROOT, "out/step4"), { recursive: true });
const save = async (): Promise<void> => {
  const json = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(attemptOutput, json);
  await writeFile(output, json);
};
await save();
const start = performance.now();
try {
  let contextStart = performance.now();
  const plan = options.world === "main" ? buildWorldPlan(options.seed) : null;
  if (plan) receipt.worldPlanColdBuildMs = performance.now() - contextStart;
  contextStart = performance.now();
  const context = createWorldContext(
    plan
      ? { kind: "main", seed: options.seed, plan }
      : { kind: "test", seed: options.seed },
  );
  receipt.worldContextPreparationMs = performance.now() - contextStart;
  const selectionStart = performance.now();
  lod0.push(...benchmarkCases(context, 0, options.regions));
  lod1.push(...benchmarkCases(context, 1, options.regions));
  receipt.sampleSelectionMs = performance.now() - selectionStart;
  receipt.methodology.uniqueSurfaceCases = {
    lod0: lod0.length,
    lod1: lod1.length,
  };
  receipt.methodology.sampleSetHash = createHash("sha256")
    .update(JSON.stringify({ lod0, lod1 }))
    .digest("hex");
  await save();
  for (let i = 0; i < options.warmup; i++) {
    measurePipeline(
      lod0[Math.floor((i * lod0.length) / options.warmup)] as BenchmarkCase,
      -1,
      context,
    );
    receipt.warmupCompleted.lod0++;
    measureGeneration(
      lod1[Math.floor((i * lod1.length) / options.warmup)] as BenchmarkCase,
      -1,
      context,
    );
    receipt.warmupCompleted.lod1++;
  }
  console.log(
    `Warmup complete: ${options.warmup} real pipelines and ${options.warmup} LOD1 chunks discarded.`,
  );
  for (let repetition = 0; repetition < options.repetitions; repetition++) {
    for (const sample of lod0) {
      rawLOD0.push(measurePipeline(sample, repetition, context));
      if (rawLOD0.length % 25 === 0) {
        console.log(
          `LOD0 ${rawLOD0.length}/${lod0.length * options.repetitions}`,
        );
        await save();
      }
    }
    for (const sample of lod1)
      rawLOD1.push(measureGeneration(sample, repetition, context));
  }
  const addSummary = (
    name: string,
    values: number[],
    budget: TimingBudget | null,
  ): void => {
    const timing = summariseTimings(values);
    summary[name] = { timing, budget: compareBudget(timing, budget) };
    console.log(
      `${name}: median ${timing.medianMs.toFixed(3)}ms, p95 ${timing.p95Ms.toFixed(3)}ms, n=${timing.count}; ${summary[name].budget.status}`,
    );
  };
  addSummary(
    "lod0Generation",
    rawLOD0.map((row) => row.generationMs),
    { medianMs: 12, p95Ms: 40 },
  );
  addSummary(
    "lod0Lighting",
    rawLOD0.map((row) => row.lightingMs),
    { medianMs: 3 },
  );
  addSummary(
    "lod0Meshing",
    rawLOD0.map((row) => row.meshingMs),
    { medianMs: 4 },
  );
  addSummary(
    "neighbourhoodPreparation",
    rawLOD0.map((row) => row.neighbourhoodPreparationMs),
    null,
  );
  if (receipt.worldPlanColdBuildMs !== null)
    addSummary("worldPlanColdBuild", [receipt.worldPlanColdBuildMs], {
      medianMs: 3000,
    });
  for (const region of new Set(lod0.map((sample) => sample.region))) {
    const rows = rawLOD0.filter((row) => row.sample.region === region);
    const coarse = rawLOD1.filter((row) => row.sample.region === region);
    for (const [stage, values, budget] of [
      [
        "lod0Generation",
        rows.map((row) => row.generationMs),
        { medianMs: 12, p95Ms: 40 },
      ],
      ["lod0Lighting", rows.map((row) => row.lightingMs), { medianMs: 3 }],
      ["lod0Meshing", rows.map((row) => row.meshingMs), { medianMs: 4 }],
      [
        "neighbourhoodPreparation",
        rows.map((row) => row.neighbourhoodPreparationMs),
        null,
      ],
      ["haloLightExtraction", rows.map((row) => row.haloExtractionMs), null],
      ["pipelineTotal", rows.map((row) => row.totalMeasuredStagesMs), null],
      ["lod1Generation", coarse.map((row) => row.generationMs), null],
    ] as const) {
      const timing = summariseTimings(values);
      summary[`${region}.${stage}`] = {
        timing,
        budget: compareBudget(timing, budget),
      };
    }
  }
  addSummary(
    "haloLightExtraction",
    rawLOD0.map((row) => row.haloExtractionMs),
    null,
  );
  addSummary(
    "pipelineTotal",
    rawLOD0.map((row) => row.totalMeasuredStagesMs),
    null,
  );
  addSummary(
    "lod1Generation",
    rawLOD1.map((row) => row.generationMs),
    null,
  );
  receipt.status = "pass";
} catch (error) {
  receipt.status = "fail";
  receipt.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
  console.error(receipt.error);
} finally {
  receipt.elapsedMs = performance.now() - start;
  await save();
  console.log(`Benchmark receipt: ${attemptOutput} (latest: ${output})`);
}
