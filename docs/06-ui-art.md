# 06 · UI, art and audio direction

The owner's brief for UI: **clean, minimalistic, uncluttered, organised**, with no filler text. For art: blocky voxels, produced entirely by code. This doc holds the principles, the design tokens and the art direction. **`11-interface-catalogue.md` holds everything else about the interface:** the layout of every screen, input, cameras, every control and every word on screen. Where the two disagree, the catalogue wins and this doc gets fixed.

---

## 1. UI principles

1. **The world comes first.** In normal play, at least 85% of the screen shows the world with no UI on it.
2. **Progressive disclosure.** Show a summary first; details on hover, select or expand. Never dump everything at once.
3. **One focus at a time.** At most one drawer plus the inspector are open. Opening another drawer closes the first.
4. **Fixed places.** The same kind of information always appears in the same spot, so it becomes muscle memory.
5. **Type and spacing do the work.** No ornate frames, no heavy borders, no parchment textures, no gradients, glows or glass. Dark flat panels, hairlines only where they separate things, and generous spacing.
6. **Numbers are for decisions.** Show a number where the player acts on it. Show trends as sparklines. Round sensibly ("1.2k", not "1,237.44").
7. **Quiet alerts.** Three priorities:
   - **critical** (king in danger, capital attacked, Warden engaged): sound plus a row that stays until clicked
   - **important** (settlement attacked, caravan lost, starvation)
   - **info** (construction done, promotions)

   Group duplicates into one row with a count. Show how old news is ("Stenholm is out of food · 4 min ago") and, on hover, how it reached you. Only critical alerts interrupt.
8. **Flavour in the words, never in the way.** The world speaks in its own voice (the Steward, discovery cards, the Chronicle), but function labels are plain modern English, and fiction never hides information.
9. **No filler.** A screen shows its controls and its data, and nothing that explains them. No subtitles, taglines, helper lines, section notes or tips: an explanation is a tooltip. An empty list is one plain line ("No routes yet").
10. **Keyboard-first, mouse-complete.** Every action is reachable from Find (Ctrl/⌘ + K).
11. **Nothing unlisted.** Only the screens, controls and sentences in `11-interface-catalogue.md` exist. A new one is added there first.

---

## 2. Layout

Every screen's layout is in `11-interface-catalogue.md` Part D. In short:

- **Command view:** the kingdom's name, lives and the date as plain text along the top; up to three alerts under the date; the minimap, overlay switches and a depth gauge at the left; the command bar at the bottom centre; the inspector at the right while something is selected. Build and Zones open as a low palette above the command bar; Routes, Army, Realm and Trade open as a panel down the left edge.
- **Possess:** Minecraft's screen, seen from outside: the crosshair (Shoulder only), the hotbar with health and stamina above it and the level and experience under it, the unit's skills beside it, its name at the bottom left, the band at the left edge, alerts at the top right. Nothing else.
- **Map and Ledger:** full screen.

---

## 3. Components

The component set, each with its one look, is the table in `11-interface-catalogue.md` A3. Screens are built only from those components and the tokens in §5. The discovery card, the Warden card and the Steward's line are specified in its D9.

**Court-speech names show their kanji** on discovery and Warden cards (黄昏 over Tasogare), which carries the anime-styled flavour the owner asked for.

**No spoilers on cards.** The King Below's card reads "The King Below" until that player's kingdom has found his name in the Buried City (a Ledger entry); only then does it read "Kuon · The King Below", with 久遠. No card, tooltip, Ledger line or Chronicle entry reveals a secret from `03-lore.md` §10 to a kingdom before that kingdom's reveal.

---

## 4. Overlays (Command view data layers)

| Overlay | Shows |
|---|---|
| Resources | known deposits and yields |
| Logistics | routes; line thickness = throughput; bottlenecks in amber; broken routes in red |
| Loyalty | per-settlement loyalty colour; defection risk markers |
| Network | coverage, links, nodes, news in transit (moving dots with ETA) |
| Hazards | intensity heat map for the current region's hazard |
| Territory | kingdom borders, enemy territory, Seats |
| Mana | the mana grid: load, losses and storage |

One overlay at a time. An overlay takes a third of the colour out of the world so the data reads clearly. The switches, their tooltips and the milestone each arrives in are in `11-interface-catalogue.md` D2.

---

## 5. Design tokens

Implement as CSS custom properties in one file (`packages/client/src/ui/tokens.css`). **Colours, type sizes, spacing, radii and shared sizes come only from these tokens,** and so do the durations listed here. A component's own fixed dimensions and timings (a toggle is 28 × 16; a toast stays 2 s) live once in that component, as `11-interface-catalogue.md` A3 and A4 give them. A screen's stylesheet contains no colour and no raw pixel value.

