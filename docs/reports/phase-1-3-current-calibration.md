# Current Ibara calibration and next shape correction

The published `3f7e0df` material now has a fresh plain-cone calibration image. Root and a fresh Astra reviewer opened the control and both current production originals. **Phase 1.3 still fails its visual bar.** This review does not change the live generator or playable cameras.

| Image | Root | Fresh blind | Score of record | R2: root / blind |
|---|---:|---:|---:|---:|
| Plain-cone control | 8/20 | 8/20 | Calibration valid | 0 / 0 |
| HELL-1 forest | 16/20 | 15/20 | **15/20** | 1 / 2 |
| HELL-2 caldera | 13/20 | 14/20 | **13/20** | 1 / 1 |

[Current calibration sheet](../postcards/wip/ibara.jpg): HELL-1 above left, HELL-2 above right, and the plain-cone control below left. The fourth slot is blank. Root opened the assembled 1280×720 sheet and all three originals. Its 96,551 bytes bring the complete WIP image set to 808,332 bytes, within the 1 MB limit. The earlier material A/B sheet remains pinned in its own report.

Both production images have no zero on R1–R4. Seed 1 requires at least 16/20 and R2=2; neither passes. The root/blind R2 disagreement for the forest is retained, not averaged away. These are current independent scores, not a matched before/after score increase. Seeds 2–3 remain unaccepted.

The forest has distinct scales, uneven groups and broad routes, but its dominant forms are cropped and the giant's regular ribs distract. The caldera's curved central blade and broken pillar read clearly, yet attached forks and hooked forms remain hard to distinguish. The fresh reviewer also finds conspicuous lava repetition and weak material/lighting variation. The published layers are a preferred material increment; they do not establish the full visual requirement.

**Next correction:** make the generated caldera cluster's eligible branching and hooked anatomy read clearly across viewing angles. The first branch-direction proposal below is rejected. Further work must preserve separation between sibling branches rather than merely moving a hidden branch to another side. The earlier shoulder displacement and roughness-removal trials remain parked. No additional production-camera search is selected here.

## Branch-direction trial: rejected, not integrated

One isolated rule reflects branches that follow the parent's horizontal lean into the opposite hemisphere, retaining their lateral component. It leaves branch counts, roots, nominal length draws, profiles and excluded thorn types unchanged. Independent source review closes two test gaps by restoring an absolute pre-change debris/rubble hash and adding branched broken/landmark/arch controls. Three focused tests pass; seven unrelated tests are skipped by the explicit selection.

The fixed two-specimen fixture completes in **30.776 s** and produces eight clay images at unchanged azimuths 45°, 135°, 225° and 315°. All raw branch cells connect to their main stems; the ordinary specimen has one component before and after (5,648/5,650 cells), and the broken control remains exactly 5,787 cells. No cleanup hides fragments. The existing broken control's actual branch arc of 0.41456h exceeds its nominal 0.4h draw bound; this discrepancy is retained and reported, while before/after lengths remain unchanged. No population-wide arc-length claim is made.

Root and a fresh independent Astra reviewer open all eight originals and agree: the candidate makes a fork clearer at **45° and 225°**, but obscures the opposite fork at **135° and 315°**. Two improvements and two regressions fail the predeclared criterion. The candidate stays isolated and **must not be promoted from passing structural checks**. No full-world trial or automatic tuning is selected.

Evidence: `out/phase13/branch-direction-pixel-review.md`, `branch-direction-source-review.md`, and the isolated `D:/Dex/Temp/coldfront-branch-direction-8df104f/out/branch-direction/runs/2026-10-12T18-39-30.132Z/`. Candidate generation `095d7931…` is not live. The production generator remains `023af1e…`.

## Genuine reference selection

The exact production pose fails the primitive field's unchanged minimum sky fraction: **448/2304 rays (19.44%)**, against a 20% requirement. The first predefined yaw −1° refinement also fails at **434/2304 (18.84%)**. Both retain their failed receipts; neither produces an image or accepted camera.

The existing standard resolver then runs in a separate physical checkout at `8df104f`, with its own dependencies. It finishes in **143.092 s**, using **33 of at most 50** full grids. The selected view matches completed grid 10 and its recomputed search hash. It keeps the same eye, time and radius but uses a different heading, explicitly recorded as diverging from the production view. Sky fraction is **20.356%**, with real target and fissure hits. Independent audit confirms every production, TEST and phase-1.2 camera member remains unchanged; only the isolated `phase13Primitive` member is added.

The standard capture revalidates the production comparison and retained reference in two grids, then reuses it without another search. **All 1,823 requested chunks are ready in 98.326 s**, within the unchanged 180-second deadline. Capture takes **102.588 s**, and the command including revalidation takes **116.160 s**. It runs the actual primitive world and current material shader, with no material bypass. Application errors and external requests are zero, four ReadPixels warnings remain and the browser closes. This source-server capture is not a distribution-preview or hardware-FPS result.

## Evidence

- Published source: `3f7e0df`; unchanged generation fingerprint `023af1e…`; material shader `f8620235…53abc`.
- Root scores: `out/phase13/current-material-root-review.json`. Fresh blind review: `out/phase13/current-material-blind/review.md` and `.json`.
- Isolated reference checkout: `D:/Dex/Temp/coldfront-primitive-resolve-8df104f`.
- Resolver, preimage and independent audit: its `out/phase13/primitive-standard/` directory.
- Actual reference run: its `out/postcards/runs/main-s1-primitive-normal-023af1ecf3a1ec69911ef4ec537e1a8aa32d8e0e51a6748c7ca6bc4b18bcedc1-diagnostic-1791829081768/` directory.
- Current forest and caldera originals remain in the material report's linked evidence paths. The control is a calibration anchor at a different heading, not a strict matching-camera A/B.

The live release's 790-test suite, check/build, clean Node 22 build, production journey, public HTTP and three-browser CI evidence remains unchanged. No production code was edited for this calibration step.
