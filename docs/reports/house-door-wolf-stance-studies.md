# House door and frost-wolf stance studies

Both changes passed their bounded prototype checks under the then-current `a82f5dd` renderer. They remain outside the live world; the later house-library adoption is recorded below.

## House door

One rigid plank leaf fits the existing house doorway and swings outward through 90 degrees. The original shell, voxel doorway and approach are unchanged. Root and a fresh Astra reviewer opened `close-closed.png` and `close-open.png`: the closed leaf fits the visible aperture, and the open pose exposes the central entrance without obvious clipping or a texture/lighting regression. The porch hides part of the leaf in this view.

The initial 61 tests pass, including the original house and forbidden-token checks and five new door checks. Those five pass again after updating the texture assertions for the current TypeScript API. Tools type checks and scoped formatting pass. The capture exits zero; all twelve source bindings and both image hashes match, with zero errors, four ReadPixels warnings and recorded browser/server closure after awaited cleanup.

This proves two static poses. Interaction, collision registration, enclosure, heating and placement in generated settlements remain unimplemented.

Source and evidence: `D:/Dex/Temp/coldfront-house-door-a82f5dd`. Checks are under `out/house-door/checks/2026-10-13T21-20-28.997Z/`. Images, receipt and fresh review are in `out/house-door/pass-01/`, with the review under `independent-review/`. Earlier API/type and format failures are preserved, as are the pre-repair source packets.

## House library adoption, 14 October 2026

The unchanged revision-4 house, its door presentation helper and nine existing tests enter the [unregistered asset library](../assets/README.md). The 498-voxel shell, doorway, approach and pending functional-part anchors are preserved. The helper provides visible door poses; it adds no gameplay collision or enclosure.

The accepted receipt binds the current model, door and capture-helper hashes; test hashes are verified separately. Four hashes in the older handoff predate final formatting; that handoff remains preserved. The fresh copy verifies all eight study source/helper/test files before execution. Only the four model/helper/test files are proposed for canonical adoption; the historical study README and capture harness stay isolated.

At `a115d6d`, all nine focused tests, four TypeScript checks and formatting pass. Two fresh current-renderer captures complete in **3.841 s**. Root opens `close-closed.png` and `close-open.png`; both are byte-identical to the accepted originals. The closed plank leaf fits the visible doorway beneath the porch, and the open leaf sits alongside the dark entry. Porch shade and the small door size limit fine contact assessment. These remain static poses, not interaction or continuous-motion proof.

All twelve current source bindings match, with no drift, application errors, external requests, GL errors or context loss. Four ReadPixels warnings are retained. The receipt is written after awaited browser/server closure; a separate process check belongs to root. The source and new evidence are at `D:/Dex/Temp/coldfront-house-library-a115d6d`, with captures under `out/house-door/adoption-current-01/` and checks/reviews under `out/house-library/`. Old study roots and failures are untouched.

Generation/save identity remains 676; the broader build hash includes the new library files. The live game, terrain scores, atlas/slice and benchmark remain unchanged. House placement, construction/support, functional hearth and door, enclosure, heating, furnishings, interaction/collision and navigation remain future work.

The two existing HUD cases are refreshed in **15.917 s** with 93 source bindings per case. Root and Astra open both PNG originals and both shipping JPEGs. Independent review verifies all 186 source bindings, eight artifact bindings and the placement-ghost difference of 2,440 pixels / 113,933 total RGB difference. The native/public metadata is identical after parsing; formatting adds only a final newline to the three public JSON files. No source or image changes follow. The faint ghost and pale blue covered-avatar silhouette remain visible; the latter reflects this captured animation pose, without a claim of pixel equality to an earlier HUD run.

Bounded A7 review passes the three existing canvas marks at 1280×720: no words appear, marks align with their intended positions, and panel/disabled-control/blocking-screen keyboard checks are inapplicable. No new screen or other-resolution review is claimed.

The full integration suite passes **837 tests across 99 files** in **284.89 s** (285.482 s wrapper). Check and build pass in **17.943/3.015 s**. The study includes the four isolated capture helpers but no extra tests; those helpers are excluded from canonical adoption. No new WIP image is committed, leaving the existing 939,899-byte image budget unchanged. Exact-commit clean-build and CI receipts remain separate release checks.

## Frost wolf

The existing leg-angle solve now uses the underside-centre reference at `12q`, matching the unchanged measurement point, instead of the old `11q` paw-centre reference. Model geometry, materials, pivots, stride and gait timing are unchanged. All ten tests pass, including three new trajectory/contact/join regressions; tools type checks and scoped formatting pass.

Two sequential captures use the same nine walk samples from 0–1,000 ms at 125 ms intervals, on flat ground at 0.75 m/s. The verified module hook serves the exact old and new model bytes without swapping source files. Measured horizontal underside-centre drift falls from **8.768 mm between samples / 34.128 mm across a stance span** to **0 / 0 mm**. Both captures have zero application errors and source drift, one observed model load and recorded successful cleanup.

Root opened both strips and three native candidate frames. A fresh Astra reviewer opened all eighteen native frames and both strips, recomputed the drift from saved frame data, and found no obvious new shape, material or contact regression. This is a sampled appearance and horizontal-reference result: the rigid paw still rocks vertically, with **47.11 mm** of sole-centre height variation in one candidate stance run. Individual toe/heel contact corners, terrain adaptation and full playback are not proven.

Source and evidence: `D:/Dex/Temp/coldfront-wolf-stance-a82f5dd`. Checks: `out/wolf-stance/checks/2026-10-13T21-19-01.121Z/`. Paired images and receipts: `out/wolf-stance/capture-prep/baseline-11q-pass-01/` and `candidate-12q-pass-01/`; fresh review: `out/wolf-stance/capture-prep/independent-review.md` and JSON. Earlier type/format failures and pre-repair packets remain preserved. The original studies were not edited.
