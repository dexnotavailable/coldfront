# Column candidate filtering: parked after measurement

**Do not integrate this candidate.** It removes repeated X/Z eligibility checks down a vertical column, and exact worker outputs match, but the bounded measurement does not demonstrate useful dense improvement without ordinary-case regression. The live game remains `b8bac6a`; no source or save-identity change is published from this study.

The isolated implementation stores one last-column list of original thorn indices, keyed by X/Z/spacing. Canonical order, the evaluator and per-thorn coarse caches remain unchanged. Extra retained typed payload is 4×N bytes per batch. The first focused run passes 141 tests but fails the existing deterministic numeric-index guard. Replacing exactly two asserted array reads with `Number(...)` passes source types, formatting and all 65 guard/differential tests. The guard and test expectations are unchanged; the failed run is preserved.

The actual production terrain worker runs four serial arms in AB/BA order, eight requests each: dense fresh A, its upper neighbour, repeated A, edited A, reinitialization with the edit, upper B, an ordinary control and rebuilt A after volume-cache eviction. The fixed dense address qualifies against current output with 17,486 solid cells, 15,282 open cells and 1,008 selected-feature vertices. The run completes with exit 0 in **134.383 s** and awaits all worker cleanup.

| Request group | Baseline ms | Candidate ms | Candidate difference |
|---|---:|---:|---:|
| AB dense total, seven requests | 29526.637 | 29270.289 | −0.868% |
| AB ordinary control | 666.568 | 695.066 | +4.275% |
| BA dense total, seven requests | 30079.978 | 29553.500 | −1.750% |
| BA ordinary control | 663.507 | 681.710 | +2.743% |

The two baseline dense totals differ by 1.874%, comparable to the small paired reductions. Rebuilt A is slower in both orders. These observations do not prove a general slowdown or that every improvement is noise; they fail to establish the useful gain required for integration. No extra repeat, tuning or widened cache follows this candidate. A single actual-worker CPU profile is the next discriminating performance probe.

Independent readback passes 16 checks: both 143-file source manifests, exact two-line repair, 704 cross-pair typed-buffer comparisons and 528 within-arm comparisons, scenario requirements and cleanup. The executed runner compares actual bytes and stable metadata; the independent reviewer checks the saved hashes. The small synthetic diagnostic confirms cumulative excluded-thorn bound reads fall from `[41,42,43,44]` to `[1,1,2,3]`. It does not measure production candidate-list sizes or attribute elapsed time. The worker's tracked cache counter excludes the new index buffer; equal counters are not a zero-memory-overhead claim.

Upper B has no core mesh, and the fixed edit at y48 does not promise changed light at B's y64 boundary. This is a fixed worker transport test, not browser play, a whole-region benchmark, or evidence of an FPS/Radeon fix. The four child exit-1 entries are explicit termination after each result; successful awaited cleanup and root exit 0 are recorded separately.

Preserved study: `D:/Dex/Temp/coldfront-column-candidates-b8bac6a`. Final field SHA256: `9fa830d72d36b1cb47ebc4da12d3a6edf629ce9c03cdfcb9607affd4aab56cce`; test SHA256: `7189dea0a18b8873f94f3b5a685aad2949efd4cca9cb2e88fad2f5997423d8d8`. Worker proof is under `out/column-candidates/worker-proof/`, run `2026-10-15T13-33-49.327Z-b708db72`, report SHA256 `85722fa061593cc6fa49d6677082d029d0ce2e94f335ec94691bae3dce97ecdb`. Independent review is `independent-result-review/result-review.md` and `.json`. Initial source, failed guard result and earlier unexecuted bindings remain preserved.
