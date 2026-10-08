# 05 · Gameplay systems

Milestones 2–8 build these systems. Milestone 1 builds none of them, but its architecture must not block them (see `07-architecture.md`). Numbers marked *(tune)* are starting values for playtests. Everything here follows the pillars in `01-vision.md`.

---

## 1. Time and calendar

- 1 in-game **day** = 60 real minutes: 40 min of daylight (with 5-minute dawn and dusk) and 20 min of night.
- 1 in-game **year** = 1 real week = 168 days. Four times of year of 42 days (42 real hours) each: spring, summer, autumn, winter.
- **Winter:** crops don't grow. Cold hazards are ×1.5 in cold regions. Food spoils slower. Northern lakes freeze, and ice roads become possible.
- A **season** is 26 real weeks ≈ 26 in-game years. The last week (in-game year 26) is **the Frost**: winter all year, deepening toward the final freeze (`03-lore.md` §4).
- The server clock is authoritative and shared by everyone. Tasogare overrides local sunlight (permanent dusk).

---

## 2. Kings and lives

- **The king** is a unit with very high stats: about the combat power of 50 soldiers when well armed (`13-units-classes-power.md` §14). He can hold off an ambush long enough to escape, but can't beat an army or a Warden alone.
- **Command features are always open.** The king can issue orders from anywhere. Orders travel through the network (§4), so they take effect only where the network reaches, after the delivery delay.
- **Offline AI.** While the player is offline, the king:
  - stays in the best-defended place (the strongest keep)
  - keeps a bodyguard assigned
  - retreats from threats he sees or hears about
  - never starts fights

  The officials keep the kingdom running. The king can still die.
- **King death:**
  1. The life is lost.
  2. The kingdom collapses. Over the next in-game day, everyone leaves their jobs and becomes a wanderer, drifting toward whichever nearby kingdom attracts them, or forming neutral camps.
  3. Buildings become neutral (ownerless, decaying). Stockpiles and coin stay where they are, free to loot.
  4. If lives remain, the player picks a spawn site from offered candidates (outer ring, far from networks, `02-world.md` §8). They start again with 20 people, the Steward and a starting kit.
- **Lives:** 3 per account per season. Later: 1 free + up to 2 paid (~$5 each), capped at 3.
- **Out of lives** means eliminated. An eliminated player can accept an invitation from a living king to join their kingdom as **one sworn unit**. The player possesses and controls only that unit, with no command powers, and the host can dismiss them. One invitation at a time.
- **The Steward.** An NPC with his own stats and a mysterious aura. He can't be possessed or controlled, and he can't be targeted or harmed. He works through the normal job system (housekeeping and whatever useful work suits his stats) and never fights. He doesn't count toward population. When the king dies, he walks away toward the Rim.
- **The Steward is the tutorial.** At first moments (first night, first stockpile, first winter, first rival sighted, first descent) he says one short, formal line pointing to the next step, and the UI highlights the relevant control. He never explains what he *is* (`03-lore.md` §7). The full onboarding arrives in Milestone 8; basic pointers from Milestone 2.
- **Starting kit** *(tune)*:
  - people: 20 (16 adults of mixed stats, 4 children), plus the Steward
  - food for ~10 days, seed grain
  - basic tools for 12
  - a handcart, a tent-hall (temporary shelter)
  - 200 Marks

---

## 3. Two modes: Command and Possess

