# Camera clearance cost

The camera performs an avoidable repeated terrain-height query in a normal frame. A small candidate reuses that final-position measurement within the same camera step. It is under verification and is not yet published.

## Source behavior and preservation

`OverheadCamera.step` previously called `surface` in the clearance-loop condition and then again at the same final position for its vertical lift. A normal no-adjustment frame therefore made two identical calls. The sixteen-adjustment exit is different: its final position still needs a new measurement.

The candidate samples its initial pose once, samples each adjusted pose once and uses the last height for the final lift. No height survives the frame. The sixteen-adjustment limit, 85-degree tilt cap, six-metre clearance, focus lift, requested distance, automatic cut and all motion curves remain intact. The capped path still performs seventeen queries; a normal clear frame performs one instead of two.

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

The first unchanged smoke/drive invocation passes smoke and captures outline/flight, then times out waiting for a tunnel cut. That failed46.777s run is retained under `out/phase13/camera-clearance-release/drive-runs/2026-10-15T18-19-48-760Z/`. Root opens its three images. Source inspection identifies a setup mismatch: ordinary `run.ts` serves the UI shell, whereas only `dev/harness.ts` reads the `scene` query and seeds the tunnel through persistence. No camera failure is established by that missing fixture. A separate wrapper is being prepared to serve the existing harness and run the unchanged drive assertions with new output paths; no old evidence is overwritten.

The corrected harness route then fails its unchanged graphics preflight before producing an image; that separate V2 failure is preserved. An independent source review and a separate HTTP-only probe identify the missing response headers: the custom harness HTML has neither COOP nor COEP, while the ordinary page has both. Vite's later header middleware is bypassed by the early custom response. Both V2 browser and server close. A narrow response-header correction is being prepared; neither failure authorizes relaxing the camera or graphics assertions.

Final `check`, complete UI lint and build pass in **16.866 / 5.769 / 3.724 s**. UI lint reports 106 states, zero missing current rows and 23 bindings. Camera/cut fixture acceptance, the exact production journey and clean-checkout/release checks remain open before publication. Generator data and saved-world identity are unchanged.
