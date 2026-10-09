/** Browser/Node shared golden harness. No platform-dependent byte order or rounded floats. */
import { Block } from "../../../shared/src/blocks/registry.js";
import {
  CHUNK_VOLUME,
  HALO_VOLUME,
  HALO_WIDTH,
  RING_RADII,
} from "../../../shared/src/world/constants.js";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import type {
  SurfaceRegionId,
  WorldColumnLayout,
  WorldContext,
  WorldKind,
} from "../../../shared/src/world/types.js";
import type { VoxelChunk } from "../../../shared/src/worldgen/chunk.js";
import { generateWorldChunk } from "../../../shared/src/worldgen/main/chunk.js";
import {
  Column,
  createColumnSample,
  sampleTestColumn,
} from "../../../shared/src/worldgen/test-world.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { createRegionWeights } from "../../../shared/src/worldplan/index.js";
import { ibaraGoldenCases } from "./ibara-cases.js";
import {
  createWorldResolver,
  regionSurfaceAddresses,
  type WorldResolver,
} from "./worlds.js";

export const GOLDEN_SCHEMA = 2;
export const SAMPLE_SET_VERSION = 3;
export const GOLDEN_SEEDS = [1, 2, 3] as const;
export const HASH_ENCODING =
  "sha256; uint16-le; uint32-le; ieee754-binary64-le; signed-zero-preserved; NaN-rejected; main-feature-pair-halo-aligned";
export const GOLDEN_HASH_FIELDS = [
  "blocks",
  "haloBlocks",
  "density",
  "columns",
  "featureIds",
  "featureT",
] as const;

export interface GoldenCase {
  readonly id: string;
  readonly world: WorldKind;
  readonly region?: SurfaceRegionId;
  readonly seed: number;
  readonly lod: 0 | 1;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly spacing: 1 | 2;
  readonly coverage: string;
  readonly targetFeatureId?: number;
  readonly targetCalderaId?: number;
}
export interface ChunkHashes {
  readonly blocks: string;
  readonly haloBlocks: string;
  readonly density: string;
  readonly columns: string;
  readonly featureIds?: string;
  readonly featureT?: string;
}
export interface GoldenRecord {
  readonly sample: GoldenCase;
  readonly hashes: ChunkHashes;
}
export interface GoldenFixture {
  readonly schema: number;
  readonly sampleSetVersion: number;
  readonly worldgenVersion: number;
  readonly encoding: string;
  readonly provenance: {
    readonly sourceHash: string;
    readonly sourceCommit: string;
    readonly nodeVersion: string;
  };
  readonly records: readonly GoldenRecord[];
}

// Fixed XZ strata: spawn/pond/tree cells, each sign combination, regional-scale
// distances and both extreme corners. Only cy is derived, keeping surface cases
// surface-intersecting when the height field changes. The addresses are frozen
// into the fixture and compared by the test before evaluating it.
const SURFACE_ANCHORS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, -1],
  [-1, -1],
  [-2, 1],
  [3, 0],
  [-3, -2],
  [5, -4],
  [-6, 3],
  [8, 8],
  [-8, -8],
  [16, -16],
  [-16, 16],
  [32, 24],
  [-32, -24],
  [100, 0],
  [-100, 0],
  [0, 100],
  [0, -100],
  [240, 120],
  [-240, -120],
  [300, -250],
  [-300, 250],
  [703, 703],
  [-704, -704],
];

/** Exactly 50 cases per seed: 26 surface + 4 vertical/frame LOD0, 20 surface LOD1. */
export function testGoldenCases(): GoldenCase[] {
  const cases: GoldenCase[] = [];
  const column = createColumnSample();
  for (const seed of GOLDEN_SEEDS) {
    for (let i = 0; i < SURFACE_ANCHORS.length; i++) {
      const [cx, cz] = SURFACE_ANCHORS[i] as readonly [number, number];
      sampleTestColumn(seed, cx * 32 + 16.5, cz * 32 + 16.5, column);
      cases.push({
        id: `s${seed}-lod0-surface-${i.toString().padStart(2, "0")}`,
        world: "test",
        seed,
        lod: 0,
        cx,
        cy: Math.floor((column[Column.Height] as number) / 32),
        cz,
        spacing: 1,
        coverage:
          i < 10
            ? "spawn-pond-trees-signed-near"
            : i >= 24
              ? "xz-frame-boundary"
              : "signed-distant-relief",
      });
    }
    for (const extra of [
      { id: "floor", cx: -1, cy: -48, cz: 0 },
      { id: "worldstone-transition", cx: 0, cy: -47, cz: -1 },
      { id: "deep-stone", cx: 0, cy: -8, cz: 1 },
      { id: "sky-ceiling", cx: 0, cy: 31, cz: 0 },
    ])
      cases.push({
        ...extra,
        id: `s${seed}-lod0-${extra.id}`,
        world: "test",
        seed,
        lod: 0,
        spacing: 1,
        coverage: extra.id,
      });
    for (let i = 0; i < 20; i++) {
      const [cx, cz] =
        i < 18
          ? (SURFACE_ANCHORS[i] as readonly [number, number])
          : i === 18
            ? [351, 351]
            : [-352, -352];
      sampleTestColumn(seed, cx * 64 + 33, cz * 64 + 33, column);
      cases.push({
        id: `s${seed}-lod1-surface-${i.toString().padStart(2, "0")}`,
        world: "test",
        seed,
        lod: 1,
        cx: cx as number,
        cy: Math.floor((column[Column.Height] as number) / 64),
        cz: cz as number,
        spacing: 2,
        coverage: i >= 18 ? "xz-frame-boundary" : "two-metre-point-samples",
      });
    }
  }
  return cases;
}

