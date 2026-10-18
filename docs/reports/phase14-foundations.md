# Phase 1.4 foundation checkpoint

Regional appearance refinement is parked by the owner. This checkpoint adds dormant far-terrain and Command-camera foundations; the live game remains `ff73f12` and the complete phase remains unfinished.

## Verification

- Exact pushed foundation `182e2d58ad58ac7f36df8ec2dda49c92aa386b71`: `npm test`, 941 tests / 115 files, 269.954 s. This full run includes the shared sampler, pure Command controller, far client and refreshed HUD evidence. Both type checks and lint pass. The exact clean checkout also passes `npm ci` and the default production build on Node 22.23.3 in 81.486 s.
- `npm run build` passes. The first `npm run check` correctly rejects stale world-HUD evidence after shared source changes. Fresh local Chromium captures, inspection and exact candidate promotion restore the check pass; the guard is unchanged.
- Saved failures include canopy shrink/disappearance, camera height/roof/edge-timing regressions, and coarsening to an unavailable parent that erased ready children. Independent assertions remain intact after repair.
- A bounded generated-Ibara fixture preserves LOD0/1 sample bytes under coarse-first and near-first preparation. This does not establish full-region equivalence or save compatibility by itself.

Root execution receipts are in `out/phase14/first-integration/root-checks/`; integration provenance is in `out/phase14/first-integration/*-manifest.json`. Isolated author/review histories remain in their original worktrees. No evidence was reclassified as a regional visual pass.

## Inspected HUD preservation

Capture: `out/phase14/foundation-hud-prep/runs/2026-10-15T22-53-03-063Z-0cd4e7/`. Native PNGs: `out/engine/hud-phase14-foundation-2026-10-15T22-53-03-063Z-0cd4e7/`. Root opened both native PNGs and both candidate JPEGs before promotion.

| Fixture | Opened files | Observation | Scope |
|---|---|---|---|
| Outline and placement ghost | `outline-ghost.png`, `world-outline-ghost.jpg` | Thin dark target outline and faint sand ghost above the avatar on grass. PNG and JPEG preserve both. | Existing near-world rows `hud.outline`, `hud.ghost`; pass. |
| Silhouette | `silhouette.png`, `world-silhouette.jpg` | Pale blue avatar silhouette remains visible against the occluding stone wall. | Existing near-world row `hud.silhouette`; pass. |

These world-only fixtures contain no interface words, added controls or decoration. Screen layout, keyboard order and new Command input are not exercised. The unchanged proof runner reports zero browser errors, 2,440 changed ghost pixels and 105 bound source files. The gallery remains available at the live link, but these new evidence assets are not claimed deployed.

## Benchmarks and remaining work

`npm run bench:gen -- --world test --repetitions 1 --warmup 1` passes. Median/p95 milliseconds: LOD0 generation 1.281/2.014; lighting 14.324/18.609; meshing 4.276/7.083; neighborhood preparation 24.352/30.109; total pipeline 44.755/56.473; LOD1 generation 1.323/1.565. Lighting and meshing miss later targets. The earlier default regional run is preserved as interrupted after 200 of 2,400 LOD0 rows; it supplies no completed aggregate.

Worker transport, far material/caps and runtime integration are separate Astra lanes. Actual distant geometry, LOD1 streaming, GPU preparation, two-pass water/depth, floating origin, horizon shadows, atmospheric lookup textures, Command input/settings and the five long-distance acceptance postcards remain outstanding. No far FPS, five-kilometre visual result or phase completion is claimed. Source-fingerprint/save handling must be resolved explicitly before publication.
