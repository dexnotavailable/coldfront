# Phase 1.3 — Terrain toolkit and Ibara

Integration plan prepared by the Astra design route and reviewed by the coordinator. Phase 1.2 content/runtime acceptance is recorded at 9b212a4 (published runtime 18a975d); the coordinator confirmed PR #5 merged as 1a28c2a after clean Node 22 and CI checks. P0 below freezes shared dependencies and contracts only. It does not implement or accept phase 1.3 terrain.

Document and then implement the complete phase 1.3 after phase 1.2 closure: production Ibara terrain, feature toolkit, lava, materials, lighting, diagnostics and catalogue controls, accepted through three-seed numeric evidence and blind HELL-1/HELL-2 reviews.

## Accepted inputs and evidence limits

- Inspected canonical D:/Dex/Projects/coldfront: git branch --show-current returned codex/phase-1-2-postcards; git log -1 returned 058775e. git status --short confirmed the uncommitted postcard/runtime transition work. These files must be reconciled after phase 1.2 closes.
- Read AGENTS.md; docs/08-roadmap.md phase 1.3; docs/04-terrain.md determinism, feature, fluid, rendering, review and budget contracts; docs/07-architecture.md; docs/10-prior-art.md reuse rules; docs/11-interface-catalogue.md Part A and phase 1.3 rows; relevant docs/18-look-and-feel.md sections.
- Inspected WorldContext, main columns and voxel assembly, WorldPlan ownership/transport, block registry/recipes, greedy meshing, light propagation, worker protocol/caches, shaders, streaming bounds, postcard resolution and golden hashing.
- D:/Dex/Temp/coldfront-asset-ibara/out/ibara/pass02b/candidate.json records 72 focused checks and isolated seed-1 cluster/arch captures. Get-FileHash confirmed all 15 listed source files match their receipt hashes, including the five frozen public SDF files.
- Ibara review.json records 12 inspected images and explicit residuals; hook-regression-fixed.json covers only 15 flat-ground landmark cells across seeds 1–3. Images were not independently regraded and tests were not rerun in this planning task.
- Inspected only D:/Dex/Temp/coldfront-asset-tree/out/tree/bark-dependency.json for the tree lane: Bark ID 32, preservation of IDs 0–31, registry/recipe/test dependency and baseline texture hashes. House/tree geometry remains separate.

## Ownership and sequence

### P0-contracts-and-frozen-sdf

Dependencies: none.

Root owns the documented contracts and exact SDF adoption. Import the five manifest-matched SDF files unchanged. Freeze the following interfaces before writers start: optional featureId/featureT on VoxelSample with explicit zero outputs outside features; halo-aligned Uint32Array featureIds and Float64Array featureT on main VoxelChunk, absent/zero for the unchanged test generator; prepareArea(bounds, spacing = 1); structured-cloneable Ibara plan data; separate lava ownership queries without changing WaterSample's water-only meaning. Freeze downstream mesh attributes, source packing, material IDs and renderer view API in the plan. New files named below are proposed additions.

Owned paths:

- `docs/plans/phase-1-3.md`
- `packages/shared/src/sdf/ops.ts`
- `packages/shared/src/sdf/polygon.ts`
- `packages/shared/src/sdf/primitives.ts`
- `packages/shared/src/sdf/spine.ts`
- `packages/shared/src/sdf/types.ts`
- `packages/shared/test/sdf.test.ts`
- `packages/shared/test/phase13-contracts.test.ts`
- `packages/shared/src/world/types.ts`
- `packages/shared/src/worldgen/chunk.ts`
- `packages/shared/src/index.ts`
- `THIRD_PARTY_NOTICES.md`

Acceptance:

- The frozen SDF hashes match candidate.json; tests retain the 24-segment maximum, 0.5 m chord-error maximum and 12-degree joint maximum.
- Existing callers remain valid with default spacing 1; test-world eight-lane columns and original four generated buffers remain unchanged.
- Document original SDF derivation and preserve existing MIT notices; no external code acquisition is needed.
- No WORLDGEN_VERSION bump for this planning/dependency-only step.

#### Frozen P0 contracts (2026-10-09)

The declarations in `world/types.ts` and `worldgen/chunk.ts` are the type owner.
The following future functions belong to their named packages; they are **not**
P0 runtime implementations. P1/P2/P3 import shared contracts and own disjoint
files. They must not edit this plan, the SDF files or another package's files.

**Adoption and version boundary.** All five SDF sources are copied unchanged
from `D:/Dex/Temp/coldfront-asset-ibara`, matched to its
`out/ibara/pass02b/candidate.json`. The matching study test is also copied
unchanged. No Ibara feature source is adopted until P1. Keep these hashes:

| File under `packages/shared/` | SHA-256 |
|---|---|
| `src/sdf/ops.ts` | `9d4c3b24ebeada590e2d5ac357ae4da6d0deee94fb48237e1d8720f040a6385e` |
| `src/sdf/polygon.ts` | `557dbd6a17e4acc7e79e2794acb775e391959ff3f56b23b5e9e8dbf947df0cb0` |
| `src/sdf/primitives.ts` | `405cfaddb4af4454f52dddb6a07ef508d586041b37d4ec15f9c8c28aa674081a` |
| `src/sdf/spine.ts` | `5f6ca60ed57ad4d0fa14d2080e0bfbb4a9e93c358087dd4ec6137f87c77fbc03` |
| `src/sdf/types.ts` | `b3e59495a8170b37d1a19df47c1b8d222d8f8903d82e68f5fba15c65c0027340` |
| `test/sdf.test.ts` | `aba64a0f4a820ff8305f174b58f16c34b90272a2f73fb5ea3721a8311bac2b26` |

Source fingerprints already include SDF sources. P0 therefore changes the
source identity despite preserving generated buffers; **do not publish P0 as a
standalone generation-2 release**. P4 integrates actual generation-3 output,
adds the feature directory to fingerprints and coordinates schema/identity.

**Samples and chunks.** `VoxelSample` gains optional `featureId?: number` and
`featureT?: number`. P4's main sampler writes both on every call: exact uint32 ID
and normalized arc length in binary64; ordinary terrain, air, fluids and edits
get `(0,0)`. Reusing a scratch sample must never retain a previous thorn's ID/t.
An absent pair is interpreted as `(0,0)` for legacy/test callers. The direct
test-world sampler and its eight column lanes stay unchanged. The package-root
legacy `VoxelSample` remains the test type; `WorldVoxelSample` explicitly exports
the common type without changing that existing name.

`VoxelChunk.featureIds?: Uint32Array` and `featureT?: Float64Array` are a pair.
P4 main assembly allocates both with `HALO_VOLUME = 34*41*34 = 47396` entries,
using `haloIndex(x,y,z)` for x/z -1..32 and y -1..39. These are not core-only
arrays. Existing blocks, haloBlocks, density and columns are unchanged. The
test generator omits both new arrays. Generation, cached values and material
selection retain binary64 t; no feature t is needed on the GPU after material
selection. No P0 generator starts allocating these arrays.

**Spacing.** The optional declaration is
`prepareArea(bounds: XZBounds, spacing?: number): WorldAreaSampler`, default 1.
P0 deliberately does not forward or implement the parameter in existing
contexts. P4 validates finite positive spacing, forwards it from
`generateWorldChunk`, uses it in feature collection and sampling, and includes
it in cache identity. Test terrain keeps its existing arbitrary positive
spacing behavior. Ibara production supports 1..64 m (including non-powers of
two); P1 must reject unsupported spacing explicitly, not silently clamp.
Context convenience queries mean spacing 1; a coarse comparison must use two
prepared areas with the same spacing. Bounds include the maximum declared
thickening. Size filtering precedes geometry construction: landmarks retained,
thicken only for h >= 2s by at most min(0.5s,0.3h), drop under h < 2s.

**P1 geometry/material boundary.** Preserve the study's existing exported
functions and argument order (`createIbaraField`, `compareThorns`,
`createIbaraBatch`, `instantiateThorn`). `IbaraEnvironment` stays:

```ts
interface IbaraEnvironment {
  readonly seed: number;
  surfaceAt(x: number, z: number): number; // final volcanic ground, before thorns
  weightAt(x: number, z: number): number; // actual blended hellscape weight
  lavaAt?(x: number, z: number, out: Float64Array): Float64Array;
}
```

