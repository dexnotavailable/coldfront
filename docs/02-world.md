# 02 · The world of Kaldmark

Kaldmark is a vast basin ringed by ice. The land drains inward, toward a black ring-sea around the Nadir, the demon king's continent. Beneath the basin the rock opens into layers that narrow like a funnel toward the Pit, about 1.5 km below sea level.

- Top view: `diagrams/world-layout.svg`
- Side view: `diagrams/funnel.svg`
- Terrain generation for all of this: `04-terrain.md`
- History and names: `03-lore.md`

All distances are metres unless marked. All positions are relative to the world centre (0, 0). **Bearing** is a compass angle, clockwise from north (−z).

---

## 1. Frame (canonical constants)

These numbers are the single source of truth. Code keeps them in one constants module (`packages/shared/src/world/constants.ts`).

| Constant | Value |
|---|---|
| Block size | 1 m |
| Chunk | 32 × 32 × 32 blocks |
| World bounds (x, z) | −22,528 … +22,527 (1,408 chunks across) |
| World bounds (y) | −1,536 … +1,023 |
| Sea level | y = 0 |
| Worldstone (unbreakable technical floor) | y < −1,504 |

### Rings (unwarped radii; the generator warps every boundary by ±300–500 m)

| Ring | Radius | Contents |
|---|---|---|
| The Nadir | 0 – 5.0 km | Demon king's continent: a high plateau with Nadir Keep at the centre |
| The Blackwater | 5.0 – 6.2 km | A cold ring-sea, 150–250 m deep, crossed by three broken land bridges |
| Inner ring | 6.2 – 12.9 km | 4 fantasy regions, ≈100 km² each |
| Outer ring | 12.9 – 20.5 km | 8 grounded regions, ≈100 km² each; kings start here |
| The Rim | 20.5 – 21.5 km | Ice shelf and cliffs rising to ~+600 m |
| The Frost | > 21.5 km | Lethal whiteout. Terrain continues (ice) to the square bounds, but nothing lives there |

### Depth bands

| Band | y range | Funnel footprint (radius) | Regions |
|---|---|---|---|
| Crust | surface → −48 | everywhere | local caves, common ores |
| **Layer 1 · the Upper Deep** | −48 → −368 | 6.5 – 16.5 km (inside 6.5 km is Nadir rock under the Blackwater and the Nadir, around the Stair) | 8 |
| Shelf | −368 → −400 | — | hard band, few openings |
| **Layer 2 · the Undercrown** | −400 → −720 | 3.5 – 11.5 km | 5 |
| Shelf | −720 → −752 | — | |
| **Layer 3 · the Maw** | −752 → −1,072 | 2.0 – 7.0 km | 3 |
| Shelf | −1,072 → −1,104 | — | |
| **Naraku · the Pit** | −1,104 → −1,504 | 0 – 2.2 km | 1 (the Throne) |

Outside a layer's footprint is **deeprock**: very hard, dark rock with sparse natural caves and poor ore. You *can* dig through it; it's slow and yields little. The funnel footprints fray at the edges: caves thin out over ~500 m instead of stopping at a wall.

---

## 2. The surface

Outer-ring regions each span ~45° of bearing; inner-ring regions span ~90°. Every boundary is warped, and neighbouring regions blend over 150–800 m depending on the pair (see `04-terrain.md` §5.2).

| Bearing | Outer ring (Tier I) | Inner ring (Tier II) |
|---|---|---|
| 0° N | **Shirogane** (tundra) | |
| 45° NE | **Kurogane** (mountains) | **Hoshikuzu** (shardfields; centred 45°) |
| 90° E | **Kogane** (desert) | |
| 135° SE | **The Boneyard** | **Ibara** (hellscape; centred 135°) |
| 180° S | **The Selva** (jungle) | |
| 225° SW | **The Sallows** (swamp) | **The Sundered Isles** (centred 225°) |
| 270° W | **The Grey Mere** (great lake) | |
| 315° NW | **The Hearthlands** (plains) | **Tasogare** (twilight; centred 315°) |

