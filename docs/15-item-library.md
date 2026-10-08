# 15 · Item library

Every item in the game: materials, weapons, armour, shields, tools, ammunition, charms, relics, food and drink, medicine, alchemy, runes, mounts and siege engines. The rules for fighting with them are in `13-units-classes-power.md` §5; the economy that makes and moves them is in `05-systems.md` §10–§12. Every table here whose first column is **ID** is data, checked by `node docs/tools/content-check.mjs`.

---

## 1. How items work

### 1.1 What every item has

An ID, a name, a weight, a stack size, and a **value**: its reference price in Marks (`05-systems.md` §11), which markets start from and which is also its offering value (13 §15.3). Made goods have a **quality**; tools, weapons, armour and shields have **durability**; food has a **spoilage** timer (`05-systems.md` §10). Items that come in metal tiers have a **tier** from 1 to 7.

### 1.2 Metal tiers

Seven metals, from bog iron to demonsteel (§2.1). Tier sets the numbers; the metal adds a trait. A family row (a sword, a plate helm, a round shield, a pick) makes one item for each metal it allows, named "{metal} {family}": "Steel sword", "Rimesteel plate helm".

| Tier | Metal | Sword damage | Plate set armour | Round shield Block | Tool speed |
|---|---|---|---|---|---|
| 1 | Bog iron | 20 | 40 | 12 | ×3 |
| 2 | Iron | 30 | 70 | 20 | ×4 |
| 3 | Steel | 40 | 100 | 28 | ×5 |
| 4 | Brimsteel | 50 | 130 | 36 | ×6 |
| 5 | Rimesteel | 60 | 160 | 44 | ×7 |
| 6 | Deepsteel | 70 | 190 | 52 | ×8 |
| 7 | Demonsteel | 80 | 220 | 60 | ×9 |

The rules behind the table: a sword does `10 + 10 × tier`; a full plate set gives `10 + 30 × tier` armour; a round shield blocks `4 + 8 × tier`; a tool works at `2 + tier` times bare hands. Other families scale from these by the factor in their row.

### 1.3 Weapons

- **Damage** is the family's factor × the tier's sword damage. **Speed** is swings (or shots) a second; a hit's cooldown in ticks is `round(20 ÷ speed)` (13 §3.5).
- **Type:** Blade, Point or Blunt (13 §5.2). **Reach** in metres. **Arc:** the cone in which a swing finds its primary target and, with **Sweep**, its other targets.
- **Traits** used in rows: **Sweep** (others in the arc take the share given), **Guard** (blocks as half a round shield of its tier, and can parry: 13 §5.5), two-handed (no shield), heavy (8 Stamina a swing), armour-piercing (ignores the share of armour given), mounted (full damage only from the saddle), thrown.
- The family's proficiency is Melee or Ranged; its attribute is Strength for Blade and Blunt, Agility for Point and ranged (13 §5.1).

### 1.4 Armour

