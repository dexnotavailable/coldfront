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