/** 50 additional cases/seed: 32 regional, ten warped transitions, four corners,
 * four vertical bands. Test-world definitions above retain their exact ordering. */
export function mainGoldenCases(context: WorldContext): GoldenCase[] {
  if (context.kind !== "main")
    throw new Error("Main goldens require a main context");
  const seed = context.seed;
  const cases: GoldenCase[] = [];
  for (const lod of [0, 1] as const)
    for (const region of SURFACE_REGIONS) {
      const address = regionSurfaceAddresses(context, region.id, lod, 1)[0];
      if (!address) throw new Error(`Missing golden region ${region.id}`);
      cases.push({
        id: `main-s${seed}-lod${lod}-${region.id}`,
        world: "main",
        seed,
        lod,
        ...address,
        spacing: lod === 0 ? 1 : 2,
        region: region.id,
        coverage: "dominant-region-terrain-air-or-water-interface",
      });
    }
  const column = context.createColumn();
  const surface = (
    id: string,
    cx: number,
    cz: number,
    coverage: string,
  ): void => {
    context.sampleColumn(cx * 32 + 16.5, cz * 32 + 16.5, column);
    cases.push({
      id: `main-s${seed}-lod0-${id}`,
      world: "main",
      seed,
      lod: 0,
      cx,
      cy: Math.floor(Number(column[context.columns.height]) / 32),
      cz,
      spacing: 1,
      coverage,
    });
  };
  const weights = createRegionWeights();
  for (const [name, radius] of Object.entries(RING_RADII)) {
    let bestX: number = radius;
    let bestWeight = Infinity;
    for (let x = radius - 500; x <= radius + 500; x += 4) {
      context.surfaceWeights(x, 16.5, weights);
      const top = Number(weights.weights[0]);
      if (weights.count > 1 && top < bestWeight) {
        bestX = x;
        bestWeight = top;
      }
    }
    if (!Number.isFinite(bestWeight))
      throw new Error(`Missing ${name} ring transition`);
    for (const offset of [-32, 32])
      surface(
        `${name}-${offset < 0 ? "inside" : "outside"}`,
        Math.floor((bestX + offset) / 32),
        0,
        "warped-ring-transition",
      );
  }
  for (const [cx, cz] of [
    [-704, -704],
    [-704, 703],
    [703, -704],
    [703, 703],
  ] as const)
    surface(`frame-${cx}-${cz}`, cx, cz, "xz-frame-boundary-signed-corner");
  for (const [id, cy] of [
    ["floor", -48],
    ["worldstone-transition", -47],
    ["deep-stone", -8],
    ["sky-ceiling", 31],
  ] as const)
    cases.push({
      id: `main-s${seed}-lod0-${id}`,
      world: "main",
      seed,
      lod: 0,
      cx: -1,
      cy,
      cz: -1,
      spacing: 1,
      coverage: id,
    });
  return cases;
}

export function goldenCases(
  worlds: WorldResolver = createWorldResolver(),
): GoldenCase[] {
  return [
    ...testGoldenCases(),
    ...GOLDEN_SEEDS.flatMap((seed) => mainGoldenCases(worlds("main", seed))),
    // Original 300 definitions and ordering remain the prefix. Diagnostic
    // primitive records never enter this production acceptance set.
    ...GOLDEN_SEEDS.flatMap((seed) => ibaraGoldenCases(worlds("main", seed))),
  ];
}

/** Explicit LE encoding is independent of the host's typed-array byte order. */
export function encodeUint16(values: Uint16Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++)
    view.setUint16(i * 2, values[i] as number, true);
  return bytes;
}
export function encodeUint32(values: Uint32Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++)
    view.setUint32(i * 4, values[i] as number, true);
  return bytes;
}
export function encodeFloat64(values: Float64Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(values.length * 8);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) {
    const value = values[i] as number;
    if (Number.isNaN(value))
      throw new Error(`NaN in deterministic output at index ${i}`);
    view.setFloat64(i * 8, value, true);
  }
  return bytes;
}
export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", bytes),
  );
  let hex = "";
  for (const byte of digest) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
