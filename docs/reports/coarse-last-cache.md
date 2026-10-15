# Reusing the last coarse terrain lookup

The selected change reuses a thorn's last coarse lookup when consecutive voxel samples request the same four-metre grid point and spacing. The compiled comparison improves the fixed cold dense request by **9.05% and 9.93%** in the two paired orders, with identical terrain, mesh and lighting bytes. It is integrated locally for the remaining release checks; it is not yet published.

The existing Map, its 4,096-entry clear policy, exact geometry calculations, feature order and diagnostic counters are unchanged. The shortcut stores five binary64 numbers per thorn per active narrow-band batch: **40 × N bytes**, plus one typed-array object's bookkeeping. The existing worker memory counter does not include this added batch payload. No approximation or candidate filtering is introduced.

## Measured result and limits

Four fresh native Node workers execute the actual compiled bundles in A/B/B/A order. Each receives the same parent-built seed-1 plan and performs the same four requests: cold dense `(312,1,0)`, upper `(312,2,0)`, ordinary `(-503,1,-327)`, then the dense repeat. There is no profiler, extra warmup, edit, replacement address or repeat of the experiment.

| Request | A/B baseline → candidate, ms | B/A baseline → candidate, ms |
|---|---:|---:|
| Cold dense | 7,762.490 → 7,059.890 | 5,665.400 → 5,102.871 |
| Upper neighbour | 1,690.681 → 1,624.286 | 1,171.933 → 1,095.688 |
| Ordinary | 800.938 → 767.647 | 539.016 → 552.267 |
| Dense repeat | 572.139 → 604.096 | 425.273 → 474.965 |

Both cold gains pass the declared 5% threshold. Ordinary changes are −4.16% and +2.46%, within the declared maximum 5% regression in each order. **Dense repeats are slower by 5.59% and 11.68%.** The cold baseline also drifts downward by 27.02% between arms. Keep these observations: the result supports the selected cold-loading target, not a universal speedup, statistical confidence claim, browser frame rate or confirmed fix for the friend's Radeon stutter.

All 16 requests return matching typed output. Independent review rehashes 704 buffer records from the saved raw bytes and makes 16 full packed-byte comparisons. All four workers exit naturally with code 0; the launcher completes in 40.122 s. The upper control contains only air, which limits what it demonstrates.

## Validation and save identity

Before integration, source/test types and **128 focused tests across five files** pass, including the deterministic guard and nine new differential cases. The reference is the original complete Map-based evaluator. Cases cover repeated and nonconsecutive keys, negative rounding and signed zero, different spacings/thorns, Infinity, rejection, actual sweeps and more than 4,096 keys with eviction/revisit. The initial formatting failure was solely array line wrapping; its original and failed log are preserved. Formatting and the candidate site build pass after that whitespace-only repair.

The integrated source passes **863 tests across 102 files** in 261.115 s. All eighteen retained travel poses pass fresh fixed-grid validation in 27.559 s; their poses and the TEST entry remain unchanged. Root and Astra inspect four refreshed HUD originals/derivatives, with 94 source bindings per case. Root also opens all six fresh atlas/slice images and verifies 428 source bindings. After promotion, focused fixture tests, `check`, complete UI lint and build pass; the final check/build take 15.481 / 2.048 s. Exact committed clean/site builds, the production journey, CI and public publication remain pending and are not inferred from these checks.

The terrain outputs match, but the existing build identity hashes generator source. This change therefore produces cache tag `b7facdfdcb615938ecfc1e693c6b7cbe16494ca1a80b2c67ef7e59689b261794`, still worldgen version 4. Earlier edits remain stored under their previous identity and are not automatically loaded into this one. No compatibility bypass or version bump hides the source change.

Preserved study: `D:/Dex/Temp/coldfront-coarse-last-b8bac6a`. Actual comparison: `out/coarse-last/compiled-proof/runs/2026-10-15T15-43-35.179Z-bd9ffe7f/receipt.json`; independent review is under `compiled-proof/independent-review/`. Source field SHA256: `cad9a1ee7bb34543a00d18eaf54e51f9417163e9715ebb34d3f6833e0c1e0543`. Candidate bundle SHA256: `50f5c0ca913826b2a027bbb2c4ded98bac27b55396374e0068121b19d65dba16`. No rerun or tuning follows this accepted bounded experiment.
