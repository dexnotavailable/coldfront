# Optional King avatar integration

The reviewed crown and cloak can now attach through the existing Avatar class when a caller supplies a King appearance. The two-argument constructor still produces the plain avatar. This capability does not select or spawn a King in live play, add a selector, or change movement, collision, targeting or terrain.

The change preserves the King recipe and all fourteen existing attachment/motion tests. A narrow adapter supplies the host rig, registers attachments before silhouette/outline/depth copies are built, updates attachment poses before copy synchronization, and disposes generated textures before the existing host cleanup. The controller is unchanged. The earlier [neutral-trim study](king-night-study.md) remains historical evidence.

## Default-avatar preservation

The component comparison imports the real Avatar and controller from the untouched clean `52f866e` checkout and compares them with the candidate's default two-argument path. Eight fixed idle, head-turn, movement, step and swing cases plus an 80-tick controller replay produce **88 exact comparisons**. Geometry, attributes, serialized materials and sharing, local/world transforms, silhouette/expanded-outline/depth copies and controller state all match. Body and previous-body inputs are not mutated. The default path retains eleven meshes and no King parts or textures.

The comparison passes in **0.699 s**. This establishes equality for those component cases; actual targeting, edits and saves belong to the separate production journey.

## Current-renderer appearance

Eleven fresh 1280×720 frames complete in **17.819 s** using the current renderer: three preserved night/noon inputs, six fixed-root walk/wind samples, a wall-copy view and an automatic roof-cut view. Root opens every original. The crown remains distinct in the night controls; the cloak's outline remains visible with neutral trim while its internal detail is subdued. The sampled limb and cloak poses change without an obvious detached part or ground strike. Fine clearance is limited by the normal overhead scale.

All 34 meshes have matching depth and silhouette transforms and correctly expanded outlines in every frame. The roof case uses the real roof detector and reaches **70° tilt with a cut at Y=3.5**. The wall case deliberately enables the silhouette to inspect alignment; it does not prove automatic occlusion selection. The six fixed-time samples and tests do not establish full-rate playback, production wind delivery or general collision freedom.

The three current controls are not byte-identical to the older renderer's PNGs. Historical equality is informational, not an acceptance condition; no old renderer is substituted to recover it. The current run has **121 input bindings before and after**, zero application errors, denied origins, failed requests or bad responses, four retained ReadPixels warnings, and successful fixture/browser/server cleanup. A separate root process check finds no surviving capture process.

The existing outline/ghost and plain-avatar silhouette HUD cases are refreshed with **94 source bindings per case**. Root opens both native PNGs and both shipping JPEGs. The target outline, faint placement ghost and pale blue covered-avatar silhouette remain visible; no canvas words are added. Public metadata formatting adds a final newline without changing parsed values or images. The capture takes **15.210 s**.

Fresh independent Astra review accepts all eleven King originals and four HUD images, verifies the 121 frozen inputs, and recomputes all **1,122 copy matrices with maximum error 0**. The six cloth samples have distinct saved transforms. Both HUD cases have matching source and artifact bindings. The scoped canvas review finds only the listed target/ghost/silhouette marks, with no text; panel layout and blocking-screen keyboard checks are inapplicable, and other resolutions are not newly reviewed.

The full suite passes **851 tests across 101 files** in **224.08 s** (227.956 s wrapper); check and build pass in **22.495/5.142 s**. Exact-commit clean/site builds, CI and the actual production journey remain separate release checks.

## Scope and evidence

The four source/test files and proof are in `D:/Dex/Temp/coldfront-king-integration-57fc80d`:

- Frozen packet: `out/king-integration/READY.md`, `READY.json` and `READY-inputs.json`.
- Default comparison: `out/king-integration/runs/plain-parity-2026-10-14T09-37-07-221Z-ac62e6c9/receipt.json`.
- Eleven originals and receipts: `out/king-integration/runs/capture-2026-10-15T06-16-55-548Z-398a1d53/`.
- Root tests, HUD and integration receipts: `out/king-integration-root/`.
- Native HUD images: `out/engine/hud-king-integration-57fc80d/`.
- Independent recovery review: `out/king-independent/recovery-review/`.

All fourteen original King tests, four TypeScript checks and scoped formatting pass. The interrupted reviewer reached the usage limit after a verbal packet review; the saved source and comparison results survived, and a fresh Astra reviewer checks the resumed evidence. No completed tests or captures are rerun merely because the session resumed.

The harness checks arguments, environment and checkout before creating its per-run directory. Those preflight failures would require the root command log; they are not promised a per-run receipt. Runtime/source-readback failures preserve their attempted run.

Generation/save identity remains `676c1dee2fe6e97007d306b08f8efeb1381c9d9510f701f4558f22721f2116cb`. The broader release hash changes. Existing atlas, slice and generation benchmark remain applicable. No new terrain score, phase completion, performance gain or Radeon-stutter fix follows. Shared production wind, live King selection, equipment and broader class presentation remain future work.
