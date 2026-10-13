# Selva giant tree: gentle-slope study

The existing giant-tree recipe follows a gentle 1:8 slope without a new shape correction. This is an isolated asset study, not content installed in the live world.

The matched flat/slope fixtures use the same seed, origin, authored branches, canopy, root profiles, materials and three camera poses. Only the existing terrain-height sampling moves the root toes. The accepted recipe and original four-test file remain byte-identical to the preserved study.

## Measured result

Four original tests pass; shared, test and tool TypeScript checks pass. Initial formatter errors in two copied helpers are preserved and corrected without changing the recipe. Final formatting passes. Both bakes and all six native engine screenshots complete in 6.253 seconds, with zero application errors, four retained ReadPixels warnings and browser/server cleanup.

| Fixture | Wood voxels | Leaf voxels | Quads | Detached visible tree voxels |
|---|---:|---:|---:|---:|
| Flat | 3,110 | 17,949 | 11,863 | 0 |
| 1:8 slope | 3,101 | 17,949 | 12,408 | 0 |

Each of the five roots has sampled wood/soil face contact. Sloped root contact counts are 6, 9, 9, 10 and 10; the maximum toe-anchor error is below 0.000065 m. Raw sampling finds Bark one metre below each toe's ground level. The connectivity check proves that every visible tree voxel connects to some soil contact within this fixture, not a universal trunk-topology guarantee.

## Opened images and limits

The coordinator opened all six originals: whole, close and roots for each fixture. The broad multi-lobed crown and trunk silhouette are preserved. Visible front/side root toes meet the sloped soil without a visible floating gap. Rear contacts are partly occluded and are supported by the numerical record rather than claimed as directly visible. Regular stepped root ramps and heavy whole-tree haze remain appearance limits. Fresh Astra review also opens all six originals and returns a bounded support/silhouette pass. It verifies 146 source, six image and two mesh hashes with zero mismatches. It additionally flags a separate-looking downhill toe where the root meets a terrace edge; numerical connectivity does not remove that appearance concern.

There is no natural-forest placement, arbitrary slope, LOD, wind, harvesting or gameplay acceptance. The original dirty study remains untouched. No production generator, renderer, block registry or texture was changed.

## Evidence

Study: `D:/Dex/Temp/coldfront-tree-slope-e902690`, based on `e902690ff9cc97dbf2c56588aed5a34704d82451`.

- `out/tree-slope/HANDOFF.md`, copy provenance and independent source review.
- `out/tree-slope/checks/`: initial checks, preserved pre-format helpers and successful capture log.
- `out/tree-slope/runs/2026-10-13T23-26-32.359Z/`: setup, two meshes, six PNGs, source/image bindings, final render receipt and coordinator review.