`lavaAt` overwrites three lanes `[distanceMetres,outwardUnitX,outwardUnitZ]`;
no source writes `[Infinity,0,0]`. It describes nearest actual hot ownership,
including when the queried point is dry, and never fills fluid. Resolve equal
distances by source-kind order caldera/channel/fissure, then owner ID, then
segment index. At zero distance use the deterministic source normal (or `[0,0]`
if undefined, allowing P1's existing hashed fallback).

P1 adds `broken: boolean` to `IbaraSample`, resets it on clear, and copies it
with the winning sample. Its material fields structurally satisfy
`IbaraMaterialSample` in shared world types, so P3 can compile without P1's
implementation. The winning parent supplies core/crust/broken; branches,
debris and rubble inherit its ID while keeping their distinct `kind` and t.
The existing sample's `distance` and `fillet` remain geometry-owned.

P1 adds `parametersForCell(cellX: number, cellZ: number, landmark?: boolean):
readonly ThornParameters[]` to `IbaraField`. Default landmark=false. It returns
the final placement-accepted parameters before curve construction, in canonical
order and without instantiating spines. `cell`, `landmarks` and `collect` derive
from those same parameters; P7 tiles cell enumeration, never repeats placement
formulas. P1 may expose additional census counters inside its own module when
needed, but they must distinguish candidate rejection from geometry failure.

**P2 plan and ground boundary.** `IbaraPlanData`, `IbaraRoutingData`,
`IbaraCalderaData`, `IbaraLavaChannelData` and `IbaraVentData` are concrete shared
data declarations. Plans contain records, typed arrays and numbers only.
Channel points have stride 5 `[x,z,bed,level,halfWidth]` in source-to-sink order;
channel ID and zero-based segment index identify each segment. Local drainage
uses a separate 64 m grid and never writes global water arrays. Caldera/channel/
vent arrays are ascending ID order. Bounds cover excavation and maximum rise,
including displacement, fillets, levees and lava levels. Fissures/plates/dunes
remain seed-and-world-position analytic data; runtime indexes are rebuilt on
hydration, not serialized caches.

P2 exports these signatures from its owned files:

```ts
// worldplan/ibara.ts; baseField is pre-Ibara, avoiding recursive plan building
buildIbaraPlan(basePlan: WorldPlanData, baseField: MainField): IbaraPlanData;
// worldgen/main/ibara-ground.ts
interface IbaraGround {
  height(x: number, z: number): number;
  sample(x: number, y: number, z: number, out: IbaraGroundSample): IbaraGroundSample;
  lavaQuery(x: number, z: number, out: LavaSample): LavaSample;
  lavaAt(x: number, z: number, out: Float64Array): Float64Array;
  conservativeBounds(bounds: XZBounds, out: WorldBounds): WorldBounds;
}
createIbaraGround(baseField: MainField, plan: IbaraPlanData): IbaraGround;
```

`sample` returns the complete pre-thorn volcanic ground density (positive
inside), surfaceY and a shared `IbaraGroundTag`. It is not a density delta.
It preserves base-field behavior where hellscape weight is zero. `lavaQuery`
returns a local owner only; every call clears dry results to bodyId=0,
kind/source=`none`, bed/level=-Infinity. Wet results identify a caldera, channel
or fissure with finite bed < level. P4 fills only negative-density samples with
bed < y <= level inside that owner's wet footprint. Proximity alone cannot
fill lava. WaterSample, waterQuery, waterBodies and global basinIds stay
water-only. Fissure owner IDs derive from signed world cells, never query order.

P4 adds required `ibara: IbaraPlanData` to main `WorldPlanData` and advances the
outer schema to 2 together with validators, checksums, hydration and buffer
transport. P0 leaves the existing schema-1 builder/hydrator untouched. Validate
array lengths, finite geometry, positive radii/widths, unique IDs, channel
caldera references, downstream levels and receiver/order invariants before
use. Clone all new arrays for the non-shared route; the SharedArrayBuffer route
must account for them without transferring/detaching the plan owner's buffers.

**P3 material boundary.** P3 exports these pure functions from
`worldgen/main/ibara-material.ts`, using shared types only:

```ts
ibaraGroundMaterial(tag: IbaraGroundTag, baseBlock: number): number;
ibaraMaterial(x: number, y: number, z: number, baseBlock: number,
  feature: IbaraMaterialSample): number;
```

The first maps tags (`base` preserves baseBlock); the second preserves baseBlock
for featureId=0/kind=`none`, otherwise uses the already sampled dominant
feature. Only intact primary thorns with t > 0.85 receive tip crust; broken
owners, branches, debris and rubble do not accidentally acquire parent-tip
crust. P1 reports these distinctions; P3 must not re-derive geometry or use a
cache lookup to identify material. Grounded ash/scree rules belong here.

Preserve IDs 0..31 and the first 192 texture layers. Bark=32 is reserved for the
narrow tree dependency; then Obsidian=33, EmberCrust=34, BrimstoneCrust=35,
SulphurCrust=36, Lava=37, VentMouth=38. Reuse Basalt=18/Ash=29. P3 adds required
`emission: readonly [number,number,number]` (integer RGB nibbles 0..15),
`emissionStrength: number` (finite nonnegative HDR render multiplier),
`gloss: number` (0..1), and `fluidKind: "none" | "water" | "lava"` to each
BlockDefinition. Defaults are `[0,0,0]`, 0, 0 and `none`; existing Water gets
`water`. Lava is renderType=`fluid`, fluidKind=`lava`, solid=false, opaque=true,
lightFiltering=15; its draw is visually opaque while occupancy remains fluid.
Exact source colours/intensities are P3 authored data, not timed animation.

**P5/P6 CPU, worker and GPU layout.** Preserve light packing:
`(sky<<12)|(red<<8)|(green<<4)|blue`. An emitter's source word has zero sky;
top skylight replacement is `(source & 0x0fff) | (sky << 12)`. Removal/placement
updates actual source arrays before incremental relighting, including opaque
emitters. Rendered emission and RGB light propagation are separate quantities.

P5 changes the mesher signature to
`meshChunk(blocks: Uint16Array, lights: Uint16Array, featureIds?: Uint32Array):
ChunkMesh`, with all inputs halo-indexed and absent IDs meaning zero.
Merge keys add the exact uint32 ID to existing block/AO/light keys, including
skirts. `MeshPart` adds required `featureIdParts: Uint16Array`, two values per
vertex `[id & 0xffff, id >>> 16]`. All vertices of a face carry the same ID.
Keep `surfaces` unchanged: Float32 triples `[block,AO,packedLight]`. Other mesh
buffers keep existing formats. CPU ID 0 means no feature; current Ibara IDs
remain unchanged below 2^25. Reserve bits 25..31 for future families;
family 1 (`0x02000000`) owns volcanic shapes, with disjoint local caldera,
channel, vent and fissure IDs allocated by P2. Local lava body IDs and global
feature IDs must never be confused with water body IDs.

P6 binds `featureIdParts` as itemSize=2, normalized=false, float-input
attributes. Each half is exactly representable in float32. Pass the pair flat
to the fragment shader and reconstruct with highp uint arithmetic
`uint(lo) | (uint(hi) << 16u)` if a full ID is needed. Never combine into one
float32 ID or interpolate IDs; include both halves in feature-colour hashing.
Feature 0 uses neutral terrain colour. P5 adds the new buffer to mesh transfer
lists and memory accounting; transfer newly owned output buffers only, never
retained generation/cache/plan arrays. P4/P5 zero feature metadata when edits
replace generated blocks and invalidate overlapping halo/cached mesh data.

Mesh parts remain 0 opaque, 1 cutout, 2 translucent, 3 water; append 4 lava.
P6 material index 4 is opaque emissive fluid with depthWrite=true and
transparent=false, while water retains its phase-1.2 depth-aware material.
Lava's static emitted RGB light comes from registry sources; moving crust
cracks/flame/embers use the display clock and never alter source light values.

P6 exports `TerrainViewMode = "normal" | "clay" | "features"` from
terrain-material.ts and adds `WorldRenderer.setViewMode(mode: TerrainViewMode):
void`. `TerrainUniforms.viewMode` is `IUniform<number>` (normal=0, clay=1,
features=2). `createTerrainMaterials` retains its existing return shape and
appends material 4. P8 routes controls through this method. All modes use the
same geometry, clipping and origin; clay retains sun/AO, features is flat
identity colour, and both suppress decorative emission/effects. Normal mode
uses existing HalfFloat/bloom/ACES machinery with source-only bloom.

P0 verification in `D:/Dex/Temp/coldfront-phase13-contracts` at base 9b212a4:
64 tests pass across `sdf.test.ts`, `phase13-contracts.test.ts` and
`forbidden-tokens.test.ts`; six preserved test-world records cover seeds 1..3,
negative coordinates and both existing LODs. Shared source/test, client and
tools TypeScript checks pass; scoped Biome and `git diff --check` pass.
Clone/split-ID fixtures verify the declared transport representation, not a
future worker/renderer implementation. No full suite, regional census,
benchmark, render or standalone deployment was run for P0.

### P1-ibara-feature-author

Dependencies: P0-contracts-and-frozen-sdf.

Dedicated Astra Ibara author adopts pass02b and extends its existing IbaraEnvironment, createIbaraField, compareThorns, createIbaraBatch and instantiateThorn interfaces. Supply surfaceAt from volcanic ground before thorns, weightAt from live hellscape weights, and lavaAt from actual fissure/caldera ownership. Keep canonical landmark/type priority, cellZ, cellX, cluster and instance order. Retain world-anchored 4 m coarse evaluation, 4.6 m + fillet rejection threshold, conservative capsule certificates and exact material identity. Separate cheap parameter enumeration from expensive spine construction so size filtering precedes geometry. Complete the full thorn mix, grounded debris and landmarks through this author-owned layer.

Owned paths:

- `packages/shared/src/features/ibara/types.ts`
- `packages/shared/src/features/ibara/cells.ts`
- `packages/shared/src/features/ibara/shape.ts`
- `packages/shared/src/features/ibara/sample.ts`
- `packages/shared/src/features/ibara/field.ts`
- `packages/shared/test/ibara.test.ts`

Acceptance:

- One existing cluster and arch reproduce accepted geometry before regional tuning; any changed form gets a source-bound A/B review.
- Cold/warm/evicted caches, reversed queries, overlapping prepared areas, negative coordinates and varying worker order produce identical samples and attributes.
- Full regional seed-1–3 curve census includes ordinary thorns, branches, debris, hooks and terrain-dependent arch landings; every instantiated sweep satisfies frozen guards.
- Preserve the exact seed-2 hooked-colossus regression, ID 25198721. Fix further failures through bounded exact curve partitioning or reviewed feature construction, never by relaxing SDF limits or silently dropping failures.
- Verify 192 m capped-Poisson clusters, size-aware spacing, all specified shape/material probabilities, approximately 40 landmarks per region and approximately 30% arches. Resolve small-post residuals without replacing the population with only large showcase thorns.

### P2-volcanic-terrain-author

Dependencies: P0-contracts-and-frozen-sdf.

Dedicated Astra terrain author provides buildIbaraPlan(basePlan, baseField), bounded spatial queries, volcanic density/material tags and lavaAt distance/outward direction. Reuse the inspected deterministic buildDrainage machinery on an Ibara-local routing domain; preserve existing global water/drainage arrays. Build 3–6 calderas, 300–900 m across with 40–120 m rims; 1.5–3 m wide, 2–10 m deep Worley fissures; 3–10 m sulphur vents; wind-aligned 2–4 m ash dunes; basalt plates and obsidian lowlands. Calderas feed jittered channels 4–20 m wide with levees and crusted edges. Each lava sample carries an explicit caldera/channel/fissure owner, bed and level; the segment index also serves thorn flow queries.

Owned paths:

- `packages/shared/src/worldplan/ibara.ts`
- `packages/shared/src/worldplan/lava.ts`
- `packages/shared/src/worldgen/main/ibara-ground.ts`
- `packages/shared/src/worldgen/main/ibara-volcanic.ts`
- `packages/shared/test/worldplan/ibara.test.ts`
- `packages/shared/test/worldplan/lava.test.ts`

Acceptance:

- Seeds 1–3 meet caldera counts/dimensions; channels connect to owners, terminate at explicit sinks and never rise downstream.
- Lava fills only owned negative-density cavities above their beds and below their levels; no global height fill, hanging sheets or exposed fluid walls at owner boundaries.
- Existing owned water, shore guards, Blackwater bridges and dry-region rules remain valid; Ibara introduces no water.
- Conservative bounds include excavation depth, rim/vent height, displacement and lava levels. Ground anchors and arch re-entry use the final volcanic surface.
- Spatial queries and composition use total-order ties and bounded work, with no neighbour-generation dependency or prohibited source reuse.

### P3-material-asset-author

Dependencies: P0-contracts-and-frozen-sdf.

Dedicated Astra material author owns registry and procedural recipes. Preserve IDs 0–31; reconcile only the tree's Bark dependency at 32, then assign Obsidian 33, EmberCrust 34, BrimstoneCrust 35, SulphurCrust 36, Lava 37 and VentMouth 38. Reuse Basalt 18 and Ash 29. Add default-zero emissive RGB nibbles, separate rendered emission strength, gloss and fluid-kind metadata. Shared ibaraMaterial consumes dominant feature identity/t: per-thorn core, t > 0.85 crust eligibility, correct broken/debris exclusions and grounded ash/scree. Rendering receives the information needed for warped 3–7 m strata in 2–3 tones.

Owned paths:

- `packages/shared/src/blocks/registry.ts`
- `packages/shared/src/blocks/textures/recipes.ts`
- `packages/shared/src/worldgen/main/ibara-material.ts`
- `packages/shared/test/assets/bark.test.ts`
- `packages/shared/test/ibara-material.test.ts`
- `packages/shared/test/textures-registry.test.ts`

Acceptance:

- Registry/recipe IDs agree; preserve all original 192 texture layers byte-for-byte. With 39 IDs and six layers each, the array is 234 layers, below the documented 256-layer floor.
- Root checks the narrow Bark patch against bark-dependency.json before integration; never replace the canonical registry wholesale with the isolated tree registry.
- Obsidian reads glossy/dark, basalt remains distinct, sulphur is yellow and ember crust is selectively emissive. No gameplay damage or tree/house placement is introduced.
- Emitter defaults do not change old block behaviour. All textures remain locally generated code assets.

### P4-main-world-integration

Dependencies: P1-ibara-feature-author, P2-volcanic-terrain-author, P3-material-asset-author.

Root alone stitches the packages into createMainField, sampleMainVoxel, createWorldContext and generateWorldChunk. Build volcanic plan data before final surface-dependent site evaluation; update plan schema/validation coherently. Evaluate volcanic ground, canonical additive features, explicit carvers, owned fluids, then materials. Keep water ownership intact and reset feature attributes on air, ordinary terrain and edits. Forward spacing into prepared areas. Extend conservativeBounds and skyInput with feature/carver bounds rather than treating column height as the whole solid surface. Add features to sourceFingerprints: sdf is already included, features currently is not.

Owned paths:

- `packages/shared/src/world/world-context.ts`
- `packages/shared/src/worldgen/main/surface.ts`
- `packages/shared/src/worldgen/main/features.ts`
- `packages/shared/src/worldgen/main/chunk.ts`
- `packages/shared/src/worldplan/build.ts`
- `packages/shared/src/worldplan/query.ts`
- `packages/shared/src/worldplan/index.ts`
- `packages/shared/src/worldgen/version.ts`
- `packages/client/src/engine/plan-validation.ts`
- `packages/tools/src/build/metadata.ts`
- `packages/shared/test/worldplan/context-adapter.test.ts`
- `packages/shared/test/ibara-world.test.ts`

Acceptance:

- Point queries, prepared-area queries, generated core/halo samples and worker neighbourhood queries agree on blocks, density, fluids, feature IDs and t.
- Test all six chunk boundaries, corners, negative coordinates, overlapping areas and feature crossings at spacings 1, 2, 4, 8, 16, 32 and 64; compare equal positions under equal sampling policy.
- WorldPlan cloning, persistence checksums and hydration include the new data, work with and without SharedArrayBuffer, and reject incompatible cached plans.
- Retain current main/test behaviour outside the declared Ibara changes, including owned-water regressions and safe travel.
- Set WORLDGEN_VERSION from 2 to 3 once when generation/registry changes actually integrate into the next PR; subsequent tuning updates goldens without additional bumps.

### P5-worker-mesh-and-light

Dependencies: P4-main-world-integration.

Astra runtime author extends existing machinery rather than replacing it. Keep packed light as sky at shift 12 and RGB at shifts 8/4/0; seed emitter nibbles in buildVolume and preserve them when writing top skylight. Update sources before relightEdits on placement/removal. Extend meshChunk with optional halo feature IDs and merge only equal feature identities as well as existing block/AO/light keys. Carry identity to MeshPart as two exact 16-bit halves, not one float32 ID. Preserve mesh part indices 0–3 and append a separate lava fluid draw at 4. Update transfers, byte accounting, edit invalidation and conservative streaming.

Owned paths:

- `packages/shared/src/meshing/greedy.ts`
- `packages/shared/src/lighting/flood.ts`
- `packages/shared/test/meshing.test.ts`
- `packages/shared/test/lighting.test.ts`
- `packages/client/src/engine/terrain-worker.ts`
- `packages/client/src/engine/worker-protocol.ts`
- `packages/client/src/engine/chunk-store.ts`
- `packages/tools/src/bench/lighting-input.ts`
- `packages/tools/test/bench/lighting-input.test.ts`
- `packages/tools/test/bootstrap/worker-session.test.ts`
- `packages/tools/test/bootstrap/chunk-store.test.ts`

Acceptance:

- Initial RGB solve and incremental edits agree with fresh solves, including multiple emitters, opaque emitters, removal, borders and neighbouring cached volumes.
- Keep 96-cubed light neighbourhoods, 64 m incoming-sky checks, two lit-volume caches, 96 column caches and the existing maximum-six-worker pool. Add measured limits/accounting for feature caches.
- Workers retain owned buffers; transferring results never detaches cached attributes or the owner's plan. Old-session/revision results remain rejected.
- Tall crowns, arch spans and caldera bottoms enter requested views without flooding the entire world-height band with empty chunks.
- Mesher tests prove no feature-ID interpolation/precision loss and no regression to existing AO, skirts or water draws. Benchmark light input includes the same real emission sources as the client.

### P6-rendering-and-effects

Dependencies: P4-main-world-integration.

Dedicated Astra rendering author consumes P0's frozen mesh/material contract while P5 implements it. Extend the existing MeshLambertMaterial/onBeforeCompile module and customProgramCacheKey. Decode RGB block light, implement gloss/strata and emission, preserve transparent water, and render lava through its separate opaque emissive fluid draw with slowly moving crust cracks. Reuse the existing HalfFloat composer, bloom and ACES chain. Expose setViewMode(normal|clay|features). Add bounded vent flames and rising embers driven by the existing display clock; block-light sources stay steady.

Owned paths:

- `packages/client/src/engine/terrain-material.ts`
- `packages/client/src/engine/renderer.ts`
- `packages/client/src/engine/ibara-effects.ts`
- `packages/tools/src/browser-tests/lighting.ts`
- `packages/tools/test/bootstrap/ibara-render-contract.test.ts`

Acceptance:

- Normal, neutral clay with sun/AO, and flat per-feature colour modes render the same geometry. Diagnostic modes cannot hide form failures behind textures or bloom.
- Only sources exceed the bloom threshold; ordinary sunlit terrain and UI do not bloom. RGB illumination remains visible on nearby non-emissive faces.
- Compile every material variant during loading; retain shadows, clipping, floating-origin math and the uncommitted prepareView offscreen warm-up/atomic transition fix.
- Display-clock motion pauses correctly. Open motion strips for lava/flame/glow; postcards freeze display time and suppress particles as docs/18 requires.
- Feature modes and effects do not change generated blocks, collision, light propagation or saves.

### P7-numeric-diagnostics

Dependencies: P4-main-world-integration.

Astra spatial-diagnostics author adds the currently absent terrain-report command and the currently rejected atlas features mode. Query the production shared context and feature enumeration, never recreate placement formulas in tools. Census the whole hellscape on seeds 1–3 for parameter statistics; label spatially sampled diagnostics with their sample domains. Report candidate/accepted/skipped counts, masks, nearest-neighbour differences, landmarks, calderas and lava topology. Add dense-Ibara benchmark cases without replacing the existing regional cases.

Owned paths:

- `packages/tools/src/terrain-report/index.ts`
- `packages/tools/src/terrain-report/ibara.ts`
- `packages/tools/test/terrain-report/ibara.test.ts`
- `packages/tools/src/terrain-review/source.ts`
- `packages/tools/src/atlas/config.ts`
- `packages/tools/src/atlas/render.ts`
- `packages/tools/src/atlas/plan.ts`
- `packages/tools/test/atlas/plan.test.ts`
- `packages/tools/src/bench/samples.ts`
- `packages/tools/src/bench/run.ts`
- `package.json`

Acceptance:

- Report pass bands explicitly: heights 12–30 m 75–88%; heights at least 60 m 3–7%; lean outliers 3–7%; S-curves 17–23%; hooks 7–13%; broken 9–15%; branched among eligible thorns 30–40%. State denominators and report landmarks separately rather than silently reclassifying failures.
- At least 95% differ from their nearest neighbour by at least 20% height, 8 degrees lean or 0.1h bend; every tip meets the thin-length limit.
- Report achieved thorn/dense-mask coverage against approximately 45%/20%, slope bins, Ibara walkable share target at least 15%, one-voxel spires and floating components per 100 chunks. Component checks must inspect boundary neighbours so clipped shapes are not counted as floating.
- Receipts bind seed, region domain, source hash, generation version, sample policy and rejected/capped instances; diagnostics fail honestly rather than substitute isolated-study numbers.
- Benchmarks measure generation, actual RGB lighting, meshing, cache memory and dense-feature p95 separately; run without concurrent rendering.

### P8-catalogue-postcards-and-final-proof

Dependencies: P5-worker-mesh-and-light, P6-rendering-and-effects, P7-numeric-diagnostics.

Root owns integration into the active game/UI/postcard files; Astra authors spatial camera work within this package. Add only tools.postcard, tools.view and view.normal/clay/features through existing catalogue strings/components. Extend PostcardId and parsePostcardIds, currently limited to TEST-1/P12 IDs and phases 1.1/1.2, with HELL-1/HELL-2 and phase 1.3. Wire ?view and the documented ?primitive=1 anchor through an explicit diagnostic generation identity shared with workers; primitive terrain must not share ordinary saves or cached meshes. Extend golden hashing to feature IDs/t and targeted Ibara cases while retaining all existing cases.

Owned paths:

- `packages/client/src/contracts/game-ui.ts`
- `packages/client/src/game/create-game.ts`
- `packages/client/src/game/postcard.ts`
- `packages/client/src/bootstrap/postcard.ts`
- `packages/client/src/bootstrap/telemetry.ts`
- `packages/client/src/main.tsx`
- `packages/client/src/ui/controller.ts`
- `packages/client/src/ui/screens/OwnerTools.tsx`
- `packages/client/src/ui/gallery/phase13.tsx`
- `packages/client/src/ui/gallery/registry.tsx`
- `packages/client/src/ui/phase.ts`
- `packages/tools/src/postcards/main-resolve.ts`
- `packages/tools/src/postcards/query.ts`
- `packages/tools/src/postcards/geometry.ts`
- `packages/tools/src/postcards/prepare.ts`
- `packages/tools/src/postcards/capture.ts`
- `packages/tools/src/browser-tests/run.ts`
- `packages/tools/src/browser-tests/phase13.ts`
- `packages/tools/test/postcards/postcards.test.ts`
- `packages/tools/src/golden/core.ts`
- `packages/tools/src/golden/fixture.ts`
- `packages/shared/test/golden/worldgen.json`
- `packages/tools/postcards/cameras/seed-1.json`
- `packages/tools/postcards/cameras/seed-2.json`
- `packages/tools/postcards/cameras/seed-3.json`
- `docs/progress.md`
- `docs/reports/phase-1-3.md`

Acceptance:

- Postcard selection shows its actual resolved view; Esc returns correctly. F4 remains usable during play. UI_PHASE becomes 1.3 only when all current rows exist; ui:lint -- --complete and opened gallery captures satisfy A7.
- Resolve approximately 50 feature-aware candidates per shot using actual density, not only current column-height cameraQuery.ground/height. Validate walkable eye at +1.62 m, near obstruction clearance, sky fraction, target visibility and dusk lighting.
- Ready covers the final camera's complete generated/lit/meshed/uploaded set; use LOD0 up to 512 m where needed. Retain session cancellation, context-loss failure, isolation checks and persistent-page capture.
- Blind reviewers receive only images, recipe and rubric. Primitive anchor must score at most 8 or discard that review. Score of record is min(author, blind). Each HELL-1/HELL-2 needs seed 1 at least 16/20, seeds 2/3 at least 14/20, R2=2 and no zero on R1–R4; neither shot receives the timebox exemption.
- Run npm test, npm run check, npm run build, clean-checkout build, browser main/test travel/edit/relight checks and three-engine golden verification. Regenerate goldens whenever integrated output changes; old test-world block/halo/density/column hashes remain unchanged.
- Final report records opened images, numeric distributions, failures, source identity and measured budgets. No phase completion claim before every required gate passes.

## Shared decisions

- All paths above are relative to D:/Dex/Projects/coldfront except explicit external evidence paths. Each path has one package owner. Root documents exact interfaces first and remains the sole integrator.
- Schedule: P0; then P1/P2/P3 as at most three disjoint writers; P4 root integration; then P5/P6/P7 as at most three disjoint writers using frozen contracts; finally P8. Root does not concurrently edit a writer's files. Serialize renders, benchmarks and full censuses.
- Use Astra for every spatial authoring/review task, including geometry, terrain, materials, shaders, camera selection and visual judgement. Keep dedicated asset authors responsible for their assets. No delegation was launched in this planning task.
- Preserve the five public SDF files for the separate tree dependency. Feature-level fixes belong in Ibara sources; changing the frozen SDF contract requires explicit cross-consumer review.
- Reserve feature ID 0 for no feature. Preserve existing Ibara packed IDs, which fit below 2^25, and allocate other feature families in separate upper-bit namespaces. Keep full Uint32 identities on CPU; transmit two 16-bit halves for GPU attributes.
- Retain Float64 density, columns, t and cached geometry; use deterministic hashes, Math.floor for signed cells and total-order ties. LOD evaluates the same functions with declared landmark/thicken/drop policies; phase 1.4's far renderer is not pulled into this phase.
- Keep existing waterQuery/basin ownership authoritative. Lava has a separate explicit owner; no generic fluid conversion may turn dry low terrain into water or lava.
- Reuse inspected local SDF, noise, drainage, lighting and meshing implementations with their notices. Public references remain visual/behavioural targets only; never inspect or copy prohibited mod code.
- Budgets remain measured phase-1.10 targets: generation median 12 ms/p95 40 ms, dense Ibara p95 60 ms, lighting median 3 ms, meshing median 4 ms, postcards 60 seconds, default tab memory 1.5 GB, draw calls 1,500 and triangles 4 million. Misses are reported; sampling correctness and HELL bars are not weakened.

## Visual sequence

- After phase 1.2 closure, reproduce the existing seed-1 cluster cell (1,0) and arch cell (0,0), index 0 through the production sampler/mesher. Compare clay and normal close/vista views against the accepted study without calling them region acceptance.
- Place that bounded cluster into real Ibara ground, then introduce a fissure/lava source and genuine flow direction. Inspect roots, tips, branch joins, edits and adjacent chunk crossings before expanding.
- Inspect a production caldera with rim, lake, channel/levees, sulphur vent, ash dunes and nearby thorns; include traversal and lighting evidence. Expand to regional populations only after bounds and ownership checks pass.
- Complete whole-region seed-1–3 distributions and curve census, then inspect representative clusters, gaps, size classes, hooks, breaks, arches and region boundaries in clay/features/normal modes.
- Render HELL-1/HELL-2 for all three seeds plus the primitive anchor. Open every graded image; run fresh blind Astra reviews and record the minimum scores. Review effects separately through motion strips.
- Run final numeric, golden, browser and benchmark gates; preserve best-so-far comparisons and unresolved issues in the report. HELL-3/HELL-4 far-distance acceptance remains phase 1.4.

## Risks and open implementation work

- Phase 1.2 is merged. Its renderer, chunk-store, game, bootstrap and postcard transition/capture fixes are present in the 9b212a4 source baseline; adopting files from the older 058775e study wholesale would overwrite them.
- The accepted study is not regional proof. Its review records small members reading as blunt posts, provisional materials, a regular gateway-like arch silhouette and planar root ledges. It proves no full three-seed coverage, chunk/halo seams, production LOD behaviour, traversal or HELL scores.
- The capped-hook repair only probes five landmark cells per seed on flat ground. Actual volcanic landing heights can expose further curve failures; dropping failed instances or increasing segment/error limits would invalidate acceptance.
- Current createIbaraBatch certifies exterior rejection but deliberately evaluates interiors exactly for identity/t. This is correctness-conscious, not proof that the narrow band meets dense-region budgets; measure before changing it.
- Current createIbaraField filters by size after cached cell instantiation. Large queries also have a 4,096-cell guard. Regional reports need tiled enumeration and LOD needs pre-instantiation parameter filtering, not removal of those bounds.
- WorldContext skyInput and conservativeBounds currently understand first-pass heights/trees, not caldera excavation or 350 m features. Missing updates can clip geometry, mis-seed light or cause excessive streaming.
- Existing worker code seeds sky only although flood.ts supports RGB; terrain-material.ts decodes sky only although surfaces carry packed light. Adding emissive registry fields alone would produce incomplete lighting.
- Ibara IDs exceed float32 exact-integer capacity. Passing IDs through the current Float32 surface tuple would corrupt feature colours and merge identity.
- sourceFingerprints includes sdf but omits features. Without the planned addition, feature tuning can reuse incompatible saves/WorldPlans/postcard identities.
- Bark dependency metadata was inspected, not its source patch. Root must reconcile its narrow changes against canonical IDs/textures before the material author appends IDs 33–38.
- Current golden hashes cover only blocks, haloBlocks, density and columns; current postcards do not accept phase 1.3; terrain-report has no script and atlas rejects features. These are actual implementation gaps, not completed tooling.
- Full-region spacing rejection, region masks, terrain-dependent arches and lava-driven lean can alter accepted population statistics. Study probabilities cannot substitute for measured accepted-instance distributions.
- The original planning pass performed no implementation or verification runs. P0 adds only the frozen SDF dependency, additive declarations and focused contract tests. Later package and phase acceptance remains outstanding.

## Coordinator acceptance notes

- Keep generation identity complete: new feature inputs must enter the source fingerprint before their generated output ships. The existing feature-directory omission is a required integration fix.
- Freeze and test the exact CPU/worker/GPU layouts before parallel worker and renderer changes. Feature IDs must remain exact; a successful material compile alone does not prove identity or light correctness.
- The existing Ibara, house and giant-tree studies remain separate accepted prototypes. Their images do not satisfy regional terrain, fluid ownership, LOD, traversal or gameplay gates.
- The owner has explicitly authorised continued implementation, merges and publication. M1 phases do not need another permission step; later milestone plans follow their own documented approval rule.
- The public-browser launch remains unavailable after the recorded approval-review rejection. Local gameplay and public artifact checks remain distinct until that action is newly authorised.
