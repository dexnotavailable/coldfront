# 16 · Sight

This doc is the rulebook for seeing: what every creature sees, what the player sees through their people, and how the game's AI notices, remembers and hides. It sits beside `13-units-classes-power.md` (people) and the catalogue's C2 (the cut, `11-interface-catalogue.md`). Where another doc touches seeing, it points here.

Every number is a starting value for playtests *(tune)* unless it is marked **fixed**.

---

## 1. The owner's rules (8 October 2026)

1. **Bird's-eye only.** No first-person view and no over-the-shoulder camera. A played unit is seen from above (Overhead, `13-units-classes-power.md` §3.4). Underground, the layers that block the camera are cut away as it goes down and up (the cut, catalogue C2).
2. **You see only what your people see.** Enemies, other people, beasts and every other creature are hidden from you unless one of your units sees them. If none of them sees it, neither do you.
3. **Everyone sees like a person.** People and every creature the game runs have a human-like field of view: a cone in front of the eyes, out to a range. Sight shapes how they act: what they notice, whom they target.
4. **Out of sight is not forgotten.** A creature that has noticed you keeps after you when you leave its view.
5. **Higher sees farther.** The view from higher up reaches farther.
6. **The land is always drawn,** slightly darker where none of your people see it now.
7. **What is buried stays dark.** Ore and anything else inside the rock is hidden in total darkness. The underground stays good to look at and easy to work in.
8. **Sight is worth building for:** watchtowers, vantage points, and troops placed where the terrain blocks the enemy's view.

## 2. Words

| Word | Means |
|---|---|
| **Sight** | what one creature sees now: its view cone, out to its range, along clear lines (§3) |
| **View cone** | where a creature can see: 120° across, centred where its head points (§3.1) |
| **Range** | how far a creature sees a given thing: set by the light on it, the height between them, the weather and how the thing moves (§3.2) |
| **In sight** | seen now by at least one of your people, or by a source of §5.1 |
| **Unseen** | not in sight. League's "fog of war". The screen never calls it fog, because fog is weather |
| **Known** | underground space, or a face of rock, that your people have seen at least once (§5.4) |
| **Underground** | wherever no sky light reaches (`04-terrain.md` §13.3). The mouth of a cave, where daylight still reaches, is not underground |
| **On watch** | posted to look out: sees all round (§6.1) |
| **Awareness** | what a creature the game runs knows of its foes: calm, suspicious, alert, searching or wary (§7.1) |
| **Sound** | what a creature hears: footsteps, digging, fighting (§7.3). Not the kingdom-wide Noise that draws the Deep's scouts (`05-systems.md` §12) |
| **Foe** | a creature its side fights: for people, the Deep's creatures, hostile beasts, soldiers of kingdoms they have no pact or alliance with (`05-systems.md` §19), and anyone who attacks them |

---

## 3. What a creature sees

These rules hold for every creature: your people, other kingdoms' people, beasts, the Deep's creatures, generals and Wardens. A played unit sees by the same rules: playing it never lets it see more.

### 3.1 The view cone

- **Eyes** sit at eye height: 1.62 m for a standing person and 1.27 m for one sneaking (`07-architecture.md` §6). Other creatures' rows give theirs, and may widen the cone: a deer sees nearly all round.
- **The cone** is 120° across, centred where the head points, and reaches from 60° below level to 45° above it. Something outside it is not seen, however close, with one exception:
- **Close by,** within 3 m, a creature notices anything all round it along a clear line (hearing and touch).
- **Where the head points:**

| Doing | Looks |
|---|---|
| walking, running, riding | where it goes |
| working | at the work |
| fighting | at its target |
| idle, waiting or patrolling | round about: the head swings 90° to each side and back every 6 s |
| suspicious | toward what caught its attention (§7.1), turning at 180° a second |
| on watch | all round (§6.1) |
| asleep | nowhere: it sees nothing, and a sound within half its usual distance wakes it (§7.3) |
| played | toward the cursor: the head turns to the aim point, so the unit looks where the cursor is (`13-units-classes-power.md` §3.4) |

### 3.2 Range

How far a creature sees a thing:

