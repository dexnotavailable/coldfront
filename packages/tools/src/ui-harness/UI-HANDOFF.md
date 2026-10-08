# Phase 1.1 UI handoff

Source: `D:\Dex\Temp\coldfront-ui-foundation`. Canonical integration, commits, publishing and the real engine belong to the coordinator. No shared source was authored here; the coordinator refreshed 27 accepted `packages/shared` files before UI screen capture.

## Production exports

- `ui/controller.ts`: `createUiController(realPort, realHost, { manageInputScope: false })` for the production bootstrap. The standalone gallery leaves that option at its default. The controller retains menu-only pause ownership.
- `ui/GameUi.tsx`: `<GameUi controller={ui} externalInput />` disables its global shell keyboard/world-pointer handlers in production. Scoped blocking-screen controls still handle their own keyboard interaction.
- `ui/components/TooltipHost.tsx`: `dismissTooltip()` clears a pending/shown tooltip and returns true only if it had been shown, for the bootstrap's first Esc layer.
- `contracts/game-ui.ts`: readonly data, semantic commands and the port. `UiHost.enterFullscreen()` is distinct from `toggleFullscreen()`; Play/Resume use entry, F11 toggles.
- To leave a focused text field by Esc, blur it then focus its closest `[data-blocking]` root. That root has `tabIndex=-1`, so later keys reach the palette's scoped handler. Palette number keys require no modifiers; the field keeps ordinary typing priority.
- CSS imports: `tokens.css`, `components/components.css`, `screens/screens.css`; gallery additionally imports `gallery/gallery.css`. Fonts are local npm imports in the supplied harness entry.

`tools/src/ui-harness/sample.ts` is an explicit fixture adapter and cannot capture a game world. It must never be used on the production play route. The gallery remains a shipped separate route, with declared sample data. Its nine cube thumbnails and fixed F3 values are fixture content, not texture acceptance or measured performance.

## Gates and current proof

The strings/types, exact tokens, formatter, primitives, SSR registry, AST/CSS lint and browser capture/audit existed before the first game screen. `PRIMITIVE-GATE.md` names all nine images opened before screens. Root decision 100 resolved the real tooltip-width contradiction without changing strings or tokens; the original failed receipt remains available.

The screen inventory is 27 registered states, each captured at 1280x720, 1920x1080 and 1280x720 with 150% UI scale. **All 81 final screenshots and the 15 scroll-end screenshots were opened using `view_image`.** `out/ui/screens-reviewed.json` gives exact paths, drawn words, key traces and per-run provenance. The captures passed real loopback isolation/header checks, unknown-text checks, clipping checks, visible-control overlap checks and Tab/Esc checks after the bounded repairs below.

