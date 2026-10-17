# Phase 1.4 · Far terrain

The owner has moved regional appearance refinement to other lanes. Phase 1.3's remaining visual requirements stay deferred, with their existing scores and failures intact. This phase starts from the accepted `ff73f12` runtime and merged `5617333` source, without the isolated caldera experiment.

The outcome is real terrain visible for at least five kilometres in HELL-3, HELL-4, VISTA-1, MTN-2 and KING-1, without LOD rings, cracks, terraces or flattened peaks. The full specified system reaches about sixteen kilometres at altitude. It also includes the Command camera, phase-1.4 settings, far shadows, floating origin and distance atmosphere. Regional shape and material retuning are outside this work.

## Implementation order

1. **Far columns and meshes.** LOD2–6 use 32×32 full-height sample columns with a halo, vertical solid/fluid runs, density zero crossings quantized to 1/16 m, interval-difference sides and separate seam skirts. Reuse pointwise world generation and feature LOD policies. Preserve voids, overhangs and owned fluid levels; do not substitute a single heightfield. Terrain-only peak preservation uses the specified 2×2 samples from spacing 8 m upward.
2. **Streaming and rendering.** Add versioned far-tile requests to the shared worker budget, screen-space-error quadtree selection, retained parent coverage until all visible children are ready, and bounded BatchedMesh pages. Preserve edited structures at distance and reject stale results. Complete the LOD1 grid and near/far seam ownership. Keep the existing near collision, editing and lighting path exact.
3. **Command view and catalogue interface.** Build C1/C6/C7 camera behavior with injected ground/raycast access, then wire Tab transitions, map Go here, D8's phase-1.4 settings and the listed F3/Tools LOD rows. Use the existing string table, lint, gallery and screenshot pipeline. No unlisted controls or explanatory filler.
4. **Depth, shadows and air.** Render far geometry with its own depth range, clear depth, then near geometry. Preserve near water and marks; give far water matching depth. Rebase world-space shader math while leaving world coordinates unchanged. Add the worker horizon-shadow map, sky clouds and runtime-generated takram atmospheric lookup textures. Its far-depth effect must run before near depth replaces that buffer; no remote lookup assets.
5. **Acceptance and publication.** Inspect the specified long-distance postcards, LOD and origin crossings, cut caps, distant edits, context recovery and extension-disabled draw fallback. Run the required tests, checks, clean build and browser determinism checks; measure actual sampling, upload, draw, triangle and memory costs. Publish verified working increments before the whole phase is complete.

## Current lane ownership

Root is the sole integrator and heavy-job executor. Installs, generation probes, tests, builds, benchmarks and renders run serially.

- **Far columns:** Astra, isolated `D:/Dex/Temp/coldfront-far-columns-5617333`; shared sampling/runs/meshing/edit reduction and focused tests.
- **Far renderer:** Astra, isolated `D:/Dex/Temp/coldfront-far-renderer-5617333`; tile selection/readiness/store, BatchedMesh ownership and focused lifecycle tests. Existing worker/material/bootstrap wiring follows integration of the shared contract.
- **Command camera:** Astra, isolated `D:/Dex/Temp/coldfront-command-view-5617333`; pure controller and C7 tests before input/UI wiring.

The column and renderer lanes agree on a separate far vertex layout: Float32 tile-local positions and normals, quantized fractional heights, material/light/feature attributes and Uint32 indices. Existing near packed positions cannot encode full-height tiles and remain separate. The renderer material must account for BatchedMesh transforms in its custom world-space calculations.

Initial configurable tile ceilings are one million logical density evaluations, 65,536 runs and 65,536 quads. A capacity failure is explicit and retains an already-ready ancestor; it never truncates geometry or counts as Ready. These are engineering limits awaiting measurement, not a performance or visual acceptance claim.

## Preservation and proof

- Keep near LOD0/1 outputs and exact edits compatible where their algorithms are unchanged. Assess source-fingerprint/cache implications explicitly before integration; do not silently relabel historical validation or saved worlds.
- Share the worker budget and the normal eight-part upload cap. High Command-camera altitude must not create holes through an incorrect near-coverage mask.
- Reuse Three r186 and the existing material calibration. Check the actual installed APIs and licences before adding takram; never read or copy the off-limits project sources listed in `10-prior-art.md`.
- Local pinned Chromium remains the screenshot route. Public HTTP verification is available; the existing public-browser and IAB restrictions remain.
- Phase 1.4 is not complete until the complete roadmap scope and distance/transition checks pass. Deferred regional taste scores are tracked separately under decision 121.
