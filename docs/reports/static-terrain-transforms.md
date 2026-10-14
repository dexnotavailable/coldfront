# Static terrain matrix updates

Uploaded terrain does not move. The renderer now computes its color/depth trees' local and world matrices once after attachment, then disables automatic recomputation for those trees. Cut caps, borders, avatars, effects, cameras, scene roots and the water-depth preparation remain dynamic. A future CPU rebase or reparent must explicitly refresh the frozen matrices.

## Bounded comparison

The actual renderer passed 36 paired frames across twelve fixed states: 72 explicit renders. Every pair matched exact RGBA bytes, local/world matrices, geometry hashes, ordered draws and pass sequence. Cases cover first-upload water, camera/origin movement, water leaving the view, moving cuts, marks, actor/effect motion, borders/wireframe, shadows, postcard visibility, world preparation/restoration, replacement, reupload and context restoration.

| Eligible terrain work across 36 measured renders | Before | After |
|---|---:|---:|
| Local matrix compositions | 2,544 | 0 |
| World-matrix products | 2,544 | 0 |
| World-update visits | 2,460 | 2,460 |
| Parent-update visits | 84 | 84 |

Initialization still performs this work: 64 compositions/products at initial upload, ten at replacement, ten at remove/reupload and 64 after context restoration. Preparation separately eliminates 102 repeated compositions/products. Traversal, camera-dependent model-view/normal products, shadow products and render passes remain. Excluded-object world products were not instrumented. These are operation counts, not timings or an FPS gain.

Root and independent Astra opened all twelve originals from six selected pairs. Platforms, columns and fluid patches match; the uncut views are strongly hazed, while the finite-cut view is clearer. All paired PNG bytes also match. The independent review rechecks every frame pair, 28 source bindings, three harness hashes and the shared fixture. Zero application/cleanup errors; four ReadPixels warnings remain.

This is eight small fixture chunks across two synthetic worlds, 640 × 360/DPR1, Three 0.186 and Chromium 153 with SwiftShader. It does not measure the friend's Radeon, establish representative world performance, resolve stutter or change the eight-chunk upload cap.

## HUD and release gates

The existing normal-runtime outline/ghost and silhouette captures complete in 12.225 seconds. Root opens both native PNGs and both shipping JPEGs. The target outline and placement ghost remain present; the covered avatar has a pale silhouette against its blocking wall. The fixed ghost comparison changes 2,440 pixels, with total channel difference 113,933. No words or controls were added.

Independent HUD review passes all 176 source checks (88 per case), eight artifact bindings and parsed native/public telemetry comparisons. Both cases have 148 loaded chunks and no queued requests, with zero application errors and four retained ReadPixels warnings. A7 passes for the three canvas marks at 1280 × 720; panel layout and blocking-screen keyboard order are inapplicable, and no broader resolution/gallery claim is made.

All 811 tests / 94 files pass in 273.54 s (274.701 s wrapper). The first check catches an evidence-path error: native originals must live under `out/engine/`. Its failed receipt is retained. Seven native files are copied byte-for-byte into that namespace, and only the two manifest source-image paths change. The repeated check passes in 16.361 s and build in 2.832 s; the unchanged tests are not repeated. The exact Node22 clean checkout passes npm ci/default build in 12.376 s and the site build in 2.317 s. [CI 38514471400](https://github.com/dexnotavailable/coldfront/actions/runs/38514471400) passes all check/test/build and three-browser determinism steps. Generation, materials, cameras and save identity remain unchanged; existing atlas/slice and CPU benchmark evidence still applies. No formal terrain score or phase completion follows.

## Verified release

Live **`36f85b2887a84faff7b80761a18de9e3cc29b074`** passes the fourteen-stage production journey in **291.447 s**. Root and a fresh independent Astra reviewer open all fourteen journey originals and four separate HUD images. All 180 source files, 326 distribution files and 100 supporting evidence files match. Placement, breaking, movement, replay/reload persistence, Ibara view changes, postcard travel/Escape and continued play after a malformed catalogue pass. Zero application errors, external requests or bad responses; four ReadPixels warnings remain. Browser/server closure and root process census pass.

The first release binder attempt fails before launching a browser because its original-manifest field mistakenly names the corrected manifest. The original definition and failure log remain under `revisions/binder-attempt-01/` and `prepare-execution-01.log`. Only that one metadata field is corrected; assertions and binder code are unchanged. The second preparation passes and its sealed packet remains immutable.

Publication receipt **`e3c281f0-fa3c-47d6-b4f9-7e8b65532121`** reports successful entry and metadata promotion. Eleven public file/hash/header checks pass at **2026-10-14T05:20:01.805Z**, including entry, version, JavaScript/CSS, camera catalogue and two fonts. Public browser play remains separately unavailable under the prior refusal.

Release packet: canonical `out/phase13/static-transform-release/`; exact build: `D:/Dex/Temp/coldfront-clean-phase13-36f85b2`. Actual journey: `runs/2026-10-14T05-09-13.711Z/receipt.json`, SHA256 `b17729edddd0d9f64895e63415c1d68777d64247d9b8f31753cb039407a649be`. Independent review: `independent-release-review/review.md` and JSON. Publication readback: `public-readback.json`.
## Evidence

- Candidate: `D:/Dex/Temp/coldfront-static-transforms-a2731d1`.
- Renderer before/after SHA256: `40261122fda6c4821a6cb3d239c627cf9592972535845d2644ee2b21bef2d45e` / `70185e23175a9b1732c8e907385bd1e09c5fcaf69a709eacf3cda84c3c495bd4`.
- Comparison: `out/static-transforms/runs/2026-10-14T04-46-28-988Z/receipt.json`, SHA256 `526aecb1d9ea3399bf46d2f7fd5c771e7215856866365d6215cd4ee8168dc0e5`.
- Independent source/fixture reports: `out/static-transforms/independent-{source,fixture}-review.md` and matching JSON.
- Fresh HUD capture: `out/static-transforms/hud-refresh/hud-2026-10-14T04-51-46-221Z/`.
- Original reviewed HUD files: `out/static-transforms/hud-native-a2731d1-70185e23/`; final byte-identical copies: `out/engine/hud-static-transforms-2026-10-14T04-51-46-221Z/`. Older sealed originals are preserved.
- Full-test/initial check receipt: `out/static-transforms/full-checks/2026-10-14T04-52-22Z/result.json`; corrected check/build: `out/static-transforms/check-build-after-path-repair/result.json`.
- Path correction and promotion: `out/static-transforms/hud-path-repair.json` and `integration.json`. Final manifest SHA256: `a22067177d8228638f41947ddb0250bfbad86ad70eeae53ed51970a872bfcb94`.

Phase 1.3 remains unfinished. Mandatory HELL acceptance and its unchanged primitive-control calibration gate remain open.
