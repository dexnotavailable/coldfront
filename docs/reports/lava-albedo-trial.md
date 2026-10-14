# Lava crust albedo trial

**Rejected at the near-view gate; no runtime change is integrated.** The candidate removes the repeated small orange hatch marks, but also removes useful crust detail. Root and a fresh image-only Astra reviewer prefer the baseline at all four sampled times. The proposed full-caldera comparison is not run, following the trial's stopping rule.

The isolated material replaces only Normal Lava's existing texture lookup with the selected layer's coarsest mip, derived from the texture width. It updates the lava program-cache suffix. The world-space animated cracks, their derivative filter and 29 emission gains, lighting, geometry, cameras and other materials remain unchanged. The change uses no additional source-level texture sample or noise function; GPU speed is not measured.

## Actual evidence

Six existing render-contract tests, client TypeScript and targeted formatting pass. The fresh baseline/candidate fixture runs serially in **23.839 seconds**. Each arm uses the same 16×16 edited test-world pool, 2,304 saved edits, 192 lava cells, 24-metre camera, 17.25 world time, 148 loaded chunks and zero queued work. It captures Normal at 0, 250, 1,000 and 4,000 ms, then Clay and Features at zero.

All six pairs have matching camera, edits, generation, time and readiness counts. Normal pixels differ as intended. Clay and Features match in both PNG bytes and raw RGBA. Features is a zero-feature-ID synthetic field and appears uniformly grey; that control does not establish material quality or nonzero-feature coverage.

Root opens all twelve originals. A fresh reviewer receives opaque A/B copies, opens all twelve at original detail and prefers B at every Normal time; the preserved private map identifies B as baseline. Both reviews find that the candidate's smoother plate interiors make the unchanged bright polygon network more diagrammatic or plastic. The baseline's repeated interior marks remain an issue, but this change is not a net improvement. Four frozen samples do not prove continuous motion.

Both arms record zero application errors, external requests, bad responses or cleanup errors. Each retains four ReadPixels warnings. Game disposal, browser context, browser and server closure pass, with zero workers remaining. Root's process census finds no matching remaining COLDFRONT Node or headless Chromium process. Both 176-file source snapshots allow exactly one material-file difference.

## Boundaries and retained files

Candidate: `D:/Dex/Temp/coldfront-lava-albedo-08629f4`; baseline: `D:/Dex/Temp/coldfront-clean-phase13-f266d94`. Candidate material SHA256 is `2c14438bc804d626509811cee3a077e9e25195050550e00f193264f53c2f0ca2`; the unchanged production material remains `f1aa43a5d35380fc8afc7e70ff15c784479d93528814c2f1e5b018bda29ff03a`.

- Execution: candidate `out/lava-albedo/runs/2026-10-14T07-19-32.527Z-TkXmmO/`, with summary, arm receipts, twelve PNGs and twelve RGBA files.
- Checks: `out/lava-albedo/source-checks.json`, render-contract log and `near-exit-01.json`.
- Decisions: `root-near-review.json`, `independent-near-pixels.md/json` and `pixel-review-private-map.json` in the same packet.
- Source proposal: canonical `out/phase13/lava-surface-next-review.md/json`.

The candidate and its sealed evidence remain isolated. No mip, cell-scale, emission, camera or seed search follows this rejected variant. No full-scene benefit, formal terrain score, FPS improvement, phase completion or publication is claimed. Generation 676, its atlas/slice and benchmark evidence, and the live `36f85b2` build remain unchanged.
