# 09 · Open questions

Three lists:
1. Questions the **owner** needs to answer, each with the milestone it should be settled by.
2. Calls the **agent** made that the owner should confirm.
3. A parking lot of ideas.

The agent appends to lists 2 and 3 and never blocks work waiting for answers.

---

## 1. Needs the owner

| # | Question | Default until answered | Settle by |
|---|---|---|---|
| 1 | Approve the lore (`03-lore.md`): the name **Kaldmark**; the King Below is **Kuon**; the Stewards' secret; the **Frost** as the season end; the Lampless Queen (Akari) as Kuon's queen; the three tongues | use as written | M7 |
| 2 | Approve the region and Warden names (see the tables in `02-world.md` §2 and §7; Hearthlands, Shirogane, Kurogane, Kogane, Boneyard, Selva, Sallows, Grey Mere, Tasogare, Ibara, Hoshikuzu, Sundered Isles, Nadir) | use as written (they appear on discovery cards in M1; easy to rename) | end of M1 |
| 3 | In M1, the deep layers (Layers 2–3 and the Pit) get a lower quality bar (≥ 14/20, R7 = 2, no zeros), with the full bar when they become playable (M6–M7). OK? | yes | phase 1.9 |
| 4 | Any protection for new or re-summoned kings beyond spawning far away? | none | M5 |
| 5 | Gunpowder in the world? | no: mechanical and mana siege only | M4 |
| 6 | Any player flight (mounts, creatures)? | none (fly stays an owner test tool, in builds through Milestone 4) | M6 |
| 7 | How deep should possessed combat be: Deepwoken-like action, or simpler? | Minecraft's combat as the base (attack timing, shields), plus learned abilities on Z X C V R G | M4 |
| 8 | Chat and social: text chat, alliance tools, voice? | text chat + alliance channel | M5 |
| 9 | How many servers, and in which regions (Asia / US / EU)? | one, self-hosted | M7 |
| 10 | Should the offline king have a player-set hideout? | no: AI picks the safest keep | M5 |
| 11 | Monetisation beyond lives (a cosmetics shop?) | none | M8 |
| 12 | Spectating for eliminated players? | sworn unit only | M7 |
| 13 | Boss count: 29 Wardens (the Nadir has its own, Severin the Castellan, guarding the Stair) plus the King Below makes **30 boss fights**, with 106 generals. The planning chat first described 29 including the King Below. | 30 as written | M4 |
| 14 | Should Possess mode copy Minecraft down to its quirks (sprint-jumping, crouch-bridging, fall damage), or only its feel? | down to the quirks: the physics is a port of Minecraft-accurate movement | M2 |
| 15 | The interface catalogue (`11-interface-catalogue.md`) fixes every label, key and screen. Anything you'd rename, move or drop? A change costs nothing before its screen is built | use as written | the start of each milestone, for that milestone's rows |

---

## 2. Decided by the agent (please confirm)

*(The agent adds entries here: date, decision, why, and how to reverse it.)*

**2026-10-08 · the interface catalogue.** Writing `11-interface-catalogue.md` meant settling these. Each is reversed by editing the row or section named.

