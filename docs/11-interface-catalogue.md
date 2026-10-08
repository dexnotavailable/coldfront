# 11 · Interface catalogue

The owner's brief: plan the cameras and menus in full, and list **every** screen, button, slider and interaction, so nothing gets invented later. This doc is that list. `06-ui-art.md` keeps the principles, the design tokens and the art direction. This doc owns layout, input, cameras, every control, and every word on screen.

**How to use it (coding agent):**
- Before any interface, input or camera work, read Part A and the section for the thing you're building. Parts B–E are reference: don't read them end to end for a one-screen task.
- Build only rows whose **Since** value is the phase you're in or an earlier one. Later rows don't exist yet: no placeholders for them.
- Every table whose first column is **ID** is data. `node docs/tools/ui-catalogue.mjs` checks those tables, and `--json` prints them for the game's string table (A6).

---

# Part A · Rules for every screen

## A1. The law

1. **Only what is listed exists.** A control, screen, panel or sentence that isn't in this doc doesn't ship. If a task seems to need one, first reuse a listed one. If nothing fits, Part G may gain **a control row**, **a key-binding row**, or **a message row** (a fact shown in an Alert, Note, Toast, Banner or Modal when something happens): add it in the same change, build exactly that row, and list it under "Decisions you may want to check" in the report. Part G never gains text that sits on a screen to explain it, and a listed row is never reworded unless the owner asked: report the gap instead.
2. **Every word on screen is a row in these tables, or game content.** Game content is what is defined in data files beside its numbers: the names of people, places, kingdoms, regions, layers, Wardens and what feeds them, items, blocks, goods and their groups, buildings, classes, skills, proficiencies, traits, needs, conditions, hazards, world events, crops, kits, transport kinds, deeds, honours, banners, looks and crest parts, plus the lore lines of `03-lore.md` (region stories, last words, inscriptions, item flavour). Content follows A2 as well: a name is 3 words at most, and content never carries a subtitle, a hint or an instruction. Every other word is a row here: labels, tooltips, messages, units, column headers, key names and the game's fixed terms (E7). Interface code contains no text literals (A6).
3. **Nothing ships early.** No disabled "later" buttons, no empty tabs, no sample data in a real build.
4. **Nothing decorative.** No illustration, divider, badge, counter, icon or animation that this doc doesn't call for.

## A2. Words

The owner's rule: no filler text. Explanations live in tooltips.

- **A screen shows a title (optional, 3 words at most), its controls and its data. Nothing else.** No subtitle, tagline, intro sentence, helper line under a control, section note, caption, footer or tip. No small uppercase label above a title.
- **Labels:** 3 words and 24 characters at most. Sentence case. No full stop. A noun for a thing ("Render distance"), a verb for an action ("Demolish").
- **Tooltips carry the explanation.** One concise explanation, 100 characters at most. It may wrap naturally within the tooltip's prescribed width; it must never be clipped or truncated. Say what the control does first; add a cost, limit or condition after a `·`. No full stop. Never repeat the label. The key binding is added by the tooltip component from the **Key** column, so don't type it into the text. If one short explanation can't explain a control, the control is wrong: raise it in the report. An icon's tooltip shows its Label above that explanation. Three tooltips are assembled from several rows: the building tooltip (D3), the item tooltip (D6) and the skill tooltip (D4).
- **A control that can't be used is hidden.** It is shown disabled only where its row says so. Its tooltip is then replaced by the reason, which is the `why.*` or `note.*` row that the row names (E2, E3), in the form "No Envoy appointed".
- **A Field with an invalid value** shows its one-line reason directly under it in `--danger` for as long as it is invalid. This is the only text that ever sits under a control.
- **Messages** (alerts, notes, errors): 14 words at most. The fact first, then what to do if that isn't obvious. No full stop.
- **Confirmations** exist only where a row says *confirm*. The title is the action as a question ("Demolish the forge?"). The body is the consequence in one line, or nothing. The buttons are the verb and "Cancel". Never "OK", "Yes" or "No".
- **Hints are shown once and briefly.** Nothing instructional stays on screen. The only hint mechanisms are the tooltip, the 4-second key hint on entering Possess (D6), and the Steward's lines (E4).
- **Two voices.** The interface speaks plain modern English ("Settings"). The world speaks in the voice of `03-lore.md` (Steward lines, discovery lines, the Chronicle). World voice never replaces a function label.
- **Banned in any string:** exclamation marks, "please", "simply", "just", "click here", "welcome", "oops", "sorry", ellipses, emoji, ALL CAPS.
- **Never put this doc's words on screen:** no IDs, no rule text, no descriptions of the design.

## A3. Look

Use the tokens in `06-ui-art.md` §5 and only these components. Each has one look, written once in `packages/client/src/ui/components/`. Screens are made of components and tokens: a screen's own stylesheet contains no colour and no raw pixel value. Where this doc gives a size in px, it is either a token (the widths and heights listed in `06-ui-art.md` §5) or one component's own dimension.

| Component | Used for | Shape |
|---|---|---|
| Panel | drawers, inspector, menu, map bars | `--panel` fill, `--line` hairline, `--r-panel` corners, `--shadow`. Never a panel inside a panel |
| Button | actions with a word | `--h-ctl` tall, `--r-ctl` corners. Primary = `--steel` fill, one per panel at most. Secondary = `--line-strong` border. Ghost = text only. Danger = `--danger` text, used only for destructive actions |
| Icon button | actions with an icon | 32 × 32, icon 18 px, no border until hover |
| Toggle | on/off | 28 × 16 switch |
| Slider | a number in a range | 4 px track, 12 px thumb, value at the right in tabular numbers |
| Select | one of many | button showing the current value, list opens below, 8 rows before it scrolls |
| Segmented | one of 2–4 | joined buttons, selected = `--panel-hi` fill and `--text` |
| Stepper | a whole number | value between `−` and `+`; typing allowed |
| Field | text entry | `--h-ctl` tall, `--line-strong` border, `--steel` border on focus, `--danger` border while its value is invalid (A2). Values wider than the field scroll horizontally while editing; never shorten the stored value or add an ellipsis |
| Tabs | sections of one panel | text tabs, selected = `--text` with a 2 px `--steel` underline |
| Row | list item | `--h-row` tall, hover = `--panel-hi`, selected = 2 px `--steel` bar at the left |
| Table | dense lists | numbers right-aligned. A header row (`--text-3`, click to sort) only where the row names its columns (`col.*`, E7) |
| Stat | label + value | label in `--text-2`, value in `--text`, optional 40 px sparkline |
| Bar | a 0–100% value | 4 px tall (6 px on the Possess screen), fill by meaning (`--ok`, `--warn`, `--danger`, `--steel`, `--mana`). Drawn as pips where it counts whole things (lives) |
| Chip | a state word | `--fs-12` text with a 1 px border, `--r-ctl` corners. State only, never an action |
| Keycap | a key name | `--fs-12`, 1 px `--line-strong` border, used in tooltips and the key list |
| Slot | one item stack | `--slot` square, count bottom-right, durability bar at the bottom |
| Tooltip | explanations | `--w-tooltip` wide at most, `--ink-1` fill, `--fs-13` |
| Alert | news | one row: icon, text, age |
| Note | a reason at the cursor | one line of `--fs-13` text, 16 px right of the cursor |
| Toast | confirmation of a keypress | one line, bottom centre, 16 px above whatever stands there (the command bar, an open palette, or the item name over the hotbar), 2 s |
| Banner | a system state that doesn't stop play | one line at the top centre, 8 px under the top bar (under the Warden card when one shows), with one Button at most (D11) |
| Spinner | waiting inside a control or a panel | a 16 px ring in `--text-2`, shown only after 400 ms of waiting |
| Modal | confirmations, fatal errors | centred panel 360 px wide, world dimmed 40% |
| Card | discovery card, Warden card | text over the world with no panel (D9) |
| Wheel | the order wheel | four wedges around the cursor (D6) |

**Layout**
- One column of controls per panel. Settings rows put the label left and the control right.
- Gaps come from the spacing tokens: 8 px inside a group, 16 px between groups, 16 px panel padding.
- A group gets a title (2 words at most, `--text-2`) only when its panel has two or more groups.
- Inside every panel, text is left-aligned and numbers in tables are right-aligned. What stands alone is centred on the screen: modals, the menu, settings, the inventory, Find, cards, and the title and moment screens.
- In normal play (no drawer, no inspector) the interface covers 15% of the screen at most.

**Never**
- gradients, glows, blurs, glass panels, coloured shadows
- cards inside panels, grids of stat cards, charts other than a Stat's sparkline or a Bar
- pill-shaped buttons, rounded corners other than the two radius tokens
- borders thicker than 1 px (the selection marks are the exception, at 2 px: the Tabs underline, the Row bar, and the frame on the selected hotbar slot)
- icons that do nothing, icon tiles with coloured backgrounds, count badges on buttons
- text in ALL CAPS or with letter-spacing (the display font on the title screen and the two cards is the exception)
- a Spinner before 400 ms of waiting, skeleton shimmer, bouncing or pulsing (one exception: a new critical alert pulses once)
- any colour that isn't a token, and any size or duration that is neither a token nor a value this doc gives

## A4. Behaviour every control shares

- **States:** rest; hover (`--panel-hi` fill, at once); pressed (darker for 60 ms); keyboard focus (1 px `--steel` outline, 2 px away); selected; disabled (40% opacity, no hover); pending (an order still on its way: see "Orders travel").
- **Hidden or disabled.** A control that can't be used is hidden. It is shown disabled only where its row says so, and then its tooltip is replaced by the reason row that the row names (A2).
- **Timing:** press feedback within one frame. Tooltips appear after 300 ms, or at once if another tooltip closed in the last 500 ms; they fade in 100 ms and hide on press. Drawers and the inspector slide in 200 ms. Nothing animates for longer than 300 ms except what the Motion list below names.
- **Motion** (`18-look-and-feel.md` §3). What appears eases out (`--ease-out`); what you dismiss eases in (`--ease-in`) and leaves in two thirds of the time it took to come; what goes from one place to another uses `--ease-move`. Nothing overshoots or bounces. These are all of the interface's animations:
  - drawers and the inspector slide 16 px in from their edge as they fade in, 200 ms, and leave in 130 ms
  - tooltips, an open select's list and notes fade in over 100 ms
  - a toast or the Steward's line rises 4 px as it fades in over 100 ms; when its time is up it fades out over 300 ms
  - a modal fades in as the world dims, 150 ms, and leaves in 100 ms
  - a new alert fades in over 200 ms where it lands, and the rows below make room over the same time (unless the cursor is over the stack, below)
  - the Tabs underline and a Segmented control's selection glide to the new choice over 150 ms
  - a Bar eases to a new value over 150 ms. When Health or Flame falls, the part lost stays drawn in `--text-2` for 200 ms, then drains over 300 ms
  - a selection ring (`mark.selected`) settles from 115% of its size over 150 ms; `mark.ping` and `mark.telegraph` move as their rows say
  - an alert row that leaves fades out over 200 ms, and the rows below close up over the same time
  - the held item's name (`hud.item`) and chat lines (D10) fade out over 0.5 s when their time is up
  - while an order travels, `mark.order`'s mark moves along the links, and the Network overlay's dots move with the news they carry
  - a Spinner turns once a second
  - besides these, only: the critical alert's one pulse (A3), the low-Health shake (`hud.health`), the sweep of a recovering skill (`hud.skills`), the moments of D9 at their own timings, and the cameras (Part C)
  - numbers never count up or down: a value changes at once
- **Clicks** fire on release inside the control. A drag starts after 6 px. A double-click is two clicks within 300 ms.
- **Changes apply at once and are saved.** There are no Apply, Save or OK buttons anywhere.
- **Sliders:** drag; click the track to jump; double-click resets to the default. The world updates while you drag.
- **Lists:** the wheel scrolls; click selects; double-click does the row's main action (usually: jump the camera to it). A list with nothing in it shows its `*.none` row (E3) if it has one, and otherwise nothing.
- **The wheel belongs to whatever is under the cursor:** a panel scrolls, the world zooms.
- **Nothing moves under the cursor.** While the cursor is over the alert stack or a list, new rows wait instead of pushing the others down.
- **Cursors:** `default` over the world, `pointer` over controls, `grabbing` while panning, `move` while orbiting, `crosshair` while placing or targeting and over the world while playing a unit, `not-allowed` over an invalid spot, `text` in fields.
- **Reduced motion** (the system setting or D8): slides and fades become instant, camera transitions become a 150 ms fade.

**Who has the keys.** One thing at a time owns the keyboard. From the top:

1. **A text field on the play screen** that was clicked, or opened by its key (chat, Find). Typing goes to it; Enter does its action; Esc or a click outside gives the keys back. Tab does nothing here, except in chat (D10).
2. **Key capture** on the key list: the next key or mouse button pressed becomes the binding, except Esc, which cancels (D8).
3. **A modal.** Enter is its verb, Esc is Cancel, Tab moves between its two buttons.
4. **A blocking screen:** the title screen and the screens after it (D1), the menu, settings and the key list, the map, the Ledger, the inventory, a container or workstation, the block palette, the office, and the death, eliminated and Frost screens. It takes every key and the wheel. Inside it Tab and Shift + Tab move focus in reading order, the arrow keys move a list's selection or step a focused slider (Shift + arrow steps ×10), and Enter presses the focused button, or else the row whose Key is Enter. A text field in it is one of its controls: it takes typing while it has focus, Tab leaves it, and Enter goes to the screen's Enter row. A screen that can be left without choosing something (the menu, settings, the key list, the map, the Ledger, the inventory, a container or workstation, the block palette, the office) closes on the key that opened it and on Esc. The others close only through their own buttons.
5. **The world.** The bindings of B3 for the current mode.

- **Panels on the play screen never take the keys.** Drawers, the inspector, the alert stack and the Tools panel are worked with the mouse. While they are open W A S D still move, and a click on one of their buttons doesn't leave focus on it, so Space and Enter can never press a button by accident. A text field inside one takes the keys only after a click (level 1).
- **The pointer is never locked,** in any mode: the cursor aims when playing a unit (C4), so nothing has to free it or lock it again.

**Esc closes one thing per press,** the first of these that applies: a tooltip → an open select → key capture → chat, Find or another focused text field → a modal → a blocking screen that can be left (the key list goes back to settings; settings goes back to where it was opened from; the menu resumes) → postcard mode → the Tools panel → a skill being aimed → a drag in progress → order targeting → the active tool → the open drawer → the selection (the inspector closes). With nothing left, it opens the menu.

**Orders travel (from Milestone 4).** A change to something in the world (a priority, a recipe, a blueprint, an order to a company) is an order, and orders move through the network like news (`05-systems.md` §4).
- The change leaves at once. Where it arrives in under 2 s, nothing shows.
- Where it takes longer, the changed control is **pending** until it lands: its new value in `--text-2` with a clock glyph, and `order.travel` as its tooltip. Company orders also show `mark.order` in the world.
- To a place that is cut off, the order goes by rider when one can get there (`note.order.rider`); when none can, it isn't sent (`note.order.lost`).
- Before Milestone 4 there is no network: everything lands at once.

## A5. Numbers, time and names

- Whole numbers below 1,000 as they are; then `1.2k`, `34k`, `1.2M`. Never more than 3 significant figures in the HUD.
- Percentages have no decimals. Bars never show a number unless a row says so.
- Money: a coin glyph and a number, Crowns then Marks (`◎ 12 ○ 6`, glyphs generated in code). The words "Crowns" and "Marks" appear only in tooltips.
- Weights in kg, distances in m below 1,000 and km above. Heights are metres above sea level, negative below it (`−412 m`).
- **Time the player waits is real time:** `40 s`, `4 min`, `2 h`, `3 d`. Ages are `4 min ago`. Arrival times are `in 6 min`.
- **The calendar is world time:** `Day 12 · Summer · Y3`: the day of that time of year (1–42), the time of year, and the year, which is also the season's week (`05-systems.md` §1).
- **One formatter writes all of these.** It is the only code besides the string table that puts words on screen, and its words are the `unit.*` and `fmt.*` rows in E7.
- `·` separates parts of a line. Don't use dashes, slashes or brackets for that.
- Names of people, places, kingdoms and Wardens are shown as stored. Lists truncate with the browser's own text overflow (the one place an ellipsis glyph may be drawn), and the tooltip shows the full name.
- **In templates,** `{king}` is a ruler's title and name ("Queen Aoi", "King Ivar", or the name alone). The title is a `ruler.*` word (E7), chosen at founding; before Milestone 5 it comes with the generated name. `{kingdom}` is the kingdom's own name ("Kiritani Crown"; the default is `fmt.crown`). `{capital}` is the name of its capital ("Kiritani"). `{victor}` and `{other}` are a ruler written as `fmt.ruler`, or a Warden's name. Several rulers in a row are joined with `fmt.comma`, and the last two with `fmt.and`.
- **No spoilers.** The King Below is called "The King Below" in every row, card and line until that player's kingdom has found his name (`03-lore.md` §6). No row states a secret from `03-lore.md` §10.

## A6. How the tables work

**Three kinds of table**, told apart by their columns:

| Kind | Columns | Holds |
|---|---|---|
| Controls | ID · Type · Label · Tooltip · Key · Does · Since | everything the player can operate or read as a fixed element |
| Texts | ID · Text · When · Since | messages, titles of moments, templates |
| Key bindings | ID · Action · Default · Notes · Since | every bindable action; **Action** is its name on the key list |

