# Ibara rock layers and shape diagnosis

The `fbc0d967` baseline has no active horizontal rock-layer shader, despite the material requirement in terrain §8.5. The selected replacement is **live as `3f7e0df8335e53b81405bd2b36c168d3fa68168a`** and adds warped layers at the existing 3–7 m spacing, using two or three restrained tones. Generation, voxel shapes, camera destinations and save identity remain unchanged.

## Opened comparisons

The first version modulates only diffuse material colour. Eight GPU captures pass their invariance checks, but root and independent Astra inspection find no convincing layered-rock improvement. Its full HELL-1 forest capture is also neutral. Those results remain preserved; that version is not selected.

The second version applies the same layer tone once to completed reflected light, before the brightness ceiling and separate source emission. Root opens all eight fixture originals; independent Astra opens them before receipt inspection and prefers the new material. Horizontal dark/light bands are discernible across the broad lower and middle face. The shaded flank remains dark and the upper geometric ribs still dominate. Clay, feature colour and the explicitly synthetic zero-feature-ID control remain byte-identical. The synthetic control is not evidence of a real player edit or save.

The second version's full HELL-1 image loads all 1,306 requested chunks in **141.733 seconds**, within the unchanged 180-second deadline. Root and independent Astra open both originals and prefer the modest material gain: bands remain visible on the central broad face in the actual forest atmosphere. No obvious new seams, halos, speckle, glare or lava/ground regression is seen. Both GPU runs report zero application errors and complete cleanup; four retained ReadPixels warnings occur in each. These are software-renderer observations, not Radeon FPS measurements.

The full HELL-2 caldera capture completes at **213.819 seconds** with all 1,624 requested chunks ready. It misses the unchanged 180-second deadline: the timeout receipt and exit code 1 remain recorded despite the subsequent complete image. Root and a fresh Astra reviewer open both originals and slightly prefer the new material: subtle bands improve layered-rock readability on the central blade and right pillar. Existing dark foreground, stepped tip and noisy lava remain; no consequential new artifact is observed. No application errors occur and browser/server cleanup completes. This single timing observation is not a shader speedup measurement.

No formal rubric score was assigned during this material A/B review. The subsequent [fresh calibration](phase-1-3-current-calibration.md) supplies the current record: HELL-1 15/20 and HELL-2 13/20, with a valid 8/20 primitive control. This material increment does not resolve thorn anatomy or complete phase 1.3.

## Release checks

The integrated source passes **790 tests / 93 files**, check and build in **274.289 / 25.916 / 7.513 seconds**. UI lint reports 106 states, zero missing current rows and 23 bindings. The two new HUD captures pass root and independent review for outline, ghost and silhouette, with all 88 source and eight artifact bindings matching. Receipt: `out/phase13/recovery-gates/2026-10-12T17-40-38.604Z/result.json`.

Root opens the [material A/B comparison](https://github.com/dexnotavailable/coldfront/blob/3f7e0df8335e53b81405bd2b36c168d3fa68168a/docs/postcards/wip/ibara.jpg?raw=true), with HELL-1 above HELL-2 and baseline left/new layers right. The 1280×720 JPEG is 126,461 bytes; the complete WIP image set is 838,242 bytes, within its 1 MB limit. All four source originals were opened before assembly. The historical tip comparison remains pinned in its own report.

Clean physical-D Node 22 install/build passes in **13.6348735 s**, and the site build in **2.331976 s**. [CI 38286520482](https://github.com/dexnotavailable/coldfront/actions/runs/38286520482) passes, including Chromium, Firefox and WebKit determinism checks.

The exact production-bundle journey passes all fourteen stages at **2026-10-12 17:53:26.224 UTC**. Root and independent Astra open all fourteen originals. Independent verification matches 178 source files, 326 distribution files, five runner files and 29 evidence bindings. Actual placement/breaking/movement, immediate replay and reload persistence, Ibara modes, HELL-1 travel/Escape and play after one injected malformed catalogue pass. There are zero application errors, failed responses or external requests; four ReadPixels warnings remain, and browser/server cleanup completes. Evidence: `out/phase13/strata-release-prep/runs/2026-10-12T17-48-27.630Z/receipt.json` and its `independent-review/` sibling.

Publication receipt **`b863c7fc-979d-4bc8-b66b-f5c322ada1cf`** and `out/phase13/strata-release-prep/public-readback.json` verify ten public files and isolation headers at **17:56:18.540 UTC**. This proves local production play and matching public bytes; the separately refused public-browser action was not retried. The release retains `4:023af1e…` save identity. Try **F4 → Go to postcard → Ibara 2 / Ibara 3**, then Escape to return overhead.

## Shape diagnosis

Three fixed rays through the central comb-like thorn identify owner **10264208**, a 132 m, five-faceted, twisted, unbranched form. The earlier coarse dominant owner was a different thorn. A matched normal/clay fixture shows that the ribs persist in clay and in the silhouette, so they are not primarily a reflection effect.

One diagnostic clone removes only the main sweep's 0.8 m roughness. Fine nicks diminish, but the comb and terraces remain and become more regular. Roughness removal is not proposed for production. The diagnostic establishes no specific SDF defect; its isolated flat ground and lighting do not represent the complete forest.

## Evidence retained locally

- Canonical `out/phase13/comb-owner-diagnosis/`: exact owner probe, matched normal/clay fixture, roughness ablation and closure.
- Canonical `out/phase13/ibara-strata-pixel-review/` and `ibara-strata-world-review.md`: neutral first version.
- Canonical `out/phase13/ibara-strata-v2-pixel-review.md` and `ibara-strata-v2-world-review.md`: second-version inspected comparisons and limits.
- Isolated `D:/Dex/Temp/coldfront-ibara-strata-fbc0d96/out/strata/v2/comparison/runs/2026-10-12T17-21-58.859Z/`: eight original PNGs and immutable asset/source receipts.
- The same worktree's `out/strata/v2/forest/runs/2026-10-12T17-27-41.805Z/`: complete HELL-1 image and runtime receipt.
- The same worktree's `out/strata/v2/caldera/runs/2026-10-12T17-33-29.805Z/`: complete HELL-2 image, preserved standard timeout and runtime receipt.

The full generation benchmark already completed against the unchanged `023af1e…` generation remains applicable. No generation golden update or new save key is required for this client material change.
