# Reliable cached terrain plans

The terrain review tools now reuse a valid saved WorldPlan instead of rejecting it because an equivalent JavaScript value serializes differently. The fix stores the serialized payload bytes and checks their SHA-256 before decoding them. Seed, source-generation, version and complete plan validation remain required. Legacy or invalid caches rebuild once through the existing route.

This fixes tooling reliability and preparation time. It does not change terrain generation, the renderer, save identity or gameplay FPS. Generation remains `676c1dee…`; the cache envelope changes to schema 2, while the world-plan schema and public loader API remain unchanged.

## Evidence and checks

The seed-3 strip investigation preserved two checksum failures before querying voxels. A semantic comparison then proved the old cached plan and fresh plans exactly equal. [Node's V8 serialization contract](https://nodejs.org/docs/latest-v22.x/api/v8.html#serialization-api) explicitly permits different byte output for equal JavaScript values; reserializing the object is therefore an unreliable integrity check.

Sixteen regression tests use an actual production plan, real serialization and real hydration validation. They cover warm reuse with typed arrays intact, tampered bytes, wrong metadata and payload types, legacy envelopes, invalid decoded values and rejection of invalid fresh plans. All pass. The initial new-test formatting failure is preserved; formatting is corrected without changing the loader.

A real file test on seed 3 passes: cold build **2167.430 ms**, warm read **81.826 ms**. The cache file's bytes and modification time remain unchanged on the warm read. Cold, warm and the preserved original plan are deeply equal. This single local measurement is a tools-cache observation, not a general benchmark or a Radeon result.

Full validation passes in the isolated owning checkout: **811 tests / 94 files** in **302.49 s** (303.051 s command wrapper), check **16.190 s**, build **5.136 s**. UI lint remains 106 gallery states, zero missing current rows and 23 bindings; 79 warnings and two information notes remain. Independent code review finds no blockers. Only `loadPlan` and its new test change in production source.

The change naturally updates both camera-resolver fingerprints and the release fingerprint. Existing camera/search evidence must retain its original identity and go through ordinary preparation when used by the changed resolver. No camera JSON, generation tag or old proof is retagged. The earlier screenshots, atlas/slices and CPU benchmark describe the unchanged generated world; they are not relabelled as fresh renders of this tool change.

## Evidence locations

- Study: `D:/Dex/Temp/coldfront-plan-cache-4c2f518`.
- `out/plan-cache/full-checks/`: actual full test/check/build logs and exit receipts.
- `out/plan-cache/real-io/2026-10-14T00-51-42.146Z-36c3a609/result.json`: real disk cold/warm proof.
- `out/plan-cache/source-review.md/json`: independent review and final source hashes.
- [Strip diagnosis](phase-1-3-seed3-strip-diagnosis.md): original checksum failures, semantic comparison and voxel evidence.

Integration is selected after those checks. Exact clean-checkout, CI and publication results are recorded in the PR and progress log when executed. Phase 1.3's formal terrain acceptance remains open.
