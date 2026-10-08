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
| 7 | How deep should possessed combat be: Deepwoken-like action, or simpler? | Minecraft's combat as the base (attack timing, shields, parries), plus each class's skills on Z X C V R G (`13-units-classes-power.md` §3, §11) | M4 |
| 8 | Chat and social: text chat, alliance tools, voice? | text chat + alliance channel | M5 |
| 9 | How many servers, and in which regions (Asia / US / EU)? | one, self-hosted | M7 |
| 10 | Should the offline king have a player-set hideout? | no: AI picks the safest keep | M5 |
| 11 | Monetisation beyond lives (a cosmetics shop?) | none | M8 |
| 12 | Spectating for eliminated players? | sworn unit only | M7 |
| 13 | Boss count: 29 Wardens (the Nadir has its own, Severin the Castellan, guarding the Stair) plus the King Below makes **30 boss fights**, with 106 generals. The planning chat first described 29 including the King Below. | 30 as written | M4 |
| 14 | Should Possess mode copy Minecraft down to its quirks (sprint-jumping, crouch-bridging, fall damage), or only its feel? | down to the quirks: the physics is a port of Minecraft-accurate movement | M2 |
| 15 | The interface catalogue (`11-interface-catalogue.md`) fixes every label, key and screen. Anything you'd rename, move or drop? A change costs nothing before its screen is built | use as written | the start of each milestone, for that milestone's rows |
| 16 | Two Wardens carry office titles (Marshal Varn, Foreman Gall), and "sworn" now names both an eliminated king's one unit and a soldier sworn to the fire (the Oathsworn). Rename any of these? | keep: the context tells them apart | M4 |
| 17 | The world is generated on each player's machine from the seed, so a modified game could compute buried ore and caves nobody has seen, whatever the sight rules hide (`16-sight.md` §9.5). Closing that means the server sending the underground itself, at a cost in bandwidth and server work. Close it, or accept it? | accept it for now; the server already hides creatures and other kingdoms' changes | M5 |

---

## 2. Decided by the agent (please confirm)

*(The agent adds entries here: date, decision, why, and how to reverse it.)*

**2026-10-08 · the interface catalogue.** Writing `11-interface-catalogue.md` meant settling these. Each is reversed by editing the row or section named.