```css
:root {
  /* surfaces */
  --ink-0: #0b0d10;
  --ink-1: #11151a;
  --panel: rgba(13, 16, 21, 0.92);
  --panel-hi: rgba(26, 32, 40, 0.96);
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
  /* space and radius */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px;
  --r-ctl: 4px; --r-panel: 6px;
  /* control sizes */
  --h-ctl: 32px;                 /* buttons, fields, selects; an icon button is this size square */
  --h-row: 28px;                 /* list and table rows */
  --slot: 40px;                  /* one inventory slot */
  --slot-lg: 48px;               /* one Build palette tile */
  /* layout sizes */
  --h-topbar: 40px;
  --h-bar: 44px;                 /* the command bar, the map's bar */
  --w-column: 320px;             /* title screen, loading, lobby, menu */
  --w-modal: 360px;              /* confirmations, founding */
  --w-inspector: 360px;          /* the inspector, the list of sites */
  --w-panel: 440px;              /* side panels: Routes, Army, Realm, Trade, Tools */
  --w-centre: 480px;             /* Find, the Warden card's bar */
  --w-page: 560px;               /* settings, an open Ledger entry */
  --w-palette: 720px; --h-palette: 168px;   /* Build and Zones */
  --w-minimap: 208px;
  --w-tabs: 200px; --w-list: 280px;         /* the Ledger's two left columns */
  --w-tooltip: 280px;
  /* shadow and motion */
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  --t-press: 60ms; --t-quick: 100ms; --t-drawer: 200ms; --t-fade: 300ms; --t-tip-delay: 300ms;
}
```

- **Type.** Inter (400/500/600) for all UI text, with tabular numbers (`font-variant-numeric: tabular-nums`). `--fs-14` is the body size; nothing on screen is smaller than `--fs-12`. Cormorant SC (600) only for display moments: the game's name on the title screen, region names on discovery cards, Warden cards, and the lines that head the death, eliminated and Frost screens. Noto Serif JP (500) only for the kanji on the two cards; its `@fontsource` package is split into small subsets, so the browser loads only the few glyphs used. Self-host all fonts through `@fontsource` npm packages; no external font requests.
- **Icons.** Lucide (1.5 px stroke, 18 px). Custom glyphs (resources, coins, badges, crests) are drawn in the same monoline style on a 20 px grid, generated as SVG in code.
- **Motion.** Ease-out, no bounce. Respect `prefers-reduced-motion` and the Motion setting.
- **Panels.** `--panel` fill, `--r-panel` corners, a `--line` hairline, `--shadow`. No blur behind panels: on top of a 3D scene it costs frames, and it reads as decoration. The panels are nearly opaque instead, so text stays legible over any terrain.
- **Interface size.** The whole interface scales by one factor (80–150%, `set.ui.scale`), and every size token scales with it.

---

## 6. Controls

All input is specified in `11-interface-catalogue.md`: Part B (what a browser allows, mouse, every key binding, rebinding) and Part C (the cameras). In short:

- **Possess mode uses Minecraft's default controls and feel, seen from outside.** The owner's rules: a played unit moves, digs, builds and fights like a Minecraft player, from above (Overhead) or over its shoulder (Shoulder), never in first person. Muscle memory from Minecraft must just work; F5 switches the camera, and Z X C V R G hold the unit's skills.
- **Command view is a strategy-game camera:** W A S D or the screen edge pans, the wheel zooms toward the cursor, right-drag orbits, middle-drag grabs the ground, and Q and E turn. Left click selects or places; right click orders, cancels or deselects. There are no right-click menus: everything a thing can do is in its inspector.
- **Tab switches between the two.**
- **Ctrl + W closes a browser tab** on Windows and Linux, and Minecraft players sprint by holding Left Ctrl with W. So entering the world goes fullscreen, where the browser hands those keys to the game. In a window, Left Ctrl is switched off on Windows and Linux, sprint is double-tap W, and the browser asks before the tab closes.

---

## 7. Accessibility

- UI scale from 80% to 150%.
- Minimum text 12 px at 100%.
- Colour is never the only signal: pair it with an icon, shape or label. Semantic colours are checked for colour-blind separation.
- The Steward's lines are always shown as text, also once they are voiced.
- Reduced motion, remappable keys, hold-or-toggle for sprint and sneak.
- Every icon-only control has a name for screen readers (its Label in the catalogue), and every control is reachable by keyboard inside menus and modals.

---

## 8. Milestone 1 UI scope

Part F of `11-interface-catalogue.md` lists what the interface contains at the end of each phase. For Milestone 1 that is:

- the title screen (seed, Play) and the loading bar
- the free camera's screen, seen in Shoulder with the avatar (and from phase 1.4 in Overhead, on F5): crosshair, target outline, placement ghost, hotbar with the held item's name, and a block palette (all terrain blocks plus a few building blocks)
- the map (M) with teleport, and discovery cards on entering regions
- Tab: the Command camera as a king's view (camera only, no command features yet), and from phase 1.8 the cut and its depth gauge, for looking into the caves from above
- the menu (with Licences), and the settings rows marked 1.4 and 1.10
- **in every build through Milestone 4, previews included** (the owner tests with these): the F3 overlay, the Tools panel (F4) with the region and postcard teleports, the time slider, view modes and render toggles, fly, postcard mode, and the interface gallery (`/?gallery`)
- only the `lil-gui` parameter panel is hidden, behind `?dev`

Even this small UI goes through the catalogue's pipeline (string table, lint, gallery, screenshots). It's the seed of the real UI.

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

**People (the avatar from phase 1.1).**
- Blocky figures with a Minecraft avatar's proportions, 1.8 m tall, generated in code with simple rigid-part animation (`13-units-classes-power.md` §3.2). This is the owner's look for now.
- Classes read by clothing colour and the tool in hand; worn armour shows as a layer by material.
- **The Steward:** tall, grey, hooded, with a small lantern.
- **The king:** crown and cloak.
- Everyone wears a trim of the kingdom's colours, wider from Champion; a Calamity burns with a visible fire (`13-units-classes-power.md` §3.2). Every enemy family is designed silhouette-first.

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
