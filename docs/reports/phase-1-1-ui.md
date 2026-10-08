# Phase 1.1 interface acceptance

All original UI review findings are closed. The independent reviewer passed the final twelve focus-outline images. The integrated build reports **155 tests passing**, passing checks/build, and **ui:lint --complete: 53 gallery states, no missing current rows**. These integration results are reported by the coordinator; the image and browser evidence below was captured and inspected in the UI lane.

[Open the gallery](https://dex.place/coldfront/?gallery) on the playable preview. The contact sheet is prepared for `docs/postcards/wip/ui.jpg`:

![Phase 1.1 interface contact sheet](../postcards/wip/ui.jpg)

The sheet is a headless Chromium screenshot of an HTML grid containing five existing PNG excerpts: 1280×720 JPEG, quality 85, 61,188 bytes. Native-scale crops preserve readable words and complete focus rings; no copy was added. Its source hashes and opened-image receipt are `out/ui/ui-contact-sheet-receipt.json`.

## A7 result by screen

**1** exact current rows/words; **2** no accidental clipping, wrapping or overlap; **3** aligned edges/gaps/heights; **4** component and focus/disabled presentation; **5** prescribed layout/order; **6** blocking-screen Tab/Esc behavior. “N/A” means the subcheck has no applicable action, not an untested required action.

| Screen/group | 1 | 2 | 3 | 4 | 5 | 6 and browser evidence |
|---|---|---|---|---|---|---|
| Title | Pass | Pass | Pass | Pass | Pass | Tab pass; Esc is not a title-dismiss action |
| Loading | Pass | Pass | Pass | Pass | Pass | Applicable Tab pass; Esc N/A |
| Creative HUD | Pass | Pass | Pass | Pass | Pass | N/A |
| Menu | Pass | Pass | Pass | Pass | Pass | Tab/Shift+Tab pass; tooltip → menu dismissal pass |
| Tools | Pass | Pass | Pass | Pass | Pass | Nonblocking; focus release and world-click closure pass |
| Debug | Pass | Pass | Pass | Pass | Pass | N/A |
| Block palette | Pass | Pass | Pass | Pass | Pass | Tab/Shift+Tab pass; tooltip → Search release → palette dismissal; empty Search release → palette dismissal |
| System blockers | Pass | Pass | Pass | Pass | Pass | No operable controls; Esc N/A |
| System banners | Pass | Pass | Pass | Pass | Pass | N/A |
| Toasts | Pass | Pass | Pass | Pass | Pass | N/A; palette variant retains its blocking-key pass |
| Clear confirmation | Pass | Pass | Pass | Pass | Pass | Tab/Shift+Tab pass; Esc removes the modal |
| Fixed words | Pass | Pass | Pass | Pass | Pass | N/A |
| Seed tooltip | Pass | Pass | Pass | Pass | Pass | Real hover and Tab-focus pass |
| Random-seed tooltip | Pass | Pass | Pass | Pass | Pass | Real hover and Tab-focus pass |
| Licences tooltip | Pass | Pass | Pass | Pass | Pass | Real hover/Tab-focus; tooltip → menu dismissal pass |
| Postcard tooltip | Pass | Pass | Pass | Pass | Pass | Real hover/Tab-focus; complete external focus ring pass |
| Block-name tooltip | Pass | Pass | Pass | Pass | Pass | Real hover/Tab-focus; complete Slot focus ring and layered Esc pass |
| Components | Pass | Pass | Pass | Pass | Pass | Forced gallery states; blocking-key rule N/A |

All listed PNGs below were opened with the image viewer at 1280×720, 1920×1080 and 1280×720 with 150% interface scale. Paths are relative to `out/ui/`. End views inspect native scroll areas; Field crops expose the actual caret and endpoint glyphs.

### Title

Visible words read: Coldfront; Seed; Play. Typical draft `1`, empty draft, and exact long draft `123456789012345678901234567890`. Home shows the first `1` and caret; End shows the final `0` and caret.

- `title-1280.png`, `title-1920.png`, `title-150.png`.
- `title-empty-1280.png`, `title-empty-1920.png`, `title-empty-150.png`.
- `title-long-1280.png`, `title-long-1920.png`, `title-long-150.png`, `title-long-1280-field.png`, `title-long-1920-field.png`, `title-long-150-field.png`.
- `title-long-home-1280.png`, `title-long-home-1920.png`, `title-long-home-150.png`, `title-long-home-1280-field.png`, `title-long-home-1920-field.png`, `title-long-home-150-field.png`.
- `title-long-end-1280.png`, `title-long-end-1920.png`, `title-long-end-150.png`, `title-long-end-1280-field.png`, `title-long-end-1920-field.png`, `title-long-end-150-field.png`.

### Loading

Visible words read: Building terrain; The world failed to load; Try again. No percentage or invented progress text.

- `loading-start-1280.png`, `loading-start-1920.png`, `loading-start-150.png`.
- `loading-1280.png`, `loading-1920.png`, `loading-150.png`.
- `loading-ready-1280.png`, `loading-ready-1920.png`, `loading-ready-150.png`.
- `loading-failed-1280.png`, `loading-failed-1920.png`, `loading-failed-150.png`.

### Creative HUD

Visible words read: Deep stone in the held-name state; nine block slots. Normal and hidden HUD states add no words.

- `hud-1280.png`, `hud-1920.png`, `hud-150.png`.
- `hud-name-1280.png`, `hud-name-1920.png`, `hud-name-150.png`.
- `hud-hidden-1280.png`, `hud-hidden-1920.png`, `hud-hidden-150.png`.

### Menu

Visible words read: Resume; Quit to title; Licences.

- `menu-1280.png`, `menu-1920.png`, `menu-150.png`.

### Tools

Visible words read: Tools; Time of day; Clock runs; Fog; Shadows; Chunk borders; Wireframe; Fly; Fly speed; Postcard mode; Interface gallery; Clear my edits; 12.0 h / 24.0 h; ×1 / ×16.

- `tools-1280.png`, `tools-1920.png`, `tools-150.png`, `tools-1280-end.png`, `tools-1920-end.png`, `tools-150-end.png`.
- `tools-on-1280.png`, `tools-on-1920.png`, `tools-on-150.png`, `tools-on-1280-end.png`, `tools-on-1920-end.png`, `tools-on-150-end.png`.

### Debug

Visible words read: XYZ; Facing; Chunk; Light; FPS; Draws; Triangles; Memory; Queue; Seed; Build. Typical: −256.1 24.5 312.8; NW 55.0; -9 0 9; 15; 60 19.7 ms; 82; 84.9k; 9.0 MB; 12 3 7; 1; 0.1.0 eced20f. Largest fixture: −22528.0 −1536.0 22527.0; NW 85.0; -704 -48 703; 15 15 15 15; 144 99999.9 ms; 1.5k; 4M; 1536.0 MB; 999 999 999; 4294967295; 0.1.0 ffffffffffffffffffffffffffffffffffffffff.

- `debug-1280.png`, `debug-1920.png`, `debug-150.png`.
- `debug-largest-1280.png`, `debug-largest-1920.png`, `debug-largest-150.png`.

### Block palette

Visible words read: Blocks; Search. Entered queries `stone` and `zzzz`; nine blocks, three stone matches, or empty results. No empty-state filler.

- `palette-1280.png`, `palette-1920.png`, `palette-150.png`, `palette-1280-end.png`, `palette-1920-end.png`, `palette-150-end.png`.
- `palette-filtered-1280.png`, `palette-filtered-1920.png`, `palette-filtered-150.png`, `palette-filtered-1280-end.png`, `palette-filtered-1920-end.png`, `palette-filtered-150-end.png`.
- `palette-empty-1280.png`, `palette-empty-1920.png`, `palette-empty-150.png`, `palette-empty-1280-end.png`, `palette-empty-1920-end.png`, `palette-empty-150-end.png`.

### System blockers

Visible words read: This browser can't start WebGL2 · turn on hardware acceleration, then reload; Make the window larger to play.

- `system-nogl-1280.png`, `system-nogl-1920.png`, `system-nogl-150.png`.
- `system-small-1280.png`, `system-small-1920.png`, `system-small-150.png`.

### System banners

Visible words read: This browser is blocking saved data · your edits won't be kept; Graphics were reset · rebuilding the world; A new version is ready; Reload.

- `system-storage-1280.png`, `system-storage-1920.png`, `system-storage-150.png`.
- `system-context-1280.png`, `system-context-1920.png`, `system-context-150.png`.
- `system-update-1280.png`, `system-update-1920.png`, `system-update-150.png`.

### Toasts

Visible words read: Screenshot saved; Fly speed ×16; Windowed · sprint by double-tapping a movement key. Coexistence fixtures additionally show Deep stone, or Blocks and Search.

- `toast-shot-1280.png`, `toast-shot-1920.png`, `toast-shot-150.png`.
- `toast-fly-1280.png`, `toast-fly-1920.png`, `toast-fly-150.png`.
- `toast-windowed-1280.png`, `toast-windowed-1920.png`, `toast-windowed-150.png`.
- `toast-held-name-1280.png`, `toast-held-name-1920.png`, `toast-held-name-150.png`.
- `toast-palette-1280.png`, `toast-palette-1920.png`, `toast-palette-150.png`, `toast-palette-1280-end.png`, `toast-palette-1920-end.png`, `toast-palette-150-end.png`.

### Clear confirmation

Visible words read: Clear your edits in this seed?; Every block you placed or broke goes back; Clear; Cancel.

- `confirm-clear-1280.png`, `confirm-clear-1920.png`, `confirm-clear-150.png`.

### Fixed words

Visible words read: 12 h; 16.7 ms; 9 MB; ×16; N NE E SE S SW W NW; Enter; Esc.

- `fixed-words-1280.png`, `fixed-words-1920.png`, `fixed-words-150.png`.

### Seed tooltip

Visible words read: The number the world grows from · same seed, same world.

- `tooltip-seed-hover-1280.png`, `tooltip-seed-hover-1920.png`, `tooltip-seed-hover-150.png`.
- `tooltip-seed-focus-1280.png`, `tooltip-seed-focus-1920.png`, `tooltip-seed-focus-150.png`.

### Random-seed tooltip

Visible words read: Random seed.

- `tooltip-random-hover-1280.png`, `tooltip-random-hover-1920.png`, `tooltip-random-hover-150.png`.
- `tooltip-random-focus-1280.png`, `tooltip-random-focus-1920.png`, `tooltip-random-focus-150.png`.

### Licences tooltip

Visible words read: The open-source code this game uses.

- `tooltip-licences-hover-1280.png`, `tooltip-licences-hover-1920.png`, `tooltip-licences-hover-150.png`.
- `tooltip-licences-focus-1280.png`, `tooltip-licences-focus-1920.png`, `tooltip-licences-focus-150.png`.

### Postcard tooltip

Visible words read: Hides the interface and waits until the view has fully loaded.

- `tooltip-postcard-hover-1280.png`, `tooltip-postcard-hover-1920.png`, `tooltip-postcard-hover-150.png`, `tooltip-postcard-hover-1280-end.png`, `tooltip-postcard-hover-1920-end.png`, `tooltip-postcard-hover-150-end.png`.
- `tooltip-postcard-focus-1280.png`, `tooltip-postcard-focus-1920.png`, `tooltip-postcard-focus-150.png`, `tooltip-postcard-focus-1280-end.png`, `tooltip-postcard-focus-1920-end.png`, `tooltip-postcard-focus-150-end.png`.

### Block-name tooltip

Visible words read: Deep stone.

- `tooltip-block-hover-1280.png`, `tooltip-block-hover-1920.png`, `tooltip-block-hover-150.png`, `tooltip-block-hover-1280-end.png`, `tooltip-block-hover-1920-end.png`, `tooltip-block-hover-150-end.png`.
- `tooltip-block-focus-1280.png`, `tooltip-block-focus-1920.png`, `tooltip-block-focus-150.png`, `tooltip-block-focus-1280-end.png`, `tooltip-block-focus-1920-end.png`, `tooltip-block-focus-150-end.png`.

### Components

Visible words read: Play; Seed; Fog; Time of day; 12.0 h; Enter; Esc; FPS; 60 18.3 ms; XYZ; −256.1 22.3 24.5; Facing; NW 55; Fly speed; ×4; A new version is ready; Reload; Clear my edits; Forgets every block placed or broken in this seed; Fly speed ×8. Added matrices include 0.0 h, 24.0 h and Seed 4294967295. Slot/Icon matrices show icons without invented state captions.

- `primitive-controls-1280.png`, `primitive-controls-1920.png`, `primitive-controls-150.png`.
- `primitive-readouts-1280.png`, `primitive-readouts-1920.png`, `primitive-readouts-150.png`.
- `primitive-overlays-1280.png`, `primitive-overlays-1920.png`, `primitive-overlays-150.png`.
- `matrix-field-1280.png`, `matrix-field-1920.png`, `matrix-field-150.png`.
- `matrix-toggle-1280.png`, `matrix-toggle-1920.png`, `matrix-toggle-150.png`.
- `matrix-slider-1280.png`, `matrix-slider-1920.png`, `matrix-slider-150.png`.
- `matrix-slot-1280.png`, `matrix-slot-1920.png`, `matrix-slot-150.png`.
- `matrix-icon-1280.png`, `matrix-icon-1920.png`, `matrix-icon-150.png`.
- `matrix-readouts-1280.png`, `matrix-readouts-1920.png`, `matrix-readouts-150.png`.

## World-drawn HUD evidence

The reachable outline, placement ghost and occluded avatar silhouette use actual engine images: `world-outline-ghost.jpg` and `world-silhouette.jpg`, packaged under `packages/client/public/fixtures/ui/`. The engine author and independent reviewer opened the repaired final JPEGs. Their telemetry/run receipts and unchanged source hashes are checked before the gallery credits `hud.outline`, `hud.ghost` and `hud.silhouette`. The coordinator integrated that proof and closed current-row coverage. Those visual rows add no UI words. Applicable A7 1–5 pass under that separate engine/reviewer evidence; A7.6 is N/A. The UI fixture port does not render or simulate their gameplay.

## Behavior and evidence boundaries

The real Chromium gallery runs verified loopback COOP/COEP headers and `crossOriginIsolated`, exact drawn/accessibility strings, clipping/overlap, tooltip proximity, complete focus-outline containment, Tab/Shift+Tab and explicit Escape before/after/outcome records. Hostile probes reject unlisted text, accidental wrapping and clipped text/focus rings. Actual UI events exercise digits-only/random seed input, Play-to-loading, the 1024×600 cutoff, F1/F3/F4, tool toggles, slider double-click reset, Tools focus release, palette filtering/empty results/number assignment, Resume and Cancel.

These gallery interactions use declared fixture data and a fixture port. They establish UI events and presentation, not world generation, measured performance, real edit persistence, fullscreen/keyboard-lock success, actual context-loss recovery or F2 capture success. Those claims belong to the production/engine acceptance records. The coordinator separately reports the production composition's twelve-step acceptance pass.

The five opened motion strips are `tools-strip.png`, `confirm-clear-strip.png`, `toast-windowed-strip.png`, `hud-name-strip.png` and `primitive-overlays-strip.png`. They inspect the specified CSS animation times; they do not stand in for gameplay playback.

## Decisions and preserved review history

- **Decision 100:** exact Tooltip explanations may wrap naturally within the unchanged 280px/fs13 tokens. Other labels/readouts retain strict wrapping checks.
- **Decision 101:** a Field may horizontally edit an unbounded draft. Home/End show complete endpoint characters/carets; the exact 30-digit value survives both actions and remains separate from its normalized uint32 engine seed. The controller retains the raw draft through Play/return; composition owns persisted restoration.
- Toasts measure 16 CSS pixels above the visible hotbar, held name or palette (24 physical pixels at 150%).
- The repaired Slot/Postcard focus rings have real scroll-viewport clearance for the 1px steel outline plus 2px offset. Panel dimensions and content alignment remain unchanged.

The original clipping, spacing, tooltip-origin and focus failures remain in `out/ui/review-1/`, `out/ui/review-2-focus-clipping/` and the named failure receipts. Accepted evidence is indexed by `screens-reviewed.json`, `shots-behavior-final.json`, `review-repair.json`, `shots-review-escape-stack-pass.json`, and the final `focus-repair.json` / `shots-focus-containment-pass.json`. The last pair supersedes the two focus states in the earlier aggregate. The independent reviewer has now accepted these final replacements.
