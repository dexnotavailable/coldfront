# 01 · Vision

> **COLDFRONT** is a seasonal, ~100-player voxel civilization builder in the browser. You rule an empire from above and possess its people on the ground. You push supply lines down a funnel-shaped world of hostile regions to break boss strongholds that fight back.

**The owner's technical TL;DR:** *Minecraft, but it extends downwards, with Big Globe installed, and you have a bird's-eye view. All the NPCs and units are controlled by the game computer in an optimised way; each one can break blocks and has an inventory, HP and so on, like a Minecraft player. Possessing one should be the same as controlling a Minecraft player.* (8 October 2026: the camera part is superseded. There is no first-person view and no over-the-shoulder view: units are played from above, and you see only what your units see. See §6, `13-units-classes-power.md` §3 and `16-sight.md`.)

This file is the "why". Everything else in `docs/` is the "what" and the "how". When a detail elsewhere seems to conflict with this file, this file wins. Flag the conflict in `09-open-questions.md`.

---

## 1. The fantasy

You are summoned to Kaldmark as a king, with twenty people and a mysterious Steward who shows you the ropes. From the top-down **Command view** you lay out towns, draw supply routes and send armies. At any moment you can drop into **Possess** mode and *become* one of your people: a miner swinging a pick in a braced tunnel, a captain leading riders to run down an enemy messenger, a Champion you've raised since she was a farmhand with a strange affinity for mana.

The world pushes back. Every region has its own way of killing you: cold, heat, fumes, rot, mana storms, darkness, gales, the restless dead. Building out there means using materials that survive it, keeping people alive there and getting supplies to them. Then you have to defend all of it. In the desolate heart of every region sits a Warden with an army that breeds, scouts and marches. At the bottom of the world sits the King Below.

You win the long game by expanding your **front**: territory, logistics and industry pushed far enough and deep enough that your armies can surround a Warden and grind it down. The strongest things in the world can't be beaten by one king alone, so kings ally, betray and trade. After six months the Frost comes, the world resets, and the names of the kings who broke the Wardens go into the Ledger.

---

## 2. The core selling point (the owner's words)

> **Infrastructure building, expansion, domination, system building, production min-maxing, logistics.**

**When in doubt, favour these.** Every system should feed at least one of them.

## 3. Pillars

1. **The world is the gate.** No level locks, no tech-tree locks, no "requires Town Hall 5". You can build anything anywhere, as long as you can make it, supply it, maintain it and defend it. Difficulty comes from environment, distance, depth and enemies.
2. **Everything is physical.** Every item, coin, order and piece of news exists somewhere in the world and travels through it. There is no global inventory. Supply lines *are* the game, and they can be cut.
3. **Rule from above, act from within.** The Command view runs the realm; possession lets you act as any of your people with full control. Both are first-class.
4. **You drive expansion; the kingdom runs itself.** Automation (job assignment, hauling, upkeep, routing) is on by default and handled by your officials. You can override anything. The player's attention goes to growth, strategy, optimisation and war, not chores.
5. **Sieges, not duels.** Bosses are campaigns. You expand to them, cut what feeds their regeneration, and bring the *right* army: small or large, melee or siege.
6. **A finite war.** Each server is one six-month season on a finite world for about 100 kings. Content is large but bounded, and the reset is part of the design. Only titles and cosmetics carry over.

### Design rules that follow from the pillars

- **Systems stack on real demand.** Deeper content needs better gear, which needs rarer materials, which come from harsher regions. Getting them needs better buildings and logistics, which need more people and money, and those need safety. Nothing is unlocked by a menu.
- **Information has a cost.** You see only what your people see. You see it live, and command and possess, only where your connected network reaches. News travels by rider, signal tower or mana relay, and it can be intercepted.
- **Scarcity creates politics.** Key resources exist in one region only. Whoever holds the gold and silver mints the money; whoever holds skystone controls the fast way down.
- **Depth costs.** Each layer down is harsher, and climbing back up hurts more.
- **Loyalty is the glue.** People pledge to kings. War is won by breaking loyalty as much as by killing.
- **The world is the interface.** The UI stays quiet, clean and organised (`06-ui-art.md`), and holds nothing that isn't listed in `11-interface-catalogue.md`.

