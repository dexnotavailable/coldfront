# 06 · UI, art and audio direction

The owner's brief for UI: **clean, minimalistic, uncluttered, organised.** For art: blocky voxels, produced entirely by code. This doc turns both into rules.

---

## 1. UI principles

1. **The world comes first.** In normal play, at least 85% of the screen shows the world with no UI on it.
2. **Progressive disclosure.** Show a summary first; details on hover, select or expand. Never dump everything at once.
3. **One focus at a time.** At most one drawer plus the inspector are open. Opening another drawer closes the first.
4. **Fixed places.** The same kind of information always appears in the same spot, so it becomes muscle memory.
5. **Type and spacing do the work.** No ornate frames, no heavy borders, no parchment textures. Use dark translucent panels, hairlines only where they separate things, and generous spacing.
6. **Numbers are for decisions.** Show a number where the player acts on it. Show trends as sparklines. Round sensibly ("1.2k", not "1,237.44").
7. **Quiet alerts.** Three priorities:
   - **critical** (king in danger, capital attacked, Warden engaged): sound plus a persistent badge
   - **important** (settlement attacked, caravan lost, starvation)
   - **info** (construction done, promotions)

   Group duplicates ("3 porters idle"). Show how old news is ("Rider from Eastwatch · 4 min ago"). Only critical alerts interrupt.
8. **Flavour in the words, never in the way.** Use in-world language ("A rider from Eastwatch…"), but never hide information behind fiction.
9. **Empty states point to the next step.** "No Quartermaster in Stenholm. Appoint one →"
10. **Keyboard-first, mouse-complete.** Every action is reachable from the command palette (Ctrl/⌘ + K).

---

## 2. Layout

### Command view
```
┌───────────────────────────────────────────────────────────────┐
│ [crest] Brennvik Crown · ●●○        Day 12 · Summer · Y3  [!2] │
│                                                    ┌─────────┐ │
│                                                    │Inspector│ │
│                 (the world)                        │ (slides │ │
│                                                    │  in on  │ │
│                                                    │ select) │ │
│ ┌──────┐                                           └─────────┘ │
│ │ mini │ ◌ ◌ ◌ ◌ ◌   [Build][Zones][Routes][Army][Realm][Trade] │
│ │ map  │ overlays                                              │
└─┴──────┴──────────────────────────────────────────────────────┘
```
- **Top-left:** crest, kingdom name, lives (pips), and the king's status (a health ring appears only when he's threatened).
- **Top-right:** calendar and the alert stack (max 3 visible, collapsible).
- **Right:** the **inspector** (`--w-inspector`, 360 px), opened by selecting a person, building, route, army or tile. Tabs inside: Overview · Work · Inventory · History.
- **Bottom-centre:** the **command bar**. Each button opens one drawer.
- **Bottom-left:** minimap (toggle) with the **overlay** switches next to it. Only one overlay at a time.

### Possess mode
- Bottom-left: the unit's glyph, name and role, with thin health and stamina bars.
- Bottom-centre: the hotbar (1–9: tools and blocks), with a small row of learned abilities (Z X C V R G) beside it.
- Centre: a minimal crosshair.
- Top-right: the same calendar and alerts.
- A small "Possessing · Tab to return" tag under the unit's name.

### Map (M)
A full-screen map: regions, your coverage, known enemy territory, markers, and a layer switch (Surface · Layer 1 · Layer 2 · Layer 3 · Pit). In builds through Milestone 4, click to teleport.

---

## 3. Components

Button (primary / secondary / ghost / danger), icon button, tabs, drawer, inspector, tooltip (rich, 300 ms delay), toast / alert, stat (label + value + trend sparkline), bar, chip, dense sortable table, slider, toggle, select, command palette, modal (confirmations only), **discovery card**, **Warden title card**, map.

**Discovery card.** When you enter a region for the first time: the region name in display type with the first sentence of its story (`03-lore.md` §11), centred high on screen. Court-speech names also show their kanji, small and above the name (黄昏 over TASOGARE), which carries the anime-styled flavour the owner asked for. Fades in over 300 ms, holds 4 s, fades out. Never blocks input.

**Warden title card.** Name and title ("SHIMOTSUKI · THE HOARFATHER", then "Warden of Shirogane") plus a thin HP bar, which appears when the Warden is engaged. A Court-speech name shows its kanji beside it, as on discovery cards.

**No spoilers on cards.** The King Below's card reads "THE KING BELOW" until that player's kingdom has found his name in the Buried City (a Ledger entry); only then does it read "KUON · THE KING BELOW", with 久遠. No card, tooltip, Ledger line or Chronicle entry reveals a secret from `03-lore.md` §10 to a kingdom before that kingdom's reveal.

---

## 4. Overlays (Command view data layers)