| # | Decision | Why | To reverse |
|---|---|---|---|
| 1 | **Command-view mouse:** left click selects or places, right click orders or cancels, right-drag orbits, middle-drag grabs the ground and pans, the wheel zooms toward the cursor | the layout strategy players already know; a right click stays free for orders because a drag only starts after 120 ms and 6 px | the setting "Swap drag buttons" already swaps the two drags; other changes go in B2 |
| 2 | **No right-click menus.** Everything a thing can do is in its inspector | one fixed place for actions; no hidden menus to discover | add a menu section to Part D |
| 3 | **Possessing takes two steps:** select a person, then Tab or the Possess button. `05-systems.md` used to say a click possesses | a single click has to select, or nothing could be inspected | B2, C5 |
| 4 | **An official's panel opens on K** while you possess them, not by itself | opening it by itself would free the cursor in the middle of walking | D6 "The office" |
| 5 | **Keys:** Routes is U (R turns the piece being placed); Dig is C; Realm and the office are K; the officer's order wheel is hold-B; Find (Ctrl + K) works in Command view only; overlays have no keys | R for rotate is what builders expect; in Possess, Left Ctrl is the sprint key, so nothing there may need Ctrl | the Default column in B3; every key is rebindable anyway |
| 6 | **Entering the world goes fullscreen.** Left Ctrl sprints only where the browser has locked the keyboard for the game (and always on a Mac); elsewhere it is switched off and sprint is double-tap W. After Esc, the game needs one click to take the mouse back | Ctrl + W closes the tab and a page can't stop it; browsers also refuse to lock the mouse from an Esc press | B1, and the setting "Fullscreen on play" |
| 7 | **The cut:** Command view sees underground through one level slice that hides everything above it. It shows open space only where your coverage reaches or your people have been. It is built in phase 1.8 with the caves, so you can look into them from above in Milestone 1 | a 1.5 km deep world needs one simple tool; it keeps "information has a cost" | C2 |
| 8 | **Hand crafting is a list of recipes** ("Handwork"), not Minecraft's pattern grid. **Stamina replaces hunger.** No experience bar, recipe book or advancements | recipes here need workstations, skills and time (`05-systems.md` §12); a pattern grid would need a second recipe system | D6 "Inventory" |
| 9 | **A seventh overlay, Mana** (Milestone 6) | the mana grid has load, losses and storage to read at a glance | D2 |
| 10 | **Owner fly speed** is Minecraft's creative speed in steps ×1 to ×16 on `[` and `]`, replacing "20 m/s with a ×10 boost" | it feels like Minecraft at ×1 and still crosses the world at ×16 | B3 "Owner tools" |
| 11 | **Look:** panels are flat and nearly opaque with no blur; corners are 4 and 6 px; one small shadow | blur costs frames over a 3D scene and reads as decoration; legible text over any terrain | the tokens in `06-ui-art.md` §5 |
| 12 | **A ruler picks a title:** King, Queen or none, shown before the name ("Queen Aoi"). Titles earned in past seasons ("Breaker of the Hoarfather") are called **honours** on screen, so the two don't get mixed up. The Steward's rival line now says "Watch its riders" | the Chronicle examples in `03-lore.md` use all three; a rival may be a queen | D1 "Founding a kingdom"; `03-lore.md` §7 |
| 13 | **The Possess screen shows alerts but no date and no minimap** | Minecraft's screen, plus the one thing a king can't miss | D6 |
| 14 | **An empty list is one plain line** ("No routes yet") with no arrow or link | the panel's main button already does it; this replaces the old "Appoint one →" principle | E3, `06-ui-art.md` §1 |
| 15 | **Only seven actions ask "are you sure":** demolish, delete a route, disband, break a treaty, reset settings, reset keys, clear the owner's edits | every other action can be undone or is cheap | the rows marked *confirm* |
| 16 | **The menu pauses the world in Milestones 1–4** and never from Milestone 5 | a shared server can't pause | D8 |
| 17 | **A Dig tool** in the Build palette: drag a rectangle to mark ground. "Down" digs a set depth (on the surface a pit, on the cut a room or tunnel); "Level" flattens to where the drag began | the game extends downwards, and nothing in the docs let a king order digging | D3 "Digging" |
| 18 | **Every change to the world is an order that travels.** Close by it lands at once. Farther off, the control shows the new value as pending until it arrives. To a place that is cut off it goes by rider, or not at all if no rider can get there | `05-systems.md` §4 says orders travel like news; this makes it visible everywhere, not only for armies | A4 "Orders travel" |
| 19 | **Moved earlier or later than first written:** the death screen is in Milestone 2 (people can already die there); armies under a Marshal, siege and morale are in Milestone 5 with war between kings; loyalty is named in Milestone 3 | the roadmap builds those systems then | the Since column; `08-roadmap.md` |
| 20 | **Small additions you didn't ask for,** each one row or a few: control groups (Ctrl + 1–9); four camera bookmarks (F5–F8); named map markers; whispers between kings and a chat on/off setting; a pay day shown in the Treasury; three ration levels; "No word from {place}" news; a live score rank; the nearest king shown on a spawn site; a queue when the server is full; one tab per account; a minimum window size; a "new version" banner; carry weight slowing a possessed unit; achievements called "Deeds" and leaderboards "Standings" | each fills a hole a player would hit; none adds a system | delete the row |

---

## 3. Parking lot

- Seasonal modifiers ("the Long Winter": a season with twice the winter)
- Player-built monuments recorded in the Ledger of Kings
- Bounty boards; mercenary companies formed by eliminated players
- Weather events per region as server-wide moments
- A replay of the season's territory map at the Frost