| # | Decision | Why | To reverse |
|---|---|---|---|
| 1 | **Command-view mouse:** left click selects or places, right click orders or cancels, right-drag orbits, middle-drag grabs the ground and pans, the wheel zooms toward the cursor | the layout strategy players already know; a right click stays free for orders because a drag only starts after 120 ms and 6 px | the setting "Swap drag buttons" already swaps the two drags; other changes go in B2 |
| 2 | **No right-click menus.** Everything a thing can do is in its inspector | one fixed place for actions; no hidden menus to discover | add a menu section to Part D |
| 3 | **Possessing takes two steps:** select a person, then Tab or the Possess button. `05-systems.md` used to say a click possesses | a single click has to select, or nothing could be inspected | B2, C5 |
| 4 | **An official's panel opens on K** while you possess them, not by itself | opening it by itself would cover the screen in the middle of walking | D6 "The office" |
| 5 | **Keys:** Routes is U (R turns the piece being placed); Dig is C; Realm and the office are K; the officer's order wheel is hold-B; Find (Ctrl + K) works in Command view only; overlays have no keys | R for rotate is what builders expect; in Possess, Left Ctrl is the sprint key, so nothing there may need Ctrl | the Default column in B3; every key is rebindable anyway |
| 6 | **Entering the world goes fullscreen.** Left Ctrl sprints only where the browser has locked the keyboard for the game (and always on a Mac); elsewhere it is switched off and sprint is double-tap W. After Esc, the game needs one click to take the mouse back | Ctrl + W closes the tab and a page can't stop it; browsers also refuse to lock the mouse from an Esc press | B1, and the setting "Fullscreen on play" |
| 7 | **The cut:** the camera sees underground through one level slice that hides everything above it. It shows open space only where your people have seen (`16-sight.md` §5.4, since the sight rules). Its keys are built in phase 1.8 with the caves, so you can look into them from above in Milestone 1; since the sight rules, the cut itself comes in phase 1.1 (entry 49) | a 1.5 km deep world needs one simple tool; it keeps "information has a cost" | C2 |
| 8 | **Hand crafting is a list of recipes** ("Handwork"), not Minecraft's pattern grid. **Stamina replaces hunger.** No recipe book or advancements; the experience bar shows a person's own level (`13-units-classes-power.md` §7) | recipes here need workstations, proficiency and time (`05-systems.md` §12); a pattern grid would need a second recipe system | D6 "Inventory" |
| 9 | **A seventh overlay, Mana** (Milestone 6) | the mana grid has load, losses and storage to read at a glance | D2 |
| 10 | **Owner fly speed** is Minecraft's creative speed in steps ×1 to ×16 on `[` and `]`, replacing "20 m/s with a ×10 boost" | it feels like Minecraft at ×1 and still crosses the world at ×16 | B3 "Owner tools" |
| 11 | **Look:** panels are flat and nearly opaque with no blur; corners are 4 and 6 px; one small shadow | blur costs frames over a 3D scene and reads as decoration; legible text over any terrain | the tokens in `06-ui-art.md` §5 |
| 12 | **A ruler picks a title:** King, Queen or none, shown before the name ("Queen Aoi"). Titles earned in past seasons ("Breaker of the Hoarfather") are called **honours** on screen, so the two don't get mixed up. The Steward's rival line now says "Watch its riders" | the Chronicle examples in `03-lore.md` use all three; a rival may be a queen | D1 "Founding a kingdom"; `03-lore.md` §7 |
| 13 | **The Possess screen shows alerts but no date and no minimap** | Minecraft's screen, plus the one thing a king can't miss | D6 |
| 14 | **An empty list is one plain line** ("No routes yet") with no arrow or link | the panel's main button already does it; this replaces the old "Appoint one →" principle | E3, `06-ui-art.md` §1 |
| 15 | **Only twelve actions ask "are you sure":** demolish, delete a route, disband, break a treaty, reset settings, reset keys, clear the owner's edits, and (added with the units rules) swear the oath, call the fire, kindle a Calamity, begin the Marrow Rite, take off a bound relic | every other action can be undone or is cheap | the rows marked *confirm* |
| 16 | **The menu pauses the world in Milestones 1–4** and never from Milestone 5 | a shared server can't pause | D8 |
| 17 | **A Dig tool** in the Build palette: drag a rectangle to mark ground. "Down" digs a set depth (on the surface a pit, on the cut a room or tunnel); "Level" flattens to where the drag began | the game extends downwards, and nothing in the docs let a king order digging | D3 "Digging" |
| 18 | **Every change to the world is an order that travels.** Close by it lands at once. Farther off, the control shows the new value as pending until it arrives. To a place that is cut off it goes by rider, or not at all if no rider can get there | `05-systems.md` §4 says orders travel like news; this makes it visible everywhere, not only for armies | A4 "Orders travel" |
| 19 | **Moved earlier or later than first written:** the death screen is in Milestone 2 (people can already die there); armies under a Marshal, siege and morale are in Milestone 5 with war between kings; loyalty is named in Milestone 3 | the roadmap builds those systems then | the Since column; `08-roadmap.md` |
| 20 | **Small additions you didn't ask for,** each one row or a few: control groups (Ctrl + 1–9); four camera bookmarks (F5–F8); named map markers; whispers between kings and a chat on/off setting; a pay day shown in the Treasury; three ration levels; "No word from {place}" news; a live score rank; the nearest king shown on a spawn site; a queue when the server is full; one tab per account; a minimum window size; a "new version" banner; carry weight slowing a possessed unit; achievements called "Deeds" and leaderboards "Standings" | each fills a hole a player would hit; none adds a system | delete the row |


**2026-10-08 · units, classes and power** (`13-units-classes-power.md`, `14-class-library.md`, `15-item-library.md`). The owner set the rules (no first person; skills; classes, roles and ranks; a power ladder up to the Calamity). These are the agent's calls inside them. Each is reversed by editing the section named.

