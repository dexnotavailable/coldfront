# Distant lava correction · 13 October 2026

The selected material keeps distant lava orange instead of washing it into a pale sheet. Nearby cracks and glow are preserved. This is a rendering change: generation `023af1e…`, the current camera catalogue and saved edits stay unchanged. The increment is live as **`9d5b0f207980aae1489bb18e57993761a23ef5af`**.

## What changed and why

The existing shader averages cracks that become smaller than a screen pixel. Brightness after tone mapping is nonlinear, so averaging the source brightness can make distant lava look brighter than the resolved cracks. A first endpoint-only correction reduced that washout but created a visible middle-distance band; it remains rejected.

The selected version uses 29 fixed gain values across the existing screen-footprint transition. The values match the average displayed luminance of the original resolved crack pattern under the renderer's active ACES curve. They occupy 128 uniform bytes and require two indexed reads and a blend, reusing the existing crack calculation. There is no additional noise search or tone-mapping calculation inside the material. At zero fade, the added gain calculation is skipped. Other material classes, rock layers, propagated lighting, crack spacing and motion coefficients are preserved.

This intentionally reduces unresolved source emission. Its calibration omits real bloom, reflection, fog and per-cell brightness breathing; actual screenshots therefore decide whether it is useful. No GPU speedup is claimed.

## Images inspected

![Lava material comparison](https://github.com/dexnotavailable/coldfront/blob/9d5b0f207980aae1489bb18e57993761a23ef5af/docs/postcards/wip/ibara.jpg?raw=true)

Forest above caldera; baseline left, selected material right. Root opens all four originals and this browser-rendered comparison sheet. The 1280×720 JPEG uses 102,880 bytes; the complete WIP folder totals 814,661 bytes.

Root and a fresh Astra reviewer open both full caldera originals and prefer the candidate: less pale washout, richer orange lava and clearer balance with the dark thorns. Neither sees an obvious new seam, hole or hard transition ring in the inspected still. Dense near crackle and a flatter far surface remain.

The same reviewers open the affected forest pair and judge a visual tie. Rock detail, haze and warm fissure illumination are preserved. The forest files differ; this is not a pixel-identity claim.

Four near frames at 0, 250, 1,000 and 4,000 ms are each byte-identical to their baseline partner. All eight originals are opened. These static samples establish preservation at those times, not continuous playback, intermediate-distance behavior or flicker performance.

| Capture | Complete terrain | Readiness | Result |
|---|---:|---:|---|
| HELL-2 caldera | 1,624 / 1,624 chunks | 212.322 s | Complete image; the 180-second timing failure remains |
| HELL-1 forest | 1,306 / 1,306 chunks | 100.589 s | Complete image and passing 180-second check |

Both captures have zero application errors or external requests, with browser/server cleanup. Source-server captures are separate from the production release journey. Existing calibrated scores remain HELL-1 **15/20**, HELL-2 **13/20**; this material comparison assigns no new formal score and does not complete phase 1.3.

## Calibration and retained failures

The fixed 256×256 midpoint sample over `[-64,64)²`, time zero and the original 0.62/m mask yields mean **0.17645149784739714**, compatible with the authored 0.175 under the fixed mean gate. The source-only luminance target is the mean of the tone-mapped resolved samples; each gain solves the same target after the mask is blended toward 0.175. The near gain is 1; the far gain is approximately 0.13448632.

A 17-entry uniformly spaced table fails its interpolation check: maximum absolute luminance error **0.0073581131**, above **0.001**. That receipt remains failed. A separate representation subdivides only the four early intervals implicated by those saved errors: spacing 1/64 through fade 0.25, then 1/16. It reuses all 17 prior gains and the saved mask bytes, solving twelve additional values with no new spatial samples. All 113 fixed validation positions—including the previous 65—pass, with maximum error **0.0008504462**. The limit is unchanged. This finite CPU check does not establish a bound at every fade value or GPU arithmetic parity.

Independent review verifies the active curve, table values, Float32 packing, indexing endpoints and material scope. Six existing shader-contract tests pass. After final formatting, outline/ghost/silhouette captures are regenerated and pass independent inspection, all **88 source bindings** and **8 artifact bindings**. The prior review remains preserved. This adds no interface words or controls and is not a new full-gallery claim.

All **790 tests in 93 files** pass in **252.300 s**. The first check fails only on formatting of the new table and uniform assignment. Biome fixes it; parser-aware comparison confirms all **1,278 leaf tokens**, including template contents, remain identical, with a numeric-mutation sensitivity check. The initial standalone-scanner attempt cannot handle nested template context and is retained as a failed comparison method. The final **check/build pass in 17.898/7.735 s**. UI lint reports **106 gallery states, zero missing current rows and 23 bindings**. Existing 79 lint warnings and two informational notices remain.

## Evidence and release work

- Candidate source: `D:/Dex/Temp/coldfront-lava-continuum-02e458c`; shader SHA256 `791829e0e1d83c9f0e3f13ebe38f1b5f74870cdc9a88328a301ff1599d223ff1`.
- Formatted canonical shader: `6a7bd6ee1640e58b2ede158de4af8049df54fef91f0974d3c844614dc116931d`; unchanged-token proof: `out/phase13/continuum-format-equivalence.json`.
- Caldera: `out/lava-continuum/runs/2026-10-13T10-14-35.524Z/`; PNG SHA256 `3d1920f3344bb3460702180d427402676ca90fa88c09a9c78835f6af4646cca6`.
- Forest: `out/lava-continuum/forest/runs/2026-10-13T15-38-04.136Z/`; PNG SHA256 `a2523825200ce8fa7037952cbcc7db189e42644c1e35962a256bc974c5d11442`.
- Canonical near evidence: `out/phase13/lava-near-proof/runs/2026-10-13T15-26-43.228Z/`, compared with `2026-10-13T07-59-45.938Z/`.
- Reviews: `out/phase13/lava-continuum-pixel-review.md` and `out/phase13/continuum-formatted-hud-review/`.
- Numeric studies: `D:/Dex/Temp/coldfront-lava-energy-0435cee/out/lava-energy/continuum-only/` (failed) and `continuum29/` (finite check passed).

Local test/check/build are complete. The exact clean Node22 install/build passes in **20.329 s**, and the site build in **2.199 s**. [CI 38427068086](https://github.com/dexnotavailable/coldfront/actions/runs/38427068086) passes, including Chromium, Firefox and WebKit goldens. The fourteen-stage production journey finishes at **16:08:20.166 UTC**; root and a fresh independent reviewer open all fourteen originals and verify the 178-source/326-distribution binding. Placement, breaking, movement, replay/reload persistence, Ibara views, postcard travel/Escape and invalid-catalogue recovery pass. Errors, failed responses and external requests are zero; four ReadPixels warnings remain and cleanup completes.

Publication receipt **`fa0bdc0f-e94e-4532-b940-7a9fb3f598ee`** and `out/phase13/continuum-release-prep/public-readback.json` verify ten public files plus COOP/COEP at **16:18:12.639 UTC**. Public-browser gameplay remains separately unverified under its existing restriction. The unchanged generator's atlas, slices and complete CPU benchmark remain applicable. The separately preferred branch-quota study is not included in this material release.
