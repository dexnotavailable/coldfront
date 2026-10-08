# Generation, lighting and meshing benchmark

This is a **Node shared-kernel benchmark**, not a browser FPS measurement or a timing of client worker caches/transfers/uploads. It executes the actual main/test context, skylight flood solver and greedy mesher. Each output is consumed and checked for solid/open surface coverage, a nonempty mesh and physically valid light evidence; timings come from `performance.now()` around the actual calls. A dark submerged halo is accepted only when every open sample is water with enough additional filtering water above to extinguish level-15 sunlight. It is never given artificial skylight.

Run from the repository root:

```text
npm run bench:gen
npm run bench:gen -- --seed 2 --region hellscape,blackwater --warmup 5 --repetitions 3
npm run bench:gen -- --world test
```

The default is main world, all sixteen surface regions, seed 1, five discarded warmup pipelines plus five discarded LOD1 generations, then three passes over **50 unique LOD0 surface chunks and 20 unique LOD1 chunks per region**. That is 800/320 distinct cases and 2,400/960 measured calls. `--region` restricts main regions by stable ID; `--world test` preserves the original 50/20 sandbox addresses. Warmup cannot be disabled. Main samples use a fixed permuted lattice near actual region anchors and must remain in the requested region with a solid/open centre-column interface. Every measured pass uses fresh buffers and a fresh light volume, so cache hits cannot turn the lighting result into a no-op.

## Stage definitions

| Metric | Measured work |
|---|---|
| Cold WorldPlan | First main plan build in a fresh process; context hydration and sample selection are timed separately |
| LOD0 generation | `generateWorldChunk`, including 32³ core, 34×41×34 halo and context-layout Float64 columns |
| Neighbourhood preparation | Actual pointwise blocks/opacity and column-height/feature-band sky sources for a 96³ volume spanning 3×3×3 LOD0 chunks |
| LOD0 lighting | `solveLight` over that real neighbourhood, with the accepted downward-sunlight and filtering rules |
| Halo light extraction | Copying the central 34×41×34 solved halo for the mesher |
| LOD0 meshing | `meshChunk` with real generated blocks and solved light, including its allocations, AO, draw classes and skirts |
| Pipeline total | All five sequential stages above |
| LOD1 generation | Two-metre pointwise voxel generation; no BFS and no claim of later column-tile generation |

The preparation adapter uses the actual context's prepared-area sampler and sky bounds, with no edits or hidden client cache. A focused test compares every central halo opacity value to the generator, then proves exposed sky is lit, solid ground stays dark, and extracted indices agree. A separate dark-water guard requires physical filtering evidence. Preparation is shown separately: **do not add this benchmark's single-chunk generation timing to its lighting/mesh numbers and call that the client worker's end-to-end cost**. The pipeline total includes preparation; the client worker's preparation/caching strategy is different.

Raw per-case/per-repetition rows, exact counts, mesh bytes, lit sample counts, source and harness hashes, sample-set hash, Node/V8 version, CPU model/count, OS, architecture, memory and start time are written to `out/step4/bench-gen.json`. In-progress and failed reports preserve partial measurements rather than inventing missing results.

Median averages the two middle observations when N is even. p95 uses nearest rank `ceil(0.95*N)-1`. Reported values remain unrounded in JSON. The console rounds display only. Budgets are informational until phase 1.10: LOD0 generation median 12ms/p95 40ms, lighting median 3ms, meshing median 4ms. A miss is labelled `over-target` and does not fail the command. No tile budget is applied to LOD1 voxels.

Not measured here: detailed Ibara thorns and other later region features, LOD2–6 full-height tiles, relighting edits, worker/cache/transfer/upload cost, rendering or FPS. These are explicit unavailable entries, not zero-valued timings. Current main-region cases measure first-pass phase 1.2 terrain.

Run in the background with captured logs and reserve the exclusive sampling/render lane. External process activity cannot be certified by this benchmark; the report says so. Do not run it alongside browsers, renderers, atlas/slice generation or another benchmark.
