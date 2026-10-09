import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { buildWorldPlan } from "../../../shared/src/worldplan/index.js";
import { contentHash, sourceFiles } from "../build/metadata.js";
import { goldenSourceProvenance, REPO_ROOT } from "../golden/fixture.js";
import { parseFlags, seedValue, value } from "../terrain-review/arguments.js";
import { ibaraReviewFromContext } from "../terrain-review/source.js";
import {
  CENSUS_BOUNDS,
  censusParameters,
  censusTips,
  createParameterWitness,
  type nearestNeighbours,
  type ParameterWitness,
  type ParameterWitnessIdentity,
  parameterStatistics,
  sampleCoverage,
  sampleSpatial,
  topologyStatistics,
  validateWitnessPairClosure,
} from "./ibara.js";

/** Immutable per-attempt sidecar. Hash the exact persisted UTF8 bytes and verify
 * the disk round-trip before a receipt can claim its operands are available. */
export async function persistParameterWitness(
  path: string,
  witness: ParameterWitness,
  pairs: ReturnType<typeof nearestNeighbours>,
) {
  const bytes = Buffer.from(`${JSON.stringify(witness)}\n`, "utf8"),
    sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(path, bytes, { flag: "wx" });
  const saved = await readFile(path);
  if (createHash("sha256").update(saved).digest("hex") !== sha256)
    throw new Error("Parameter witness byte hash mismatch");
  const restored = JSON.parse(saved.toString("utf8")) as ParameterWitness;
  const closure = validateWitnessPairClosure(restored, pairs);
  return {
    schema: witness.schema,
    path: basename(path),
    pathPolicy: "relative to this receipt's directory",
    sha256,
    bytes: saved.byteLength,
    fields: witness.fields,
    encoding: witness.encoding,
    policy: witness.policy,
    identity: witness.identity,
    closure,
    pairReferences:
      "parameters.nearestNeighbours[].id and neighbourId reference the sidecar rows' id field; every accepted ordinary ID appears exactly once as a focal row",
  };
}