- A **set** is four pieces: head (15% of the set's armour), body (40%), legs (30%) and feet (15%).
- **Plate** gives the tier's full set armour; **mail** gives 85% of it; **leather** 60%; **cloth** 30%. Their speed factors are 0.90, 0.95, 1.00 and 1.00 (13 §4.2), and they decide which damage types hurt most (13 §5.2).
- Leather and cloth are made from hides, furs, silks and cloth rather than metal, so their tiers come from what they are made of (§5.2).
- A metal's armour trait (§2.1) applies once the whole set is of that metal.

### 1.5 Shields

Held in the off hand. **Block** is the family's factor × the tier's round-shield Block, taken off each hit from the front 120° after armour (13 §5.5). A shield's armour counts only while it is raised.

### 1.6 Tools

A tool works its blocks or its workstation at its tier's speed (§1.2) × the family's factor; the wrong tool, or none, works at ×1. Tools are weapons too, poor ones: a pick or a felling axe hits as a tier-matched sword × 0.6, a hammer × 0.5, a knife × 0.4.

### 1.7 Quality

Made goods have a quality from 0 to 100:

`quality = 0.6 × the maker's proficiency + 0.2 × the inputs' average quality + the workplace's bonus (0–10) + (the tool's quality − 50) ÷ 10`, then ±5 at random (from the deterministic world random), held between 0 and 100. A Grandmaster's work is never under 80, and only a Master or better makes 90 or more (13 §8).

| Quality | Name |
|---|---|
| 0–19 | Crude |
| 20–49 | Plain |
| 50–74 | Fine |
| 75–89 | Superior |
| 90–100 | Masterwork |

Every point away from 50 is worth 0.4%: damage for weapons, armour for armour, Block for shields, speed for tools, the size of a meal's or a draught's effect. So quality runs from −20% to +20%. Durability scales with it twice as hard (−40% to +40%), and value is × `(0.5 + quality ÷ 100)`.

### 1.8 Durability and repair

A tool loses 1 durability a use, a weapon 1 a hit, armour and shields 1 for each hit they take. Base durability is the family's, × `(1 + 0.5 × (tier − 1))`, × quality (§1.7). At 0 the item breaks. The workstation that makes an item repairs it: one of its main material for each 25% restored, by anyone of its trade.

### 1.9 Where items sit on a person

- **Worn:** head, body, legs, feet; **hands:** main and off; the **hotbar** (9) and the **pack** (27), as in Minecraft (`11-interface-catalogue.md` D6).
- **Charms:** one slot, two from Elite (13 §9). **Relics:** one slot from Champion, two from Paragon.
- Weight counts against carrying (13 §4.2): everything worn and carried.

### 1.10 Runes

Weapons, armour and shields of tier 3 or better have one rune socket, and tier 6 or better two. An Enchanter sets a rune (§14); removing one destroys it.

### 1.11 What these tables don't list

Blocks (`07-architecture.md` §5) and buildings (`05-systems.md` §13) are not items here, except the parts listed in §17. The names of goods made by a family row are generated (§1.2); every other name is in its row.

---

## 2. Materials

### 2.1 Metals

| ID | Metal | Tier | Weight | Value | Weapon trait | Armour trait | Source | Since |
|---|---|---|---|---|---|---|---|---|
| `item.bog-iron-ingot` | Bog-iron | 1 | 1 | 0.5 | Brittle: durability ×0.75 | Brittle: durability ×0.75 | 2 × `item.bog-iron-ore`, 1 × `item.peat`, at a bloomery | M2 |
| `item.iron-ingot` | Iron | 2 | 1 | 1 | Sound: one ingot restores 50% in a repair, not 25% | Sound: one ingot restores 50% in a repair, not 25% | 2 × `item.iron-ore`, 1 × `item.coal`, at a bloomery | M3 |
| `item.steel-ingot` | Steel | 3 | 1 | 3 | Keen: armour-piercing 10% | Tough: durability ×1.25 | 2 × `item.iron-ingot`, 2 × `item.charcoal`, at a furnace | M3 |
| `item.brimsteel-ingot` | Brimsteel | 4 | 1 | 16 | Searing: 10% of each hit is added as Fire | Fire resistance 25% | 2 × `item.steel-ingot`, 1 × `item.brimstone`, at a furnace | M5 |
| `item.rimesteel-ingot` | Rimesteel | 5 | 1 | 70 | Rime-bitten: a full swing leaves **Chilled**, once every 3 s on the same target | Cold resistance 25%; **Freezing** exposure halved | 3 × `item.rime-ore`, 1 × `item.brimstone`, 1 × `item.crucible`, at a furnace, then forged cold | M6 |
| `item.deepsteel-ingot` | Deepsteel | 6 | 1 | 150 | Old Crown edge: armour-piercing 25% | Mana resistance 25%; **Hollowing** rises half as fast | 2 × `item.deepsteel-salvage`, 1 × `item.brimstone`, 1 × `item.crucible`, at a furnace | M7 |
| `item.demonsteel-ingot` | Demonsteel | 7 | 1 | 350 | Hungering: 10% of each hit is **true** damage | Resistance 20% to every element; can't be **Exposed** | 2 × `item.demonsteel-ore`, 2 × `item.brimstone`, 1 × `item.crucible`, at a furnace, quenched with 1 × `item.rime-ore` | M7 |

### 2.2 Goods

| ID | Name | Tier | Weight | Value | Source | Since |
|---|---|---|---|---|---|---|
| `item.timber` | Timber | — | 20 | 0.1 | Felled wherever trees grow | M2 |
| `item.planks` | Planks | — | 5 | 0.05 | 1 × `item.timber` → 4, at the carpenter's bench | M2 |
| `item.ironwood` | Ironwood | 3 | 30 | 0.5 | Felled in the Selva; the hardest timber in Kaldmark | M3 |
| `item.stone` | Stone | — | 25 | 0.05 | Quarried anywhere; granite, slate and marble are best in Kurogane | M2 |
| `item.clay` | Clay | — | 20 | 0.05 | Dug by rivers and lakes; richest in the Hearthlands | M2 |
| `item.sand` | Sand | — | 20 | 0.03 | Dug anywhere | M2 |
| `item.glass-sand` | Glass sand | — | 20 | 0.2 | Dug in Kogane | M3 |
| `item.fireclay` | Fireclay | 5 | 20 | 4 | The Ember Veins only | M6 |
| `item.glass` | Glass | — | 1 | 0.5 | 2 × `item.sand`, 1 × `item.charcoal`, at the glassworks | M3 |
| `item.lens` | Lens | — | 0.1 | 1 | 1 × `item.glass-sand`, 1 × `item.charcoal`, at the glassworks, ground by hand | M3 |
| `item.clay-pot` | Clay pot | — | 1 | 0.08 | 1 × `item.clay` → 2, at the kiln | M3 |
| `item.quicklime` | Quicklime | — | 2 | 0.5 | 2 × `item.stone` (chalk or limestone), 1 × `item.charcoal`, at the kiln | M3 |
| `item.crucible` | Crucible | 5 | 3 | 10 | 2 × `item.fireclay`, at the kiln | M6 |
| `item.coal` | Coal | — | 2 | 0.1 | Small seams anywhere; rich in Kurogane and the Old Workings | M2 |
| `item.charcoal` | Charcoal | — | 2 | 0.3 | 2 × `item.timber`, at a charcoal mound | M3 |
| `item.peat` | Peat | — | 3 | 0.05 | Cut in the Sallows | M2 |
| `item.pitch` | Pitch | — | 1 | 0.4 | 2 × `item.timber` (pine), at a charcoal mound | M3 |
| `item.brimstone` | Brimstone | 4 | 2 | 8 | Ibara only; burns hotter than any coal | M5 |
| `item.bog-iron-ore` | Bog iron ore | 1 | 5 | 0.15 | Raked from the bogs of the Sallows | M2 |
| `item.iron-ore` | Iron ore | 2 | 5 | 0.25 | Small veins anywhere; rich in Kurogane | M3 |
| `item.rime-ore` | Rime ore | 5 | 5 | 15 | The Frost Hollows only | M6 |
| `item.deepsteel-salvage` | Deepsteel salvage | 6 | 3 | 60 | Stripped from the works of the Buried City | M7 |
| `item.demonsteel-ore` | Demonsteel ore | 7 | 5 | 150 | The Deep Forges only | M7 |
| `item.silver-ore` | Silver ore | — | 5 | 9 | Shirogane only | M3 |
| `item.silver-ingot` | Silver ingot | — | 0.2 | 20 | 2 × `item.silver-ore`, 1 × `item.charcoal`, at a furnace | M3 |
| `item.gold-ore` | Gold ore | — | 5 | 95 | Kogane only | M3 |
| `item.gold-ingot` | Gold ingot | — | 0.1 | 200 | 2 × `item.gold-ore`, 1 × `item.charcoal`, at a furnace | M3 |
| `item.moonsilver-ore` | Moonsilver ore | 4 | 5 | 12 | Tasogare only | M6 |
| `item.moonsilver-ingot` | Moonsilver ingot | 4 | 1 | 30 | 2 × `item.moonsilver-ore`, 1 × `item.charcoal`, at a furnace | M6 |
| `item.moonsilver-wire` | Moonsilver wire | 4 | 0.1 | 4.5 | 1 × `item.moonsilver-ingot` → 8, drawn at the anvil | M6 |
| `item.old-salvage` | Old salvage | — | 2 | 5 | Gears, chains and fittings from the Old Workings | M6 |
| `item.marks` | Marks | — | 0.01 | 1 | 1 × `item.silver-ingot` → 20, at the mint | M3 |
| `item.crowns` | Crowns | — | 0.01 | 20 | 1 × `item.gold-ingot` → 10, at the mint | M3 |
| `item.raw-crystal` | Raw mana crystal | 3 | 1 | 4 | Hoshikuzu only, on the surface | M6 |
| `item.cut-crystal` | Cut crystal | 3 | 0.5 | 6 | 1 × `item.raw-crystal`, at the lapidary's bench | M6 |
| `item.pure-crystal` | Pure mana crystal | 5 | 0.5 | 30 | The Kagami Grottos only | M6 |
| `item.fused-glass` | Fused glass | 4 | 1 | 3 | Hoshikuzu's storm scars | M6 |
| `item.skystone` | Skystone | 4 | 0 | 12 | The Sundered Isles only | M6 |
| `item.glowcap` | Glowcap | — | 0.1 | 1 | Tasogare's pale fungi | M6 |
| `item.obsidian` | Obsidian | 4 | 2 | 3 | Ibara | M5 |
| `item.titan-bone` | Titan bone | 4 | 30 | 8 | The Boneyard only | M3 |
| `item.titan-marrow` | Titan marrow | 5 | 1 | 30 | The Bone Pits only | M6 |
| `item.heartroot-resin` | Heartroot resin | 5 | 1 | 10 | The Root Halls only | M6 |
| `item.fungi` | Edible fungi | — | 0.5 | 0.1 | Grown in the dark; richest in the Sporewood | M6 |
| `item.deep-pearl` | Deep pearl | 5 | 0.01 | 50 | The Drowned Caverns only | M6 |
| `item.living-stone` | Living stone | 6 | 25 | 40 | Sekitei only | M7 |
| `item.liquid-mana` | Liquid mana | 6 | 1 | 60 | Drawn from the Leyflow in sealed flasks | M7 |
| `item.lodestone` | Lodestone | 6 | 10 | 40 | The Great Shear only | M7 |
| `item.moth-silk` | Moth silk | 6 | 0.2 | 30 | The Hollow Sky only | M7 |
| `item.ichor` | Ichor | 7 | 0.5 | 150 | The Gut only | M7 |
| `item.soulglass` | Soulglass | 7 | 1 | 120 | Yomi only | M7 |
| `item.grain` | Grain | — | 1 | 0.05 | Fields; best in the Hearthlands | M2 |
| `item.flour` | Flour | — | 1 | 0.12 | 2 × `item.grain`, at the mill | M3 |
| `item.vegetables` | Vegetables | — | 1 | 0.05 | Fields and gardens | M2 |
| `item.fruit` | Fruit | — | 0.5 | 0.08 | Orchards; wild in the Selva | M2 |
| `item.herbs` | Herbs | — | 0.1 | 0.1 | Foraged anywhere; the medicinal kinds in the Selva | M2 |
| `item.salt` | Salt | — | 1 | 0.2 | Pans on the Grey Mere and Kogane's salt flats | M3 |
| `item.fen-reagents` | Fen reagents | — | 0.2 | 0.3 | Gathered in the Sallows | M3 |
| `item.meat` | Meat | — | 1 | 0.15 | Butchered livestock and game | M2 |
| `item.fish` | Fish | — | 1 | 0.1 | Rivers, lakes and the Grey Mere | M2 |
| `item.milk` | Milk | — | 1 | 0.05 | Cows and goats | M2 |
| `item.fat` | Fat | — | 0.5 | 0.1 | Butchered livestock and game | M2 |
| `item.hide` | Hide | 1 | 3 | 0.2 | Butchered livestock and game | M2 |
| `item.leather` | Leather | 2 | 2 | 0.5 | 1 × `item.hide`, at the tannery | M3 |
| `item.fur` | Fur | — | 1 | 1.5 | Hunted and trapped; the best from Shirogane | M2 |
| `item.bone` | Bone | — | 1 | 0.05 | Butchered livestock and game | M2 |
| `item.sinew` | Sinew | — | 0.1 | 0.1 | Butchered livestock and game | M2 |
| `item.horn` | Horn | — | 0.5 | 0.2 | Cattle and goats | M2 |
| `item.feathers` | Feathers | — | 0.01 | 0.02 | Fowl, wild and kept | M2 |
| `item.wool` | Wool | — | 0.5 | 0.06 | Shorn from sheep | M2 |
| `item.flax` | Flax | — | 0.5 | 0.05 | Fields | M2 |
| `item.cord` | Cord | — | 0.2 | 0.15 | 2 × `item.flax` or 2 × `item.wool`, spun | M2 |
| `item.cloth` | Cloth | — | 0.5 | 0.5 | 2 × `item.cord`, at the loom | M3 |
| `item.padding` | Padding | — | 1 | 1.2 | 2 × `item.cloth`, quilted at the tailor's table | M3 |
| `item.grip` | Grip | — | 0.2 | 0.3 | 1 × `item.planks`, 1 × `item.cord`, at the carpenter's bench | M2 |
| `item.haft` | Haft | — | 1 | 0.1 | 1 × `item.timber` → 2, at the carpenter's bench | M2 |
| `item.long-haft` | Long haft | — | 2 | 0.15 | 1 × `item.timber`, at the carpenter's bench | M2 |
| `item.bowstring` | Bowstring | — | 0.05 | 0.2 | 1 × `item.cord` or 1 × `item.sinew` | M2 |
| `item.black-powder` | Black powder | — | 0.5 | 18 | 2 × `item.brimstone`, 1 × `item.charcoal`, 1 × `item.fen-reagents`, at the alchemy table | M5 |

---

## 3. Weapons

### 3.1 Metal weapons

| ID | Name | Type | Hands | Damage | Speed | Reach | Arc | Ingots | Traits | Since |
|---|---|---|---|---|---|---|---|---|---|---|
| `item.sword` | Sword | Blade | one | ×1.0 | 1.6 | 3.0 m | 90° | 2 ingots, 1 × `item.grip` | — | M3 |
| `item.short-sword` | Short sword | Blade | one | ×0.8 | 2.1 | 2.6 m | 80° | 1 ingot, 1 × `item.grip` | — | M3 |
| `item.sabre` | Sabre | Blade | one | ×0.85 | 1.8 | 3.0 m | 110° | 2 ingots, 1 × `item.grip` | **Sweep** 20% | M3 |
| `item.greatsword` | Greatsword | Blade | two | ×1.5 | 1.2 | 3.5 m | 120° | 4 ingots, 1 × `item.grip` | two-handed, heavy, **Sweep** 30%, **Guard** | M3 |
| `item.battle-axe` | Battle axe | Blade | one | ×1.25 | 1.25 | 3.0 m | 90° | 2 ingots, 1 × `item.haft` | armour-piercing 15% | M3 |
| `item.greataxe` | Greataxe | Blade | two | ×1.75 | 1.05 | 3.4 m | 100° | 4 ingots, 1 × `item.long-haft` | two-handed, heavy, armour-piercing 20%, **Sweep** 20% | M3 |
| `item.cleaver` | Cleaver | Blade | one | ×1.2 | 1.3 | 2.6 m | 80° | 2 ingots, 1 × `item.grip` | works a butchery as a knife of its tier | M3 |
| `item.mace` | Mace | Blunt | one | ×1.1 | 1.4 | 2.8 m | 80° | 2 ingots, 1 × `item.haft` | — | M3 |
| `item.flail` | Flail | Blunt | one | ×1.2 | 1.2 | 3.0 m | 100° | 3 ingots, 1 × `item.haft` | its hits ignore half of Block, not a quarter | M4 |
| `item.warhammer` | Warhammer | Blunt | one | ×1.3 | 1.15 | 2.8 m | 70° | 3 ingots, 1 × `item.haft` | heavy, armour-piercing 20% | M3 |
| `item.maul` | Maul | Blunt | two | ×2.0 | 0.95 | 3.2 m | 90° | 5 ingots, 1 × `item.long-haft` | two-handed, heavy, **Sweep** 25% | M4 |
| `item.spear` | Spear | Point | two | ×1.1 | 1.5 | 4.0 m | 30° | 1 ingot, 1 × `item.long-haft` | two-handed, **Guard** | M2 |
| `item.pike` | Pike | Point | two | ×1.4 | 1.0 | 5.5 m | 20° | 1 ingot, 2 × `item.long-haft` | two-handed, heavy, **Guard** | M4 |
| `item.halberd` | Halberd | Blade | two | ×1.5 | 1.2 | 4.2 m | 60° | 3 ingots, 1 × `item.long-haft` | two-handed, heavy, **Guard**, armour-piercing 10% | M4 |
| `item.lance` | Lance | Point | one | ×2.2 | 0.75 | 4.5 m | 20° | 2 ingots, 2 × `item.long-haft` | mounted, heavy, armour-piercing 20% | M4 |
| `item.dagger` | Dagger | Point | one | ×0.6 | 2.5 | 2.2 m | 60° | 1 ingot, 1 × `item.grip` | armour-piercing 15% | M3 |
| `item.parry-dagger` | Parry dagger | Point | one | ×0.5 | 2.0 | 2.0 m | 60° | 1 ingot, 1 × `item.grip` | **Guard** from the off hand; parry window 0.35 s, not 0.25 s | M5 |
| `item.javelin` | Javelin | Point | one | ×1.3 | 0.8 | 3.0 m; thrown 30 m | 30° | 1 ingot, 1 × `item.haft` → 2 | thrown | M3 |

### 3.2 Bows, crossbows and staves

| ID | Name | Tier | Type | Damage | Speed | Range | Made from | Traits | Since |
|---|---|---|---|---|---|---|---|---|---|
| `item.self-bow` | Self bow | 1 | Point | 22 | 0.8 | 60 m | 1 × `item.long-haft`, 1 × `item.bowstring` | draws in 1 s | M2 |
| `item.sling` | Sling | 1 | Blunt | 14 | 1.0 | 40 m | 1 × `item.hide`, 1 × `item.cord` | shoots stones and shot; costs no Stamina to draw | M2 |
| `item.quarterstaff` | Quarterstaff | 1 | Blunt | 18 | 1.6 | 3.5 m reach | 1 × `item.long-haft` | two-handed, **Guard** | M3 |
| `item.longbow` | Longbow | 2 | Point | 39 | 0.6 | 110 m | 2 × `item.long-haft`, 1 × `item.bowstring` | draws in 1.4 s; 9 Stamina a draw | M4 |
| `item.staff-sling` | Staff sling | 2 | Blunt | 24 | 0.7 | 70 m | 1 × `item.long-haft`, 1 × `item.hide`, 1 × `item.cord` | two-handed; lobs over walls | M4 |
| `item.crossbow` | Crossbow | 2 | Point | 48 | 0.33 | 90 m | 2 × `item.planks`, 1 × `item.iron-ingot`, 1 × `item.bowstring` | loads in 3 s, then shoots at full power with no Stamina to hold | M4 |
| `item.horn-bow` | Horn bow | 3 | Point | 40 | 0.9 | 80 m | 1 × `item.planks`, 2 × `item.horn`, 2 × `item.sinew`, 1 × `item.bowstring` | draws in 0.9 s; moving doesn't double its spread | M4 |
| `item.ironwood-longbow` | Ironwood longbow | 3 | Point | 52 | 0.6 | 120 m | 2 × `item.ironwood`, 1 × `item.bowstring` | draws in 1.4 s; 9 Stamina a draw | M4 |
| `item.steel-crossbow` | Steel crossbow | 3 | Point | 64 | 0.3 | 100 m | 2 × `item.planks`, 2 × `item.steel-ingot`, 1 × `item.bowstring` | loads in 3.3 s; armour-piercing 15% | M4 |
| `item.hand-crossbow` | Hand crossbow | 3 | Point | 32 | 0.5 | 40 m | 1 × `item.planks`, 1 × `item.steel-ingot`, 1 × `item.bowstring` | one-handed; loads in 2 s | M4 |
| `item.crystal-staff` | Crystal staff | 3 | Blunt | 40 | 1.4 | 3.5 m reach | 1 × `item.ironwood`, 2 × `item.cut-crystal` | two-handed, **Guard**; skill effect +5% | M6 |
| `item.crystal-focus` | Crystal focus | 3 | Focus | 36 | — | — | 1 × `item.cut-crystal`, 1 × `item.silver-ingot` | one-handed, leaving the other hand for a shield; skills use its Damage; skill effect +5% | M6 |
| `item.bone-bow` | Bone bow | 4 | Point | 55 | 0.85 | 100 m | 1 × `item.titan-bone`, 2 × `item.sinew`, 1 × `item.bowstring` | draws in 1 s; its arrows fly 25% faster | M5 |
| `item.arbalest` | Arbalest | 4 | Point | 80 | 0.25 | 120 m | 2 × `item.ironwood`, 3 × `item.brimsteel-ingot`, 1 × `item.bowstring` | loads in 4 s with a windlass; armour-piercing 25% | M5 |
| `item.moonsilver-staff` | Moonsilver staff | 4 | Blunt | 50 | 1.4 | 3.5 m reach | 1 × `item.ironwood`, 2 × `item.moonsilver-ingot`, 1 × `item.cut-crystal` | two-handed, **Guard**; skill effect +10% | M6 |
| `item.moonsilver-focus` | Moonsilver focus | 4 | Focus | 45 | — | — | 1 × `item.moonsilver-ingot`, 1 × `item.cut-crystal` | one-handed; skills use its Damage; skill effect +5%, Mana +10% | M6 |
| `item.lacquered-bow` | Lacquered bow | 5 | Point | 66 | 0.85 | 110 m | 1 × `item.ironwood`, 1 × `item.titan-bone`, 1 × `item.heartroot-resin`, 1 × `item.bowstring` | draws in 0.9 s; spread −25% | M6 |
| `item.rime-arbalest` | Rime arbalest | 5 | Point | 96 | 0.25 | 130 m | 2 × `item.ironwood`, 3 × `item.rimesteel-ingot`, 1 × `item.bowstring` | loads in 4 s; armour-piercing 25%; a hit leaves **Chilled** | M6 |
| `item.grotto-staff` | Grotto staff | 5 | Blunt | 60 | 1.4 | 3.5 m reach | 1 × `item.ironwood`, 2 × `item.moonsilver-ingot`, 2 × `item.pure-crystal` | two-handed, **Guard**; skill effect +10%, Mana +10% | M6 |
| `item.pearl-focus` | Pearl focus | 5 | Focus | 54 | — | — | 2 × `item.deep-pearl`, 1 × `item.moonsilver-ingot` | one-handed; skills use its Damage; skill effect +10% | M6 |
| `item.silk-longbow` | Silk longbow | 6 | Point | 91 | 0.65 | 140 m | 2 × `item.ironwood`, 1 × `item.titan-bone`, 1 × `item.moth-silk` | draws in 1.2 s; 9 Stamina a draw; armour-piercing 15% | M7 |
| `item.deep-arbalest` | Deep arbalest | 6 | Point | 112 | 0.28 | 140 m | 2 × `item.ironwood`, 3 × `item.deepsteel-ingot`, 1 × `item.moth-silk` | loads in 3.5 s; armour-piercing 35% | M7 |
| `item.ley-staff` | Ley staff | 6 | Blunt | 70 | 1.4 | 3.5 m reach | 1 × `item.ironwood`, 2 × `item.moonsilver-ingot`, 2 × `item.pure-crystal`, 1 × `item.liquid-mana` | two-handed, **Guard**; skill effect +15% | M7 |
| `item.ichor-bow` | Ichor-cured bow | 7 | Point | 88 | 0.9 | 130 m | 1 × `item.ironwood`, 2 × `item.titan-bone`, 1 × `item.moth-silk`, 1 × `item.ichor` | draws in 0.9 s; 10% of each hit is **true** damage | M7 |
| `item.demon-arbalest` | Demonsteel arbalest | 7 | Point | 128 | 0.28 | 150 m | 2 × `item.ironwood`, 3 × `item.demonsteel-ingot`, 1 × `item.moth-silk` | loads in 3.5 s; armour-piercing 35%; 10% of each hit is **true** damage | M7 |
| `item.soulglass-staff` | Soulglass staff | 7 | Blunt | 80 | 1.4 | 3.5 m reach | 1 × `item.titan-bone`, 2 × `item.moonsilver-ingot`, 2 × `item.soulglass`, 1 × `item.ichor` | two-handed, **Guard**; skill effect +20%, Mana +20% | M7 |
| `item.soulglass-focus` | Soulglass focus | 7 | Focus | 72 | — | — | 1 × `item.soulglass`, 1 × `item.titan-bone`, 1 × `item.moonsilver-ingot` | one-handed; skills use its Damage; skill effect +10%, Mana +25% | M7 |

---

## 4. Ammunition

| ID | Name | For | Damage | Effect | Made from | Since |
|---|---|---|---|---|---|---|
| `item.bone-arrow` | Bone arrow | bows | +0% | — | 1 × `item.planks`, 1 × `item.bone`, 1 × `item.feathers` → 8 | M2 |
| `item.iron-arrow` | Iron arrow | bows | +10% | — | 1 × `item.planks`, 1 × `item.iron-ingot`, 2 × `item.feathers` → 16 | M3 |
| `item.bodkin-arrow` | Bodkin arrow | bows | +10% | armour-piercing 25% | 1 × `item.planks`, 1 × `item.steel-ingot`, 2 × `item.feathers` → 16 | M3 |
| `item.broadhead-arrow` | Broadhead arrow | bows | +15% | **Bleeding** | 1 × `item.planks`, 1 × `item.steel-ingot`, 2 × `item.feathers` → 12 | M4 |
| `item.fire-arrow` | Fire arrow | bows | +0% | **Burning**; sets alight what burns where it lands | 4 × `item.iron-arrow`, 1 × `item.pitch` → 4 | M4 |
| `item.brimsteel-arrow` | Brimsteel arrow | bows | +20% | 10% of the hit is added as Fire | 1 × `item.planks`, 1 × `item.brimsteel-ingot`, 2 × `item.feathers` → 16 | M5 |
| `item.crystal-arrow` | Crystal arrow | bows | +10% | the hit is Mana, not Point | 1 × `item.planks`, 1 × `item.cut-crystal`, 2 × `item.feathers` → 8 | M6 |
| `item.rimesteel-arrow` | Rimesteel arrow | bows | +25% | **Chilled**, once every 3 s on the same target | 1 × `item.planks`, 1 × `item.rimesteel-ingot`, 2 × `item.feathers` → 16 | M6 |
| `item.deepsteel-arrow` | Deepsteel arrow | bows | +30% | armour-piercing 30% | 1 × `item.planks`, 1 × `item.deepsteel-ingot`, 2 × `item.feathers` → 16 | M7 |
| `item.demonsteel-arrow` | Demonsteel arrow | bows | +35% | 10% of the hit is **true** damage | 1 × `item.planks`, 1 × `item.demonsteel-ingot`, 2 × `item.feathers` → 16 | M7 |
| `item.iron-bolt` | Iron bolt | crossbows | +10% | — | 1 × `item.planks`, 1 × `item.iron-ingot` → 12 | M4 |
| `item.steel-bolt` | Steel bolt | crossbows | +15% | armour-piercing 20% | 1 × `item.planks`, 1 × `item.steel-ingot` → 12 | M4 |
| `item.brimsteel-bolt` | Brimsteel bolt | crossbows | +20% | armour-piercing 25%; 10% of the hit is added as Fire | 1 × `item.planks`, 1 × `item.brimsteel-ingot` → 12 | M5 |
| `item.deepsteel-bolt` | Deepsteel bolt | crossbows | +30% | armour-piercing 40% | 1 × `item.planks`, 1 × `item.deepsteel-ingot` → 12 | M7 |
| `item.demonsteel-bolt` | Demonsteel bolt | crossbows | +35% | armour-piercing 40%; 10% of the hit is **true** damage | 1 × `item.planks`, 1 × `item.demonsteel-ingot` → 12 | M7 |
| `item.sling-stone` | Sling stone | slings | +0% | — | 1 × `item.stone` → 16 | M2 |
| `item.clay-shot` | Clay shot | slings | +10% | — | 1 × `item.clay` → 16, fired at the kiln | M3 |
| `item.iron-shot` | Iron shot | slings | +25% | **Staggered** by a hit at full power | 1 × `item.iron-ingot` → 16 | M4 |
| `item.ballista-bolt` | Ballista bolt | ballistae | the engine's | passes through up to 3 people in a line | 1 × `item.long-haft`, 1 × `item.iron-ingot` | M5 |
| `item.engine-stone` | Engine stone | catapults and trebuchets | the engine's | — | 4 × `item.stone`, dressed at the mason's yard | M5 |

---

## 5. Armour

### 5.1 Metal armour

| ID | Name | Class | Slot | Share | Ingots | Traits | Since |
|---|---|---|---|---|---|---|---|
| `item.mail-coif` | Mail coif | Mail | Head | 15% | 2 ingots, 1 × `item.padding` | — | M3 |
| `item.mail-hauberk` | Mail hauberk | Mail | Body | 40% | 6 ingots, 2 × `item.padding` | — | M3 |
| `item.mail-chausses` | Mail chausses | Mail | Legs | 30% | 4 ingots, 1 × `item.padding` | — | M3 |
| `item.mail-boots` | Mail boots | Mail | Feet | 15% | 2 ingots, 1 × `item.leather` | — | M3 |
| `item.plate-helm` | Plate helm | Plate | Head | 15% | 3 ingots, 1 × `item.padding` | — | M3 |
| `item.plate-cuirass` | Plate cuirass | Plate | Body | 40% | 8 ingots, 2 × `item.padding`, 1 × `item.leather` | — | M3 |
| `item.plate-greaves` | Plate greaves | Plate | Legs | 30% | 6 ingots, 1 × `item.padding`, 1 × `item.leather` | — | M3 |
| `item.plate-boots` | Plate boots | Plate | Feet | 15% | 3 ingots, 1 × `item.leather` | — | M3 |

### 5.2 Leather, cloth and clothing

| ID | Name | Tier | Class | Slot | Armour | Made from | Traits | Since |
|---|---|---|---|---|---|---|---|---|
| `item.hide-cap` | Hide cap | 1 | Leather | Head | 4 | 1 × `item.hide`, 1 × `item.cord` | — | M3 |
| `item.hide-jerkin` | Hide jerkin | 1 | Leather | Body | 10 | 3 × `item.hide`, 1 × `item.cord` | — | M3 |
| `item.hide-leggings` | Hide leggings | 1 | Leather | Legs | 7 | 2 × `item.hide`, 1 × `item.cord` | — | M3 |
| `item.hide-boots` | Hide boots | 1 | Leather | Feet | 4 | 1 × `item.hide`, 1 × `item.cord` | — | M3 |
| `item.boiled-cap` | Boiled leather cap | 2 | Leather | Head | 6 | 1 × `item.leather`, 1 × `item.fat` | — | M3 |
| `item.boiled-coat` | Boiled leather coat | 2 | Leather | Body | 17 | 3 × `item.leather`, 1 × `item.fat` | — | M3 |
| `item.boiled-leggings` | Boiled leather leggings | 2 | Leather | Legs | 13 | 2 × `item.leather`, 1 × `item.fat` | — | M3 |
| `item.boiled-boots` | Boiled leather boots | 2 | Leather | Feet | 6 | 1 × `item.leather`, 1 × `item.fat` | — | M3 |
| `item.studded-cap` | Studded leather cap | 3 | Leather | Head | 9 | 1 × `item.leather`, 1 × `item.steel-ingot` | — | M3 |
| `item.studded-coat` | Studded leather coat | 3 | Leather | Body | 24 | 3 × `item.leather`, 2 × `item.steel-ingot` | — | M3 |
| `item.studded-leggings` | Studded leather leggings | 3 | Leather | Legs | 18 | 2 × `item.leather`, 1 × `item.steel-ingot` | — | M3 |
| `item.studded-boots` | Studded leather boots | 3 | Leather | Feet | 9 | 1 × `item.leather`, 1 × `item.steel-ingot` | — | M3 |
| `item.scale-coif` | Scale coif | 4 | Leather | Head | 12 | 1 × `item.leather`, 1 × `item.brimsteel-ingot` | set: Fire resistance 15% | M5 |
| `item.scale-coat` | Scale coat | 4 | Leather | Body | 31 | 3 × `item.leather`, 3 × `item.brimsteel-ingot` | set: Fire resistance 15% | M5 |
| `item.scale-leggings` | Scale leggings | 4 | Leather | Legs | 23 | 2 × `item.leather`, 2 × `item.brimsteel-ingot` | set: Fire resistance 15% | M5 |
| `item.scale-boots` | Scale boots | 4 | Leather | Feet | 12 | 1 × `item.leather`, 1 × `item.brimsteel-ingot` | set: Fire resistance 15% | M5 |
| `item.lacquered-cap` | Lacquered cap | 5 | Leather | Head | 14 | 2 × `item.leather`, 1 × `item.heartroot-resin` | set: Rot resistance 25% | M6 |
| `item.lacquered-coat` | Lacquered coat | 5 | Leather | Body | 38 | 5 × `item.leather`, 2 × `item.heartroot-resin` | set: Rot resistance 25% | M6 |
| `item.lacquered-leggings` | Lacquered leggings | 5 | Leather | Legs | 29 | 3 × `item.leather`, 2 × `item.heartroot-resin` | set: Rot resistance 25% | M6 |
| `item.lacquered-boots` | Lacquered boots | 5 | Leather | Feet | 14 | 2 × `item.leather`, 1 × `item.heartroot-resin` | set: Rot resistance 25% | M6 |
| `item.silk-lined-cap` | Silk-lined cap | 6 | Leather | Head | 17 | 2 × `item.leather`, 1 × `item.moth-silk` | set: speed +5% | M7 |
| `item.silk-lined-coat` | Silk-lined coat | 6 | Leather | Body | 46 | 4 × `item.leather`, 2 × `item.moth-silk`, 1 × `item.heartroot-resin` | set: speed +5% | M7 |
| `item.silk-lined-leggings` | Silk-lined leggings | 6 | Leather | Legs | 34 | 3 × `item.leather`, 2 × `item.moth-silk` | set: speed +5% | M7 |
| `item.silk-lined-boots` | Silk-lined boots | 6 | Leather | Feet | 17 | 2 × `item.leather`, 1 × `item.moth-silk` | set: speed +5% | M7 |
| `item.ichor-cap` | Ichor-cured cap | 7 | Leather | Head | 20 | 2 × `item.leather`, 1 × `item.ichor`, 1 × `item.moth-silk` | set: regains 1% of max Health a second, even in a fight | M7 |
| `item.ichor-coat` | Ichor-cured coat | 7 | Leather | Body | 53 | 4 × `item.leather`, 2 × `item.ichor`, 2 × `item.moth-silk` | set: regains 1% of max Health a second, even in a fight | M7 |
| `item.ichor-leggings` | Ichor-cured leggings | 7 | Leather | Legs | 40 | 3 × `item.leather`, 1 × `item.ichor`, 2 × `item.moth-silk` | set: regains 1% of max Health a second, even in a fight | M7 |
| `item.ichor-boots` | Ichor-cured boots | 7 | Leather | Feet | 20 | 2 × `item.leather`, 1 × `item.ichor`, 1 × `item.moth-silk` | set: regains 1% of max Health a second, even in a fight | M7 |
| `item.fur-hat` | Fur hat | 2 | Leather | Head | 6 | 1 × `item.fur`, 1 × `item.leather` | set: **Freezing** exposure −50% | M4 |
| `item.fur-coat` | Fur coat | 2 | Leather | Body | 17 | 3 × `item.fur`, 2 × `item.leather` | set: **Freezing** exposure −50% | M4 |
| `item.fur-leggings` | Fur leggings | 2 | Leather | Legs | 13 | 2 × `item.fur`, 1 × `item.leather` | set: **Freezing** exposure −50% | M4 |
| `item.fur-boots` | Fur boots | 2 | Leather | Feet | 6 | 1 × `item.fur`, 1 × `item.leather` | set: **Freezing** exposure −50% | M4 |
| `item.fire-cloak` | Fire cloak | 3 | Cloth | Body | 12 | 3 × `item.cloth`, 2 × `item.clay` | Fire resistance 25%; **Sweltering** exposure −50%; **Burning** lasts half as long | M4 |
| `item.fume-hood` | Fume hood | 1 | Cloth | Head | 2 | 1 × `item.cloth`, 1 × `item.charcoal` | fumes and gas pockets hurt half as much | M4 |
| `item.desert-veil` | Desert veil | 1 | Cloth | Head | 2 | 1 × `item.cloth` | **Sweltering** exposure −25% | M4 |
| `item.threaded-hood` | Threaded hood | 4 | Cloth | Head | 6 | 1 × `item.cloth`, 1 × `item.moonsilver-wire` | set: Mana +10%, Mana resistance 15% | M6 |
| `item.threaded-robe` | Threaded robe | 4 | Cloth | Body | 16 | 3 × `item.cloth`, 3 × `item.moonsilver-wire` | set: Mana +10%, Mana resistance 15% | M6 |
| `item.threaded-trousers` | Threaded trousers | 4 | Cloth | Legs | 12 | 2 × `item.cloth`, 2 × `item.moonsilver-wire` | set: Mana +10%, Mana resistance 15% | M6 |
| `item.threaded-shoes` | Threaded shoes | 4 | Cloth | Feet | 6 | 1 × `item.cloth`, 1 × `item.leather`, 1 × `item.moonsilver-wire` | set: Mana +10%, Mana resistance 15% | M6 |
| `item.silk-hood` | Silk hood | 6 | Cloth | Head | 9 | 1 × `item.moth-silk`, 1 × `item.moonsilver-wire` | set: Mana +20%, skill effect +5% | M7 |
| `item.silk-robe` | Silk robe | 6 | Cloth | Body | 23 | 3 × `item.moth-silk`, 2 × `item.moonsilver-wire` | set: Mana +20%, skill effect +5% | M7 |
| `item.silk-trousers` | Silk trousers | 6 | Cloth | Legs | 17 | 2 × `item.moth-silk`, 1 × `item.moonsilver-wire` | set: Mana +20%, skill effect +5% | M7 |
| `item.silk-shoes` | Silk shoes | 6 | Cloth | Feet | 9 | 1 × `item.moth-silk`, 1 × `item.leather` | set: Mana +20%, skill effect +5% | M7 |
| `item.plain-clothes` | Plain clothes | 1 | Cloth | Body | 5 | 2 × `item.cloth` | everyday wear | M3 |
| `item.tailored-clothes` | Tailored clothes | 2 | Cloth | Body | 8 | 3 × `item.cloth`, 1 × `item.leather` | meets the Craftsman tier's need for tailored clothing | M3 |
| `item.fine-clothes` | Fine clothes | 3 | Cloth | Body | 12 | 3 × `item.cloth`, 2 × `item.fur`, 1 × `item.silver-ingot` | meets the Noble tier's need for fine clothing | M3 |
| `item.silk-finery` | Silk finery | 6 | Cloth | Body | 23 | 3 × `item.moth-silk`, 1 × `item.gold-ingot` | meets the Noble tier's need for fine clothing; morale +5 | M7 |

---

## 6. Shields

| ID | Name | Block | Weight | Ingots | Traits | Since |
|---|---|---|---|---|---|---|
| `item.buckler` | Buckler | ×0.6 | 2 kg | 1 ingot, 1 × `item.grip` | parry window 0.35 s, not 0.25 s; moves at three quarters of full speed while raised, not half | M3 |
| `item.round-shield` | Round shield | ×1.0 | 5 kg | 1 ingot, 3 × `item.planks`, 1 × `item.leather` | — | M3 |
| `item.kite-shield` | Kite shield | ×1.25 | 7 kg | 2 ingots, 4 × `item.planks`, 1 × `item.leather` | covers the front 150°, not 120° | M3 |
| `item.tower-shield` | Tower shield | ×1.6 | 12 kg | 4 ingots, 6 × `item.planks`, 2 × `item.leather` | covers the front 150°; blocked hits cost half the Stamina; speed −10% while carried | M4 |

---

## 7. Tools

### 7.1 Metal tools

| ID | Name | Use | Ingots | Traits | Since |
|---|---|---|---|---|---|
| `item.pick` | Pick | Stone, ore and rock, ×1.0 | 3 ingots, 1 × `item.haft` | hits as a sword of its tier ×0.6 | M2 |
| `item.shovel` | Shovel | Earth, sand, gravel and snow, ×1.0 | 1 ingot, 1 × `item.haft` | hits as a sword of its tier ×0.4 | M2 |
| `item.felling-axe` | Felling axe | Trees and wood, ×1.0 | 3 ingots, 1 × `item.haft` | hits as a sword of its tier ×0.6 | M2 |
| `item.hoe` | Hoe | Tilling and weeding fields, ×1.0 | 1 ingot, 1 × `item.haft` | — | M2 |
| `item.scythe` | Scythe | Reaping grain and hay, ×1.2 | 2 ingots, 1 × `item.long-haft` | two-handed | M2 |
| `item.sickle` | Sickle | Reaping and foraging, ×0.8 | 1 ingot, 1 × `item.grip` | one-handed | M2 |
| `item.rake` | Rake | Charcoal mounds, pyres and hay, ×1.0 | 1 ingot, 1 × `item.long-haft` | — | M2 |
| `item.hammer` | Hammer | Building, the anvil and sounding rock, ×1.0 | 2 ingots, 1 × `item.haft` | hits as a sword of its tier ×0.5 | M2 |
| `item.sledge` | Sledge | Splitting building stone, ×1.2 | 4 ingots, 1 × `item.long-haft` | two-handed, heavy; hits as a sword of its tier ×0.7 | M2 |
| `item.chisel` | Chisel | Dressing stone, cutting gems and crystal, ×1.0 | 1 ingot | — | M2 |
| `item.trowel` | Trowel | Laying brick and stone, ×1.0 | 1 ingot, 1 × `item.grip` | — | M2 |
| `item.saw` | Saw | Sawing timber and joinery, ×1.0 | 2 ingots, 1 × `item.grip` | — | M2 |
| `item.adze` | Adze | Shaping beams, carts and boats, ×1.0 | 2 ingots, 1 × `item.haft` | — | M2 |
| `item.knife` | Knife | Butchery, foraging, tanning and cooking, ×1.0 | 1 ingot, 1 × `item.grip` | hits as a sword of its tier ×0.4 | M2 |
| `item.shears` | Shears | Shearing and cutting cloth, ×1.0 | 1 ingot | — | M2 |
| `item.tongs` | Tongs | Smelting and the forge, ×1.0 | 2 ingots | — | M3 |
| `item.needle` | Needle | Sewing, and stitching wounds, ×1.0 | 1 ingot → 10 | — | M3 |

### 7.2 Other tools

| ID | Name | Use | Made from | Traits | Since |
|---|---|---|---|---|---|
| `item.fishing-rod` | Fishing rod | Fishing from shore or boat, ×3 | 1 × `item.long-haft`, 1 × `item.cord`, 1 × `item.bone` | — | M2 |
| `item.fishing-net` | Fishing net | Fishing from a boat or a weir, ×4 | 6 × `item.cord` | two-handed | M2 |
| `item.snare` | Snare | Taking small game on a trap line | 1 × `item.cord` | — | M3 |
| `item.jaw-trap` | Jaw trap | Taking large game on a trap line | 2 × `item.iron-ingot` | a person who steps in one is **Rooted** and **Bleeding** | M3 |
| `item.crook` | Crook | Herding and handling animals, ×3 | 1 × `item.long-haft` | — | M2 |
| `item.halter` | Halter | Leading and breaking horses, ×3 | 1 × `item.leather`, 1 × `item.cord` | — | M3 |
| `item.whip` | Whip | Driving teams and hounds, ×3 | 1 × `item.leather`, 1 × `item.grip` | — | M3 |
| `item.torch` | Torch | Light 12, carried or set on a wall, for 2 in-game hours | 1 × `item.planks`, 1 × `item.coal` → 4 | goes out in water and rain | M2 |
| `item.lantern` | Lantern | Light 14, carried or hung, for an in-game day on 1 × `item.fat` | 1 × `item.iron-ingot`, 1 × `item.glass` | — | M3 |
| `item.mana-lamp` | Mana lamp | Light 15 with no flame; a noble's luxury | 1 × `item.moonsilver-ingot`, 1 × `item.glass`, 1 × `item.cut-crystal` | draws on the mana grid, or burns 1 × `item.cut-crystal` an in-game week away from it | M6 |
| `item.rope` | Rope | Climbing, hoisting and lashing | 3 × `item.cord` | hung from a block, it climbs as a ladder | M2 |
| `item.silk-rope` | Silk rope | Ropeways across chasms | 3 × `item.moth-silk` | holds ten times the load of rope | M7 |
| `item.pack` | Pack | Carrying on the back | 2 × `item.leather`, 1 × `item.cord` | carrying +5 kg | M3 |
| `item.carrying-frame` | Carrying frame | A porter's loads | 2 × `item.haft`, 1 × `item.cord` | carrying +10 kg; speed −5% | M2 |
| `item.handcart` | Handcart | Hauling 150 kg at walking pace, pushed by one person | 4 × `item.planks`, 1 × `item.haft`, 1 × `item.bog-iron-ingot` | — | M2 |
| `item.cart` | Cart | Hauling 600 kg: 2.5 m/s on roads, 1 m/s off them | 10 × `item.planks`, 2 × `item.iron-ingot` | drawn by an ox, a mule or a horse | M3 |
| `item.wagon` | Wagon | Hauling 1,500 kg at 2.5 m/s on roads | 20 × `item.planks`, 4 × `item.iron-ingot` | drawn by two draught horses | M3 |
| `item.riverboat` | Riverboat | Hauling 3 t at 2–3 m/s on water | 30 × `item.planks`, 2 × `item.pitch`, 2 × `item.cloth` | needs docks | M3 |
| `item.barge` | Barge | Hauling 10 t at 2 m/s on water | 50 × `item.planks`, 10 × `item.ironwood`, 4 × `item.pitch` | needs docks | M3 |
| `item.sled` | Sled | Hauling 400 kg over snow and ice | 6 × `item.planks`, 1 × `item.iron-ingot` | drawn by a team of four sled dogs | M4 |
| `item.spyglass` | Spyglass | Seeing far: sight ×2 in a 20° cone while raised | 2 × `item.lens`, 1 × `item.iron-ingot` | — | M4 |
| `item.signal-horn` | Signal horn | Raising alarms heard 200 m off | 1 × `item.horn` | — | M4 |
| `item.signal-mirror` | Signal mirror | Flashing signals by day | 1 × `item.glass`, 1 × `item.silver-ingot` | — | M4 |
| `item.banner` | Banner | A company's colours | 2 × `item.cloth`, 1 × `item.long-haft` | planted, it is a **ward** for the Guard role (13 §12) | M4 |
| `item.censer` | Censer | The Hearth's rites, ×3 | 1 × `item.iron-ingot`, 1 × `item.cord` | — | M3 |

---

## 8. Charms

| ID | Name | Effect | Made from | Made at | Tooltip | Since |
|---|---|---|---|---|---|---|
| `item.knee-pads` | Miner's knee pads | Mining work speed +10% | 2 × `item.leather`, 1 × `item.padding` | tailor's table | Breaks rock and ore faster · mining only | M3 |
| `item.fellers-gloves` | Feller's gloves | Woodcutting work speed +10% | 2 × `item.leather` | tailor's table | Fells and splits timber faster · woodcutting only | M3 |
| `item.reapers-wristband` | Reaper's wristband | Farming work speed +10% | 1 × `item.leather`, 1 × `item.cord` | tailor's table | Sows and reaps faster · farming only | M3 |
| `item.silver-thimble` | Silver thimble | Tailoring work speed +10% | 1 × `item.silver-ingot` | anvil | Spins, weaves, tans and sews faster · tailoring only | M3 |
| `item.spice-pouch` | Spice pouch | Cooking work speed +5%; the meals and drinks they make work 5% better | 1 × `item.leather`, 2 × `item.herbs` | tailor's table | Cooks faster, and better · cooking only | M3 |
| `item.tumpline` | Tumpline | Carrying +10% | 2 × `item.cord` | anywhere, by hand | Carries more on the head and back · weight, not speed | M2 |
| `item.silver-spurs` | Silver spurs | Mounted speed +10% | 1 × `item.silver-ingot`, 1 × `item.leather` | anvil | Rides faster · only in the saddle | M3 |
| `item.game-call` | Game call | Fieldcraft work speed +5%; **Reveal** game within 8 m | 1 × `item.horn` | carpenter's bench | Draws game in and finds it in cover · beasts only, 8 m | M3 |
| `item.spectacles` | Spectacles | Letters and alchemy work speed +5% each | 2 × `item.lens`, 1 × `item.silver-ingot` | glassworks | Reads, writes and measures faster · close work only | M3 |
| `item.chirurgeons-loupe` | Chirurgeon's loupe | Healing given +10% | 1 × `item.lens`, 1 × `item.iron-ingot` | glassworks | Every treatment heals more · healing given only | M3 |
| `item.prospectors-loupe` | Prospector's loupe | **Reveal** ore within 8 m | 1 × `item.lens`, 1 × `item.silver-ingot` | glassworks | Shows ore through the rock close by · 8 m | M3 |
| `item.merchants-scales` | Merchant's scales | Buys 5% cheaper and sells 5% dearer | 1 × `item.silver-ingot`, 1 × `item.planks` | anvil | Gets a better price both ways · their own trades only | M3 |
| `item.signet-ring` | Signet ring | The radius of their rank or post +10% (13 §13) | 1 × `item.gold-ingot` | anvil | Carries an officer's or a foreman's word farther · radius only | M3 |
| `item.hearth-token` | Hearth token | Morale +10 | 1 × `item.bone`, 1 × `item.charcoal`, blessed by a Hearthkeeper | hearth-shrine | Steadies the wearer through fear and loss · morale only | M3 |
| `item.archers-bracer` | Archer's bracer | Damage +10% with bows | 1 × `item.leather` | tannery | Cleaner, harder shots · bows only | M4 |
| `item.thumb-ring` | Thumb ring | Bow draw time −10% | 1 × `item.horn` | carpenter's bench | Draws faster · bows only | M4 |
| `item.shield-strap` | Shield strap | Block +10% | 1 × `item.leather`, 1 × `item.iron-ingot` | tannery | Holds the shield steadier · shields only | M4 |
| `item.titan-torc` | Titan-bone torc | Health +10% | 1 × `item.titan-bone` | carpenter's bench | Toughens the wearer · max Health only | M4 |
| `item.gilded-torc` | Gilded torc | **Resolve** gained +10% | 1 × `item.gold-ingot` | anvil | Fills the Ultimate faster · Resolve only | M4 |
| `item.ember-pouch` | Ember pouch | **Freezing** exposure −50%; burns 1 × `item.charcoal` an in-game day | 1 × `item.leather`, 1 × `item.clay-pot` | tannery | Keeps the wearer warm · needs charcoal each day | M4 |
| `item.waterskin` | Waterskin | **Sweltering** exposure −50%; needs filling with water each in-game day | 2 × `item.hide` | tannery | Keeps the wearer cool · needs water each day | M4 |
| `item.obsidian-earring` | Obsidian earring | Damage +10% with Blade weapons | 1 × `item.obsidian`, 1 × `item.silver-ingot` | mason's yard | Sharper blows with every blade · Blade weapons only | M5 |
| `item.skystone-pendant` | Skystone pendant | Falls hurt only beyond 6 m, not 3 m | 1 × `item.skystone`, 1 × `item.cord` | lapidary's bench | Softens long falls · falls only | M6 |
| `item.ward-amulet` | Ward amulet | **Hollowing** doesn't rise; uses 1 × `item.cut-crystal` an in-game day | 1 × `item.moonsilver-ingot`, 1 × `item.cut-crystal` | enchanting altar | Shields the wearer from raw mana · a cut crystal each day | M6 |
| `item.ascent-ward` | Ascent ward | **Ascent sickness** as if climbing out of the layer above (`02-world.md` §3) | 1 × `item.moonsilver-ingot`, 1 × `item.pure-crystal` | enchanting altar | Eases the climb out of the deep · one layer's worth | M6 |
| `item.storm-ward` | Storm ward | Unharmed by mana storms | 1 × `item.moonsilver-ingot`, 1 × `item.fused-glass` | enchanting altar | Turns mana storms aside · storms only | M6 |
| `item.glowcap-phial` | Glowcap phial | Sheds light of level 8 around the wearer; fades after an in-game week | 1 × `item.glass`, 2 × `item.glowcap` | alchemy table | Lights the way and leaves both hands free · fades within a week | M6 |
| `item.herb-mask` | Herb mask | Spores, disease and miasma act at half strength | 1 × `item.cloth`, 2 × `item.herbs`, 1 × `item.fen-reagents` | alchemy table | Filters spores and foul air · fresh herbs each week | M6 |
| `item.rime-token` | Rime token | Cold resistance 25% | 1 × `item.rime-ore`, 1 × `item.silver-ingot` | anvil | Turns aside frost · Cold only | M6 |
| `item.fireclay-token` | Fireclay token | Fire resistance 25% | 1 × `item.fireclay`, 1 × `item.silver-ingot` | kiln | Turns aside flame · Fire only | M6 |
| `item.storm-bead` | Storm bead | Storm resistance 25% | 1 × `item.fused-glass`, 1 × `item.cord` | lapidary's bench | Grounds lightning · Storm only | M6 |
| `item.resin-token` | Resin token | Rot resistance 25% | 1 × `item.heartroot-resin`, 1 × `item.silver-ingot` | alchemy table | Turns aside rot and blight · Rot only | M6 |
| `item.moonsilver-token` | Moonsilver token | Mana resistance 25% | 1 × `item.moonsilver-ingot` | anvil | Turns aside raw mana · Mana only | M6 |
| `item.pearl-circlet` | Pearl circlet | Control effects on the wearer last 10% less; morale +5 | 2 × `item.deep-pearl`, 1 × `item.silver-ingot` | anvil | Keeps a clear head under stuns and fear · control effects only | M6 |
| `item.marrow-phial` | Marrow phial | Healing received +15% | 1 × `item.titan-marrow`, 1 × `item.glass` | alchemy table | Makes every heal go further · heals received only | M6 |
| `item.stone-ward` | Stone ward | Can't be turned to stone in Sekitei | 1 × `item.moonsilver-ingot`, 1 × `item.living-stone` | enchanting altar | Wards off the slow turn to stone · Sekitei only | M7 |
| `item.lodestone-ring` | Lodestone ring | Ranged spread −15% | 1 × `item.lodestone`, 1 × `item.silver-ingot` | anvil | Steadies every shot · ranged only | M7 |
| `item.soulglass-bead` | Soulglass bead | Mana +15% | 1 × `item.soulglass`, 1 × `item.moth-silk` | enchanting altar | Holds a deeper well of Mana · max Mana only | M7 |
| `item.ichor-phial` | Ichor phial | Damage +15% (increased); healing received −50% | 1 × `item.ichor`, 1 × `item.glass` | alchemy table | Hits much harder · heals at half the rate | M7 |
| `item.demonsteel-ring` | Demonsteel ring | Armour +15% | 1 × `item.demonsteel-ingot` | anvil | Hardens everything worn · armour only | M7 |

---

## 9. Relics

### 9.1 Tier I relics

| ID | Name | Warden | Tier | Power | Hunger | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.burnt-standard` | The Burnt Standard | Marshal Varn | I | Passive: allies within 24 m have morale +10 and lose no loyalty from a fight they lose. Active, 180 s: planted, for 20 s every ally within 24 m is **Inspired** and can't be **Feared**. | — | Steadies allies close by and, planted, inspires them all · 24 m | M4 |
| `item.heart-of-rime` | Heart of Rime | Shimotsuki | I | Passive: Cold resistance 50%; never **Freezing**. Active, 180 s: 400% of a hit as Cold on one target within 12 m, which is **Chilled** three times over and so **Frozen**. Bends `05-systems.md` §16 (exposure). | — | Freezes one foe solid and keeps the cold off its bearer · 12 m | M7 |
| `item.mountains-core` | The Mountain's Core | Iwakura | I | Passive: armour +15%; can't be **Staggered**. Active, 180 s: a stamp that shakes the ground: 200% of a hit to every foe within 6 m, each **Staggered**. | — | Stands like rock and stamps the ground to stagger all around · 6 m | M7 |
| `item.gilded-seal` | The Gilded Seal | Satrap Ozrem | I | Passive: while its bearer is in the capital, the mint strikes 25% more coin from each ingot. Active, 180 s: every ally within 12 m is **Shielded** for ◆300 for 15 s. Bends `05-systems.md` §11 (coin per ingot). | — | Mints more coin at home and gilds allies against blows · 12 m | M7 |
| `item.grave-iron-crown` | Grave-Iron Crown | The Gravewarden | I | Passive: nothing of the Deep can raise the dead within 32 m of its bearer. Active, 180 s: every **Downed** ally within 16 m rises at once with 20% Health, **Wounded**. Bends 13 §5.9 (revive). | — | Raises the fallen around it and keeps the dead from rising · 16 m | M7 |
| `item.green-heart` | Green Heart | Vhessa | I | Passive: its bearer regains Health in a fight as it would out of one. Active, 180 s: plants a thicket 6 m across for 20 s: allies inside are **Mending** ◆400, and foes who enter it are **Rooted**. Bends 13 §4.2 (Health regained). | — | Plants a thicket that mends allies and snares foes · 6 m, 20 s | M7 |
| `item.drowned-censer` | The Drowned Censer | The Drowned Abbot | I | Passive: Rot resistance 50%. Active, 180 s: a cloud of rot 6 m across for 10 s: foes inside are **Poisoned** by 200% of a hit and **Silenced**. | — | Swings a cloud of rot that poisons and silences foes · 6 m, 10 s | M7 |
| `item.leviathan-scale` | Leviathan Scale | The Leviathan of the Mere | I | Passive: its bearer breathes underwater and swims as fast as it walks. Active, 180 s: an undertow drags every foe within 6 m to its bearer: 200% of a hit, and **Slowed**. Bends 13 §3.2 (swimming). | — | Drags nearby foes in and swims like a fish · 6 m | M7 |

### 9.2 Tier II relics

| ID | Name | Warden | Tier | Power | Hunger | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.unlit-lantern` | The Unlit Lantern | Akari | II | Passive: sight 48 m at night and underground. Active, 180 s: snuffs every light within 16 m for 15 s; foes inside are **Blinded**, and its bearer's hits on them are ×1.25 more. | — | Puts out the lights around it and strikes harder in the dark · 16 m | M6 |
| `item.thorn-crown` | Thorn Crown | Gōka | II | Passive: Fire resistance 50%; foes who strike its bearer in melee take 15% of their hit back as Fire. Active, 180 s: thorns burst under one target within 16 m: 600% of a hit, **Rooted** and **Bleeding**. | — | Bursts thorns under one foe and pricks all who strike its bearer · 16 m | M6 |
| `item.resonant-core` | Resonant Core | Hibiki | II | Passive: Mana +25%; Mana refills at 3 a second anywhere, as beside a source. Active, 180 s: a ringing note: 600% of a hit as Mana on one target within 24 m, which is **Silenced**. | — | Rings one foe silent and keeps its bearer's Mana full · 24 m | M6 |
| `item.stormwrights-compass` | Stormwright's Compass | Admiral Kest | II | Passive: Storm resistance 50%; a **Survey** of everything within 64 m as its bearer travels. Active, 180 s: a gale 24 m long: 300% of a hit as Storm to every foe in it, each pushed back 8 m and **Staggered**. | — | Maps the land as it goes and drives foes back with a gale · 24 m | M6 |

### 9.3 Tier III relics

| ID | Name | Warden | Tier | Power | Hunger | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.severins-keys` | Severin's Keys | Severin | III | Opens the gates of the Nadir Stair. Passive: buildings its kingdom holds within 32 m of its bearer take 50% less **siege** damage. Active, 180 s: bars every door, gate and hatch within 32 m against foes for 30 s, and allies within 16 m are **Fortified** for 15 s. | — | Opens the Stair's gates and bars every other gate against foes · 32 m | M7 |
| `item.bloom-heart` | Bloom Heart | The Bloom | III | Passive: can't be **Poisoned**. Active, 180 s: a burst of spores 8 m round: 450% of a hit as Rot to every foe, each **Poisoned**; allies inside are **Mending** ◆600. | — | Bursts with spores that poison foes and mend allies · 8 m | M6 |
| `item.heartroot-crown` | Heartroot Crown | The Rootbound King | III | Passive: never **Rooted** or **Slowed**; regains 1% of max Health a second while standing on soil or root. Active, 180 s: roots seize every foe within 8 m: **Rooted** for 3 s, and 450% of a hit over that time. | — | Calls up roots that seize and crush the foes around it · 8 m | M6 |
| `item.choir-stone` | Choir Stone | The Blind Choir | III | Passive: **Reveal** every creature within 24 m through rock, by its sound. Active, 180 s: a note that shakes stone: 450% of a hit to every foe within 10 m, each **Feared** for 2 s. | — | Hears every creature in the rock around it and sings foes to flight · 10 m | M6 |
| `item.overseers-ledger` | Overseer's Ledger | Foreman Gall | III | Passive: work within 64 m of its bearer runs 15% faster, and buildings there decay half as fast. Active, 180 s: for 60 s, work within 64 m runs 50% faster. | — | Drives every crew around it harder and keeps their works sound · 64 m | M6 |
| `item.rime-fang` | Rime Fang | Tsurara | III | Passive: Cold resistance 50%; full swings leave **Chilled**. Active, 180 s: a bite of 900% of a hit on one target within 4 m, armour-piercing 50%, which is **Chilled** twice. | — | Bites one foe to the bone and chills all it strikes · 4 m | M6 |
| `item.slag-womb` | Slag Womb | The Slagmother | III | Passive: Fire resistance 75%; never **Sweltering**. Active, 180 s: pours slag 8 m across for 10 s: foes inside take 450% of a hit as Fire over that time, **Burning** and **Slowed**. | — | Floods the ground with slag and walks through heat unharmed · 8 m, 10 s | M6 |
| `item.mirror-of-returning` | Mirror of Returning | Utsusemi | III | Passive: once an in-game day, a blow that would leave its bearer **Downed** leaves it at 1 Health and **Shielded** for ◆1,000 instead. Active, 180 s: for 4 s every hit on its bearer is turned back on the attacker in full, and its bearer takes none of it. Bends 13 §5.9 (Downed). | — | Turns blows back on those who strike, and cheats death once a day · 4 s | M6 |
| `item.marrow-cask` | Titan's Marrow Cask | The Marrow Titan | III | Passive: Health +15%. Active, 180 s: a draught from the cask: regains 50% of max Health and all Stamina, and is **Fortified** for 15 s. | — | Restores half its bearer's Health at a draught and hardens it · self only | M6 |

### 9.4 Tier IV relics

| ID | Name | Warden | Tier | Power | Hunger | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.sovereigns-silk` | Sovereign's Silk | Noctua | IV | Passive: its bearer takes no fall damage, and has speed +10% where the light is under 7. Active, 180 s: a cloud of moth-dust 10 m across for 10 s: lights inside go out, and foes inside are **Blinded** and take 675% of a hit over that time. Bends 13 §3.2 (falls). | — | Smothers the light in choking dust and fears no fall · 10 m, 10 s | M7 |
| `item.shear-crest` | Shear Crest | The Shear Matriarch | IV | Passive: its bearer climbs sheer rock as if it were a ladder. Active, 180 s: sets the swarm on every foe within 10 m: 675% of a hit over 5 s, and **Exposed**. Bends 13 §3.2 (climbing). | — | Climbs any cliff and sets a swarm on the foes around it · 10 m | M7 |
| `item.gardeners-eye` | Gardener's Eye | The Gardener | IV | Passive: **Read** the grade, Health and armour of every foe within 48 m; can't be turned to stone. Active, 180 s: turns one target within 16 m to stone: 1,350% of a hit, and **Stunned** for 2 s. | — | Reads every foe in sight and turns one to stone · 16 m | M7 |
| `item.regents-codex` | Regent's Codex | The Undervault Regent | IV | Passive: **Reveal** traps, hidden doors and buried rooms within 32 m; machines within 64 m of its bearer run 25% faster. Active, 180 s: one construct, engine or machine within 24 m stops dead for 10 s and takes 1,350% of a hit as **siege**. | — | Reads the Old Crown's works and stops any one of them dead · 24 m | M7 |
| `item.stilled-current` | The Stilled Current | The Current | IV | Passive: skills cost 25% less Mana; Mana refills at 3 a second anywhere. Active, 180 s: stills every foe within 10 m: **Rooted** and **Silenced**, and 675% of a hit as Mana. | — | Stills everything around it and spends Mana sparingly · 10 m | M7 |

### 9.5 Tier V relics

| ID | Name | Warden | Tier | Power | Hunger | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.ichor-heart` | Ichor Heart | The Maw That Feeds | V | Binding it makes a Paragon a Calamity (13 §15.3). **Flame** 20,000, refilled by feeding its **hunger**: 20% of the max Health of each foe its bearer kills. Passive: its bearer's hits heal it for 5% of their damage, into **Flame** once Health is full. Active, 180 s: devours one target within 4 m: 2,000% of a hit; a kill refills 10% of max **Flame**. | Each in-game day: foes with 20,000 max Health in all slain by its bearer, or 10 × `item.ichor` burned at a hearth-shrine | Feeds on what it kills and heals as it strikes · must kill or drink ichor each day | M7 |
| `item.ashen-veil` | Ashen Veil | Yomotsu | V | Binding it makes a Paragon a Calamity (13 §15.3). **Flame** 12,000, refilled by feeding its **hunger**: 400 for each death within 32 m of its bearer, and 400 for each body burned on a pyre within 64 m. Passive: a veil of ash 8 m round its bearer: foes inside are **Blinded** and **Slowed**. Active, 180 s: ashfall 12 m round for 5 s: 1,000% of a hit to every foe inside. | Each in-game day: 20 of the dead burned on pyres within 64 m of its bearer, or 4 × `item.soulglass` shattered | Wraps its bearer in blinding ash and drinks the deaths around it · 8 m | M7 |
| `item.war-smiths-hammer` | The War-Smith's Hammer | Vorgrim | V | Binding it makes a Paragon a Calamity (13 §15.3). **Flame** 25,000, refilled by feeding its **hunger**: 250 × the tier of each ingot fed to it at an anvil, so none away from one. Passive: every weapon, armour and shield its bearer forges comes out at quality 100. Active, 180 s: 2,000% of a hit on one target within 4 m, **crushing**, which is **Stunned** for 2 s; every block within 4 m takes the blow as **siege**. Bends 15 §1.7 (quality). | Each in-game day: 20 ingots of tier 3 or better fed to it at an anvil | Forges flawless arms and breaks whatever it strikes · eats 20 good ingots a day | M7 |

### 9.6 The Broken Crown

| ID | Name | Warden | Tier | Power | Hunger | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.broken-crown` | The Broken Crown | — | — | Worn by a Paragon, it makes them a Calamity at their current level (13 §15.3). **Flame** 15,000, refilled by 5% of the damage its bearer deals; no upkeep. Its bearer always shows on every king's map, and every faction of the Deep knows where it is. Taken off, it leaves a Paragon again. Active, 180 s: every ally within 32 m is **Inspired** and **Fortified** for 10 s. | — | Makes its wearer a Calamity, seen by every king · falls where its wearer dies | M7 |

---

## 10. Meals

| ID | Name | Effect | Lasts | Made from | Made at | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.porridge` | Porridge | **Well fed**: Stamina +5% | 6 in-game hours | 1 × `item.grain`, water | kitchen | Fills the belly cheaply · a plain meal | M2 |
| `item.roast-meat` | Roast meat | **Well fed**: Health +5% | 6 in-game hours | 1 × `item.meat` | kitchen | Meat over the fire · spoils within two days | M2 |
| `item.grilled-fish` | Grilled fish | **Well fed**: Stamina refills 10% faster | 6 in-game hours | 1 × `item.fish` | kitchen | Fresh fish, quickly cooked · spoils within a day | M2 |
| `item.pottage` | Pottage | **Well fed**: work speed +5% | 6 in-game hours | 1 × `item.vegetables`, 1 × `item.grain` | kitchen | A thick pot of whatever the fields gave · a plain meal | M2 |
| `item.bread` | Bread | **Well fed**: work speed +5% | 8 in-game hours | 1 × `item.flour`, water and fuel | bakery | The day's loaf · keeps a few days | M3 |
| `item.meat-stew` | Meat stew | **Well fed**: Health +10% | 8 in-game hours | 1 × `item.meat`, 1 × `item.vegetables`, 1 × `item.salt` | kitchen | A hearty stew that builds strength · max Health only | M3 |
| `item.fish-stew` | Fish stew | **Well fed**: Stamina +10% | 8 in-game hours | 1 × `item.fish`, 1 × `item.vegetables`, 1 × `item.salt` | kitchen | A stew that keeps a worker going · max Stamina only | M3 |
| `item.meat-pie` | Meat pie | **Well fed**: Health +5%, work speed +5% | 8 in-game hours | 1 × `item.flour`, 1 × `item.meat`, 1 × `item.fat` | bakery | A pie to carry to the workplace · keeps a few days | M3 |
| `item.cheese` | Cheese | **Well fed**: Health +5% | 6 in-game hours | 2 × `item.milk`, 1 × `item.salt` | kitchen | Milk made to keep · keeps a season | M3 |
| `item.fruit-tart` | Fruit tart | **Well fed**: morale +5, work speed +5% | 8 in-game hours | 1 × `item.flour`, 2 × `item.fruit`, 1 × `item.fat` | bakery | A sweet that lifts the day · spoils within two days | M3 |
| `item.bone-broth` | Bone broth | **Well fed**: Health regained +10% | 8 in-game hours | 2 × `item.bone`, 1 × `item.vegetables` | kitchen | A slow broth that helps wounds close · regained Health only | M3 |
| `item.scholars-supper` | Scholar's supper | **Well fed**: experience and proficiency gained +10% | 8 in-game hours | 1 × `item.fish`, 1 × `item.bread`, 1 × `item.herbs` | kitchen | Sharpens the mind for study and practice · learning only | M3 |
| `item.salt-fish` | Salt fish | **Well fed**: Stamina refills 10% faster | 6 in-game hours | 2 × `item.fish`, 1 × `item.salt` | smokehouse | Fish that keeps ten times as long · a plain meal | M3 |
| `item.smoked-meat` | Smoked meat | **Well fed**: Health +5% | 6 in-game hours | 2 × `item.meat`, 1 × `item.timber` | smokehouse | Meat that keeps ten times as long · a plain meal | M3 |
| `item.hardtack` | Hardtack | **Well fed**: no bonus | 4 in-game hours | 2 × `item.flour`, 1 × `item.salt` | bakery | Feeds an army on the march · keeps a season | M3 |
| `item.spiced-roast` | Spiced roast | **Well fed**: Health +10%, Stamina +5% | 10 in-game hours | 2 × `item.meat`, 1 × `item.herbs`, 1 × `item.salt` | kitchen | A noble's roast · counts as fine food | M3 |
| `item.feast-platter` | Feast platter | **Well fed**: Health +10%, Stamina +10%, morale +10 | 12 in-game hours | 1 × `item.spiced-roast`, 1 × `item.bread`, 1 × `item.cheese`, 1 × `item.fruit` | kitchen | A noble table's whole spread · feeds one diner | M3 |
| `item.field-ration` | Field ration | **Well fed**: Stamina +10%, Health +5% | 8 in-game hours | 1 × `item.hardtack`, 1 × `item.smoked-meat`, 1 × `item.cheese` | kitchen | A soldier's day in one bundle · keeps a season | M4 |
| `item.pemmican` | Pemmican | **Well fed**: **Freezing** exposure −25% | 12 in-game hours | 2 × `item.meat`, 1 × `item.fat`, 1 × `item.fruit` | smokehouse | Fat and dried meat against the cold · keeps a season | M4 |
| `item.salt-flatbread` | Salt flatbread | **Well fed**: **Sweltering** exposure −25% | 8 in-game hours | 1 × `item.flour`, 1 × `item.salt` | bakery | Desert bread that keeps the body's salt · keeps a week | M4 |
| `item.fungus-stew` | Fungus stew | **Well fed**: Health regained +10%, Stamina +5% | 8 in-game hours | 2 × `item.fungi`, 1 × `item.salt` | kitchen | Food grown without sun · a deep crew's meal | M6 |
| `item.fungus-bread` | Fungus bread | **Well fed**: work speed +5% | 8 in-game hours | 2 × `item.fungi`, 1 × `item.flour` | bakery | A loaf for the deep · keeps a season | M6 |
| `item.glowcap-broth` | Glowcap broth | **Well fed**: sight 24 m at night and underground, not 16 m | 6 in-game hours | 2 × `item.glowcap`, 1 × `item.bone` | kitchen | Lets the eyes drink the dark · sight only | M6 |
| `item.marrow-soup` | Marrow soup | **Well fed**: Health +15% | 12 in-game hours | 1 × `item.titan-marrow`, 2 × `item.bone`, 1 × `item.vegetables` | kitchen | The richest meal in Kaldmark · costs a share of titan marrow | M6 |

---

## 11. Drinks

| ID | Name | Effect | Lasts | Made from | Made at | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.small-beer` | Small beer | **Merry**: morale +5 | 4 in-game hours | 1 × `item.grain`, water | brewhouse | A weak, safe drink for the working day · no cost to the aim | M3 |
| `item.ale` | Ale | **Merry**: morale +10, Stamina +5%; ranged spread +10% | 6 in-game hours | 2 × `item.grain`, 1 × `item.herbs` | brewhouse | The craftsman's drink · loosens the aim | M3 |
| `item.fruit-wine` | Fruit wine | **Merry**: morale +10, **Resolve** gained +5%; ranged spread +10% | 6 in-game hours | 3 × `item.fruit` | brewhouse | Wine from the orchards, fit for a noble · loosens the aim | M3 |
| `item.grain-spirit` | Grain spirit | **Merry**: morale +15, **Freezing** exposure −25%; ranged spread +20% | 6 in-game hours | 3 × `item.grain`, 1 × `item.charcoal` | brewhouse | Strong drink that warms the blood · ruins the aim | M3 |
| `item.spiced-wine` | Spiced wine | **Merry**: morale +15, Health +5%; ranged spread +10% | 8 in-game hours | 1 × `item.fruit-wine`, 1 × `item.herbs` | brewhouse | Mulled wine for a noble's table · loosens the aim | M3 |
| `item.herb-tea` | Herb tea | **Merry**: Stamina refills 10% faster | 4 in-game hours | 1 × `item.herbs`, water | kitchen | A clear head and a steady hand · no cost to the aim | M3 |
| `item.sour-milk` | Sour milk | **Merry**: morale +5, Stamina +5% | 4 in-game hours | 2 × `item.milk` | kitchen | The herders' drink · no cost to the aim | M3 |
| `item.festival-ale` | Festival ale | **Merry**: morale +20; ranged spread +20% | 8 in-game hours | 2 × `item.ale`, 1 × `item.fruit` | brewhouse | Strong ale for feast days · ruins the aim | M3 |
| `item.fen-bitters` | Fen bitters | **Merry**: **Poisoned** lasts half as long; ranged spread +10% | 6 in-game hours | 1 × `item.fen-reagents`, 1 × `item.grain-spirit` | alchemy table | A bitter dram against bad water and venom · loosens the aim | M4 |
| `item.glowcap-liquor` | Glowcap liquor | **Merry**: morale +10, sight 24 m at night and underground; ranged spread +10% | 6 in-game hours | 2 × `item.glowcap`, 1 × `item.grain-spirit` | brewhouse | A pale spirit that brightens the dark · loosens the aim | M6 |
| `item.pearl-cordial` | Pearl cordial | **Merry**: morale +15, control effects on the drinker last 10% less; ranged spread +10% | 8 in-game hours | 1 × `item.deep-pearl`, 1 × `item.fruit-wine` | alchemy table | Crushed pearl in wine, a noble's luxury · loosens the aim | M6 |

---

## 12. Medicine

| ID | Name | Effect | Lasts | Made from | Made at | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.bandage` | Bandage | Ends **Bleeding**; **Mending** 10% of max Health over 10 s | 10 s | 2 × `item.cord` | infirmary | Stops the bleeding and dresses the wound · a small heal | M2 |
| `item.splint` | Splint | Halves the speed loss of **Wounded** until it is treated | until treated | 1 × `item.planks`, 1 × `item.cord` | infirmary | Lets the wounded walk better · speed only | M2 |
| `item.herb-salve` | Herb salve | **Mending** 20% of max Health over 20 s | 20 s | 2 × `item.herbs`, 1 × `item.fat` | apothecary | Soothes and closes wounds · slowly | M3 |
| `item.antidote` | Antidote | Ends **Poisoned** | at once | 2 × `item.herbs`, 1 × `item.fen-reagents` | apothecary | Clears venom and poison · nothing else | M3 |
| `item.field-kit` | Field kit | Treating the **Wounded** with it takes 30 s, not 60 s | 5 uses | 2 × `item.bandage`, 1 × `item.splint`, 1 × `item.needle.t*` | infirmary | Speeds a physician's work on the wounded · five patients | M3 |
| `item.healing-draught` | Healing draught | Regains 30% of max Health at once | at once | 2 × `item.herbs`, 1 × `item.fen-reagents`, 1 × `item.glass` | alchemy table | Heals a deep wound in one swallow · 30% of max Health | M4 |
| `item.burn-salve` | Burn salve | Ends **Burning**; Fire resistance 25% | 60 s | 1 × `item.fat`, 1 × `item.herbs`, 1 × `item.clay` | apothecary | Takes the fire out of a burn and guards against the next · a minute | M4 |
| `item.warming-draught` | Warming draught | **Freezing** does nothing | 2 in-game hours | 1 × `item.grain-spirit`, 1 × `item.herbs` | apothecary | Holds off the cold for a while · two in-game hours | M4 |
| `item.cooling-draught` | Cooling draught | **Sweltering** does nothing | 2 in-game hours | 1 × `item.herbs`, 1 × `item.salt` | apothecary | Holds off the heat for a while · two in-game hours | M4 |
| `item.smelling-salts` | Smelling salts | Ends **Feared** and **Stunned**; given by another person | at once | 1 × `item.salt`, 1 × `item.fen-reagents` | apothecary | Snaps a stunned or terrified ally back · used on another | M4 |
| `item.eye-wash` | Eye wash | Ends **Blinded** | at once | 1 × `item.herbs`, 1 × `item.salt` | apothecary | Clears the eyes · nothing else | M4 |
| `item.restorative` | Restorative | Ends **Exhausted**; Stamina refills 25% faster | 60 s | 1 × `item.herbs`, 1 × `item.fruit`, 1 × `item.salt` | apothecary | A second wind · a minute | M4 |
| `item.calming-draught` | Calming draught | **Mana burn** falls 1 a second | 60 s | 1 × `item.herbs`, 1 × `item.cut-crystal` | alchemy table | Draws off overdrawn Mana · a minute | M6 |
| `item.purging-draught` | Purging draught | **Hollowing** −20 | at once | 2 × `item.herbs`, 1 × `item.heartroot-resin` | alchemy table | Purges raw mana from the body · twenty points | M6 |
| `item.ascent-draught` | Ascent draught | **Ascent sickness** ends in half the time | at once | 1 × `item.pure-crystal`, 2 × `item.herbs` | alchemy table | Shortens the sickness of the climb · half the time | M6 |
| `item.marrow-tincture` | Marrow tincture | **Mending** 60% of max Health over 30 s | 30 s | 1 × `item.titan-marrow`, 1 × `item.herb-salve` | alchemy table | Mends grave wounds over half a minute · costly | M6 |
| `item.ichor-draught` | Ichor draught | **Mending** 100% of max Health over 10 s; **Mana burn** +20 | 10 s | 1 × `item.ichor`, 1 × `item.glass` | alchemy table | Heals anything, and burns the drinker · 20 Mana burn | M7 |

---

## 13. Oils, powders and bombs

| ID | Name | Effect | Lasts | Made from | Made at | Tooltip | Since |
|---|---|---|---|---|---|---|---|
| `item.whetting-oil` | Whetting oil | Blade hits +5% damage | 50 hits | 1 × `item.fat`, 1 × `item.stone` | apothecary | Keeps an edge keen · Blade weapons only | M3 |
| `item.fen-venom` | Fen venom | Hits apply **Poisoned** | 20 hits | 2 × `item.fen-reagents`, 1 × `item.fat` | alchemy table | Coats a weapon in venom · twenty hits | M4 |
| `item.pitch-oil` | Pitch oil | Hits apply **Burning** | 10 hits | 1 × `item.pitch`, 1 × `item.fat` | alchemy table | Sets a weapon alight · ten hits | M4 |
| `item.bog-tar` | Bog tar | Hits apply **Slowed** | 20 hits | 1 × `item.peat`, 1 × `item.pitch` | alchemy table | Clinging tar that drags at the limbs · twenty hits | M4 |
| `item.marking-dye` | Marking dye | Hits apply **Marked** | 10 hits | 1 × `item.herbs`, 1 × `item.fat`, 1 × `item.fen-reagents` | alchemy table | Stains the struck for every attacker to see · ten hits | M4 |
| `item.grave-oil` | Grave oil | Hits on the risen and the dead +20% damage | 30 hits | 2 × `item.bone`, 1 × `item.salt` | alchemy table | Salt and bone-ash against the restless dead · the dead only | M4 |
| `item.brimstone-oil` | Brimstone oil | 10% of each hit added as Fire; hits apply **Burning** | 20 hits | 1 × `item.brimstone`, 1 × `item.fat` | alchemy table | Coats a weapon in fire from the deep · twenty hits | M5 |
| `item.rime-oil` | Rime oil | Hits apply **Chilled** | 20 hits | 1 × `item.rime-ore`, 1 × `item.fat` | alchemy table | Frosts a weapon to chill what it strikes · twenty hits | M6 |
| `item.mana-oil` | Mana oil | 10% of each hit added as Mana; hits apply **Silenced** | 20 hits | 1 × `item.cut-crystal`, 1 × `item.fat` | alchemy table | Charges a weapon with Mana · twenty hits | M6 |
| `item.ichor-oil` | Ichor oil | 5% of each hit is **true** damage; hits apply **Exposed** | 20 hits | 1 × `item.ichor`, 1 × `item.fat` | alchemy table | Eats through armour and flesh alike · twenty hits | M7 |
| `item.lime-powder` | Lime powder | Thrown: **Blinded** within 3 m | 4 s | 1 × `item.quicklime`, 1 × `item.clay-pot` | alchemy table | Burns the eyes of all near where it bursts · 3 m | M4 |
| `item.smoke-pot` | Smoke pot | Thrown: smoke 6 m across that blocks sight; allies inside are **Hidden** | 15 s | 1 × `item.clay-pot`, 1 × `item.pitch`, 1 × `item.herbs` | alchemy table | A cloud that hides allies and blinds archers · 6 m, 15 s | M4 |
| `item.caltrops` | Caltrops | Scattered over 3 m: those who cross are **Slowed** and **Bleeding** | until gathered | 1 × `item.iron-ingot` → 4 | anvil | Spikes that cripple a charge · 3 m | M4 |
| `item.fire-pot` | Fire pot | Thrown or slung: **Burning** within 3 m, and what burns there catches | 10 s | 1 × `item.clay-pot`, 2 × `item.pitch` | alchemy table | Bursts into clinging fire · 3 m | M4 |
| `item.flash-powder` | Flash powder | Thrown: **Blinded** and **Staggered** within 4 m | at once | 1 × `item.black-powder`, 1 × `item.salt`, 1 × `item.clay-pot` | alchemy table | A blinding flash that breaks a charge · 4 m | M5 |
| `item.powder-bomb` | Powder bomb | Thrown: 150% of a hit to everyone within 3 m, each **Staggered**; breaks soft blocks | at once | 1 × `item.clay-pot`, 1 × `item.black-powder`, 1 × `item.cord` | alchemy table | Bursts with force enough to scatter a squad · 3 m | M5 |
| `item.sappers-charge` | Sapper's charge | Placed: 3,000 **siege** to blocks, works and engines within 2 m | fuse 5 s | 1 × `item.clay-pot`, 3 × `item.black-powder`, 1 × `item.cord` | alchemy table | Brings down a wall or a gate · 2 m | M5 |
| `item.breaching-charge` | Breaching charge | Placed: 8,000 **siege** within 3 m | fuse 8 s | 2 × `item.sappers-charge`, 1 × `item.iron-ingot` | alchemy table | Opens a breach in the strongest wall · 3 m | M5 |
| `item.blasting-keg` | Blasting keg | Placed: 2,000 **siege** to blocks only, within 4 m | fuse 10 s | 4 × `item.black-powder`, 1 × `item.planks` | alchemy table | Clears rock for a mine or a road · blocks only | M5 |
| `item.spore-powder` | Spore powder | Thrown: **Poisoned** within 3 m | 10 s | 2 × `item.fungi`, 1 × `item.clay-pot` | alchemy table | Bursts into a cloud of sickening spores · 3 m | M6 |
| `item.rime-bomb` | Rime bomb | Thrown: 150% of a hit as Cold within 4 m, each **Chilled** twice | at once | 1 × `item.clay-pot`, 2 × `item.rime-ore`, 1 × `item.black-powder` | alchemy table | Bursts into freezing shards · 4 m | M6 |
| `item.crystal-bomb` | Crystal bomb | Thrown: 200% of a hit as Mana within 4 m, each **Silenced** | at once | 1 × `item.glass`, 1 × `item.raw-crystal`, 1 × `item.black-powder` | alchemy table | Shatters raw crystal in a burst of Mana · 4 m | M6 |

---

## 14. Runes

| ID | Name | On | Effect | Made from | Tooltip | Since |
|---|---|---|---|---|---|---|
| `item.keen-rune` | Keen rune | weapon | Armour-piercing 10% | 1 × `item.cut-crystal`, 1 × `item.steel-ingot` | Cuts through armour · a tenth of it | M6 |
| `item.heavy-rune` | Heavy rune | weapon | Damage +8% (increased) | 1 × `item.pure-crystal`, 1 × `item.titan-bone` | Lends weight to every blow · a small edge | M6 |
| `item.swift-rune` | Swift rune | weapon | Attack speed +8% | 1 × `item.cut-crystal`, 1 × `item.skystone` | Quickens every swing and shot · a small edge | M6 |
| `item.ember-rune` | Ember rune | weapon | 10% of each hit added as Fire; a full swing leaves **Burning** | 1 × `item.cut-crystal`, 1 × `item.brimstone` | Adds fire to every blow · a tenth of the hit | M6 |
| `item.frost-rune` | Frost rune | weapon | 10% of each hit added as Cold; **Chilled**, once every 3 s on the same target | 1 × `item.cut-crystal`, 1 × `item.rime-ore` | Adds frost to every blow · a tenth of the hit | M6 |
| `item.storm-rune` | Storm rune | weapon | 10% of each hit added as Storm; every fifth hit also strikes the nearest other foe within 4 m for that share | 1 × `item.cut-crystal`, 1 × `item.fused-glass` | Adds lightning to every blow · a tenth of the hit | M6 |
| `item.rot-rune` | Rot rune | weapon | 10% of each hit added as Rot; a full swing leaves **Poisoned** | 1 × `item.cut-crystal`, 1 × `item.fen-reagents` | Adds rot to every blow · a tenth of the hit | M6 |
| `item.leech-rune` | Leech rune | weapon | Heals the wielder for 3% of the damage it deals | 1 × `item.pure-crystal`, 1 × `item.titan-marrow` | Draws back a little of every wound dealt · 3% | M6 |
| `item.bane-rune` | Bane rune | weapon | Damage +15% against creatures of the Deep | 1 × `item.cut-crystal`, 1 × `item.titan-bone` | Bites deeper into what the Deep made · not people | M6 |
| `item.breaker-rune` | Breaker rune | weapon | Hits on blocks, buildings and engines +25% | 1 × `item.cut-crystal`, 1 × `item.old-salvage` | Breaks walls, gates and engines faster · not people | M6 |
| `item.wardenbane-rune` | Wardenbane rune | weapon | Damage +10% against Wardens and generals | 1 × `item.pure-crystal`, 1 × `item.ichor` | Bites into the King Below's court · Wardens and generals only | M7 |
| `item.ichor-rune` | Ichor rune | weapon | 5% of each hit is **true** damage | 1 × `item.ichor`, 1 × `item.soulglass` | Part of every blow ignores all defence · 5% | M7 |
| `item.ward-rune` | Ward rune | armour | Mana resistance 15% | 1 × `item.cut-crystal`, 1 × `item.moonsilver-ingot` | Turns aside raw mana · Mana only | M6 |
| `item.hearth-rune` | Hearth rune | armour | Fire and Cold resistance 10% | 1 × `item.cut-crystal`, 1 × `item.fireclay` | Holds heat and frost at bay · a tenth | M6 |
| `item.vigour-rune` | Vigour rune | armour | Health +5% | 1 × `item.pure-crystal`, 1 × `item.titan-marrow` | Toughens the wearer · max Health only | M6 |
| `item.wind-rune` | Wind rune | armour | Stamina refills 10% faster | 1 × `item.cut-crystal`, 1 × `item.skystone` | A deeper breath · Stamina only | M6 |
| `item.thorn-rune` | Thorn rune | armour | Melee attackers take 10% of their hit back | 1 × `item.cut-crystal`, 1 × `item.obsidian` | Pricks whoever strikes the wearer · melee only | M6 |
| `item.stone-rune` | Stone rune | armour | Repairs 10% of the piece's durability each in-game hour | 1 × `item.cut-crystal`, 1 × `item.living-stone` | The piece mends itself · durability only | M7 |
| `item.silk-rune` | Silk rune | armour | Speed +5%; the piece weighs half | 1 × `item.cut-crystal`, 1 × `item.moth-silk` | Lightens the step · a small edge | M7 |
| `item.soul-rune` | Soul rune | armour | Mana +10%; Mana refills 1 a second faster | 1 × `item.soulglass`, 1 × `item.pure-crystal` | Holds and gathers more Mana · Mana only | M7 |
| `item.blood-rune` | Blood rune | armour | Health regained +25% | 1 × `item.ichor`, 1 × `item.titan-marrow` | Closes wounds faster · regained Health only | M7 |
| `item.bulwark-rune` | Bulwark rune | shield | Block +10% | 1 × `item.cut-crystal`, 1 × `item.steel-ingot` | Turns harder blows · Block only | M6 |
| `item.brace-rune` | Brace rune | shield | Blocked hits cost 25% less Stamina | 1 × `item.cut-crystal`, 1 × `item.titan-bone` | Holds the guard longer · Stamina only | M6 |
| `item.parry-rune` | Parry rune | shield | Parry window +0.1 s | 1 × `item.pure-crystal`, 1 × `item.skystone` | Widens the moment for a parry · a tenth of a second | M6 |
| `item.lode-rune` | Lode rune | shield | Draws arrows and bolts shot at its bearer from the front into the shield, raised or not | 1 × `item.cut-crystal`, 1 × `item.lodestone` | Pulls shots from the front into the shield · front only | M7 |

---

## 15. Mounts and beasts

| ID | Name | Speed | Health | Carry | Traits | Since |
|---|---|---|---|---|---|---|
| `item.pony` | Pony | 7 m/s | 150 | 80 kg | sure-footed on hills, snow and ice | M3 |
| `item.horse` | Riding horse | 10 m/s | 250 | 100 kg | a courier's and a rider's mount | M3 |
| `item.courser` | Courser | 13 m/s | 220 | 90 kg | the fastest mount | M4 |
| `item.warhorse` | Warhorse | 9 m/s | 600 | 150 kg | trained to battle: never **Feared**; foes it runs down are **Staggered** | M4 |
| `item.draught-horse` | Draught horse | 2.5 m/s in harness | 400 | pulls 750 kg | two pull a wagon | M3 |
| `item.mule` | Mule | 1.8 m/s laden | 300 | 120 kg | a pack animal; sure-footed | M3 |
| `item.ox` | Ox | 2 m/s in harness | 500 | pulls 600 kg | pulls a cart or a plough; ploughed fields are farmed 20% faster | M3 |
| `item.war-hound` | War hound | 9 m/s | 180 | — | fights beside its handler: bites as a tier 2 sword, and a bite leaves **Bleeding** | M4 |
| `item.scent-hound` | Scent hound | 8 m/s | 120 | — | **Reveal** tracks within 16 m; smells **Hidden** foes within 8 m | M4 |
| `item.sled-dog` | Sled dog | 6 m/s in a team | 100 | pulls 100 kg | a team of four pulls a sled over snow and ice | M4 |
| `item.sheep` | Sheep | 3 m/s | 60 | — | shorn for wool; gives meat and hide | M2 |
| `item.goat` | Goat | 4 m/s | 60 | — | gives milk and horn, meat and hide; climbs steep ground | M2 |
| `item.pig` | Pig | 3 m/s | 80 | — | gives meat, fat and hide; eats scraps | M2 |
| `item.cow` | Cow | 3 m/s | 150 | — | gives milk, meat, hide and horn | M2 |
| `item.fowl` | Fowl | 3 m/s | 15 | — | gives feathers and meat | M2 |

---

## 16. Siege engines

| ID | Name | Damage | Range | Rate | Crew | Made from | Since |
|---|---|---|---|---|---|---|---|
| `item.battering-ram` | Battering ram | 1,200 **siege** | touch | 1 every 4 s | 6 | 4 × `item.timber`, 2 × `item.iron-ingot`, 2 × `item.hide` | M5 |
| `item.mantlet` | Mantlet | none: moving cover that stops shots from the front, with 2,000 hit points | — | — | 1 | 6 × `item.planks`, 2 × `item.hide` | M5 |
| `item.siege-tower` | Siege tower | none: carries 12 people up a wall 12 m high | — | — | 8 | 20 × `item.timber`, 10 × `item.planks`, 4 × `item.hide`, 4 × `item.iron-ingot` | M5 |
| `item.scorpion` | Scorpion | 300 **siege** | 80 m | 1 every 3 s | 1 | 2 × `item.timber`, 2 × `item.iron-ingot`, 2 × `item.sinew` | M5 |
| `item.ballista` | Ballista | 700 **siege** | 140 m | 1 every 6 s | 2 | 4 × `item.timber`, 4 × `item.iron-ingot`, 4 × `item.sinew` | M5 |
| `item.catapult` | Catapult | 1,500 **siege** within 3 m | 200 m | 1 every 12 s | 4 | 8 × `item.timber`, 4 × `item.iron-ingot`, 4 × `item.rope` | M5 |
| `item.trebuchet` | Trebuchet | 3,000 **siege** within 4 m | 350 m | 1 every 20 s | 8 | 20 × `item.timber`, 8 × `item.iron-ingot`, 4 × `item.rope`, 40 × `item.stone` | M5 |
| `item.bone-ballista` | Bone ballista | 1,200 **siege** | 180 m | 1 every 5 s | 2 | 2 × `item.titan-bone`, 4 × `item.steel-ingot`, 4 × `item.sinew` | M5 |
| `item.bone-trebuchet` | Bone trebuchet | 5,000 **siege** within 4 m | 450 m | 1 every 18 s | 8 | 6 × `item.titan-bone`, 8 × `item.steel-ingot`, 4 × `item.rope`, 40 × `item.stone` | M5 |
| `item.crystal-lance` | Crystal lance | 4,000 **siege** | 250 m | 1 every 10 s, burning 1 × `item.cut-crystal` a shot | 2, one of them a mage | 4 × `item.moonsilver-ingot`, 2 × `item.pure-crystal`, 4 × `item.steel-ingot` | M6 |
| `item.ley-mortar` | Ley mortar | 7,000 **siege** within 6 m | 300 m | 1 every 20 s, burning 1 × `item.liquid-mana` a shot | 3, one of them a mage | 6 × `item.moonsilver-ingot`, 4 × `item.deepsteel-ingot`, 2 × `item.pure-crystal` | M7 |
| `item.soulglass-battery` | Soulglass battery | 12,000 **siege** | 400 m | 1 every 30 s | 4, one of them a mage | 4 × `item.soulglass`, 6 × `item.demonsteel-ingot`, 8 × `item.moonsilver-wire`, 4 × `item.titan-bone` | M7 |

---

## 17. Works

| ID | Name | Made from | Made at | Since |
|---|---|---|---|---|
| `item.anvil` | Anvil | 6 × `item.iron-ingot` | forge | M3 |
| `item.millstone` | Millstone | 4 × `item.stone` | mason's yard | M3 |
| `item.loom-frame` | Loom frame | 6 × `item.planks`, 4 × `item.cord` | carpenter's bench | M3 |
| `item.bellows` | Bellows | 2 × `item.leather`, 3 × `item.planks` | carpenter's bench | M3 |
| `item.still` | Still | 2 × `item.glass`, 2 × `item.iron-ingot` | glassworks | M3 |
| `item.iron-fittings` | Iron fittings | 1 × `item.iron-ingot` → 4 | anvil | M3 |
| `item.mint-dies` | Mint dies | 2 × `item.steel-ingot` | anvil | M3 |
| `item.fire-basket` | Fire basket | 2 × `item.iron-ingot` | anvil | M4 |
| `item.lift-cage` | Lift cage | 4 × `item.skystone`, 6 × `item.planks`, 4 × `item.iron-fittings` | wright's yard | M6 |
| `item.sealed-housing` | Sealed housing | 4 × `item.heartroot-resin`, 4 × `item.planks` | carpenter's bench | M6 |
| `item.moonsilver-conduit` | Moonsilver conduit | 4 × `item.moonsilver-wire`, 1 × `item.planks` | anvil | M6 |
| `item.relay-core` | Relay core | 4 × `item.moonsilver-wire`, 2 × `item.cut-crystal`, 4 × `item.stone` | enchanting altar | M6 |
| `item.ward-core` | Ward core | 2 × `item.moonsilver-ingot`, 2 × `item.pure-crystal`, 1 × `item.heartroot-resin` | enchanting altar | M6 |
| `item.generator-core` | Generator core | 6 × `item.moonsilver-ingot`, 4 × `item.cut-crystal`, 4 × `item.steel-ingot`, 4 × `item.fireclay` | enchanting altar | M6 |
| `item.crystal-cell` | Crystal cell | 1 × `item.pure-crystal`, 1 × `item.moonsilver-wire`, 1 × `item.glass` | enchanting altar | M6 |
| `item.pump` | Pump | 4 × `item.iron-ingot`, 2 × `item.old-salvage`, 2 × `item.leather` | wright's yard | M6 |
| `item.gear-train` | Gear train | 2 × `item.old-salvage`, 2 × `item.steel-ingot` | anvil | M6 |
| `item.lodestone-rail` | Lodestone rail | 2 × `item.lodestone`, 1 × `item.steel-ingot` | anvil | M7 |
| `item.ward-weave` | Ward weave | 4 × `item.moth-silk`, 2 × `item.moonsilver-wire` | enchanting altar | M7 |
| `item.soulglass-cell` | Soulglass cell | 2 × `item.soulglass`, 2 × `item.moonsilver-wire`, 1 × `item.deepsteel-ingot` | enchanting altar | M7 |
| `item.hearth-heart` | Hearth heart | 4 × `item.titan-bone`, 10 × `item.moonsilver-ingot`, 6 × `item.pure-crystal` | hearth-shrine | M7 |
