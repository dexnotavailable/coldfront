# Terrain-worker memory reduction

The candidate removes an unused copy of a terrain worker's lighting-volume blocks. The worker wrote this array but never read it: lighting uses opacity and source arrays, meshing uses the chunk halo, and returned blocks come from the chunk itself. Removing the copy also removes its edit write and corrects the reported cache byte count.

Each fresh volume avoids **1,769,472 allocated bytes and 884,736 writes**. At the existing two-volume cache capacity, retained typed-array data falls by **3,538,944 bytes (3.375 MiB) per worker**. Cache capacity, request scheduling, terrain generation, lighting, meshes and saved edits stay unchanged. Generation/save identity remains `4:676c1dee2fe6e97007d306b08f8efeb1381c9d9510f701f4558f22721f2116cb`.

## Output and memory checks

The three focused existing worker suites pass **9 tests in 59.42 s**. A separate production-worker comparison runs baseline/candidate then candidate/baseline, serially, across 32 requests. Each arm covers fresh chunks, a cache hit, an emissive edit, persisted-edit reload and cache eviction/rebuild.

All 16 corresponding responses match in stable fields and **704 typed-array byte comparisons**, including blocks, light, all mesh parts and skirts. Another 528 saved buffer comparisons confirm cache/reload consistency within each arm. Memory counters fall by exactly one or two discarded arrays as cache occupancy changes. All transferred buffers detach, all four helper threads terminate after returning their results, and the 134 source files per root differ only in the intended worker at capture time. The run completes in **22.927 s**.

This establishes an allocation and retained-memory reduction, not a speedup. Summed generation-stage time is 2189.673 → 2226.898 ms in the first order and 2166.090 → 2234.977 ms in the reverse order. Summed measured worker stages are also slightly slower, by 0.71% and 3.73%. This small diagnostic does not establish a stable timing regression or gain, dense-Ibara performance, Radeon FPS or process-wide memory consumption.

## Fresh visual evidence and release status

The worker change invalidates the HUD evidence's source bindings. Both actual TEST-world cases are recaptured through the existing driver: outline/placement ghost and hidden-avatar silhouette. Root opens both native PNGs and both shipping JPEGs. Capture takes **14.266 s**, with 148 loaded chunks and no queued work in each case, zero application errors and four recorded ReadPixels warnings. The ghost changes 2,440 pixels within its projected bounds. No UI words or controls change.

All **811 tests / 94 files** pass in 267.16 s (267.643 s wrapper); check and build pass in **19.777 / 2.602 s**. Independent source/parity and scoped HUD reviews pass with no blockers. UI lint reports 106 gallery states, zero current rows missing and 23 binding rows; the existing 79 warnings and two informational diagnostics remain. Fresh HUD bindings cover 88 sources and eight per-case artifacts. After copying the original PNGs into a new evidence directory, only their two provenance paths change; a deep comparison and repeat UI lint pass. Historical release images remain untouched.

**Published as `d9686d3ece98d374261f748d07153c7afed9af2c`.** Its exact own-dependency clean install/build passes in 10.972 s and site build in 2.088 s. [CI 38506195936](https://github.com/dexnotavailable/coldfront/actions/runs/38506195936) passes, including all three browser goldens. The fresh fourteen-stage production journey passes in 280.879 s; root and fresh independent Astra open all fourteen originals and the separate HUD images. All 180 source and 326 distribution files match, with zero application errors, external requests or bad responses, four retained ReadPixels warnings and browser/server cleanup.

Publication receipt `76110b74-8476-4d2e-a2a1-b4af708e13f2` records the promoted entry and metadata. Eleven public file/hash/header checks pass at **2026-10-14 03:48:57.680 UTC**. [PR #9](https://github.com/dexnotavailable/coldfront/pull/9) merges at 03:50:13 UTC as `55716fd9cb8d65840f2fdb53d04689ece00fbcc8`. The playable site is [dex.place/coldfront](https://dex.place/coldfront/). Public-browser gameplay remains separately unavailable under the earlier refusal.

Generation-676 atlas, slices, terrain reports and the full generator/lighting/meshing benchmark remain applicable to the unchanged shared generator; this small worker comparison does not replace that benchmark. Phase 1.3's visual acceptance remains open.

## Evidence

Candidate: `D:/Dex/Temp/coldfront-worker-mirror-5d4a4f9`. Baseline: pristine `D:/Dex/Temp/coldfront-clean-phase13-5d4a4f9`.

- `out/worker-mirror/preimages.json` and original source copies.
- `out/worker-mirror/focused-tests.log`.
- `out/worker-mirror/runs/2026-10-14T03-07-36.927Z-eb810527/`: parity, memory deltas, timings, source manifests and cleanup.
- `out/phase13/visual-integration/hud-2026-10-14T03-10-25-632Z/`: fresh HUD source snapshot and capture result.
- `out/worker-mirror/full-checks/2026-10-14T03-13-48Z/`: passing full validation.
- `out/worker-mirror/independent-source-review.md` and `independent-hud-review.md`, with matching JSON records.
- `out/worker-mirror/hud-relocation.json` and `integration.json`: exact native-image copies and eight-file source/evidence promotion.
- Canonical `out/engine/hud-worker-mirror-2026-10-14T03-10-25-632Z/`: preserved new native images and receipts.
- Canonical `out/phase13/worker-mirror-release/`: sealed exact-build inputs, `runs/2026-10-14T03-38-55.062Z/`, independent review, root review and actual public readback.
