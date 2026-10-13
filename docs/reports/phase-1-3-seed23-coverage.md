# Ibara seed 2 and 3 coverage

Current-generation geometry resolves for both required forest and caldera views on seeds 2 and 3. These records remain ungraded. They do not close phase 1.3 or replace the failed current-material calibration.

The study uses generation `676c1dee…`, resolver `a3c9265c…`, production terrain and the live rock material, from isolated checkout `D:/Dex/Temp/coldfront-seed23-e902690` at `e902690`. No canonical camera, generator or renderer is changed.

## Bounded resolution

| Seed | Resolve time | Forest full grids | Caldera full grids | Result |
|---|---:|---:|---:|---|
| 2 | 150.198 s | 3/50 | 25/50 | Both geometry-pass, ungraded |
| 3 | 174.088 s | 2/50 | 23/50 | Both geometry-pass, ungraded |

Both forest searches exhaust their eligible candidates before the 50-grid cap. Seed 2 retains a cropped/obscured dominant-contour warning. Seed 3 retains that warning and an unreadable broken-form witness. These are recorded shortcomings, not silently accepted composition results.

## Captures

| Seed/view | Chunks ready/requested | Capture time | Standard result |
|---|---:|---:|---|
| 2 forest | 1,324/1,324 | 150.546 s | Pass |
| 2 caldera | 1,679/1,679 | 169.688 s | Pass |
| 3 forest | 1,511/1,511 in diagnostic | 203.024 s | Standard 180 s failed; diagnostic image retained with exit 1 |
| 3 caldera | 1,813/1,813 | 169.492 s | Pass |

The coordinator has opened all four completed original PNGs. The seed-2 forest shows varied thorn silhouettes and a bright lava trench, but a large dark cropped foreground thorn obscures smaller forms. Both caldera views show the lava basin, while dark rims, low contrast and haze obscure thorn anatomy; the seed-3 pool occupies a particularly large portion of the view. Independent review opens all four original PNGs, confirms those limits and verifies each capture's 149 source bindings and recorded image hashes. The seed-3 forest diagnostic reaches readiness in 201.326 s; its standard failure remains explicit. That image exposes huge background hooks but also cropped foreground forms and a narrow vertical strip beside the fissure. No formal rubric scores are assigned.

## Preserved capture failure and recovery

The first seed-2 capture fails before browser launch because retained-camera preparation changes operational cache-accounting fields in HELL-1.readabilitySetup. Pose, geometry, readability outcomes and completed-search records stay identical, but the release fingerprint includes the complete JSON. The source/build guard correctly rejects the older build.

The existing retained resolve-only path is run once for both seeds before rebuilding. It costs 16.017/18.979 seconds and performs one validation grid per retained view, without repeating the search. Source and built cameras then match: seed 2 SHA `59f2048710be456a230a9ca82142ebaca8c0199863b9fa39b567e5315c1c6407`, seed 3 SHA `936ee591b1cd1b1aa753ea69ed14f70759f1991e284fddecff1a10636eaa1652`. No source check, deadline, radius, selector or terrain rule is weakened. Failed receipts remain intact.

## Evidence and next

The isolated checkout retains resolution receipts and attempt JSONL under out/postcards, serial command logs under out/seed23, and original PNG/JPEG/capture receipts in unique out/postcards/runs directories. No generated camera or image has been installed in the live catalogue.

The audit identifies 50 seed-2 poses across 17 eyes and 51 seed-3 poses across 19 eyes rejected solely for nominated-focus cropping/size before the full-grid test. Each has logged supported footing and same-eye owned wet visibility, but downstream geometry remains unassessed. One isolated source proposal will retain these existing poses as a delayed fallback after ordinary candidates and refinements, within the same 50-grid ceiling and unchanged later checks. No extra sites, cameras, relaxed safety or visual acceptance is authorized by this result.

Next: review and test that isolated fallback against seed 2. The existing calibration hold and mandatory HELL acceptance remain open. Atlas/slice and CPU benchmark evidence remain applicable because generation is unchanged; no unchanged broad benchmark was repeated.
