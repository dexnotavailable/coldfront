# Seed 3 forest: thin-strip diagnosis

The narrow strip beside the lava trench is a real, small Obsidian thorn in the sampled world data. The bounded probe finds no evidence that cleanup removed its body or that its two columns were omitted from the captured view. No terrain correction is justified solely by this observation, and no shape is enlarged or deleted to improve one screenshot.

The coordinator opened the original current-generation seed-3 HELL-1 PNG. Twelve fixed camera rays use the production camera math and voxel traversal, with a 512 m distance cap. The four strip samples hit the same feature, 10593544, at approximately 35–37 m. Adjacent rays mostly reach sky or ordinary ground.

## Measured anatomy and loading

The feature is 15.254 m tall with a 1.880 m base radius, four facets, a 14.21-degree lean and 1.337 m bend. It is intact, unbranched and unhooked. Its authored base is at ground height 45.652 m; the main sweep starts below that surface at 43.821 m and ends at 60.439 m. The radius tapers from 1.880 m to 0.450 m; the thin-tip length is 1.5 m.

A second probe samples 723 raw/final voxel pairs and exactly two column bounds. All four earlier hits reproduce exactly. Six horizontal slices at Y 44, 46, 50, 55, 60 and 62 contain respectively 7, 6, 8, 4, 1 and 0 voxels owned by this thorn. Raw and final sampled values agree throughout. The lower samples span two or three X cells; the top sample is one voxel. Both relevant columns include the sampled Y levels; this is a reconstruction through the production planner, not GPU-buffer readback.

These sparse slices do not establish whole-volume topology or rule out every shading/mesh issue. They explain the sampled narrow silhouette without supporting a missing-column or cleanup repair. Independent review verifies all 723 pairs, four repeated hits, column membership and source bindings, and finds the feature consistent with the applicable small-thorn rules. It recommends leaving geometry unchanged. Formal visual acceptance remains open.

## Plan-check failure retained

The first diagnostic stops before any voxel query because the saved plan's stored checksum differs from a checksum of its reserialized contents. A fresh-plan follow-up succeeds, but a second serialization identity check also fails before sampling. All failed scripts and receipts remain intact.

A separate semantic comparison proves that the cached plan and two freshly generated plans are deeply equal, including their typed arrays. This is consistent with [Node's serialization contract](https://nodejs.org/api/v8.html#serialization-api): equal values can produce different serialized bytes. The diagnostic now checks the exact frozen file hash, generation, seed and version, then requires equality of the entire plan value. It never rewrites the frozen cache or skips value comparison.

The production review-tool cache uses the same reserialization checksum pattern. A separate minimal cache correction now passes 16 focused tests and the full 811-test suite: hash and verify the exact stored payload bytes before decoding them, while retaining metadata and plan validation. [Cache correction](terrain-plan-cache.md). This is a tool-cache defect, not evidence of nondeterministic world generation or a Radeon FPS improvement.

## Evidence

Study: `D:/Dex/Temp/coldfront-seed3-strip-4c2f518/out/strip-diagnosis/`.

- First failed attempt: `attempts/2026-10-14T00-23-15.409Z-b0e7a812/` (zero voxel queries).
- Successful first hits: `attempts/2026-10-14T00-26-17.588Z-234c3fdf/` (2,191 lookups / 2,061 unique final samples, 3.192 s wrapper).
- Semantic comparison: `semantic-plan-comparison.json`.
- Failed owner check: `owner-attempts/2026-10-14T00-33-21.093Z-c2cbdf91/` (zero voxel queries).
- Successful local owner probe: `owner-attempts/2026-10-14T00-37-48.333Z-83a3aa6c/` (723 pairs, two columns, 3.491 s wrapper).
- Frozen image and original capture receipt remain under `D:/Dex/Temp/coldfront-seed23-e902690/out/postcards/runs/main-s3-production-normal-676c1dee2fe6e97007d306b08f8efeb1381c9d9510f701f4558f22721f2116cb-diagnostic-1791934903641/`.
