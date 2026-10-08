# Generation, lighting and meshing benchmark

This is a **Node shared-kernel benchmark**, not a browser FPS measurement or a timing of client worker caches/transfers/uploads. It executes the accepted generator, actual skylight flood solver and accepted greedy mesher. Each output is consumed and checked for both solid/air surface coverage, a nonempty mesh and real lit samples; timings come from `performance.now()` around the actual calls.

Root integration adds `npm run bench:gen`. Before integration:

```text
node --import tsx packages/tools/src/bench/run.ts
node --import tsx packages/tools/src/bench/run.ts --seed 2 --warmup 5 --repetitions 3
```

The default is seed 1, five discarded warmup pipelines plus five discarded LOD1 generations, then three passes over **50 unique LOD0 surface chunks** and **20 unique LOD1 chunks**. The report therefore contains 150 measured LOD0 pipelines and 60 LOD1 generation samples. Warmup cannot be disabled. XZ sample positions are fixed and versioned, covering the pond/origin/trees, negative coordinates and broader rolling relief; cy places the current centre-column surface inside each chunk. Every measured pass uses freshly generated buffers and a fresh light volume, so cache hits cannot turn the lighting result into a no-op.

## Stage definitions

| Metric | Measured work |
|---|---|
| LOD0 generation | `generateTestChunk`, including 32³ core, 34×41×34 halo and Float64 columns |
| Neighbourhood preparation | Actual pointwise blocks/opacity and column-height/feature-band sky sources for a 96³ volume spanning 3×3×3 LOD0 chunks |
| LOD0 lighting | `solveLight` over that real neighbourhood, with the accepted downward-sunlight and filtering rules |
| Halo light extraction | Copying the central 34×41×34 solved halo for the mesher |
| LOD0 meshing | `meshChunk` with real generated blocks and solved light, including its allocations, AO, draw classes and skirts |
| Pipeline total | All five sequential stages above |
| LOD1 generation | Two-metre pointwise voxel generation; no BFS and no claim of later column-tile generation |

The independent preparation adapter has no edits or hidden client cache. Its sources follow the accepted surface/feature-band rule and 64m blocker limit. A focused test compares every central halo opacity value to the actual generator, then proves exposed sky is lit, solid ground stays dark, and extracted indices agree. Preparation is shown separately: **do not add this benchmark's single-chunk generation timing to its lighting/mesh numbers and call that the client worker's end-to-end cost**. The pipeline total includes preparation; the client worker's preparation/caching strategy is different.

Raw per-case/per-repetition rows, exact counts, mesh bytes, lit sample counts, source and harness hashes, sample-set hash, Node/V8 version, CPU model/count, OS, architecture, memory and start time are written to `out/step4/bench-gen.json`. In-progress and failed reports preserve partial measurements rather than inventing missing results.

Median averages the two middle observations when N is even. p95 uses nearest rank `ceil(0.95*N)-1`. Reported values remain unrounded in JSON. The console rounds display only. Budgets are informational until phase 1.10: LOD0 generation median 12ms/p95 40ms, lighting median 3ms, meshing median 4ms. A miss is labelled `over-target` and does not fail the command. No tile budget is applied to LOD1 voxels.

Not measured yet: WorldPlan build, actual region/Ibara feature-dense cases, LOD2–6 full-height tiles, relighting edits, worker/cache/transfer/upload cost, rendering or FPS. These are explicit unavailable entries, not zero-valued timings. The test world is the only implemented region in this phase.

Run in the background with captured logs and reserve the exclusive sampling/render lane. External process activity cannot be certified by this benchmark; the report says so. Do not run it alongside browsers, renderers, atlas/slice generation or another benchmark.
