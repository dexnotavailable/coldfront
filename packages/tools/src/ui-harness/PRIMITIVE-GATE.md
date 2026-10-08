# Pre-screen primitive gate

Completed after the 8 October 2026 PC restart; this gate preceded all game-screen source files.

`out/ui/shots-primitives-pass.json`: nine passes, no page/console errors, same-origin assets only, real loopback COOP/COEP and `crossOriginIsolated` true. The loopback server and owned browser closed. All nine images below were opened with `view_image`, then the render lane was explicitly released to the coordinator.

- `out/ui/primitive-controls-1280.png`
- `out/ui/primitive-controls-1920.png`
- `out/ui/primitive-controls-150.png`
- `out/ui/primitive-readouts-1280.png`
- `out/ui/primitive-readouts-1920.png`
- `out/ui/primitive-readouts-150.png`
- `out/ui/primitive-overlays-1280.png`
- `out/ui/primitive-overlays-1920.png`
- `out/ui/primitive-overlays-150.png`

Actual pixels: aligned plain controls on ink-1; cold-steel selection/focus/toggle/progress; compact Enter/Esc keycaps beside empty slot samples; a restrained panel of tabular readouts; an update banner and Reload; a red Clear my edits control, its exact explanation in a compact tooltip, and Fly speed ×8 at the bottom. Readout values are declared gallery samples, not measured game performance.

Checks: exact catalogue wording, no stray text, no clipped text, no unintended wrapping, no overlapping controls, same sizes and aligned edges, same appearance at 100% and 150%. Key traversal is not applicable to these unblocked primitive fixture pages; real blocking-screen traversal is tested after screens exist.

Failures retained: `out/ui/shots-recovery-helper-failure.json` records the tsx evaluation helper issue; `out/ui/shots-primitives-initial.json` records the exact clear-tooltip wrapping failure. Root decision100 corrected catalogue A2 to allow natural Tooltip wrapping while preserving wording, fs13 and width280. The audit now explicitly proves the exemption applies only to actual Tooltip elements; a generic caller-added wrapping marker fails.
