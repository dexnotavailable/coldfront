# Smithy cold-hearth study

The cold hearth is easier to distinguish from the surrounding masonry. The isolated revision replaces three existing StoneBricks cells with the existing non-emissive Ash material. Shell, floor occupancy, aisle, roof, chimney, anvil and bench geometry are unchanged. This is a static asset study, not a working forge or live-world integration.

Root and fresh Astra review open all six matched originals and prefer the candidate modestly. The dark granular bed is clearest in the chimney section and 24 m overhead detail; the wider interior difference is subtle. No visible regression is found. Fire, heat, fuel, production, collision and interactive doors are not demonstrated.

## Verification

- 16 geometry, parts and framing tests pass across three files; shared, shared-test and tools TypeScript checks pass. The final nine-file formatting check passes.
- Baseline and candidate captures use separate checkouts of the current renderer and identical helpers. No source is swapped during capture. Each takes the same hearth, interior and flue views.
- The baseline capture finishes in 3.392 s; candidate in 3.091 s. Both have zero application errors, zero external requests, four retained ReadPixels warnings and confirmed browser/server closure.
- Independent review verifies 13 source bindings per capture, all six image hashes and exact camera/time/cut/body/framing equality. The 604-voxel asset changes exactly cells (6,0,11), (6,0,12), (6,0,13), revision 1 to 2 and the derived material counts.

Initial evidence is retained: the copied capture helper fails two noUnsafeFinally checks before its closure checks are rewritten to record and propagate failures safely. A root copy command uses an outdated manifest key and stops before copying files; its subsequent missing-module capture failure also remains recorded. The corrected copy verifies all nine source/test hashes before copying. The old study is untouched.

## Evidence

- Candidate: `D:/Dex/Temp/coldfront-smithy-hearth-4c2f518`, captures `out/smithy-hearth/candidate-01/`.
- Baseline: `D:/Dex/Temp/coldfront-smithy-baseline-4c2f518`, captures `out/smithy-hearth/baseline-01/`.
- Candidate `out/smithy-hearth/` retains provenance, the original source snapshot, three helper revisions, scoped checks, source review, coordinator review and independent review.
- Historical `D:/Dex/Temp/coldfront-asset-smithy/out/smithy/pass-02/` is preserved as earlier evidence, not used as the current-renderer baseline.

## Library adoption, 14 October 2026

The reviewed revision enters the [unregistered asset library](../assets/README.md) as four unchanged files: shared model and geometry tests, client presentation helper and presentation/camera tests. Including the helper preserves the doors, anvil and bench visible in the accepted study. The existing construction brief is linked unchanged; the capture harness and framing-only tests remain isolated.

A fresh checkout at `0f45efa` retains the current renderer, including static terrain matrix initialization. Its three hearth/interior/flue captures complete in 3.638 s and are byte-identical to the accepted candidate originals. Root opens all three; the granular bed, open aisle, small station pieces and open chimney remain visible. The close hearth view intentionally crops the entrance, and the bed's front face remains very dark. These are static detail views, not a new whole-building or functioning-forge demonstration.

All 16 existing study tests, four TypeScript checks and nine-file formatting pass. All 13 bound sources match their final readbacks; there are zero application errors, external requests or source changes, four retained ReadPixels warnings, and confirmed browser/server closure. The copy manifest initially retained planned canonical destinations; actual destination hashes verify and the corrected manifest points to the fresh study. Its original planning copy remains preserved. No source or capture rerun is needed for that metadata correction.

Fresh proof is at `D:/Dex/Temp/coldfront-smithy-library-0f45efa/out/smithy-hearth/adoption-current-01/`; source checks and independent review are under `out/smithy-library/`. The separate four-file integration checkout is `D:/Dex/Temp/coldfront-smithy-integration-0f45efa`. Its two existing HUD cases are freshly captured in 20.378 s with 91 source bindings per case; root opens both PNG originals and both JPEG derivatives. The placement ghost changes 2,440 pixels with total difference 113,933, and the hidden-avatar silhouette is visible. These are evidence refreshes; no interface controls or words change.

Generation/save identity remains `676c1dee2fe6e97007d306b08f8efeb1381c9d9510f701f4558f22721f2116cb`; the broader build hash changes to include the library files and refreshed evidence. This adoption does not spawn a smithy in the live world, advance terrain scores or establish a performance gain.

The integration suite passes **828 tests across 97 files** in 269.10 s (270.374 s wrapper). The first check fails only because three generated public HUD JSON files lack trailing newlines. The failed log and original files are retained. Formatting preserves parsed values and all image/source bytes; the manifest is updated with the new receipt hashes. The subsequent check and build pass in **18.409/3.030 s**. No asset or capture rerun follows this metadata-only correction.

Independent Astra accepts the three smithy originals and the four HUD images, verifies all 182 HUD source bindings and eight artifact bindings, and independently reproduces the ghost difference. The HUD review is limited to the three existing canvas marks at 1280×720: no words appear, the target/ghost and silhouette align with the intended positions, and panel layout/blocking-screen keyboard checks are inapplicable. Other resolutions and the full gallery are not newly reviewed. No new postcard is committed; the existing WIP image budget remains 939,899 bytes.