| # | Decision | Why | To reverse |
|---|---|---|---|
| 21 | **One camera for playing a unit, Overhead:** the Command camera locked on the unit; the cursor aims and the unit looks where it points; no pointer lock. The first draft also had Shoulder, a camera over the unit's shoulder; it went when you asked for bird's-eye only, later the same day | your rule | 13 §3, 11 C4 |
| 22 | **Words:** "skills" now means the powers; the old 0–100 skills are **proficiencies**; a job is a **class**; **role** means Assault, Guard, Support or Secondary; "Make hero" is gone | your word "skills" had to mean the powers, and "role" had to mean the fighting roles | 13 §2 |
| 23 | **Seven grades of ten levels:** Common, Proven, Tempered, Elite, Champion, Paragon, Calamity. Each adds the same Might (+0.5); the price climbs: a deed, a promotion into scarce places (1 in 20, 100, 1,000 people), a Trial you must play, a Warden relic or the Marrow Rite | "linear in power, extremely hard to obtain" | 13 §9 |
| 24 | **Overmatch:** a hit on someone two or more grades above the attacker loses 25% per grade of gap (90% at most) | it is what makes a Champion untouchable by levies and a Calamity by armies, without exponential numbers | 13 §5.4 |
| 25 | **Skill slots:** Knack (passive), Active, Ultimate (needs Resolve, earned by doing the job), Art and Mastery (advanced classes and Champions), relic skills, and the Calamity's Cataclysm, each with a budget | "an active, then an ultimate"; balanced early and broken late | 13 §11 |
| 26 | **Played people learn three times as fast,** five times in their first ten minutes each day, and only a played unit can pass a Trial | you want players to play and level many units, not one | 13 §3.8, §7 |
| 27 | **Four ways to a Calamity:** Kindled (a Great Hearth, a congregation of 300+, 100,000 offerings, then daily upkeep), Oathbound (an Assault Champion who burns after one day), Crownbearer (the Broken Crown from a king slain by another kingdom), Relic-bound (the three Tier V relics, each with a hunger). One per kingdom, plus one Oathbound. A Calamity has a second life pool, Flame, fed by its upkeep | your three examples (worshippers and churches, an oath to die, killing a king), plus the deepest Wardens' relics | 13 §15 |
| 28 | **Military ranks:** Recruit, Private, Corporal, Sergeant, Lieutenant, Captain, Commander, Marshal. Warrior is a class, so your "warrior" rank became Corporal and Sergeant | a class and a rank can't share a name | 13 §13.1 |
| 29 | **The government:** a Crown Council of eight (adding a Chancellor, a Spymaster and a High Hearthkeeper), Governors over provinces, Reeves, and local posts; every office has one office skill | your "office government rankings" | 13 §13.3, 14 §6 |
| 30 | **The Downed:** a person at 0 Health has 30 s (60 s for Champions and the king) to be revived; death stays permanent | rescues and battlefield medicine without undoing permanent death | 13 §5.9 |
| 31 | **The king keeps a fixed sheet** (3,600 Health, counts as Paragon) and three skills, and never levels | a king who levels would snowball, and the king must never be a carry | 13 §14 |
| 32 | **Two relics renamed** to fit the three-word rule: "Censer of the Drowned" is now "The Drowned Censer", "Keys of the Keep" now "Severin's Keys" | names on screen are three words at most | `02-world.md` §7 |
| 33 | **The numbers are anchored to one benchmark:** a line fighter with matching gear kills an equal in 8–12 hits at every grade; plate is `10 + 20 × tier`, a sword `10 + 10 × tier` | so every table can be checked against one ladder, which the content checker recomputes | 13 §9.2, 15 §1.2 |
| 34 | **Words that clashed:** the season's achievements are **Feats** (a class's proof is its deed); the Deep's third rank is **veteran** (Elite is a grade); the Guard's control reads **Guarding** (wards are mana's) | each word means one thing on screen | 11 D5, 13 §16, 02 §6 |

**2026-10-08 · sight** (`16-sight.md`). You set the rules: bird's-eye only; a human field of view for every unit and every NPC; you see only what your units see; the land always drawn, slightly darker outside their sight; buried things in total darkness. These are the agent's calls inside them. Each is reversed by editing the section named.

| # | Decision | Why | To reverse |
|---|---|---|---|
| 35 | **The view cone:** 120° across, from 60° below level to 45° above, plus 3 m all round for what is right beside a creature | about a person's useful field of view: wide enough to feel natural, narrow enough that flanks and backs are blind | 16 §3.1 |
| 36 | **Range comes from light:** 4 m plus 4 m per light level on the thing seen, so 64 m by day, 20 m on a dark night and 4 m in pitch black; a carried light is seen three times as far in the dark | one rule covers day, night, caves and torches, and makes light a trade-off: you see, and you are seen | 16 §3.2, §3.4 |
| 37 | **Height:** +2% range for each metre the eyes stand higher, up to ×3 from 100 m | your "higher sees farther": a 25 m tower sees half as far again, a crag three times as far | 16 §3.2 |
| 38 | **The played unit looks where the cursor is,** and sprints only within 45° of where it looks | units see in a cone, so the player has to point it; this is Minecraft's mouse-look, seen from above | 13 §3.4 |
| 39 | **Unseen land is a fifth darker,** and other kingdoms' changes to it show only once your people see the place again | your "slightly darkened"; and a wall built out of sight can't be spotted from afar | 16 §5.3 |
| 40 | **Underground:** what your people have seen is drawn, with a display-only light so it stays easy to work in; what they haven't seen is total darkness; ore inside rock shows only on a face they have seen or through a skill | your "total darkness hides it", with the underground still workable | 16 §5.4, 11 C2 |
| 41 | **Awareness:** calm, suspicious, alert, searching, wary. A foe must stay in sight for a moment (0.25–2 s) before a creature is alert; one that loses you searches, stays wary for 5 minutes and remembers you for 5 (officers 30) | "leaving their view doesn't make them forget you", while sneaking past stays possible | 16 §7 |
| 42 | **Hearing:** footsteps, digging and fights are heard within set distances (sneaking 2 m, digging 16 m even through rock). Hearing turns heads but never shows you anything, except the news "Digging heard under {place}" | sound makes the AI believable, and you still see only what your units see | 16 §7.3 |
| 43 | **Hiding:** sneaking halves the range you're seen at; sneaking in tall plants hides you beyond 3 m (League's brush); a hit on a creature that hasn't noticed you counts as from the rear | stealth and ambush pay, which is what makes cover and terrain worth using | 16 §4, 13 §5.3 |
| 44 | **On watch:** sentries, soldiers holding a place and Guards see all round, and nobody sees the foot of their own wall or tower | towers need each other and walls need hoardings: the watch becomes something you build | 16 §6 |
| 45 | **What shows without sight:** your own people and things; Calamities and the Crown's bearer, as before; what skills Reveal and Mark; from Milestone 5, what your allies see | the rule is about seeing others, and these were already promised | 16 §5.6 |
| 46 | **Seven interface rows added:** the Sight overlay, a view-cone mark, an awareness mark, last-seen marks, the owner's "See everything", and two news lines (enemies seen, digging heard). **Seven removed** with Shoulder: the crosshair, "Click to play", the F5 view key, and the field-of-view, mouse-sensitivity, invert-look and speed-effect settings | what sight needs on screen, and nothing that only served the camera you dropped | 11 D2, D6, D8, D11, D12, E1 |
| 47 | **The wheel zooms while playing;** the hotbar is on 1–9 only, unlike Minecraft | from above, zoom is needed all the time; a setting could give the wheel back to the hotbar later | 11 B3 |
| 48 | **The free camera keeps wider limits** (10–400 m away, down to 20° from level), so in Milestone 1 you can look across the land | it is your tool for judging terrain, and the king's view only arrives in phase 1.4 | 11 C4 |
| 49 | **The cut ships in phase 1.1,** following the free camera under cover; its keys and the depth gauge stay in 1.8 | from above, digging down would hide the avatar without it | 11 C2, 08 §1.1 |

---

## 3. Parking lot

- Seasonal modifiers ("the Long Winter": a season with twice the winter)
- Player-built monuments recorded in the Ledger of Kings
- Bounty boards; mercenary companies formed by eliminated players
- Weather events per region as server-wide moments
- A replay of the season's territory map at the Frost
