# House door and frost-wolf stance studies

Both changes pass their bounded prototype checks under the current `a82f5dd` renderer. They remain isolated assets outside the live world.

## House door

One rigid plank leaf fits the existing house doorway and swings outward through 90 degrees. The original shell, voxel doorway and approach are unchanged. Root and a fresh Astra reviewer opened `close-closed.png` and `close-open.png`: the closed leaf fits the visible aperture, and the open pose exposes the central entrance without obvious clipping or a texture/lighting regression. The porch hides part of the leaf in this view.

The initial 61 tests pass, including the original house and forbidden-token checks and five new door checks. Those five pass again after updating the texture assertions for the current TypeScript API. Tools type checks and scoped formatting pass. The capture exits zero; all twelve source bindings and both image hashes match, with zero errors, four ReadPixels warnings and recorded browser/server closure after awaited cleanup.

This proves two static poses. Interaction, collision registration, enclosure, heating and placement in generated settlements remain unimplemented.

Source and evidence: `D:/Dex/Temp/coldfront-house-door-a82f5dd`. Checks are under `out/house-door/checks/2026-10-13T21-20-28.997Z/`. Images, receipt and fresh review are in `out/house-door/pass-01/`, with the review under `independent-review/`. Earlier API/type and format failures are preserved, as are the pre-repair source packets.

## Frost wolf

The existing leg-angle solve now uses the underside-centre reference at `12q`, matching the unchanged measurement point, instead of the old `11q` paw-centre reference. Model geometry, materials, pivots, stride and gait timing are unchanged. All ten tests pass, including three new trajectory/contact/join regressions; tools type checks and scoped formatting pass.

Two sequential captures use the same nine walk samples from 0–1,000 ms at 125 ms intervals, on flat ground at 0.75 m/s. The verified module hook serves the exact old and new model bytes without swapping source files. Measured horizontal underside-centre drift falls from **8.768 mm between samples / 34.128 mm across a stance span** to **0 / 0 mm**. Both captures have zero application errors and source drift, one observed model load and recorded successful cleanup.

Root opened both strips and three native candidate frames. A fresh Astra reviewer opened all eighteen native frames and both strips, recomputed the drift from saved frame data, and found no obvious new shape, material or contact regression. This is a sampled appearance and horizontal-reference result: the rigid paw still rocks vertically, with **47.11 mm** of sole-centre height variation in one candidate stance run. Individual toe/heel contact corners, terrain adaptation and full playback are not proven.

Source and evidence: `D:/Dex/Temp/coldfront-wolf-stance-a82f5dd`. Checks: `out/wolf-stance/checks/2026-10-13T21-19-01.121Z/`. Paired images and receipts: `out/wolf-stance/capture-prep/baseline-11q-pass-01/` and `candidate-12q-pass-01/`; fresh review: `out/wolf-stance/capture-prep/independent-review.md` and JSON. Earlier type/format failures and pre-repair packets remain preserved. The original studies were not edited.
