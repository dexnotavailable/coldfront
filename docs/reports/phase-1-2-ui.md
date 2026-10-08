# Phase 1.2 consolidated interface acceptance

**Pass within the UI/gallery scope.** Every current screen state was freshly regenerated and visually opened at 1280×720, 1920×1080 and 1280×720 with 150% interface scaling, including all phase 1.1 screens. No current screen is left unreviewed. This review covers **75 screen states (225 images), seven affected primitive states (21 images), and 48 endpoint/scroll views: 294 distinct canonical image paths**. Forty-two unchanged primitive images use explicitly reused prior visual evidence.

The original full run captured 96 states × three profiles. It correctly remains **failed: 287/288 profile checks passed**, with one stale palette assertion. The exact-name repair then passed all three palette profiles. The repaired six palette full/end images were reopened. Root's later Title/Tools/Map contact-sheet run passed nine profiles; only two Title images changed hashes, and both were reopened. Together the preserved receipts cover every current profile without concealing the original failure.

Files live under `D:/Dex/Projects/coldfront/out/ui/`. Exact image, source, keyboard-file and supporting-receipt SHA256 bindings are in `phase12-ui-final.receipt.json` beside this report. The author performed saved-image review only; no browser, render, benchmark, production input or publication was launched from this verification lane.