export function parseTerrainReport(args: readonly string[]) {
  const flags = parseFlags(args, [
    "seed",
    "seeds",
    "region",
    "stage",
    "coverage-spacing",
    "patches",
    "component-cap",
    "out",
  ]);
  if (flags.has("seed") && flags.has("seeds"))
    throw new Error("Use --seed or --seeds, not both");
  const seeds = flags.has("seeds")
    ? value(flags, "seeds", "").split(",").map(Number)
    : [seedValue(flags)];
  if (
    !seeds.length ||
    new Set(seeds).size !== seeds.length ||
    seeds.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffffffff)
  )
    throw new Error("Seeds must be distinct unsigned 32-bit integers");
  const region = value(flags, "region", "hellscape"),
    stage = value(flags, "stage", "complete");
  if (region !== "hellscape")
    throw new Error("This phase implements terrain-report for hellscape only");
  if (stage !== "parameters" && stage !== "complete")
    throw new Error("Stage must be parameters or complete");
  const integer = (
    name: string,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const n = Number(value(flags, name, String(fallback)));
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`${name} must be ${min}..${max}`);
    return n;
  };
  return {
    help: flags.has("help"),
    seeds,
    region,
    stage,
    coverageSpacing: integer("coverage-spacing", 64, 8, 256),
    patches: integer("patches", 12, 1, 100),
    componentCap: integer("component-cap", 100000, 32, 1000000),
    output: resolve(
      value(flags, "out", join(REPO_ROOT, "out/terrain-report/main")),
    ),
  };
}
export async function runTerrainReport(args: readonly string[]): Promise<void> {
  const options = parseTerrainReport(args);
  if (options.help) {
    console.log(
      "terrain-report --seed 1 | --seeds 1,2,3 --region hellscape\n  --stage parameters|complete --coverage-spacing 64 --patches 12 --component-cap 100000 --out directory\nParameters enumerates the entire production accepted population without constructing curves.\nComplete additionally checks every curve tip and sampled masks/surfaces/components. Full production runs require the coordinator's exclusive heavy lane. Receipts distinguish sampled diagnostics and full parameter census; incomplete work never passes.",
    );
    return;
  }
  const abort = new AbortController(),
    stop = () => abort.abort(new Error("Interrupted by caller"));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await mkdir(options.output, { recursive: true });
  try {
    for (const seed of options.seeds) {
      abort.signal.throwIfAborted();
      const startedAt = new Date().toISOString(),
        start = performance.now();
      const receipt: Record<string, unknown> = {
        schema: "coldfront.terrain-report/1",
        status: "running",
        startedAt,
        seed,
        world: "main",
        region: "hellscape",
        worldgenVersion: WORLDGEN_VERSION,
        source: goldenSourceProvenance(),
        harnessHash: contentHash(REPO_ROOT, [
          ...sourceFiles(join(REPO_ROOT, "packages/tools/src/terrain-report")),
          join(REPO_ROOT, "packages/tools/src/terrain-review/source.ts"),
        ]),
        options,
        domain: CENSUS_BOUNDS,
        stage: "plan",
        phaseAcceptance: false,
        failures: [],
        caps: { componentVoxels: options.componentCap },
        elapsedMs: 0,
      };
      const target = join(
          options.output,
          `hellscape-s${seed}-${startedAt.replaceAll(":", "-")}.json`,
        ),
        latest = join(options.output, `hellscape-s${seed}.json`);
      const save = async () => {
        receipt.elapsedMs = performance.now() - start;
        const json = `${JSON.stringify(receipt, null, 2)}\n`;
        await writeFile(target, json);
        await writeFile(latest, json);
      };
      await save();
      let lastSave = performance.now();
      const control = {
        signal: abort.signal,
        checkpoint: async () => {
          await setImmediate();
          if (performance.now() - lastSave > 5000) {
            lastSave = performance.now();
            await save();
          }
        },
      };
      try {
        const plan = buildWorldPlan(seed),
          context = createWorldContext({ kind: "main", seed, plan }),
          review = ibaraReviewFromContext(context);
        receipt.stage = "parameters";
        await save();
        const census = await censusParameters(review, control),
          statistics = parameterStatistics(census.parameters);
        const { parameters, ...population } = census;
        receipt.population = population;
        receipt.parameters = statistics;
        receipt.acceptedPopulationHash = createHash("sha256")
          .update(JSON.stringify(parameters))
          .digest("hex");
        const source = receipt.source as ReturnType<
          typeof goldenSourceProvenance
        >;
        const witnessIdentity: ParameterWitnessIdentity = {
          seed,
          world: "main",
          region: "hellscape",
          worldgenVersion: WORLDGEN_VERSION,
          sourceHash: source.sourceHash,
          sourceCommit: source.sourceCommit,
          harnessHash: receipt.harnessHash as string,
          acceptedPopulationHash: receipt.acceptedPopulationHash as string,
          domain: CENSUS_BOUNDS,
        };
        receipt.parameterWitness = await persistParameterWitness(
          target.replace(/\.json$/, "-parameters.json"),
          createParameterWitness(parameters, witnessIdentity),
          statistics.nearestNeighbours,
        );
        receipt.topology = topologyStatistics(review.plan);
        receipt.parameterCache = {
          cells: review.features.cachedCellCount,
          placementCells: review.features.cachedPlacementCellCount,
          instances: review.features.cachedInstanceCount,
          policy:
            "Counts only; JS heap bytes unmeasured. Parameter stage must instantiate zero curves.",
        };
        if (review.features.cachedInstanceCount !== 0)
          throw new Error(
            "Parameter census unexpectedly instantiated geometry",
          );
        await save();
        if (options.stage === "parameters") {
          receipt.status = "incomplete";
          receipt.stage = "parameters-complete";
          receipt.unavailable = [
            "All-instance tip census and sampled voxel diagnostics deliberately not requested",
          ];
        } else {
          receipt.stage = "tips";
          await save();
          const tips = await censusTips(
            parameters,
            review.instantiate,
            control,
          );
          receipt.tips = tips;
          await save();
          receipt.stage = "coverage";
          await save();
          const { candidates, ...coverage } = await sampleCoverage(
            review,
            options.coverageSpacing,
            control,
          );
          receipt.coverage = coverage;
          await save();
          receipt.stage = "spatial";
          await save();
          const spatial = await sampleSpatial(
            context,
            candidates,
            options.patches,
            options.componentCap,
            control,
          );
          receipt.spatial = spatial;
          const topology = receipt.topology as ReturnType<
            typeof topologyStatistics
          >;
          const complete = spatial.status !== "incomplete";
          receipt.status = !complete
            ? "incomplete"
            : statistics.status === "pass" &&
                tips.status === "pass" &&
                spatial.status === "pass" &&
                topology.status === "pass"
              ? "pass"
              : "fail";
          receipt.stage = "complete";
          receipt.phaseAcceptance = false;
          receipt.acceptanceBoundary =
            "This numeric receipt cannot establish HELL visual or complete-world acceptance. Each of seeds 1-3 requires its own complete passing receipt and visual gates.";
        }
        const after = goldenSourceProvenance();
        if (
          after.sourceHash !==
          (receipt.source as ReturnType<typeof goldenSourceProvenance>)
            .sourceHash
        )
          throw new Error(
            "Production source changed during diagnostics; receipt invalid",
          );
      } catch (error) {
        receipt.status = abort.signal.aborted ? "cancelled" : "fail";
        receipt.failures = [String(error)];
      } finally {
        await save();
        console.log(
          JSON.stringify({
            seed,
            status: receipt.status,
            stage: receipt.stage,
            receipt: target,
          }),
        );
      }
      if (receipt.status !== "pass") process.exitCode = 1;
      if (abort.signal.aborted) break;
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await runTerrainReport(process.argv.slice(2));