/** Hash all deterministic typed fields, so unchanged block IDs cannot hide density/halo drift. */
export async function hashChunk(
  chunk: VoxelChunk,
  layout: WorldColumnLayout,
  world: WorldKind = "test",
): Promise<ChunkHashes> {
  if (
    chunk.blocks.length !== CHUNK_VOLUME ||
    chunk.haloBlocks.length !== HALO_VOLUME ||
    chunk.density.length !== HALO_VOLUME ||
    !Number.isInteger(layout.stride) ||
    layout.stride < 1 ||
    chunk.columns.length !== HALO_WIDTH * HALO_WIDTH * layout.stride
  )
    throw new Error("Unexpected golden chunk layout");
  if (
    world === "main"
      ? !(chunk.featureIds instanceof Uint32Array) ||
        !(chunk.featureT instanceof Float64Array) ||
        chunk.featureIds.length !== HALO_VOLUME ||
        chunk.featureT.length !== HALO_VOLUME
      : chunk.featureIds !== undefined || chunk.featureT !== undefined
  )
    throw new Error(
      "Golden feature buffers must be a halo-aligned pair for main and absent for test",
    );
  return {
    blocks: await sha256(encodeUint16(chunk.blocks)),
    haloBlocks: await sha256(encodeUint16(chunk.haloBlocks)),
    density: await sha256(encodeFloat64(chunk.density)),
    columns: await sha256(encodeFloat64(chunk.columns)),
    ...(world === "main"
      ? {
          featureIds: await sha256(
            encodeUint32(chunk.featureIds as Uint32Array),
          ),
          featureT: await sha256(encodeFloat64(chunk.featureT as Float64Array)),
        }
      : {}),
  };
}
export async function computeGolden(
  sample: GoldenCase,
  context: WorldContext,
): Promise<GoldenRecord> {
  if (
    sample.world !== context.kind ||
    sample.seed !== context.seed ||
    sample.spacing !== sample.lod + 1
  )
    throw new Error("Golden sample and world context differ");
  const chunk = generateWorldChunk(
    context,
    sample.cx,
    sample.cy,
    sample.cz,
    sample.spacing,
  );
  if (
    sample.targetFeatureId !== undefined &&
    !chunk.featureIds?.includes(sample.targetFeatureId)
  )
    throw new Error(
      `${sample.id}: addressed target feature is absent from generated halo`,
    );
  if (sample.coverage === "caldera-lava" && !chunk.blocks.includes(Block.Lava))
    throw new Error(
      `${sample.id}: addressed caldera has no generated core lava`,
    );
  return {
    sample,
    hashes: await hashChunk(chunk, context.columns, context.kind),
  };
}
/** Sequential by design: one chunk's temporary buffers at a time in every runtime. */
export async function computeGoldens(
  samples: readonly GoldenCase[],
  progress?: (completed: number, total: number) => void,
  worlds: WorldResolver = createWorldResolver(),
): Promise<GoldenRecord[]> {
  const results: GoldenRecord[] = [];
  for (const sample of samples) {
    results.push(
      await computeGolden(sample, worlds(sample.world, sample.seed)),
    );
    progress?.(results.length, samples.length);
  }
  return results;
}
export function currentGoldenContract(): Pick<
  GoldenFixture,
  "schema" | "sampleSetVersion" | "worldgenVersion" | "encoding"
> {
  return {
    schema: GOLDEN_SCHEMA,
    sampleSetVersion: SAMPLE_SET_VERSION,
    worldgenVersion: WORLDGEN_VERSION,
    encoding: HASH_ENCODING,
  };
}
export function compareGoldenRecords(
  expected: readonly GoldenRecord[],
  actual: readonly GoldenRecord[],
): string[] {
  const failures: string[] = [];
  if (expected.length !== actual.length)
    failures.push(
      `Record count: expected ${expected.length}, received ${actual.length}`,
    );
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    const a = expected[i] as GoldenRecord;
    const b = actual[i] as GoldenRecord;
    if (JSON.stringify(a.sample) !== JSON.stringify(b.sample))
      failures.push(
        `Sample ${i} (${a.sample.id}): address/coverage contract differs`,
      );
    for (const field of GOLDEN_HASH_FIELDS)
      if (a.hashes[field] !== b.hashes[field])
        failures.push(
          `${a.sample.id}.${field}: expected ${a.hashes[field]}, received ${b.hashes[field]}`,
        );
  }
  return failures;
}