| Screen family | Opened filename prefixes in `out/ui`, each with `-1280.png`, `-1920.png`, `-150.png` | Words read / presentation | A7 1–6 |
|---|---|---|---|
| Title | `title`, `title-empty`, `title-long` | Coldfront, Seed, Play; Lucide random icon; centered column and one primary action. Long editable seed uses native horizontal input scrolling. | pass / pass / pass / pass / pass / Tab pass; Esc N/A |
| Loading | `loading-start`, `loading`, `loading-ready`, `loading-failed` | Building terrain; the error state reads The world failed to load and Try again. Progress bar has no percentage or filler. | pass / pass / pass / pass / pass / applicable Tab pass; Esc N/A |
| Creative HUD | `hud`, `hud-name`, `hud-hidden` | Nine slots; Deep stone in the held-name sample; hidden state contains no HUD. | **partial: three engine-drawn rows remain** / pass / pass / pass / pass / N/A |
| Menu | `menu` | Resume, Quit to title, Licences; no title, restrained world dim. | pass / pass / pass / pass / pass / Tab, Shift+Tab, Esc pass |
| Tools | `tools`, `tools-on`; also each `-end.png` | Tools, Time of day, Clock runs, Fog, Shadows, Chunk borders, Wireframe, Fly, Fly speed, Postcard mode, Interface gallery, Clear my edits. Toggle states and x1/x16 samples match fixtures. | pass / pass within native scroll viewport / pass / pass / pass / nonblocking; global key behavior separately exercised |
| Debug | `debug` | XYZ, Facing, Chunk, Light, FPS, Draws, Triangles, Memory, Queue, Seed, Build, with declared sample values. Separate small strips, aligned tabular values. | pass / pass / pass / pass / pass / N/A |
| Palette | `palette`, `palette-filtered`, `palette-empty`; also each `-end.png` | Blocks, Search (or its entered query); nine samples, three stone matches, or an intentionally empty result. | pass / pass / pass / pass / pass / Tab, Shift+Tab, field-Esc then close-Esc pass |
| Blocking system states | `system-nogl`, `system-small` | Exact WebGL2-unavailable sentence; Make the window larger to play. No extra controls. | pass / pass / pass / pass / pass / no operable controls |
| System banners | `system-storage`, `system-context`, `system-update` | Exact saved-data and rebuilding messages; A new version is ready with Reload. | pass / pass / pass / pass / pass / N/A |
| Toasts | `toast-shot`, `toast-fly`, `toast-windowed` | Screenshot saved; Fly speed x16; exact Windowed sprint sentence. Positioned above the HUD without overlap. | pass / pass / pass / pass / pass / N/A |
| Confirmation | `confirm-clear` | Clear your edits in this seed? / Every block you placed or broke goes back / Clear / Cancel. | pass / pass / pass / pass / pass / Tab, Shift+Tab, Esc pass |
| Fixed words | `fixed-words` | h, ms, MB, x16; N NE E SE S SW W NW; Enter and Esc keycaps. | pass / pass / pass / pass / pass / N/A |

The Tools panel keeps the bottom-centered hotbar clear at 150%. Its scroll viewport naturally hides offscreen rows; initial and end captures together show every control. The audit intersects control rectangles with scroll clips before comparing them, and still rejects actually clipped text outside a scroll container. This fixes a false overlap result for a fully scrolled-out control, without hiding a drawn overlap.

## Preserved failures and bounded repairs

- `shots-recovery-helper-failure.json`: tsx's named-function helper was missing when Playwright serialized the audit function. A test-only helper now preserves that function-name behavior without changing assertions.
- `shots-primitives-initial.json`: exact Tooltip explanation wrapped under the original impossible one-line rule. Root corrected A2/decision100; a hostile browser probe proves only actual Tooltips receive the wrapping exception.
- `shots-screens-initial.json`: the initial 150% Tools/hotbar overlap and key-verifier failures.
- `shots-screens-keys-repaired.json`: keyboard checks now verify actual DOM closure after respecting Tooltip/field priority and waiting for the state update, instead of treating a not-yet-updated instrumentation boolean as closure.
- `shots-tools-scroll-audit-failure.json`: the remaining offscreen-control geometry false positive.
- `shots-tools-pass.json`: all six repaired Tools profiles pass.

`screens-reviewed.json` combines only the latest matching fixture/profile receipt; no broad rerender was used to erase the original failures.

## Integration limits

`ui:lint` reports 66/69 visible current rows covered. `--complete` deliberately fails for `hud.outline`, `hud.silhouette`, `hud.ghost` until real engine fixture pixels and receipts exist. The 22 binding rows await the actual engine/input registry; no early rebinding screen was invented. Gallery screenshots do not establish terrain, gameplay, real WebGL loss/rebuild, IndexedDB, fullscreen/keyboard lock or F2 world-capture success.

Final light validation: TypeScript and recommended Biome checks are clean, 24 UI tests pass, Node catalogue/AST/CSS/SSR lint passes, and the UI harness production build passes. No root lint rule was suppressed. The tests include rejection of unknown/future strings, stale generation, raw colors/screen pixels and missing real-world proof; source/asset hashes protect the world rows.

Final browser interaction validation is `out/ui/shots-behavior-final.json`: 27 renewed profiles, all passing. It exercises actual UI events for digits-only/random seed and Play-to-loading; the exact 1024x600 viewport boundary; F1/F3/F4; live tool toggles and a quarter-track slider double-click reset; Tools releasing control focus and closing on a world click; palette filtering, empty state and hovered-block 1–9 assignment; Resume and Cancel. All renewed captures and scroll-end images were reopened. These tests use the declared fixture port, so they do not claim real fullscreen, world generation or edit persistence.

