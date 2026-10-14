# Thorn segment-culling check

**No difference was found in the predeclared sample set.** The segment-culling explanation for the sampled comb-like thorn joints is parked; no geometry edit, larger search or render follows this result.

The source audit first ruled out frame/station resets and missing interior radius maxima. It then identified a narrower concern: a geometric radius envelope does not automatically certify a numerical lower bound for a polygon field with signed roughness. That concern justified comparing the current sampler with the same computation without its segment early-out. It did not establish a defect in the pictured thorn.

The probe uses the hash-bound, serialized main sweep of historical owner 10264208. Its sampler, frame, polygon and shape sources still match current code exactly. Generation 676 changed branch allocation, so the historical `branchCount=0` is not claimed as current-world data. No thorn, WorldPlan or full world is regenerated.

Seven joints × five arc offsets × ten facet/vertex directions × five boundary offsets produce **1,750 declared points**, snapped to original voxel centres and deduplicated into **745 distinct points** before evaluation. The original 0.8 m roughness, frames, taper, radii, twist, noise and segment order remain unchanged.

At every point, the private instrumented copy with culling enabled matches the imported production function's value and complete workspace exactly. Disabling only the early-out then gives **745 identical values**, zero occupancy-sign differences, zero station differences and zero winning-segment differences. The saved shape and input/source bindings remain unchanged. The recorded evaluation runs from 04:17:09.501 to 04:17:09.785 UTC; this is a finite diagnostic, not a performance benchmark.

The result does not prove global bound correctness or explain every rib in the forest. It closes this particular sampled-joint hypothesis under its predeclared stop rule. The roughness-removal experiment and previous camera/branch trials remain parked. No formal HELL grade or phase acceptance changes.

Evidence: `D:/Dex/Temp/coldfront-comb-culling-a2731d1/out/comb-culling/`.

- `runs/2026-10-14T04-17-09.499Z-e3213779/`: frozen points, all samples and final result.
- `input.json`, `run.mjs`, `instrumented.ts`, `HANDOFF.md`: source-bound finite method and exact copy-reversal guard.
- `root-review.json`: independent readback of counts, hashes, values and occupancy results.
- Canonical `out/phase13/comb-continuity-review.md` and `.json`: unchanged source audit and historical provenance.