| Factor | Rule |
|---|---|
| **Light** | `4 + 4 × L` metres, where `L` is the light level on the thing, 0–15: the higher of its block light and its sky light at that time of day (15 in the open by day, 4 at night). So 64 m in daylight, 20 m on a night under open sky, 4 m in total darkness |
| **Height** | × `(1 + h ÷ 50)`, where `h` is how many metres higher the eyes are than the thing's own eyes (for land, than its surface), and nothing when they are lower. ×3 at most, from 100 m up |
| **Size** | a creature taller than 2 m is seen 2 m farther for every metre above 2 m: a 12 m beast 20 m farther |
| **Weather** | × 0.75 in rain or snow; × 0.5 in fog, mist, smoke or falling ash; × 0.25 in a sandstorm, a blizzard or the Frost's whiteout. Region rows and world events say which they bring (`05-systems.md` §16) |
| **Sneaking** | a sneaking creature is seen at half the range |
| **Senses** | **Night-eyed** (a trait, `05-systems.md` §5): the light counts 4 higher for its sight, 15 at most. **Creatures of the Deep** see in the dark: for them the light is never under 8. Rows that name sight (Knacks that see 10% farther, the spyglass of §6.3, a meal or a relic) say how they change it |

The factors multiply. Examples by day, on open ground:

| Who looks | Sees a standing person at |
|---|---|
| a person on the ground | 64 m |
| a guard on a wall walk 10 m up | 77 m |
| a watcher on a 25 m watchtower | 96 m |
| the same watcher with a spyglass in the pack | 144 m |
| a lookout on a crag 100 m above the valley | 192 m |
| the lookout, spyglass raised | 384 m, in a 20° cone |

By night, under open sky: 20 m from the ground, 30 m from the 25 m tower, and a torch-bearer from 156 m (§3.4).

**Overrides.** A **Hidden** creature (`13-units-classes-power.md` §6) is seen only within 8 m, 3 m while it sneaks, whatever the light and height. A **Blinded** one sees 4 m. A Reveal shows what it names through anything, for its time (`13-units-classes-power.md` §11.8).

### 3.3 Lines of sight and cover

A thing is seen when it is in the cone, within range and at the end of a **clear line** from the eyes. A creature is checked at three points, its head, its middle and its feet, and is seen if any one of them is. A block is seen when a line reaches one of its faces.

- **Solid blocks** stop the line.
- **See-through:** glass, clear ice, bars, fences, doors that are open, and torches and other small blocks.
- **Water** lets the line through for 4 m, then stops it.
- **Leaves, tall plants** (two blocks high), reeds, hedges and crops at full height let it through for 2 m, then stop it.
- **Smoke,** dust and the clouds that skills and bombs make stop it (`15-item-library.md` §13).

### 3.4 Lights in the dark

Where the sky light is under 8 (at night, and underground), anything that is or carries a light (a torch, a lantern, a fire, lava, a burning building or creature) is seen from **three times** the range its light gives: a torch-bearer, light 12, from 156 m; a lantern, light 14, from 180 m. What a light shines on is seen by the usual rule, by the light that reaches it.

So a light both shows and gives away. A patrol with torches sees the ground around it and is seen from far off; one without them sees 20 m and is seen from 20 m.

---

## 4. Hiding

Ways to stay out of sight, and their answers:

- **Walls and terrain.** Anything solid between you and the eyes. Ridges, walls, tunnels and the far side of a hill hide whole armies.
- **Plants.** A creature that sneaks with its head inside leaves, tall plants or full-grown crops is seen only from within 3 m. This is League's brush, and it works as a hiding place for an ambush, not as a road.
- **The dark.** At night or underground, without a light, a creature is seen only from 20 m, or 4 m in total darkness, unless the eyes see in the dark.
- **Sneaking** halves the range at which you are seen, doubles the time a foe takes to notice you (§7.2) and is all but silent (§7.3).
- **Smoke** (`item.smoke-pot`) and skills that make a creature **Hidden** (the Scout's, the Assassin's, the Shade's in `14-class-library.md`).
- **The answers:** light (torches, lamps, fires), height, people on watch, hounds, and skills that **Reveal** hidden foes (`13-units-classes-power.md` §11.10 sets how far).

A hit on a creature that isn't yet alert to its attacker (§7.1) counts as from the rear, × 1.5 more (`13-units-classes-power.md` §5.3). That is what hiding buys. Wardens and generals are never caught unaware: a Warden knows everyone inside its arena, and a general is alert from the moment a foe enters its fort.

---

## 5. What the player sees

### 5.1 Your sight

Your sight is everything seen now by:
- your people, and the beasts that are yours (a Houndmaster's hounds, mounts)
- from Milestone 5, your allies' people (`rel.ally`)

What they see reaches you **live inside your connected coverage** (`05-systems.md` §4). Outside it, a sighting reaches you as news when a rider brings it, and shows as a last-seen mark (§5.5). The unit you are playing is the exception: you are there, so its sight is always live. Before Milestone 4 there is no network, and everything your people see is live.

### 5.2 Creatures and things

Everything that moves or can be carried off (creatures, carts, boats, siege engines, piles and dropped items, shots in flight) is drawn **only while it is in your sight**, apart from what is yours.

- **Yours** is always drawn: live inside connected coverage, elsewhere where the last news put it.
- **Appearing:** a thing fades in over 150 ms when it comes into sight.
- **Leaving:** it stays drawn for 1 s after the last of your people loses sight of it, then fades over 300 ms, so a head that swings past doesn't make it flicker. From Milestone 4 a last-seen mark stays behind (§5.5).
- **What isn't drawn can't be picked:** no hover outline, no selection, no target under the cursor. Orders can still be given to the ground or to a last-seen mark.

### 5.3 The land

The land is always drawn, everywhere: the world as it was generated, and the changes you know of.

- **In sight,** it is drawn as it is.
- **Unseen,** it is drawn **a fifth darker** (80% brightness). Land stays in sight for 2 s after the last look at it and fades over 500 ms, and the edge between the two is softened over 2 m, so the land doesn't flicker as heads turn.
- **Changes** made by your own people show as they are, everywhere. Changes made by anyone else (another kingdom's walls, a hole the Deep dug, a burned house) show only once one of your people has seen that place since; until then you see the land as you last saw it.
- **Ore and anything inside the rock** is never drawn through the rock. Ore that shows on a face, in a canyon wall or a cliff, is part of the land and is drawn like it.

### 5.4 Underground and the cut

Without a cut the camera sees only the outside of the world, so the underground needs no rule there. Under a cut (catalogue C2), the cut opens it, and these rules decide what it shows:

- **Known space,** what your people have seen of the underground, is drawn and lit by the cut's survey light, so tunnels and caverns read clearly however dark they are. It is a fifth darker where none of your people see it now, as unseen land is.
- **Space your people have never seen** is total darkness: where the cut passes through it, the cut's face covers it as if it were rock, and below the cut every face that borders it is drawn in the face's own near-black.
- **Ore inside the rock** stays dark: the cut's face is one flat colour and never shows what it cuts through. Ore becomes known when one of your people sees a face of it, or when a **Reveal** or **Survey** shows it, and known ore stays on the Resources overlay (`overlay.resources`).
- **A Survey** that charts caves or open space (`14-class-library.md`) makes that space known.
- **Getting to know the underground** is seeing it: a person in an unlit tunnel knows 4 m around, a torch-bearer about 10 m and a lantern-bearer 12 m, and a lit cavern can be known from across it. Digging a tunnel makes it known as it goes.
- Creatures underground follow §5.2, like any others.

### 5.5 Last seen

From Milestone 4, when a foe or a company of foes leaves your sight, a **last-seen mark** stays where it was last seen: its outline, faded, with what it was and how long ago (`mark.lastseen`). It goes after 5 minutes, or at once when one of your people sees that it isn't there. Sightings that come as news make the same marks, with their age (`13-units-classes-power.md` §11.8). Last-seen marks are the player's memory, never the game's: what a mark shows is only what was seen.

### 5.6 Exceptions

You see these without sight:
- what your people's skills **Reveal** and **Mark** (`13-units-classes-power.md` §11.8)
- a Calamity within 2 km of your coverage, and the bearer of the Broken Crown anywhere (`13-units-classes-power.md` §15)
- everything, for the owner: always in the free camera, in Milestone 1 in the king's view too, and from Milestone 2 with `tools.sight` (owner tools last through Milestone 4)

### 5.7 The map and the minimap

The minimap and the map show what the world view shows: the land always; creatures only in sight; last-seen marks; and on a layer, only what your people know of it.

---

## 6. Watching

### 6.1 On watch

A person is **on watch** while posted to look out:
- staffing a watch post: a watchtower's platform, a wall walk or a gatehouse (their staff, `building.staff`)
- a soldier whose company holds a place (Hold or Garrison) and isn't fighting
- a Guard keeping its ward (`person.ward`)

On watch, the head turns all round, so the cone covers 360° (within the same 60° below and 45° above), and it notices twice as fast (§7.2). A person on watch does no other work. Creatures of the Deep post sentries by the same rule.

### 6.2 Towers, walls and high ground

- **A watchtower** is a high platform with a watcher on it (`05-systems.md` §4): its reach is the watcher's sight from the top, all round, with the height of §3.2. Its coverage is the network's and is a separate thing.
- **High ground** is a vantage point: a person on a hill or a crag sees farther by the same rule, and the AI uses it (§7.6).
- **Walls** hide what is behind them, and a wall walk lets the defenders see over.
- **The foot of a wall or tower** is dead ground: nobody on top sees more than 60° below level, so from a 25 m tower the ground within about 14 m of its foot is hidden. Towers that see each other's feet, and hoardings, cover it.
- **Placing a watch building** shows the ground its watcher would see from there, through the Sight overlay (`overlay.sight`).

### 6.3 The spyglass

`item.spyglass` (Milestone 4). Raised (hold the use button with it in hand), the cone narrows to 20° toward the cursor and reaches twice as far; the unit moves at sneaking speed while it is up. A person on watch who carries one sweeps with it: their range is × 1.5 all round.

### 6.4 Light as a tool

- **Torches and lanterns** (`15-item-library.md` §7.2) set on walls and posts let your watch see attackers at night: someone walking into a gateway lit by a torch is seen from about 45 m (more from a tower), someone in the dark beyond it from 20 m.
- **Carried lights** let a person see and be seen (§3.4).
- **Underground,** people who work where the light is under 4 carry a torch or a lantern when their pack holds one, and diggers set a torch on the wall every 8 m of new tunnel while they have torches.

### 6.5 What this asks of a player

- Post a night watch, or your town is dark while it sleeps: sleeping people see nothing.
- Build towers where they see each other's feet, and light the gates.
- Put archers high: a longbow shoots farther than a person on the ground can see (`15-item-library.md` §3.2), so a high post or a spotter lets them use it.
- Hide a company in the plants or behind a ridge and let the foe walk into it.
- Scout with a light-footed Scout, sneaking from cover to cover, and read last-seen marks before you march.

---

## 7. Awareness: how the AI uses sight

Every creature the game runs (the Deep's, beasts, and people of every kingdom, yours included, whenever no player plays them) acts on what it has seen and heard, never on what it couldn't know.

### 7.1 States

A creature holds one state toward its foes:

| State | It | Until |
|---|---|---|
| **Calm** | goes about its business | something catches its attention |
| **Suspicious** | stops, turns toward what it noticed and, if it fights, goes to look | it notices a foe (alert), or 10 s pass with nothing new (calm) |
| **Alert** | knows a foe is there: fights, holds or flees by its orders and kind, and raises the alarm (§7.5) | every foe it knows of is out of its sight (searching) |
| **Searching** | follows where the foe went for 3 s after losing sight of it, then goes to where it last saw it and looks round there for 30 s | it finds a foe (alert), or the search ends (wary) |
| **Wary** | goes back to its work or post, looks round more and notices twice as fast | 5 minutes pass with nothing new (calm) |

It remembers each foe it was alert to, with where it last saw it, for 5 minutes after its last sight or sound of it; officers, generals and Wardens for 30 minutes. Leaving its view never makes it forget you: it is what sends it searching.

### 7.2 Noticing

A foe in a creature's sight makes it suspicious at once, and alert once it has stayed in sight for its **notice time**:

| Where the foe is | Notice time |
|---|---|
| within 8 m | 0.25 s |
| within half the range (§3.2) | 0.75 s |
| farther | 2 s |

The time is doubled when the foe sneaks and halved when the creature is wary or on watch. It runs down as fast as it ran up while the foe is out of sight. A creature is alert at once when a foe hits it, or when an ally's alarm reaches it.

The player never waits for a notice time: whatever is in your people's sight is drawn at once. Your people's own reactions do wait for it.

### 7.3 Sound

| Sound | Heard within |
|---|---|
| sneaking | 2 m |
| walking | 8 m |
| sprinting, riding, a cart | 16 m |
| breaking, placing or digging a block | 16 m |
| a fight: swings, hits, shots | 24 m |
| a shout (§7.5) | 24 m |
| a collapse, a siege engine, a Warden's heavy hit | 96 m |
| a horn, a bell or a drum (`item.signal-horn`) | 200 m |
| a Cataclysm | 1 km |

- Solid blocks between halve the distance, except for digging, which carries through rock at its full 16 m: a listener under the walls hears a sapper.
- A sound makes a creature suspicious and turns its head toward it. A shout or an alarm does more (§7.5). Sound alone never shows anything to the player, with one exception: from Milestone 4, digging that isn't yours, heard by your people under a settlement or its walls, sends the news `news.digging`.

### 7.4 Memory and search

- A searching creature goes to the last place it saw or heard the foe, as a person would, and looks round there; it doesn't know where the foe went after that.
- Creatures of the Deep that lose a foe report it as scouts do (`05-systems.md` §17), and the faction's awareness of a target lasts for days.
- People of another kingdom tell their king what they see as yours do: by the network, or by rider.

### 7.5 Raising the alarm

- An alert creature **shouts:** every ally within 24 m becomes alert to the same foes and learns where they were last seen.
- Horns, bells and drums (sentries, Watchmen, generals) carry the alarm 200 m.
- **A company sees as one:** its soldiers share what any of them sees, so its archers can shoot at what its front rank sees.
- What your people see is yours as well (§5.1), and a first sighting of foes near a place sends the news `news.sighted`.

### 7.6 Tactics

The AI uses sight on purpose:
- Sentries and watchers take high posts and stay on watch.
- Archers look for height and a clear line, and shoot at what their company sees.
- Ambushers wait out of sight (in plants, behind a ridge, in the dark) until the foe is close or an officer calls.
- Scouts move from cover to cover, sneak when foes are near, keep out of lit places at night, and run once seen.
- The hunted break the line of sight and change direction; hunters search where the line broke.
- Creatures of the Deep that see in the dark put out lights where their rows let them.

### 7.7 Your own people

Your people follow the same rules when you don't play them. A worker who notices a foe stops work and runs for the nearest hall or keep, shouting; soldiers act by their orders and role; a watcher with a horn sounds it and stays at the post. Their sightings are your sight (§5.1).

---

## 8. Off screen

In the ledger (`05-systems.md` §22) there are no cones. A settlement or post with people on watch sees an approaching force at the range of its highest watch post, by the time of day; a company on the move sees 64 m by day and 20 m by night. When two forces meet there, the one that saw the other first strikes first: one round of its hits lands before the other answers. On average this must agree with the rules above, as `13-units-classes-power.md` §18 asks of every rule.

---

## 9. Engineering

### 9.1 Where it runs

- **The rules** are shared code in `packages/shared/src/sight/` (Milestone 2): cones, ranges, lines and awareness, pure and inside the allowlist of `04-terrain.md` §3. Cone tests are dot products against fixed cosines, so no trigonometry is needed.
- **Who sees whom** runs in the simulation: the worker in Milestones 2–4, the server from Milestone 5. It updates each viewer at 10 Hz for the played unit, 5 Hz for units near a camera (T1) and 1 Hz for the rest (T2), staggered across ticks. Ledger units (T3) use §8.
- **The darkening** of the land is display. The client computes it from its own people's positions and facings with the same shared code, so the server never has to send it.

### 9.2 Lines and areas

- **Creatures:** candidates come from a spatial hash within the viewer's largest range; the cone and range are checked first, then lines to the three points by 3D voxel traversal (Amanatides and Woo), stopping at the first point seen.
- **Land in the open** (a viewer under open sky): a radial sweep over the column heightmap at 2 m steps, one ray per degree of the cone, keeping the highest angle so far: a column is seen when its top rises above it (a viewshed, as in map software).
- **Under cover:** a fan of 3D voxel rays, every 3° of the cone, out to the viewer's range in that light. Rays mark the open cells they cross as known and the first solid face they meet as seen, which is how ore on a face becomes known.
- **Carried lights** stay out of the light map, so walking with a torch never relights chunks. Sight adds them as it reads the light (a carried light of level `n` gives `n` minus 1 for each metre away), and the renderer draws them as moving point lights.

### 9.3 What is stored

- **Known space,** per kingdom: one bit per open cell underground, kept per 16³ section that has any (512 bytes each), plus the ore blocks seen.
- **Seen changes,** per kingdom and section: the last edit version it saw.
- **Memory,** per creature: its foes with a last-seen place and time, at most 8.
- From Milestone 5 these live with the kingdom's data on the server (`07-architecture.md` §9).

### 9.4 Drawing it

- **The darkening:** a world-aligned 2D sight texture around the camera (1,024 × 1,024 cells of 2 m, about 2 km across) that the terrain shader reads, blended over 500 ms. Land beyond it is unseen.
- **Under the cut:** a per-section knowledge texture that the cut's face and the terrain shader read: the face also covers open space nobody knows, and faces that border it take the face's near-black (catalogue C2).
- **Entities:** the renderer draws only what the simulation says is in sight, with the fades of §5.2.

### 9.5 The server (Milestone 5)

- It sends a client only the creatures and things its kingdom sees (its allies' included), and drops them 1 s after the last sight. A modified client can't show what it was never sent.
- It sends another kingdom's edits for a section only once the kingdom has seen that section since.
- **A known gap:** the natural world is generated on the player's machine from the seed (`07-architecture.md` §9), so a modified client could compute buried ore and unknown caves. Closing it would mean the server generating or sending the underground itself; it is an open question for Milestone 5 (`09-open-questions.md` §1).

### 9.6 Tests

- **Unit tests:** the range table of §3.2, including every factor and the ×3 cap; the cone's edges, the 60° and 45° limits and the 3 m close sense; lines through glass, water, leaves and smoke; Hidden, Blinded and sneaking; the notice times and the state changes of §7.1, including that leaving sight starts a search and never resets to calm; sound through blocks and the digging exception.
- **Scenes:** a watcher on a 25 m platform sees a standing person 95 m away by day but not 100 m away; by night 29 m but not 31 m, and a torch-bearer 230 m away but not 240 m; a wall hides a company; a sneaking scout in tall grass is seen at 3 m and not at 4 m; an unlit tunnel becomes known 4 m around its digger.
- **Drawing:** a creature out of sight is not in the draw list; unknown space under the cut is drawn as the cut's face; the land inside a cone is at full brightness and outside it at 80%.
- **Budgets,** measured from Milestone 2: sight for 200 viewers within 2 ms per 100 ms on one worker; the darkening within 0.5 ms a frame.

---

## 10. What ships when

| Phase | Sight |
|---|---|
| Milestone 1 | none: everything is in sight and known. Leave room in the terrain material for the darkening and for the knowledge test under the cut |
| M2 | your people's sight (§3), with the light, height and lines; the darkened land; underground knowledge under the cut, and ore known only once seen; beasts shown only in sight; `mark.sight` for your people; the owner's `tools.sight` |
| M4 | foes' sight and awareness (§7), sound, memory and search; hiding (§4) and the unaware hit; on watch, watchtowers, the spyglass and lights at night (§6); last-seen marks; the Sight overlay; `mark.sight` for foes and `mark.aware`; the news of sightings and digging; others' changes shown only once seen; the ledger's rule (§8) |
| M5 | the server sends each kingdom only what it sees (§9.5); allies share sight |