| Overlay | Shows |
|---|---|
| Network | coverage, links, nodes, news in transit (moving dots with ETA) |
| Logistics | routes; line thickness = throughput; bottlenecks in amber; broken routes in red |
| Hazards | intensity heat map for the current region's hazard |
| Loyalty | per-settlement loyalty colour; defection risk markers |
| Resources | known deposits and yields |
| Territory | kingdom borders, enemy territory, Seats |

Overlays desaturate the world slightly so the data reads clearly.

---

## 5. Design tokens

Implement as CSS custom properties in one file (`packages/client/src/ui/tokens.css`). Nothing outside the tokens may hard-code colours or sizes.

```css
:root {
  /* surfaces */
  --ink-0: #0b0d10;
  --ink-1: #11151a;
  --panel: rgba(13, 16, 21, 0.78);
  --panel-hi: rgba(22, 27, 34, 0.86);
  --line: rgba(255, 255, 255, 0.08);
  --line-strong: rgba(255, 255, 255, 0.16);
  /* text */
  --text: #e6eaef;
  --text-2: #a7b0bc;
  --text-3: #6b7683;
  /* accent: cold steel */
  --steel: #8fb3d9;
  --steel-2: #5f86b0;
  /* meaning (always paired with an icon or shape) */
  --gold: #d8b765;
  --silver: #c9d1db;
  --mana: #5fe0dc;
  --danger: #e2635a;
  --warn: #e0b056;
  --ok: #74b98a;
  /* type */
  --font-ui: "Inter", system-ui, sans-serif;
  --font-display: "Cormorant SC", Georgia, serif;
  --font-kanji: "Noto Serif JP", serif;
  --fs-12: 12px; --fs-13: 13px; --fs-14: 14px; --fs-16: 16px; --fs-20: 20px; --fs-28: 28px;
  /* space, radius, sizes, motion */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px;
  --r-ctl: 6px; --r-panel: 10px;
  --w-inspector: 360px;
  --blur: 10px;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  --t-fast: 140ms; --t-drawer: 200ms; --t-fade: 300ms;
}
```

- **Type.** Inter (400/500/600) for all UI text, with tabular numbers (`font-variant-numeric: tabular-nums`). Cormorant SC (600) only for display moments: region names, Warden titles, menu titles. Noto Serif JP (500) only for the kanji on discovery and title cards; its `@fontsource` package is split into small subsets, so the browser loads only the few glyphs used. Self-host all fonts through `@fontsource` npm packages; no external font requests.
- **Icons.** Lucide (1.5 px stroke, 18/20 px). Custom resource glyphs are drawn in the same monoline style on a 20 px grid, generated as SVG in code.
- **Motion.** Ease-out, no bounce. Respect `prefers-reduced-motion`.
- **Panels.** `--panel` background, `backdrop-filter: blur(var(--blur))`, `--r-panel` corners, a `--line` hairline, `--shadow`.

---

## 6. Controls (defaults; all rebindable)

**Possess mode uses Minecraft's default controls and feel.** That is the owner's rule: possessing a unit should be the same as controlling a Minecraft player. Muscle memory from Minecraft must just work.