---

## 4. Tone

Grounded high fantasy, arcane-industrial, **cold steel**. People are human and practical. Magic is rare, expensive and dangerous, and mages are years of training and a kingdom's most precious people. Tech grows from hand tools and carts to forges, rails, conveyors, lifts and mana engines, but it always looks built and maintained, never clean sci-fi. The palette runs cool: iron, slate, frost, lamp-light. The fantasy regions break that palette on purpose.

No jokes in the world's voice. Wonder and dread come from scale: a thorn forest the size of a city, a cavern with its own clouds, a cliff hundreds of metres high.

### Touchstones (what we take from each)

| Reference | What we take |
|---|---|
| Minecraft + **Big Globe** mod | Voxel world, everything breakable, huge vertical and horizontal scale (Big Globe's overworld is 2,048 blocks tall), varied terrain, distant-terrain rendering. A played unit moves, digs and builds exactly like a Minecraft player. Big Globe is a quality target to learn from by playing it; its code is off-limits (`10-prior-art.md` §1) |
| *Made in Abyss* | Verticality, layers that get stranger, the cost of coming back up |
| Deepwoken | Harsh world, earned mastery, danger that is always nearby |
| Arknights: Endfield | Infrastructure and factory building, hand-laid production lines |
| Kingdoms and Castles | Readable, charming civilisation building |
| Age of Empires | Macro command, armies, expansion |
| Foxhole | Logistics-driven war, seasonal resets |
| Factorio | Production min-maxing; industry drawing enemy attention |
| Anno | Needs tiers that create demand for long production chains |
| Dungeon Keeper | Possession as a real tool, not a gimmick |

We study techniques. We never copy code or assets from these games or mods. Open-source code we *can* reuse, with licences checked, is listed in `10-prior-art.md`.

---

## 5. Numbers at a glance

| Thing | Value |
|---|---|
| Block | 1 × 1 × 1 m; everything breakable except the technical world floor |
| World | Disc ≈ 43 km across (playable radius 21.5 km); height range y −1,536 to +1,023 |
| Surface regions | 12 × ≈100 km², plus the central Nadir |
| Underground | 4 layers (8 → 5 → 3 → 1 regions), shrinking like a funnel toward the Pit ~1.5 km down |
| Bosses | 29 Wardens + the King Below, and ~100 generals |
| Server | ~100 kings, one 6-month season, new seed each season |
| A strong kingdom at month 4 | 20,000+ citizens |
| Time | 1 in-game day = 1 real hour; 1 in-game year = 1 real week |
| Lives | 3 kings per account per season |

The world's layout and regions are in `02-world.md`. Its history is in `03-lore.md`.

---

## 6. Decision log

These are settled. Don't re-open them without the owner. Unmarked items are the owner's own decisions. **(default)** marks a proposal the owner saw and accepted without objecting. **(technical default)** marks an engineering necessity.

### World
- 12 surface regions of ≈100 km² each (read as ~10 × 10 km (default)), each with its own climate, problems and enemy levels, and at least 4 fantasy regions. The owner named: plains, jungle, swamp or big water, desert, snow, mountains, twilight, and a hellscape with spikes.
- The swamp and great lake are separate regions, and three more are added: **Hoshikuzu**, the **Sundered Isles** and the **Boneyard** (default).
- **Outer ring:** the 7 grounded regions (plains, jungle, swamp, great lake, desert, tundra, mountains) plus the Boneyard, where kings start. **Inner ring:** the 4 fantasy regions (default).
- The centre is the harshest land: **the Nadir**, the demon king's continent, with his castle at its heart. New kings spawn on the outskirts.
- The world is greatly vertical *and* vast horizontally. The underground is funnel-shaped, with the strongest boss at the bottom.
  - The layer counts (8 → 5 → 3 → 1, 17 underground regions) are default.
- **No central hole.** You find natural descents or dig. The demon king's stronghold, **the Nadir Stair**, lets you fight straight down from his castle to the bottom. Most kings will find it too hard and dig other routes.
- **The ascent is deadly.** Tiredness from Layer 1, sickness from Layer 2, death without wards from Layer 3, nothing climbs out of the Pit unwarded (tiers default). Magic wards and ascent/descent infrastructure (warded lifts) are the fix. The underground is late game and needs better gear.
- Terrain generation takes its technique from Minecraft and Big Globe, steered by a hand-designed world plan (default).
- All blocks are breakable. The one exception is an unbreakable world floor (technical default).
- Simple support rules: natural rock is very strong, but wide excavations need beams.
- No airships (default). Skystone powers lifts; the war stays on the ground.

### Kings and lives
- Every player is a king. The king is a very strong unit, able to hold off about 50 normal units long enough to escape, but never a carry. His command features are always available.
- Kings can die while offline. An AI then runs the king, keeping guards around him and moving him to the kingdom's centre or wherever is safest.
- If your king dies, you lose that life. Your people become up for grabs, abandon your infrastructure and migrate. A new king is summoned on the outskirts with ~20 people and a Steward.
- 3 lives per account per season. Later, the first life is free and extra lives cost about $5 each, capped at 3 per season (the cap is default).
- Out of lives means out for the season, but another king can invite you to play as a single unit in their kingdom.
- **The Steward** is the tutorial guide, with a mysterious aura:
  - he can't be controlled
  - he helps: the AI routes him to housekeeping and other useful work suited to his stats
  - he never fights and is never attacked
- **The world does the early killing** (8 October 2026). A first-time king should mostly fall to the world (winter, hunger, beasts, the Deep, disasters), not to veterans. How: `05-systems.md` §2 and §16.

### Command and possession
- Two modes, **Command** (top-down macro) and **Possess** (be any of your units) (default).
- Possession is a whole separate player instance: WASD, attack, break and place blocks, interact, manage inventory. A played unit moves, digs, builds and fights like a Minecraft player: Minecraft's controls, movement and block breaking. Possessing officials and high-ranking units also lets you change classes, jobs and assignments.
- **Bird's-eye only** (8 October 2026, replacing "possessing must feel the same as Minecraft" for the camera). No first-person view and no over-the-shoulder view: units are ordered from the Command view or played from above (**Overhead**). Underground, the cut takes away the layers above as the camera goes down, and puts them back as it comes up (`13-units-classes-power.md` §3, `11-interface-catalogue.md` C2).
- **Sight** (8 October 2026). Every unit has a human field of view: a cone in front of it, out to a range that grows with height. NPCs notice, target and remember by it, and losing sight of you doesn't make them forget you. You see enemies, beasts and every other creature only while one of your units sees them. The land is always drawn, slightly darker outside your units' sight, and anything buried stays in total darkness until your people see it. So watchtowers, vantage points and terrain that blocks sight matter (`16-sight.md`).
- **Every unit is a Minecraft-player equivalent** (break blocks, inventory, HP), run by the game's AI in an optimised way. AI and possession drive the same controller, physics and actions (default design, `05-systems.md` §3).
- An officer is a unit with a **command radius**. Possess a Captain and you lead his company directly (default).
- **Classes, skills and a power ladder** (8 October 2026). Every unit has a class and skills: an Active early, an Ultimate once it has met a gameplay requirement. Most skills are weak and useful (information, highlighting, help with the job); the strongest are outright broken, and only at the endgame. Players play, level and min-max many units. Military units have a class, a role (Assault, Guard, Support, Secondary) and a rank; civilians climb trade ranks; the government has a ladder of offices. The ladder is linear in power and extremely hard to climb. Its top, the **Calamity**, can level mountains, break a small kingdom, solo an easier Warden or hold a kingdom alone, and is costly to keep: worshippers burning offerings, hearths built to uphold it, or a soldier sworn to die. Like kings, Calamities are not to be spent recklessly. For now every person looks like a Minecraft avatar. (`13-units-classes-power.md`, `14-class-library.md`, `15-item-library.md`.)
- **Calamities are forces you try to hold** (8 October 2026). Some come only through enormous sums of money, some demand a following, some are uncontrollable, and some are fiercely loyal and protective. An ordinary person's loyalty is high enough that control is a given, but it plummets when they become a Calamity: keeping your grip on one is another dimension of ruling, and strong rivals will try to take yours. A kingdom can raise a soldier likely to go rogue and roam the lands causing havoc. The protective ones are the staples that keep big kingdoms alive: not aggressive, but they make strongholds that bounce back from a war, and their kits cover whole areas and strengthen allies near the king. They are like nuclear weapons: several kingdoms have one, yet economy, trade and alliances still rule, and that strength is only put to the test when a kingdom has no allies to protect it or to protect. Fewer than ten in the world, usually about five (`13-units-classes-power.md` §15).
- The **network** (watchtowers, signal towers, mana relays) defines where your people's sight reaches you live, and where you command and possess. Coverage must be **connected** to your capital. Capturing relays flips land, and cutting a relay cuts off everyone beyond it (default).
- **News travels physically:** riders early, signal towers later, mana relays late (default). Automated responses wait for the news, so human-led raids that run down messengers beat the AI's reactions.

### People
- Every NPC is an individual with a name, a class and stats (strength, agility, magic affinity, and more). People seek out the work that fits them.
- **Job choice comes from stats only.** Stats vary per person, with average differences by sex: men are stronger on average, women more loyal on average, which keeps production and supplies steady.
- Most people are wanderers who settle. Some come from births, and some start with you.
- Wanderers drift toward whichever kingdom offers the best housing, food, safety and pay. Neutral villages can be won over or conquered; conquered ones start out resentful (default).
- **Loyalty** is swayed by family, pay, safety and events. People pledge to their king. Taking another king's people takes their function, and with it their land.
- **In war:** beat half an army, and high-loyalty units fight to the end while low-loyalty units surrender, flee or get captured.
- **In peace**, loyalty is low-stakes: unhappy people work slower and a few drift off, with no rebellions (the specifics are default).
- **Buildings are neutral.** Whoever's people hold them controls them.
- The kingdom runs itself: the game routes workers to jobs and optimises upkeep and hauling, and you can change anything.
- **Officials are the automation:** Reeves run towns, Quartermasters run supply, Captains run companies (default). They're called Reeves, not "stewards", to avoid a clash with the Steward.
- Households and births (default).
- Needs come in three tiers: peasant, craftsman, noble.
- **Standouts:** you notice someone with unusually high stats and decide to invest: play them, promote them into the scarce Elite, Champion and Paragon places, arm them with Wardens' relics. Death is permanent (default; "heroes" became grades on 8 October 2026).
- **Mages** are rare, highly skilled and long-trained; magic is a difficult resource. Only people with high magic affinity can train at an academy (default).
- **Soldiers are citizens:** each one leaves the workforce and needs gear, pay and food (default).
- **Time:** 1 day = 1 real hour; 1 year = 1 real week, ending in a winter where crops stop. People age a year per real week (default).

### Economy and production
- A fully physical economy. **Money is a major, physical resource**, like in the real world: coin minted from mined gold and silver.
- **Mana replaces electricity.** Crystals are the fuel, ley wells are rare contested sites, and only mages attune generators, relays, wards and enchantments (default).
- Kingdoms export and import, and some hold monopolies. Trade uses a market board and direct deals, and goods always travel physically (default).
- **No global inventory; money circulates**, because wages are spent at your markets (default).
- **Everything wears out:** tools break, food spoils (salt and ice slow it), buildings decay faster under hazards, soldiers need pay, food and gear (default).
- Stats matter: a strong miner digs faster, and a skilled smith makes better blades (default).
- **Factories are built by hand:** you place machines, conveyors and lifts piece by piece.
- **Buildings come from templates or freeform, both built block by block.** They have built-in functions. A building works once it has its parts, and its materials decide where it survives (validation rules default).
- Supply routes are drawn by hand or auto-optimised. You can always change them.
- **Transport** runs from porters to pack animals and carts, then boats, rail, lifts and conveyors (default).
- **Chain length:** medium for most goods; ultra-long for top-tier tech.

### Enemies and bosses
- Around 20–30 big bosses plus ~100 generals, with the strongest, the demon king, at the bottom. This is set as **29 Wardens + the King Below** and 106 generals (numbers default).
- Each Warden sits in a desolate arena, guarded by hundreds to thousands of enemies whose tiers get stronger closer to the boss. They reproduce, push outward and fight back.
- **Boss armies are stubborn: they never break.**
- **Bosses die when their huge HP pool is empty.** Some hit so hard that a small strike force is wiped out; some hit wide areas, so a huge army is a liability; some are so tough that you need siege engines at range.
  - These become three dials: **form** (colossus, warlord, both), **threat** (burst, AOE, fortress) and **regen** (default).
- **Regen varies:** none, slow and natural, absorbing fallen soldiers, fed by structures or resources. The demon king combines the most annoying, hardest-to-stop kinds. He also regenerates for every Warden still alive (default).
- **Enemies spread by time and your activity.** A wandering scout sees your base and walks home to report, and then an army comes. An army that takes a settlement keeps it. Otherwise enemies expand slowly and roam.
- **Dead bosses stay dead** until the reset. Their minions stop spawning, and they drop strong items and artifacts.
- **Presence** (8 October 2026). Bosses and other great powers are felt before they are seen: the wind shifts, the weather and the light change, a hostile one brings a sudden hue and a deep bass, some bring a protective calm that feels almost too surreal, and some bring only silence, and then a mountain is gone (`16-sight.md` §11).

### Seasons
- The content is finite: about 6 months for ~100 players. Then the server resets, and players earn tags and rewards for bosses, achievements and land.
- Each season runs a new seed with the same layout rules (default). The season always runs the full six months, even after the King Below falls.
- **Late joining is allowed all season.** Late joiners and re-summoned kings start small, and they're expected to lean toward PvP takeovers.
- **Boss credit is shared by contribution**, with a minimum threshold. Soloing a boss earns its own achievement.
- **Scoring:** bosses count most, but land, population, wealth and firsts all count. War earns achievements too: waging and winning wars, taking over kingdoms, killing kings.
- A quitting player's kingdom keeps running on AI and slowly decays (default). Only cosmetics and titles carry over (default).

### Presentation and build
- Setting: grounded high fantasy, arcane-industrial; the name evokes the coldness of steel.
- Story and lore are fleshed out (`03-lore.md`).
- UI is clean, minimal, uncluttered and organised (`06-ui-art.md`).
- **No filler text in the interface.** No subtitles or helper lines: an explanation is reworded into the label or moved into a tooltip. **Every screen, button, menu, slider, key and sentence is listed in `11-interface-catalogue.md` before it is built, and nothing else gets invented.**
- Blocky voxel art, produced by code.
- Desktop browser, mouse and keyboard (default).
- **The first milestone is the world:** terrain generation at Big Globe quality. The owner's previous attempt with another model failed on primitive-looking hellscape spikes.
- The owner self-hosts the multiplayer server for now. Build previews are free static hosting (default).
- **Stack** (TypeScript, Three.js, shared browser/server code, Rust/WASM only if needed) (default). A licence-checked audit of open-source prior art confirmed it and adjusted details (`10-prior-art.md`, `07-architecture.md`).
- **The owner builds with coding agents:** OpenAI's Codex from October 2026, after starting the docs with Claude Code. Both read the same guide, `AGENTS.md`, so either can pick the work up (`12-sessions.md`).
- **Names are diverse:** Japanese/anime-styled names (regions, characters, bosses) alongside the European fantasy names, drawn from the world's three tongues (`03-lore.md` §8 and §12). Code uses stable IDs, so names can change freely.
- **Light to simulate** (8 October 2026). Optimised on every front: whatever nobody is watching runs as code, probability and calculation, so hundreds of thousands of people and more stay cheap, and things happen while you're away. A rendering hiccup can be forgiven; a slow simulation can't (`17-simulation-and-bots.md`).
- **Tools to build it alone** (8 October 2026). The owner can't playtest alone, so builds can speed the world up, skip ahead in a way that looks natural, and cheat for testing. **Bot kings** make the choices a player would, like a chess engine: an authored "expand your empire 101" book, and choices driven by the numbers (which resource matters most, which Warden to go for, where to expand). They serve development and playtests first, and may later fill a server short of players (`17-simulation-and-bots.md`).

---

## 7. Glossary

| Term | Meaning |
|---|---|
| **Kaldmark** | The world: a vast basin ringed by ice, draining toward the Nadir |
| **King** | A player's avatar and life. Dies → the kingdom collapses |
| **The Steward** | The mysterious tutorial guide every king gets. Can't be controlled; never fights |
| **The Steward's peace** | A new king's first three real days, when other kingdoms can't harm it (`05-systems.md` §2) |
| **Command view / Possess** | The two play modes |
| **The cut** | Command view's way of seeing underground: a level slice that hides everything above it (`11-interface-catalogue.md` C2) |
| **The catalogue** | `11-interface-catalogue.md`: the complete list of what the interface contains. If it isn't there, it isn't in the game |
| **Network** | Watchtowers, signal towers and mana relays. Its *connected* coverage is where your people's sight reaches you live, and where you command and possess |
| **News** | Any report or order; it travels physically through the network or by rider |
| **Ledger** | The in-game book of what your kingdom has learned about the world |
| **Tally** | The simulation of everyone nobody is watching: settlements as numbers, rates and dice (`17-simulation-and-bots.md` §2) |
| **Bot king** | A kingdom the game plays, by a player's rules, marked as a bot (`17-simulation-and-bots.md` §6) |
| **Reeve · Quartermaster · Captain · Marshal · Magister · Treasurer · Envoy** | Officials: town · supply · company · army · mana and mages · coin · trade and diplomacy. The full ladder of offices and posts is in `13-units-classes-power.md` §13 |
| **Class · Role · Rank · Grade** | A person's trade · a soldier's place in a fight · a step on a ladder of command, trade or office · a step on the power ladder, from Common to Calamity (`13-units-classes-power.md`) |
| **Skill** | A power on a slot: Knack, Active, Ultimate, Art, Mastery, a relic's, or a Cataclysm (`14-class-library.md`) |
| **Calamity** | The top grade: one person who can break a small kingdom, and a force its king tries to hold. Five natures: Sellsword, Idol, Wildfire, Bastion and Oathsworn. Usually about five in the world, never more than nine (`13-units-classes-power.md` §15) |
| **Hold · Rogue** | How firmly a king holds a Calamity, 0–100 · a Calamity that broke loose at Hold 0 and roams as a threat to everyone |
| **Overhead** | The camera for playing a unit: the Command camera locked on it, from above |
| **Sight** | What a unit sees: a view cone with a range. You see only what your units see (`16-sight.md`) |
| **Presence** | What a great power gives off: a change in wind, weather, light and sound, or a silence (`16-sight.md` §11) |
| **Telegraph** | How a coming blow shows itself: the attacker's wind-up pose, and its shape filling on the ground (`18-look-and-feel.md` §8.2) |
| **Band** | The player's short list of people to switch between while playing |
| **Warden** | A region boss (29 of them) |
| **Seat** | A Warden's arena and fortress at the desolate heart of its region |
| **General** | A mini-boss holding a fort in a Seat's guard rings (~100 total) |
| **Muster** | An enemy spawner structure; generals command musters |
| **The King Below** | The final boss in the Pit |
| **Layer** | An underground depth band: the Upper Deep, the Undercrown, the Maw, and Naraku (the Pit) |
| **Court speech · Rim speech · Scholars' Latin** | Kaldmark's three tongues, the sources of all names (`03-lore.md` §8) |
| **Region ID** | The stable code name of a region (`hellscape`), separate from its display name (Ibara) (`02-world.md` §2) |
| **Shelf** | The hard rock band between two layers |
| **Descent** | A natural or built route between layers |
| **Deeprock** | Hard, sparse rock outside a layer's funnel footprint |
| **Front** | Your frontier of territory and logistics; in-world, also the play period of a Turn |
| **Turn** | The in-world name for a season: Thaw → Front → Frost |
| **The Frost** | The in-world season end: the world freezes and resets |
| **Season** | One server run of six months. Never used for spring or summer; call those "times of year" |
| **Life** | One king. 3 per account per season |
| **Crown / Mark** | Gold / silver coins. ("Crown" also means a kingdom and the Old Crown dynasty; in code the coins are `CoinCrown` and `CoinMark`) |