- **ID** has the form *area.name*, in lower case. It is the string-table key, the element's `data-ui` attribute and the test hook.
- **Type** is a component from A3 (`icon` = icon button, `title` = a panel title, `canvas` = a drawn area, `wedge` = a wheel segment).
- **Label** is the exact text. `—` means none. Where it is drawn depends on the type:
  - `button`, `tab`, `chip`, `title`, `wedge` and option `row`s: the Label is the element's text.
  - `toggle`, `slider`, `select`, `segmented`, `stepper`: the Label sits at the left of the row and the control at the right.
  - `field`: in a form, the Label sits at the left. A field that stands alone (a search box, chat, Find, a marker's name) shows it as its placeholder.
  - `stat`, `bar`: the Label sits at the left and the value or bar at the right. In the top bar, beside the depth gauge, on the Possess screen and on marks in the world (D2, D6) only the value or bar is drawn.
  - `table`: the Label is its group title, drawn only when the panel has two or more groups (A3).
  - `icon`, `slot`, `canvas`: never drawn. The Label is the accessible name and the first line of the tooltip.
  - `keycap`: draws the key's name. Its Label is the accessible name, and is drawn beside it only where the row says so.
- **Tooltip** is the exact text. `—` means the label says it all.
- `{braces}` mark a value filled in at run time.
- **Defaults.** Where a row gives none, a select or a segmented control starts on its first option, a toggle starts off, and a stepper starts at its lowest value. A slider's row always gives its default.
- **Since** is the phase (1.1–1.10) or milestone (M2–M8) that ships the row.

**The pipeline (build it in phase 1.1, before the first screen):**
1. `npm run ui:strings` runs `node docs/tools/ui-catalogue.mjs --json` and writes `packages/client/src/ui/strings.gen.json`. This doc is the only place strings are edited; the generated file is never edited by hand.
2. Interface code renders text only through `t(id, values)`. Each operable element carries `data-ui="<id>"`.
3. `npm run ui:lint` (part of `npm run check`) fails when:
   - the catalogue script reports a problem (length, case, banned words, duplicate IDs, a mention of an ID that doesn't exist)
   - `strings.gen.json` is out of date with this doc
   - a file under `packages/client/src/ui/` contains a text literal that could reach the screen (JSX text, or a string passed as children, `title`, `aria-label` or `placeholder`)
   - a stylesheet under `packages/client/src/ui/` other than `tokens.css` contains a colour literal, or a screen's stylesheet contains a raw pixel value (A3)
   - the gallery (A7) draws an ID that isn't in the catalogue, or one whose Since is later than `UI_PHASE` (a constant in `packages/client/src/ui/phase.ts`, set when a phase starts)

   It **warns** when a control or text row with Since ≤ `UI_PHASE` never appears in the gallery (key-binding rows are checked through the key list, once it exists). `npm run ui:lint -- --complete` turns that warning into a failure; a phase's "Done when" includes it, so work in progress can still be pushed green.

   It runs in Node with no browser, because CI runs `npm run check` on a plain machine: render the gallery's states to strings and collect the IDs they draw.
4. `npm run ui:shots` loads the gallery in the real browser, takes the screenshots (A7), and fails when:
   - any drawn text is neither a catalogue string (with the state's sample values filled in) nor that state's sample data
   - text is clipped, or the boxes of two controls that aren't parent and child overlap
   - a blocking screen's Tab order differs from its reading order, or Esc doesn't close one that A4 says can be left (it walks each one and writes the order to `out/ui/<screen>.keys.txt`)

Two things are exempt from this part: the `lil-gui` panel behind `?dev`, and the gallery's own index list.

## A7. Building and checking a screen

**The gallery.** `/?gallery` lists every screen and state built so far (the rows up to `UI_PHASE`) and renders each one with fixed sample data and no world behind it (a flat `--ink-1` backdrop, or a still postcard when a row needs the world). Besides the screens it has:
- a **Components** page: every A3 component in every state (rest, hover, pressed, focus, selected, disabled, pending), each drawn with the state forced, so a still image shows them all
- one page per text component (alerts, notes, toasts, banners, tooltips, confirmations) that shows every string of the current phase in that component, so a line that doesn't fit shows up
- a **Fixed words** page: every E7 row of the current phase in the component that uses it (a Keycap, a table header, a formatted value)

It ships in every build through Milestone 4 so the owner can browse the interface.

**The loop for any interface task:**
1. Read Part A and the screen's section. Note the rows for the current phase.
2. Build those rows with the A3 components and tokens. Add the screen's states to the gallery: empty, typical, full (longest names, largest numbers), disabled, and error where the screen has one.
3. `npm run ui:shots` captures every gallery state into `out/ui/` three times: at 1280 × 720, at 1920 × 1080, and at 1280 × 720 with the interface at 150%. It also runs the checks in A6. `npm run ui:shots -- --sheet <screens>` adds one contact sheet of the named screens as `docs/postcards/wip/ui.jpg`.
4. **Open each image with your image viewer and look.** Check it against the list below. Fix and re-shoot until every line holds. For a new screen, also give the images and the checklist to a fresh helper agent that hasn't seen the code (if your tool has them), and fix what it finds.
5. `npm run ui:lint` and `npm test` pass.

**The checklist (a screen is done when all hold):**
1. Every row for this phase is there, with its exact label. Nothing else is there: no word, icon, line, tint or frame that isn't a row, a component or sample data.
2. No text is clipped, wrapped by accident or overlapping, in any state, at both sizes and at 150%. An editable Field may intentionally scroll a value wider than itself: Home/End captures must show the complete endpoint characters and the caret, and a value-retention check must prove that no characters were lost. This exception does not apply to labels, readouts or other displayed text.
3. Edges line up: one left edge per panel, equal gaps, the same control heights.
4. Each control looks like its component on the Components page, and each disabled control names its reason row.
5. The layout matches this doc's description of the screen: what is where, and in which order.
6. For a blocking screen (A4): its keys file (`out/ui/<screen>.keys.txt`) shows Tab in reading order and, where A4 says the screen can be left, Esc closing it.

**In the report,** for each screen you touched: the screenshot files you opened, the words you read in them, and pass or fail for each of the six lines. Link the gallery on the preview (`<preview link>/?gallery`) and show the contact sheet (`docs/postcards/wip/ui.jpg`; `12-sessions.md` §6). A screen whose screenshots you couldn't take or open is reported as not done, first.

---

# Part B · Input

Two modes share one keyboard. **Command view** is a strategy game: cursor visible, camera from above. **Possess** plays one unit as Minecraft does, seen from above (Overhead, C4), never through its eyes or over its shoulder; the cursor aims, and the unit looks where it points. Tab switches between them. The **free camera** (owner tool through Milestone 4, and the only body in Milestone 1) uses the Possess keys. The pointer is never locked.

## B1. What a browser allows

These are facts about browsers, checked in October 2026. They shape every binding below.

- **A window keeps some keys for itself.** A page in a normal window can't stop these, so nothing is bound to them: Ctrl/⌘ + W, T, N, Tab, PageUp, PageDown; Ctrl/⌘ + Shift + W, T, N; Ctrl + Q (Firefox on Linux) and ⌘ + Q; Alt + F4; F12; ⌘ + R and ⌘ + L (Safari).
- **Cancel everything else.** While the world has the keys (A4), call `preventDefault` on every `keydown` except F12. A sprinting player holds Left Ctrl, so every letter their fingers pass over would otherwise fire a browser shortcut (Ctrl + D, S, F, R, 1–9), and so would keys that aren't bound yet in an early phase (F5, F6, F7, Tab, Backspace, Space).
- **Ignore key repeat.** Drop `keydown` events whose `KeyboardEvent.repeat` is set: they would fake the double-taps of W and Space and the short taps of Q and E. On `blur` and whenever something takes the keys (A4), release every held key and button. A skill key released this way cancels its skill and never fires it.
- **Entering the world is one click** (Play or Resume). While `set.ctl.fullscreen` is on, that click asks for fullscreen: `requestFullscreen({ keyboardLock: 'browser' })`, followed by `navigator.keyboard.lock()` where it exists. Nothing locks the pointer: the cursor aims in every mode.
- **The keyboard counts as locked** only when `navigator.keyboard.lock()` has resolved, or the browser is a version known to honour `keyboardLock: 'browser'` (Safari 26.4 and later, Firefox 151 and later). Fullscreen without that is treated as a window.
- **Ctrl + W and Ctrl + Q.** Minecraft players sprint with Left Ctrl while holding W, and drop a stack with Ctrl + Q. In a window on Windows and Linux those close the tab or the browser. So:
  - with the keyboard locked, Left Ctrl sprints and Ctrl + Q drops a stack
  - otherwise, on Windows and Linux, Left Ctrl does nothing, sprint is a double-tap of a movement key (whatever `set.ctl.doubletap` says), and the toast `toast.windowed` says so once per session
  - on macOS, Left Ctrl always works (⌘ is the closing key there)
  - a `beforeunload` guard is on whenever the player is in the world
- **Esc.**
  - In fullscreen without a keyboard lock, Esc never reaches the page: the browser leaves fullscreen itself. So treat any loss of fullscreen that the game didn't ask for as one press of Esc (A4).
  - With a keyboard lock, and in a window, a short Esc reaches the game: handle it as A4 says.
  - **An Esc key press doesn't count as a user action,** so it can't ask for fullscreen. Esc on the menu still closes it, and play goes on in a window until the next click on Resume or a press of F11.
- **Wheel.** Listen with `{ passive: false }` and always `preventDefault` over the game, so the page never zooms or scrolls. Convert every event to pixels by its `deltaMode`: a line is 100 ÷ 3 px, a page is 400 px. A mouse notch is then about 100 px in every browser, and a trackpad sends many small values.
  - Zooming is continuous (C1), so a wheel and a trackpad need no telling apart.
  - Things that move in steps (the cut, the minimap's width) move one step for every 100 px added up, and one step at most per event.
  - A pinch arrives as a wheel event with `ctrlKey` in Chrome and Firefox, and as `gesturechange` in Safari (use its `scale`, and cancel it). No single event may change the zoom by more than ×1.25, so a real Ctrl + wheel notch can't fling it.
- **Mouse.** Cancel `mousedown` on the middle button (it stops autoscroll) and `contextmenu` over the game. Start every drag with `setPointerCapture`, so it survives leaving the window. Don't bind mouse buttons 4 and 5: Firefox on Windows uses them for "back" and can't be stopped.
- **Edge panning works only in fullscreen.** In a window the cursor leaves the page and no events arrive.
- **Read keys by position** (`KeyboardEvent.code`), so W A S D sit in the same place on every layout. Show them as the player's keyboard prints them (`navigator.keyboard.getLayoutMap()` where it exists; elsewhere the US-layout character for that position). Keys that print nothing are named by the `keyname.*` rows in E7.
- **Modifiers.** A binding fires only with exactly the modifiers it names. Two exceptions: in Command view, Shift never blocks the pan keys (it is "Pan faster"); and in Possess and the free camera, Left Ctrl and Left Shift are game keys (sprint, sneak) and never block another key. ⌘ and Alt always block.
- **macOS keeps F11** for itself. There, fullscreen comes from Play and Resume, or from a key the player binds. macOS also keeps Control + arrow keys (Mission Control and Spaces) by default, so while Left Ctrl sprints, Overhead's turn and tilt keys may not arrive: the middle drag orbits instead.

## B2. Mouse in Command view

These gestures are fixed (one setting swaps the two drag buttons, D8).

| Gesture | Does |
|---|---|
| Left click | select. With a tool active: place |
| Left drag | box-select companies. With a tool active: draw a line or an area |
| Left double-click | on a company: select every company of the same class on screen. On anything else: centre on it and follow it |
| Shift + left click | add to the selection, or remove from it |
| Right click | the first of these that applies: cancel the drag in progress; cancel order targeting or the active tool; with a person or companies selected, order them (the target decides: ground = move; enemy = attack; your building = garrison, or for a person, work there; a block, dig mark or blueprint = work it, for a person; your caravan = escort; one of your people = follow); clear the selection. It never closes a drawer |
| Shift + right click | add the order to the queue |
| Right drag | **orbit**: left–right turns the view, up–down tilts it. It starts only once the button has been down for 120 ms *and* has moved 6 px. A right press that moved more than 6 px is never a click, however short it was |
| Middle drag | **grab the ground and pan** |
| Wheel | zoom toward the cursor |
| Shift + wheel | move the cut (C2) 1 m per step. While a pan key is held it zooms instead, so a fast pan can't move the cut. Read `deltaX` as well: some systems turn Shift + wheel sideways |

- **Directions.** The world follows the mouse. Dragging right swings the world to the right, as Q does; dragging up tips the view toward straight down. Wheel up zooms in; Shift + wheel up raises the cut. `set.ctl.tilt` flips the up–down drag only.
- **Delete** does the first of these that applies: with the Build or Zones palette open, it switches erasing on or off; with something selected, it does that thing's remove action (demolish, remove a zone, delete a route, cancel a blueprint or a dig).
- There are no right-click menus anywhere. Everything a thing can do is in its inspector.

## B3. Key bindings

Every row here appears on the key list (D8) under its group, with **Action** as its name.

### Camera (Command view)

| ID | Action | Default | Notes | Since |
|---|---|---|---|---|
| `key.cam.up` | Pan up | W | also the up arrow | 1.4 |
| `key.cam.down` | Pan down | S | also the down arrow | 1.4 |
| `key.cam.left` | Pan left | A | also the left arrow | 1.4 |
| `key.cam.right` | Pan right | D | also the right arrow | 1.4 |
| `key.cam.fast` | Pan faster | Shift | hold | 1.4 |
| `key.cam.turn-left` | Turn left | Q | hold to turn, tap to snap 45° | 1.4 |
| `key.cam.turn-right` | Turn right | E | hold to turn, tap to snap 45° | 1.4 |
| `key.cam.zoom-in` | Zoom in | = | hold | 1.4 |
| `key.cam.zoom-out` | Zoom out | - | hold | 1.4 |
| `key.cam.reset` | Reset view | Backspace | north up, default tilt | 1.4 |
| `key.cam.cut-down` | Cut lower | PageDown | 4 m; with Shift 32 m (C2). Also while playing (C4) | 1.8 |
| `key.cam.cut-up` | Cut higher | PageUp | 4 m; with Shift 32 m. Also while playing (C4) | 1.8 |
| `key.cam.cut-off` | Cut off | End | back to open sky. Also while playing (C4) | 1.8 |
| `key.cam.king` | Jump to king | Home | | M2 |
| `key.cam.alert` | Jump to alert | Space | the newest alert that has a place | M2 |
| `key.cam.prev` | Previous settlement | , | in founding order | M2 |
| `key.cam.next` | Next settlement | . | in founding order | M2 |
| `key.cam.mark-1` | Bookmark 1 | F5 | Shift + F5 saves the current view | M2 |
| `key.cam.mark-2` | Bookmark 2 | F6 | Shift + F6 saves | M2 |
| `key.cam.mark-3` | Bookmark 3 | F7 | Shift + F7 saves | M2 |
| `key.cam.mark-4` | Bookmark 4 | F8 | Shift + F8 saves | M2 |

### Command

| ID | Action | Default | Notes | Since |
|---|---|---|---|---|
| `key.cmd.build` | Build | B | opens or closes the drawer | M2 |
| `key.cmd.zones` | Zones | Z | | M2 |
| `key.cmd.dig` | Dig | C | opens the Build palette with the dig tool on (D3) | M2 |
| `key.cmd.routes` | Routes | U | | M3 |
| `key.cmd.army` | Army | G | | M4 |
| `key.cmd.realm` | Realm | K | | M2 |
| `key.cmd.trade` | Trade | T | | M3 |
| `key.cmd.rotate` | Rotate piece | R | Shift + R turns the other way | M2 |
| `key.cmd.remove` | Remove | Delete | with the Build or Zones palette open: erasing on or off. Otherwise: the selected thing's remove action (B2) | M2 |
| `key.cmd.undo` | Undo | Ctrl+Z | the last blueprint, dig mark, zone or route edit that work hasn't started on | M2 |
| `key.cmd.attack` | Attack | F | then click a target or the ground | M4 |
| `key.cmd.hold` | Hold | H | | M4 |
| `key.cmd.patrol` | Patrol | P | then click the far end | M4 |
| `key.cmd.retreat` | Retreat | X | | M4 |
| `key.cmd.find` | Find | Ctrl+K | ⌘ + K on macOS. Command view only (D10) | M2 |

Control groups are fixed: Ctrl + 1–9 assigns the selected companies, 1–9 selects that group, a second press within 300 ms jumps the camera to it, Shift + 1–9 adds the selection to the group.

### Possess

| ID | Action | Default | Notes | Since |
|---|---|---|---|---|
| `key.pos.forward` | Walk forward | W | up the screen. A double-tap of any movement key within 7 ticks sprints (B4) | 1.1 |
| `key.pos.back` | Walk back | S | | 1.1 |
| `key.pos.left` | Strafe left | A | | 1.1 |
| `key.pos.right` | Strafe right | D | | 1.1 |
| `key.pos.jump` | Jump | Space | hold to keep jumping; swims up | 1.1 |
| `key.pos.sneak` | Sneak | Left Shift | won't walk off an edge; flies down | 1.1 |
| `key.pos.sprint` | Sprint | Left Ctrl | see B1 | 1.1 |
| `key.pos.attack` | Attack or break | Left mouse | hold to keep breaking | 1.1 |
| `key.pos.use` | Use or place | Right mouse | hold to repeat every 4 ticks; raises a shield; with Sneak held it places against a container or workstation instead of opening it | 1.1 |
| `key.pos.pick` | Pick block | Middle mouse | selects the hotbar slot that holds the block you aim at, bringing it there from the pack if need be. Only a middle click that doesn't become a drag: a middle drag orbits (C4) | 1.1 |
| `key.pos.inventory` | Inventory | E | | 1.1 |
| `key.pos.drop` | Drop item | Q | hold to repeat every 4 ticks; with Left Ctrl, the whole stack (B1) | M2 |
| `key.pos.swap` | Swap hands | F | | M2 |
| `key.pos.turn-left` | Turn left | ← | turns the camera: hold to turn, tap to snap 45° (C4) | 1.1 |
| `key.pos.turn-right` | Turn right | → | | 1.1 |
| `key.pos.tilt-up` | Tilt up | ↑ | toward the horizon | 1.1 |
| `key.pos.tilt-down` | Tilt down | ↓ | toward straight down | 1.1 |
| `key.pos.active` | Active skill | Z | hold to aim, release to use; a tap uses it at once; Esc or the right mouse button cancels (`13-units-classes-power.md` §3.6) | M2 |
| `key.pos.ultimate` | Ultimate | X | | M3 |
| `key.pos.art` | Art | C | | M5 |
| `key.pos.relic-1` | First relic | V | | M4 |
| `key.pos.relic-2` | Second relic | R | | M6 |
| `key.pos.cataclysm` | Cataclysm | G | hold 1 s; a shorter press does nothing. For the Oathsworn, the hold calls the fire | M7 |
| `key.pos.band-prev` | Previous in band | , | the previous member of your band (C5) | M2 |
| `key.pos.band-next` | Next in band | . | | M2 |
| `key.pos.orders` | Order wheel | B | hold, move the mouse, release. The king, Captains, Commanders and Marshals only | M4 |
| `key.pos.office` | Office | K | the possessed official's panel | M3 |
| `key.pos.king` | Return to king | Home | possess the king | M2 |

The hotbar is fixed: 1–9 select a slot. The wheel zooms the camera (C4), so, unlike Minecraft, it doesn't move along the hotbar.

### Everywhere

| ID | Action | Default | Notes | Since |
|---|---|---|---|---|
| `key.all.mode` | Switch mode | Tab | Command ↔ Possess (C5), only while the world has the keys. In Milestone 1: king's view ↔ the free camera | 1.4 |
| `key.all.map` | Map | M | | 1.2 |
| `key.all.ledger` | Ledger | L | | M2 |
| `key.all.chat` | Chat | Enter | T also opens it in Possess. While a route is being drawn, Enter finishes the route instead (D3) | M5 |
| `key.all.hud` | Hide interface | F1 | | 1.1 |
| `key.all.shot` | Screenshot | F2 | saves a PNG and shows `toast.shot` | 1.1 |
| `key.all.debug` | Debug overlay | F3 | | 1.1 |
| `key.all.fullscreen` | Fullscreen | F11 | our own fullscreen, so the keyboard lock applies. macOS keeps F11: there, bind another key (B1) | 1.1 |

Esc is fixed (A4).

### Owner tools (every build through Milestone 4)

| ID | Action | Default | Notes | Since |
|---|---|---|---|---|
| `key.own.tools` | Tools | F4 | the Tools panel (D12) | 1.1 |
| `key.own.slower` | Fly slower | [ | steps ×1, ×2, ×4, ×8, ×16 | 1.1 |
| `key.own.faster` | Fly faster | ] | | 1.1 |

Flying is fixed, as in Minecraft's creative mode: double-tap Space within 7 ticks to start or stop, Space rises, Left Shift sinks, sprint doubles the speed.

## B4. Possess plays like Minecraft

The owner's rule: a played unit moves, digs, builds and fights like a Minecraft player in Java Edition with default settings, seen from above (`13-units-classes-power.md` §3). Where this doc is silent, do what Minecraft does, except the camera, which is C4's. The details that carry the feel:

- **Looking** is the cursor: the unit's head turns toward the aim point under it, and its view cone with it (`16-sight.md` §3.1). Only ← → ↑ ↓ and the middle drag turn the camera (C4).
- **Moving** uses the per-tick constants in `07-architecture.md` §6: walk 4.317 m/s, sprint 5.612, sneak 1.31, jump 1.25 m.
- **Sprinting** works while the unit moves within 45° of where it looks, which is Minecraft's forward. Left Ctrl, or a double-tap of any movement key within 7 ticks, starts it. It stops when the unit stops or turns farther from where it looks, hits a wall at more than 8°, lands a sprint hit, or raises a shield.
- **Breaking.** Hold to break. Ten crack stages show on the block. After a block breaks, the next one starts 6 ticks later. Progress resets if the aim leaves the block or you let go.
- **The free camera breaks and places as creative mode does:** a block breaks at once (one every 6 ticks while the button is held, no cracks), blocks never run out, picking a block gives it from nowhere, and reach is 5 m.
- **Placing.** The new block goes against the face you aim at, and its ghost (`hud.ghost`) shows there first. It fails silently if it would overlap a person. Hold to place again every 4 ticks.
- **Reach:** 4.5 m for blocks; for people and creatures, the weapon's reach (3 m for most, `13-units-classes-power.md` §3.5).
- **Attacking.** A swing has a cooldown from the weapon's attack speed. Damage scales with how far the cooldown has recovered. The indicator under the cursor shows it (D6).
- **The target outline** is a thin dark line around the block or creature the unit would touch (C4).
- **The camera** is Overhead (C4): always from above, never through the unit's eyes, over its shoulder or from the front.
- **F1** hides the interface and the target outline.

- **Stamina stands where hunger did.** Sprinting, swimming and skills spend it and rest refills it (`13-units-classes-power.md` §4.2, §5.8). At zero the unit can't sprint. Skills spend it from Milestone 2 (`13-units-classes-power.md` §11.2), and fighting from Milestone 4.

Minecraft features this game doesn't have are absent: experience orbs and enchanting tables (people level by `13-units-classes-power.md` §7), hunger, the recipe book, advancements, the creative item list (the block palette in D12 stands in for it through Milestone 4).

## B5. Rebinding

- Every row in B3 can be rebound on the key list (D8), to a key or a mouse button, with Ctrl, Shift or Alt. A key can be bound only if it prints a character or has a `keyname.*` row (E7); any other is refused with `keys.unsupported`.
- The keys a window keeps for itself (B1) are refused, with `keys.reserved`. In Possess, Left Ctrl and Left Shift can't be a binding's modifier, because they are held while moving.
- One key can serve one action per mode. A clash inside a mode is shown on both rows (`keys.clash`) and both still fire, as in Minecraft. The same key in Command view and in Possess is not a clash.
- Bindings are saved in the browser, per device.

---

# Part C · Cameras

Numbers marked *(tune)* are starting values. Change them by playing, then update this doc. Everything is frame-rate independent: integrate with the frame's real duration.

## C1. The Command camera

**The model.** Four numbers describe the view:

| Value | Meaning | Range |
|---|---|---|
| focus | the ground point at the centre of the screen | anywhere within 22 km of the world's centre |
| distance `d` | from the camera to the focus | 24 m to 6,000 m |
| yaw | compass direction of the view | any |
| tilt | angle of the view below the horizon | 20° (looking across the land) to 89° (straight down) |

The lens is a 40° vertical field of view, whatever the window's shape; resizing the window changes nothing else. The camera never rolls.

**Rays.** Several rules below ask for "the ground point under the cursor". That is where the ray through the cursor first meets something drawn: terrain, water, a building, or the cut face (C2). If it meets nothing within `4 × d` (the cursor is on the sky, or the hit is far off near the horizon), use the point where it crosses the level plane at the focus's height, and if that is also farther than `4 × d`, the point at `4 × d` along that direction.

**Panning** moves the focus across the ground, relative to the yaw (W moves toward the top of the screen).
- **Keys:** speed = `1.0 × d` per second *(tune)*, so the ground crosses the screen at the same rate at any zoom. Shift multiplies it by 2.5. The speed climbs in a straight line from nothing to full in 120 ms and falls back in 80 ms. Diagonals aren't faster.
- **Screen edge** (fullscreen only): the cursor within 8 px of an edge for 150 ms starts a pan at the key speed. Corners pan diagonally. It pauses while the cursor is over a panel or a drag is in progress.
- **Grab** (middle drag): on press, take the ground point under the cursor. While the button is down, move the focus so that point stays under the cursor, exactly. No drift after release.
- **Minimap:** a click is a jump (C3); a drag moves the focus directly (D2).

**Zooming** changes `d`.
- Zoom is continuous: `d` is multiplied by `e^(0.0016 × pixels)` of wheel travel *(tune)*, so one mouse notch (100 px) is about ×1.17 and a trackpad glides. A pinch uses its own scale directly. No single event changes `d` by more than ×1.25 (B1). `set.ctl.zoom` scales the 0.0016 after that cap is applied, and `set.ctl.pan` scales the pan speed above.
- **Zoom is toward the cursor:** the ground point under the cursor stays under the cursor, zooming in and out. If that point is more than `3 × d` from the focus, zoom toward the point at `3 × d` instead, so a shallow view can't fling the camera across the land. With `set.ctl.cursor` off, and while following, zoom is toward the focus.
- The keys zoom at the rate of six notches a second while held.
- `d` eases to its target with a 90 ms time constant. At either end it stops dead: no bounce.

**Turning and tilting.**
- **Right drag** orbits around the focus: 0.25° of yaw per pixel across, 0.20° of tilt per pixel up or down *(tune)*, in the directions B2 gives.
- **Q and E** turn at 100° per second while held. A tap shorter than 200 ms snaps to the next 45° in that direction over 180 ms.
- **Tilt is always the curve plus an offset.** The curve gives 35° at 24 m, 45° at 120 m, 58° at 600 m, 68° at 2 km and 80° at 6 km, interpolated on the logarithm of `d`: close in, you look across your town; far out, you look down at a map. Tilting by hand changes the offset, which starts at 0. The sum is clamped to 20°–89°. Zooming, jumps and following keep the offset.
- **Backspace** returns to north-up and an offset of 0 in 250 ms.

**What is eased, and what isn't.** Five things are eased: `d` (90 ms), the key-driven pan speed (the ramps above), the focus's height (300 ms, below), a followed thing's position (150 ms) and the tilt that clears terrain (70 ms, below). Everything else is computed each frame, so the anchors hold exactly: tilt comes from the curve at the current `d`; during a zoom the focus is solved so the anchor stays under the cursor; drags follow the mouse with no lag. Timed moves (the 45° snap, Backspace, glides) are their own animations, on the camera's curve (`ease-camera`, `18-look-and-feel.md` §3.1). `set.ctl.smoothing` scales the first two, the 90 ms and the pan ramps, from 0 (instant) to 2.5 times the values here; its default of 40% gives these values.

**The ground.**
- The focus rides the surface under it: the highest terrain, water or built block (under the cut: whatever is drawn there, C2), averaged over a disc of radius `0.05 × d` (4 m at least) so a narrow crack or a single tree doesn't move it. It eases to that height with a 300 ms time constant, and it never sinks faster than `d` per second, so flying over a chasm doesn't dive into it. During a grab it holds still and catches up on release.
- The camera stays at least 6 m above whatever is under it. When terrain rises into it, steepen the tilt until it clears, easing with a 70 ms time constant. If straight down still doesn't clear, lift the focus instead. Never change `d` for this.
- At the world's edge the focus stops. Nothing shakes the Command camera, ever.

**Following.** `insp.follow`, or a left double-click on anything but a company (B2), makes the focus track that thing (150 ms time constant). Zooming and orbiting keep the follow; any pan, grab or jump ends it. If the followed thing dies, leaves your coverage or, when it isn't yours, leaves your sight (`16-sight.md` §5), the follow ends where it was last seen.

**What changes with distance.** People and carts are drawn as models below `d` = 400 m and as small markers above it (`--text` for civilians, `--steel` for soldiers, `--danger` for foes). What isn't yours shows only while it is in your sight (`16-sight.md` §5.2). Above 1.5 km, settlements show a name label and one marker. World badges (D2) hide above 400 m.

## C2. Looking underground: the cut

The world goes 1.5 km down. The camera looks into it with one tool: a horizontal **cut**. The cut itself ships in phase 1.1, because Overhead needs it whenever the body goes under cover (C4); its keys and the depth gauge ship in phase 1.8, with the caves.

- **What it does.** Everything above the cut height is hidden: terrain, buildings, and creatures whose feet are above it. A creature standing below the cut is drawn whole, even where its head rises through it. Where the cut passes through solid rock, the rock is drawn as a flat, matte, dark face (`--ink-1` with 10% of the region's colour), so open space reads clearly against it. The face is one colour: it never shows what it cuts through, ore included.
- **Moving it.** PageDown and PageUp move it 4 m (32 m with Shift; held keys repeat 8 times a second). Shift + wheel moves it 1 m per step. The first PageDown from open sky puts it 4 m below the surface at the focus. End switches it off. Moving it above all terrain in view also switches it off.
- **The depth gauge** (D2) shows where the cut is, in metres and by layer. Clicking a layer on it puts the cut just under that layer's cavern roof below the screen centre (`C(x, z) − 2 m` from the WorldPlan), or at the middle of the layer where there's no cavern. For the Crust, that is halfway between the surface and the top of Layer 1 at that place.
- **The focus under a cut** rides what is drawn at the screen centre: the cut face where the cut passes through rock, and the first floor below the cut where it passes through open space.
- **Clicks hit only what is drawn.** Selection, placement and orders never reach through the cut face or pick something above the cut.
- **The cut turns on by itself** when the camera is sent to something under cover (a jump to the king, an alert or a settlement, or leaving Possess). A thing is under cover when a solid block that isn't a plant lies above its head in its own column, below the camera (leaves, vines, crops and other plants don't count; logs do). The cut is then set half a metre under the lowest such block, so the space the thing stands in is open: a house loses its roof, a tunnel its ceiling. It turns off by itself when a jump lands under open sky.
- **Light.** Under a cut, add a flat "survey light" to the space your people know, so tunnels and caverns read clearly however dark they are. It is a display aid only: it changes no game light, so nobody sees farther by it (`16-sight.md` §3.2).
- **What you may see** follows `16-sight.md` §5.4. Space your people have seen is drawn with the survey light, a fifth darker where none of them sees it now. Space they have never seen is total darkness: where the cut passes through it, the cut's face covers it as if it were rock, and below the cut every face that borders it takes the face's colour. Creatures show only while in sight. Knowledge of the deep is earned (`01-vision.md`, "Information has a cost"). In Milestone 1, always in the free camera, and with `tools.sight`, everything is known and in sight.

Engineering note: a clip height in the terrain material plus a stencil-capped section plane does this without re-meshing, from phase 1.1. The stencil cap needs closed geometry, so cap only the loaded near terrain and close it at the edge of what is loaded; beyond that, draw a flat cap at the cut height wherever far terrain rises above it, and keep the cap working across the level-of-detail seams and the two-pass depth setup from phase 1.4. From Milestone 2 the same material reads what your people know (`16-sight.md` §9.4).

## C3. Jumps

| Trigger | The camera goes to |
|---|---|
| Home | the king, at `d` = 80 m |
| Space | the newest alert that has a place, at `d` = 120 m |
| `,` and `.` | the previous or next settlement, at its hall, at `d` = 200 m |
| F5–F8 | a saved bookmark: focus, distance, yaw, tilt offset and cut exactly as saved |
| a double press of a group number | that group's centre, at the current `d` |
| a click on an alert, a list row's main action, a minimap click, `map.go` | that place, at the current `d` |

A jump of less than `3 × d` glides in 250 ms. A longer one cuts, with a 120 ms fade. Yaw and the tilt offset don't change in a jump (bookmarks excepted). The cut follows the rule in C2.

## C4. The Possess camera

A played unit is always seen from above, by **Overhead**: the Command camera of C1 locked on the unit (`13-units-classes-power.md` §3.4). It is the only Possess camera. The camera never goes inside a unit's head or behind its shoulder, and the pointer is never locked.

- The focus is the unit's feet + 1 m, following with a 100 ms time constant. `d` runs from 10 to 120 m (24 m to start) *(tune)*, the lens is C1's 40°, and the cursor stays free: it aims.
- The tilt is the player's own, 30°–85° (55° to start) *(tune)*, not C1's curve. ← and → turn (100° a second while held, a 45° snap on a tap), ↑ and ↓ tilt (60° a second), and a middle drag orbits once the button has been down 120 ms *and* moved 6 px, as B2's right drag does. The wheel zooms toward the unit, continuously as in C1. A middle click that doesn't become a drag picks a block.
- **Looking ahead.** While a bow or crossbow is drawn, a spyglass is raised or a skill is being aimed, the focus moves toward the aim point by half the distance to it, 96 m at most, following it with a 100 ms time constant, so the far end of a shot stays on screen. It eases back the same way when that ends *(tune)*.
- **Under cover, the cut follows the unit.** The unit is under cover when a solid block that isn't a plant lies above its head in its own column, below the camera (C2). The cut then sits half a metre under the lowest such block among the covered columns of the 3 × 3 patch around the unit. It comes on once the cover has held for 0.25 s and goes off once the unit has been out of cover for 0.5 s. While on, it moves down at once whenever the roof gets lower, so it never sits inside a roof, and up only when the roof is 1 m or more higher, easing over 150 ms *(tune)*. While it follows the unit, the tilt is at least 70°, so narrow tunnels read, easing over 300 ms; the player's own tilt comes back in the open. PageUp, PageDown and End move the cut by hand until the unit next walks under or out of cover. This is how the underground is played: the layers above the unit are cut away as it goes down and put back as it comes up, and what the cut opens is drawn by C2's rules.
- **Behind something.** Whenever terrain, a building or anything else stands between the camera and the unit, the unit is drawn through it as a flat silhouette (`hud.silhouette`), with its target outline, so it is never lost from view.
- The camera keeps 6 m above the surface under it (C1) and never shakes. A hit flashes the avatar red, as in Minecraft.
- **Riding:** the focus is the rider's feet + 1 m; the mount turns where it walks.
- **Under water:** the unit is seen through the water, which tints and fades it with depth; nothing else changes.
- **The free camera** (D12) uses Overhead with wider limits, so the land can be looked across: `d` from 10 to 400 m and tilt from 20° *(tune)*. For a view at eye level, it goes to a postcard (`tools.postcard`).

**Aiming** (`13-units-classes-power.md` §3.4–§3.5). The aim point is what the cursor's ray meets first (C1's rule for rays, the cut face included). The unit acts along the ray from its eyes to that point, within its reach. The target outline, the placement ghost (`hud.ghost`) and `hud.target` show only what the unit would really touch. The unit's head turns toward the aim point, so it looks where the cursor is (`16-sight.md` §3.1).

## C5. Switching between them

**Tab** switches between Command view and Possess, and only while the world has the keys (A4). In Command view it possesses the first of these that can be possessed: the selected person, the last one possessed, the king. In Possess it returns to Command view. A second Tab during a transition is ignored. Tab cancels a drag or an active tool before it switches.

- **Into Possess.** Nothing locks. The focus moves to the unit as a jump does (C3: a glide when it is near, a cut with a fade when it is far), while `d` eases to the last Overhead distance (24 m to start) and the tilt to the Overhead tilt over 400 ms *(tune)*, keeping the yaw. Then the unit takes the keys.
- **, and .** switch to the previous or next member of the Band (`13-units-classes-power.md` §3.8), skipping anyone who can't be possessed: the focus moves to them in the same way.
- **Out of Possess.** The focus is let go where it is, `d` is kept (24 m at least), and the tilt eases back to C1's curve, with no offset, over 400 ms. The cut stays where it was and from then on follows C2. The unit's own AI takes over after half a second, so the body doesn't lurch away at once.
- **If the possessed unit goes Downed or dies,** the view holds for one second and then leaves Possess in the same way, centred on where it fell. If it was the king and the king dies, the death screen follows (D9).
- **Who can be possessed** is decided by `05-systems.md` §3–§4. A refusal shows a note at the cursor (`note.possess.*`) and nothing moves.
- **With reduced motion,** every one of these is a 150 ms fade.

## C6. Other cameras

- **The map** (D7) is flat and always north-up. Left drag pans. The wheel zooms toward the cursor, continuously as in C1, from the whole world on screen down to 1 m per pixel. W A S D pan.
- **The free camera** (owner tool, D12) is an avatar in creative mode (B4): it walks, flies, breaks and places with endless blocks, seen in Overhead with its wider limits (C4). It is the only body in Milestone 1.
- **King's view in Milestone 1** is the Command camera of C1 with nothing to select: Tab switches between it and the free camera. Going in, the Command camera centres on the free camera (with the cut set as C2 says when it was under cover). Coming back, the free camera stands on what is drawn at the focus.
- **Postcard mode** is specified in `04-terrain.md` §14.3.

**Where play starts.**
- Phase 1.1: on the ground at the test world's origin, in the free camera.
- From phase 1.2: at the seed's first spawn candidate (`02-world.md` §8), or where the free camera last stood in that seed (saved with the edits).
- From Milestone 2: in Command view over the king, `d` = 80 m, north up, tilt offset 0.

## C7. Tests for the cameras

Unit tests on the camera maths (no rendering):
- After any zoom step, the ground point under the cursor is still within 2 px of the cursor, including while `d` is still easing.
- During a grab, the grabbed point stays within 2 px of the cursor.
- A ray that meets nothing gives the fallback point of C1, and never a point farther than `4 × d`; the zoom anchor is never farther than `3 × d`.
- The tilt curve returns the five values in C1, and curve plus offset never leaves 20°–89°.
- The focus can't leave the world, and `d` can't leave its range.
- The camera is never less than 6 m above the surface under it, on a cliff test scene.
- A tap of Q or E ends on a multiple of 45°.
- A right press released within 120 ms never changes yaw or tilt, and one that moved more than 6 px never counts as a click.
- A jump shorter than `3 × d` glides and a longer one cuts; neither changes yaw or the tilt offset.
- The cut: a point above it is never hit by a ray; the automatic cut leaves the target's own space open.
- The same inputs at 30 and 144 frames a second end at the same view (within 1%).
- Overhead: after 300 ms of steady movement the focus is within 0.5 m of the unit's feet + 1 m, and the outlined block is always within reach and in line of sight from the unit's eyes.
- Overhead under cover: in a tunnel two blocks high the cut opens the tunnel and sits below its roof, even while the unit jumps; standing beside a wall or a tree trunk never turns it on; walking under a one-block arch for less than 0.25 s doesn't move it; a roof 0.5 m lower moves it down at once, and one 0.5 m higher doesn't move it; in a cavern taller than the camera's height nothing is cut. The free camera's limits are 10–400 m and 20°–85°.
- Looking ahead: with a bow drawn at an aim point 60 m away, the focus settles 30 m toward it; it never moves more than 96 m.

One Playwright test drives the real page through `window.__cf.camera` (a read-only debug hook): pan, zoom, orbit, reset, and Tab in and out.

---

# Part D · The catalogue

Every screen, in the order a player meets them. Layouts are described once per screen; the tables are the complete contents. Game content (A1) lives with its data (`07-architecture.md` §5) and isn't repeated here.

## D1. Starting

### Title screen
A centred column 320 px wide on a flat `--ink-0` screen: the name, then the rows below, 16 px apart. No backdrop art.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `title.name` | title | Coldfront | — | — | the game's name in the display font, `--fs-28` | 1.1 |
| `title.seed` | field | Seed | The number the world grows from · same seed, same world | — | digits only (other keys do nothing); starts at 1, remembers the last one used, and an empty field counts as 1 | 1.1 |
| `title.random` | icon | Random seed | — | — | puts a new seed in the field | 1.1 |
| `title.world` | select | World | The test world is a small sandbox for the tools | — | owner tool, gone after Milestone 4 | 1.2 |
| `title.world.main` | row | Kaldmark | — | — | option | 1.2 |
| `title.world.test` | row | Test world | — | — | option | 1.2 |
| `title.play` | button | Play | — | Enter | the primary button; loads the world and enters fullscreen (B1) | 1.1 |
| `title.settings` | button | Settings | — | — | opens D8 | 1.4 |
| `title.signin` | button | Sign in | Uses your Discord account | — | replaces Seed and World | M5 |

### Loading
The same centred column: a Bar 320 px wide and one line under it naming the stage. No tips, no art, no percentage.

| ID | Text | When | Since |
|---|---|---|---|
| `load.plan` | Planning the world | the WorldPlan is being built | 1.2 |
| `load.terrain` | Building terrain | the first view's chunks are generating | 1.1 |
| `load.join` | Joining | waiting for the server | M5 |
| `load.failed` | The world failed to load | any stage threw; shown with `load.retry` | 1.1 |

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `load.bar` | bar | Progress | — | — | fills by work done; never runs backwards | 1.1 |
| `load.retry` | button | Try again | — | Enter | reloads the page | 1.1 |

### Season lobby
The centred column, after signing in.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `lobby.season` | stat | Season | — | — | value: `fmt.week` | M7 |
| `lobby.kings` | stat | Kings alive | — | — | | M5 |
| `lobby.lives` | bar | Lives | Lives left this season | — | pips | M7 |
| `lobby.enter` | button | Enter | — | Enter | primary; a new player goes to "Founding", a returning one to the world | M5 |
| `lobby.signout` | button | Sign out | — | — | | M5 |

### Founding a kingdom
The centred column, 360 px wide, with the crest drawn 96 px above it. Before Milestone 5 this screen doesn't exist: the king, the capital and the kingdom get generated names (`03-lore.md` §12) and a random crest.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `found.title` | segmented | Title | Shown before your name wherever others see it | — | "Queen Aoi", "King Ivar", or the name alone | M5 |
| `found.title.king` | row | King | — | — | option, the default | M5 |
| `found.title.queen` | row | Queen | — | — | option | M5 |
| `found.title.none` | row | None | — | — | option | M5 |
| `found.king` | field | Name | — | — | 3–20 letters. With the title, this is `{king}` in every template (A5). An invalid name shows `name.length` or `name.taken` under it | M5 |
| `found.capital` | field | Capital | The name of your first settlement | — | 3–20 letters | M5 |
| `found.kingdom` | field | Kingdom | Starts as your capital's name with Crown after it | — | fills itself (`fmt.crown`) until the player edits it | M5 |
| `found.crest` | canvas | Crest | — | — | the crest as others will see it | M5 |
| `found.reroll` | icon | New crest | — | — | draws another at random | M5 |
| `found.field` | select | Field | The shield's pattern | — | the crest editor replaces `found.reroll` | M8 |
| `found.charge` | select | Charge | The emblem on the shield | — | | M8 |
| `found.tincture` | select | Tincture | The shield's two colours | — | | M8 |
| `found.honour` | select | Honour | An honour you earned in an earlier season · shown after your name | — | listed only when the account has earned any (`05-systems.md` §20) | M8 |
| `found.banner` | select | Banner | A banner you earned in an earlier season | — | as above | M8 |
| `found.look` | select | Look | How your king appears · earned in earlier seasons | — | as above | M8 |
| `found.begin` | button | Begin | — | Enter | primary; goes to "Choosing ground". Disabled while a name is invalid (`name.length`, `name.taken`) | M5 |

### Choosing ground
The map (D7) fills the screen with the offered sites marked. A Panel 360 px wide at the right lists them. It appears at the first start and after each king's death. From Milestone 5 a new king is named first: the death screen leads to "Founding a kingdom", with the crest kept, and then here.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `site.row` | row | — | — | — | one offered site: its region's name, then its stats. Click selects it and centres the map on it | M2 |
| `site.water` | stat | Water | Distance to fresh water | — | | M2 |
| `site.timber` | stat | Timber | Distance to woodland | — | | M2 |
| `site.hazard` | bar | Hazard | How harsh this spot is | — | | M4 |
| `site.neighbour` | stat | Nearest king | Distance to the nearest kingdom anyone knows of | — | | M5 |
| `site.settle` | button | Settle here | — | Enter | primary; the king, twenty people and the Steward arrive there | M2 |

---

## D2. The Command view

```
┌───────────────────────────────────────────────────────────────────┐
│ ▣ Brennvik Crown ●●○                         Day 12 · Summer · Y3 │  top bar: text on the world, no panel
│                              ▲ Stenholm is out of food · 4 min ago │  alerts: up to 3 rows
│ ┃                                                    ┌───────────┐│
│ ┃ depth                                              │ inspector ││  360 px, only while something is selected
│ ┃ gauge               the world                      │           ││
│                                                      └───────────┘│
│ ┌───────┐                                                         │
│ │minimap│ ◌◌◌◌◌◌◌ [Build][Zones][Routes][Army][Realm][Trade] ▤▦✉≡ │
│ └───────┘ overlays                    command bar                 │
└───────────────────────────────────────────────────────────────────┘
```

- The top bar is 40 px of text and icons drawn straight onto the world, with a soft dark edge for legibility. It isn't a panel.
- The command bar is one Panel, 44 px tall, centred at the bottom.
- **Drawers** open from the command bar, one at a time. Build and Zones are **palettes**: a Panel 720 × 168 px directly above the bar, so the world stays clear while you place things. Routes, Army, Realm and Trade are **side panels**: a Panel 440 px wide down the left edge. The Ledger and the Map fill the screen.
- The inspector opens at the right when something is selected and closes when nothing is.

### Top bar

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `top.crest` | icon | Realm | — | K | the kingdom's crest; opens the Realm panel | M2 |
| `top.kingdom` | title | {kingdom} | — | — | the kingdom's name | M2 |
| `top.lives` | bar | Lives | Lives left this season | — | one pip per life | M7 |
| `top.king` | icon | {king} in danger | Hurt, or enemies are close · moves the view there | Home | a health ring in `--danger`; shown only while the king is hurt or enemies are near | M4 |
| `top.date` | stat | Date | A day lasts an hour · a year lasts a week | — | value: `fmt.date` (A5) | M2 |
| `top.peace` | stat | Steward's peace | Other kings can't harm your people or buildings · it ends early if you attack one | — | a new king's first 3 real days (`05-systems.md` §2); value: the time left (A5) | M5 |

### Alerts
Up to three rows under the date, newest on top (A4: they don't move under the cursor). The texts are in E1.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `alert.row` | row | — | — | — | priority icon, the news line, its age. Click jumps the camera there. Critical rows stay until clicked; the others leave after 20 s. The same line about the same place within a minute becomes one row with a count after it (`fmt.times`) | M2 |
| `alert.dismiss` | icon | Dismiss | — | — | appears on hover | M2 |
| `alert.more` | button | +{n} | All news | — | ghost button, shown when more than three are waiting; opens `realm.tab.news` | M2 |

### Minimap and overlays

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `mini.map` | canvas | Minimap | — | — | 208 px square, north always up, the camera's view drawn as an outline. Click jumps there (C3); drag moves the view; right click orders selected companies there; the wheel steps its width between 1, 4 and 16 km and the whole world. Under a cut it shows that depth. It shows what the world view shows: the land, creatures only while in sight, last-seen marks, and underground only what your people know (`16-sight.md` §5.7). From Milestone 7, Calamities near your coverage show here too | M2 |
| `mini.north` | icon | North | Turn the view north | Backspace | a needle that shows the camera's yaw | M2 |
| `mini.hide` | icon | Hide minimap | — | — | shrinks it to this button; click again to bring it back | M2 |
| `overlay.resources` | icon | Resources | Known deposits and what they yield | — | overlays are toggles in a row beside the minimap. One at a time; click again to turn it off. The world loses a third of its colour while one is on | M2 |
| `overlay.logistics` | icon | Logistics | Routes by load · amber is a bottleneck, red is broken | — | | M3 |
| `overlay.loyalty` | icon | Loyalty | Loyalty by settlement · marks people close to leaving | — | | M3 |
| `overlay.network` | icon | Network | Your coverage, its links and news on the move | — | | M4 |
| `overlay.hazards` | icon | Hazards | How strong the region's hazard is, place by place | — | | M4 |
| `overlay.territory` | icon | Territory | Borders, enemy land and the Seats you know of | — | | M4 |
| `overlay.mana` | icon | Mana | The mana grid · load, losses and storage | — | | M6 |
| `overlay.sight` | icon | Sight | Who watches where · the dead ground no one sees | — | your people's sight drawn flat on the land: a filled area for each person on watch, an outline for everyone else's cone. It also turns on by itself while a watch building is being placed, to show what its watcher would see from there (`16-sight.md` §6) | M4 |

Overlays have no legend. Every mark an overlay draws shows, on hover, the name of the thing and its number: content and numbers only.

### Depth gauge

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `depth.gauge` | canvas | Depth | — | — | a strip 12 × 240 px at the left edge, drawn to scale from the top of the world (+1,023 m) to the bottom (−1,536 m): one band for the Crust, and one for each layer below it that your people have reached (every layer in Milestone 1). A line marks the cut and a dot the focus. Click a band to cut there (C2); hovering a band shows its layer's name (content) | 1.8 |
| `depth.read` | stat | Cut | — | — | beside the gauge, only while the cut is on. Value: the cut's height (A5), then `·` and the layer's name | 1.8 |
| `depth.off` | icon | Surface | Switch the cut off | End | only while the cut is on | 1.8 |

### Command bar

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `bar.build` | button | Build | Blueprints and blocks | B | opens or closes the Build palette (D3). The open drawer's button is shown selected | M2 |
| `bar.zones` | button | Zones | Farms, stockpiles, housing and forbidden ground | Z | | M2 |
| `bar.routes` | button | Routes | Supply routes between your settlements | U | | M3 |
| `bar.army` | button | Army | Companies, armies and their orders | G | | M4 |
| `bar.realm` | button | Realm | Settlements, people, officials and policies | K | | M2 |
| `bar.trade` | button | Trade | Markets, orders and contracts | T | | M3 |
| `bar.ledger` | icon | Ledger | What you have learned about the world | L | at the bar's right end | M2 |
| `bar.map` | icon | Map | — | M | | M2 |
| `bar.chat` | icon | Chat | — | Enter | | M5 |
| `bar.menu` | icon | Menu | — | Esc | | M2 |

### Marks in the world
Drawn on the world, not in panels. All of them hide with F1.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `mark.hover` | canvas | Hover outline | — | — | a 1 px `--steel` outline on whatever under the cursor can be selected | M2 |
| `mark.selected` | canvas | Selection | — | — | a ring on the ground under a selected person or company; an outline on a selected building, zone or route | M2 |
| `mark.ping` | canvas | Order ping | — | — | where a right-click order lands: a ring that shrinks to the point and fades over 300 ms, in `--steel`, or `--danger` for an attack | M2 |
| `mark.name` | title | {name} | — | — | a name plate over a hovered or selected person or company | M2 |
| `mark.health` | bar | Health | — | — | 24 px wide over a person, only while they are hurt or selected | M4 |
| `mark.group` | chip | {n} | — | — | the control-group number beside a company | M4 |
| `mark.order` | canvas | Order line | — | — | a line from a selected company to its target. While the order is still travelling, its mark moves along the links (E3 `order.travel`) | M4 |
| `mark.ghost` | canvas | Blueprint | — | — | an unbuilt blueprint, drawn translucent | M2 |
| `mark.dig` | canvas | Dig mark | — | — | ground marked for digging: a hatched `--warn` tint | M2 |
| `mark.reveal` | canvas | Revealed | — | — | what an information skill revealed, outlined through blocks for its time, and Marked foes; then a last-seen mark (`13-units-classes-power.md` §11.8) | M2 |
| `mark.sight` | canvas | View cone | — | — | the sight of the selected person (of each member, for a company), and from Milestone 4 of a foe under the cursor: a faint fan on the ground, cut short where something blocks it, in `--steel` for yours and `--danger` for a foe's (`16-sight.md` §3) | M2 |
| `mark.aware` | canvas | Awareness | — | — | a small ring over a foe in sight that has noticed something, in `--warn`: open while it is suspicious or searching, filled while it is alert (`16-sight.md` §7.1) | M4 |
| `mark.telegraph` | canvas | Danger zone | — | — | the ground a foe's area blow will strike, fixed where it was aimed when the wind-up began (`13-units-classes-power.md` §16): its exact shape outlined in `--danger` (`--warn` for a rogue Calamity's or the world's own), with a 1 px `--ink-0` line inside, filling from the centre outward over the wind-up so it is full when the blow lands; only while one of your people sees the attacker (`18-look-and-feel.md` §8.2) | M4 |
| `mark.lastseen` | canvas | Last seen | — | — | where something was last seen: its outline, faded, for 5 minutes. Hovering names it and gives its age; a click selects it (`foe.seen`). In Milestones 2–3, only for what skills revealed; from Milestone 4, for foes too (`16-sight.md` §5.5) | M2 |
| `badge.materials` | icon | Missing materials | Something it needs isn't in reach of this settlement | — | badges float over buildings: one per building, the most serious, hidden when `d` is over 400 m | M2 |
| `badge.workers` | icon | No workers | Nobody is assigned here | — | | M2 |
| `badge.path` | icon | No way in | Workers can't reach this | — | | M2 |
| `badge.incomplete` | icon | Incomplete | A required part is missing · its inspector lists them | — | | M2 |
| `badge.paused` | icon | Paused | — | — | | M2 |
| `badge.repair` | icon | Needs repair | Integrity is below half | — | | M4 |
| `badge.unfit` | icon | Unfit here | This region asks more of a building · its inspector says what | — | | M4 |
| `badge.fire` | icon | On fire | — | — | | M4 |
| `badge.span` | icon | Unsafe span | Digging here would bring the ceiling down · add pillars or beams | — | on dig marks | M4 |
| `badge.dark` | icon | Cut off | No link to your capital · news and orders go by rider | — | drawn over the settlement's hall | M4 |

---

## D3. Tools

A tool is active from the moment something is picked in a palette until it's cancelled. While a tool is active the cursor is `crosshair` and left click places. Right click steps back out of a drag, then out of the tool (B2). Esc does the same and then closes the drawer (A4).

### Build palette
Category tabs across the top of the palette. Under them, two rows of tiles that scroll sideways, and at the right a column 168 px wide: the search field, with the icon buttons under it.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `build.search` | field | Search | — | — | filters every category by name. It takes the keys only after a click, and gives them back when a tile is picked (A4) | M2 |
| `build.cat.homes` | tab | Homes | — | — | categories are tabs; each lists templates and parts from the building data | M2 |
| `build.cat.storage` | tab | Storage | — | — | | M2 |
| `build.cat.food` | tab | Food | — | — | | M2 |
| `build.cat.works` | tab | Workshops | — | — | | M2 |
| `build.cat.roads` | tab | Roads | — | — | roads, bridges, docks; rails and lifts later | M3 |
| `build.cat.defence` | tab | Defence | — | — | | M4 |
| `build.cat.network` | tab | Network | — | — | towers, rider posts, relays | M4 |
| `build.cat.mana` | tab | Mana | — | — | | M6 |
| `build.cat.machines` | tab | Machines | — | — | machines, conveyors, inserters | M6 |
| `build.cat.blocks` | tab | Blocks | — | — | single blocks, for freeform building | M2 |
| `build.item` | slot | — | — | — | one tile, 48 px, per template or block. Click picks it up as a ghost. Its tooltip is the building tooltip below | M2 |
| `build.rotate` | icon | Rotate | — | R | turns the ghost 90° | M2 |
| `build.remove` | icon | Remove | Erase blueprints and dig marks that work hasn't started on | Delete | a toggle: while on, click or drag over ghosts and marks to erase them | M2 |
| `build.dig` | icon | Dig | Mark ground to be dug out · drag a rectangle | C | a toggle. While on, the two controls below take the tiles' place and a drag marks ground | M2 |
| `dig.mode` | segmented | Mode | — | — | | M2 |
| `dig.down` | row | Down | — | — | option, the default: digs down by Depth from what is drawn inside the rectangle (the surface, or the cut face) | M2 |
| `dig.level` | row | Level | — | — | option: removes everything inside the rectangle that stands above the height where the drag began, up to the cut when one is on | M2 |
| `dig.depth` | stepper | Depth | — | — | 1–16 m, default 2. Shown for Down | M2 |

**The building tooltip** (assembled from several rows, A2): the name; one line saying what it does (content, A2); its materials as icons with counts; for a single block, its `tip.span` to `tip.rot` lines (E3); and, when the region under the cursor asks more of it, `tip.build.needs`.

**Placing**
- The ghost snaps to the block grid and rests on the surface or against the block face under the cursor: the same rule as placing a block in Possess.
- Its tint says whether it can go there: `--steel` yes; `--warn` yes, but something is missing (it will wait); `--danger` no. A Note at the cursor gives the reason (E2).
- A click places one and keeps the tool. Pieces that run (walls, fences, roads, conveyors, rails, conduits) are dragged from end to end, straight or at 45°. Floors are dragged as rectangles. During a drag the Note shows the count and the materials (`note.build.run`).
- A network building's Note says whether it will join your network from there (`note.build.link`, `note.build.nolink`).
- R turns the piece. The wheel still zooms, and every camera control still works.
- A placed blueprint stays as a ghost until it's built. Selecting it opens its inspector (D4).
- Ctrl + Z takes back the last piece if nobody has started work on it.

**Digging**
- With Dig on, drag a rectangle over the ground. The Note shows its size and how many blocks it holds (`note.dig.size`), and the marked blocks take a hatched `--warn` tint.
- **Down** takes the ground down by Depth from what is drawn there. On the surface that is a pit or a foundation. On a cut face (C2) it is a room or a corridor carved that deep into the rock under the cut, which is how mines and tunnels are laid out.
- **Level** takes away everything inside the rectangle above the height where the drag began: a terrace, or a hill removed.
- Diggers work from the top down and carry what the blocks yield to a stockpile. They leave what they can't reach, and what would bring a ceiling down (`05-systems.md` §13): those marks show `badge.path` or `badge.span`.
- Dig and Remove are one choice: turning either on turns the other off, and picking a tile turns both off.
- A marked area can be selected like a blueprint (D4) and is named by `dig.name`. Remove erases marks, and Ctrl + Z takes back the last one, while nobody has started on it.

### Zones palette

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `zone.farm` | button | Farm | Crops grow here · needs farmers and seed | — | picks the zone to paint | M2 |
| `zone.stockpile` | button | Stockpile | Goods are stored here · an unguarded pile can be looted | — | | M2 |
| `zone.housing` | button | Housing | Ground kept free for homes | — | | M2 |
| `zone.forbidden` | button | Forbidden | Your people stay out | — | | M2 |
| `zone.remove` | icon | Remove | Erase zones | Delete | a toggle, as in the Build palette | M2 |

**Painting.** Drag a rectangle on the ground. It follows the terrain, shows its size in a Note (`note.zone.size`), and merges with a touching zone of the same kind. Each zone is tinted by kind and named by `zone.name`. Selecting a zone opens its inspector.

### Routes panel
A side panel: `route.new` at the top, then the list.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `route.title` | title | Routes | — | — | | M3 |
| `route.new` | button | New route | Click each stop in order · Enter finishes | — | primary; starts the route tool | M3 |
| `route.row` | row | — | — | — | one route: its two ends (`fmt.route`), its cargo's icon, loads a day, a state chip. Click selects it (its inspector opens, the camera frames it) | M3 |
| `route.state.running` | chip | Running | — | — | | M3 |
| `route.state.waiting` | chip | Waiting | Nothing to carry right now | — | | M3 |
| `route.state.stalled` | chip | Stalled | No haulers, or the way is blocked | — | | M3 |
| `route.state.raided` | chip | Raided | Attacked in the last few days | — | | M4 |
| `route.state.paused` | chip | Paused | — | — | | M3 |
| `route.auto` | chip | Auto | Made by your Quartermaster | — | | M3 |

**Drawing a route.** Click a stockpile, hall, dock or trading post to add it as a stop. Click the ground to bend the route through that point. Ctrl + Z removes the last point. Enter or a double-click finishes; right click or Esc abandons it. The finished route shows the path haulers will really take.

---

## D4. The inspector

One Panel, 360 px wide, at the right edge between the top bar and the command bar. It shows whatever is selected and is the only place a thing's actions live.

- **Header:** the name (`--fs-16`), then one line of kind in `--text-2`, made only of content and numbers (for a person: class and level, age, home, as in "Smith 14 · 34 · Stenholm"). `insp.follow`, `insp.rename` (where renaming is allowed) and `insp.close` sit at the right.
- **Tabs** appear only when they have something to show. Most things have Overview alone.
- **Order inside a tab:** state chip, Bars, Stats, controls, then actions. The one primary action is first among the actions.
- **Places and people named in a row are links:** a click selects them and moves the camera.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `insp.tab.overview` | tab | Overview | — | — | | M2 |
| `insp.tab.work` | tab | Work | — | — | | M2 |
| `insp.tab.inventory` | tab | Inventory | — | — | | M2 |
| `insp.tab.history` | tab | History | — | — | dated lines, newest first (E6) | M2 |
| `insp.follow` | icon | Follow | Keep the view on this | — | a toggle (C1) | M2 |
| `insp.rename` | icon | Rename | — | — | turns the name into a Field; Enter keeps it, Esc drops it. Settlements, zones, routes, companies and armies | M2 |
| `insp.close` | icon | Close | — | Esc | deselects | M2 |
| `insp.many` | title | {n} selected | — | — | several companies selected: this title, a row per company, and the order buttons | M4 |

### A person

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `person.possess` | button | Possess | Take direct control | Tab | primary. Disabled outside your connected coverage, where they are cut off, and for the Steward; the reason is the matching `note.possess.*` row | M2 |
| `person.loyalty` | bar | Loyalty | Under 40 they work slower · under 20 they may leave | — | 0–100, with a trend arrow | M3 |
| `loyalty.why` | table | Causes | — | — | under the loyalty Bar: the six causes (`cause.*`, E7), each with how hard it pushes up or down | M3 |
| `person.health` | bar | Health | — | — | | M2 |
| `person.needs` | bar | Needs met | The share of their tier's needs you are meeting | — | | M2 |
| `needs.list` | table | Needs | — | — | under that Bar: each need of their tier (content), ticked or crossed | M2 |
| `person.tier` | chip | {tier} | — | — | one of the `tier.*` words (E7) | M3 |
| `person.condition` | chip | {condition} | — | — | one chip per condition (content, `13-units-classes-power.md` §6). The tooltip is its effect | M2 |
| `person.rank` | chip | {rank} | — | — | their trade rank in their class's trade, or a soldier's military rank: one of the `rank.*` words (E7), or their office (`office.*`) | M2 |
| `person.grade` | chip | {grade} | — | — | one of the `grade.*` words (E7) | M2 |
| `person.sworn` | chip | Sworn unit | Played by a fallen king | — | on a sworn unit in your kingdom | M7 |
| `person.sex` | stat | Sex | — | — | value: one of the `sex.*` words (E7) | M2 |
| `person.age` | stat | Age | — | — | | M2 |
| `person.home` | stat | Home | — | — | a link | M2 |
| `person.workplace` | stat | Workplace | — | — | a link | M2 |
| `person.household` | stat | Household | — | — | links to each member | M2 |
| `person.doing` | stat | Doing | — | — | the task line (E6) | M2 |
| `person.stats` | table | Stats | — | — | the six Stats below, three across and two down | M2 |
| `stat.strength` | stat | Strength | Carrying, mining, melee | — | | M2 |
| `stat.agility` | stat | Agility | Speed, ranged weapons, riding | — | | M2 |
| `stat.endurance` | stat | Endurance | Health, stamina, resisting hazards | — | | M2 |
| `stat.intellect` | stat | Intellect | Crafting, management, learning | — | | M2 |
| `stat.will` | stat | Will | Steadier loyalty and morale | — | | M2 |
| `stat.affinity` | stat | Affinity | Magic · 15 or more can train as a mage | — | | M2 |
| `person.traits` | chip | {trait} | — | — | one chip per trait; the tooltip is the trait's effect (content) | M2 |
| `person.class` | select | Class | The trade they work · listed best fit first | — | every class they could take (content). A military class sends them to drill first | M2 |
| `person.pin` | toggle | Pinned | Keeps this class until you unpin them | — | | M2 |
| `person.level` | stat | Level | — | — | | M2 |
| `person.xp` | bar | Experience | Toward their next level · played people learn three times as fast | — | | M2 |
| `person.promote` | button | Promote | Make them Elite · it uses one of your places | — | shown at level 30. Disabled while the gate isn't met, with the reason (`why.grade` or `why.places`). Other grades come by themselves (`13-units-classes-power.md` §9.1) | M3 |
| `person.points` | stat | Points | Points to place in their stats · one comes every five levels | — | shown while they have any | M2 |
| `stat.raise` | icon | Raise | Puts one point here · it can't be undone | — | beside each of the six Stats while `person.points` shows | M2 |
| `person.role` | select | Role | Their place in a fight | — | soldiers only | M4 |
| `role.assault` | row | Assault | Hits harder and presses in · less armour | — | option | M4 |
| `role.guard` | row | Guard | Tougher, blocks more and keeps someone safe | — | option | M4 |
| `role.support` | row | Support | Stronger heals and longer buffs · stays behind the line | — | option | M4 |
| `role.secondary` | row | Secondary | Finishes and fills gaps · works a day trade when stood down | — | option | M4 |
| `person.ward` | select | Guarding | Who or what this Guard keeps safe | — | Guards only: a person, a building or a banner, or click one in the world | M4 |
| `person.daytrade` | select | Day trade | The civilian work they do when stood down | — | Secondary soldiers only | M4 |
| `person.advanced` | select | Advanced class | Their path as an Elite soldier · it can't be changed | — | shown once, on promotion to Elite | M5 |
| `person.speciality` | select | Speciality | Faster, finer work on one line · slower on the rest | — | Elite civilians | M3 |
| `person.background` | select | Background | A Knack kept from an earlier trade | — | the classes they reached Adept in; a second pick from Champion | M3 |
| `person.deed` | bar | Deed | {deed} | — | progress toward their class's deed (content); hidden once it's done | M3 |
| `person.resolve` | bar | Resolve | Fills as they work, fight or heal · an Ultimate spends it all | — | | M3 |
| `person.trialinfo` | stat | Trial | — | — | the Trial their class must pass (content), shown at the top of Elite | M4 |
| `person.trial` | button | Begin trial | Possess them and take the Trial · winning it makes them a Champion | — | disabled with no Champion place free (`why.places`) | M4 |
| `person.binding` | bar | Binding | — | — | while a relic is being bound at a hearth-shrine: an in-game hour | M4 |
| `person.rite` | button | Marrow Rite | Make them a Paragon without a relic · it burns rare goods for a day | — | danger button; *confirm* (`confirm.rite`). Disabled while goods are missing (`why.missing`) or with no High Hearthkeeper or Hearthkeeper of Master rank near (`why.official`) | M6 |
| `person.rankup` | button | Raise rank | Make them a Corporal, Sergeant or Lieutenant | — | soldiers only; disabled with no place open (`why.rank`) | M4 |
| `person.flame` | bar | Flame | Their second life · their upkeep feeds it | — | Calamities only | M7 |
| `person.oath` | button | Swear the oath | A Calamity for one day · then they burn | — | danger button; *confirm* (`confirm.oath`). Assault soldiers of Champion grade or higher, at a hearth-shrine, with the king or the High Hearthkeeper near | M7 |
| `person.fire` | button | Call the fire | They become a Calamity for one day · then they burn | — | danger button; *confirm* (`confirm.fire`). The Oathsworn only | M7 |
| `person.nature` | chip | {nature} | — | — | Calamities only: its nature (`nature.*`, E7; `13-units-classes-power.md` §15.3) | M7 |
| `person.hold` | bar | Hold | How firmly this Calamity answers to you · feed it or it breaks loose | — | Calamities only (§15.8 of doc 13), with `hold.wilful` or `hold.restless` beside it under 60 or under 30 | M7 |
| `hold.wilful` | chip | Wilful | Takes only orders that serve what it wants | — | | M7 |
| `hold.restless` | chip | Restless | Ignores your orders · close to breaking loose | — | | M7 |
| `person.wage` | stepper | Wage | Paid each day from the treasury · less than a rival offers loosens its hold | — | Sellswords only, in Marks; never under the Gilding's wage | M7 |
| `person.offer` | stat | Best offer | The highest wage another king offers it | — | Sellswords only, while an offer stands | M7 |
| `person.stronghold` | stat | Stronghold | — | — | Bastions only: the keep it is sworn to; a click jumps there | M7 |
| `person.band` | toggle | In your band | Keeps them on the band list for quick switching | — | disabled at eight (`why.band`) | M2 |
| `person.appoint` | select | Appoint | Give them an office | — | lists the offices they could hold (`office.*`, E7); choosing one appoints them. Hidden when none is open to them | M3 |
| `person.training` | bar | Training | How far along they are | — | while they drill for a military class | M4 |
| `person.skills` | slot | Skills | — | — | Work tab: one Slot per skill they hold (Knack, Active, Ultimate, Art, Mastery, relics, Cataclysm, and the skill of any office or post they hold). The tooltip is the skill tooltip: its name, its slot word (`slot.*`), its line (content), then the `tip.skill.*` lines that apply, with items in a cost written by their names and a reach by its distances only; `tip.skill.cost` is left out where `tip.skill.resolve` applies. Clicking a ready active skill uses it, turning the cursor into a target where it needs one. A **played only** skill's Slot has no click and no autocast toggle. A locked Slot shows what opens it (`why.skill`) | M2 |
| `person.autocast` | toggle | On their own | They use this skill when it suits · Ultimates start off | — | under each active skill's Slot | M2 |
| `person.proficiencies` | table | Proficiencies | — | — | Work tab: every proficiency above 0 as a Bar with its trade rank (`rank.*`), highest first | M2 |
| `person.worn` | slot | Worn | — | — | Inventory tab: what they wear and hold. Read-only here; change it by possessing them | M2 |
| `person.pack` | slot | Pack | — | — | Inventory tab: what they carry | M2 |
| `captive.recruit` | button | Recruit | They join you with low loyalty | — | captives only | M5 |
| `captive.ransom` | button | Ransom | Offer them back to their king for coin | — | opens a deal (D5) with this captive already under "You give". Disabled without an Envoy (`why.official`) | M5 |
| `captive.release` | button | Release | — | — | | M5 |
| `sway.bribe` | button | Bribe | An envoy carries coin to them | — | another king's person or a neutral village, when you can see them. It opens `sway.amount` and `sway.send` in its place. Disabled without an Envoy (`why.official`) | M5 |
| `sway.amount` | stepper | Coin | — | — | in Marks | M5 |
| `sway.send` | button | Send | — | — | primary; also sends a gift (below) | M3 |
| `sworn.dismiss` | button | Dismiss | Ends their place in your kingdom | — | danger button, no confirmation; on a sworn unit | M7 |

### A building, or a blueprint

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `state.building` | chip | Being built | — | — | the state chip shows one of these | M2 |
| `state.working` | chip | Working | — | — | | M2 |
| `state.waiting` | chip | Waiting for goods | — | — | | M2 |
| `state.unstaffed` | chip | No workers | — | — | | M2 |
| `state.incomplete` | chip | Incomplete | A required part is missing | — | | M2 |
| `state.paused` | chip | Paused | — | — | | M2 |
| `state.damaged` | chip | Damaged | — | — | | M4 |
| `state.abandoned` | chip | Abandoned | Nobody holds it · it decays faster | — | | M4 |
| `building.integrity` | bar | Integrity | Falls a little every day · repairs use materials | — | | M4 |
| `building.requires` | table | Requires | — | — | the parts and conditions this building type needs, each ticked or crossed. Regional requirements (`05-systems.md` §13) are listed here with the rest | M2 |
| `building.staff` | stepper | Workers | How many people may work here | — | 0 to the building's limit; starts at the limit | M2 |
| `building.priority` | segmented | Priority | High is supplied and staffed first | — | | M2 |
| `prio.low` | row | Low | — | — | option | M2 |
| `prio.normal` | row | Normal | — | — | option, the default | M2 |
| `prio.high` | row | High | — | — | option | M2 |
| `building.pause` | toggle | Paused | Work stops · decay doesn't | — | | M2 |
| `building.repair` | button | Repair now | Puts its repairs ahead of other work | — | shown when integrity is under 100%. Disabled without the materials (`why.missing`) | M4 |
| `building.demolish` | button | Demolish | Workers take it apart and keep the materials | Delete | danger button; *confirm* (`confirm.demolish`) | M2 |
| `blueprint.built` | bar | Built | — | — | blueprints only | M2 |
| `blueprint.needs` | table | Materials | — | — | each material and how much has arrived (`fmt.of`) | M2 |
| `blueprint.cancel` | button | Cancel blueprint | Delivered materials go back to a stockpile | Delete | danger button, no confirmation | M2 |
| `dig.left` | stat | Left | — | — | a marked dig (D3): value `fmt.blocks`. Its inspector also has `building.priority` | M2 |
| `dig.cancel` | button | Cancel digging | — | Delete | danger button, no confirmation | M2 |
| `recipe.row` | row | — | — | — | Work tab of a workshop: one recipe: what it makes, from what, how long | M2 |
| `recipe.mode` | select | Make | Until stocked stops at the target | — | per recipe | M2 |
| `recipe.off` | row | Off | — | — | option | M2 |
| `recipe.until` | row | Until stocked | — | — | option | M2 |
| `recipe.always` | row | Always | — | — | option | M2 |
| `recipe.target` | stepper | Target | Stop when the settlement's stores hold this many | — | shown for "Until stocked" | M2 |
| `building.stock` | table | Stock | — | — | Inventory tab: what is inside, waiting to be used or carried off | M2 |
| `machine.rate` | stat | Rate | Items a minute, now and at its best | — | machines and conveyors | M6 |
| `machine.wear` | bar | Wear | Parts wear out · upkeep uses spares | — | | M6 |
| `machine.operator` | stat | Operator | — | — | a link, where the machine needs one | M6 |
| `sorter.filter` | select | Filter | The goods this sorter lets through | — | | M6 |
| `lift.warded` | chip | Warded | People can ride it without ascent sickness | — | lifts | M6 |

### Storage and zones

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `store.allowed` | button | Allowed goods | Which goods may be stored here | — | opens a column of Toggles in the panel, one per group of goods | M2 |
| `store.allow.group` | toggle | {group} | — | — | one group of goods (content); on by default | M2 |
| `store.contents` | table | Contents | — | — | each good and its amount | M2 |
| `store.target.row` | row | — | — | — | one target: the two controls below, on one line | M2 |
| `store.target.good` | select | Good | — | — | | M2 |
| `store.target.amount` | stepper | Keep | — | — | | M2 |
| `store.target.add` | button | Add target | Haulers keep at least this many here | — | | M2 |
| `store.target.remove` | icon | Remove target | — | — | on hover of a target row | M2 |
| `farm.crop` | select | Crop | — | — | farm zones | M2 |
| `zone.delete` | button | Remove zone | — | Delete | danger button, no confirmation | M2 |

### A settlement
Selected by clicking its hall or its name label.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `town.people` | stat | People | — | — | the total; from Milestone 3, the three tiers after it | M2 |
| `town.beds` | stat | Free beds | — | — | | M2 |
| `town.food` | stat | Food | Days of food in its stores at today's appetite | — | value: `fmt.days` | M2 |
| `town.fuel` | stat | Fuel | Days of fuel for its hearths | — | value: `fmt.days`. Shown in cold regions and in winter | M2 |
| `town.loyalty` | bar | Loyalty | The average here | — | with `loyalty.why` under it | M3 |
| `town.needs` | bar | Needs met | — | — | one Bar per tier that lives here, each with `needs.list` under it | M2 |
| `town.noise` | bar | Noise | Industry, deep mining and battle draw enemy scouts | — | | M4 |
| `town.reeve` | stat | Reeve | — | — | the Reeve's name as a link, or `town.noreeve` | M2 |
| `town.appoint` | select | Appoint | Choose a Reeve to run this settlement | — | shown when there is none: lists candidates, best manager first | M2 |
| `town.jobs` | table | Jobs | — | — | Work tab. Columns: `col.class`, `col.filled`, `col.open` | M2 |
| `town.stock` | table | Stock | — | — | Inventory tab: everything in all its stores | M2 |

### A route

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `routeinfo.load` | stat | Each day | — | — | loads a day, last three days | M3 |
| `routeinfo.danger` | bar | Danger | From attacks on this route in the last few days | — | | M4 |
| `routeinfo.transport` | select | Transport | — | — | porters, pack animals, carts and the rest, as they become available | M3 |
| `routeinfo.haulers` | stepper | Haulers | — | — | starts at 2 | M3 |
| `rule.row` | row | — | — | — | one cargo rule: the three controls below, on one line | M3 |
| `rule.good` | select | Carry | — | — | | M3 |
| `rule.amount` | stepper | Up to | The most to carry on one trip | — | | M3 |
| `rule.below` | stepper | When below | Carry only while the far end holds fewer than this · 0 means always | — | | M3 |
| `rule.add` | button | Add rule | — | — | | M3 |
| `rule.remove` | icon | Remove rule | — | — | on hover of a rule row | M3 |
| `routeinfo.escort` | select | Escort | A company that travels with each load | — | | M4 |
| `routeinfo.pause` | toggle | Paused | — | — | | M3 |
| `routeinfo.takeover` | button | Take over | Stops your Quartermaster changing this route | — | routes marked Auto only | M3 |
| `routeinfo.delete` | button | Delete route | — | Delete | danger button; *confirm* (`confirm.route`) | M3 |

### A company, or an army

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `co.strength` | stat | Strength | — | — | value: `fmt.of` | M4 |
| `co.classes` | stat | Classes | — | — | what its soldiers are, by class (content) | M4 |
| `co.role` | select | Role | Sets the role of every soldier in it | — | the four `role.*` options | M4 |
| `co.skills` | slot | Skills | — | — | the skills its members share. A click orders every member who has it ready (`13-units-classes-power.md` §3.7) | M4 |
| `co.morale` | bar | Morale | Falls with losses and fear · rises near officers and the king | — | | M5 |
| `co.loyalty` | bar | Loyalty | Decides who stands, falls back or gives up when morale breaks | — | the average of its soldiers | M5 |
| `co.refill` | toggle | Refill | Replaces losses from its home settlement | — | default on | M4 |
| `co.supply` | stat | Supplies | Days of food it carries | — | | M4 |
| `co.order` | stat | Order | — | — | its current order; while a new one is still travelling, its arrival time after it (`fmt.in`) | M4 |
| `co.formation` | segmented | Formation | — | — | | M4 |
| `formation.line` | row | Line | — | — | option | M4 |
| `formation.column` | row | Column | — | — | option | M4 |
| `formation.loose` | row | Loose | — | — | option | M4 |
| `co.standing` | select | Standing order | What its Captain does when it has no order | — | | M4 |
| `standing.train` | row | Train | — | — | option | M4 |
| `standing.patrol` | row | Patrol | — | — | option | M4 |
| `standing.garrison` | row | Garrison | — | — | option | M4 |
| `standing.none` | row | Nothing | — | — | option | M4 |
| `standing.down` | row | Stood down | Its Secondary soldiers go to their day trades | — | option | M4 |
| `order.move` | button | Move | Right click does the same | — | the eight order buttons form a 4 × 2 grid. Pressing one turns the cursor into a target: left click sets it, Esc cancels | M4 |
| `order.attack` | button | Attack | Go there and fight whatever is in the way | F | | M4 |
| `order.hold` | button | Hold | Stay and defend this spot | H | acts at once, no target | M4 |
| `order.patrol` | button | Patrol | Walk between here and a second point | P | | M4 |
| `order.escort` | button | Escort | Guard a caravan or another company | — | | M4 |
| `order.siege` | button | Siege | Break walls and gates with siege engines | — | disabled without engines (`why.engines`) | M5 |
| `order.garrison` | button | Garrison | Man a building or a tower | — | | M4 |
| `order.retreat` | button | Retreat | Fall back to the nearest keep | X | acts at once, no target | M4 |
| `army.detach` | button | Detach | The selected company leaves this army | — | armies only | M5 |

Orders travel (A4). After an order that will take more than 2 s to arrive, a Note says when it will: `note.order.sent`, or `note.order.rider` when it has to go by rider. A new company is named by `co.name`, a new army by `army.name`.

### The ground, and things that aren't yours

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `tile.block` | stat | Block | — | — | selected by clicking bare ground | M2 |
| `tile.region` | stat | Region | — | — | | M2 |
| `tile.height` | stat | Height | — | — | above sea level (A5) | M2 |
| `tile.deposit` | stat | Deposit | — | — | only where one is known | M2 |
| `tile.hazard` | bar | Hazard | — | — | the hazard's name beside the Bar | M4 |
| `tile.holder` | stat | Held by | — | — | the kingdom whose coverage this is | M5 |
| `insp.read` | button | Read | — | — | inscriptions and murals: opens its entry in the Ledger | M4 |
| `village.leaning` | bar | Leaning | How close this village is to swearing to you | — | neutral villages | M3 |
| `village.gift` | button | Send a gift | Goods from your nearest store · they lean your way | — | opens `gift.good`, `gift.amount` and `sway.send` in its place; a caravan carries it | M3 |
| `gift.good` | select | Good | — | — | | M3 |
| `gift.amount` | stepper | Amount | — | — | | M3 |
| `node.radius` | stat | Coverage | — | — | network buildings: its radius (A5) | M4 |
| `node.linked` | chip | Linked | — | — | network buildings show one of these | M4 |
| `node.cut` | chip | Cut off | No chain of links reaches your capital | — | | M4 |
| `node.unstaffed` | chip | Unstaffed | — | — | | M4 |
| `node.unfuelled` | chip | No fuel | — | — | | M4 |
| `node.drained` | chip | No mana | — | — | | M6 |
| `node.capture` | bar | Capture | Hold it unopposed for 60 s to take it | — | while your people stand in a node that isn't yours | M5 |
| `foe.strength` | stat | Strength | — | — | enemies: an estimate (`fmt.about`) | M4 |
| `foe.seen` | stat | Last seen | — | — | shown when the sighting is old; value is an age | M4 |
| `warden.tier` | stat | Tier | — | — | Wardens | M4 |
| `warden.health` | bar | Health | — | — | once it has been engaged | M4 |
| `warden.feeds` | table | Feeds on | — | — | the regeneration sources you have found, each `feed.standing` or `feed.broken` | M4 |
| `feed.standing` | chip | Standing | — | — | | M4 |
| `feed.broken` | chip | Broken | — | — | | M4 |
| `warden.share` | stat | Your share | Your part of the damage, protection and broken feeds so far | — | once you have fought it; a percentage | M5 |
| `other.kingdom` | stat | Kingdom | — | — | another king's people and buildings; a relation chip follows | M5 |
| `rel.ally` | chip | Ally | — | — | | M5 |
| `rel.pact` | chip | Pact | — | — | | M5 |
| `rel.trade` | chip | Trade partner | — | — | | M5 |
| `rel.bot` | chip | Bot | A king the game plays | — | beside a bot king's name wherever kings are named (`17-simulation-and-bots.md` §6.5) | M5 |
| `cargo.contents` | table | Cargo | — | — | caravans, pay chests and piles on the ground | M3 |
| `cargo.arrives` | stat | Arrives | — | — | | M3 |
| `mana.output` | stat | Output | — | — | mana parts | M6 |
| `mana.load` | bar | Load | — | — | | M6 |
| `mana.charge` | bar | Charge | — | — | | M6 |
| `mana.attuner` | select | Attuner | The mage who keeps this running · renewed every few days | — | | M6 |
| `mana.renew` | stat | Attunement | Runs out unless its mage comes back | — | value: the time left (A5) | M6 |
| `ward.radius` | stat | Radius | — | — | | M6 |
| `ward.upkeep` | stat | Upkeep | — | — | | M6 |
| `hearth.congregation` | stat | Congregation | People living near its linked shrines · 300 are needed to kindle | — | the Great Hearth (`13-units-classes-power.md` §15.3) | M7 |
| `hearth.upkeep` | stat | Upkeep | Offerings it burns each day | — | | M7 |
| `hearth.stores` | stat | Offerings | Days of offerings in the capital's stores | — | value: `fmt.days` | M7 |
| `hearth.kindle` | select | Kindle | Begin seven days of kindling for a Paragon of level 60 | — | candidates; choosing one is *confirm* (`confirm.kindle`). Disabled while the Hearth is cold (`why.cold`) or the congregation is short (`why.congregation`) | M7 |
| `hearth.kindling` | bar | Kindling | — | — | the days and offerings of a Kindling in progress | M7 |
| `hearth.gild` | select | Gild | Begin seven days of gilding for a Paragon of level 60 · coin, not worship | — | candidates; choosing one is *confirm* (`confirm.gild`). Disabled while the Hearth is cold (`why.cold`) or the treasury is short (`why.coin`) | M7 |
| `hearth.gilding` | bar | Gilding | — | — | the days and coin of a Gilding in progress | M7 |
| `keep.ward` | select | Swear a Bastion | Seven days of warding for a Guard Paragon of level 60 · bound here for good | — | on a keep that can hold one (the capital's keep, or the hall a Governor runs a province from: `13-units-classes-power.md` §15.3); candidates; choosing one is *confirm* (`confirm.ward`). Disabled while the walls or the garrison fall short (`why.stronghold`) | M7 |
| `keep.warding` | bar | Warding | — | — | the days and offerings of a Warding in progress | M7 |
| `rite.waiting` | chip | Waiting | The world holds nine Calamities · it completes when a place frees | — | beside a finished Kindling, Gilding or Warding while nine places are taken (`13-units-classes-power.md` §15.5) | M7 |
| `calamity.offer` | button | Make an offer | Offer it a daily wage · it walks to the best offer when its hold breaks | — | another kingdom's Sellsword, or a rogue one, in your sight, while you have room for one (`13-units-classes-power.md` §15.5); shows `offer.wage` and `offer.send` in its place, or `offer.withdraw` while your offer stands. Seven days of the wage are set aside from your treasury while it stands | M7 |
| `offer.wage` | stepper | Wage | — | — | Marks a day | M7 |
| `offer.send` | button | Send | — | Enter | primary; the offer travels as an order does (A4) and stands until withdrawn | M7 |
| `offer.withdraw` | button | Withdraw | — | — | ends your standing offer; the wage set aside returns to the treasury | M7 |

---

## D5. Side panels and pages

### Realm
A side panel with tabs across its top.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `realm.tab.overview` | tab | Overview | — | — | | M2 |
| `realm.tab.people` | tab | People | — | — | | M2 |
| `realm.tab.officials` | tab | Officials | — | — | | M3 |
| `realm.tab.policies` | tab | Policies | — | — | | M3 |
| `realm.tab.treasury` | tab | Treasury | — | — | | M3 |
| `realm.tab.news` | tab | News | — | — | | M2 |
| `realm.tab.kings` | tab | Kings | — | — | | M5 |
| `realm.people` | stat | People | — | — | Overview: the total, then the three tiers | M2 |
| `realm.coin` | stat | Treasury | Coin in all your strongrooms | — | | M3 |
| `realm.reputation` | stat | Reputation | How far word of your kingdom travels · it draws wanderers | — | | M3 |
| `realm.score` | stat | Score | — | — | value: `fmt.score` | M7 |
| `realm.towns` | table | Settlements | — | — | columns: `col.name`, `col.people`, `col.food`, and from Milestone 3 `col.loyalty`. A row's main action selects the settlement | M2 |
| `realm.grades` | table | Grades | — | — | each grade from Tempered up: how many hold it and, from Elite, the places (`fmt.of`). Columns: `col.grade`, `col.held` | M3 |
| `people.search` | field | Search | — | — | People tab | M2 |
| `people.show` | select | Show | — | — | | M2 |
| `people.all` | row | Everyone | — | — | option | M2 |
| `people.idle` | row | Idle | — | — | option | M2 |
| `people.standouts` | row | Standouts | — | — | option | M2 |
| `people.officials` | row | Officials | — | — | option | M3 |
| `people.band` | row | Your band | — | — | option | M2 |
| `people.elite` | row | Elite and above | — | — | option | M3 |
| `people.mages` | row | Mages | — | — | option | M6 |
| `people.soldiers` | row | Soldiers | — | — | option | M4 |
| `people.captives` | row | Captives | — | — | option | M5 |
| `people.table` | table | People | — | — | columns: `col.name`, `col.class`, `col.level`, `col.age`, `col.home`, and from Milestone 3 `col.tier` and `col.loyalty`. A row's main action selects the person | M2 |
| `post.row` | row | — | — | — | Officials tab: one office: its name, its holder or `post.vacant`, and a load Bar | M3 |
| `post.vacant` | chip | Vacant | — | — | | M3 |
| `post.load` | bar | Load | Past full, they do the job less well | — | | M3 |
| `post.appoint` | select | Appoint | — | — | lists candidates, best manager first; choosing one appoints them | M3 |
| `post.dismiss` | icon | Dismiss | — | — | on hover of a held office | M3 |
| `policy.wages` | title | Wages | — | — | Policies tab: a group of Steppers, in Marks a day | M3 |
| `policy.wage.peasant` | stepper | Peasants | — | — | starts at 1 | M3 |
| `policy.wage.craftsman` | stepper | Craftsmen | — | — | starts at 2 | M3 |
| `policy.wage.soldier` | stepper | Soldiers | — | — | starts at 2 | M4 |
| `policy.wage.official` | stepper | Officials | — | — | starts at 5 | M3 |
| `policy.wage.mage` | stepper | Mages | — | — | starts at 10 | M6 |
| `policy.taxes` | title | Taxes | — | — | | M3 |
| `policy.tax.wage` | slider | Wage tax | Taken from every wage you pay | — | 0–50%, default 10 *(tune)* | M3 |
| `policy.tax.market` | slider | Market tax | Taken from every sale at your markets | — | 0–50%, default 10 *(tune)* | M3 |
| `policy.rations` | segmented | Rations | Short stretches the food and costs loyalty | — | | M3 |
| `rations.short` | row | Short | — | — | option | M3 |
| `rations.normal` | row | Normal | — | — | option, the default | M3 |
| `rations.full` | row | Full | — | — | option | M3 |
| `policy.stock` | title | Stock targets | — | — | a list of `store.target.row` rows that every settlement tries to keep | M3 |
| `policy.ultimates` | toggle | Ultimates freely | Lets your people use Ultimates on their own judgement | — | default off (`13-units-classes-power.md` §11.6) | M3 |
| `treasury.rooms` | table | Strongrooms | — | — | Treasury tab. Columns: `col.place`, then the two coin glyphs | M3 |
| `treasury.mint` | stat | Mint | — | — | coins struck a day | M3 |
| `treasury.payday` | stat | Next payday | — | — | | M3 |
| `treasury.chests` | table | Pay chests | — | — | each chest on the road. Columns: `col.to`, `col.arrives` | M3 |
| `treasury.income` | stat | Income | — | — | with a sparkline of the last seven days | M3 |
| `treasury.spending` | stat | Spending | — | — | with a sparkline | M3 |
| `newsfilter.show` | segmented | Show | — | — | News tab: a filter above the full list of alert rows | M2 |
| `newsfilter.all` | row | All | — | — | option | M2 |
| `newsfilter.important` | row | Important | — | — | option | M2 |
| `newsfilter.critical` | row | Critical | — | — | option | M2 |
| `kings.offers` | title | Offers | — | — | Kings tab: heads the offers you have received, when there are any | M5 |
| `kings.offer.row` | row | — | — | — | one offer: who sent it, and its age. Click opens it in the deal form with `deal.accept` and `deal.decline` | M5 |
| `kings.row` | row | — | — | — | crest, kingdom, king, relation chip. Click selects a king and shows the actions below | M5 |
| `kings.offer` | button | Offer a deal | — | — | primary; opens the deal form | M5 |
| `kings.whisper` | icon | Whisper | — | — | opens chat to that king | M5 |
| `kings.invite` | button | Invite | Offer a fallen king a place as one sworn unit | — | shown for eliminated kings | M7 |
| `kings.break` | button | Break treaty | — | — | danger button; *confirm* (`confirm.treaty`) | M5 |

**The deal form** replaces the Kings list inside the panel. Two lists, "You give" and "You get", each built with `deal.add`.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `deal.back` | icon | Back | — | — | returns to the list and drops the draft | M5 |
| `deal.give` | title | You give | — | — | | M5 |
| `deal.get` | title | You get | — | — | | M5 |
| `deal.add` | select | Add | — | — | adds a line to that list | M5 |
| `deal.goods` | row | Goods | — | — | option: adds a line with `deal.line.good`, `deal.line.amount` and `deal.line.post` | M5 |
| `deal.line.good` | select | Good | — | — | | M5 |
| `deal.line.amount` | stepper | Amount | — | — | | M5 |
| `deal.line.post` | select | Trading post | Where it changes hands | — | | M5 |
| `deal.coin` | row | Coin | — | — | option: adds a line with the two Steppers below, each labelled by its coin glyph | M5 |
| `deal.line.crowns` | stepper | Crowns | — | — | | M5 |
| `deal.line.marks` | stepper | Marks | — | — | | M5 |
| `deal.access` | row | Access | They may use your roads, docks and lifts | — | option | M5 |
| `deal.captive` | row | Captive | — | — | option: someone you hold, or one of yours that they hold | M5 |
| `deal.treaty` | row | Treaty | — | — | option: one of the three below | M5 |
| `treaty.alliance` | row | Alliance | You see what each other's people see | — | option | M5 |
| `treaty.pact` | row | Non-aggression pact | — | — | option | M5 |
| `treaty.trade` | row | Trade agreement | — | — | option | M5 |
| `deal.remove` | icon | Remove line | — | — | on hover of a line | M5 |
| `deal.send` | button | Send offer | It reaches them as news does | — | primary. Disabled while both lists are empty (`why.empty`) | M5 |
| `deal.accept` | button | Accept | — | — | on an offer you received | M5 |
| `deal.decline` | button | Decline | — | — | | M5 |

### Army
A side panel: `army.new` at the top, then a list of armies with their companies nested under them, then companies in no army.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `army.title` | title | Army | — | — | | M4 |
| `army.row` | row | — | — | — | one company or army: name, strength, its order, and from Milestone 5 a morale Bar. Click selects it | M4 |
| `army.new` | button | New company | — | — | primary; opens the controls below in place of the list | M4 |
| `army.new.captain` | select | Captain | — | — | candidates, best first | M4 |
| `army.new.size` | stepper | Soldiers | — | — | 10–50, starts at 20 | M4 |
| `army.new.home` | select | Home | The settlement its soldiers are drawn from | — | | M4 |
| `army.new.class` | select | Class | What they train as · their gear comes from that settlement's stores | — | military classes (content) | M4 |
| `army.new.raise` | button | Raise | — | — | primary. Disabled with nobody fit to be its Captain (`why.candidate`) or too few people (`why.people`) | M4 |
| `army.join` | button | Form army | Joins the selected companies under a Marshal | — | opens `army.join.marshal` in its place. Disabled with fewer than two companies selected (`why.select`), or with nobody fit to be Marshal (`why.candidate`) | M5 |
| `army.join.marshal` | select | Marshal | — | — | candidates, best first; choosing one forms the army | M5 |
| `army.disband` | button | Disband | — | — | danger button; *confirm* (`confirm.disband`) | M4 |

### Trade
A side panel with tabs.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `trade.tab.prices` | tab | Prices | — | — | | M3 |
| `trade.tab.board` | tab | Board | — | — | | M5 |
| `trade.tab.contracts` | tab | Contracts | — | — | | M5 |
| `prices.market` | select | Market | — | — | Prices tab: which settlement's market | M3 |
| `prices.table` | table | Prices | — | — | columns: `col.good`, `col.price` (with a sparkline), `col.stock` | M3 |
| `board.side` | segmented | Side | — | — | Board tab: which orders to list | M5 |
| `board.buying` | row | Buying | — | — | option | M5 |
| `board.selling` | row | Selling | — | — | option | M5 |
| `board.search` | field | Search | — | — | | M5 |
| `board.table` | table | Orders | — | — | columns: `col.good`, `col.amount`, `col.each`, `col.kingdom`, `col.post` | M5 |
| `board.take` | button | Take order | Makes a contract · goods and coin must reach the trading post | — | for the selected order. Disabled without the coin or the goods (`why.coin`, `why.missing`) | M5 |
| `board.withdraw` | button | Withdraw | — | — | for a selected order of your own | M5 |
| `board.post` | button | Post order | — | — | primary; opens the form below in place of the table | M5 |
| `form.side` | segmented | Side | — | — | | M5 |
| `form.buy` | row | Buy | — | — | option | M5 |
| `form.sell` | row | Sell | — | — | option | M5 |
| `form.good` | select | Good | — | — | | M5 |
| `form.amount` | stepper | Amount | — | — | | M5 |
| `form.price` | stepper | Price each | — | — | in Marks | M5 |
| `form.post` | select | Trading post | Where the goods and coin meet | — | | M5 |
| `form.submit` | button | Post | — | — | primary | M5 |
| `form.cancel` | button | Cancel | — | — | | M5 |
| `contract.row` | row | — | — | — | Contracts tab: good, amount, the other kingdom, a state chip | M5 |
| `contract.goods` | chip | Awaiting goods | — | — | | M5 |
| `contract.coin` | chip | Awaiting coin | — | — | | M5 |
| `contract.road` | chip | On the road | — | — | | M5 |
| `contract.settled` | chip | Settled | — | — | | M5 |
| `contract.failed` | chip | Failed | A failed delivery costs reputation | — | | M5 |

### The Ledger
A full-screen page: a column of tabs at the left (200 px), a list of entries (280 px), and the open entry (560 px wide at most). An entry is its name and the lines found so far. Entries that haven't been found aren't listed.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `ledger.title` | title | Ledger | — | — | | M2 |
| `ledger.close` | icon | Close | — | L | | M2 |
| `ledger.tab.regions` | tab | Regions | — | — | | M2 |
| `ledger.tab.resources` | tab | Resources | — | — | | M2 |
| `ledger.tab.writings` | tab | Inscriptions | — | — | | M4 |
| `ledger.tab.wardens` | tab | Wardens | — | — | | M4 |
| `ledger.tab.chronicle` | tab | Chronicle | — | — | the season's history, newest first (E5) | M7 |
| `ledger.tab.standings` | tab | Standings | — | — | | M7 |
| `ledger.tab.feats` | tab | Feats | — | — | achievements: name, and the date earned or a progress Bar | M7 |
| `ledger.tab.kings` | tab | Ledger of Kings | — | — | past seasons | M7 |
| `ledger.entry` | row | — | — | — | one entry in the list | M2 |
| `standings.board` | select | Board | — | — | | M7 |
| `standings.overall` | row | Overall | — | — | option | M7 |
| `standings.slayers` | row | Slayers | — | — | option | M7 |
| `standings.realms` | row | Realms | — | — | option | M7 |
| `standings.wealth` | row | Wealth | — | — | option | M7 |
| `standings.warlords` | row | Warlords | — | — | option | M7 |
| `standings.table` | table | Standings | — | — | columns: `col.rank`, `col.kingdom`, `col.score` | M7 |

---

## D6. Possess

The screen is the world, seen from above. The interface is Minecraft's, element for element, with stamina where hunger was and the unit's skills beside the hotbar. The cursor aims, so there is no crosshair.

```
                    ┌ Warden card (only in a Warden fight, D9) ┐         ▲ alerts (D2)

  Hale Brandt ▬▬ band
  Aiko Mori   ▬▬                         ↖            the cursor aims
                                        ▂▂            attack indicator, under the cursor

  [chat lines]              ▬▬▬▬▬▬▬ health   stamina ▬▬▬▬▬▬▬
  Hale Brandt · Smith       [1][2][3][4][5][6][7][8][9]   [Z][X][C][V][R][G]
                            ▬▬▬▬▬▬▬▬▬▬▬▬▬ 14 ▬▬▬▬▬▬▬▬▬▬▬▬▬  level, experience
```

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `hud.outline` | canvas | Target outline | — | — | a thin dark line around the block or creature the unit would touch, within reach (C4) | 1.1 |
| `hud.silhouette` | canvas | Silhouette | — | — | the played unit drawn through whatever hides it from the camera, as a flat `--steel` shape with its target outline (C4) | 1.1 |
| `hud.ghost` | canvas | Placement ghost | — | — | a faint copy of the held block on the face it would go on | 1.1 |
| `hud.aim` | canvas | Skill shape | — | — | while a skill key is held, or a skill is being ordered from the inspector: its circle, cone or line on the ground, in `--steel` | M2 |
| `hud.cracks` | canvas | Break progress | — | — | ten crack stages drawn on the block being broken. Not in the free camera, which breaks at once (B4) | M2 |
| `hud.hotbar` | slot | Hotbar | — | — | nine Slots, bottom centre. The selected one has a 2 px `--text` frame. Counts and durability as in A3 | 1.1 |
| `hud.item` | title | {item} | — | — | the held item's name, above the hotbar for 2 s after switching slot, then fading for 0.5 s | 1.1 |
| `hud.offhand` | slot | Off hand | — | — | left of the hotbar, only while it holds something | M2 |
| `hud.health` | bar | Health | — | — | above the hotbar's left half, 6 px tall, `--danger` fill. It shakes when under a fifth | M2 |
| `hud.stamina` | bar | Stamina | — | — | above the hotbar's right half, `--ok` fill. Sprinting and swimming spend it; at zero the unit can't sprint (B4) | M2 |
| `hud.air` | bar | Air | — | — | above Mana, or stamina, only under water | M2 |
| `hud.armour` | bar | Armour | — | — | above health, only while wearing any. The bars on the left stack upward: health, armour, Flame, hazard | M4 |
| `hud.cooldown` | bar | Attack indicator | — | — | 16 px wide under the cursor, only while a swing is recovering | M4 |
| `hud.hazard` | icon | Hazard | — | — | the hazard's icon and a Bar of exposure, above the highest bar on the left, only while exposed | M4 |
| `hud.unit` | title | {name} · {class} | — | — | bottom left, `--fs-13` | M2 |
| `hud.condition` | chip | {condition} | — | — | beside `hud.unit`: the unit's conditions, as in its inspector (`person.condition`) | M2 |
| `hud.back` | keycap | Command view | — | Tab | a Keycap and these words beside `hud.unit`, shown for 4 s on entering Possess, the first three times on a device (A2) | M2 |
| `hud.target` | title | {name} | — | — | under the cursor after it has rested 150 ms on a person, workstation or container within reach. Switched by `set.ui.targets` | M2 |
| `hud.reach` | chip | {n} in reach | — | — | beside `hud.unit` while playing the king, a Captain, a Commander or a Marshal: soldiers inside the command radius (96, 64, 96 or 160 m). The radius is a faint ring on the ground | M4 |
| `hud.skills` | slot | Skills | — | — | up to six Slots right of the hotbar, each with its Keycap: a sweep while it recovers, and the Ultimate's Slot filling as Resolve grows | M2 |
| `hud.xp` | bar | Experience | — | — | under the hotbar, its full width | M2 |
| `hud.level` | stat | Level | — | — | the level, centred just above `hud.xp`, as Minecraft draws it | M2 |
| `hud.mana` | bar | Mana | — | — | above stamina, `--mana` fill, for units that use Mana. The bars on the right stack upward: stamina, Mana, air | M6 |
| `hud.flame` | bar | Flame | — | — | above armour, or health, `--warn` fill, for a Calamity | M7 |
| `hud.band` | row | Band | — | — | at the left edge, one Row per member of the band: name and a Health Bar; the one being played is selected | M2 |
| `hud.trial` | bar | Trial | — | — | while a Trial runs: how far along it is | M4 |
| `band.fresh` | chip | Fresh | Their first light today is unspent · they learn five times as fast for a while | — | beside a band member who hasn't been played this in-game day | M2 |
| `hud.sworn` | chip | Sworn to {kingdom} | — | — | beside `hud.unit` for an eliminated player's one unit | M7 |

Chat lines (D10) sit above `hud.unit`. Alerts (D2) show at the top right as they do in Command view, and can be clicked. Toasts and the Steward's line keep their place (A3). Nothing else is ever on this screen: no date, no minimap, no quest text, no prompts. The free camera's screen has only `hud.outline`, `hud.silhouette`, `hud.ghost`, `hud.hotbar` and `hud.item`: every other row here belongs to possessing a person.

### Inventory (E)
A centred Panel nine Slots wide (392 px with its padding). The world stays visible and dimmed 40% behind it; the unit stops moving while it's open. E or Esc closes it.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `inv.worn` | title | Worn | — | — | six Slots: head, body, legs, feet, off hand and back (`15-item-library.md` §1.9) | M2 |
| `inv.charms` | slot | Charms | — | — | one Slot, two from Elite | M2 |
| `inv.relics` | slot | Relics | — | — | one Slot from Champion, two from Paragon. Taking off a bound relic or the Broken Crown is *confirm* (`confirm.unbind`) | M4 |
| `inv.pack` | title | Pack | — | — | 27 Slots, then the nine hotbar Slots under an 8 px gap | M2 |
| `inv.load` | stat | Load | Past the limit you walk slower | — | value: `fmt.of`, in kg | M2 |
| `inv.handwork` | title | Handwork | — | — | a list of the simple recipes that need no workshop | M2 |
| `inv.recipe` | row | — | — | — | one recipe: what it makes and from what. Click makes one; Shift + click makes as many as the pack allows. Disabled while something is missing (`why.missing`) | M2 |

**Every Slot behaves as in Minecraft:**
- Left click picks up, puts down or swaps a stack. Right click picks up half, or puts down one.
- Shift + click sends a stack to the other section (pack ↔ hotbar; pack ↔ an open container).
- Double-click gathers matching items into the held stack. Shift + double-click sends every stack of that item to the other section.
- Dragging with the left button spreads the held stack evenly over the Slots crossed; with the right button, one each.
- Over a Slot: 1–9 swaps with that hotbar slot, F with the off hand, Q drops one, Ctrl + Q drops the stack.
- Clicking outside the Panel drops the held stack on the ground.
- **The item tooltip** appears at once (no delay): the name; then only the lines that apply, from E3 (`tip.*`); then one line of flavour for rare items (content).

### Containers and workstations
Using a chest, cart, crate or stockpile block opens its Slots above the pack in the same Panel, under the container's name. Using a workstation opens the list below above the pack.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `box.slots` | slot | Contents | — | — | the container's Slots | M2 |
| `work.recipe` | row | — | — | — | one recipe this workstation offers: what it makes, from what, how long. Click makes one; Shift + click keeps making until something runs out. Disabled while something is missing (`why.missing`) | M2 |
| `work.progress` | bar | Progress | — | — | under the list while something is being made. Leaving the screen stops the work | M2 |

### The order wheel (hold B)
Only while playing the king, a Captain, a Commander or a Marshal. Hold B: after 100 ms four wedges appear around the cursor, and the unit keeps looking where it looked when B went down. Move the mouse 24 px toward a wedge to light it; release B to give that order; release in the middle to give none. The order reaches every soldier of that officer inside the command radius at once (`05-systems.md` §3).

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `wheel.follow` | wedge | Follow me | — | — | top | M4 |
| `wheel.charge` | wedge | Charge | — | — | right: attack what was at the aim point when B went down, or straight ahead | M4 |
| `wheel.hold` | wedge | Hold here | — | — | bottom | M4 |
| `wheel.pursue` | wedge | Pursue | — | — | left: run down whoever is fleeing | M4 |

### The office (K)
Possessing an official and pressing K opens the Realm panel (D5) limited to that official's own jurisdiction, with the office's skill as a Slot at its top, used as in `person.skills`. Esc or K closes it.

---

## D7. The map

Full screen, flat, north up (C6). A bar 44 px tall along the bottom holds the controls.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `map.view` | canvas | Map | — | — | regions, water, your coverage, what you know of enemy land, settlements, the descents your people have found, markers. Drag pans; the wheel zooms; hovering names the thing under the cursor; from Milestone 7, Calamities within 2 km of your coverage, live (`13-units-classes-power.md` §15.1) | 1.2 |
| `map.layer` | tab | {layer} | — | — | one tab per layer, top-left: the surface, then each layer your people have reached (every layer in Milestone 1 and for the free camera) | 1.8 |
| `map.where` | stat | Position | — | — | bottom left, follows the cursor. Value: the two coordinates, then `·` and the region's name | 1.2 |
| `map.scale` | canvas | Scale | — | — | a scale bar, bottom right | 1.2 |
| `map.pin` | canvas | Chosen spot | — | — | a click chooses a spot and marks it. A double-click does `map.go` (or `map.teleport`) at once | 1.2 |
| `map.teleport` | button | Teleport | Puts the free camera at the chosen spot | Enter | primary; owner tool through Milestone 4, shown when the map was opened from the free camera | 1.2 |
| `map.go` | button | Go here | Moves the Command view to the chosen spot | Enter | primary; shown when the map was opened from Command view. Closes the map | 1.4 |
| `map.mark` | button | Add marker | — | — | puts a named marker on the chosen spot | M2 |
| `map.mark.name` | field | Name | — | — | appears in the bar after `map.mark`; Enter keeps it | M2 |
| `map.mark.remove` | button | Remove marker | — | Delete | shown when the chosen spot is a marker | M2 |
| `map.close` | icon | Close | — | M | top right | 1.2 |

From Milestone 2 the overlay toggles (D2) appear at the left of the bar and draw on the map as they do on the world. A region's name appears on the map once your people have entered it; in Milestone 1, and for the free camera, every name shows.

On a layer's tab the chosen spot is on that layer: the cavern floor at that place, or the nearest open space in the layer below it. Teleport and Go here take you there, and Go here sets the cut as C2 says.

---

## D8. Menu, settings and keys

### Menu (Esc)
The centred column (320 px, as on the title screen) of Buttons over the dimmed world. No title.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `menu.resume` | button | Resume | — | Esc | primary. Esc closes the menu too, but only the click can bring back fullscreen (B1) | 1.1 |
| `menu.settings` | button | Settings | — | — | | 1.4 |
| `menu.guide` | button | Guide | — | — | opens the player guide in a new tab | M8 |
| `menu.title` | button | Quit to title | — | — | replaced by `menu.leave` from Milestone 5 | 1.1 |
| `menu.licences` | button | Licences | The open-source code this game uses | — | opens the notices page (`/licenses/`, `07-architecture.md` §8) in a new tab | 1.1 |
| `menu.leave` | button | Leave | Your kingdom carries on without you | — | returns to the season lobby | M5 |

In Milestones 1–4 the world pauses while the menu is open. From Milestone 5 it never pauses.

### Settings
A centred Panel 560 px wide: tabs across the top, one column of rows. Each row is a label at the left and its control at the right. Every change applies at once (A4).

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `set.back` | icon | Back | — | Esc | | 1.4 |
| `set.tab.video` | tab | Video | — | — | | 1.4 |
| `set.tab.controls` | tab | Controls | — | — | | 1.4 |
| `set.tab.interface` | tab | Interface | — | — | | 1.4 |
| `set.tab.audio` | tab | Audio | — | — | | 1.10 |
| `set.reset` | button | Reset all | — | — | bottom of the panel; *confirm* (`confirm.reset`) | 1.10 |
| `set.video.quality` | select | Quality | Sets the rows below together | — | changing any row below switches this to Custom | 1.10 |
| `quality.low` | row | Low | — | — | option | 1.10 |
| `quality.medium` | row | Medium | — | — | option, the default | 1.10 |
| `quality.high` | row | High | — | — | option | 1.10 |
| `quality.custom` | row | Custom | — | — | option | 1.10 |
| `set.video.distance` | slider | Render distance | Full-detail terrain around you · costs frame rate | — | 128–384 m in steps of 32, default 192 (`04-terrain.md` §13.5) | 1.4 |
| `set.video.reach` | slider | Far terrain | How far distant land is drawn · costs memory | — | 2–16 km, default 16 | 1.4 |
| `set.video.shadows` | select | Shadows | — | — | | 1.4 |
| `shadows.off` | row | Off | — | — | option | 1.4 |
| `shadows.near` | row | Near | — | — | option | 1.4 |
| `shadows.far` | row | Near and far | — | — | option, the default | 1.4 |
| `set.video.bloom` | toggle | Bloom | Glow around lava, crystal and lamps | — | default on | 1.4 |
| `set.video.haze` | toggle | Distance haze | The air that fades far land · off helps slow machines | — | default on | 1.4 |
| `set.video.presence` | slider | Presence effects | How strongly great powers tint, darken and hush the world · effects in play stay | — | 0–100%, default 100 (`16-sight.md` §11) | M4 |
| `set.video.scale` | slider | Resolution | Draws fewer pixels and scales them up · helps slow machines | — | 50–100%, default 100 | 1.10 |
| `set.video.limit` | select | Frame limit | Lower saves battery | — | | 1.10 |
| `limit.30` | row | 30 | — | — | option | 1.10 |
| `limit.60` | row | 60 | — | — | option | 1.10 |
| `limit.screen` | row | Screen rate | — | — | option, the default | 1.10 |
| `set.ctl.fullscreen` | toggle | Fullscreen on play | Lets Left Ctrl sprint without closing the tab | — | default on (B1) | 1.4 |
| `set.ctl.sprint` | segmented | Sprint | — | — | | 1.10 |
| `set.ctl.sneak` | segmented | Sneak | — | — | | 1.10 |
| `hold.hold` | row | Hold | — | — | option for both, the default | 1.10 |
| `hold.toggle` | row | Toggle | — | — | option for both | 1.10 |
| `set.ctl.doubletap` | toggle | Double-tap sprint | Tap a movement key twice to sprint | — | default on | 1.10 |
| `set.ctl.autojump` | toggle | Auto-jump | Hops up one-block steps without pressing jump | — | default off | 1.10 |
| `set.ctl.pan` | slider | Pan speed | — | — | 50–200%, default 100 (C1) | 1.10 |
| `set.ctl.zoom` | slider | Zoom speed | — | — | 50–200%, default 100 | 1.10 |
| `set.ctl.smoothing` | slider | Camera smoothing | 0 is instant | — | 0–100%, default 40 | 1.10 |
| `set.ctl.edge` | toggle | Edge panning | Moves the view when the cursor touches a screen edge · fullscreen only | — | default on | 1.10 |
| `set.ctl.cursor` | toggle | Zoom to cursor | Off zooms toward the middle of the screen | — | default on | 1.10 |
| `set.ctl.swap` | toggle | Swap drag buttons | Middle drag orbits and right drag pans | — | default off | 1.10 |
| `set.ctl.tilt` | toggle | Invert tilt | — | — | default off | 1.10 |
| `set.ctl.keys` | button | Key list | — | — | opens the key list | M2 |
| `set.ui.scale` | slider | Interface size | — | — | 80–150% in steps of 10, default 100 | 1.4 |
| `set.ui.motion` | select | Motion | Reduced turns slides and camera moves into quick fades | — | | 1.10 |
| `motion.system` | row | As the system | — | — | option, the default | 1.10 |
| `motion.full` | row | Full | — | — | option | 1.10 |
| `motion.reduced` | row | Reduced | — | — | option | 1.10 |
| `set.ui.targets` | toggle | Target names | Names the person or workstation you look at | — | default on | M2 |
| `set.ui.minimap` | toggle | Minimap | — | — | default on | M2 |
| `set.ui.alerts` | select | Alerts shown | The rest still reach the news list | — | | M2 |
| `alerts.all` | row | All | — | — | option, the default | M2 |
| `alerts.important` | row | Important | — | — | option | M2 |
| `alerts.critical` | row | Critical only | — | — | option | M2 |
| `set.ui.chat` | toggle | Chat | Show other kings' messages | — | default on | M5 |
| `set.audio.master` | slider | Volume | — | — | 0–100%, default 80 | 1.10 |
| `set.audio.music` | slider | Music | — | — | | M8 |
| `set.audio.ambience` | slider | Ambience | — | — | | M8 |
| `set.audio.effects` | slider | Effects | — | — | | M8 |
| `set.audio.interface` | slider | Interface | — | — | | M8 |
| `set.audio.background` | toggle | Mute in background | Silent while the window isn't in front | — | default on | M8 |

Rows are grouped only on the Controls tab, under two group titles:

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `set.group.possess` | title | Possess | — | — | fullscreen, sprint, sneak, double-tap, auto-jump | 1.10 |
| `set.group.camera` | title | Camera | — | — | pan speed through invert tilt, then `set.ctl.keys` | 1.10 |

### The key list
Replaces the settings rows inside the same Panel. One row per binding in B3, under the five group titles, in B3's order.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `keys.back` | icon | Back | — | Esc | returns to the Controls tab | M2 |
| `keys.group.camera` | title | Camera | — | — | | M2 |
| `keys.group.command` | title | Command | — | — | | M2 |
| `keys.group.possess` | title | Possess | — | — | | M2 |
| `keys.group.all` | title | Everywhere | — | — | | M2 |
| `keys.group.owner` | title | Owner tools | — | — | gone after Milestone 4 | M2 |
| `keys.bind` | keycap | Change key | Click, then press the new key · Esc cancels | — | the row's current key as a Keycap button. While waiting it reads `keys.listening` | M2 |
| `keys.default` | icon | Default | Put this key back | — | on rows that differ from the default | M2 |
| `keys.clear` | icon | Clear key | Leave this action with no key | — | on hover of a row that has a key | M2 |
| `keys.reset` | button | Reset keys | — | — | *confirm* (`confirm.keys`) | M2 |

---

## D9. Moments

### Discovery card
On first entering a region: its name in the display font (`--fs-28`), the first sentence of its story under it (`--fs-16`, `03-lore.md` §11), centred a quarter of the way down the screen, straight onto the world. A Court-speech name shows its kanji above it in `--font-kanji`. It fades in over 300 ms, holds 4 s, fades out over 300 ms, and never blocks input. Ships in phase 1.2. It has no strings of its own: all of it is content.

### Warden card
Top centre while a Warden is engaged: the name and title in the display font, the line `card.warden` under it, and a Bar 480 px wide. A Court-speech name shows its kanji beside it. When the Warden dies, its last words (content, `03-lore.md` §9) take the second line's place for 6 s, and then the card fades out over 300 ms. Ships in Milestone 4.

The King Below isn't a Warden, so his card has no second line. It reads "The King Below" until that player's kingdom has found his name, and his name and that title after (A5).

### The Steward's line
One line of world voice (E4) in the Toast's place (A3), `--fs-16`, for 6 s; a toast waits while it shows. Where E4 names a control for the line, that control gets a 1 px `--steel` outline for the same 6 s. One line at a time; a second waits its turn. Ships in Milestone 2.

### A king's death, and after

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `death.lives` | bar | Lives | Lives left this season | — | pips under `moment.death` | M7 |
| `death.next` | button | Begin again | — | Enter | primary; goes to "Choosing ground" (D1), and from Milestone 5 through "Founding a kingdom" first | M2 |
| `out.offer` | row | — | — | — | after the last life: one row per king who has invited you (`fmt.ruler`). A king can have one invitation out at a time | M7 |
| `out.buy` | button | Buy a life | Up to two a season · opens the payment page | — | shown while the account may still buy one (`05-systems.md` §21) | M8 |
| `out.join` | button | Join | You play one sworn unit · no command | — | on the selected offer | M7 |
| `out.leave` | button | Leave | — | — | | M7 |
| `frost.table` | table | Standings | — | — | the final standings under `moment.frost`. Columns as in `standings.table` | M7 |
| `frost.honours` | chip | {honour} | — | — | each honour the player earned this season (content, `05-systems.md` §20) | M7 |
| `frost.leave` | button | Leave | — | Enter | | M7 |

Each of these is a full dimmed screen with a centred column: the moment's line from E4 in the display font, then the rows above.

---

## D10. Chat and Find

### Chat
Bottom left, above the minimap (Command view) or above `hud.unit` (Possess): up to eight lines, each fading 10 s after it arrives. Enter opens the Field; Enter again sends; Esc closes. While it's open the wheel scrolls back through the history and Tab changes channel.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `chat.field` | field | Message | — | Enter | 200 characters at most | M5 |
| `chat.channel` | segmented | Channel | — | Tab | left of the Field | M5 |
| `chat.all` | row | All | — | — | option | M5 |
| `chat.allies` | row | Allies | — | — | option, shown when you have an alliance | M5 |
| `chat.whisper` | row | {king} | — | — | option, after `kings.whisper` | M5 |
| `chat.line` | row | — | — | — | `fmt.says`, with the name in the kingdom's colour | M5 |

### Find (Ctrl + K)
Command view only. A Field 480 px wide, centred a fifth of the way down, with up to eight result rows under it. Typing filters; the arrow keys move; Enter does the row's main action; Esc closes.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `find.field` | field | Find | — | — | | M2 |
| `find.row` | row | — | — | — | an icon and a name. Actions run; places, people and buildings are selected and the camera goes to them | M2 |
| `find.actions` | title | Actions | — | — | group titles, shown only over groups that have results | M2 |
| `find.places` | title | Places | — | — | | M2 |
| `find.people` | title | People | — | — | | M2 |
| `find.buildings` | title | Buildings | — | — | | M2 |

Find's actions are the command bar's entries, the overlays, every Camera and Command action in B3, and the menu's rows, each under its Label. Nothing else is an action.

---

## D11. When something is wrong

Full-screen states are a centred column on `--ink-0`: one line from the table, then a Button where there is one. Banners are one line at the top centre of the play screen.

| ID | Text | When | Since |
|---|---|---|---|
| `sys.nogl` | This browser can't start WebGL2 · turn on hardware acceleration, then reload | full screen; no WebGL2 context | 1.1 |
| `sys.small` | Make the window larger to play | full screen; the window is under 1024 × 600 | 1.1 |
| `sys.storage` | This browser is blocking saved data · your edits won't be kept | banner; no IndexedDB | 1.1 |
| `sys.context` | Graphics were reset · rebuilding the world | banner; the WebGL context was lost and restored | 1.1 |
| `sys.update` | A new version is ready | banner with `sys.reload` | 1.1 |
| `sys.lost` | Connection lost · reconnecting | banner | M5 |
| `sys.dropped` | Disconnected | full screen after 30 s, with `sys.reconnect` | M5 |
| `sys.full` | The server is full · you are number {n} in line | full screen | M5 |
| `sys.twice` | Coldfront is open in another tab | full screen, with `sys.here` | M5 |
| `sys.barred` | This account can't join this season | full screen | M7 |
| `sys.signin` | Sign-in failed | banner on the title screen; `title.signin` tries again | M5 |

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `sys.reload` | button | Reload | — | — | on the `sys.update` banner | 1.1 |
| `sys.reconnect` | button | Reconnect | — | Enter | | M5 |
| `sys.here` | button | Play here | The other tab is closed out | — | | M5 |

---

## D12. Owner tools

In every build through Milestone 4, previews included: the owner tests with these. They leave public builds in Milestone 5, and live on dev servers and in the admin tools from then (`17-simulation-and-bots.md` §4).

### Debug overlay (F3)
Top left: one line per row, `--fs-12`, tabular numbers, each line on its own strip of `--panel`.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `f3.pos` | stat | XYZ | — | — | position to one decimal | 1.1 |
| `f3.facing` | stat | Facing | — | — | compass direction and pitch | 1.1 |
| `f3.chunk` | stat | Chunk | — | — | | 1.1 |
| `f3.region` | stat | Region | — | — | the region weights at the feet, largest first | 1.2 |
| `f3.light` | stat | Light | — | — | sky and block light at the feet | 1.1 |
| `f3.fps` | stat | FPS | — | — | with the slowest frame of the last second | 1.1 |
| `f3.draws` | stat | Draws | — | — | draw calls | 1.1 |
| `f3.tris` | stat | Triangles | — | — | | 1.1 |
| `f3.memory` | stat | Memory | — | — | | 1.1 |
| `f3.queue` | stat | Queue | — | — | chunks waiting: generate, light, mesh | 1.1 |
| `f3.lod` | stat | LOD | — | — | chunks and tiles drawn per level | 1.4 |
| `f3.seed` | stat | Seed | — | — | | 1.1 |
| `f3.build` | stat | Build | — | — | version and commit | 1.1 |

### Tools panel (F4)
A side panel. It doesn't take the keys (A4), so you can still walk and fly while you drag a slider. F4, Esc or a click on the world closes it.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `tools.title` | title | Tools | — | — | | 1.1 |
| `tools.region` | select | Go to region | — | — | teleports to a good viewpoint in that region | 1.2 |
| `tools.postcard` | select | Go to postcard | — | — | teleports the free camera there and shows that postcard's own view, as postcard mode does (`04-terrain.md` §14.3); Esc goes back to the free camera | 1.3 |
| `tools.time` | slider | Time of day | — | — | 0–24 h | 1.1 |
| `tools.clock` | toggle | Clock runs | — | — | default on; off freezes the sun | 1.1 |
| `tools.view` | segmented | View | — | — | | 1.3 |
| `view.normal` | row | Normal | — | — | option | 1.3 |
| `view.clay` | row | Clay | — | — | option: no textures, plain light | 1.3 |
| `view.features` | row | Features | — | — | option: one flat colour per feature | 1.3 |
| `tools.fog` | toggle | Fog | — | — | default on | 1.1 |
| `tools.shadows` | toggle | Shadows | — | — | default on | 1.1 |
| `tools.lod` | toggle | LOD colours | — | — | | 1.4 |
| `tools.borders` | toggle | Chunk borders | — | — | | 1.1 |
| `tools.wire` | toggle | Wireframe | — | — | | 1.1 |
| `tools.fly` | toggle | Fly | — | — | the same as a double-tap of Space | 1.1 |
| `tools.speed` | stat | Fly speed | — | — | value: `fmt.multiple` | 1.1 |
| `tools.free` | button | Free camera | Walk and fly anywhere with endless blocks | — | leaves the kingdom running and enters the free camera; Tab returns | M2 |
| `tools.sight` | toggle | See everything | Every creature, and all of the underground, as if your people saw it | — | default off; `16-sight.md` §5.6 | M2 |
| `tools.pace` | slider | World speed | How fast the world runs · 0 pauses it | — | 0, ×1, ×2, ×5, ×10, ×20 (`17-simulation-and-bots.md` §3); value: `fmt.multiple` | M2 |
| `tools.skip` | select | Skip ahead | Runs the world forward quickly · what happens goes into the news | — | the options below; it runs through the tally (`17-simulation-and-bots.md` §3) | M3 |
| `skip.hour` | row | One hour | — | — | option: an in-game hour (2.5 real minutes) | M3 |
| `skip.day` | row | One day | — | — | option: an in-game day (a real hour) | M3 |
| `skip.year` | row | One year | — | — | option: an in-game year (a real week) | M3 |
| `tools.spawn` | select | Spawn | Puts one at the cursor | — | the options below | M2 |
| `spawn.person` | row | Person | — | — | option | M2 |
| `spawn.beast` | row | Beast | — | — | option | M2 |
| `spawn.warparty` | row | War party | — | — | option | M4 |
| `spawn.rogue` | row | Rogue Calamity | — | — | option: a rogue Wildfire, level 65, with full Flame; the owner's tool ignores the limit of nine | M7 |
| `tools.give` | select | Give | A stack of it for the selected person, or coin for the treasury | — | every item (content), then `give.coin` | M2 |
| `give.coin` | row | Coin | 10,000 Marks for the treasury | — | option | M2 |
| `tools.level` | stepper | Level | Sets the selected person's level · the grade follows | — | 1–60: a Calamity is made only in its nature's way (`13-units-classes-power.md` §15.3) | M2 |
| `tools.season` | select | Time of year | Jumps the calendar to its start · the days between aren't run | — | the `timeofyear.*` words (E7) | M2 |
| `tools.event` | select | Start event | Begins it now, after its omens | — | the world events (content) | M6 |
| `tools.bots` | stepper | Bot kings | How many bot kings share this world · used when a new world starts | — | 0–9 (`17-simulation-and-bots.md` §6) | M4 |
| `tools.still` | button | Postcard mode | Hides the interface and waits until the view has fully loaded | — | Esc leaves it | 1.1 |
| `tools.gallery` | button | Interface gallery | — | — | opens `/?gallery` in a new tab | 1.1 |
| `tools.clear` | button | Clear my edits | Forgets every block placed or broken in this seed | — | danger button; *confirm* (`confirm.clear`) | 1.1 |

### Block palette (E in the free camera)
A centred Panel, the size of the inventory. Click a block to put it in the selected hotbar slot; 1–9 over a block puts it in that slot. Blocks never run out.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|
| `blocks.title` | title | Blocks | — | — | | 1.1 |
| `blocks.search` | field | Search | — | — | filters by name | 1.1 |
| `blocks.grid` | slot | — | — | — | every block, grouped by region, each with its name as a tooltip | 1.1 |

---

# Part E · Every message

## E1. News

News lines fill alert rows (D2) and the News tab. A row is: a priority icon, the line, its age. Hovering the age shows how it reached you (`via.*`). Priorities: **critical** interrupts with a sound and stays until clicked; **important** shows for 20 s; **info** shows for 20 s and is the first to be filtered by `set.ui.alerts`.

| ID | Text | When | Since |
|---|---|---|---|
| `news.king` | {king} is under attack | critical | M4 |
| `news.kingdown` | {king} is down | critical: the king is Downed and must be revived | M4 |
| `news.attack` | {town} is under attack | critical for the capital, important elsewhere | M4 |
| `news.warden` | Your army has met {warden} | critical | M4 |
| `news.frost` | The Frost begins in {time} | important, once a day through the last three days of week 25 | M7 |
| `news.freeze` | The final freeze comes in {time} | important each day of week 26, critical on the last | M7 |
| `news.starving` | {town} is out of food | important | M2 |
| `news.freezing` | {town} is out of fuel | important | M2 |
| `news.collapse` | A collapse at {place} | important | M4 |
| `news.caravan` | A caravan was lost on {route} | important | M4 |
| `news.robbed` | A pay chest was taken on {route} | important | M4 |
| `news.unpaid` | Wages are late in {town} | important | M3 |
| `news.dark` | {place} has gone dark | important: a link broke and the place is cut off | M4 |
| `news.silence` | No word from {place} | important: an expected report is overdue | M4 |
| `news.scout` | An enemy scout was seen near {place} | important | M4 |
| `news.sighted` | Enemies seen near {place} | important: your people saw foes where none had been seen for 5 minutes. Not for beasts, and not when `news.scout` or `news.warparty` already says it (`16-sight.md` §7.5) | M4 |
| `news.digging` | Digging heard under {place} | important: your people heard digging that isn't yours under a settlement or its walls (`16-sight.md` §7.3) | M4 |
| `news.warparty` | A war party is marching on {place} | important | M4 |
| `news.fallen` | {name} has fallen | important: an official, a member of your band, or anyone of Champion grade or higher died | M4 |
| `news.slain` | {warden} has fallen | critical | M4 |
| `news.grade` | {name} is now {grade} | info: a promotion to Champion or higher | M4 |
| `news.trial` | {name} has passed the Trial | info | M4 |
| `news.trial.failed` | {name} failed the Trial | info | M4 |
| `news.calamity` | {kingdom} has raised a Calamity | important, to every king | M7 |
| `news.calamity.gone` | {name} of {kingdom} is gone | important, to every king: a kingdom's Calamity fell or died | M7 |
| `news.guttering` | {name} is guttering | critical: a day of its wage, its offerings or its relic's hunger went unmet (`13-units-classes-power.md` §15.4) | M7 |
| `news.oath` | {name} has sworn to the fire | important | M7 |
| `news.rogue` | {name} has broken loose from {kingdom} | important, to every king | M7 |
| `news.rogue.slain` | The rogue {name} has fallen | important, to every king | M7 |
| `news.restless` | {name} grows restless | critical: your Calamity's Hold fell under 30 | M7 |
| `news.outbid` | {king} is bidding for {name} | important: another king has made an offer for your Sellsword | M7 |
| `news.cult` | A cult has risen near {place} | important: a rogue Idol has settled | M7 |
| `news.died` | {name} has died in {town} | info: one of your people. Rows about the same town merge with a count (D2) | M2 |
| `news.dwindling` | Only {n} of your people remain | critical: under 10; under 5 for a day and the throne stands empty (`05-systems.md` §2) | M2 |
| `news.unburned` | The dead lie unburned in {town} | important | M4 |
| `news.left` | {name} has left {town} | important: their loyalty fell too low | M3 |
| `news.defected` | {name} has gone over to {kingdom} | important | M5 |
| `news.surrender` | {n} of your soldiers gave up at {place} | important | M5 |
| `news.looted` | {place} was looted | important | M4 |
| `news.ascent` | {n} of your people fell ill coming up from {layer} | important | M6 |
| `news.event` | {event} at {place} | important: a storm, flood, avalanche, fire or eruption (content names) | M6 |
| `news.omen` | Signs of {event} near {place} | important: at least 15 real minutes before a world event strikes (`05-systems.md` §16) | M6 |
| `news.rival` | Another king's riders were seen near {place} | important | M5 |
| `news.taken` | {place} has fallen to {victor} | important | M4 |
| `news.offer` | {king} has sent an offer | important | M5 |
| `news.broken` | {king} has broken your treaty | important | M5 |
| `news.peace` | The Steward's peace is over | info: three days after settling, or when you attack another king | M5 |
| `news.built` | {building} is finished in {town} | info | M2 |
| `news.joined` | {n} wanderers have joined {town} | info | M3 |
| `news.standout` | A standout has arrived in {town} | info; the row's click selects them | M3 |
| `news.rose` | A household in {town} rose to {tier} | info | M3 |
| `news.settled` | A contract was settled for {amount} {good} | info | M5 |
| `news.deposit` | {good} was found near {place} | info | M2 |
| `news.reached` | Your people have reached {layer} | info | M2 |
| `news.sworn` | {village} has sworn to you | info | M3 |
| `news.inscription` | An inscription was found at {place} | info; the row's click opens its Ledger entry | M4 |
| `news.feat` | Feat earned: {feat} | info | M7 |
| `news.winter` | Winter has come | info | M2 |
| `via.seen` | Seen by your own people | tooltip on the age | M4 |
| `via.rider` | Brought by a rider from {place} | tooltip on the age | M4 |
| `via.signal` | Signalled from {place} | tooltip on the age | M4 |
| `via.relay` | Relayed from {place} | tooltip on the age | M6 |

## E2. Notes at the cursor

A Note says why something can't be done, or what a drag will do. One line, 16 px right of the cursor, only while it applies.

| ID | Text | When | Since |
|---|---|---|---|
| `note.build.coverage` | Outside your coverage | the ghost is `--danger` | M2 |
| `note.build.support` | Nothing to hold it up | | M4 |
| `note.build.blocked` | Something is in the way | | M2 |
| `note.build.steep` | Too steep | templates only | M2 |
| `note.build.water` | Under water | | M2 |
| `note.build.held` | Another king holds this ground | | M5 |
| `note.build.missing` | Missing {amount} {good} · it will wait | the ghost is `--warn`; placing is allowed | M2 |
| `note.build.run` | {n} × {piece} | during a drag, followed by material icons with counts | M2 |
| `note.zone.size` | {w} × {l} m | during a zone drag | M2 |
| `note.dig.size` | {w} × {l} × {d} m · {n} blocks | during a dig drag. For Level, {d} is the tallest column that goes | M2 |
| `note.build.link` | Will link to {place} | a network building's ghost | M4 |
| `note.build.nolink` | Too far to link from here | | M4 |
| `note.route.stop` | Not a stop | clicking something that can't be one | M3 |
| `note.route.path` | No way through here | | M3 |
| `note.order.sent` | Order sent · arrives in {eta} | for 3 s after an order | M4 |
| `note.order.rider` | Sent by rider · arrives in {eta} | for 3 s after an order to a place that is cut off (A4) | M4 |
| `note.order.lost` | No rider can reach them | the order isn't sent | M4 |
| `note.order.wilful` | It won't do that | an order a wilful Calamity refuses (`13-units-classes-power.md` §15.8) | M7 |
| `note.possess.coverage` | Outside your coverage | on Tab or `person.possess` | M2 |
| `note.possess.dark` | Cut off from your capital | | M4 |
| `note.possess.steward` | The Steward can't be possessed | | M2 |
| `note.possess.other` | Not one of yours | | M5 |
| `note.possess.restless` | It won't answer you | a restless Calamity (`13-units-classes-power.md` §15.8) | M7 |
| `note.peace` | Under the Steward's peace | an attack ordered on a new king's people or buildings | M5 |
| `note.skill.ready` | Not ready | a skill on cooldown | M2 |
| `note.skill.stamina` | Not enough stamina | | M2 |
| `note.skill.resolve` | Resolve isn't full | an Ultimate | M3 |
| `note.skill.reach` | Out of reach | | M2 |
| `note.skill.target` | Needs a target | | M2 |
| `note.band.none` | Nobody else in your band | `,` or `.` with no one to switch to | M2 |

## E3. Small texts

| ID | Text | When | Since |
|---|---|---|---|
| `toast.shot` | Screenshot saved | F2 | 1.1 |
| `toast.fly` | Fly speed ×{n} | `[` and `]` | 1.1 |
| `toast.windowed` | Windowed · sprint by double-tapping a movement key | once per session (B1) | 1.1 |
| `toast.mark` | Bookmark {n} saved | Shift + F5–F8 | M2 |
| `toast.group` | Group {n} set | Ctrl + 1–9 | M4 |
| `toast.undo` | Undone | Ctrl + Z | M2 |
| `timeofyear.spring` | Spring | in `top.date` | M2 |
| `timeofyear.summer` | Summer | | M2 |
| `timeofyear.autumn` | Autumn | | M2 |
| `timeofyear.winter` | Winter | | M2 |
| `zone.name` | {kind} {n} | a new zone's name | M2 |
| `dig.name` | Dig {n} | a new dig mark's name | M2 |
| `co.name` | {town} company {n} | a new company's name | M4 |
| `army.name` | Army {n} | a new army's name | M5 |
| `order.travel` | {order} · arrives in {eta} | tooltip on a pending control, and on an order's mark, while the order travels (A4) | M4 |
| `card.warden` | Warden of {region} | the Warden card's second line | M4 |
| `town.noreeve` | No Reeve | in `town.reeve` | M2 |
| `tip.build.needs` | Here it needs {requirement} | last line of the building tooltip | M4 |
| `tip.damage` | Damage {n} | item tooltip lines, in this order | M4 |
| `tip.speed` | Attack speed {n} | | M4 |
| `tip.armour` | Armour {n} | | M4 |
| `tip.durability` | Durability {n} of {max} | | M3 |
| `tip.quality` | Quality {q} | | M3 |
| `tip.spoils` | Spoils in {time} | | M3 |
| `tip.weight` | {w} kg | | M2 |
| `tip.span` | Spans {n} m | block tooltip lines, in this order, after the name | M4 |
| `tip.heat` | Heat resistance {n} | | M4 |
| `tip.insulation` | Insulation {n} | | M4 |
| `tip.ward` | Ward {n} | | M4 |
| `tip.rot` | Rot resistance {n} | | M4 |
| `tip.skill.passive` | Always on | skill tooltip lines, in this order, after the skill's own line | M2 |
| `tip.skill.cost` | Costs {cost} | | M2 |
| `tip.skill.ready` | Ready every {t} | | M2 |
| `tip.skill.resolve` | Spends a full Resolve | | M3 |
| `tip.skill.reach` | Reach {reach} | | M2 |
| `tip.skill.played` | Only when you play them | a **played only** skill | M2 |
| `keys.listening` | Press a key | on `keys.bind` while it waits | M2 |
| `keys.unset` | Not set | on `keys.bind` with no key | M2 |
| `keys.clash` | Also used by {action} | tooltip on both clashing rows; their Keycaps turn `--warn` | M2 |
| `keys.reserved` | {key} belongs to the browser | Note when a refused key is pressed | M2 |
| `keys.unsupported` | That key can't be used | Note when a key with no name row is pressed (B5) | M2 |
| `name.taken` | That name is taken | under a name Field | M5 |
| `name.length` | Use 3 to 20 letters | under a name Field | M2 |
| `chat.slow` | Wait a moment before sending again | Note | M5 |
| `find.none` | No matches | | M2 |
| `people.none` | Nobody matches | | M2 |
| `newslist.none` | No news | | M2 |
| `route.none` | No routes yet | | M3 |
| `army.none` | No companies yet | | M4 |
| `board.none` | No orders posted | | M5 |
| `contract.none` | No contracts | | M5 |
| `ledger.none` | Nothing found yet | | M2 |
| `out.none` | No offers yet | | M7 |
| `why.missing` | Missing {amount} {good} | the reasons on disabled controls (A2) | M2 |
| `why.official` | No {office} appointed | | M5 |
| `why.candidate` | Nobody is fit to lead it | | M4 |
| `why.people` | Not enough people | | M4 |
| `why.coin` | Not enough coin | | M5 |
| `why.select` | Select two or more companies | | M5 |
| `why.engines` | No siege engines | | M5 |
| `why.grade` | Needs {need} | the gate of the next grade (`13-units-classes-power.md` §9) | M3 |
| `why.places` | No {grade} place free | | M3 |
| `why.skill` | Opens at {need} | a locked skill Slot | M2 |
| `why.cold` | The Hearth is cold | | M7 |
| `why.congregation` | Needs {n} more in the congregation | | M7 |
| `why.stronghold` | Needs stone walls 8 m high and 50 soldiers | | M7 |
| `why.band` | Your band is full | | M2 |
| `why.rank` | No place open at that rank | | M4 |
| `why.trial` | They can try again in {t} | | M4 |
| `why.empty` | Nothing in the offer yet | | M5 |
| `confirm.cancel` | Cancel | the second Button of every confirmation; Esc | 1.1 |
| `confirm.demolish.title` | Demolish {building}? | | M2 |
| `confirm.demolish.do` | Demolish | | M2 |
| `confirm.route.title` | Delete this route? | | M3 |
| `confirm.route.do` | Delete | | M3 |
| `confirm.disband.title` | Disband {company}? | | M4 |
| `confirm.disband.body` | Its soldiers go back to their work | | M4 |
| `confirm.disband.do` | Disband | | M4 |
| `confirm.treaty.title` | Break your treaty with {king}? | | M5 |
| `confirm.treaty.body` | It goes into the Chronicle | | M7 |
| `confirm.treaty.do` | Break it | | M5 |
| `confirm.oath.title` | Swear {name} to the fire? | | M7 |
| `confirm.oath.body` | A Calamity for one day, then they burn | | M7 |
| `confirm.oath.do` | Swear | | M7 |
| `confirm.fire.title` | Call the fire for {name}? | | M7 |
| `confirm.fire.body` | One day of fire, then ash | | M7 |
| `confirm.fire.do` | Call it | | M7 |
| `confirm.kindle.title` | Kindle {name}? | | M7 |
| `confirm.kindle.body` | Seven days and 100,000 offerings | | M7 |
| `confirm.kindle.do` | Kindle | | M7 |
| `confirm.gild.title` | Gild {name}? | | M7 |
| `confirm.gild.body` | Seven days and 250,000 Marks, then a wage every day | | M7 |
| `confirm.gild.do` | Gild | | M7 |
| `confirm.ward.title` | Swear {name} to this stronghold? | | M7 |
| `confirm.ward.body` | Seven days and 100,000 offerings · bound here for good | | M7 |
| `confirm.ward.do` | Swear | | M7 |
| `confirm.rite.title` | Begin the Marrow Rite for {name}? | | M6 |
| `confirm.rite.body` | It burns 20 titan marrow, 50 pure crystal and 10 deep pearls | | M6 |
| `confirm.rite.do` | Begin | | M6 |
| `confirm.unbind.title` | Take off {item}? | | M4 |
| `confirm.unbind.body` | They fall back a grade and lose experience above it | | M4 |
| `confirm.unbind.do` | Take off | | M4 |
| `confirm.keys.title` | Reset every key? | | M2 |
| `confirm.keys.do` | Reset | | M2 |
| `confirm.reset.title` | Reset every setting? | | 1.10 |
| `confirm.reset.do` | Reset | | 1.10 |
| `confirm.clear.title` | Clear your edits in this seed? | | 1.1 |
| `confirm.clear.body` | Every block you placed or broke goes back | | 1.1 |
| `confirm.clear.do` | Clear | | 1.1 |

An empty list shows its `*.none` line in `--text-2` where the first row would be. The action that fills the list is already the panel's primary button, so the line needs no arrow or link.

## E4. World voice

The Steward's lines are `03-lore.md` §7, word for word, and are shown as D9 says. The lines that head the moments are written here in the same voice.

| ID | Text | When | Since |
|---|---|---|---|
| `steward.arrival` | The ice has gone back. The land is yours to hold, if you can hold it. | the king first arrives | M2 |
| `steward.stores` | Food left in the open feeds the crows. Build a store. | food lies on the ground with nowhere to store it; outlines `bar.build` | M2 |
| `steward.night` | Keep the fires lit. The dark here is not empty. | the first dusk | M2 |
| `steward.oath` | I keep the Crown until a king sits the throne. | the first night, once only | M2 |
| `steward.winter` | The cold is patient. Be more patient. | the first day of the first winter | M2 |
| `steward.rival` | Another crown walks these lands. Watch its riders. | the first sighting of another king's people | M5 |
| `steward.descent` | Down is easy. Remember that. | the first of your people enters Layer 1; outlines `depth.gauge` | M2 |
| `steward.deep` | It is warm down here. It should not be. | the first of your people enters Layer 2 | M2 |
| `steward.next` | Another crown. Walk with me. | a new king arrives after a death | M2 |
| `steward.idle` | I keep the Crown. | the Steward is selected and has nothing to say | M2 |
| `moment.death` | {king} is dead | heads the death screen | M2 |
| `moment.empty` | The throne stands empty | heads the death screen when the kingdom fell around a living king (`05-systems.md` §2) | M2 |
| `moment.out` | Your last crown has fallen | heads the screen after the last life | M7 |
| `moment.frost` | The Frost has come | heads the season's end | M7 |
| `moment.clean` | A clean Frost | heads it instead when the King Below fell this season | M7 |

## E5. The Chronicle

One line per event, server-wide, in world voice. The King Below's name is never used in it (`03-lore.md` §10).

| ID | Text | When | Since |
|---|---|---|---|
| `chron.layer` | Week {w}: {king} of {capital} is the first to reach {layer}. | | M7 |
| `chron.warden` | Week {w}: {kings} break {warden}. | two or more credited kingdoms; {kings} lists each as "{king} of {capital}" | M7 |
| `chron.warden.one` | Week {w}: {king} of {capital} breaks {warden}. | one credited kingdom that didn't earn Solitary | M7 |
| `chron.alone` | Week {w}: {king} of {capital} breaks {warden} alone. | a Solitary kill | M7 |
| `chron.dead` | Week {w}: {king} of {capital} is dead. | | M7 |
| `chron.taken` | Week {w}: {kingdom} falls to {victor}. | | M7 |
| `chron.faith` | Week {w}: {king} of {capital} breaks faith with {other}. | a broken treaty | M7 |
| `chron.calamity` | Week {w}: {king} of {capital} raises a Calamity. | | M7 |
| `chron.calamity.gone` | Week {w}: {name} of {capital} is no more. | | M7 |
| `chron.rogue` | Week {w}: {name} breaks loose from {capital}. | | M7 |
| `chron.rogue.slain` | Week {w}: the rogue {name} is slain near {place}. | | M7 |
| `chron.oath` | Week {w}: {name} of {capital} burns for {king}. | an Oathsworn's day of fire | M7 |
| `chron.below` | Week {w}: the King Below is broken. | | M7 |
| `chron.frost` | Week 26: the Frost takes the basin. | | M7 |

## E6. Task and history lines

| ID | Text | When | Since |
|---|---|---|---|
| `task.idle` | Idle | in `person.doing` | M2 |
| `task.rest` | Resting | | M2 |
| `task.eat` | Eating | | M2 |
| `task.walk` | Walking to {place} | | M2 |
| `task.carry` | Carrying {good} to {place} | | M2 |
| `task.build` | Building {building} | | M2 |
| `task.repair` | Repairing {building} | | M4 |
| `task.work` | Working at {building} | | M2 |
| `task.farm` | Farming | | M2 |
| `task.dig` | Digging | | M2 |
| `task.train` | Training | | M4 |
| `task.guard` | On guard | | M4 |
| `task.fight` | Fighting | | M4 |
| `task.burn` | Burning the dead | | M4 |
| `task.flee` | Fleeing | | M4 |
| `task.yours` | In your hands | while possessed | M2 |
| `hist.born` | Born in {town} | History tab rows, each after its date | M3 |
| `hist.joined` | Joined {kingdom} | | M2 |
| `hist.class` | Became a {class} | | M2 |
| `hist.grade` | Became {grade} | | M2 |
| `hist.deed` | Completed the deed of the {class} | | M3 |
| `hist.trial` | Passed the Trial | | M4 |
| `hist.office` | Appointed {office} | | M2 |
| `hist.rose` | Rose to {tier} | | M3 |
| `hist.dropped` | Dropped to {tier} | | M3 |
| `hist.hurt` | Wounded at {place} | | M4 |
| `hist.died` | Died at {place} | | M2 |
| `hist.built` | Built | buildings | M2 |
| `hist.repaired` | Repaired | | M4 |
| `hist.damaged` | Damaged by {cause} | | M4 |
| `hist.taken` | Taken by {kingdom} | | M5 |

## E7. Fixed words

Words the interface needs that aren't labels, tooltips or messages. Each is used only where its row says.

**Units and formats** (written by the formatter, A5):

| ID | Text | When | Since |
|---|---|---|---|
| `unit.s` | s | after a number of seconds | M2 |
| `unit.min` | min | | M2 |
| `unit.h` | h | | 1.1 |
| `unit.d` | d | days of real time | M2 |
| `unit.ms` | ms | the debug overlay | 1.1 |
| `unit.mb` | MB | the debug overlay | 1.1 |
| `unit.m` | m | | 1.2 |
| `unit.km` | km | | 1.2 |
| `unit.kg` | kg | | M2 |
| `fmt.multiple` | ×{n} | fly speed | 1.1 |
| `fmt.ago` | {t} ago | an age | M2 |
| `fmt.in` | in {t} | an arrival time | M3 |
| `fmt.date` | Day {d} · {time} · Y{y} | the calendar; {time} is a `timeofyear.*` word | M2 |
| `fmt.week` | Week {w} of 26 | | M7 |
| `fmt.days` | {n} days | days of food or fuel | M2 |
| `fmt.of` | {n} of {max} | | M2 |
| `fmt.blocks` | {n} blocks | | M2 |
| `fmt.times` | × {n} | the count on a merged alert | M2 |
| `fmt.about` | about {n} | an estimate | M4 |
| `fmt.route` | {from} → {to} | a route's two ends | M3 |
| `fmt.ruler` | {king} of {capital} | | M5 |
| `fmt.crown` | {capital} Crown | a kingdom's default name | M2 |
| `fmt.says` | {king}: {words} | a chat line | M5 |
| `fmt.comma` | {a}, {b} | joins rulers in a list of three or more | M7 |
| `fmt.and` | {a} and {b} | joins the last two | M7 |
| `fmt.score` | {n} · {rank} of {kings} | | M7 |
| `compass.n` | N | `f3.facing` | 1.1 |
| `compass.ne` | NE | | 1.1 |
| `compass.e` | E | | 1.1 |
| `compass.se` | SE | | 1.1 |
| `compass.s` | S | | 1.1 |
| `compass.sw` | SW | | 1.1 |
| `compass.w` | W | | 1.1 |
| `compass.nw` | NW | | 1.1 |

**Column headers.** A Table has a header row only where its row names these.

| ID | Text | When | Since |
|---|---|---|---|
| `col.name` | Name | | M2 |
| `col.people` | People | | M2 |
| `col.food` | Food | days of food | M2 |
| `col.class` | Class | | M2 |
| `col.level` | Level | | M2 |
| `col.grade` | Grade | | M3 |
| `col.held` | Held | | M3 |
| `col.age` | Age | | M2 |
| `col.home` | Home | | M2 |
| `col.filled` | Filled | | M2 |
| `col.open` | Open | | M2 |
| `col.tier` | Tier | | M3 |
| `col.loyalty` | Loyalty | | M3 |
| `col.place` | Place | | M3 |
| `col.to` | To | | M3 |
| `col.arrives` | Arrives | | M3 |
| `col.good` | Good | | M3 |
| `col.price` | Price | | M3 |
| `col.stock` | Stock | | M3 |
| `col.amount` | Amount | | M5 |
| `col.each` | Each | the price of one | M5 |
| `col.kingdom` | Kingdom | | M5 |
| `col.post` | Trading post | | M5 |
| `col.rank` | Rank | | M7 |
| `col.score` | Score | | M7 |

**Key names** on Keycaps. Letters, digits and punctuation are shown as the player's keyboard prints them (B1), and function keys as F and their number.

| ID | Text | When | Since |
|---|---|---|---|
| `keyname.space` | Space | | M2 |
| `keyname.enter` | Enter | | 1.1 |
| `keyname.esc` | Esc | | 1.1 |
| `keyname.lctrl` | Left Ctrl | | M2 |
| `keyname.lshift` | Left Shift | | M2 |
| `keyname.mouse1` | Left mouse | | M2 |
| `keyname.mouse2` | Right mouse | | M2 |
| `keyname.mouse3` | Middle mouse | | M2 |
| `keyname.tab` | Tab | | M2 |
| `keyname.shift` | Shift | | M2 |
| `keyname.backspace` | Backspace | | M2 |
| `keyname.up` | ↑ | the arrow keys | M2 |
| `keyname.down` | ↓ | | M2 |
| `keyname.left` | ← | | M2 |
| `keyname.right` | → | | M2 |
| `keyname.pageup` | PageUp | | M2 |
| `keyname.pagedown` | PageDown | | M2 |
| `keyname.end` | End | | 1.8 |
| `keyname.home` | Home | | M2 |
| `keyname.delete` | Delete | | M2 |
| `keyname.ctrl` | Ctrl | | M2 |
| `keyname.alt` | Alt | | M2 |
| `keyname.cmd` | ⌘ | macOS | M2 |

**The game's fixed terms.** Everything else with a name is content (A1).

| ID | Text | When | Since |
|---|---|---|---|
| `office.reeve` | Reeve | the offices and posts (`13-units-classes-power.md` §13) | M2 |
| `office.quartermaster` | Quartermaster | | M3 |
| `office.treasurer` | Treasurer | | M3 |
| `office.captain` | Captain | | M4 |
| `office.marshal` | Marshal | | M5 |
| `office.envoy` | Envoy | | M5 |
| `office.magister` | Magister | | M6 |
| `office.chancellor` | Chancellor | | M3 |
| `office.governor` | Governor | | M3 |
| `office.bailiff` | Bailiff | | M3 |
| `office.storekeeper` | Storekeeper | | M3 |
| `office.paymaster` | Paymaster | | M3 |
| `office.hearthkeeper` | Hearthkeeper | | M3 |
| `office.high-hearthkeeper` | High Hearthkeeper | | M3 |
| `office.foreman` | Foreman | | M3 |
| `office.overseer` | Overseer | | M3 |
| `office.commander` | Commander | | M5 |
| `office.spymaster` | Spymaster | | M5 |
| `tier.peasant` | Peasant | the three needs tiers | M3 |
| `tier.craftsman` | Craftsman | | M3 |
| `tier.noble` | Noble | | M3 |
| `rank.apprentice` | Apprentice | the trade ranks (`13-units-classes-power.md` §8) | M2 |
| `rank.journeyman` | Journeyman | | M2 |
| `rank.adept` | Adept | | M2 |
| `rank.master` | Master | | M2 |
| `rank.grandmaster` | Grandmaster | | M2 |
| `rank.recruit` | Recruit | military ranks below Captain (`13-units-classes-power.md` §13.1) | M4 |
| `rank.private` | Private | | M4 |
| `rank.corporal` | Corporal | | M4 |
| `rank.sergeant` | Sergeant | | M4 |
| `rank.lieutenant` | Lieutenant | | M4 |
| `grade.common` | Common | the grades (`13-units-classes-power.md` §9) | M2 |
| `grade.proven` | Proven | | M2 |
| `grade.tempered` | Tempered | | M3 |
| `grade.elite` | Elite | | M3 |
| `grade.champion` | Champion | | M4 |
| `grade.paragon` | Paragon | | M6 |
| `grade.calamity` | Calamity | | M7 |
| `nature.sellsword` | Sellsword | a Calamity's nature (`13-units-classes-power.md` §15.3) | M7 |
| `nature.idol` | Idol | | M7 |
| `nature.wildfire` | Wildfire | | M7 |
| `nature.bastion` | Bastion | | M7 |
| `nature.oathsworn` | Oathsworn | | M7 |
| `slot.knack` | Knack | the skill slots, on the skill tooltip | M2 |
| `slot.active` | Active | | M2 |
| `slot.ultimate` | Ultimate | | M3 |
| `slot.mastery` | Mastery | | M4 |
| `slot.relic` | Relic | | M4 |
| `slot.art` | Art | | M5 |
| `slot.office` | Office | | M3 |
| `slot.cataclysm` | Cataclysm | | M7 |
| `sex.woman` | Woman | | M2 |
| `sex.man` | Man | | M2 |
| `ruler.king` | King | a ruler's title, before the name (A5) | M2 |
| `ruler.queen` | Queen | | M2 |
| `coin.crowns` | Crowns | in tooltips, and as the gold glyph's name for screen readers | M3 |
| `coin.marks` | Marks | the silver glyph's | M3 |
| `cause.pay` | Pay | the six causes of loyalty (`loyalty.why`) | M3 |
| `cause.needs` | Needs | | M3 |
| `cause.safety` | Safety | | M3 |
| `cause.family` | Family | | M3 |
| `cause.deeds` | Your deeds | | M3 |
| `cause.events` | Events | | M3 |

---

# Part F · What ships when

Each row's **Since** decides when it ships. This table only sums them up; `node docs/tools/ui-catalogue.mjs --upto <phase>` counts the rows a build of that phase should hold, and `--json --upto <phase>` lists them.

| Phase | The interface that exists at its end |
|---|---|
| 1.1 | title screen (seed, Play); loading; the free camera's screen in Overhead, with the avatar and the cut that follows it under cover (target outline, silhouette, placement ghost, hotbar, the held item's name); block palette; menu (Resume, Licences, Quit to title); F1, F2, F3 and the Tools panel (F4) with the rows marked 1.1; the system states that need no server (no WebGL2, small window, blocked storage, lost graphics, new version); the toasts; the "Clear my edits" confirmation; the string pipeline, `ui:lint`, the gallery and `ui:shots` (A6, A7) |
| 1.2 | the map with Teleport; discovery cards; "Go to region"; the World select |
| 1.3 | "Go to postcard"; the View switch (Clay, Features) |
| 1.4 | the Command camera as king's view (C1, C6) with Tab; the map's "Go here"; Settings with the rows marked 1.4; the LOD rows in F3 and Tools |
| 1.8 | the cut's keys (C2) and the depth gauge; the map's layer tabs |
| 1.10 | every Settings row marked 1.10, including the Audio tab's Volume; nothing else new |
| M2 | the Command view: top bar, alerts, minimap, the Resources overlay, command bar, Build (with Dig) and Zones, the inspector, Realm (Overview, People, News), the Ledger, Find, the key list, bookmarks; the map's markers; Possess with real inventories, Handwork, containers and workstations; sight: the darkened land, creatures shown only while seen, the underground only where your people have seen it, the view cone of a selected person, last-seen marks for what skills revealed, and the owner's "See everything"; classes, levels, grades, experience, attribute points and proficiencies in the inspector; skills on keys, in the inspector and beside the hotbar, with autocast; the Band; the Steward's lines; "Choosing ground"; the death screen; the free camera as an owner tool beside the kingdom; the owner's world speed, spawn, give, level and time-of-year tools; the empty throne and the warning before it; order pings |
| M3 | Routes; Trade (Prices); Realm (Officials, Policies, Treasury, Grades); Promote, Resolve, deeds, Speciality and Background; Ultimates; loyalty, tiers and their causes; the Logistics and Loyalty overlays; neutral villages and gifts; reputation; the office (K); skip ahead |
| M4 | Army (companies) and the order buttons; roles, military ranks, wards and day trades; company classes and skills; Trials and relic slots; control groups; the order wheel; the network: its buildings, link notes, the Network, Hazards and Territory overlays, news that travels and pending orders; foes' sight: the Sight overlay, awareness marks, last-seen marks for foes, and the news of sightings and digging; enemy and Warden rows and the Warden card; integrity and repair; conditions; inscriptions; two more Ledger tabs; the Presence effects setting; bot kings and war parties in the Tools panel; danger zones under foes' blows |
| M5 | signing in, the lobby, founding; advanced classes; chat; Realm (Kings), offers and deals; Trade (Board, Contracts); captives and bribes; morale; armies under a Marshal and siege; capture; the system states for connections. Owner tools leave; the Steward's peace; the bot mark |
| M6 | the Mana overlay; mana, machine and lift rows; the Mana bar; ascent sickness and world events in the news; starting world events, and omens in the news |
| M7 | lives; Calamities: the Great Hearth, the oath, Flame, their news and Chronicle lines; the season's week and the Frost warnings; the Chronicle, Standings, Feats and Ledger of Kings; sworn units; the eliminated and Frost screens; Calamity natures: Hold, wages and offers, the Gilding and the Warding, rogues with their news and Chronicle lines; spawning a rogue Calamity |
| M8 | the crest editor; honours, banners and looks; buying a life; the Audio tab's remaining rows; the Guide |

---

# Part G · Additions

Rows added after this doc was first written (A1). Put each under the table that fits its kind, with the phase it ships in, and name it in that change's report.

| ID | Type | Label | Tooltip | Key | Does | Since |
|---|---|---|---|---|---|---|

| ID | Text | When | Since |
|---|---|---|---|

| ID | Action | Default | Notes | Since |
|---|---|---|---|---|
