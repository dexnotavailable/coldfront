# 18 · Look and feel

How the game looks and moves: the camera's feel, rendering and shaders, how movement is drawn, animation, effects, and the interface's motion. Much of this is already fixed elsewhere, and this doc points there rather than repeating it: terrain rendering in `04-terrain.md` §13, the tokens and art direction in `06-ui-art.md`, the interface and the cameras in `11-interface-catalogue.md` Parts A–C, the avatar in `13-units-classes-power.md` §3.2, sight and presence in `16-sight.md` §5 and §11. This doc adds what was missing and keeps the whole feel in one place.

Where this doc and the catalogue disagree about anything on the interface, the catalogue wins; where it disagrees with `04-terrain.md` about terrain, that doc wins. Fix this one. Every number is a starting value *(tune)* unless it is marked **fixed**.

---

## 1. The owner's request (8 October 2026)

"Throw in some aesthetic choices: camera pan, shaders, rendering, UI style, easing here and there, player movement, effects, animations and whatnot."

Already settled, and not changed here: a played unit moves exactly like a Minecraft player; play is bird's-eye only; the camera never shakes; the interface has no filler; the terrain aims at Big Globe quality.

## 2. The feel in six rules

1. **Readable from above first.** Everything is judged at the Overhead distance (24 m) and must still read from the Command view's usual heights (`d` 80–400 m). If an effect can't be read from above, it isn't drawn. Small detail belongs to close zoom.
2. **Crisp and anchored.** The camera and the interface answer within one frame and settle fast. Nothing drifts, floats or overshoots. Movement is Minecraft's, and the screen never fakes momentum.
3. **Light and air carry the mood.** Beauty comes from light, fog, sky, weather and wind (`06-ui-art.md` §9), never from effects laid over the screen (§4.3).
4. **Every motion means something.** An animation shows a state or a change: work being done, a blow coming, a value falling. The interface never loops for decoration. The world's quiet life (plants in the wind, water, flame, glow) is the only motion with no message, and it stays quiet.
5. **Weight through timing.** Big things are slow to start and final when they land: wind-ups, telegraphs, Cataclysms. Small things are instant. A hit feels solid through a flash, a knockback and a burst of particles, never through freezing the game or moving the camera.
6. **Cold steel, lamp-light.** Materials and light stay cool and grounded (`01-vision.md` §4). Warmth comes from fire and lamps; strong colour comes from magic and the fantasy regions.

---

## 3. Motion

### 3.1 Curves

The interface, the cameras and the world's animations share four curves:

| Name | Curve | For |
|---|---|---|
| `ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | anything in the interface or the world that appears or answers the player |
| `ease-in` | `cubic-bezier(0.64, 0, 0.78, 0)` | anything you dismiss |
| `ease-move` | `cubic-bezier(0.65, 0, 0.35, 1)` | something going from one place to another on its own: the Tabs underline, a door |
| `ease-camera` | `cubic-bezier(0.61, 1, 0.88, 1)` | every timed camera move: gentler at the start than `ease-out`, so a short move never looks like a cut at 30 frames a second |

- **Fixed:** nothing overshoots or bounces, in the interface, the camera or the world. Only physics moves things past where they were going.
- Loops and steady motion (conveyors, wheels, the key-pan ramps of C1) are linear.
- **Following** is exponential: each frame, `value += (target − value) × (1 − e^(−Δt ÷ τ))`, so it ends the same at any frame rate (C7). Whatever the camera chases follows this way: a followed unit, the ground, the aim point and the tilt that clears terrain.

### 3.2 Durations

- **Instant** (the next frame): hover, press, selection, an order given, a block breaking.
- **100–150 ms:** a placed block popping in, a door turning, a selection ring settling, a Bar easing to its new value.
- **200–400 ms:** drawers (`06-ui-art.md` §5), camera glides and transitions (C3, C5).
- **0–1.5 s:** what the player must see coming: a skill's wind-up (`13-units-classes-power.md` §11.5), a foe's telegraph (at least 1 s, and 1.5 s for a wave: §16 there).
- **Seconds and more:** the world's slow changes: a region's air blending (2 s, `04-terrain.md` §13.4), weather, time of day.
- In the interface, what you dismiss leaves in two thirds of the time it took to come; what times out (a toast, a card) fades slowly, so it can be read to the end.

### 3.3 Two clocks

- **The world's clock** moves the sun, the sky, the calendar and the weather. It runs at world speed (`tools.pace`) and jumps when time is skipped.
- **The display clock** moves everything that moves only for the eye: wind, water, flame, glow, particles, cloud drift. It is real time, it stops while the world is paused, and postcards and tests set it, so the same shot comes out the same (§11). At × 20 world speed the sun races, and the grass still sways as it always does.
- The curves live in `packages/client/src/engine/motion.ts`, with both clocks; the first three are also tokens in `tokens.css` (`06-ui-art.md` §5). A unit test reads both files and fails if they differ.
- **Reduced motion** (`set.ui.motion`) makes slides and fades instant and camera transitions a 150 ms fade (catalogue A4, C5). The world's own motion is unchanged.

---

## 4. The camera

### 4.1 Already fixed

The camera is an instrument: the ground under your hand stays under it, it answers at once and settles fast, and it never moves on its own. The catalogue fixes how:
- **C1:** zoom toward the cursor with the ground point held under it; `d` eased with a 90 ms time constant; key panning that ramps up in 120 ms and down in 80 ms, at a speed that crosses the screen at the same rate at any zoom; a grab that holds the ground exactly, with no drift after release; a tilt that follows the zoom; a 45° snap in 180 ms; north-up in 250 ms; a focus that rides the ground (a 300 ms time constant) and a camera that stays 6 m above it.
- **C3:** a short jump glides in 250 ms; a long one cuts with a 120 ms fade.
- **C4:** Overhead follows the unit with a 100 ms time constant, looks ahead while aiming (following the aim point with a 100 ms time constant), and opens the cut under cover.
- **C5:** into and out of Possess in 400 ms.

### 4.2 Added

- **Every timed camera move uses `ease-camera`:** the 45° snap, north-up, glides, Tab's transitions and the steeper tilt under cover. Nothing in the camera eases in: it starts moving the moment you ask.
- **The game never takes the camera.** No cutscenes, no forced pans, no zoom on events. The only moves the player didn't ask for are C5's when a played unit falls, the cut's (C2, C4), and the tilts that clear terrain (C1) and steepen under cover (C4).

### 4.3 What the picture never does

**Fixed:** no screen shake, motion blur, depth of field or tilt-shift, chromatic aberration, lens flare, film grain, vignette, lens distortion, full-screen flash, or eye adaptation (exposure that changes by itself). From above, what is on screen is information (`16-sight.md`), and each of these hides some, costs frames or makes people unwell.

The colour of the picture changes only with the region's air (`04-terrain.md` §13.4), the time of day, the weather (§5.4), presence (`16-sight.md` §11), the darkening of unseen land (`16-sight.md` §5.3), an overlay (`06-ui-art.md` §4), the dimming behind a modal or a blocking screen (catalogue A3), and Sanctuary's light (§8.5).

---

## 5. Rendering

### 5.1 The base

The terrain's rendering is `04-terrain.md` §13: soft per-vertex ambient occlusion, soft-edged sun shadows with long shadows at golden hour, strong fog and aerial perspective for scale, emissive blocks with bloom, ACES tone mapping. Added:

- **Exposure is fixed** for each time of day. The underground reads by its region's ambience and, under the cut, by the survey light (C2).
- **Only light sources bloom:** emissive blocks, flames, magic and lamps. The threshold sits above anything lit by the sun, and the interface never blooms.
- **No screen-space ambient occlusion and no outline shader:** the voxels' own occlusion and the sun's shadows do that work, and both effects shimmer on block edges.
- **Night is blue, not black.** Under open sky at night the land is drawn at about 30% of its noon brightness, cooled toward moonlight blue, so its shape still reads from above. Lamps and fires make warm pools in the lamp-gold of the palette. This is the picture only: sight still uses the light levels of `16-sight.md` §3.2.
- **Dawn and dusk** (5 minutes each, `05-systems.md` §1) are warm, with the low sun and long shadows.
- **Units, items and buildings** are lit as the terrain is: by the sky and block light where they stand, with the same fog, and in the near shadow cascade.
- **Contact shadows.** Every person, creature and dropped item has a soft dark disc under it, about its own width, 35% dark, fading as it rises (gone at 4 m), so it stands on the ground when seen from above. Beyond the shadow cascades it is their only shadow.

### 5.2 Sky and clouds

- The sky is `04-terrain.md` §13.4.
- **Clouds are sky and shade, never in the way.** They are painted into the sky dome, where a low view sees them toward the horizon, and they cast **cloud shadows**: soft patches 100–600 m across that drift with the wind and take up to 10% off the sun's light (never the ambient), so they never read as the darkening of unseen land. No cloud ever stands between the camera and the ground.
- How much of the sky is cloud follows the region (§5.6) and closes in when it rains or snows. None are drawn underground or under the cut (the Hollow Sky's clouds are terrain, `04-terrain.md` §12).

### 5.3 Wind

- **One wind** moves everything that sways or drifts: plants, leaves, cloth, smoke, dust, falling weather and cloud shadows.
- Each region has a usual direction and strength (§5.6), blended across borders as the region's air is (`04-terrain.md` §13.4) and turning slowly through the in-game day. Gusts are bands of stronger wind that travel across the land every 10–30 s.
- Presence bends it nearby (`16-sight.md` §11.2): Dread draws it toward its source, Calm and Silence still it, a Storm whips it.
- **Fixed:** the drawn wind changes nothing in the simulation: not an arrow, a person or a fire. Where a region's hazard is wind (the Sundered Isles' gales, `02-world.md`), the hazard's strength sets the drawn wind's.
- **Plants** bend from the base in the vertex shader: grass, crops, reeds and flowers up to 0.12 m at the tip in a strong wind; leaves flutter up to 0.04 m; a giant tree's crown moves slowly, as one. Only full-detail terrain (LOD0) moves.
- **Cloth** (banners, flags, awnings, the king's cloak) waves with the wind and with the movement of whatever wears it.

### 5.4 Weather

Weather comes from the world (`05-systems.md` §16) and changes sight (`16-sight.md` §3.2). It looks like this:
- **Falling weather** (rain, sleet, snow, falling ash, spores) is particles in a box around the camera's focus, 48 m across up close and growing with `d` up to 400 m. Up close every drop and flake shows. Above `d` = 400 m it turns into streaks of shade and a tint, because a flake would be smaller than a pixel.
- **It never falls under a roof:** a particle stops at the highest block in its column (the sky-light heightmap, `04-terrain.md` §13.3).
- **Wet:** in rain, faces open to the sky gain gloss over one real minute and dry over five. **Snow** whitens faces open to the sky while it falls and fades after. Both are only drawn: no blocks are added.
- **Fog, mist, smoke and whiteout** thicken the region's fog where they stand.
- **Lightning** from the weather lights the clouds and the ground within 64 m of its bolt for 100 ms, at most once in 2 s. Bolts from skills and presence draw only their fork, and at most three a second bloom (§10).

### 5.5 Water, flame and glow

- Water, lava, liquid mana and ichor are `04-terrain.md` §13.7. Added: a thin line of foam where water meets a block, and rings where something enters it.
- **Flame** (torches, fires, burning blocks and creatures) is animated flame, as Minecraft draws it, with embers that rise and drift on the wind. A big fire sends up a smoke column as high as 30 m. The light a flame casts (block light) stays steady; only the flame and its glow flicker.
- **Slow glow:** glowcaps and crystals breathe (±10% over 4–7 s, out of step with each other), lava's crust glows in its cracks, and the Wellspring swells and fades over 10 s (±15%).

### 5.6 Each region's air

Each region has its own motes, wind and clouds. The motes are drawn as falling weather is (§5.4). **Fixed:** motes are only drawn and never change sight; sight changes only with the weather and the standing air of `16-sight.md` §3.2.

| Region | In the air | Wind | Cloud |
|---|---|---|---|
| Hearthlands | pollen and seed fluff on summer afternoons | light and steady | 35% |
| Shirogane | snow blowing low along the ground | strong | 50% |
| Kurogane | snow streaming off the highest ridges | strong on the heights | 45% |
| Kogane | sand drifting off dune crests | hot gusts | 10% |
| Boneyard | grey dust | low and fitful | 60% |
| Selva | motes in the light shafts; fireflies at night | still | 40% |
| Sallows | mist motes; fireflies and marsh lights at night | still | 70% |
| Grey Mere | spray along the shore | toward the land | 70% |
| Tasogare | glowcap spores rising | none | none: its dusk |
| Ibara | drifting ash and rising embers | hot and gusty | none: its smoke |
| Hoshikuzu | mana sparks along the crystals | storm gusts | 60%, in storm bands |
| Sundered Isles | nothing falls | the strongest anywhere, set by its gales | 30% |
| Blackwater | mist lying on the water | still | 60% |
| Nadir | cinders drifting toward the vortex | toward the centre | none: its vortex |
| underground | dust in the light of lamps and region lights | none | none |

### 5.7 Shaders

| Shader | Look | Specified in | From |
|---|---|---|---|
| terrain | texture array, tints, gloss, emissive, vertex AO, shadows, fog | `04-terrain.md` §10.5, §13.1–§13.3 | 1.1 |
| sky, fog, aerial perspective | per-region air; the haze of distance | `04-terrain.md` §13.4, §13.7 | 1.1, 1.4 |
| water, lava, mana, ichor | | `04-terrain.md` §13.7 | 1.2, 1.3 |
| the cut and the survey light | a matte dark face; a flat display light | catalogue C2 | 1.1, 1.8 |
| silhouette | the played unit through what hides it | catalogue C4 | 1.1 |
| plants and cloth in the wind | §5.3 | this doc | 1.10 |
| cloud shadows | §5.2 | this doc | 1.10 |
| weather and the regions' air | §5.4, §5.6 | this doc | 1.10, M2 |
| people and creatures | lit as terrain; the red hurt flash; conditions (§8.4); contact shadows | this doc, `13-units-classes-power.md` §3.2 | 1.1, M2 |
| marks | flat and unlit, drawn after post-processing (§9.3) | catalogue D2, D6 | M2 |
| sight | unseen land a fifth darker; the underground's knowledge | `16-sight.md` §9.4 | M2 |
| presence | a colour grade, wind and weather by distance | `16-sight.md` §11.5 | M4 |
| post | bloom, ACES, optional FXAA | `04-terrain.md` §13.7 | 1.1 |

- **Nothing compiles mid-play.** Every material and each of its variants is compiled behind the loading bar, so an effect seen for the first time never stalls a frame.
- Shaders take fixed sets of values (as presence does, `16-sight.md` §11.5), so nothing coming or going forces a recompile.

---

## 6. Movement on screen

How a unit moves is Minecraft's (**fixed**; `13-units-classes-power.md` §3.2, `07-architecture.md` §6). This section is only how that movement is drawn.

- **Smooth at any frame rate.** The simulation steps at 20 Hz. In the browser's own simulation (Milestones 1–4) the worker posts every step of the units near the camera, and they are drawn between their last two steps, at most 50 ms behind, as Minecraft draws between ticks. On a server (Milestone 5 on) other units are drawn between 10 Hz snapshots, about 100 ms behind, and the played unit is predicted (`07-architecture.md` §9).
- **Facing** is `13-units-classes-power.md` §3.4: the head leads toward the aim point, the body follows where it walks. The head turns smoothly, never in one jump, at up to 360° a second (`16-sight.md` §3.1).
- **Steps:** a 0.6 m step up is drawn over 100 ms instead of in one frame. The collision box moves at once; only the drawing eases.
- **Landings:** a fall of 1.5 m or more raises a puff of dust in the colour of the block landed on; a fall that hurts, a bigger one.
- **Footsteps:** on sand, gravel, dirt, snow and ash, each step kicks up one to three grains in the ground's colour; in water, ripples. On stone and wood, only sound (Milestone 8).
- **Poses** (`13-units-classes-power.md` §3.2): sprinting leans forward 10° with a longer swing; sneaking crouches and shortens it. Swimming lies flat with a wake; climbing reaches with alternate arms; a rider sits and rocks with the mount's gait; the free camera's flight trails its legs.
- **Detail by size on screen:** a unit drawn more than 24 px tall animates fully; a smaller one at 10 Hz; above `d` = 400 m units are markers (C1). People and creatures are drawn instanced, one draw call for each body part and material, so a crowd costs a few draw calls.

---

## 7. Animation

### 7.1 People

- **The rig is the Minecraft avatar** (`13-units-classes-power.md` §3.2): head, body, two arms, two legs, as rigid boxes. No bending joints, no squash or stretch. Its movements are Minecraft's: limbs swing with the distance walked, the arm swings to hit, dig, place and use (6 ticks), a shield rises, a bow draws, the body flashes red when hurt (§8.3).
- **Work** is the same arm swing with the tool in hand (pick, axe, hoe, hammer, saw, shovel), a kneel to plant and harvest, a stir to cook, a two-handed carry (a block on the shoulder), and still poses for writing, reading and prayer.
- **Idle:** the arms sway with breath over 3 s. **The head moves only as sight says** (`16-sight.md` §3.1, its look-around while idle): where a head points is what it sees, so it never turns for show.
- **Skills:** a pose that holds for the wind-up (`13-units-classes-power.md` §11.5), then the action in 150–250 ms.
- **Downed:** lying on the side (`13-units-classes-power.md` §5.9). **Death:** a person falls over sideways in 0.5 s and lies where it fell until it is burned: the unburned dead hurt morale, and in some regions they rise (`05-systems.md` §5). Past 64 bodies within 128 m, the oldest are drawn as one heap. Bodies are drawn only near cameras; the tally counts each settlement's unburned dead (`17-simulation-and-bots.md` §2). What the dead carried drops as `13-units-classes-power.md` §5.9 says.
- **The king** wears a crown and a cloak (cloth, §5.3). **The Steward's** lantern sways and casts real light. **A Calamity** burns (§8.5).

### 7.2 Beasts, creatures, Wardens and generals

- The same kind of rig: rigid parts generated in code, moved by gait and action.
- Size brings weight: big creatures start slowly, and every heavy hit or wave they make shows its telegraph (§8.2).
- Beasts fall over when they die, as people do, and fade after 2 s; creatures of the Deep crumble to ash in 1 s. Their drops stay.
- Wardens have rigs of their own (still rigid parts) and their presence (`16-sight.md` §11).

### 7.3 The built world

- **A placed block** grows from 85% to full size in 100 ms (`ease-out`). It is drawn as one cube of its own until its chunk has remeshed, which also hides the remesh.
- **A breaking block** shows Minecraft's ten crack stages (`hud.cracks`). When it breaks, the terrain shader hides it at once (a short list of broken blocks, cleared when the chunk has remeshed), and 12–16 small cubes in its colours burst out, fall and settle within about a second.
- **Blueprints** (`mark.ghost`): steel-tinted, 35% opaque and unlit. Each block turns solid as a builder places it, so a building rises block by block.
- **Doors, gates and trapdoors** turn or slide in 150 ms (`ease-move`). Their collision changes at once, as in Minecraft.
- **Machines** (Milestone 6): wheels and gears turn at their real speed; a conveyor's belt moves at the speed of its items. A lift's slowing at each floor is its own motion in the simulation, so riders move with it.
- **Crops** grow in visible stages, with no in-between. **A tree brought down whole** (`skill.woodcutter.active`): its logs land at once, as the row says, and the trunk is drawn toppling onto them over 0.8 s.
- **Damage:** a building under half integrity shows cracks across its blocks; a burning one smokes and sheds embers.

---

## 8. Effects

### 8.1 The language

- **Whose it is comes first,** in the marks' colours (catalogue D2): yours and your allies' in `--steel`, a foe's in `--danger`, the world's own (a rockfall, an eruption, a rogue Calamity) in `--warn`.
- **The element comes second.** An effect's body takes its element's colour; where it marks the ground, its edge takes its owner's colour, so a foe's frost never reads as yours.

| Element | Colour | Shapes |
|---|---|---|
| Fire | ember orange `#ff6a2a` | tongues of flame, embers |
| Cold | ice blue `#9cc8e0` | frost crystals; a white rime on what it hits |
| Storm | white-violet `#d9dcff` | forks of light; a crackle along metal |
| Rot | sick green `#9fb04a` | drifting motes; a stain that spreads and fades |
| Mana | cyan `#5fe0dc` | clean lines and rings |
| no element | white | streaks, dust and sparks |

