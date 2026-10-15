# Camera clearance cost

The camera now reuses its final-position terrain-height measurement within the same camera step, avoiding a repeated query in a normal frame. This is published as `f63d9659525dd09e8db4369d5edf4becb04a1458` at [dex.place/coldfront](https://dex.place/coldfront/).

## Source behavior and preservation

`OverheadCamera.step` previously called `surface` in the clearance-loop condition and then again at the same final position for its vertical lift. A normal no-adjustment frame therefore made two identical calls. The sixteen-adjustment exit is different: its final position still needs a new measurement.

The change samples its initial pose once, samples each adjusted pose once and uses the last height for the final lift. No height survives the frame. The sixteen-adjustment limit, 85-degree tilt cap, six-metre clearance, focus lift, requested distance, automatic cut and all motion curves remain intact. The capped path still performs seventeen queries; a normal clear frame performs one instead of two.

Five new behavior tests cover a clear pose, a ledge requiring adjustment, the iteration limit, the tilt cap and changed ground/cut on subsequent frames. Together with the existing chunk-store tests, **24 tests pass** in2.431s; client/tools types pass in2.798/5.819s. A wrapping-only formatter failure is preserved and corrected. Final format passes. Isolated evidence is in `D:/Dex/Temp/coldfront-camera-clearance-6993558/out/camera-clearance/root-validation/`.

## Actual synchronous measurement

The separate unchanged-source probe uses the saved release's `hell1-escape` camera position, X5669.5/Z5431.265834472425, cutInfinity. It reuses the exact serialized seed-1 plan from the preceding baseline fixture. Only `TerrainWorkers` is mocked; the real context and `ChunkStore` execute, with chunks and edits deliberately absent. No movement state is invented and no GPU is involved.

| Call | Time | Voxel gets/samples | Returned height |
| --- | --- | --- | --- |
| First call, cold store caches | 506.514 ms | 183 /183 | 24 |
| Exact repeat, same store | 2.675 ms | 183 /183 | 24 |

Plan decode takes3.739ms and context hydration52.145ms, outside those call timings. The two calls together perform one area preparation, one column sample and two sky-bound queries. The combined charged get/sample/sky count is735, below the fixed100000 cap. Instrumentation overhead is included. The worker mock receives no requests, disposal is confirmed and the exact child exits zero.

Evidence: canonical `out/phase13/movement-stutter-audit-20261016/probe/runs/2026-10-15T18-11-37.251Z/{run.json,surface.json,stdout.log,stderr.log}`. Source/helper/plan seals are retained; the original packet is immutable after execution.

The measurement demonstrates blocking CPU work under the **forced missing-chunk condition**. It is not browser FPS, a Radeon result or proof that ordinary movement reaches that condition. The reuse removes one repeated query; it does not remove the measured cold preparation. A warm-repeat saving measured at one point is not a universal per-frame improvement.

## Remaining path

`ChunkStore.surface` prepares its point area and sky input before looking up resident blocks. Fully resident chunks do not prevent that preparation. The existing `context.conservativeBounds` API could provide an exact initial scan ceiling without constructing a prepared voxel area; edits, cut and descending block lookup would still have to remain exact. However, that bounds API itself collects features, so it cannot yet be called a cheap solution to cold feature construction. No persistent cache or bounds-path change is included in this candidate.

The integrated source passes **868 tests across 103 files in 291.640 s**. Four fresh native/derived HUD images have been opened by root and independent Astra: the target outline, faint Sand placement ghost and blue avatar silhouette remain visible. All327 independent hash checks pass, covering94 source files per case and the native, candidate and prior evidence. Six evidence files are promoted. Four ReadPixels warnings remain; capture errors are zero. Evidence: `out/phase13/camera-clearance-hud-prep/runs/2026-10-15T18-22-32-584Z-eab935/`.

The first unchanged smoke/drive invocation passes smoke and captures outline/flight, then times out waiting for a tunnel cut. That failed 46.777 s run is retained under `out/phase13/camera-clearance-release/drive-runs/2026-10-15T18-19-48-760Z/`. Root opens its three images. Source inspection identifies a setup mismatch: ordinary `run.ts` serves the UI shell, whereas only `dev/harness.ts` reads the `scene` query and seeds the tunnel through persistence. No camera failure is established by that missing fixture. A separate wrapper then serves the existing harness and runs the unchanged drive assertions with new output paths; no old evidence is overwritten.

The corrected harness route then fails its unchanged graphics preflight before producing an image; that separate V2 failure is preserved. An independent source review and a separate HTTP-only probe identify the missing response headers: the custom harness HTML has neither COOP nor COEP, while the ordinary page has both. Vite's later header middleware is bypassed by the early custom response. Both V2 browser and server close. A narrow response-header correction resolves that precondition; neither failure authorizes relaxing the camera or graphics assertions.

The next attempt passes its headers but still waits for a cut that cannot activate: a separate no-input observer confirms feet at Y9 on top of the Y8 roof, with 72 legacy edits and no preferred pose. Production startup correctly chose the edited surface. V4 corrects only the fixture bootstrap, saving the unchanged tunnel edits and safe floor pose under the same full test identity before importing the unchanged harness. The native destination still validates that pose; no body/camera setter, changed driver assertion, altered wait or geometry change is used.

V4 passes all six native captures in a **25.202 s wrapper interval**. Root and independent Astra open every image. Actual endpoints show feetY6/cut7.5/tilt70 inside, cutnull/tilt55 outside, then cut7.5/tilt70 on reentry. The wall silhouette remains active without a cut. All 249 hash checks match, including 192 sources, 37 preserved prior files and 13 native outputs. Application errors are zero, four ReadPixels warnings remain, and browser/server close. This is endpoint and input-fixture proof, not continuous playback or FPS. All failed V1–V3 evidence remains intact under `out/phase13/camera-clearance-release/`; the passing run is `drive-v4/runs/2026-10-15T18-50-49.323Z-4dadc3f6-f982-491f-a1c5-829b6295d0a3/`.

[Opened contact sheet](../postcards/wip/ui.jpg): upper left is inside the tunnel, upper right is outside, lower left is reentry, and lower right is the silhouette. The four full frames are resized equally with no crop; the authoritative native PNGs remain preserved. The 1280×720 JPEG is 105,573 bytes and keeps the complete WIP image set at 961,859 bytes, below its 1 MB limit. An earlier JPEG85 encoding exceeded that unchanged limit and wrote no replacement; the final report sheet uses JPEG70.

## Publication and remaining limits

Final `check`, complete UI lint and build pass in **16.866 / 5.769 / 3.724 s**. UI lint reports 106 states, zero missing current rows and 23 bindings. The exact clean checkout independently passes install/default build/site build in **6.302 / 3.402 / 2.016 s**. [CI 38786571187](https://github.com/dexnotavailable/coldfront/actions/runs/38786571187) passes, including three-browser golden hashes.

The exact production fourteen-stage journey passes in a **272.096 s receipt interval**. Root and fresh Astra open all fourteen originals; 850 hash checks and 431 state/structure comparisons match. Movement, placement/breaking, immediate replay/reload persistence, Ibara modes, HELL-1 travel/Escape and malformed-catalogue continued flight pass. There are zero errors, bad responses or external requests; four ReadPixels warnings and complete cleanup remain recorded. The fixed HELL-1 image is byte-identical to the previous live release. Evidence: `out/phase13/camera-clearance-release/runs/2026-10-15T18-59-59.013Z/` and its packet's `independent-review/`.

Publication receipt `76247e5d-f5f7-4a44-99da-9824e8eb172e` and public HTTP readback at **2026-10-15T19:11:35.886Z** verify eleven public file hashes and both isolation headers. The public browser remains separately unavailable. Generator data and saved-world identity are unchanged.

The 506 ms forced-fallback first call is still an open performance concern; no Radeon FPS fix is claimed. A later source audit rejects an edit-only across-frame height cache under the current mutable map/buffer contract, and identifies fractional cut clamping as another correctness condition. No such cache is included here. Milestone 1 phase 1.3 terrain acceptance remains open.