| Possess (Minecraft defaults) | | Command | |
|---|---|---|---|
| WASD | move | WASD / screen edge | pan |
| Space | jump (swim up); double-tap to fly (owner tool, every build through Milestone 4) | Wheel | zoom |
| Left Shift | sneak (won't walk off edges) | Q / E, middle-drag | rotate |
| Left Ctrl, or double-tap W | sprint | LMB | select / place |
| LMB (hold) | attack / break block | RMB | cancel / context |
| RMB | use / place block / interact / raise shield | B · Z · R · G · K · T · L | Build · Zones · Routes · Army (G) · Realm · Trade · Ledger |
| Middle click | pick block | M | map |
| 1–9, wheel | hotbar | Tab | possess last unit |
| E | inventory | Home | jump to king |
| Q | drop item | Ctrl/⌘ + K | command palette |
| F | swap main hand and off hand | | |
| F5 | first / third person | | |
| Z · X · C · V · R · G | learned abilities (1–2 for anyone trained, up to 6 for a hero) | | |
| Tab | back to Command view | | |

Common: Esc = menu, F1 = hide HUD, F2 = screenshot, F3 = debug overlay. Fly (double-tap Space, as in Minecraft's creative mode) is an owner tool in every build through Milestone 4. In Milestone 1, Tab toggles the king's-view camera.

**Ctrl + W closes a browser tab** on Windows and Linux, and Minecraft players sprint by holding Left Ctrl with W. So click-to-play enters fullscreen and locks the keyboard where the browser allows it (Chromium-based browsers), which lets the game keep Ctrl + W. Where it can't (Firefox, Safari), sprint is double-tap W, and the browser asks before the tab closes (`07-architecture.md` §6).

---

## 7. Accessibility

- UI scale from 80% to 150%.
- Minimum text 12 px at 100%.
- Colour is never the only signal: pair it with an icon, shape or label. Semantic colours are checked for colour-blind separation.
- Subtitles for every Steward line.
- Reduced motion, remappable keys.

---

## 8. Milestone 1 UI scope

- Loading screen with seed input.
- Minimal HUD: crosshair, hotbar with a block palette (all terrain blocks plus a few building blocks).
- Map (M) with click-to-teleport.
- Discovery cards on entering regions.
- Tab: king's-view camera (camera only, no command features yet).
- Pause menu. Settings: render distance, LOD reach, FOV, mouse sensitivity, shadows, bloom, UI scale.
- **In every build through Milestone 4, previews included** (the owner tests with these): F3 overlay, fly, the region and postcard teleport list, time-of-day slider, view modes (clay, features), render toggles.
- Only the `lil-gui` parameter panel is hidden, behind `?dev`.

Even this small UI uses the tokens and components above. It's the seed of the real UI.

---

## 9. Art direction

**Voxels.** 1 m blocks, 16 × 16 procedural textures, clean silhouettes. The beauty comes from **light, atmosphere and composition**, not texture noise.

**Palette.** The baseline is cool and muted: slate, iron, frost, pine, with lamp-gold highlights. Each region has a dominant colour and an accent. The fantasy regions break the palette on purpose.

| Region | Dominant | Accent | Fog | Sky |
|---|---|---|---|---|
| Hearthlands | meadow green `#9fb56a` | chalk `#e6e1d3` | pale blue `#c9d7e3` | soft blue |
| Shirogane | snow `#e8eef2` | ice blue `#9cc8e0` | white `#e3eaef` | pale |
| Kurogane | granite `#8b9099` | pine `#3e5a3a` | cool blue `#aebfcf` | crisp blue |
| Kogane | sand gold `#d4b066` | red rock `#b5563a` | warm `#e3cfa6` | pale, hot |
| Boneyard | bone `#d9d2c1` | ash grey `#8e8a80` | grey `#b8b5ae` | overcast |
| Selva | jungle green `#3f6e32` | limestone `#cfcabb` | green-grey `#9fb09a` | hazy |
| Sallows | olive `#6e7848` | peat `#4a3a2a` | swamp `#8a9072` | dim |
| Grey Mere | grey-blue `#7b95a6` | shingle `#9a9a94` | `#aab8c2` | overcast |
| Tasogare | indigo `#463a74` | glowcap `#bff3ff` | violet `#3b3560` | permanent dusk, the wound |
| Ibara | obsidian `#16141a` | ember `#ff6a2a` | `#3a2a24` | smoky ochre |
| Hoshikuzu | slate `#2e3540` | mana cyan `#5fe0dc` | `#4a5d66` | storm, aurora |
| Sundered Isles | blue-grey `#9fb0c3` | skystone `#dff4ff` | white | bright, windy |
| Nadir | basalt `#232327` | black iron `#3a3d42` | `#2a2c33` | dark vortex |

**Texture recipes.** Every block texture is generated from a small recipe in code:
- a colour ramp (3–5 tones)
- a noise type and scale
- a pattern: strata lines, grain, bricks, planks, cracks, specks, veins, crystal facets
- an edge treatment (e.g. the grass fringe on side faces)
- 2–4 variant seeds

Keep contrast *low inside* a texture, so big surfaces don't look noisy, and put the variation in macro tinting (`04-terrain.md` §10.5).

**Light.** Soft AO, a warm or cool sun, strong fog and aerial perspective for scale. Emissives with bloom: lava, crystal, glowcaps, moonsilver, skystone, ember crust, ichor, the Wellspring.

**People (Milestone 2+).**
- Blocky voxel figures about 1.8 m tall with simple rigid-part animation.
- Roles read by clothing colour and the tool in hand.
- **The Steward:** tall, grey, hooded, with a small lantern.
- **The king:** crown and cloak.
- Heroes get distinct silhouettes. Every enemy family is designed silhouette-first.

**Architecture.**
- **Old Crown:** heavy stone, round arches, iron fittings, geometric motifs.
- **Players:** timber and stone early, stone and iron later.
- **Mana tech:** iron, moonsilver lines and a cyan glow.

**Heraldry.** Each kingdom gets a simple crest: field + charge + tincture, from a small built-in editor.

---

## 10. Audio (Milestone 8; not in Milestone 1 beyond simple wind)

- An ambient bed per region (wind, fen insects, cracking ice, lava hiss, crystal hum, Tasogare's silence).
- Minimal UI sounds: soft ticks, one distinct critical-alert tone.
- A restrained score: low strings, bowed metal, distant choir in the deep layers. Each Warden has a motif. The Frost has a theme.