**Command view** (the king's view) is top-down and RTS-style:
- camera: pan, zoom from 24 m out to 6 km, turn and tilt, and a **cut** that opens the view into the underground (`11-interface-catalogue.md` Part C)
- place blueprints (templates or freeform), paint zones (farms, stockpiles, housing, forbidden)
- mark ground to be dug: pits and foundations, levelling, and mines and tunnels laid out on the cut
- draw routes
- appoint officials; set policies (wages, taxes, rations, stock targets)
- command companies and armies
- trade and diplomacy panels, the map, the Ledger
- data overlays (see `06-ui-art.md` §4)

Every screen, control and key of both modes is listed in `11-interface-catalogue.md`.

You see live information only inside your connected network coverage. Outside it is fog, with stale last-seen markers.

**Possess mode plays a unit.** The owner's rules (8 October 2026): there is no first-person view; a played unit moves, digs, builds and fights like a Minecraft player, seen from above (**Overhead**) or over its shoulder (**Shoulder**), and F5 switches between them (`13-units-classes-power.md` §3, `11-interface-catalogue.md` C4).
- Minecraft's controls (`11-interface-catalogue.md` B3–B4) and movement feel: walk, sprint, sneak, jump, swim, climb, fall damage, the same player box.
- Breaking a block takes time set by the block's hardness and the tool in hand; placing uses real items from the unit's inventory.
- Attack, use, interact and manage inventory as in Minecraft; shields block with the right mouse button. The unit's skills sit on Z, X, C, V, R and G (`13-units-classes-power.md` §3.6, §11).

The unit's own sheet applies on top (`13-units-classes-power.md` §4): a strong miner digs faster, and a clumsy clerk fights badly.

**One unit model.** Every unit, AI-driven or possessed, runs the same code path. A controller produces the same input a human produces (movement keys, look direction, and an optional action such as dig, place, use, attack, equip or craft), and one shared physics step and one shared action system consume it. AI controllers and the possessing player's controller are interchangeable: possessing a unit just swaps its controller. See `07-architecture.md` §5 (entities) and §9 (the server), and `10-prior-art.md` §3.

**Possessing an official** gives you that official's **office** (K): the Realm panel limited to their jurisdiction, so you can reassign jobs and roles there.

**Officers have a command radius.** While you possess a Captain (radius ~64 m) or a Marshal (~160 m) *(tune)*, you order that officer's company or army directly within the radius, with **no network delay**: follow me, charge that target, hold here, ride them down (the order wheel, hold B). This is the middle rung of the king → officer → soldier ladder, and it's how a human-led raid outpaces the AI. For example: take a mounted troop, chase down the messengers riding for help, then hit the settlement before its reinforcements hear.

**Why possession matters.** A possessed unit acts with *player skill*: timing, aim, precise building, scouting, chasing a messenger. AI-controlled units use simpler tactics. Skills are designed for the player's hands; the AI uses them by simple rules (`13-units-classes-power.md` §11.6). Played people learn three times as fast, and five times in their first minutes each day, so the intended habit is to keep a band of people and rotate through them (`13-units-classes-power.md` §3.8).

**Switching.** Tab toggles modes: in Command view it possesses the selected person (or the last one possessed, or the king), and a person's inspector has a Possess button. Home returns you to the king, and `,` and `.` switch along your band. While you possess someone else, the king's body is AI-controlled. Only units inside your connected coverage (§4) can be possessed.

---

## 4. The network and news

The network is your eyes, voice and reach. **It defines your territory.**

| Node | Coverage radius | Links to | Needs |
|---|---|---|---|
| The king himself | 96 m | — (always counts) | — |
| Keep or hall (the capital's keep is the root) | 160 m | overlapping coverage | staffed |
| Watchtower | 128 m (sight 160 m) | overlapping coverage | 1 watcher |
| Signal tower | 160 m | signal towers within 1.5 km, line of sight | 2 operators, fuel for fires |
| Mana relay | 256 m | relays within 4 km | moonsilver, a mage's attunement, mana |
| Rider post (stable) | 96 m | no live link; dispatches riders | horses, fodder |

*(tune)*

- **Connected coverage.** A node counts only while a chain of links connects it to your capital: overlapping coverage between neighbouring nodes, signal-tower links, or relay links. The king's own 96 m bubble always counts. Inside connected coverage you see live, command and possess.
- **Cut-off areas.** When a link breaks (a tower destroyed, captured or unstaffed, or a relay out of mana), everything beyond it **goes dark**. You're left with last-seen markers and rider reports, and you can't possess anyone there until it's reconnected.
- **Territory.** Where two kingdoms' connected coverage overlaps, the nearer node controls the building rights. **Capturing a node** means holding it with your units, unopposed, for 60 s. It then joins the captor's network (if it's connected to it), and its land flips.
- **News.** Every event that needs a reaction creates a news item at its origin: an enemy sighted, a settlement attacked, a caravan lost, a king's order.
  - Inside connected coverage, news moves along the links: instantly across overlapping local nodes, ~20 s per signal-tower hop (fog, night and storms cut range), near-instantly across relays (each message costs mana; mana storms disrupt them).
  - Between places that aren't connected (early game, frontier outposts, cut-off areas), news travels by **rider**, physically along roads (~10 m/s on roads, 6 off-road), changing horses at rider posts. A rider can be killed, and then the news is lost.
- **Reactions wait for news.** Garrisons, officials and the offline king react only when news arrives. Units react instantly to what they *see* themselves.
- **Orders travel outward** the same way: along the links inside connected coverage, and by rider to a place that is cut off. The UI shows each order in transit with an ETA (`11-interface-catalogue.md` A4).
- **Messenger raids are a core tactic:** cut a tower, run down the riders, and the defender reacts too late. You see enemy riders when they're inside your coverage.

---

## 5. People

**Identity** (always stored, for everyone): name, sex, age, birthday, household, home, workplace, class, level and grade, attributes, proficiencies, skills, traits, loyalty, needs tier, health, equipment, small inventory. Everything about classes, levels, grades and skills is in `13-units-classes-power.md`.

**Stats** (1–20; mean 10, SD ~3, except Affinity, which is skewed low: mean 6, SD ~3.3, so Affinity ≥ 15 is about 1 person in 300):

| Stat | Effect |
|---|---|
| Strength | carrying, mining, melee |
| Agility | speed, ranged, riding |
| Endurance | stamina, hazard resistance |
| Intellect | crafting, management, learning speed |
| Will | loyalty resilience, morale, fear resistance |
| Affinity | magic (≥ 15 can train as a mage) |

- **Average differences by sex** (the distributions overlap heavily): men have Strength +2 on average; women have Will +2 on average, so their loyalty holds steadier.
- **Proficiencies** (0–100, one per trade) grow with practice; attributes set their caps and Intellect the learning speed (`13-units-classes-power.md` §8 lists all 25). They were called skills in earlier drafts; "skills" now means the powers of §9.
- **Traits** (0–3 per person, minor effects): Hardy, Night-eyed, Quick learner, Greedy (pay-sensitive), Homebody (family-bound), Brave, Craven, Pious, Wanderlust, and others.
- **Age:** 1 year per real week.
  - children 0–15 (light apprentice work from 12)
  - adults 16–59
  - elders 60+ (reduced work)
  - old-age death risk rises after 60 (typical lifespan 65–80)
- **Households:** couples form among adults living in the same settlement. **Births** depend on food, housing and safety *(tune: ~1 child per couple every 2–3 years when needs are met)*.
- **Death** comes from combat, hazards, disease, starvation and age. The dead must be **burned** (hearth-faith). Unburned dead hurt morale, and in some regions they rise.
- **Wanderers** arrive from the Rim all season, at a server-wide rate tuned to the target total population. They travel inward and join the most attractive kingdom they know of.
  - Attractiveness: free housing, food, safety, wages, family ties, tier fit.
  - Awareness: they know settlements they pass or see, plus kingdoms with a high **reputation**, which reaches farther.
- **Neutral villages:** several dozen at season start (20–150 people each), in the outer and inner rings.
  - Win them over with trade, gifts or protection: loyalty toward you rises until they swear.
  - Or conquer them: they join resentful, with low starting loyalty.
- **Captives** (from surrender): recruit them (low starting loyalty, shakier if their family lives elsewhere), ransom them, or release them. Captives keep their levels and proficiencies.

---

## 6. Officials and automation

"You drive expansion; the kingdom runs itself." Officials are how.

| Official | Runs |
|---|---|
| **Reeve** | a settlement: job assignment, housing, construction priority, upkeep and repairs |
| **Quartermaster** | logistics: routes, haulers, stock targets between settlements |
| **Captain** | a company (10–50 soldiers): training, patrols, garrisons |
| **Marshal** | an army (several companies): campaigns |
| **Magister** | mages and the mana grid: attunements, relays, wards |
| **Treasurer** | the mint, payroll, taxes, moving the treasury |
| **Envoy** | trade orders and diplomacy |

- Each official has a jurisdiction and a **capacity** from Management skill and Intellect *(tune: a Reeve runs 30 + 3 × skill/10 workers at full efficiency; beyond that, efficiency drops)*.
- **The loop:**
  1. Officials turn goals into tasks. Examples: stock targets ("keep 200 bread"), blueprints, upkeep, orders.
  2. Workers take tasks by fit: skill and stat match, traits, distance.
  3. The player sets priorities and policies and never has to micromanage.
- **Job choice** uses attributes and proficiencies only. No sex-based rules. The full ladder of offices and posts, each with its office skill, is in `13-units-classes-power.md` §13.
- **Overrides:** pin a person to a job, set priorities, draw routes by hand, set stock targets, forbid areas. Possessing an official gives direct access to their panel.
- Better officials = smoother automation. A rival's best quartermaster is a legitimate raid target.

---

## 7. Needs tiers

| Tier | Needs |
|---|---|
| **Peasant** | food (any), water, shelter (bed and roof), warmth (cold regions and winter: hearth and fuel), safety, wages paid |
| **Craftsman** | + varied food (2+ kinds, including bread or meat), ale, tailored clothing, a proper house (enclosed, with a hearth), tools for their trade, a tavern and hearth-shrine within 150 m |
| **Noble** | + fine food (3+ kinds, including preserved meat or fish and salt or spice), wine or spirits, fine clothing (fur or silk), 1+ luxury (deep pearls, gold or silver jewellery, books, mana lamps, art), a manor, a staffed household, gardens or a plaza |

- **Promotion:** a household moves up a tier after 90% needs satisfaction for 5 days, if its roles fit: craftsmen are skilled trades; nobles are officials, masters, people of Champion grade or higher, and rich merchants. **Demotion:** a household drops a tier after 5 days below 60% needs satisfaction *(tune)*.
- **Effects** *(tune)*:
  - productivity: +0 / +20 / +40%
  - tax yield: ×1 / ×2.5 / ×6
  - higher loyalty baseline
  - some roles need a minimum tier (Magisters and Marshals: craftsman+)
- Tiers give the long production chains a buyer besides the army.

---

## 8. Loyalty and morale

**Loyalty** (0–100, per person, toward their king) drifts toward a target set by:
- pay (on time, and compared with what's offered nearby)
- needs satisfaction
- safety (recent attacks and deaths)
- family (family in the same kingdom raises it; family elsewhere lowers it)
- the king's deeds (victories and boss kills raise it; defeats and cruelty lower it)
- events (festivals, famine)

Will slows negative swings.

**In peace (low stakes):**
- below 40: work speed −10% to −30%
- below 20: a small daily chance to leave (become a wanderer) or defect to a known, more attractive kingdom
- no rebellions

**In war.** **Morale** (0–100) is a battle-time value per unit:
- It starts from loyalty.
- It falls with casualties, fear (Wardens, Calamities) and being flanked.
- It rises with officers nearby, the king's presence and winning.

When an army has lost ≥ 50% of its strength, or its morale breaks, each remaining unit's response depends on its **loyalty** (the owner's rule):

| Loyalty | Result |
|---|---|
| ≥ 70 | fights to the end |
| 40–69 | retreats |
| < 40 | surrenders (becomes a captive) or flees |

Morale decides *when* the check happens and how hard the army fights until then; loyalty decides the outcome.

**Swaying other kings' people** ("take their function, take their land"):
- **Bribes:** coin physically delivered by an envoy.
- **Better offers:** posted wages and housing at your border (known to anyone who sees it).
- **Protection:** your army defends their village.
- **Family:** you hold their relatives.

These raise a target's attraction toward you. Once their own loyalty falls low enough, they defect.

---

## 9. Champions and mages

- **Standouts** are people with unusually high stats (≈ 0.5%: two or more stats ≥ 17, or an exceptional total). The game **highlights** them when they join, but the player decides whom to invest in.
- **Everyone has a class and skills,** and climbs seven grades from Common to Calamity: `13-units-classes-power.md` §9–§11, with every class and skill in `14-class-library.md`. There is no "Make hero": the player invests by playing people, promoting them into the scarce Elite, Champion and Paragon places, and arming them. The old hero's 4–6 ability slots became each class's Knack, Active, Ultimate, Art and Mastery, plus relic slots for the Wardens' drops.
- **Death is permanent** for everyone, at every grade, though people are first **Downed** and can be revived (`13-units-classes-power.md` §5.9). Their gear drops where they fall.
- **Mages** need Affinity ≥ 15 (~1 in 300 people) and learn at an **Academy** with a teacher (a Master of magic, or scrolls). Magic proficiency grows at a twentieth of the usual rate: about a real week to Journeyman, three to Adept and seven to Master, faster when played (`13-units-classes-power.md` §8, §10.8) *(tune)*.
- **Mage classes:**
  - **Attuner:** generators, relays and wards need a mage's attunement, renewed every few days
  - **Enchanter:** items and runes
  - **Mage:** the battle mage, who becomes a Pyromancer, Rimecaller, Stormcaller or Stoneshaper at Elite
- Overuse causes **Mana burn** (`13-units-classes-power.md` §6). Mages are your scarcest people. Protect them.
- Kings can't be mages.

---

## 10. Items, inventories and storage

- **Every item exists at a place:** on the ground, in a container or stockpile, in someone's inventory, or on a cart, boat, wagon or conveyor. There is no global inventory.
- Item data: type, quantity, weight, volume class, **quality** (0–100, from the maker's proficiency, tools and inputs: `15-item-library.md` §1), **durability** (tools, weapons, armour), **spoilage timer** (food), owner.
- **The build rule:** a blueprint can only use materials physically reachable in *that settlement's* stockpiles. Missing materials must be hauled in.
- Unguarded stockpiles can be looted by enemies and rival kings.
- **Wear:**
  - tools lose durability per use
  - weapons and armour wear in combat
  - buildings decay (§13)
- **Spoilage:** each food item has a timer. Preservation (salting, smoking, drying, pickling, icing) multiplies shelf life. Cold regions, winter, cellars and ice-houses slow it.

---

## 11. Money and trade

- **Coins.** Gold **Crowns** and silver **Marks**, minted at a **Mint** by a Treasurer's crew from ingots *(tune: 1 gold ingot → 10 Crowns; 1 silver ingot → 20 Marks; 1 Crown = 20 Marks)*. Each coin carries its king's stamp (cosmetic); every coin is valid everywhere.
- **Treasury.** Coins sit in strongrooms. **Payroll** moves physically: pay chests travel to settlements and garrisons, and local paymasters hand out wages. Pay chests can be robbed.
- **Wages** per role per day *(tune)*:
  - peasant 1 Mark, craftsman 2–3, soldier 2, official 5, mage 10
  - wage level is a policy
- **Spending.** People buy food and goods at markets you build and stock, so coin flows back into your treasury boxes. **Taxes** (policy sliders) take a share of wages and market sales.
- **Prices.** Local markets use simple supply and demand: `price = base × (demand/supply)^e`.
- **Trade between kings:**
  - **The market board** (global): post buy and sell orders. A match creates a contract that settles when goods and coin physically arrive at the named **trading posts**. Caravans travel the real world. A failed delivery hurts reputation.
  - **Direct deals:** any offer between kings (goods, coin, access, alliance terms).
- **Monopolies** arise from the world's single-region resources (`02-world.md` §5).

---

## 12. Production and factories

- **Workstations:** forge, anvil, smelter, kiln, mill, bakery, loom, carpenter's bench, tannery, alchemy table, enchanting altar, mint, and more. Each has recipes: inputs, outputs and a time scaled by worker proficiency, tool quality and building quality. Every item and its recipe is in `15-item-library.md`.
- **Chain length:** medium for most goods (3–5 steps). **Ultra-long** for top-tier gear and mana tech (10–20 steps, several regions, several monopolies, mages).

**Example chains** (starting design):

| Product | Chain |
|---|---|
| Bread | grain (farm) → flour (mill) → bread (bakery + fuel + water) |
| Salt fish | fish + salt → salted fish (smokehouse); lasts about 10× longer |
| Iron sword | iron ore + coal → iron ingot (bloomery) → blade blank (anvil); timber + leather → hilt (carpenter, tanner) → sword (smith). Hammer wear and fuel feed in. |
| Signal tower | dressed stone + timber + iron fittings + a fire basket |
| Mana relay | moonsilver ore → ingot → wire; raw crystal → cut crystal (lapidary); dressed stone frame → relay; plus a mage's attunement |
| Warded lift | skystone blocks + lodestone rails + moonsilver conduit + heartroot-sealed housing + a ward (mage, moth-silk weave) + mana supply |
| **Demonsteel blade** (ultra-long) | demonsteel ore (Deep Forges) + brimstone fuel (Ibara) + fireclay crucible (Ember Veins) → demonsteel ingot → rime-quenched (Frost Hollows rime) → forged by a master smith → soulglass focus (Yomi) set in a titan-bone hilt (Boneyard) → ichor + titan-marrow enchantment by a Master mage |

**Factories** (the mana age) are laid out by hand, like Endfield:
- **Machines** are mana-powered workstations: auto-smelter, trip-hammer, power loom, crusher, press, mana furnace, pump, crane.
- **Movement:** conveyor belts (items per minute), splitters, mergers, sorters, arm inserters, lifts.
- Machines are multi-block structures built block by block from parts. They need mana from the grid and maintenance (parts wear). Some need an operator, whose skill affects speed and quality.
- **Min-maxing:** throughput ratios, belt capacity, layout, operator skill, input quality.
- **Noise.** Industry, deep mining, big battles and heavy mana use emit *noise* that draws enemy scouts (§17). This is Factorio's pollution idea.

---

## 13. Buildings, materials and support

- **Templates or freeform.** A structure *becomes* a building type when it passes validation:
  - **required parts** (for a forge: a forge block, an anvil, a chimney block with a path to open air, a door)
  - **an enclosed interior** of at least a minimum size (flood-fill)
  - **environmental requirements** for its region

  Templates are ready-made freeform designs that already pass.
- **Material properties** per block: strength (support span, HP), heat resistance, insulation, ward rating, rot resistance, weight, flammability, repair cost.
- **Regional requirements** *(tune)*:

| Region | Requirement to function and not decay fast |
|---|---|
| Shirogane, Frost Hollows | insulation ≥ 2 walls + a fuelled hearth |
| Ibara, Ember Veins, Deep Forges | heat resistance ≥ 3 (stone, fireclay brick) + fume vents |
| Hoshikuzu, Kagami Grottos, Leyflow | ward rating ≥ 2 (moonsilver-inlaid or warded) |
| Sallows | rot resistance + pilings (ground swallows plain foundations) |
| Selva | vine upkeep (fast decay without maintenance) |
| Kogane | sealed doors, sand-proof walls (storms bury) |
| Grey Mere | waterproofing, storm bracing |
| Sundered Isles | wind bracing, skystone anchors |
| Tasogare | lit: light level ≥ 7 around the building, or shades attack it |
| Boneyard, Bone Pits | wards or hearth-shrine consecration against the risen |
| Kurogane | braced roofs against rockfall and avalanche |
| Sekitei | wards against petrification |
| The Gut | living tunnels digest structures; constant repair |

- **Decay:** buildings lose integrity daily (base rate × region hazard × (1 − material resistance)). Reeves schedule repairs, which use materials.
- **Support** (simple rules):
  - A block is **grounded** if it rests on terrain or on a supported column.
  - Horizontal span limits per material *(tune)*: plank 4, wooden beam 8, stone brick 6, iron beam 14, natural rock 16.
  - Sand, gravel, snow and ash fall when unsupported.
  - Unsupported built blocks collapse into rubble and items, and hurt anyone below.
  - **Mining:** only spans *created by removing blocks* count. If digging makes a ceiling span over 16 m in natural rock (6 m in soil), that section collapses unless it's braced with pillars or beams.
  - **Natural voids are always stable:** generated caves and caverns (the Hollow Sky, the Buried City, geodes) never collapse on their own, even after nearby edits. Checks run only in a radius around edits.
  - The floating Sundered Isles are exempt (skystone).
- **Siege:** every block has HP (hardness × material). Sieges break blocks. A building stops working when its key parts are destroyed.
- **Buildings are neutral.** Control belongs to whoever's people operate or hold them, inside that kingdom's coverage. Abandoned buildings decay faster.

---

## 14. Mana

| Part | What it does |
|---|---|
| **Sources** | Mana crystals (mined, burned in generators); **ley wells** (fixed sites that produce steady mana with no fuel; rare, contested, strongest in the Nadir); **liquid mana** (Leyflow; dense fuel); **soulglass** (storage) |
| **Generator** (crystal furnace) | burns crystals into mana; needs an attuned mage (re-attune every ~3 days); output scales with the mage's skill |
| **Conduits** | moonsilver wire; capacity per tier; losses over distance |
| **Relays** | extend the grid and carry news (§4) |
| **Storage** | charged crystal cells (portable; carried to off-grid sites), soulglass banks (large) |
| **Consumers** | machines, relays, wards, lifts, mana lamps (Tasogare needs light), enchanting |
| **Wards** | mage-made fields at building or personal scale (amulets). They block mana storms, ascent sickness (warded lifts) and petrification, and reduce cold and heat. They cost mana upkeep. |

---

## 15. Logistics

- **Routes** are drawn by hand (waypoints) or generated by the Quartermaster from stock targets and demand. Each route has a transport type, assigned haulers or vehicles, and cargo rules. Example: "carry up to 500 iron from Stenholm to Eastwatch whenever Eastwatch < 200".
- **Transport** *(tune)*:

| Mode | Capacity | Speed | Needs |
|---|---|---|---|
| Porter | 30 kg | 1.4 m/s | food |
| Pack horse or mule | 120 kg | 1.8 m/s | fodder |
| Cart | 600 kg | 2.5 m/s on roads, 1 off | roads |
| Wagon | 1,500 kg | 2.5 m/s | roads, 2 horses |
| Riverboat or barge | 3–10 t | 2–3 m/s | water, docks |
| Rail wagon | 5 t each | 6–10 m/s | iron rails, stations; horse-drawn early, mana engines later |
| Lift | per platform | vertical | skystone, mana; warded for people |
| Conveyor | items/min | — | mana |
| Ropeway | light loads | fast across chasms | moth silk (deep) |

- **Roads** (gravel → cobble → paved), bridges and tunnels speed movement.
- **Threats:** raiders, enemies and rival kings intercept caravans. Escorts help. Routes show a danger rating from recent events.
- **Remote outposts** need food, fuel, repair materials, pay and arrows. When supply fails, health and loyalty drop and buildings decay.
- **Up and down:** people moving up through a shelf take ascent effects unless they ride a warded lift. Goods are unaffected.

---

## 16. Environment, hazards and depth

- Each region has **hazard fields** with local intensity (hotter near calderas, colder near the Rim) and time modifiers (the Boneyard at night, the north in winter).
- Hazards act on:
  - **people** (exposure → damage or sickness)
  - **buildings** (decay, burial, rot, fire, rockfall)
  - **items** (spoilage, rust)
- **Protection:** clothing (furs, fire cloaks), shelter (interiors with the right materials), wards, consumables (antidotes, torches).
- **Depth:** darker (light needed), region-specific heat or cold, ascent effects (`02-world.md` §3). Raw-mana regions carry **Hollowing** risk without wards.
- **Dynamic events** (later milestones): sandstorms, blizzards, mana storms, floods, avalanches, grass fires, and **Ibara eruptions**, where new thorns burst from the ground near heavy activity (a terrain edit that can destroy buildings).

---

## 17. Enemies (the Deep's forces)

- Each region's enemies belong to its Warden's faction: minions, soldiers, elites, generals and the Warden.
- **Musters** (spawners) sit in Seat rings and outposts. They produce units over time up to a cap, faster when the faction is alarmed. Killing a general disables or halves his musters.
- **Territory:** each faction holds its Seat rings plus outposts.
  - Unchallenged, it slowly expands by founding outposts at its frontier *(tune: every few in-game days)*.
  - Destroying outposts shrinks it.
- **Roamers:** war-bands wander inside and just beyond their territory and attack weak targets.
- **Scouts** wander wider, into player land.
  1. A scout sees your structures or units.
  2. It walks back to the nearest muster or fort to report.
  3. The faction raises its awareness of that target.
  4. A war party sized to your estimated strength and distance forms and marches.

  **Kill the scout and no report arrives.** Enemies have no global knowledge either.
- **Noise** (§12) draws scouts and increases war-party size and frequency.
- **Occupation:** an army that defeats a settlement's defenders and holds it turns it into an enemy outpost with a muster. People there are captured, killed or flee.
- **Boss armies never break.** No morale checks.
- Strength scales by tier (I–VI) and rises toward each Seat.

---

## 18. Bosses (Wardens)

- Wardens are in `02-world.md` §7: form, threat and regen for each.
- **Threat kits:**
  - **Burst:** single-target devastation, one-shots, heavy knockback
  - **AOE:** waves, clouds and fields that punish clumps
  - **Fortress:** armour that cuts non-siege damage by ~90%; stays out of melee reach (walls, water, heights). Siege engines do full damage.
- **HP pools are huge.** Design target *(tune)*: a Tier I Warden needs roughly 200 well-equipped soldiers attacking for 20 minutes with its regen shut off. Scale about ×2.5 per tier.
- **Regen sources are physical and changeable**: camps, pylons, vents, darkness, deep water, gold. Each has a counter-play.
- **Phases** at 75/50/25% HP change behaviour and call in reinforcements from musters.
- **Credit** (shared by contribution) counts:
  - damage dealt (siege included)
  - damage absorbed
  - healing and warding
  - regen sources destroyed during the engagement

  Credit needs ≥ 5% of total contribution. One kingdom with ≥ 95% and no other above 1% earns **Solitary**.
- **Drops** appear physically in the arena at death (artifacts, and hoards like Ozrem's gold). Whoever carries them off keeps them, so the fight after the fight matters.
- **Death is permanent until the reset.** Its musters stop. The region's enemy territory dissolves over about an in-game day; the remaining units become strays.
- **The King Below:**
  - regen per living Warden (+X/s each)
  - Wellspring conduits (destroyable, regrow slowly)
  - absorbs the fallen
  - a slow natural regen that never stops
  - phases combining burst, AOE and fortress

---

## 19. War between kings

- **PvP everywhere, with no declaration needed.** The offline AI, the king's strength and far-away respawns are the protections.
- **Companies** (a Captain + 10–50 soldiers) form **armies** (a Marshal + companies).
  - Orders: move, attack, hold, patrol, escort, siege, garrison, retreat.
  - Light formations: line, column, loose.
- **Combat:** `13-units-classes-power.md` §5–§6 (Health, armour, damage types, Overmatch, block and parry, conditions, Downed), with morale.
- **Siege engines:** ballista, catapult, trebuchet, ram, titan-bone engines, and later mana artillery. They break blocks and hurt fortress Wardens.
- **Capture:** hold buildings and network nodes to take them. Surrendered people become captives.
- **Taking a kingdom:** capture its capital and a large share of its people, or kill its king.
- **Diplomacy:** alliances (shared coverage view), non-aggression pacts, trade agreements. Broken treaties go into the Chronicle.

---

## 20. Seasons, scoring and achievements

- **Season loop:** Thaw → the Front (weeks 1–25) → the Frost (week 26: warnings, the final freeze, results) → new seed.
- **Score** *(tune)*:

| Source | Points |
|---|---|
| Warden credit | Tier I 100 · II 250 · III 600 · IV 1,500 · V 3,500 · King Below 10,000 |
| How credit pays | each credited kingdom gets tier points × (0.5 + 0.5 × its contribution share) |
| First kill of a Warden | ×1.5 |
| First to reach Layer 1 / 2 / 3 / the Pit | 500 / 1,000 / 2,000 / 4,000 |
| End state | land (km² of coverage), population, wealth (coin + goods at reference prices): each normalised to the server maximum, up to 1,000 each |
| War | kingdom taken 500 · king killed 300 · major battle won (≥ 50 units a side) 50, capped |

- **Leaderboards:** overall, Slayers, Realms (land + population), Wealth, Warlords.
- **Achievements**, grouped:
  - First steps: first winter, first mint, first relay
  - Depth: each layer reached
  - Wardens: each kill, Solitary kills, all Tier I
  - War: kings killed, kingdoms taken, wars won
  - Economy: monopolies held, trade volume
  - Survival: finish the season on your first life
- **Rewards carry over** as titles ("Breaker of the Hoarfather"), cosmetic banners, crests and king looks, and **Ledger of Kings** entries. Never gameplay power.
- **Inactive kingdoms** keep running on AI. After 7 real days of owner inactivity, upkeep lapses and decay speeds up. They're prey.

---

## 21. Accounts, lives and payments

- **Login:** Discord for playtests, Google later. One account = one king.
- **Anti-alt:**
  - minimum Discord account age (30 days)
  - optional phone-verified Discord
  - device and IP heuristics
  - admin bans
  - later, paid lives make alts cost money
- **Lives:** 3 per season, stored per account per season. Payments (1 free + 2 paid, ~$5 each, cap 3) arrive in a late milestone through a standard payment provider.

---

## 22. Simulation scale (design view)

- **Everyone always has an identity** (a compact record). A strong kingdom holds 20,000+ people; a full server can hold ~1–2 million identities.
- **Detail follows attention.** Each unit sits in one of four tiers, chosen by where players are looking. **Promotion is immediate:** a unit moves up as soon as a camera comes within range or a player possesses it. **Demotion waits** until the unit has been out of range for about 10 s *(tune)*, so units near a boundary don't flicker between tiers.

| Tier | Where | What runs |
|---|---|---|
| T0 | possessed by a player | full physics every 50 ms, predicted on that player's client |
| T1 | near a player's camera (roughly 64–128 m) | full physics every 50 ms; AI decisions 10 times a second |
| T2 | loaded but unwatched | follows its path without collision checks; digging and building take the same timed durations; AI 1–2 times a second |
| T3 | everywhere else (the ledger) | settlement-level production and consumption, loyalty drift, route flows and job progress, updated every 1–10 s. Unobserved battles resolve with regiment-level combat models |

- **Hydration:** when attention arrives, units are placed consistently with the ledger (near their workplace or home) and keep their identities. Items a unit carries leave the ledger's stock when it hydrates and return when it dehydrates; round-trip tests prove that no item, person or hit point is duplicated or lost. A unit's identity (home, job, family) persists through every tier. SimCity (2013) cut exactly this corner to gain speed, and players noticed.
- **Target** *(tune; benchmark before promising)*: tens of thousands of hydrated units server-wide, with a few thousand at T1 at once.
- **Design consequence:** every system in this doc must have both a per-agent version and an aggregate version that agree on average. See `07-architecture.md` §9.