Why this order: cold north, dry east, wet south-west. Kurogane casts a rain shadow over Kogane. The Selva, Sallows and Grey Mere form a wet belt. The Hearthlands sit between the lake and the tundra. Each fantasy region sits inward of the grounded regions it bleeds into.

### Names and IDs

Every region and layer has a **stable ID** used in code, file names, commands and saved data, and a **display name** used in the game and in prose. Display names can change freely (it's a data edit); IDs never change. Names come from Kaldmark's three tongues (`03-lore.md` §12): Court speech (Japanese-styled), Rim speech (Northern European) and Scholars' Latin, plus a few borrowed words.

| ID | Display name | Tongue | Meaning |
|---|---|---|---|
| `plains` | the Hearthlands | Rim | the hearth-lands; the basin's breadbasket |
| `tundra` | Shirogane | Court | 白銀, "silver-white": snowfields over the silver lodes |
| `mountains` | Kurogane | Court | 黒鉄, "black iron" |
| `desert` | Kogane | Court | 黄金, "gold". With Shirogane and Kurogane, the Old Crown's three metal provinces |
| `boneyard` | the Boneyard | Rim | the titans' graveyard |
| `jungle` | the Selva | borrowed (Romance) | "the wild forest" |
| `swamp` | the Sallows | Rim | willow-fens |
| `lake` | the Grey Mere | Rim | the grey lake |
| `twilight` | Tasogare | Court | 黄昏, "twilight" |
| `hellscape` | Ibara | Court | 茨, "briar, thorn" |
| `shardfields` | Hoshikuzu | Court | 星屑, "stardust": the crystal fields glitter like fallen stars |
| `isles` | the Sundered Isles | Rim | the land that tore free |
| `nadir` | the Nadir | Scholars' | "the lowest point": the old astronomers' word, now the name of the demon king's land |
| `blackwater` | the Blackwater | Rim | the ring-sea, once the Mirror |
| `rim` | the Rim | Rim | the ice wall |
| `frost_hollows`, `old_workings`, `crystal_grottos`, `ember_veins`, `bone_pits`, `root_halls`, `sporewood`, `drowned_caverns` | the Frost Hollows, the Old Workings, the Kagami Grottos (鏡, "mirror"), the Ember Veins, the Bone Pits, the Root Halls, the Sporewood, the Drowned Caverns | mixed | Layer 1 |
| `stone_garden`, `buried_city`, `leyflow`, `great_shear`, `hollow_sky` | Sekitei (石庭, "stone garden"), the Buried City (Undervault), the Leyflow, the Great Shear, the Hollow Sky | mixed | Layer 2 |
| `gut`, `ash_sea`, `deep_forges` | the Gut, Yomi (黄泉, the land of the dead; "the Ash Sea"), the Deep Forges | mixed | Layer 3 |
| `throne` | the Throne | Rim | the Pit's one region |
| layers: `crust`, `upper_deep`, `undercrown`, `maw`, `pit` | the Crust, the Upper Deep, the Undercrown, the Maw, Naraku (奈落, "the abyss"; "the Pit" in common speech) | mixed | depth bands |
| `surface` | the ground surface | — | the top-down view tools use (`--layer surface`); not a depth band |

Postcard IDs are short capitalised forms of the region ID (`HELL-1` for `hellscape`, `MTN-2` for `mountains`, `TWILIGHT-1` for `twilight`), listed with each recipe in `04-terrain.md` §11–§12.

### Region sheets

"Monopoly" means the resource exists in that region only (on the surface, or in the whole world if marked "world").

#### Outer ring · Tier I

**The Hearthlands (plains).** Rolling grassland, river valleys, groves, chalk bluffs, lone hills with ruins. The friendliest land in Kaldmark, and the most fought over.
- Hazards: roaming raider bands, grass fires in late summer.
- Resources: grain, horses (your first messengers), clay, timber, fieldstone.
- Enemies: raiders of the Burnt Standard, wolves.
- Warden: **Marshal Varn, the Burnt Standard**.

**Shirogane (tundra).** Wide frozen plains, frost-heave domes, ice sheets, frozen lakes, crevasse fields, wind-carved drifts, and ice spires near the Rim.
- Hazards: cold that kills without heat and fuel; frozen ground (slow digging, no farming).
- Resources: **silver (monopoly)**, furs, year-round ice.
- Enemies: frost wolves, ice-hulks.
- Warden: **Shimotsuki, the Hoarfather**.

**Kurogane (mountains).** Knife ridges, cirques and tarns, glaciers, cliffs with overhangs, scree, pine forests below the treeline, peaks to +800–900 m.
- Hazards: avalanches, rockfalls, sheer climbs, thin cold air at the peaks.
- Resources: rich iron, coal, quality stone (granite, slate, marble).
- Enemies: stone-bound (animated rock), crag-drakes.
- Warden: **Iwakura, the Mountain That Walks**.

**Kogane (desert).** Dune seas, terraced mesas and buttes in red and gold bands, hoodoos, salt flats, dry canyons with gold showing in the walls.
- Hazards: heat, no water, sandstorms that bury buildings.
- Resources: **gold (monopoly)**, glass sand, salt (flats).
- Enemies: sand-wraiths, dune-stalkers, tomb guards.
- Warden: **Satrap Ozrem, the Gilded**.

**The Boneyard.** A grey plain of colossal skeletons: ribcages like cathedral arches, half-buried skulls, spines running for hundreds of metres, giant rusted blades.
- Hazards: the dead stir after dark.
- Resources: **titan bone (monopoly)**, huge light beams for siege engines and great halls; bone meal.
- Enemies: the risen, bone-hounds.
- Warden: **the Gravewarden**.

**The Selva (jungle).** Steep karst towers draped in green, deep gorges, giant trees with buttress roots, cenotes, waterfalls and big muddy rivers.
- Hazards: disease, predators, vines that reclaim anything unmaintained.
- Resources: ironwood (the best timber), medicinal herbs, fruit.
- Enemies: stalking predators, vine-horrors.
- Warden: **Vhessa, the Green Throat**.

**The Sallows (swamp).** Flat wetland at sea level: channels, peat bogs, root-arched trees, hummocks, sunken ruins, thick fog, bog-holes.
- Hazards: rot, disease, ground that swallows foundations (build on pilings).
- Resources: peat (fuel), bog iron, fen reagents (alchemy).
- Enemies: bog-dead (drowned pilgrims), leeches, fen hounds.
- Warden: **the Drowned Abbot**.

**The Grey Mere (great lake).** A lake so wide the far shore is haze: rocky forested islands, sea stacks, shingle beaches, reed shallows, a drowned forest, trenches plunging toward the Drowned Caverns.
- Hazards: storms, deep-water creatures; everything needs boats or bridges.
- Resources: salt (preserves food on long supply lines), fish, reeds.
- Enemies: mere-serpents, the drowned.
- Warden: **the Leviathan of the Mere**.

#### Inner ring · Tier II

**Tasogare (twilight).** Endless dusk under a sky with a dark wound in it. Indigo moss, black-glass lakes, leaning monoliths, stone curtains, pale glowing fungi, faintly shining moonsilver veins.
- Hazards: endless dusk; shadow creatures that only fear light. Unlit buildings get attacked.
- Resources: **moonsilver (world monopoly)**, which carries mana (relays and conduits need it); glowcaps.
- Enemies: shades, lampless knights.
- Warden: **Akari, the Lampless Queen**.

**Ibara (hellscape).** Ash plains and cracked basalt split by lava fissures. Forests of black thorns erupt from the ground, curved, faceted and leaning, from 10 m to colossal 350 m arches. Calderas, sulphur vents and lava channels complete it.
- Hazards: heat, fumes, spikes that erupt from the ground near activity.
- Resources: **brimstone (world monopoly)**, the only fuel hot enough for top-grade steel; obsidian; basalt.
- Enemies: ash-fiends, thorn-crawlers, magma drakes.
- Warden: **Gōka, the Thorn-Crowned**.

**Hoshikuzu (the shardfields).** Dark slate plains fused to glass, with storm scars radiating from giant clusters of cyan mana crystal. Small shards hover near the big clusters.
- Hazards: mana storms that burn out unwarded people and machines.
- Resources: **raw mana crystal (surface monopoly)**, fused glass.
- Enemies: glass-beasts (crystal-touched animals), storm wisps.
- Warden: **Hibiki, the Resonant**.

**The Sundered Isles.** Land torn up and floating: islands from +150 to +900 m above **the Sundering**, a chasm field that drops ~450 m and opens into the ceiling of the Hollow Sky (Layer 2). Waterfalls pour off the islands into mist, and rock strands bridge between them.
- Hazards: gales, long falls.
- Resources: **skystone (world monopoly)**. It makes lifts possible, so going deep needs it.
- Enemies: sky corsairs, gale-hawks.
- Warden: **Admiral Kest, the Stormwright**.

#### The centre · Tier III

**The Blackwater.** A cold ring-sea around the Nadir, 5.0–6.2 km from the centre. Cliffs on both shores. Three land bridges cross it: natural rock causeways the Old Crown once paved, now broken by gaps players must bridge.

**The Nadir.** A black basalt plateau (+150 to +250 m) under a dark vortex of sky: ash-fall, petrified black forest, old roads, blackened snow. At the centre, **Nadir Keep** stands on a crag (~+320 m) above **the Nadir Stair**.
- Hazards: everything at once (cold, ash, darkness), plus the Keep's garrison.
- Resources: the strongest **ley wells** in the world, black-iron salvage.
- Enemies: the black-iron legion, Hollowed knights.
- Warden: **Severin, Castellan of Nadir Keep**.

---

## 3. The underground

Layer 1 regions echo the land above them; each layer down gets stranger. Positions are given as bearing and approximate radius of the region's centre. Regions are cells in a warped Voronoi layout within the layer's footprint (see `04-terrain.md` §5.5).

### Layer 1 · the Upper Deep (−48 → −368) · Tier III

| Region | Centre | Beneath | What you have to beat | Signature resource |
|---|---|---|---|---|
| **Frost Hollows** | 0°, 14 km | Shirogane | killing cold, falling ice | rime ore (cold-forged steel) |
| **The Old Workings** | 45°, 14.5 km | Kurogane | gas pockets that choke or explode; rotten supports | rich coal, old-world salvage |
| **Kagami Grottos** | 75°, 9 km | Hoshikuzu | resonance that slowly drives people mad | pure mana crystal |
| **Ember Veins** | 125°, 9 km | Ibara | heat, lava breakouts | fireclay (heat-proof bricks) |
| **Bone Pits** | 145°, 14 km | Boneyard | the dead are restless at every hour | titan marrow (enchanting reagent) |
| **Root Halls** | 180°, 13.5 km | Selva | roots that shift and crush tunnels; burrowing beasts | heartroot resin (sealant for deep builds) |
| **Sporewood** | 225°, 14 km | Sallows | spores that sicken people and spoil food | edible fungi (food without sun) |
| **Drowned Caverns** | 275°, 13 km | Grey Mere | floods, blind predators (pumps or boats needed) | deep pearls (noble luxury) |

Beneath the Hearthlands, Kogane, Tasogare and the Sundered Isles, the nearest Layer 1 regions extend under them. Beneath the Nadir and the Blackwater (radius < 6.5 km), Layer 1 depth is solid Nadir rock around the Stair, so the Blackwater has a sealed floor. Where the Sundering cuts through Layer 1 (inner Sundered Isles), the chasm wall exposes Layer 1 caves.

### Layer 2 · the Undercrown (−400 → −720) · Tier IV

| Region | Centre | What you have to beat | Signature resource |
|---|---|---|---|
| **Sekitei** | 0°, 8 km | a petrified forest; stay too long without wards and you slowly turn to stone | living stone (blocks that repair themselves) |
| **The Buried City** | 50°, 7.5 km | traps and guardians of the Old Crown's deep capital, still working | deepsteel, ancient artifacts |
| **The Leyflow** | 115°, 8 km | a river of liquid mana whose surges burn out anything unwarded | liquid mana, the densest power source |
| **The Great Shear** | 170°, 8 km | a chasm along a 3–5 km fault, whose wall drops ~670 m from the Undercrown's ceiling to the Maw's floor; nesting swarms | lodestone (rails for deep lifts) |
| **The Hollow Sky** | 235°, 8 km | a cavern so vast it has clouds; long falls, flying predators, huge distances | moth silk (light, strong fibre for ropeways and wards) |

### Layer 3 · the Maw (−752 → −1,072) · Tier V

| Region | Centre | What you have to beat | Signature resource |
|---|---|---|---|
| **The Deep Forges** | 0°, 4.5 km | the King Below's war foundries: heat and endless patrols | demonsteel, the best metal in the game |
| **The Gut** | 120°, 4.5 km | living tunnels that heal and slowly digest whatever you build | ichor (master reagent for top-tier enchanting) |
| **Yomi** | 240°, 4.5 km | choking miasma, tides of the dead | soulglass (stores huge amounts of mana) |

### The Pit (−1,104 → −1,504) · Tier VI

**The Throne.** A bowl-shaped cavern ~4 km across. At its centre is the Wellspring, and the King Below on his throne. Everything here is lethal. Nothing is harvested.

### Ascent

Climbing up through a shelf hurts living things. Goods are unaffected.

| Leaving… upward | Effect without wards |
|---|---|
| Layer 1 | exhaustion (work and move slower for a day) |
| Layer 2 | sickness (days of illness; weak units can die) |
| Layer 3 | death |
| The Pit | death, even with basic wards; needs the strongest wards |

Warded lifts and wards (mage-made) remove or reduce the effect.

---

## 4. Descents (ways down)

No central hole. These are the natural routes, generated deterministically from the seed. Each listed type gets 2–4 sites (`04-terrain.md` §5.6), except the named descents in bold, which are single features (the Throats are three). Most are guarded or hazardous. Each links two regions that overlap in top view, which the region positions in §3 are chosen to guarantee.

**Surface → Layer 1**
- Cenotes in the Selva → Root Halls
- Bog-holes in the Sallows → Sporewood
- Lake trenches in the Grey Mere → Drowned Caverns (flooded)
- Old Crown mine mouths in Kurogane → Old Workings
- Crevasses in Shirogane → Frost Hollows
- Lava tubes in Ibara → Ember Veins
- Geode breaches in Hoshikuzu → Kagami Grottos
- The Pits of the Boneyard → Bone Pits
- Plus ordinary caves and ravines anywhere, which reach the Crust and sometimes Layer 1 (these aren't sited descent types)

**Layer 1 → Layer 2**
- **The Delvers' Road**: a ruined helix ramp of the Old Crown, where the Old Workings lie over the Buried City (nominally around bearing 30–45°, about 10 km out; the WorldPlan places it inside the actual overlap), spiralling down from one to the other. Infested.
- Crevasses from the Frost Hollows → Sekitei
- Crystal pipes from the Kagami Grottos → the Leyflow's source
- Magma tubes from the Ember Veins → the top of the Great Shear
- Root shafts from the Root Halls → the Great Shear's upper ledges
- The Drowned Falls: flooded shafts from the Drowned Caverns into the Hollow Sky

**Surface → Layer 2 (special)**
- **The Sundering**: in the Sundered Isles, the chasm field drops ~450 m. Where it lies over the Hollow Sky, its rifts break straight through the cavern's ceiling. Elsewhere they end in Layer 1 caves or on the shelf. It's the biggest and fastest natural descent in the world, and you need skystone lifts to use it.

**Layer 2 → Layer 3**
- **The Great Shear**: the chasm wall drops ~670 m from the Undercrown into the Maw.
- **The Leyfall**: the Leyflow pours into the Gut.
- **The Deep Lift**: the Old Crown's ruined lift shaft from the Buried City down to the Deep Forges.

**Layer 3 → the Pit**
- Three **Throats**, one from each Maw region into the Throne cavern. Each is heavily guarded.

**The Nadir Stair**
- The King Below's stronghold: a fortified shaft ~200 m wide beneath Nadir Keep. It drops from the surface through every layer to the Throne cavern's rim terrace (~−1,200), where its last gate opens onto the bowl. Levels every ~64 m, with garrisons, generals and gates. It's the direct route, and the most defended place in the world.

---

## 5. Resources

Common everywhere, in amounts that vary by region: timber, stone, clay, sand, water, iron (small veins), coal (small seams), game and fish.

| Resource | Where | Monopoly | Used for (examples) |
|---|---|---|---|
| Grain, horses | Hearthlands (best) | — | food, riders, carts |
| Silver | Shirogane | yes | Marks (coin), fittings |
| Furs, ice | Shirogane | — | cold gear, food preservation |
| Rich iron, coal, fine stone | Kurogane | — | steel, fuel, construction |
| Gold | Kogane | yes | Crowns (coin), luxury |
| Glass sand | Kogane | — | glass, lenses, lamps |
| Salt | Grey Mere, Kogane flats | — | preserving food |
| Titan bone | Boneyard | yes | siege engines, great halls |
| Ironwood, herbs | Selva | — | ships, beams, medicine |
| Peat, bog iron, reagents | Sallows | — | fuel, low-grade iron, alchemy |
| Moonsilver | Tasogare | world | conduits, relays, wards |
| Brimstone | Ibara | world | top-grade steel, forges |
| Raw mana crystal | Hoshikuzu (surface) | surface | mana fuel |
| Skystone | Sundered Isles | world | lifts |
| Ley wells | Nadir (strongest), rare elsewhere | — | fixed mana sources |
| Rime ore | Frost Hollows | world | cold-forged steel |
| Old salvage, rich coal | Old Workings | — | components, fuel |
| Pure mana crystal | Kagami Grottos | world | high-grade mana |
| Fireclay | Ember Veins | world | heat-proof brick, crucibles |
| Titan marrow | Bone Pits | world | enchanting |
| Heartroot resin | Root Halls | world | sealant for deep builds |
| Edible fungi | Sporewood | — | food without sun |
| Deep pearls | Drowned Caverns | world | noble luxury |
| Living stone | Sekitei | world | self-repairing blocks |
| Deepsteel, artifacts | Buried City | world | deep gear |
| Liquid mana | Leyflow | world | dense power |
| Lodestone | Great Shear | world | deep lift rails |
| Moth silk | Hollow Sky | world | ropeways, wards, noble cloth |
| Ichor | The Gut | world | top-tier enchanting |
| Soulglass | Yomi | world | mana storage |
| Demonsteel | Deep Forges | world | the best metal |

---

## 6. Enemies (summary)

Mechanics are in `05-systems.md` §17. Here is who lives where.

- **Tiers:** minion → soldier → veteran → general (mini-boss) → Warden. Strength rises toward each Seat and with depth.
- **Behaviour:** enemies breed at musters, roam, scout, report and march. An army that takes a settlement keeps it. Territory creeps outward slowly when unchallenged. Your activity (industry, deep mining, battles) draws attention, like pollution in Factorio.
- **Families by region:** listed in the region sheets above. Underground:
  - Sporewood: fungal thralls, sporebats
  - Root Halls: root thralls, burrowers
  - Drowned Caverns: the blind brood
  - Old Workings: mine-constructs, gas-ghouls
  - Frost Hollows: ice-crawlers
  - Ember Veins: slag-spawn, fire beetles
  - Kagami Grottos: mirror-shades, resonant wisps
  - Bone Pits: marrow-dead, bone-worms
  - Sekitei: animated statues, basilisks
  - Buried City: Old Crown constructs, trap guardians
  - Leyflow: mana elementals, current-eels
  - Great Shear: the shear swarm, cliff-stalkers
  - Hollow Sky: moths, sky-eels
  - The Gut: digesters, parasites
  - Deep Forges: demon smiths, forge-born soldiers
  - Yomi: ash-dead, miasma wraiths
  - The Throne: the Hands of the King

---

## 7. The bosses: 29 Wardens + the King Below

**Form:** C = colossus, W = warlord (commands a great army), B = both.
**Threat:** Burst = one-target devastation, so small strike forces get deleted. AOE = area devastation, so big blobs get deleted. Fortress = armoured and out of reach, so you need siege engines from range.
**Regen:** None, Slow (natural), Absorbs (fallen soldiers become its strength), Structures (fed by destroyable things on the map), Resource (fed by a terrain or resource condition you can change).

No two Wardens share the same form + threat + regen combination, so no two fights want the same army.

| # | Warden | Seat region | Tier | Form | Threat | Regen: source → counter | Generals | Signature drop (flavour) |
|---|---|---|---|---|---|---|---|---|
| 1 | Marshal Varn, the Burnt Standard | Hearthlands | I | W | Burst | Structures: raider war-camps send him tribute → burn the camps | 3 | The Burnt Standard (banner: morale and loyalty aura) |
| 2 | Shimotsuki, the Hoarfather | Shirogane | I | C | Burst | Resource: blizzard cold → fight in calm weather, heat the arena | 3 | Heart of Rime |
| 3 | Iwakura, the Mountain That Walks | Kurogane | I | C | Fortress | None: just armour and HP → grind it with siege engines | 3 | The Mountain's Core |
| 4 | Satrap Ozrem, the Gilded | Kogane | I | W | Fortress | Resource: the gold in his vault-tomb → break in and haul the hoard away (keep it) | 3 | The Gilded Seal + his hoard |
| 5 | The Gravewarden | Boneyard | I | W | AOE | Absorbs: raises your dead → small, well-armoured force; recover or burn your fallen | 3 | Grave-Iron Crown |
| 6 | Vhessa, the Green Throat | Selva | I | C | AOE | Structures: heartroot taproots around the Seat → cut them | 3 | Green Heart (a seed) |
| 7 | The Drowned Abbot | Sallows | I | W | AOE | Structures: rot-shrines → purge them | 3 | The Drowned Censer |
| 8 | The Leviathan of the Mere | Grey Mere | I | C | Fortress | Resource: deep water → causeways or dams; lure it into shallows | 3 | Leviathan Scale |
| 9 | Akari, the Lampless Queen | Tasogare | II | W | Burst | Resource: darkness → light the arena with lamp towers | 4 | The Unlit Lantern |
| 10 | Gōka, the Thorn-Crowned | Ibara | II | B | Burst | Resource: heat vents and lava → cap vents, divert lava | 4 | Thorn Crown |
| 11 | Hibiki, the Resonant | Hoshikuzu | II | C | Burst | Structures: crystal pylons → shatter them | 4 | Resonant Core |
| 12 | Admiral Kest, the Stormwright | Sundered Isles | II | W | Fortress | Slow: steady regen on a floating fortress → sustained siege via lifts and bridges | 4 | Stormwright's Compass |
| 13 | Severin, Castellan of Nadir Keep | Nadir | III | B | Fortress | Structures: the Keep's ward-engines → break them | 6 | Severin's Keys (opens the Stair's gates) |
| 14 | The Bloom | Sporewood | III | B | AOE | Structures: spore-nodes across the region → burn them | 3 | Bloom Heart |
| 15 | The Rootbound King | Root Halls | III | B | AOE | Resource: living root underfoot → burn the arena floor dead | 3 | Heartroot Crown |
| 16 | The Blind Choir | Drowned Caverns | III | W | AOE | None, but the brood breeds fast → keep the force small and disciplined | 3 | Choir Stone |
| 17 | Foreman Gall, the Last Overseer | Old Workings | III | W | Fortress | Structures: repair engines → smash them | 3 | Overseer's Ledger |
| 18 | Tsurara, the Rime Wyrm | Frost Hollows | III | C | Burst | None → cold-proof gear and numbers | 3 | Rime Fang |
| 19 | The Slagmother | Ember Veins | III | C | AOE | Slow → heat-proof gear, spread out, endure | 3 | Slag Womb |
| 20 | Utsusemi, the Mirror Warden | Kagami Grottos | III | W | Burst | Absorbs: your fallen become crystal copies → heavy armour and healers; don't die | 3 | Mirror of Returning |
| 21 | The Marrow Titan | Bone Pits | III | C | Fortress | Structures: marrow deposits → mine them out (and sell the marrow) | 3 | Titan's Marrow Cask |
| 22 | Noctua, the Moth Sovereign | Hollow Sky | IV | W | AOE | Resource: light → fight it in darkness | 4 | Sovereign's Silk |
| 23 | The Shear Matriarch | Great Shear | IV | W | Fortress | Absorbs: her swarm eats the fallen → vertical assault, burn the dead | 4 | Shear Crest |
| 24 | The Gardener | Sekitei | IV | C | Burst | Absorbs: petrified soldiers become statues that heal it → wards against stone | 4 | Gardener's Eye |
| 25 | The Undervault Regent | Buried City | IV | B | Fortress | None, but a construct legion → siege | 4 | Regent's Codex |
| 26 | The Current | Leyflow | IV | C | AOE | Resource: the flowing Leyflow → dam or divert it | 4 | The Stilled Current |
| 27 | The Maw That Feeds | The Gut | V | B | Fortress | Absorbs: digests the fallen → fight from inside, haul bodies out | 4 | Ichor Heart |
| 28 | Yomotsu, Queen of Ashes | Yomi | V | W | AOE | Slow → spread out and endure | 4 | Ashen Veil |
| 29 | Vorgrim, War-Smith of the King | Deep Forges | V | B | Burst | Structures: his forges → wreck them | 4 | The War-Smith's Hammer |
| 30 | **The King Below** (Kuon) | The Throne | VI | B | Burst + AOE + Fortress (phases) | **All:** +regen for every Warden still alive, Wellspring conduits (structures), absorbs the fallen, and a slow regen that never stops | 4 (the Hands of the King) | — (the end) |

Generals total: 106. The King Below's "regen per living Warden" is deliberate. Every Warden killed anywhere in the world weakens him, which ties the whole server's season together.

### Seats

Each Warden sits in a **Seat** at the desolate heart of its region: the most hostile terrain near the region's centre.

| Ring around the Seat | Radius | What's there |
|---|---|---|
| Outer | 1.5–2.5 km | outposts, roaming bands, musters |
| Middle | 0.8–1.5 km | forts, each held by a general, with walls and musters |
| Inner | 0.3–0.8 km | veteran garrison and strongpoints |
| Arena | 150–300 m | the Warden |

Enemy strength rises toward the centre. Killing a general shuts down or weakens his musters. Killing the Warden stops all spawning in the region.

---

## 8. Where kings start

New and re-summoned kings spawn in the outer ring at radius ≥ 16 km. The site must be:
- at least 1.5 km from any player's network coverage
- at least 3 km from any Seat
- on buildable ground (gentle slope, dry, not in a hazard hotspot)
- near water and timber

The Hearthlands, Grey Mere shores and Selva edges are the gentlest starts. Shirogane and Kogane are hard starts, and the spawn picker avoids them unless nothing else is free.

## 9. Difficulty pacing (expectation, not a lock)

| Tier | Where | When strong kingdoms typically get there |
|---|---|---|
| I | outer ring | weeks 1–6 |
| II | inner ring | weeks 4–12 |
| III | Nadir surface, Layer 1 | months 2–4 |
| IV | Layer 2 | months 3–5 |
| V | Layer 3 | months 4–6 |
| VI | the Pit | month 5+ (maybe never) |
