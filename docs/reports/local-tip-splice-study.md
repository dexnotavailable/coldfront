# Localized thorn-tip study · 15 October 2026

**Published as `b8bac6af2bd6c0ad75bf3599bdc39a5f85eb259d` at [dex.place/coldfront](https://dex.place/coldfront/).** Local comparisons and the complete caldera pair favor the slimmer body, while the complete forest comparison is a tie for the fresh reviewer. This is a limited silhouette improvement, not a broader terrain-quality gain or completion of phase 1.3. The exact clean build, production journey, CI and public HTTP readback pass. The new-generation CPU benchmark remains pending.

![Caldera comparison: baseline left, selected right](../postcards/wip/ibara.jpg)

Top: complete same-camera caldera views. Bottom: the same fixed 640×360 crop at (352,80) from each original, without resizing. Root opened both source originals and this sheet; no scene content is edited. The 76,136-byte sheet keeps all work-in-progress images at 912,041 bytes, below the 1 MB limit.

## What the candidate changes

The existing absolute 1.5 m tip clamp lowers the radius exponent along the whole ordinary main shaft. That improves thin terminals but widens the body, a tradeoff recorded in the [published tip study](phase-1-3-tip-and-clearings.md).

The isolated candidate restores the proportional profile through radius-table station 231/256. Within the final 25 intervals, a monotone cubic splice joins that body to the published terminal stations bracketing the 1.5 m limit. The endpoint remains 0.45 m; no radius exceeds the published table. Construction fails explicitly if the fixed join is incompatible. Sampling gains no additional per-voxel work.

Placement, IDs, random draws, spines, branches, debris, rubble, other thorn families, noise, materials and rendering remain unchanged. Branch exposure and radius-dependent sampling can nevertheless change with the new main table. Terrain §8.5 and decision 120 now document the localized implementation while retaining decision 117's stronger tip outcome and every visual acceptance bar.

## Source and local evidence

The initial owned study is `D:/Dex/Temp/coldfront-local-tip-25df4e4`, based on `25df4e436f85cc8525be1fe45cef2a792af43db6`. Its pre-fix shape SHA256 is `eb351f6c1eedd77eb021bb7d0f68b9e91125d2e7a3021a70fd65641a68966f7b`. That executed study remains frozen. The repaired four-file source/test change described below is copied exactly into the canonical branch; the completed golden and release checks are recorded below.

- **100 tests across three files pass**, including forbidden tokens and the existing frozen family, branch, spine and 1,872-cell terminal-connectivity checks. Shared source/test types pass. A formatting failure is retained; its repair changes multiline layout and two trailing call-argument commas only.
- A separate fixed replay of 26 saved generation-676 short specimens makes 52 baseline/candidate constructions with zero environment queries. All complete instances match exactly. This is not universal parameter coverage.
- Four fixed normal-view main originals and eight fixed clay branch originals are opened by root and a fresh Astra reviewer. Both prefer B overall. The reviewer ties the two distant branch angles, slightly prefers B at 225°, and prefers B at 315°. The blunt stepped endpoint remains a visible limitation.
- Raw ordinary structural occupancy falls from 5,648 to 5,115 cells, with 533 removed and none added. Both sides have one component and no detached or boundary-touching cells. The two branch masks remain exact at 141 and 100 cells; their overlap with the main narrows but stays connected. The broken control retains all 1,754,148 flag bytes exactly.

The local main worker captures four images in 18.537 s with complete cleanup. Its supervisor **remains failed** because its initial runtime manifest incorrectly treated Chromium's writable `debug.log` as immutable. A separate audit checks 11,477 files and finds only that log changed; image, asset and raw-flag bindings pass. The exact failed log bytes and original receipts are retained. The later branch packet records only that exact diagnostic log separately, keeping all executable/resource checks. Its eight-image capture passes in 35.654 s (43.786 s including supervisor checks).

Private evidence: `out/local-tip-root/local-decision.json`, `out/local-tip-review/`, `out/local-tip-pixels/`, `out/local-tip/runs-v2/main/2026-10-15T09-22-11.349Z-800ed7de-5f2c-40bd-9f8f-23f038f0e327/` and `out/local-tip/runs-v3/branch/2026-10-15T09-30-39.471Z-7ca5a2eb-1338-4714-8378-59bf8eb79c3d/`, all beneath the owned study.

## Complete forest comparison

Both sides use the exact existing HELL-1 view050 eye, target, time 17.25, radius 512 m, FOV70, DPR1 and 1280×720 frame. Each passes one fresh 64×36 camera-validation grid. No alternate pose, selector search or old completed-search claim is used. The actual application, worker, chunk selection and renderer run with zero edits, frozen display time and no animation renders.

| Evidence | Baseline A | Candidate B |
|---|---:|---:|
| Requested / ready chunks | 1,306 / 1,306 | 1,306 / 1,306 |
| Readiness | 134.296 s | 134.694 s |
| Standard 180 s deadline | pass | pass |
| Application errors / external requests / bad responses | 0 / 0 / 0 | 0 / 0 / 0 |
| Retained ReadPixels warnings | 4 | 4 |
| Browser/context/server cleanup and camera preservation | pass | pass |

Root opens both originals and slightly prefers B's narrower central curved form. The fresh image-only reviewer opens both and records **a tie, with negligible overall difference**: local stepping on the dominant spire changes, but branch/tip readability, surrounding silhouette variety, foreground obstruction and depth remain essentially equivalent. No conspicuous B regression is seen. The dominant tip is cropped in both images, limiting terminal judgment.

These are single timing observations, not a stable performance comparison or a Radeon FPS result. The source-bound candidate generation is `4:576ddbad35a93ca8914f1c1c2de464557bcd7de7270fb489a07bbc9f691bcc9f`; it is not live.

The first forest supervisor attempt fails its 120 s source-hashing limit before starting a worker or sampling terrain. It remains unchanged. A fresh packet bounds independent file reads to eight readers, retaining every original hash, inventory check and deadline. Both camera preflights and captures then pass; no terrain or capture policy changes to address that I/O failure.

Private proof: `out/local-tip-forest-v2/runs/`, `out/local-tip-root/forest-pair-receipt-audit.json`, `out/local-tip-root/forest-opened-review.json` and `out/local-tip-forest-pixels/fresh-forest-ab-review.txt`. Baseline PNG SHA256 is `e310c969e74547930ec4bb678f8dae11b29f52e5afd4919114f30877664f62d4`; candidate is `437e4a8dc264255b972cb4cab771ed318f0fda2f8896573673b19b76083c4bc6`.

## Caldera check catches a production input failure

The exact shipped HELL-2 caldera-4 camera passes its baseline preflight in 14.421 s, with one fresh plan, one 64×36 grid and 208,496 voxel queries. The candidate reaches its first voxel query and throws while constructing ordinary owner **8761096**, decoded as cell (47,5), cluster 0, index 7. The failed join reports body radius `0.6889527523598971`, terminal anchor `0.7038966510569051` and interval count `-2`. The worker stops after 3.034 s; no browser or capture starts, and cleanup is confirmed.

This is a real candidate defect outside the earlier 26-specimen short-profile replay. A bounded extraction subsequently confirms its cause: the 14.503502740388427 m spine's baseline and pre-splice candidate tables are exactly equal, and the sampled radius at the 1.5 m boundary is exactly 0.7 m. The inverse crossing calculation returns `1.5000000000000002`, one floating-point step above 1.5, and incorrectly enters the splice. The extraction builds one baseline plan, requests one public parameter cell and makes three constructions of the unchanged real owner; original and instrumented candidate errors match. No voxel query or render is used.

The failing candidate, source seals and receipts remain frozen. A separate owned worktree implements a forward-interpolation guard and an exact-input regression test, without an epsilon, expanded support or changed shape parameters. Independent Astra source review passes. All **101 focused tests**, shared source/test types and formatting pass; the test preserves the saved whole baseline geometry exactly. The repair's shape SHA256 is `ab5776dd9429e7a670a1972d41364df40173c7752e90d252f59dcd77884bdd05` in `D:/Dex/Temp/coldfront-local-tip-short-25df4e4`.

Private failure: `out/local-tip-caldera/runs/after/preflight/2026-10-15T10-29-57.668Z-d6ae58d4-45f0-4857-87f0-e7760d5b5098/`. Baseline preflight: `out/local-tip-caldera/runs/before/preflight/2026-10-15T10-28-46.682Z-288529be-8054-48da-9725-1e27aa5e6314/`. Exact witness: `out/local-tip-short-witness/runs/before/witness/2026-10-15T10-38-22.398Z-9eaf9dfe-347a-40e6-bfe6-a519d7a0ba24/`, with full plan, parameters, tables, floating-point bits and observed environment calls retained. Worker 2.726 s / complete supervisor 6.450 s; source and cleanup checks pass.

The repaired source also passes the unchanged complete terrain report for seeds 1–3 in **137.567 s**: 80,056 instances and 177,892 curve sweeps, with no construction or capped-sweep failures. Independent saved-data review verifies source/harness hashes, sidecar identities and counts, available parameter summaries and all **79,943 nearest-neighbour pairs** with a separate algorithm. These receipts retain the tool's proportional tip allowance `max(1.5, 0.04 × length)` and 12 sampled ground patches per seed; they are not a separate all-ordinary-main 1.5 m census or full-world visual proof. New-tree evidence is under `out/short-tip-root/complete-reports/` and `out/short-tip-review/saved-report-audit.md`.

Both fresh source-bound caldera camera checks pass at the unchanged shipped pose. Baseline: 14.954 s total, 208,496 queries. Repaired candidate: 16.159 s total, 210,300 queries. Each uses one fresh plan and one 64×36 grid, with source and cleanup checks passing. The repaired, unpublished generation is `4:d3b3ba428e1cb77cf60526dadf2f85a01d2cd6c3837e35a5b5dd140c4b8ce9ee`; earlier local/forest images remain explicitly tied to the preceding candidate source.

Both complete caldera captures contain all **1,624 requested chunks**. Baseline readiness is **232.897 s**, candidate **242.677 s**. Both retain the original 180 s failure, timeout artifact and exit 1, while completing within the 300 s diagnostic limit. Both have zero application errors, external requests and bad responses, four retained ReadPixels warnings, unchanged stored cameras, matching source seals and complete cleanup. These single timings establish no stable performance comparison or FPS improvement.

Root opens both originals and prefers B modestly. A fresh image-only Astra reviewer independently prefers B modestly: the central spire tapers more cleanly and exposes slightly more background and lava, while the left branch still appears attached. The square branch tip, stepped upper needle, thick lower transition and substantial foreground obstruction remain. No numerical connectivity or other-angle claim is inferred from these pixels. This supports a limited incremental release, not a formal score or phase acceptance.

New-tree originals: `out/short-tip-caldera/runs/before/capture/2026-10-15T10-53-45.451Z-171c429a-4768-4414-9509-77e74f308b6c/HELL-2-shipped-before.png` (SHA256 `afa385ca3b66ef17ec1a068180606d9dac5e4e71ac34df6b47dd14de590219ea`) and `out/short-tip-caldera/runs/after/capture/2026-10-15T10-59-22.468Z-3b94477b-a197-425f-8f8b-7cd3ba94d76b/HELL-2-shipped-after.png` (SHA256 `768ca3d45df8c119815e811706ae6db666449a224007e8edcd404d542df39505`). Independent review: `out/short-tip-caldera-pixels/verdict.md`; root binding audit: `out/short-tip-root/caldera-pair-receipt-audit.json`. Canonical promotion receipt: `out/phase13/local-tip-splice-integration/promotion.json`.

## Canonical release checks completed so far

The four selected source/test files are copied exactly from the repair worktree. Golden regeneration completes in 46.106 s: all 342 sample addresses and their order stay fixed, all 150 TEST records are exact, and 25 MAIN Ibara records change. Generation version remains 4; compatibility follows the new content hash.

The full suite passes **854 tests in 101 files** (272.87 s raw, 275.971 s wrapper). After camera and HUD evidence promotion, 30 focused tests pass; `npm run check` passes in 27.523 s, complete UI lint in 5.585 s and the production build in 6.851 s. UI lint reports 106 gallery states, zero current rows missing and 23 binding rows. Separate exact-commit clean installation/default build passes in 9.772 s, and the site build in 1.995 s.

All 18 installed production destinations keep their exact poses and stable metadata. One fresh plan supplies 16 P12 grids and a new HELL-1 grid; HELL-2 reuses its genuine repaired-source validation with 78 matching dependencies. All runtime validations pass in 21.149 s. Old derived scores/search claims are removed. Formatting preserves parsed JSON exactly; the installed catalogue SHA256 is `0eb292f65d2325984c7694286498d2cbe91e46d9c3a07f8301c3ba075f697d39`. TEST and the historical primitive subtree remain unchanged; the latter is not claimed as current calibration evidence.

The fresh HUD run completes in 11.317 s with 94 source bindings per case and zero application errors. Root and independent Astra open both PNGs and JPEG derivatives. The target outline, faint placement ghost and blue occluded-unit silhouette are visible, with no on-screen words. Applicable A7 canvas checks pass; this does not claim a whole-gallery, three-size or keyboard sweep. Six formatted public evidence files are promoted, with seven native files preserved under `out/engine/hud-local-tip-splice-2026-10-15T11-25-00-803Z-03488b/`.

The regions atlas and default SW–NE slice tools both succeed (5.233 / 12.650 s), producing six fresh PNGs. Their wrapper then fails because it reads annotated sampling at the wrong JSON level. That failure is retained. Separate root and independent audits verify all 73 source pins, six image/receipt hashes and dimensions, and exact parent sampling under each annotated receipt's `sampling.data`. Both reviewers open all six. The images show region footprints, surface/water profiles and planned underground tints on solid rock; they do not establish caves or localized tip quality.

Canonical evidence: `out/phase13/local-tip-splice-integration/`, including `golden-diff.json`, `final-gates-20261015-184244/result.json`, `hud-promotion.json`, `camera-promotion.json`, `atlas-slice-supplemental-audit.json` and the three independent review reports under `independent-review/`. Original failed runs and pre-execution junction-review snapshots remain intact.

## What remains

The selected source is live. Complete the new-generation CPU benchmark. Preserve both caldera timing failures. No further forest camera or parameter sweep is selected.

There is no new formal rubric score. The unchanged mandatory HELL bars, primitive-control calibration and seed-1–3 visual acceptance remain open. The completed checks above support this limited increment; they do not close those phase requirements. The previous generation-676 benchmark is historical and does not measure this new live source.

## Verified publication

[PR #17](https://github.com/dexnotavailable/coldfront/pull/17) publishes the exact tested source. [CI 38731183515](https://github.com/dexnotavailable/coldfront/actions/runs/38731183515) passes, including golden hashes in Chromium, Firefox and WebKit. The physical clean checkout is `D:/Dex/Temp/coldfront-clean-phase13-b8bac6a`.

The fourteen-stage local production journey passes in **292.346 s**. Root and independent Astra open all fourteen originals. Placement, immediate quit/play and reload persistence, breaking, walking, Ibara view modes, HELL-1 travel, Escape and continued flying after an injected malformed catalogue pass. There are zero application errors, external requests or bad responses; four ReadPixels warnings remain. Browser and server cleanup pass. Independent hashing verifies 191 source files in both canonical and execution checkouts, all 326 distribution files, 53 evidence bindings and all fourteen images. This is bounded local acceptance, not a fresh all-region tour or formal HELL grade.

The Tools screenshot shows only the catalogue labels: Tools, Go to region, Ibara, Time of day, 12.0 h, Clock runs, View, Normal, Clay, Features, Fog, Shadows, Chunk borders, Wireframe, Fly, Fly speed, ×1, Postcard mode, Interface gallery and Clear my edits. Spacing and clipping checks pass at 1280×720. The malformed-catalogue case correctly omits Go to postcard. This adds no whole-gallery or multiple-size claim beyond the separate HUD checks above.

Publication receipt `cfc1cccf-871c-40aa-9fc4-0b45fbb6bd5d` names release `D:/Dex/GameDev/Deploy/COLDFRONT/releases/b8bac6af2bd6-32ff8eb5602e798ea51f`. At **2026-10-15 12:27:23 UTC**, public HTTP readback matches all eleven selected entry/version/catalogue/JavaScript/CSS/font hashes and isolation headers. Public-browser play remains separately unavailable. Generation identity is now `4:d3b3ba428e1cb77cf60526dadf2f85a01d2cd6c3837e35a5b5dd140c4b8ce9ee`; older edits stay stored separately.

Private release evidence is under `out/phase13/local-tip-release/`: `runs/2026-10-15T12-11-45.206Z/receipt.json`, its fourteen PNGs, `root-image-review.json`, `independent-review/acceptance.md`, `independent-review/integrity.json`, `root-ci.json` and `public-readback.json`. Earlier failed runs and executed seals remain unchanged.
