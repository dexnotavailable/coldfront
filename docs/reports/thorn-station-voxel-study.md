# Thorn station and voxel comparison

The fixed diagnostic supports one-metre voxel stepping in seven sampled directions. It does **not** establish the sampler's station approximation as the cause of the photographed comb-like ridges. No terrain correction or broader search follows this result.

This is one preserved historical main sweep, owner 10264208, over arc distance 32–64 m. Its sampler, frame, polygon and shape source still match current code. The saved branch count is not current-world evidence. The earlier segment-culling check remains closed; this probe leaves culling, roughness, radius, twist, frames and all parameters unchanged.

## Fixed method

The sampler chooses a station using the segment's endpoint-radius slope, then evaluates the changing frame, radius, twist and original noise at that station. For a straight fixed-frame segment with linear radius, polygonality alone does not invalidate that approximation. The test therefore measures the actual saved sweep instead of assuming a defect.

Before evaluation, the helper writes and hashes 1,290 rays: 129 quarter-metre arc stations and ten facet/vertex directions. Each ray has 33 unsnapped radial samples across a four-metre interval, giving 42,570 continuous coordinates. Exact grid-plane intervals identify the corresponding raw one-metre voxel centres. These are sampled continuous brackets, not certified unique analytic roots; voxel occupancy is main-only, without ground unions, cleanup, other thorns or production meshing.

At every continuous point, a reversible instrumented copy must match the imported production sampler exactly, including its complete mutable workspace and arithmetic order. For each eligible ray, 65 fixed positions along the same winning segment seek a lower field value; an additional frozen point 0.25 m farther outward tests whether the difference changes occupancy. These alternatives retain the original noise and are witnesses, not a global-minimum oracle.

The plan defines a repeated event before execution: at least 0.25 m inward prominence against neighbours one metre before/after, merged adjacent events, and three consecutive events spaced 1–8 m apart. Missing or ambiguous crossings break sequences. Voxel-only inference requires all rays in that direction to be valid in both representations. The hard cap is 187,050 top-level sampler/helper calls, followed by a stop.

## Result

The single run exits zero in **5.985 s**, with all source, immutability, finite-value and counter guards passing.

| Measurement | Result |
|---|---:|
| Exact production/instrumented comparisons | 42,570 / 42,570 |
| Valid sampled continuous rays | 1,290 / 1,290 |
| Valid raw voxel rays | 1,284 / 1,290 |
| Raw voxel rays with multiple/reverse crossings | 6 |
| Declared raw voxel intervals | 8,957; maximum 9 per ray |
| Deduplicated voxel centres evaluated | 2,361 |
| Total top-level calls | 173,931 / 187,050 cap |
| Outer occupancy witnesses from alternate stations | 133 |
| Qualifying continuous inward events | 0 |
| Merged raw voxel inward events | 79 |
| Directions supporting the predeclared voxel-stepping result | 0, 1, 2, 5, 6, 7, 8 |

Directions 3 and 9 have incomplete voxel-crossing data and are excluded from voxel-only inference. Direction 4 has no qualifying pattern. The 133 alternate-station occupancy witnesses do not satisfy the repeated continuous-ridge criterion; they do not authorize a station-selection fix. Moving the station also moves the original noise sample, so a lower value alone cannot identify a geometric error.

Independent Astra review finds no inconsistency. All seven artifact hashes/sizes, seventy input bindings, pinned Node, the single execution claim, saved minima, witnesses, crossings and event classifications reconcile. All 133 material witnesses have a lower signed roughness contribution at the alternate station at the first air point, with changes from −0.83547 to −0.11179; the improvement cannot be attributed to geometry alone. Successful complete workspace arrays are not serialized: their equality is established by the hash-bound runtime guard and pass count, not by an independent reconstruction from saved arrays.

This result applies to the declared strip and thresholds. It does not locate the photographed ribs in arc coordinates, prove their global cause, certify current-world branches or production meshes, or establish terrain quality. The one-run claim is retained. No different directions, finer sampling, wider strip, noise ablation, source edit or render follows.

## Evidence and continuation

- Proposal: canonical `out/phase13/thorn-field-next.md` and `.json`.
- Owned checkout: `D:/Dex/Temp/coldfront-thorn-station-72483b2`.
- Frozen packet: `out/thorn-station/READY.md`, `input.json`, `derivation.json` and `SCHEMA.json`; input SHA-256 `4d2264ae25ede7122b69d3cd23dcb8c1102b5e9d4bae440a1f4e0d13d256ef4e`.
- Exact run: `out/thorn-station/runs/2026-10-15T08-05-02.635Z-2970370e/`. Complete declarations, continuous traces, voxel values, station witnesses, crossings and events are preserved.
- Root syntax/type checks, execution log, timing and artifact-hash readback: `out/thorn-station-root/`.
- Independent preflight and saved-result review: `out/thorn-station-review/`.

No game source, generated world, renderer, camera, save identity or live build changes. The accepted 851-test runtime, atlas/slice evidence and generation-676 benchmark remain applicable. Phase 1.3 and mandatory HELL acceptance remain unfinished; both failed control grades and all parked studies remain preserved. This finite station hypothesis is parked for this strip.