Five motion strips were captured at explicit CSS animation times and opened: `out/ui/tools-strip.png` (0/50/100/150/200 ms), `confirm-clear-strip.png` (0/50/100/150 ms), `toast-windowed-strip.png` (entry, 2-second hold, 300 ms exit), `hud-name-strip.png` (2-second hold, 500 ms fade), and `primitive-overlays-strip.png` (100 ms Tooltip entry). Their `strip-*.json` receipts pass. Actual pixels show the Tools panel settling without overshoot, the confirmation fading in, the toast and held name fading away at their specified times, and the tooltip explanation becoming legible. Entry/hold/exit CSS is implemented; the strips are evidence of the listed sequences, not a claim of full real-time game playback.

Engine evidence was independently opened at `D:\Dex\Temp\coldfront-engine\out\engine\drive\outline-ghost.png`, `outline-ghost-crop.png`, and `silhouette.png`: the dark reachable outline, faint textured placement cube and flat steel avatar through a wall are visible. The engine author supplied the final capture manifest after its source freeze. The coordinator populates `ui/gallery/world-evidence.json` and copies the JPEG/JSON files into `client/public/fixtures/ui` after refreshing UI source. The gallery renders those actual images; the Node gate verifies every image, telemetry and run-receipt hash, its ready/drawn/reach fields, an error-free matching driver result, and a complete unchanged engine/game/dev/shared source snapshot before crediting the three rows. Until that integration, the isolated UI tree correctly keeps those rows missing.

The final render lane was released and no headless browser remained. `out/ui/owned-files.json` is the source copy index; its `world-evidence.json` entry is deliberately the empty default that the coordinator fills only after synchronization. Do not overwrite an already populated integration manifest with the empty default during a later refresh.

Dependency pins/licenses and provisional config files are listed in `INTEGRATION.md`. Copy owned sources only; reconcile manifests through the coordinator, preserve composition-owned entry/config files, and do not copy shared files or node_modules as UI implementation.

Packaging follow-up: both final 1280x720 q85 JPEGs (`world-outline-ghost.jpg`, `world-silhouette.jpg`) were independently opened; outline/ghost and silhouette remain visible. The validator reads JPEG frame dimensions and requires explicit sharp conversion provenance (original PNG hash, encoder/version, q85, unchanged dimensions, no resize). Image, telemetry, run receipt and source checks remain intact. Private PNG originals are retained by the engine lane; only the final JPEGs and JSON proof records enter the public fixture bundle.

## Blind-review repair addendum

The first review's endpoint, toast-spacing and missing-state findings supersede the earlier blanket pass wording above. Root's decision101 now specifies native horizontal Field editing. `title-long-home` and `title-long-end` preserve the exact 30-digit draft, expose the complete first `1` and last `0` with the caret at positions 0 and 30, and retain the same value after both keys. `title-long` is the deliberate End state. Each has full images and `-field.png` crops at 1280, 1920 and 150%; all were opened. The controller preserves the raw digit draft through Play/return while deriving the uint32 engine seed separately. Composition owns persisted draft restoration and its production checks.

Toasts now belong to the actual visible bottom stack: 16 CSS pixels above the hotbar alone, above the held name when present, or above the open palette. `toast-shot`, `toast-fly`, `toast-windowed`, `toast-held-name` and `toast-palette` cover this without placeholder labels. Their three-profile receipts measure 16/16/24 physical pixels. All images and palette end images were opened.

The new `matrix-field`, `matrix-toggle`, `matrix-slider`, `matrix-slot`, `matrix-icon` and `matrix-readouts` fixtures are gallery-only. Field and Slider list rest/hover/pressed/focus/disabled/pending; Toggle, Slot and IconButton add selected. Toggle rest is off and the other states are on. Slider also covers both endpoints, Slot both empty selection states, and readouts cover the maximum uint32 seed, empty/half/full bars, keycaps and delayed Spinner. These join the original seven Button states. `debug-largest` covers world-coordinate extrema, maximum uint32 seed, large memory/triangle/queue values and a complete 40-character build hash. All 21 matrix/debug profile images were opened. No game controls or on-screen state captions were added.

