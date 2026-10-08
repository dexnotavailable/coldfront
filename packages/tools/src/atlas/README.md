# Terrain review in phase 1.2

`npm run atlas -- --seed 1 --world main --mode regions --size 2048`
renders the full canonical frame. `--mode height` samples exact surface height,
the context's gradients and owned water; `--mode sites` projects every site's actual
XZ onto a dimmed region map. Surface region colours come from the shared region
definitions. Underground diagnostic colours and canonical display names live in
`palette.ts`; they are not block colours or runtime interface strings.

Choose `--layer upper_deep|undercrown|maw|pit` for planned region footprints or
layer-filtered sites. Height maps are surface-only: cavern floors do not yet
exist. Feature heatmaps are deliberately unavailable until the phase 1.3 masks
exist. Underground footprints and the slice overlays do not claim carved air.

`npm run slice -- --seed 1 --world main --px 2` writes the required SW–NE,
full-height 16 m/px overview and a central 2 km window at 2 m/px. Repeated
`--window x,z` arguments select additional parallel windows. Main windows default
to the full vertical frame; `--y-min` and `--y-max` can narrow them. Planned
footprint/shelf colours tint actual solid samples only. `--overlays none` writes
the unannotated material image. Density and material statistics always refer to
the actual point samples, before diagnostic tinting.

`--world test` keeps the accepted rolling-plains generator: atlas defaults to a
512 m square, slice windows to y=-64..48, and no WorldPlan overlays are allowed.
Outputs are separated under `out/atlas/<world>/seed-N` and
`out/slices/<world>/seed-N`. Existing npm scripts and dependencies suffice.

Every raw PNG has a JSON receipt with source SHA-256 values, image hash, sampled
extent, exact sample convention and measured timings. Context/plan preparation is
timed separately from raster sampling. The `-review.png` frame copies every raw
data pixel without resizing and adds units, legends and diagnostic labels.
Site markers use fixed pixel symbols, not physical building footprints; the
legend gives visible/total counts and a census of every descent type. Bridge
lines follow actual centreline segments; red segments use actual arc gaps.
Region receipts include dominant and weight-integrated square kilometres.
Underground dominant area counts footprint weight >=0.5; weight-integrated area
includes the frayed edge. Height statistics are explicitly null on plan maps.

Focused tests: `npx vitest run packages/tools/test/atlas packages/tools/test/slice
packages/tools/test/terrain-review`. These test pixel centres, region mixtures,
site filtering/gap clipping, canonical depth bands, no invented cave air, and
exact test-world adapter values without building a full plan.