Gallery route after publication: [COLDFRONT interface gallery](https://dex.place/coldfront/?gallery). This is the owner-controlled destination, not a claim that the locally reviewed phase 1.2 build has already been published. Root owns publication and the final [contact sheet](../postcards/wip/ui.jpg).

## A7 result

Columns **1–6** mean: exact current rows/copy; no accidental clipping/wrapping/overlap; aligned edges/gaps/heights; component/focus/disabled presentation; prescribed screen layout/order; blocking-screen Tab/Escape behavior. A nonblocking or input-free surface has no A7.6 dismissal requirement.

| Family | 1 | 2 | 3 | 4 | 5 | 6: saved real-browser behavior |
|---|---|---|---|---|---|---|
| Title | Pass | Pass | Pass | Pass | Pass | Tab: Seed → Random seed → World → Play; Title has no Escape dismissal. |
| Loading | Pass | Pass | Pass | Pass | Pass | Try again is the sole failed-state tab stop; other loading states have no controls. Escape N/A. |
| Creative HUD | Pass | Pass | Pass | Pass | Pass | Nonblocking; A7.6 N/A. |
| Menu and clear confirmation | Pass | Pass | Pass | Pass | Pass | Menu: Resume → Quit to title → Licences, tooltip then screen dismissal. Confirmation: Clear → Cancel, Escape dismisses confirmation. |
| Tools | Pass | Pass | Pass | Pass | Pass | Nonblocking. Saved interaction probe covers live controls, field focus and world-click dismissal. |
| Debug | Pass | Pass | Pass | Pass | Pass | Nonblocking, no controls; A7.6 N/A. |
| Block palette | Pass | Pass | Pass | Pass | Pass | Search → registry slots. Tooltip → field release → screen dismissal; empty state starts at field release. Registry-name probe repaired and passed. |
| System blockers and banners | Pass | Pass | Pass | Pass | Pass | System blockers have no leave action; banners are nonblocking. A7.6 N/A. |
| Toasts and coexistence | Pass | Pass | Pass | Pass | Pass | Toasts are input-free; palette coexistence retains its Tab/Escape sequence. |
| Map | Pass | Pass | Pass | Pass | Pass | Close → Teleport, then tooltip → screen dismissal. Fixture pan/zoom/pin behavior; not WorldPlan/travel proof. |
| Discovery | Pass | Pass | Pass | Pass | Pass | Input-free; A7.6 N/A. |
| Hover and focus tooltips | Pass | Pass | Pass | Pass | Pass | Parent Title/Menu/Tools/Palette input ownership; tooltip has no Tab stop. Menu/Palette captured Escape dismisses tooltip before parent. |
| Fixed words | Pass | Pass | Pass | Pass | Pass | Static gallery fixture; A7.6 N/A. |
| World-dependent HUD rows | Pass | Pass | Pass | Pass | Pass | Embedded source-bound engine captures, no gallery interaction. A7.6 N/A. |
| Affected discovery primitives | Pass | Pass | Pass | Pass | Pass | Input-free; A7.6 N/A. |

All 288 original captures record cross-origin isolation. Their keyboard records contain no errors; 114 captures mark keyboard checking applicable, including blockers with no operable controls. The palette replacement also records the expected before/after DOM outcomes. These are actual browser interactions with the gallery adapter. They do not establish engine travel, worker readiness, keyboard-lock success, hardware failure recovery or persisted gameplay.

## Words and visual findings

**Title.** Coldfront; Seed; World; Kaldmark / Test world; Play. World stays between Seed and Play. Empty, main/test and open-Select states remain aligned. The 30-digit draft `123456789012345678901234567890` is retained exactly; Home shows the complete leading `1` and caret, End the complete trailing `0` and caret.

**Loading.** Building terrain; Planning the world; The world failed to load; Try again. One progress bar remains aligned at start, intermediate and complete values; planning and terrain are distinct catalogue states.

**Creative HUD.** Nine bottom-centred slots; Deep stone above the bar when selected; the hidden state contains no interface. No extra control or explanatory copy appears.

**Menu and clear confirmation.** Resume; Quit to title; Licences. Confirmation: Clear your edits in this seed? / Every block you placed or broke goes back / Clear / Cancel. Labels, modal order and complete focus outlines remain intact.

**Tools.** Tools; Go to region; Time of day; Clock runs; Fog; Shadows; Chunk borders; Wireframe; Fly; Fly speed; Postcard mode; Interface gallery; Clear my edits. Sample values 12.0 h / 24.0 h and ×1 / ×16 fit. Test world omits Go to region. The 150% panel deliberately scrolls; opened end views expose all lower controls and complete outside focus rings.

**Debug.** XYZ; Facing; Chunk; Region; Light; FPS; Draws; Triangles; Memory; Queue; Seed; Build. Region is one line: the Selva 0.64, the Sallows 0.26, the Sundered Isles 0.1. Largest fixture values, including −22528.0 / −1536.0 / 22527.0, 4294967295 and the long build identifier, remain readable.

**Block palette.** Blocks; Search; literal queries stone and zzzz. All 31 registry slots fit; stone correctly shows eight matching blocks; the empty result adds no invented message. Bricks is the last-slot tooltip. The eight exact accessible names are listed in the repair record; they are not asserted to be simultaneously visible text.

**System blockers and banners.** This browser can't start WebGL2 · turn on hardware acceleration, then reload / Make the window larger to play / This browser is blocking saved data · your edits won't be kept / Graphics were reset · rebuilding the world / A new version is ready / Reload. Each complete line fits at all three profiles.

**Toasts and coexistence.** Screenshot saved; Fly speed ×16; Windowed · sprint by double-tapping a movement key. Toasts preserve the specified 16 CSS-pixel gap above the actually visible hotbar, held name or palette. The 150% physical gap scales to 24 pixels.

**Map.** Position; Teleport; 5 km, 100 m and the fixture scale transitions; Test world for the unnamed test map. Main fit shows all 16 surface names. Historical crowded anchors separate Tasogare / the Blackwater and the Rim / the Frost, including at 150%. Panned and detailed views retain whole in-view labels without control overlap. Edge selection reaches 22527 22527 and the Frost. Off-viewport names in zoom/pan states are intentionally outside the map view.

**Discovery.** All 16 exact names and first sentences, with kanji where defined, are transcribed below. The group remains centred at 25% viewport height. No panel or extra copy. Current 1px ink glyph contours keep the white text readable on bright snow and preserve the light filled appearance on dark ground.

**Hover and focus tooltips.** The number the world grows from · same seed, same world / Random seed / The open-source code this game uses / Hides the interface and waits until the view has fully loaded / Bricks. Hover and keyboard-focus images are both opened at every profile. Seed and Postcard naturally wrap inside Tooltip; full focus outlines remain visible in both initial and end views.

**Fixed words.** 12 h; 16.7 ms; 9 MB; ×16; 999 m; 1 km; N NE E SE S SW W NW; Enter; Esc. Every shown unit/direction/keycap is legible and aligned.

**World-dependent HUD rows.** The source-bound stills visibly show a thin ink target outline and faint projected pale placement cube, and a flat steel avatar silhouette with an ink rim through a stone wall. Their gallery fit/letterboxing is intact. These are embedded engine artifacts, not new engine captures.

**Affected discovery primitives.** 白銀 / Shirogane / The Frost lingers here longest.; 茨 / Ibara and its complete long sentence; the Sundered Isles, the Rim and the Frost. Bright, dark, long-copy and no-kanji examples are intact at all profiles. Fresh saved DOM evidence asserts opacity 1, a 1px rgb(11, 13, 16) stroke and animation time inside the 300–4300 ms full hold.

### Exact discovery content read

| State | Visible name / kanji / sentence |
|---|---|
| discovery-plains | the Hearthlands / The Crown's breadbasket. |
| discovery-tundra | 白銀 / Shirogane / The Frost lingers here longest. |
| discovery-mountains | 黒鉄 / Kurogane / The Crown's mines began here. |
| discovery-desert | 黄金 / Kogane / The Crown's treasury province. |
| discovery-boneyard | the Boneyard / Where the titans fell marching on the Nadir. |
| discovery-jungle | the Selva / The Crown's pleasure gardens, gone wild. |
| discovery-swamp | the Sallows / Pilgrims walked the causeways to the shrines of the Mere. |
| discovery-lake | the Grey Mere / Fishers call the Leviathan "the Mere's mother". |
| discovery-twilight | 黄昏 / Tasogare / The Sundering tore the sky here, and the light drains into the wound. |
| discovery-hellscape | 茨 / Ibara / Where the deep's heat broke through; the thorns are the underworld's roots pushing up. |
| discovery-shardfields | 星屑 / Hoshikuzu / Where the Wellspring's breath crystallises in the open. |
| discovery-isles | the Sundered Isles / The land that fell upward. |
| discovery-nadir | the Nadir / The Crown's heart, heaved up and burned black. |
| discovery-blackwater | the Blackwater / Once the Mirror, the lake of the Crown's capital. |
| discovery-rim | the Rim / The Kaldfolk survive the Frost in halls deep in the ice. |
| discovery-frost | the Frost / Nothing lives in the whiteout beyond the Rim. |

## Preserved failure and repair

`shots-phase12-full-original.json` remains byte-identical: SHA256 `967da600de72959e5b6519ea86547b486f24c4358b249272cbe3cd244e566b73`. Its single failure was `palette/1280: Error: Palette filter did not match registry names`. The old harness expected three results for `stone`; the expanded authoritative registry correctly supplies eight: Worldstone, Stone, Deep stone, Cobblestone, Stone bricks, Limestone, Sandstone, Mossy stone.

The only source change during final acceptance is `packages/tools/src/ui-shots/interactions.ts`, from `75de63b1fbbccee43d0766453ef53e5730ac809d666c2757d4c6975c3aaa211b` to `71e1bb88c6310746fb4ce3af24c0821812c9c2df649eebc5b1b69531f6800f24`. It derives the expected ordered names from BLOCK_REGISTRY and compares the full actual aria-label array. It retains the empty `zzzz` result and hovered Digit3 assignment checks. No product strings, styles or behavior changed.

`shots-phase12-palette-repaired.json` is pass (three captures, no errors), SHA256 `19907e9f1caf5cfb355c33acdf25298cc6e0c41fbd4a538ddbb2b905f5c7c63c`. Name filtering, empty-state and assignment probes run at 1280; layout and Tab/Escape run at all three profiles. Root retained the preceding palette PNGs under `palette-before-assertion-repair/`.

The 68 source/evidence bindings recorded during the original capture were rehashed after review. All remain identical except that authorized assertion file. The receipt retains both source versions and each capture boundary.

## Exact fresh image inventory

Every filename in this table was opened with `view_image`. The three columns spell out actual files, rather than implying that one resolution stands in for another. Supplemental views follow separately.

| State | 1280×720 | 1920×1080 | 1280×720 at 150% |
|---|---|---|---|
| title | `title-1280.png` | `title-1920.png` | `title-150.png` |
| title-empty | `title-empty-1280.png` | `title-empty-1920.png` | `title-empty-150.png` |
| title-test | `title-test-1280.png` | `title-test-1920.png` | `title-test-150.png` |
| title-world-open | `title-world-open-1280.png` | `title-world-open-1920.png` | `title-world-open-150.png` |
| title-long | `title-long-1280.png` | `title-long-1920.png` | `title-long-150.png` |
| title-long-home | `title-long-home-1280.png` | `title-long-home-1920.png` | `title-long-home-150.png` |
| title-long-end | `title-long-end-1280.png` | `title-long-end-1920.png` | `title-long-end-150.png` |
| loading-start | `loading-start-1280.png` | `loading-start-1920.png` | `loading-start-150.png` |
| loading | `loading-1280.png` | `loading-1920.png` | `loading-150.png` |
| loading-ready | `loading-ready-1280.png` | `loading-ready-1920.png` | `loading-ready-150.png` |
| loading-failed | `loading-failed-1280.png` | `loading-failed-1920.png` | `loading-failed-150.png` |
| loading-plan-start | `loading-plan-start-1280.png` | `loading-plan-start-1920.png` | `loading-plan-start-150.png` |
| loading-plan | `loading-plan-1280.png` | `loading-plan-1920.png` | `loading-plan-150.png` |
| loading-plan-done | `loading-plan-done-1280.png` | `loading-plan-done-1920.png` | `loading-plan-done-150.png` |
| hud | `hud-1280.png` | `hud-1920.png` | `hud-150.png` |
| hud-name | `hud-name-1280.png` | `hud-name-1920.png` | `hud-name-150.png` |
| hud-hidden | `hud-hidden-1280.png` | `hud-hidden-1920.png` | `hud-hidden-150.png` |
| menu | `menu-1280.png` | `menu-1920.png` | `menu-150.png` |
| confirm-clear | `confirm-clear-1280.png` | `confirm-clear-1920.png` | `confirm-clear-150.png` |
| tools | `tools-1280.png` | `tools-1920.png` | `tools-150.png` |
| tools-on | `tools-on-1280.png` | `tools-on-1920.png` | `tools-on-150.png` |
| tools-test | `tools-test-1280.png` | `tools-test-1920.png` | `tools-test-150.png` |
| tools-region-open | `tools-region-open-1280.png` | `tools-region-open-1920.png` | `tools-region-open-150.png` |
| debug | `debug-1280.png` | `debug-1920.png` | `debug-150.png` |
| debug-largest | `debug-largest-1280.png` | `debug-largest-1920.png` | `debug-largest-150.png` |
| palette | `palette-1280.png` | `palette-1920.png` | `palette-150.png` |
| palette-filtered | `palette-filtered-1280.png` | `palette-filtered-1920.png` | `palette-filtered-150.png` |
| palette-empty | `palette-empty-1280.png` | `palette-empty-1920.png` | `palette-empty-150.png` |
| system-nogl | `system-nogl-1280.png` | `system-nogl-1920.png` | `system-nogl-150.png` |
| system-small | `system-small-1280.png` | `system-small-1920.png` | `system-small-150.png` |
| system-storage | `system-storage-1280.png` | `system-storage-1920.png` | `system-storage-150.png` |
| system-context | `system-context-1280.png` | `system-context-1920.png` | `system-context-150.png` |
| system-update | `system-update-1280.png` | `system-update-1920.png` | `system-update-150.png` |
| toast-shot | `toast-shot-1280.png` | `toast-shot-1920.png` | `toast-shot-150.png` |
| toast-fly | `toast-fly-1280.png` | `toast-fly-1920.png` | `toast-fly-150.png` |
| toast-windowed | `toast-windowed-1280.png` | `toast-windowed-1920.png` | `toast-windowed-150.png` |
| toast-held-name | `toast-held-name-1280.png` | `toast-held-name-1920.png` | `toast-held-name-150.png` |
| toast-palette | `toast-palette-1280.png` | `toast-palette-1920.png` | `toast-palette-150.png` |
| map-main | `map-main-1280.png` | `map-main-1920.png` | `map-main-150.png` |
| map-test | `map-test-1280.png` | `map-test-1920.png` | `map-test-150.png` |
| map-selected | `map-selected-1280.png` | `map-selected-1920.png` | `map-selected-150.png` |
| map-zoom | `map-zoom-1280.png` | `map-zoom-1920.png` | `map-zoom-150.png` |
| map-edge | `map-edge-1280.png` | `map-edge-1920.png` | `map-edge-150.png` |
| map-review | `map-review-1280.png` | `map-review-1920.png` | `map-review-150.png` |
| map-review-pan | `map-review-pan-1280.png` | `map-review-pan-1920.png` | `map-review-pan-150.png` |
| map-review-detail | `map-review-detail-1280.png` | `map-review-detail-1920.png` | `map-review-detail-150.png` |
| discovery-plains | `discovery-plains-1280.png` | `discovery-plains-1920.png` | `discovery-plains-150.png` |
| discovery-tundra | `discovery-tundra-1280.png` | `discovery-tundra-1920.png` | `discovery-tundra-150.png` |
| discovery-mountains | `discovery-mountains-1280.png` | `discovery-mountains-1920.png` | `discovery-mountains-150.png` |
| discovery-desert | `discovery-desert-1280.png` | `discovery-desert-1920.png` | `discovery-desert-150.png` |
| discovery-boneyard | `discovery-boneyard-1280.png` | `discovery-boneyard-1920.png` | `discovery-boneyard-150.png` |
| discovery-jungle | `discovery-jungle-1280.png` | `discovery-jungle-1920.png` | `discovery-jungle-150.png` |
| discovery-swamp | `discovery-swamp-1280.png` | `discovery-swamp-1920.png` | `discovery-swamp-150.png` |
| discovery-lake | `discovery-lake-1280.png` | `discovery-lake-1920.png` | `discovery-lake-150.png` |
| discovery-twilight | `discovery-twilight-1280.png` | `discovery-twilight-1920.png` | `discovery-twilight-150.png` |
| discovery-hellscape | `discovery-hellscape-1280.png` | `discovery-hellscape-1920.png` | `discovery-hellscape-150.png` |
| discovery-shardfields | `discovery-shardfields-1280.png` | `discovery-shardfields-1920.png` | `discovery-shardfields-150.png` |
| discovery-isles | `discovery-isles-1280.png` | `discovery-isles-1920.png` | `discovery-isles-150.png` |
| discovery-nadir | `discovery-nadir-1280.png` | `discovery-nadir-1920.png` | `discovery-nadir-150.png` |
| discovery-blackwater | `discovery-blackwater-1280.png` | `discovery-blackwater-1920.png` | `discovery-blackwater-150.png` |
| discovery-rim | `discovery-rim-1280.png` | `discovery-rim-1920.png` | `discovery-rim-150.png` |
| discovery-frost | `discovery-frost-1280.png` | `discovery-frost-1920.png` | `discovery-frost-150.png` |
| tooltip-seed-hover | `tooltip-seed-hover-1280.png` | `tooltip-seed-hover-1920.png` | `tooltip-seed-hover-150.png` |
| tooltip-seed-focus | `tooltip-seed-focus-1280.png` | `tooltip-seed-focus-1920.png` | `tooltip-seed-focus-150.png` |
| tooltip-random-hover | `tooltip-random-hover-1280.png` | `tooltip-random-hover-1920.png` | `tooltip-random-hover-150.png` |
| tooltip-random-focus | `tooltip-random-focus-1280.png` | `tooltip-random-focus-1920.png` | `tooltip-random-focus-150.png` |
| tooltip-licences-hover | `tooltip-licences-hover-1280.png` | `tooltip-licences-hover-1920.png` | `tooltip-licences-hover-150.png` |
| tooltip-licences-focus | `tooltip-licences-focus-1280.png` | `tooltip-licences-focus-1920.png` | `tooltip-licences-focus-150.png` |
| tooltip-postcard-hover | `tooltip-postcard-hover-1280.png` | `tooltip-postcard-hover-1920.png` | `tooltip-postcard-hover-150.png` |
| tooltip-postcard-focus | `tooltip-postcard-focus-1280.png` | `tooltip-postcard-focus-1920.png` | `tooltip-postcard-focus-150.png` |
| tooltip-block-hover | `tooltip-block-hover-1280.png` | `tooltip-block-hover-1920.png` | `tooltip-block-hover-150.png` |
| tooltip-block-focus | `tooltip-block-focus-1280.png` | `tooltip-block-focus-1920.png` | `tooltip-block-focus-150.png` |
| fixed-words | `fixed-words-1280.png` | `fixed-words-1920.png` | `fixed-words-150.png` |
| outline-ghost | `outline-ghost-1280.png` | `outline-ghost-1920.png` | `outline-ghost-150.png` |
| silhouette | `silhouette-1280.png` | `silhouette-1920.png` | `silhouette-150.png` |
| primitive-discovery-snow | `primitive-discovery-snow-1280.png` | `primitive-discovery-snow-1920.png` | `primitive-discovery-snow-150.png` |
| primitive-discovery-dark | `primitive-discovery-dark-1280.png` | `primitive-discovery-dark-1920.png` | `primitive-discovery-dark-150.png` |
| primitive-discovery-long-snow | `primitive-discovery-long-snow-1280.png` | `primitive-discovery-long-snow-1920.png` | `primitive-discovery-long-snow-150.png` |
| primitive-discovery-hellscape | `primitive-discovery-hellscape-1280.png` | `primitive-discovery-hellscape-1920.png` | `primitive-discovery-hellscape-150.png` |
| primitive-discovery-isles | `primitive-discovery-isles-1280.png` | `primitive-discovery-isles-1920.png` | `primitive-discovery-isles-150.png` |
| primitive-discovery-rim | `primitive-discovery-rim-1280.png` | `primitive-discovery-rim-1920.png` | `primitive-discovery-rim-150.png` |
| primitive-discovery-frost | `primitive-discovery-frost-1280.png` | `primitive-discovery-frost-1920.png` | `primitive-discovery-frost-150.png` |

### Supplemental images opened

- `palette-1280-end.png`
- `palette-150-end.png`
- `palette-1920-end.png`
- `palette-empty-1280-end.png`
- `palette-empty-150-end.png`
- `palette-empty-1920-end.png`
- `palette-filtered-1280-end.png`
- `palette-filtered-150-end.png`
- `palette-filtered-1920-end.png`
- `title-long-1280-field.png`
- `title-long-150-field.png`
- `title-long-1920-field.png`
- `title-long-end-1280-field.png`
- `title-long-end-150-field.png`
- `title-long-end-1920-field.png`
- `title-long-home-1280-field.png`
- `title-long-home-150-field.png`
- `title-long-home-1920-field.png`
- `title-world-open-1280-end.png`
- `title-world-open-150-end.png`
- `title-world-open-1920-end.png`
- `toast-palette-1280-end.png`
- `toast-palette-150-end.png`
- `toast-palette-1920-end.png`
- `tools-1280-end.png`
- `tools-150-end.png`
- `tools-1920-end.png`
- `tools-on-1280-end.png`
- `tools-on-150-end.png`
- `tools-on-1920-end.png`
- `tools-region-open-1280-end.png`
- `tools-region-open-150-end.png`
- `tools-region-open-1920-end.png`
- `tools-test-1280-end.png`
- `tools-test-150-end.png`
- `tools-test-1920-end.png`
- `tooltip-block-focus-1280-end.png`
- `tooltip-block-focus-150-end.png`
- `tooltip-block-focus-1920-end.png`
- `tooltip-block-hover-1280-end.png`
- `tooltip-block-hover-150-end.png`
- `tooltip-block-hover-1920-end.png`
- `tooltip-postcard-focus-1280-end.png`
- `tooltip-postcard-focus-150-end.png`
- `tooltip-postcard-focus-1920-end.png`
- `tooltip-postcard-hover-1280-end.png`
- `tooltip-postcard-hover-150-end.png`
- `tooltip-postcard-hover-1920-end.png`

## Reused evidence and boundaries

These 14 unchanged primitive states were also regenerated by the full run, but their new 42 image files were **not** independently opened in this final pass. Their earlier actual pixel reviews remain valid for the unchanged components:

| Source directory | States, each at 1280 / 1920 / 150 |
|---|---|
| `D:/Dex/Temp/coldfront-ui-foundation/out/ui/` | primitive-controls; primitive-readouts; primitive-overlays; matrix-field; matrix-toggle; matrix-slider; matrix-slot; matrix-icon; matrix-readouts |
| `D:/Dex/Temp/coldfront-phase1-2-ui/out/ui/` | matrix-select; primitive-select-world; primitive-select-region; primitive-select-world-tooltip; primitive-distance |

The receipt lists each exact reused PNG and hash. The phase 1.1 core comparison changes only removal/re-export of the old Select; the other primitive implementations are unchanged. Existing non-Card/non-Select CSS and all tokens are unchanged. The forced-state fixture and TooltipHost hashes match their prior versions. The phase 1.2 Select matches the accepted opaque-menu version. New Select controls in Title/Tools were nevertheless reviewed fresh in all profiles. Changed discovery/Card styling was never accepted through old images: all affected bright/dark/no-kanji/long-copy primitives and all 16 cards were freshly opened.

Prior phase 1.1 Tools, Tooltip, confirmation, toast and held-name motion evidence is reused for unchanged motion. The corrected phase 1.2 discovery strip is reused **only for cadence/easing**: opacity 0 / 0.961383 / 1 / 1 / 1 / 0.5 / 0 at 0 / 150 / 300 / 2300 / 4300 / 4450 / 4600 ms. It proves the required eased 300 ms entrance, four-second hold and 300 ms exit. That strip predates the later glyph stroke, so current glyph appearance instead comes from the fresh full-hold captures. Example fresh evidence: `primitive-discovery-snow-1280.png`, opacity 1, animation currentTime 949.965 ms, stroke width 1, `rgb(11, 13, 16)`.

Decisions **100** and **101** remain narrowly applied: Tooltip may naturally wrap its exact concise sentence at the existing width; an editable Field may horizontally scroll its unchanged full draft with visible Home/End endpoints and caret. Neither permits clipped labels or readouts. Decision **108** adds only existing --text fill over a 1px --ink-0 glyph stroke, with no panel, layout, motion or copy change.

The independent Astra repair addendum closed the original F3 row and discovery easing findings and accepted the historical-anchor map layout. Its contrast addendum passed all nine bright/dark fixtures. These are separate independent reviews, with reports/receipts hashed here. The present final review reopens the complete current screen set after integration; it does not upgrade fixture evidence into production proof.

Map fixtures use declared sample raster data; the collision regression uses historical actual seed-1 anchors over a neutral raster. They prove UI label layout and fixture-port interactions, not current WorldPlan geography or safe teleport readiness. The outline/ghost and silhouette images are embedded source-bound engine captures, not new gameplay renders from this gallery run. System states are deliberate UI fixtures, not induced real WebGL/storage/update failures. Engine runtime acceptance, public navigation and final publication remain in root's separate evidence.

Root reports 290 tests plus check/build passing before this final visual review; this lane did not rerun those broad gates. The later harness-only repair received focused TypeScript/Biome checks and the bounded browser pass described above.

## Publication refresh

After the far-camera sky correction, the coordinator regenerated both actual HUD captures, integrated their source-bound manifests and opened both JPEGs. Outline/ghost SHA256: `deebc1ee509ff0899d486bfe801ee78eb886e6280885c9feb3d4a875ce273a7f`; silhouette: `a5dcf31ed5f347cab0f10a4595f3a91feee22fdced492c4009cb0352e0f6795d`. The first shows the avatar and block outline over stepped grass; the second shows the pale avatar silhouette through the stone wall. This refresh supersedes the earlier HUD file hashes, not the historical gallery run. Current canonical validation passes 292 tests, check, build and the local smoke/drive. The original palette failure and successful three-profile repair remain separate receipts.