Ten tooltip fixtures cover actual hover and actual Tab focus on Seed, Random seed, Licences, Postcard mode and a block name. Opening their first captures found a further real issue: Preact 11 no longer appends `px` to computed numeric style values, leaving TooltipHost at the viewport origin. Explicit computed units repair the anchor. The new browser proximity assertion records the target and tooltip rectangles and requires an 8 CSS pixel adjacent gap. The corrected 30 images and 12 applicable end images were opened. Tooltips may naturally wrap under decision100; labels and readouts retain the strict wrapping/clipping gates.

Keyboard receipts now contain explicit `Escape` steps with `before`, `after`, expected outcome and observed outcome. The menu probe opens its Licences tooltip before dismissal. Every palette state first focuses Search; non-empty palettes open a block tooltip while Search remains focused, then prove tooltip dismissal, field release and screen dismissal on separate presses. Empty palette proves field then screen. Clear confirmation proves actual modal removal. The browser gate fails if an expected layer is absent or the lower layer closes early.

`out/ui/review-repair.json` combines only the latest affected fixture/profile results and includes exact opened image paths and hashes. The initial 90-profile receipt is preserved as `shots-review-tooltip-anchor-failure.json`: its automated pass was rejected by pixel review. Original tooltip pixels remain in `review-1/tooltip-origin-failure`; earlier long-seed/toast/key evidence remains in `review-1`. `shots-review-tooltip-anchor-pass.json` and `shots-review-escape-stack-pass.json` preserve the bounded follow-ups. The fresh independent reviewer still owns acceptance of these repairs.

The Escape stack probe also exposed a runner precondition: hovering an already-hovered block after keyboard traversal does not fire a new pointerover. `shots-review-escape-stack-failure.json` retains the three rejected profiles; the runner now moves the real pointer off the control before hovering it again. `shots-review-escape-hover-pass.json` supplies those three corrected outcomes, and the aggregate stack receipt names both source runs. Final TypeScript, recommended Biome, catalogue/AST/CSS/SSR checks and the harness build pass; all 25 UI tests pass. The source refresh is 18 files listed with hashes in `out/ui/repair-changed-files.json`; the contract and provisional manifests did not change in this repair.

The engine owner subsequently repaired the world ghost/silhouette presentation in `out/engine/hud-repair` and obtained independent review. That newer manifest supersedes the earlier world-image references above. This UI worktree deliberately has no populated engine evidence; the coordinator must preserve its new populated manifest during the UI refresh. No engine/source hashes were rewritten by this lane.

## Focus-outline containment follow-up

Independent re-review closed the earlier findings and identified clipped external focus rings at the palette grid and Tools scroll boundaries. Their scroll viewports now extend by `--s-1` into the existing panel padding, with equal negative margins. The slot/control content and catalogue panel dimensions remain unchanged; the full 1px steel outline and 2px offset have real room to render. No control or outer dimension was added.

`out/ui/shots-focus-containment-pass.json` records six passing profiles for `tooltip-block-focus` and `tooltip-postcard-focus`. All twelve initial/end images were opened and show complete four-sided outlines at 1280, 1920 and 150%. The browser gate expands each visible focused control's bounds by its actual computed outline width and offset, then checks the viewport and every clipping ancestor's client box. Its hostile probe rejects a ring clipped by an exact-size overflow container and accepts it only after real padding is added. The gate runs before and after end scrolling.

The rejected originals and previous owner manifest remain in `out/ui/review-2-focus-clipping`. `out/ui/focus-repair.json` indexes the opened replacement images, hashes and source receipt. `out/ui/focus-repair-changed-files.json` is the four-file integration delta (screen CSS, browser assertions, browser runner hostile probe, this note). TypeScript, recommended Biome and UI lint pass. Independent acceptance of these final captures remains with the coordinator's reviewer. Render lane is released and the owned browser/server are closed.