- **Few and short.** A burst lasts 0.2–1 s (a Cataclysm's longer, §8.5). An effect that lingers (a burning patch, a ward, an aura) covers exactly the ground it affects, with a clear edge.

### 8.2 Telegraphs

- Every area blow a foe winds up (a Warden's heavy hit or wave, a general's slam, a big creature's charge) shows on the ground as a **danger zone** (`mark.telegraph`). It is fixed where the blow was aimed when the wind-up began: a heavy hit marks a 2 m circle round where its target stood, a wave its own shape (`13-units-classes-power.md` §16). Stepping out in time dodges it.
- It is outlined in `--danger` (`--warn` for a rogue Calamity's or the world's own), with a 1 px `--ink-0` line inside so it shows on lava, and fills from the centre outward over the wind-up, so it is full the moment the blow lands.
- It shows only while one of your people sees the attacker (`16-sight.md` §5).
- Your own skills show their shape while you aim them (`hud.aim`).

### 8.3 Hits

- **A hit:** the target flashes red (0.5 s, Minecraft's), is knocked back as physics says, and throws a few particles by what was struck: sparks off mail and plate, splinters off wood and shields, chips off stone and bone, a few dark red flecks off flesh and hide. Never gore, and never pools.
- **The flash** runs its 0.5 s and starts again only after it ends, and anything wider than a tenth of the screen flashes at half strength, so a Warden under two hundred blades never strobes.
- **Tells:** an AI unit's or creature's melee blow draws back over the last 0.25 s before it lands, so a parry can be timed by eye (`13-units-classes-power.md` §5.5); a finishing blow holds the weapon high for its 1.5 s (§5.9 there).
- **A falling strike** (`13-units-classes-power.md` §5.3) throws a burst of white sparks, as Minecraft's critical hit does. **A parry** (§5.5 there) rings with one bright steel flash at the blades. A hit on a raised shield raises sparks.
- **Wide swings** (`skill.warrior.active` and weapons with Sweep) leave a white arc for 150 ms, as wide as what they hit.
- **Arrows and bolts** leave a faint streak in flight and stay stuck where they land for 30 s.
- **No floating damage numbers.** The flash, the knockback and the health bars (`mark.health`, `hud.health`) say it, and the screen stays clear.

### 8.4 Conditions on the body

Only conditions that change how to fight show on the body. The rest show in the inspector and the HUD.

| Condition | On the body |
|---|---|
| Burning | flames over it, as Minecraft draws them |
| Chilled · Frozen | frost along its edges · locked in ice |
| Poisoned | green motes rising |
| Bleeding | dark drops falling |
| Stunned · Staggered | the head reels · a stumble |
| Rooted | roots or ice round its feet, by the cause |
| Shielded | a thin steel shell |
| Fortified | a steel glint along its edges |
| Hidden | your own, drawn at half strength; a hidden foe, only while one of your people sees it (`16-sight.md` §4) |
| Downed | lying on the side (§7.1) |
| Guttering | a Calamity's fire shrinks and sputters |

### 8.5 Great powers

- **A Calamity burns** in its nature's colour: a Sellsword gold, an Idol white and gold, a crowned Wildfire red, a relic-bound one its relic's (the Ichor Heart dark red, the Ashen Veil grey ash, the War-Smith's Hammer sparks and soot), a Bastion steel-white, the Oathsworn white-hot. A ring of that fire on the ground around it shows how full its Flame is (`13-units-classes-power.md` §15.2): 4 m across when full, 1 m near the end, because height reads poorly from above.
- **Cataclysms** are the biggest effects in the game, and the camera still doesn't move (§4.3). Terrain a Cataclysm removes is gone at once, in a burst of debris (cubes in its colours, thrown up to 20 m, gone within 3 s) and a dust cloud that drifts downwind for 10 s. Severance draws one thin white line along its cut, in silence, and the cut opens (`14-class-library.md` §3.5). Sanctuary fills its domain with a still, white-gold light for its minute.
- **A Warden's death:** its presence drains over 10 s, and its region's sky clears over the next in-game hour (`16-sight.md` §11.3).

### 8.6 Limits

- Particles are pooled GPU instances, one draw call for each kind, with at most 8,000 alive at once.
- **Near the camera:** particles and smoke fade out within 8 m of the camera, are drawn at 30% where they stand between the camera and the played unit, and are never drawn above the cut.
- **When frames run long** (over 20 ms for 10 frames in a row), decoration thins first (dust, embers, the regions' air, weather) and then the rest. Telegraphs, hits on your people and marks never thin.
- **Fixed:** effects only read the simulation. They never change it, and a machine drawing the fewest effects plays exactly the same game. Nothing here touches world generation or its golden hashes.

---

## 9. The interface

### 9.1 Style

An instrument, not an ornament. Dark, nearly opaque, flat panels with a hairline; Inter for everything, Cormorant SC only for the great moments; steel for what you can act on, gold for wealth, red for danger; monoline icons; nothing glows, and nothing imitates parchment, wood or stone, because the world is where the fantasy lives (`06-ui-art.md` §1, §5; catalogue A3). The interface leaves at least 85% of the screen to the world.

### 9.2 Motion

The complete list of the interface's animations is in catalogue A4 ("Motion"), with the curves of §3.1. In short: drawers and the inspector slide 16 px in from their edge as they fade in; tooltips, lists and notes fade; toasts rise 4 px as they fade in; the Tabs underline glides; a Bar eases to its new value, and Health or Flame that is lost lingers for a moment before it drains; numbers change at once and never count up or down.

### 9.3 Marks in the world

- Marks (catalogue D2 and D6), outlines and the silhouette are drawn after post-processing: unlit, without fog, tone mapping, grading or the sight darkening, and tested against the depth of the near pass. So their colours on screen are the tokens' own.
- They are flat, with lines 1–2 px wide and fills of 20% at most (blueprints, which stand for blocks, 35%), so they never look like part of the world.
- Where something hides a mark (a hill, a wall), the hidden part is drawn at 30%. `mark.reveal` and `mark.telegraph` show in full, since showing through is their point, and so does the silhouette (C4).
- A selection ring settles from 115% of its size in 150 ms. An order shows where it landed with a ring that shrinks to the point and fades in 300 ms (`mark.ping`).

---

## 10. Comfort

- **Reduced motion** (§3.3), presence turned down (`16-sight.md` §11.4), and the interface's size (`06-ui-art.md` §7).
- **No flashing:** nothing on screen flashes more than three times a second, and nothing flashes the whole screen. Lightning lights only what is near its bolt, at most once in 2 s (§5.4); a hurt flash can't restart until it ends (§8.3).
- Colour is never the only signal (`06-ui-art.md` §7): a danger zone has its shape and its fill, a condition its shape on the body.

## 11. Postcards

Postcards judge the terrain (`04-terrain.md` §14), so postcard mode uses clear weather and no presence, draws no particles, no cloud shadows and no marks, and sets the display clock to a fixed time, so wind, water and flame stand still. A region's standing air (its fog and haze, `04-terrain.md` §13.4) stays. A postcard shot twice is the same image.

## 12. Checking motion

- A still image can't show motion. For anything that moves, make a **motion strip**: frames at set times laid side by side in one image (a drawer at 0, 50, 100, 150 and 200 ms; a wind-up from start to blow), and open it before describing it (`AGENTS.md`, golden rule 3).
- **The tools:** `npm run ui:shots -- --strip <state>` writes a strip of an interface animation: it pauses the page's animations (`document.getAnimations()`) and steps them through their times. For the world, the postcard tool renders frames at set display-clock times (§3.3).
- **Tests:** the curves in `motion.ts` match the tokens; following ends at the same view at 30 and 144 frames a second (C7); a run with effects at their fewest gives the same simulation as one with all of them.

## 13. What ships when

| Phase | Look and feel |
|---|---|
| 1.1 | the curves, both clocks and `motion.ts`; drawing between physics steps; the step-up ease; the avatar's Minecraft animations for the free camera (walk, sprint, sneak, jump and fall, swim, fly, the arm's swing); a placed block's pop and a broken block's particles; fixed exposure, bloom only on light sources, night that reads from above |
| 1.3 | flame, embers and glow, with the emissive blocks and lava |
| 1.4 | clouds in the sky dome |
| 1.10 | plants and cloth in the wind; cloud shadows; each region's air (§5.6); foam lines; motion strips of the interface (§12) |
| M2 | people's animations (work, carry, idle, Downed, death, bodies); skill poses and wind-ups; beasts; contact shadows; the marks' motion and `mark.ping`; blueprints rising block by block; footsteps and landings; weather with the calendar; the king's cloak and the Steward's lantern |
| M3 | doors and gates; carts and their animals |
| M4 | hits, tells, danger zones, conditions on the body, skill effects by element, arrows; creatures of the Deep, generals and Wardens; damaged and burning buildings |
| M6 | machines, conveyors and lifts; mana's effects |
| M7 | the Calamities' fire, the Cataclysms' effects and Sanctuary |
| M8 | a sound for every effect (`06-ui-art.md` §10); a final art pass |
