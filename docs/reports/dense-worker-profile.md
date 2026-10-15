# Dense terrain worker profile

The compiled worker identifies generation as the dominant work in the fixed dense request. One profiled request takes 5,836.274 ms: generation 5,780.539 ms, lighting 25.024 ms, meshing 29.139 ms. Generation includes preparation of the lighting neighbourhood, not only the central chunk. These are native Node measurements of the actual browser bundle, not browser frame rates or a controlled speedup comparison.

The request is seed 1, chunk `(312,1,0)`, from live `b8bac6a`, generation `d3b3ba4…`. It produces 17,486 solid and 15,282 open cells, with 1,008 vertices carrying feature 8434708. All 44 output buffers match the earlier source-worker observation in element type, byte length and hash. There is one plan, one empty initialization and one request, without warmups, edits or a replacement address.

## Why the compiled measurement was needed

The preceding source-worker profile contained 10,172 samples. Naming-related leaf frames accounted for 4,506 (44.30%). The installed TypeScript loader preserves function names and adds these wrappers; the shipped terrain-worker bundle has no such wrappers. That share cannot be treated as a production cost or a promised saving. Optimizing only the source-loader path would give misleading evidence about the game.

The compiled child runs with an empty `execArgv`, imports the exact shipped JavaScript and no source modules, and receives the plan as data. Its capture contains 3,918 samples over 5,857.043 ms, with 3,838 leaf samples attributed to the bundle. Reported positions are actual minified bundle positions; they are not original TypeScript source locations. Sample counts are not exact call costs, and inclusive counts overlap.

The first compiled launcher failed before parent startup: Node's Windows `--import` argument required a `file:` URL. That failed packet remains untouched. A separate v2 packet changes the argument and matching parent check; it completes successfully. Inspector stop/disconnect, the exact child exit and outer process exit all complete, with no timeout or cleanup error.

## Evidence and next action

- Source capture and interpretation: `out/phase13/dense-worker-profile/runs/2026-10-15T14-10-04.232Z-04d6bf94/` and `independent-result-review/review.md`.
- Preserved failed launch: `out/phase13/dense-bundle-profile/launches/2026-10-15T15-12-12.117Z-27685d82/`.
- Compiled capture: `out/phase13/dense-bundle-profile-v2/runs/2026-10-15T15-24-33.000Z-b93d4b1a/`, including `receipt.json`, `worker-receipt.json`, `samples.json` and `dense-a-bundle.cpuprofile`.
- Compiled profile SHA256: `7f72f1a0d236afbe6f6f5764a6f36e0af6d95b0eb26cededfa5308243d6e42bb`.
- Shipped bundle SHA256: `dc0cefb2931b85caadce509bff9a6dea990555ad7891848bc2568106e937b994`.

The independent interpretation matches the actual code: `s` at bundle column 59704 is batch evaluation (825 self samples, 21.06%); `en` at 54062 is thorn-sweep sampling (561, 14.32%); `dt` at 32819 is frame interpolation (226, 5.77%). It also independently reproduces the leading raw sample counts, verifies all 44 buffers and confirms successful cleanup. Its report is `out/phase13/dense-bundle-profile-v2/independent-result-review/review.md`.

The selected isolated candidate stores one last coarse-cell result per thorn. Consecutive vertical voxel centres often share the same rounded four-metre cell; an exact numeric match can avoid rebuilding a string key and looking it up in the existing Map. The Map, its eviction rules, exact geometry calculations and sample order stay unchanged. Hit rate and benefit remain unmeasured. Promotion requires exact output checks and a compiled-worker comparison; no optimization is integrated yet. The earlier column-filter experiment remains rejected; this profile does not reopen it. The friend's Radeon stutter remains unconfirmed.
