# 13 · Units, classes and power

This doc is the rulebook for people: how you play them, what they are made of, how they fight, learn and grow, and how far up the power ladder they can climb. Its two libraries hold the content: `14-class-library.md` (every class and every skill) and `15-item-library.md` (every item). Where `05-systems.md` touches people, it points here.

Every number is a starting value for playtests *(tune)* unless it is marked **fixed**. The libraries' tables are data (§19): `node docs/tools/content-check.mjs` checks them and prints the benchmark ladder of §9 from the formulas below.

---

## 1. The owner's rules (8 October 2026)

1. **There is no first-person view.** You act through a unit from the Command view or from a third-person camera (§3).
2. **Every unit has skills:** an Active from early on, and an Ultimate once it has met a gameplay requirement. Most skills are weak and useful: they gather information, highlight things and help the unit do its job. The strongest can be outright broken.
3. **Balanced early, broken late.** Unbalanced and broken power comes only from the endgame.
4. **The player plays many units.** Playing them, levelling a lot of them and min-maxing them is half the game; building the logistics is the other half.
5. **Two kinds of class: civilian and military.** Civilians can fight, and some civilian skills happen to be good for it (a butcher's). Every skill, civilian or military, helps the unit do its own job: a scout's finds, a medic's heals.
6. **Military units have a class, a role and a rank.** Civilians climb trade ranks, and the government has its own ladder of offices.
7. **The power ladder is linear in power and extremely hard to climb.** At its top is the **Calamity**: one unit that can level mountains, destroy a small kingdom, solo an easier Warden, or hold a kingdom alone. Keeping one is a burden: worshippers burning resources, hearths built to uphold it, or a soldier sworn to die.
8. **Calamities are strategic pieces.** Like the king, they are not to be spent recklessly.
9. **For now, every person looks like a Minecraft avatar** (§3.2).

## 2. Words

| Word | Means |
|---|---|
| **Attribute** | one of six inborn numbers: Strength, Agility, Endurance, Intellect, Will, Affinity (§4). The interface calls them stats |
| **Proficiency** | how good someone is at one trade, 0–100 (§8). It replaces the "skills" of earlier drafts |
| **Class** | the trade a person works: Miner, Smith, Archer. It replaces "role" in the sense of job |
| **Level** | 1–70, earned with experience. It belongs to the person, not the class (§7) |
| **Grade** | a band of ten levels with its own name, from Common to Calamity (§9) |
| **Might** | the grade's multiplier for Health: 1.0 for Common, rising by 0.5 per grade to 4.0 for Calamity |
| **Power** | what a skill's ◆ numbers multiply by: `Might × (1 + (level − 1) ÷ 20)`, from 1.0 for a new Common to 17.8 for a level-70 Calamity (§11.7) |
| **Skill** | a power on a slot: Knack, Active, Ultimate, Art, Mastery or Cataclysm (§11) |
| **Resolve** | what an Ultimate fills up on, 0–100, earned by doing the class's work (§11.3) |
| **Role** | a military unit's place in a fight: Assault, Guard, Support or Secondary (§12) |
| **Rank** | a place on a ladder: military ranks, trade ranks, and offices (§13) |
| **Band** | the player's short list of favourite people, for switching between them (§3.8) |
| **Played** | being driven by the player, in either Possess camera |
| **Calamity** | the top grade, and a person who holds it (§15) |
| **Flame** | a Calamity's second life pool, fed by its upkeep (§15.2) |

`05-systems.md` and the catalogue still say **Possess** for playing a unit. It means the same thing.

---

## 3. Playing a unit

### 3.1 Three ways to act

| Way | Camera | How it works |
|---|---|---|
| **Order** | Command view | select a person or a company and give orders: right click to go, fight or work there (B2 of `11-interface-catalogue.md`), the inspector's buttons for everything else, including skills (§3.7) |
| **Play from above** | **Overhead** (§3.4) | the Command camera locked on one unit: W A S D move it, the cursor aims, the mouse works its hands |
| **Play behind** | **Shoulder** (§3.3) | a third-person camera over the unit's shoulder, pointer locked, a crosshair at the centre |

Tab switches between Command view and playing (as before). **F5 switches between Overhead and Shoulder** while playing. Play opens in the camera the player used last; the first time on a device it opens in Overhead, because that switch needs no pointer lock and no change of lens.

The camera never goes inside a unit's head, in any mode, at any time.

### 3.2 What stays Minecraft, and the avatar

A played unit moves, digs, builds and carries exactly as a Minecraft player does: the same box (0.6 × 1.8 m), walk, sprint, sneak, jump, step-up, swim, climb, fall, block-breaking times, placing rules, reach, hotbar and inventory slots, and the attack cooldown. `11-interface-catalogue.md` B4 keeps those details. What changes: you watch the body from outside, you aim with the cursor or a crosshair, and the unit's sheet, skills and conditions (§4–§6) apply.

**Fall damage:** 5% of max Health for every metre fallen beyond 3 m, so a 23 m fall kills, as in Minecraft.

**The avatar** (everyone, the king and the free camera included). A blocky figure with a Minecraft avatar's proportions, 1.8 m tall: head 8 × 8 × 8 px, body 8 × 12 × 4, arms and legs 4 × 12 × 4, one px being 1.8 m ÷ 32. Its look is generated in code from the person's identity (golden rule 6): skin and hair from their stored traits, clothes by class and needs tier, a trim in the kingdom's colours, worn armour drawn as a layer by material. Nothing reproduces a skin from Minecraft. It animates as a Minecraft avatar does: limbs swing with speed, the body leans to sprint and crouches to sneak, the arm swings to hit, dig and place, a shield rises, a bow draws, the body flashes red when hurt. Skills add a pose and a wind-up (§11.5). A Downed person lies on the ground (§5.9). This is the owner's "for now": a later art pass may replace it.

### 3.3 Shoulder

- **Where the camera sits.** It orbits a pivot 1.75 m above the unit's feet (1.40 m while sneaking), 3.6 m behind it and 0.55 m to the right, looking where the mouse points. The mouse turns it as B4 says ("Looking"). Pitch stops at 80° up and 80° down. The field of view is `set.video.fov` (70° by default).
- **Walls.** When something solid lies between the pivot and the camera, the camera slides in, but never closer than 1.2 m behind the pivot, and the shoulder offset shrinks with it. When even 1.2 m isn't free (backed into a wall), the blocks between the camera and the pivot are cut away for as long as that lasts, with the cut's clip (C2). Inside 2 m the avatar is drawn at 35% opacity, so what it aims at stays visible.
- **The body** turns to face the camera's yaw. Moving is relative to the camera, as in Minecraft.
- **Aim.** The crosshair sits at the screen's centre. The **aim point** is the first thing the camera ray meets beyond the unit (anything nearer the camera than the unit is skipped), up to 64 m away. The unit acts along its **action ray**, from its eyes (1.62 m up) to the aim point. What it can touch is the first block or creature on the action ray within reach (§3.5), so a wall between the unit and the aim point is what gets hit. The target outline is drawn on that, never on something the unit can't touch.
- **Sprinting** widens the view by 8%, eased over 150 ms (`set.ui.fov-effects` scales it). Nothing shakes or tilts the camera.

### 3.4 Overhead

- **The camera** is the Command camera of C1 with its focus locked on the unit's feet + 1 m (following with a 100 ms time constant), `d` from 10 to 80 m (24 m to start), the same 40° lens, and the cursor free.
- **Tilt** is the player's own, 30°–85° (55° to start): no curve with distance here. Turn with ← and → (hold to turn at 100° a second, tap to snap 45°), tilt with ↑ and ↓, or middle-drag to orbit (it starts after 120 ms *and* 6 px, as a right drag does in Command view). The wheel zooms, toward the unit.
- **Moving.** W A S D move the unit relative to the screen: W is up the screen. Sprint, sneak and jump as in Minecraft.
- **Facing.** The body faces where it is going, except while it acts: while a mouse button is held, a shield is up, a bow is drawn or a skill is being aimed, and for one second after, it faces the aim point and W A S D strafe.
- **Aim.** The aim point is what the cursor's ray meets first (C1's rule for rays, the cut face included). The action ray runs from the unit's eyes to that point, with the same reach and line-of-sight rule as Shoulder. The outline shows the block or creature the unit would touch, and nothing when there is none in reach.
- **Under cover.** The cut (C2) follows the unit: whenever there is a solid, non-plant block within 32 m above the unit's head (the lowest of a 3 × 3 patch of columns around it), the cut sits half a metre below it, easing over 150 ms. PageUp and PageDown still move it by hand until the unit next walks under or out of cover. What you may see under a cut follows C2.
- **Picking a block** is a middle click that doesn't turn into a drag.

### 3.5 In the hands

- **Reach:** 4.5 m for blocks; for people and creatures, the weapon's reach (3 m for most; `15-item-library.md` gives each), measured from the eyes along the action ray. A unit never touches what it can't see from its own eyes.
- **Melee** strikes toward the aim point. The **primary target** is the creature under the aim point when it is within reach; otherwise the creature within reach nearest to the action ray inside the weapon's arc (90° for most). Weapons with **Sweep** also hit everything else in the arc for the share their row gives. The cooldown, and the weaker hit when you swing early, are Minecraft's: a hit does `0.2 + 0.8 × r²` of its damage, where `r` is how far the cooldown has recovered (0–1). AI units always wait for a full swing.
- **Ranged** shots are aimed at a point. Draw (hold the use button) and release: the shot leaves the unit's hand on the arc that passes through the aim point, when the point is within the weapon's range; beyond it, on the arc that goes farthest that way. Gravity and travel time are real, so a moving target must be led. Spread comes from the weapon and proficiency (§5.7). The same rule serves both cameras and the AI.
- **Breaking and placing** are Minecraft's, along the action ray. A ghost of the block about to be placed is drawn on the face it would go on.

### 3.6 Skills on keys

While playing: **Z** Active, **X** Ultimate, **C** Art, **V** first relic, **R** second relic, **G** Cataclysm (held for 1 s, so it can't fire by accident). A skill that needs a place or a direction shows its shape on the ground while its key is held and fires on release; a tap fires at once at the aim point. Esc, or the other mouse button, while the key is held cancels it. A skill pressed within the last 0.3 s of another action fires as soon as the unit is free. The rest of a skill's behaviour is in §11.

### 3.7 Ordering one unit from Command view

- **Right click** with one person selected: on the ground, go there; on a block or workplace, work it (dig, build, harvest, man it); on an enemy, attack it (from Milestone 4); on a friend, follow them. Shift queues, as with companies. It is the same order a company gets, given to one person.
- **The inspector shows that person's skills** (D4). Clicking a ready skill uses it: a skill that needs a target turns the cursor into a target, the next left click sets it, and Esc cancels. With a company selected, the inspector shows the skills its members share, and one click orders every member who has that skill ready.
- **Orders travel** (A4 of the catalogue): an order to a far unit waits for the news to arrive. Playing a unit, or standing an officer next to it (§13.1), skips the wait.

### 3.8 Why play them: the Band, experience and trials

- **The Band** is a list of up to 8 people the player has pinned (`person.band`). `,` and `.` switch to the previous or next member while playing, with the same move as Tab (C5), when that member can be played. Pinning changes nothing else.
- **Played units learn three times as fast:** experience and proficiency both (§7).
- **First light.** The first 10 minutes a person is played in each in-game day earn five times instead of three. So the player gains most by rotating through many people, not by riding one.
- **Trials are played.** The step up to Champion (§9) is a Trial that only a played unit can pass.
- **The hands matter.** A parry (§5.5), a lead on a moving target, a falling strike (§5.3), a well-timed Ultimate and a skill aimed at the right spot are things only a player does well. AI units use simple, safe tactics: they never parry, never use a falling strike, and use their skills by the rules of §11.6.

### 3.9 Milestone 1

There are no people yet. **The free camera** is an avatar in creative mode (B4): it walks, flies, breaks and places, and is seen in Shoulder from phase 1.1. From phase 1.4, when the Command camera exists, F5 also gives it Overhead. Postcard mode (`04-terrain.md` §14.3) is a separate camera and is unchanged.

---
## 4. A person's sheet

### 4.1 Attributes

Everyone is born with six attributes from 1 to 20, as `05-systems.md` §5 describes (mean 10; Affinity skewed low). Every fifth level adds **one point** for the player to place (14 by level 70); a point left unplaced for an in-game day goes to the class's first attribute. No attribute goes above 25.

| Attribute | Gives |
|---|---|
| Strength | carrying; damage with Blade and Blunt weapons; the cap for mining, woodcutting, masonry, smithing and melee |
| Agility | speed; damage with Point weapons and ranged weapons; the cap for fieldcraft, carpentry, tailoring, riding and ranged |
| Endurance | Health and Stamina; resisting hazards; the cap for farming, building and hauling |
| Intellect | +2% experience and proficiency gained per point over 10; quality of crafted goods; the cap for kilncraft, cooking, alchemy, medicine, letters, engineering, management and siege |
| Will | morale; steadier loyalty; control effects on them last 3% less per point over 10 (30% less at most); +2% Resolve gained per point over 10; the cap for husbandry, trade and rites |
| Affinity | Mana; 15 or more to train a mage class (§10.8); the cap for magic |

### 4.2 Derived numbers

| Number | Rule |
|---|---|
| **Health** | `(60 + 4 × END + H × (L − 1)) × Might`. `H` is the class's Health per level (2, 3, 4, 6 or 8, in its row). A fresh average adult has 100 |
| Health regained | 0.5% of max Health a second once 10 s have passed without dealing or taking damage; twice that in a bed or beside a lit hearth; none while Downed |
| **Stamina** | `60 + 4 × END + L`. Refills 15 a second once 1 s has passed without spending any (§5.8 lists the costs) |
| **Mana** | only for classes whose row says so: `10 × AFF + 5 × (L − 1)`. Refills 1 a second, 3 within 16 m of a mana source (a ley well, a generator, a relay or a crystal cell) |
| Speed | Minecraft's walk 4.317, sprint 5.612 and sneak 1.31 m/s, × `(1 + 0.01 × (AGI − 10))` × the armour factor × the load factor |
| Armour factor | cloth and leather 1.00, mail 0.95, plate 0.90 |
| Carrying | `10 + 2 × STR` kg freely (30 kg for an average person, the porter of `05-systems.md` §15). Up to twice that at −40% speed and no sprint; no more |
| Sight | 48 m by day; 16 m at night, underground and anywhere the light is under 7 |
| Reach | 4.5 m for blocks; the weapon's reach for people and creatures (§3.5) |
| Work speed | `base × (1 + P ÷ 100) × (1 + 0.02 × (A − 10))` × tool × workplace × needs tier (`05-systems.md` §7) × skills, where `P` is the trade's proficiency and `A` its attribute |

---

## 5. Fighting

### 5.1 A hit, step by step

1. **Base:** the weapon's damage `W` (its row in `15-item-library.md`), or the number in a skill's row.
2. **Increased.** Add every *increased* bonus and penalty into one sum `I`: 3% per point of the weapon's attribute above 10 (and −3% per point below); 0.4% per point of the weapon's proficiency; 1% per level; 50% per grade above Common; the item's quality (`15-item-library.md` §1: `(q − 50) × 0.4%`); the role (§12); charms, meals and skills. The hit is `W × (1 + I)`, and never under 10% of `W`. A mage's hit is its staff's or focus's, with Affinity as the attribute and magic as the proficiency.
3. **More.** Multiply by each *more* multiplier: position (§5.3) and skills that say "more". Their product is capped at ×2.5, unless a row says *uncapped*.
4. **Type** against the target's armour class (§5.2).
5. **Armour:** × `100 ÷ (100 + AR)`. Each point of armour is 1% more effective Health. Armour penetration lowers `AR` first, never below 0.
6. **Elements** (Fire, Cold, Storm, Rot, Mana) skip step 4 and pass armour at half, × `100 ÷ (100 + AR ÷ 2)`; then the target's resistance to that element cuts them, never by more than 75%. A row that **adds** "N% of each hit as" an element takes that share of the hit after step 3 and sends it down this step.
7. **Overmatch** (§5.4).
8. **Block** (§5.5).
9. What is left comes off **Shielded** first, then **Flame** (a Calamity, §15.2), then Health.

**Siege** damage (engines, a Sapper's charges) ignores armour, Overmatch and a Fortress Warden's reduction, and its full value breaks blocks: a block's hit points are its hardness × its material (`05-systems.md` §13). Against creatures, an engine deals its row's damage against creatures instead (`15-item-library.md` §16), which takes armour and Overmatch as usual. **True** damage ignores armour and resistance but not Overmatch; only a few endgame rows deal it, and only the largest true damage on a hit counts.

### 5.2 Damage types and armour

People wear cloth, leather, mail or plate (unarmoured counts as cloth). Creatures count by their body: flesh as cloth, hide as leather, chitin and scale as mail, bone, stone and metal as plate.

| Type | Cloth | Leather | Mail | Plate |
|---|---|---|---|---|
| Blade (swords, axes, knives) | ×1.25 | ×1.10 | ×0.80 | ×0.65 |
| Point (spears, arrows, bolts, picks) | ×1.00 | ×1.05 | ×1.10 | ×0.85 |
| Blunt (maces, hammers, staves, stones) | ×0.85 | ×0.90 | ×1.10 | ×1.25 |

Elemental resistances come only from items, runes, conditions and skills; everyone starts at 0.

### 5.3 Position

- Seen from the target, **front** is within 60° of where it faces, **flank** from 60° to 135°, **rear** beyond 135°.
- A melee hit, or a ranged hit from closer than 6 m, is ×1.15 more from the flank and ×1.5 more from the rear.
- A **falling strike**, a melee hit while falling (not on the ground, not climbing, swimming or riding), is ×1.5 more, as Minecraft's critical hit.
- Ranged weapons reach 10% farther for every 4 m their shooter stands above the aim point, 50% farther at most.

### 5.4 Overmatch

When the target's grade is **two or more above** the attacker's, the hit is cut by 25% for each grade of gap beyond one: a gap of 2 takes 25% off, 3 takes 50%, 4 takes 75%, and 5 or more 90%. Control effects (Stunned, Rooted, Frozen, Slowed, Staggered, Feared, Taunted) last 20% less for each grade of gap beyond one, 80% less at most.

- Siege damage against blocks and structures, and Wardens' attacks, ignore Overmatch; Wardens get no Overmatch protection either.
- The king counts as Paragon (grade 6) both ways. Enemies have a grade by tier and rank (§16).
- Heals, shields and buffs are never cut.

This is what makes a grade gap count: a hundred levied farmers can't scratch a Champion, and an army of Proven soldiers barely dents a Calamity.

### 5.5 Block and parry

- **Blocking.** Hold the use button with a shield. Hits from the front (a 120° arc) lose the shield's **Block** value after armour; projectiles from the front are stopped outright. A block never takes off more than 75% of a hit; a parry takes off all of it. Each blocked hit costs 8 Stamina, plus 1 per 10 damage blocked. At 0 Stamina the guard breaks: **Staggered**, and the shield can't rise again for 2 s. While it is up the unit moves at half speed and can't attack or sprint.
- **Weapons with Guard** in their row (spears, staves, greatswords, parrying daggers) block with half a round shield's Block of their tier, and can parry. A row may widen its own parry window.
- **Blunt hits ignore a quarter of Block.** Hits a row calls **crushing** (big creatures, Wardens' heavy hits) can't be blocked or parried, and leave whoever they hit **Staggered**.
- **A parry**, raising the shield or Guard weapon within 0.25 s before a melee hit lands, blocks all of it, costs nothing and Staggers the attacker for 0.75 s. AI units never parry.

### 5.6 Mounts and beasts

- **From the saddle,** a rider fights as on foot. A **charging hit** is a melee hit while the mount moves at 8 m/s or more: ×1.5 more with a mounted weapon (a lance), ×1.25 more with any other.
- A rider whose mount dies, or who is **Staggered** by a weapon whose row says it can unhorse (halberds, pikes), falls: 3 m of fall damage (§3.2), **Staggered** for 1 s.
- Mounts and other animals have the Health and traits of their rows (`15-item-library.md` §15), armour 10 unless they wear barding, and count as Common for Overmatch both ways.

### 5.7 Ranged weapons

- A bow draws in 1 s (its row may differ). A shot before full draw does `draw²` of its damage and flies at `draw` of its speed. A crossbow loads in its row's time and then shoots at full power.
- **Spread** is the weapon's (in degrees) × `(1 − 0.006 × ranged proficiency)`: 60% of it at proficiency 100. Moving doubles it; sneaking halves it.
- Arrows and bolts are ammunition items: their row adds damage, a type or an effect.

### 5.8 Stamina

| Action | Costs |
|---|---|
| sprinting | 5 a second |
| a jump while sprinting | 2 |
| swimming | 3 a second |
| a melee swing | 4 (8 with a heavy weapon) |
| drawing a bow | 6 |
| a blocked hit | 8, + 1 per 10 damage blocked |
| a skill | its row |

At 0 Stamina the unit can't sprint, its swings recover at half speed, and it is **Exhausted**.

### 5.9 Downed, Wounded and death

- **A person at 0 Health is Downed**, not dead: 30 s, or 60 s for the king and for anyone of Champion grade or higher. They lie still and take no damage except a **finishing blow**: a deliberate attack that takes 1.5 s, is broken off if the attacker is hit, deals the attacker's hit, and kills once that gets through any Shielded. AI enemies finish the Downed only when none of their own foes stands within 8 m. Area damage never finishes anyone.
- **Revive** by holding the use button on them for 4 s (2 s for a Physician, Mender or Chirurgeon). They rise with 20% Health and **Wounded**.
- **When the time runs out, they die.** If another king's people hold the ground, those people can take them captive instead (`05-systems.md` §5). A Wounded person who goes down again has half the time.
- **Death is permanent** for everyone, at every grade. What they wore and carried drops where they fell.
- Creatures of the Deep die at 0 Health. A Calamity is never Downed: it dies when Flame and Health are both gone.

### 5.10 How long a fight takes

At equal grade and gear, a line fighter kills another in 8 to 12 hits, about 6 s of swinging; an archer needs 6 to 10 arrows; a Shieldbearer whose shield is up lasts about three times as long from the front. The benchmark ladder (§9) is built to keep these true at every grade, and the content checker prints it.

---

## 6. Conditions

The full list. Skills and items may apply only these, by name, in **bold** (§19). A condition's tooltip is its effect, shown on its chip (`person.condition`, `hud.condition`). **Lasts** is the default; a row that applies a condition may give its own time.

"Of the hit" means of the hit that applied it, after every step of §5.1. When nothing hit (a bomb, a trap, a cloud), it means the user's own hit with the weapon in hand, or the item's damage where its row gives one. A condition that **refreshes** restarts its time when applied again; one that **stacks** adds a layer with its own time, up to the number given.

| ID | Name | Tooltip | Effect | Lasts | Stacks |
|---|---|---|---|---|---|
| `cond.bleeding` | Bleeding | Loses Health each second · a bandage or a big heal stops it | 5% of the hit each second. Any heal of 10% of max Health or more ends every layer | 6 s | 5 |
| `cond.burning` | Burning | On fire · water puts it out | 10% of the hit each second. Water or rain ends it | 5 s | refreshes, keeps the larger |
| `cond.chilled` | Chilled | Slower to move and strike · three at once freeze | speed −25%, attack speed −15%. A third layer turns them all into Frozen | 6 s | 3 |
| `cond.frozen` | Frozen | Can't move or act · a blunt blow shatters the ice | can't move or act. The next Blunt hit is ×1.5 more and ends it. Immune to Frozen for 6 s after | 1.5 s | no |
| `cond.poisoned` | Poisoned | Loses Health each second · heals do half | 6% of the hit each second; healing received −50%. An antidote ends it | 10 s | 3 |
| `cond.stunned` | Stunned | Can't move or act | can't move or act. Immune to Stunned for 6 s after | 2 s at most | no |
| `cond.staggered` | Staggered | Can't attack or use skills · moves at half speed | can't attack or use skills; speed −50%. Breaks a wind-up. Immune to Staggered for 3 s after. Wardens can't be Staggered except by a parry; generals hold it a quarter as long | 1 s | no |
| `cond.slowed` | Slowed | Moves slower | speed −40% | 4 s | refreshes, keeps the larger |
| `cond.rooted` | Rooted | Can't move · can still act | can't move. Immune to Rooted for 4 s after | 3 s | no |
| `cond.blinded` | Blinded | Sees only a few metres | sight 4 m; ranged spread ×4. A played unit's view darkens beyond 4 m | 4 s | refreshes |
| `cond.marked` | Marked | Takes more damage from everyone | +15% damage taken (increased, for every attacker). Shown to the marking kingdom through walls | 10 s | refreshes |
| `cond.feared` | Feared | Shaken · can't attack or use skills | morale −20 at once. AI units run from the source; a played unit can't attack or use skills. Immune for 10 s after | 3 s | no |
| `cond.exposed` | Exposed | Armour weakened | armour −30% | 6 s | refreshes |
| `cond.silenced` | Silenced | Can't use skills that cost Mana | as it says | 4 s | refreshes |
| `cond.taunted` | Taunted | Forced to face the taunter | the AI attacks only the taunter; a played unit deals −30% damage to anyone else | 4 s | refreshes |
| `cond.hidden` | Hidden | Unseen beyond a few metres · attacking ends it | enemies can't see them from farther than 8 m, 3 m while they sneak. Attacking, using another skill or taking damage ends it | by skill | no |
| `cond.shielded` | Shielded | Damage hits the shield first | absorbs damage up to its amount, before Flame and Health | by skill | keeps the larger |
| `cond.hasted` | Hasted | Moves and strikes faster | speed +20%, attack speed +15% | by skill | refreshes |
| `cond.fortified` | Fortified | Takes less damage · can't be staggered | damage taken −25%; immune to Staggered | by skill | refreshes |
| `cond.inspired` | Inspired | Hits harder · steadier | damage +15% (increased); morale +20 | by skill | refreshes |
| `cond.mending` | Mending | Regains Health over time | regains the skill's amount, spread evenly over its time | by skill | keeps the larger |
| `cond.exhausted` | Exhausted | Stamina refills slowly · moves slower | Stamina refills at half speed; speed −10% | 10 s | refreshes |
| `cond.wounded` | Wounded | Hurt and weak · needs a physician or a day in bed | damage −25%, speed −15%, max Health −25%. Ends after 60 s of a Physician's or Chirurgeon's care, or a full in-game day in a bed | until treated | no |
| `cond.downed` | Downed | Down and dying · a friend can revive them | §5.9 | 30 or 60 s | no |
| `cond.well-fed` | Well fed | The bonuses of a good meal | the meal's row (item library). One meal at a time; a new one replaces it | the meal's | no |
| `cond.merry` | Merry | The cheer of a good drink | the drink's row; most give morale +10 and ranged spread +10%. One drink at a time | the drink's | no |
| `cond.hungry` | Hungry | Hasn't eaten today | work speed −10%; Stamina refills 25% slower. Ends with a meal | until fed | no |
| `cond.freezing` | Freezing | Losing heat · needs warmth | speed −15%; loses up to 1% of max Health a second at full exposure. Exposure (0–100%) is the hazard field's intensity (`05-systems.md` §16; deep regions run above 100%) times what each protection worn lets through: protections multiply, so two that each cut it by half leave a quarter | while exposed | no |
| `cond.sweltering` | Sweltering | Overheating · needs shade or cooling | Stamina refills 50% slower; loses up to 1% of max Health a second at full exposure, measured as for Freezing | while exposed | no |
| `cond.ascent` | Ascent sickness | Climbed too far too fast | `02-world.md` §3, by layer | while it lasts | no |
| `cond.hollowing` | Hollowing | Raw mana is eating at them · get them warded | rises in raw-mana ground without a ward, 0–100. At 50: Will −5, morale −20. At 100 they become a Hollow, lost and hostile. Falls 1 a minute away from raw mana | while it lasts | no |
| `cond.sick` | Sick | Ill from disease or spores · rest and a physician help | rises with exposure to disease and spores as Freezing does, 0–100. While above 50: work speed −20%, Stamina refills 25% slower, Health regained halved. Falls 1 a minute away from the source; a full in-game day in a bed or 60 s of a Physician's care ends it | while it lasts | no |
| `cond.petrifying` | Petrifying | Turning to stone · needs a ward against it | rises with exposure to Sekitei's stone-sickness, 0–100, unless warded (`05-systems.md` §13). At 50: speed −30%. At 100 the person turns to stone and dies. Falls 1 a minute away from it | while it lasts | no |
| `cond.mana-burn` | Mana burn | Overdrawn on Mana · skills cost more | rises by 1 per point of Mana overdrawn (§11.2), 0–100. At 50 Mana costs +50%. At 100 they are Downed and can't use Mana for an in-game day. Falls 1 every 10 s at rest | while it lasts | no |
| `cond.guttering` | Guttering | Its fire is underfed · Flame halved | a Calamity short of upkeep (§15.4) | until fed | no |
| `cond.oathsworn` | Oathsworn | Sworn to the fire · it will come for them | §15.3 | until the fire | no |

---

## 7. Experience and levels

### 7.1 The curve

Going from level `n` to `n + 1` takes `50 × n × (n + 1)` experience. **Fixed.**

| Level | Total experience | Hours of ordinary work | Played (×3) |
|---|---|---|---|
| 5 | 2,000 | 0.6 | 0.2 |
| 10 | 16,500 | 4.6 | 1.5 |
| 20 | 133,000 | 37 | 12 |
| 30 | 449,500 | 125 | 42 |
| 40 | 1,066,000 | 467 (work counts half from 31) | 156 |
| 50 | 2,082,500 | 1,032 | 344 |
| 60 | 3,599,000 | 2,717 (a quarter from 51) | 906 |
| 70 | 5,715,500 | 5,069 | 1,690 |

A season is 4,368 hours long, and people work about half of them. So work alone takes a person to the top of Tempered in about ten days and to the top of Champion in about twelve weeks, but never to level 60 within a season. The top of the ladder is climbed by playing, fighting and deeds.

### 7.2 Where it comes from

| Source | Experience |
|---|---|
| class work: working its trade, hauling for a Porter, drilling for a soldier, study for a scholar | 1 a second |
| being in a fight (hitting or not) | 1 a second |
| a kill | the fallen's max Health ÷ 2, shared by everyone who damaged it in the last 10 s, by damage dealt. A Warden's is shared by credit (`05-systems.md` §18) |
| healing or shielding someone else | 1 per 4 Health restored or absorbed |
| the class deed (§10.4) | 1,000 |
| a first: the first of a kind of ore, creature, region or Warden for that person | 250 |
| a Trial passed (§9.3) | a whole level's worth |
| teaching (a Teacher, or a Master of the trade) | 0.5 a second per student within 24 m |

### 7.3 Bonuses and limits

- Bonuses add up and then multiply what is earned: **played +200%**, **First light another +200%** (§3.8), a Teacher or a Master of the same trade within 24 m +50%, Intellect +2% per point over 10, the trait Quick learner +20%, a scholar's meal up to +10%.
- **Work counts less as a person climbs:** in full through level 30, half from level 31, a quarter from level 51. Fights, kills, deeds and Trials always count in full. **Drill teaches nothing past level 20:** after that, soldiers learn from fighting, patrolling hostile ground (0.5 a second) and deeds.
- **At the top of a grade** (levels 10, 20, …), experience banks up to one level's worth and then stops until the person is promoted (§9).
- A level-up refills Health and Stamina.

---

## 8. Proficiency and trade ranks

**Proficiency** is how good someone is at one trade, 0–100. It grows only by doing that trade, or a related one at a quarter of the rate (each class's row names those). Each point takes `(5 + P ÷ 2)` minutes of work, with the bonuses of §7.3: about 4.6 hours to 25, 14 to 50, 29 to 75, 41 to 90 and 50 to 100. **Magic is learned at a twentieth of that speed** (§10.8).

- **The cap** is `40 + 3 ×` the trade's attribute, so an average person stops at 70, and only someone with 20 in that attribute reaches 100. Attribute points (§4.1) raise it.
- **What it does:** work speed (§4.2); the quality of what they make (`15-item-library.md` §1); +0.4% damage per point with weapons of that proficiency, and less spread for ranged ones (§5.7); +1% healing per point of medicine; +0.5% skill effect per point of magic or rites; capacity for officials (§13.3); and it unlocks the class's skills (§11.1).
- **Trade ranks** follow from it, for every trade: **Apprentice** 0–24, **Journeyman** 25–49, **Adept** 50–74, **Master** 75–94, **Grandmaster** 95–100. A Master teaches (§7.3) and can make masterwork goods; a Grandmaster's work never comes out below quality 80. These replace the mage-only ranks of earlier drafts.

| ID | Name | Attribute | Tooltip |
|---|---|---|---|
| `prof.farming` | Farming | Endurance | Sowing, tending and harvesting crops |
| `prof.husbandry` | Husbandry | Will | Keeping, breeding and handling animals, hounds and horses |
| `prof.fieldcraft` | Fieldcraft | Agility | Tracking, foraging, fishing, trapping and moving unseen |
| `prof.mining` | Mining | Strength | Breaking rock and ore, and reading where they run |
| `prof.woodcutting` | Woodcutting | Strength | Felling trees and splitting timber |
| `prof.building` | Building | Endurance | Raising, bracing and repairing structures |
| `prof.masonry` | Masonry | Strength | Dressing stone, laying walls, cutting gems and crystal |
| `prof.carpentry` | Carpentry | Agility | Timber work, from beams and boats to carts and bows |
| `prof.smithing` | Smithing | Strength | Smelting and working metal |
| `prof.kilncraft` | Kilncraft | Intellect | Pottery, brick, glass and charcoal |
| `prof.cooking` | Cooking | Intellect | Milling, baking, brewing, butchery, salting and cooking |
| `prof.tailoring` | Tailoring | Agility | Spinning, weaving, tanning and sewing |
| `prof.hauling` | Hauling | Endurance | Carrying, driving carts and handling boats |
| `prof.riding` | Riding | Agility | Riding and fighting from the saddle |
| `prof.alchemy` | Alchemy | Intellect | Draughts, salves, oils, powders and reagents |
| `prof.medicine` | Medicine | Intellect | Treating wounds, illness and the Downed |
| `prof.letters` | Letters | Intellect | Reading, writing, records, signals and teaching |
| `prof.engineering` | Engineering | Intellect | Machines, lifts, bridges and the mana grid's parts |
| `prof.trade` | Trade | Will | Buying, selling, bargaining and keeping a house |
| `prof.management` | Management | Intellect | Running people: crews, offices and commands |
| `prof.rites` | Rites | Will | The Hearth's rites: funerals, shrines, offerings |
| `prof.melee` | Melee | Strength | Fighting hand to hand · uses Agility instead when it is higher |
| `prof.ranged` | Ranged | Agility | Bows, crossbows, slings and thrown weapons |
| `prof.siege` | Siege | Intellect | Building, aiming and breaking with siege engines and charges |
| `prof.magic` | Magic | Affinity | Shaping mana · Affinity 15 or more to learn it at all |

---
## 9. Grades: the power ladder

### 9.1 The seven grades

| Grade | Levels | Might | Reached by | Places | Wage |
|---|---|---|---|---|---|
| **Common** | 1–10 | ×1.0 | being born | — | ×1 |
| **Proven** | 11–20 | ×1.5 | level 11, by itself | — | ×1 |
| **Tempered** | 21–30 | ×2.0 | the class deed (§10.4), by itself | — | ×1.5 |
| **Elite** | 31–40 | ×2.5 | promotion by the player, with proficiency 60 in the class's trade | 1 per 20 people | ×4 |
| **Champion** | 41–50 | ×3.0 | the Trial, played (§9.3) | 1 per 100 people | ×10 |
| **Paragon** | 51–60 | ×3.5 | a bound Warden relic, or the Marrow Rite (§9.4) | 1 per 1,000 people | ×25 |
| **Calamity** | 61–70 | ×4.0 | one of four paths (§15) | 1 per kingdom, plus one Oathbound | upkeep instead (§15.4) |

- **Places** are counted against the kingdom's whole population. Losing people never demotes anyone, but nobody new is promoted while the kingdom is over a limit.
- **Wage** multiplies the class's wage (`05-systems.md` §11). Elites want the Craftsman tier's needs, Champions and above the Noble tier's (`05-systems.md` §7).
- **A promotion** happens the moment its gate is met (Proven, Tempered) or when the player presses Promote (`person.promote`) with the gate met (Elite and above). It refills Health. Nobody is ever demoted, except a Calamity that falls (§15.4) and a Paragon who unbinds a relic (§9.4).

### 9.2 Linear in power, hard to climb

Every grade adds the same thing: half a point of Might, ten more levels, and gear one tier better (20 more armour, 10 more weapon damage). That is the owner's "linear in power". What climbs steeply is the price: each level takes longer than the last (§7), the gates get harder, and the places get scarcer. Two rules make the top worth the price: **Overmatch** (§5.4) makes a gap of two or more grades decisive, and the broken things (Masteries, relics, a Calamity's traits and Cataclysms) all sit at the top.

**The benchmark ladder.** A line fighter (6 Health per level) at the top level of each grade, with Strength and Endurance at `12 + grade`, proficiency 25, 40, 55, 70, 85, 100, 100, gear of the tier matching its grade (a sword of `10 + 10 × tier`, a plate set of `10 + 20 × tier` armour) and quality bonuses of 0, 0, 5, 10, 10, 15 and 20%:

| Grade, level | Health | Armour | Hit | Damage a second | Effective Health | Worth |
|---|---|---|---|---|---|---|
| Common 10 | 166 | 30 | 26 | 41 | 216 | 0.18 |
| Proven 20 | 345 | 50 | 59 | 95 | 518 | 1.00 |
| Tempered 30 | 588 | 70 | 109 | 174 | 1,000 | 3.54 |
| Elite 40 | 895 | 90 | 173 | 277 | 1,701 | 9.57 |
| Champion 50 | 1,266 | 110 | 249 | 398 | 2,659 | 21.54 |
| Paragon 60 | 1,701 | 130 | 342 | 548 | 3,912 | 43.57 |
| Calamity 70 | 2,200 | 150 | 446 | 713 | 5,500 | 79.73 |

*Effective Health* is Health × `(1 + armour ÷ 100)`. *Worth* is effective Health × damage a second, measured against the Proven soldier: roughly how many Proven soldiers it beats one after another. The ladder ignores damage types, as if every hit were Point against mail. Overmatch multiplies a higher grade's effective Health against lower grades on top of this (×1.33 at a gap of 2, ×2 at 3, ×4 at 4, ×10 at 5 or more). A Calamity's Flame and traits come on top of the last line (§15). `node docs/tools/content-check.mjs --ladder` recomputes this table from §4 and §5; if a rule changes, the table changes with it.

### 9.3 The Trial

The step to Champion. Each class family has a Trial (`14-class-library.md` §5): a feat of the trade done in one go, by a **played** unit, with a Champion place free. The player starts it from the inspector (`person.trial`). Failing (going Downed, or leaving it unfinished) costs nothing but time, and it can be tried again after an in-game day.

### 9.4 Binding a relic, and the Marrow Rite

The step to Paragon. Either:
- **bind a Warden relic** (`15-item-library.md` §9) in a relic slot: an in-game hour at any hearth-shrine. A bound relic can be taken off again: the person falls back to Champion at level 50, and experience above it is lost.
- or **the Marrow Rite**, for kingdoms with no relic to spare: 20 titan marrow, 50 pure mana crystal and 10 deep pearls burned over an in-game day at a hearth-shrine, with a Hearthkeeper of Master rank or the High Hearthkeeper present and the person never more than 16 m away. These come from the Upper Deep (`02-world.md` §5), so the Rite waits on Layer 1.

---

## 10. Classes

### 10.1 Kinds

| Kind | How many | Where |
|---|---|---|
| Civilian | 52, in 11 families: Field, Wild, Earth, Wood, Fire, Stone, Thread, Table, Road, Mind and Hall | `14-class-library.md` §2 |
| Military | 13 base classes, each with two advanced classes (the Mage has four) | `14-class-library.md` §3 |
| The king | one, unique to each kingdom | §14, and `14-class-library.md` §4 |

Each class's row gives its family, its proficiency (the trade that unlocks its skills), its two key attributes, its Health per level, where it works, how it earns Resolve, its deed, what else it trains, and the phase it ships in.

### 10.2 Choosing and changing a class

- The AI gives people the class that fits them best (attributes, proficiencies, traits; `05-systems.md` §6). The player can change it in the inspector (`person.class`) and pin it.
- A change takes effect at the next workplace of the new class, and the first in-game hour there runs at half speed. A military class first needs a full in-game day of drill at a training yard, as a Recruit.
- **Kept:** level, grade, attributes, every proficiency, Backgrounds and relics. **Lost:** the old class's skills (except a Background) and its Resolve.

### 10.3 Children and elders

From 12, children can be apprentices: they learn at ×1.5, work at half speed, and have their class's Knack only. Adults start at 16. From 60, elders work at 75% speed and learn at half speed (`05-systems.md` §5).

### 10.4 Deeds

Every class has one **deed**: a piece of its own work that proves the trade, such as a Miner's "break 3,000 blocks of stone or harder and clear a vein of 20 ore". Progress is kept for each class, even after a change. A completed deed gives 1,000 experience, opens the Ultimate (with proficiency 50) and lets the person rise to Tempered.

### 10.5 Backgrounds

When someone changes class, they may keep the **Knack** of one earlier class in which they reached Adept (proficiency 50). It is their **Background**. From Champion they may keep two. This is how careers are built: a Hunter who becomes an Archer keeps the Hunter's eye for game; a Miner who becomes a Sapper keeps a feel for rock.

### 10.6 Speciality (civilians, from Elite)

An Elite civilian picks one product line or resource of the class (a Smith's blades, a Farmer's grain, a Miner's iron): +20% work speed and +10 quality on it, −10% work speed on everything else of the class. Picking again takes an in-game day.

### 10.7 Advanced classes (military, from Elite)

On promotion to Elite, a soldier picks one of its base class's advanced classes: one of two, or of four for the Mage. The choice is **permanent**. It brings an **Art** (a second active skill) at once and a **Mastery** at Champion.

### 10.8 Mages

The Mage (military), and the Enchanter and Attuner (civilian, Mind family) need Affinity 15 or more and must learn at an Academy with a teacher: a Master of magic, or scrolls. Magic proficiency grows at a twentieth of the normal speed (§8), so a mage takes about a real week to reach Journeyman, three to Adept and seven to Master, faster when played. They are a kingdom's scarcest people (`05-systems.md` §9).

---

## 11. Skills

### 11.1 Slots

| Slot | Kind | Opens with | Key |
|---|---|---|---|
| **Knack** | passive | the class | — |
| **Active** | cooldown | proficiency 25 (Journeyman) | Z |
| **Ultimate** | 100 Resolve | proficiency 50 (Adept) and the class deed | X |
| **Art** | cooldown | an advanced class (Elite), with proficiency 75 (Master) | C |
| **Mastery** | passive | Champion grade, with proficiency 90 | — |
| **Relic** | the relic's | a relic in a relic slot: the first slot opens at Champion, the second at Paragon | V, R |
| **Cataclysm** | 10-minute cooldown | Calamity | G, held 1 s |
| **Office skill** | the office's | holding an office (§13.3) | none: used from the office (K) or the inspector |

Civilians have Knack, Active, Ultimate and Mastery. Military base classes have Knack, Active and Ultimate, and their advanced classes add an Art and a Mastery. A Background adds a Knack (§10.5).

### 11.2 What skills cost

- **Stamina,** for most.
- **Mana,** for mage classes and a few others whose rows say so. A unit with too little may still cast: each missing point costs 2 Health and adds 1 **Mana burn**.
- **Health,** for a few desperate skills.
- **An item** from the pack, where the row names one (a Sapper's charge, an Apothecary's draught).
- **Resolve,** for Ultimates: all 100.
- **Flame,** for Cataclysms: a tenth of the Calamity's max Flame.

### 11.3 Resolve

Resolve runs from 0 to 100 and is kept until used; a class change empties it. Each class earns it by one of three rules (its row says which), and a played unit earns it ×1.5:

| Rule | Earned by |
|---|---|
| **Work** | 1 for every 6 s of the class's own work, so 10 minutes of work fills it |

An Ultimate's own hits, heals and shields earn no Resolve, and none comes for 10 s after one. With these rules an Ultimate takes about 90 s of steady fighting, or 10 minutes of work.
| **Fight** | 1 for each hit landed on a foe or taken from one, at most 1 a second (blocked hits count); 5 for a kill of a foe of equal or higher grade, 1 for a lower one. Officers, Heralds and the king also earn a tenth of what the soldiers they lead within 16 m earn; a Houndmaster earns for their hounds' bites |
| **Aid** | 1 for each 2% of an ally's max Health actually restored or absorbed; 5 for a revive, once per person a minute |

### 11.4 Aiming

Every skill row gives its **reach**, in one of these forms:

| Form | Means |
|---|---|
| **Self** | the user only |
| **Target** | one creature within the given distance, under the aim point. A creature is anything alive: people, animals and the Deep's creatures |
| **Point** | a place within the given distance: a circle of the given radius is drawn there while the key is held. It stays where it was put; "Point 0 m" is at the user's feet |
| **Direction** | a cone or a line from the user toward the aim point, drawn while the key is held |
| **Aura** | everything within the given radius of the user, for as long as the skill lasts |
| **Blocks** | blocks in a shape (a column, a vein, a wall face, a cube) chosen with the aim point, within 4.5 m unless the row says otherwise |
| **Jurisdiction** | everything an official runs: their settlement, province, parish or the realm (office skills only) |

Ordered from Command view, the inspector's skill button turns the cursor into the same shape (§3.7). Siege engines are aimed at as Targets.

### 11.5 Timing

- **Wind-up:** 0 to 1.5 s, given in the row, shown by the avatar's pose. Being Staggered or Stunned during it cancels the skill and refunds half its cost. The user moves at half speed while winding up.
- **After any skill,** no other skill can start for 0.5 s.
- **A cooldown** starts when the skill's effect ends, except for a skill that leaves something in the world (a trap, a mark, a ward, a placed area): its cooldown starts once that is placed.
- **Lasts** in a row is how long its effect holds. A row with no duration acts once.

### 11.6 When the AI uses skills

Every active skill has an **autocast** switch (`person.autocast`): Actives and Arts start on, Ultimates off. A policy can switch Ultimates on for everyone in a jurisdiction (`policy.ultimates`). With autocast on, the unit uses the skill by its kind:

| Kind | Used |
|---|---|
| information | on starting work in a new place, and when an enemy is reported within 64 m |
| a work boost | while working, whenever ready |
| a buff | at the start of a fight, on itself or the nearest ally who lacks it |
| a heal or shield | on the ally within reach with the lowest share of Health, once under 50% |
| damage | on cooldown, at the best target in reach |
| control | on the highest-grade enemy in reach |

A row marked **played only** is never autocast and can't be ordered: only the player's hands use it.

### 11.7 How numbers scale

- A number marked **◆** multiplies by the user's **Power**, `Might × (1 + (level − 1) ÷ 20)`, which grows with grade and level as Health does: 1.0 for a new Common, 1.45 at level 10, 2.9 at 20, 4.9 at 30, 7.4 at 40, 10.4 at 50, 13.8 at 60 and 17.8 at 70. So a heal or a shield keeps pace with the Health it has to cover.
- A number written as a share of a hit ("150% of a hit") follows the hit formula of §5.1, which already includes grade, level, attributes, proficiency, gear and every bonus.
- Durations, radii, cooldowns and percentages don't scale unless the row says so.
- The Support role adds 25% to heals and shields, and 25% to the time buffs last (§12).

### 11.8 Information skills

Most skills tell the user something. They take four forms, and they share four rules:

| Form | What it does |
|---|---|
| **Reveal** | outlines things of one kind (ore, water, tracks, weak blocks, hidden people, buried rooms) through blocks, within a radius, for a time |
| **Read** | adds numbers to a target's inspector and tooltip: a field's fertility, a wall's integrity, an enemy's grade and Health, a stranger's loyalty |
| **Mark** | puts a mark on a thing that others act on: prey for hunters, a vein for miners, a foe for archers |
| **Survey** | fills in an area of the map and its overlays: deposits, hazards, paths |

1. What a unit learns, its king learns: at once inside connected coverage, otherwise when the news reaches the capital (`05-systems.md` §4).
2. What it learned stays on the map as a last-seen mark with its age, as all sightings do.
3. Other kingdoms never see your Reveals or Marks, except **Marked** on their own people.
4. A Reveal shows only what lies within its radius of the user; it never draws open space the player hasn't earned under the cut (C2), except the things it names.

### 11.9 Friendly fire

Hits and skills never hurt your own people or your allies'. A Cataclysm's row says whom it hits: "every creature" means friend and foe alike, "foe" means foes only. Terrain it changes falls on whoever is under it, and a Calamity is never hurt by its own Cataclysm.

### 11.10 Budgets

Rows in `14-class-library.md` are written to these budgets. A row may break one only by naming the rule it breaks, and only in a Mastery, a relic or a Cataclysm. Damage over time from conditions counts toward a damage budget, and so do a row's built-in "more" multipliers (a charging lance's ×1.5). An area is given by its radius; a cone or a line may reach farther as long as it covers no more ground than that circle (a 6 m circle is about 110 m², so a line 3 m wide may run 36 m).

| Slot | What it is | Budget |
|---|---|---|
| Knack | a small, always-on edge in the class's own work, or a sense | +10% to one thing of its work (+15% at most), and at most one smaller edge: +5% to something else, or a passive Reveal or Read of 8 m at most. A civilian Knack adds fighting power only with the class's own tools or one weapon family |
| Active | mostly information or help with the work | cooldown 15–90 s; 10–30 Stamina or 10–40 Mana; effects last 5–20 s, so uptime stays under a third. At most 150% of a hit on one target, or 80% on everything within 3 m. Stunned, Rooted, Frozen or Feared for 1 s at most, on everything within 3 m at most. Buffs on others within 8 m. A work boost of +50% at most, for 15 s at most. Reveal radius 24 m at most; a civilian skill reveals **Hidden** foes within 12 m at most |
| Ultimate | one big moment | 100 Resolve. About three Actives' worth: at most 400% of a hit on one target or 200% on everything within 6 m; hard control 2 s at most, on everything within 12 m at most; buffs on others within 16 m; Reveal 64 m at most; or one feat of the trade (a piece at the best quality its maker can reach, a whole vein at once, a field brought in within a minute) |
| Art | an advanced class's second active | cooldown 20–120 s; 10–40 Stamina or 10–60 Mana; effects last 5–20 s; at most 250% of a hit on one target or 120% within 5 m; hard control 1.5 s at most, on everything within 6 m at most; buffs on others within 12 m; Reveal 32 m at most |
| Mastery | bends one rule of the design docs, for this person or for what they make, tend or lead | names the doc and section it bends; a flat +25% at most, or ×2 on one range, capacity or rate; it may switch a limit off for this person ("sprinting costs no Stamina") |
| Relic | a Warden's power | `15-item-library.md` §9: a Tier I relic is about an Ultimate on a 3-minute cooldown plus a small passive; each tier up is ×1.5 (◆100, 150, 225, 340, 500 for heals and shields), areas 6–8 m; the three Tier V relics are Calamity paths |
| Cataclysm | the map changes | 600 s cooldown; a tenth of max Flame; a radius of up to 48 m for damage and 32 m for terrain; up to 20 × a hit on each creature in the area. Every damaging Cataclysm also deals 200,000 siege damage once to each Warden in its area (400,000 with Sunder) |

---

## 12. Roles

Every military unit has one role, chosen in the inspector (`person.role`). A change takes an in-game hour. Civilians have none.

| Role | In a fight | How the AI plays it | Its right |
|---|---|---|---|
| **Assault** | damage +15% (increased); armour −10%; sprint +10% | closes in, picks the weakest foe in reach, chases | at Champion or higher, may swear the Oath (§15.3) |
| **Guard** | armour +20%; Block +25%; enemy AI within 6 m prefers to attack it; speed −10% | holds near its ward, blocks, steps into the way | a **ward**: a person, a building or a banner it keeps within 8 m of. Once every 10 s it takes a hit meant for its ward within 3 m |
| **Support** | heals and shields +25%, buffs last 25% longer; cooldowns −20%; damage −15% | keeps 12–24 m behind the front; heals, buffs, reveals | enemy AI attacks it only when nothing else is in reach |
| **Secondary** | damage +20% against foes already fighting someone else or under half Health; speed +10% | follows 4–8 m behind the front, fills gaps, finishes | a **day trade**: stood down, it works one civilian class with that class's Knack at 75% speed and half wages; called up, it musters in an in-game hour |

---

## 13. Ranks and offices

### 13.1 Military ranks

| Rank | Leads | Radius | Needs | Pay | Gives within the radius |
|---|---|---|---|---|---|
| **Recruit** | — | — | in drill | ×0.5 | — |
| **Private** | — | — | a day of drill | ×1 | — |
| **Corporal** | a file of 5 | 8 m | level 10 | ×1.25 | morale +5 |
| **Sergeant** | a squad of 10 | 16 m | level 20, management 15 | ×1.5 | morale +10; drill experience +25% |
| **Lieutenant** | a company, as its second | 32 m | level 25, management 30 | ×2 | morale +10; takes the company if its Captain falls |
| **Captain** | a company of 10–50 | 64 m | level 30, management 40 | ×3 | morale +15; orders without delay when played (the order wheel) |
| **Commander** | up to 5 companies | 96 m | Elite, management 55 | ×5 | morale +15; as a Captain, over all the Commander's companies |
| **Marshal** | an army | 160 m | Champion, management 70 | ×8 | morale +20; as a Captain, over the whole army |

- Only the highest officer's morale bonus counts for a soldier. A soldier hears an officer's orders without delay only from its own chain of command.
- Corporals, Sergeants and Lieutenants are promoted by their Captain when a place opens, or by the player. Captains are appointed when a company is raised (`army.new.captain`), Commanders by the player or a Marshal, the Marshal by the king. The class Warrior is a class, not a rank.

### 13.2 Trade ranks and posts

Trade ranks come from proficiency (§8): Apprentice, Journeyman, Adept, Master, Grandmaster. Two posts sit above them:

| Post | Runs | Needs | Gives |
|---|---|---|---|
| **Foreman** | one workplace's crew, up to 12 | Adept in the trade, management 15 | the crew within 16 m: +10% work speed. Adds 12 to the Reeve's capacity |
| **Overseer** | one trade across a settlement | Master in the trade, management 35 | that trade's workers: +5 quality; their apprentices learn 25% faster. Adds 30 to the Reeve's capacity |

### 13.3 The government

From the top: **the king**, then the **Crown Council**, then **Governors**, then **Reeves**, then the **local posts**. A higher official's policies win inside the lower one's jurisdiction. Each office has one office skill (`14-class-library.md` §6), used from the office (K) while playing them, or from their inspector.

| Office | Runs | Appointed by | Needs |
|---|---|---|---|
| **Chancellor** | the realm while the king is away: policies, and appointments below the council | the king | management 60, Noble tier |
| **Marshal** | the armies (§13.1) | the king | Champion, management 70 |
| **Treasurer** | the mint, payroll, taxes and the treasury | the king | trade or letters 50 |
| **Quartermaster** | routes, haulers and stock targets between settlements | the king | management 40 |
| **Magister** | mages, the Academy and the mana grid | the king | magic 50 |
| **Envoy** | trade orders and diplomacy | the king | trade 40 |
| **Spymaster** | scouts and assassins; swaying other kings' people, and stopping them swaying yours (`05-systems.md` §8) | the king | letters 40, fieldcraft 30 |
| **High Hearthkeeper** | the faith: shrines, funerals, festivals and the Great Hearth (§15.3) | the king | rites 60 |
| **Governor** | a province: up to 6 settlements and their Reeves | the king or the Chancellor | management 50 |
| **Reeve** | a settlement: jobs, housing, building, upkeep | a Governor, the Chancellor or the king | management 20 |
| **Bailiff** | a settlement's watch, gates and peace | its Reeve | melee or fieldcraft 30 |
| **Storekeeper** | a settlement's stores and stock targets | its Reeve | letters or trade 20 |
| **Paymaster** | a settlement's wages and pay chests | the Treasurer | letters 25 |
| **Hearthkeeper** | a hearth-shrine and its parish | the High Hearthkeeper | rites 25 |

Capacities and loads are as in `05-systems.md` §6, with the posts of §13.2 adding to a Reeve's.

---

## 14. The king

The king is the player's own avatar, and is no class's member: no level, no grade, no proficiencies to grow. The king counts as Paragon for Overmatch (§5.4).

| | |
|---|---|
| Health | 3,600; 1% regained a second after 10 s out of a fight |
| Stamina | 200 |
| Armour | 40 of the king's own, plus what the king wears |
| Damage | the weapon's, with +250% increased in place of the attribute, proficiency, level and grade terms |
| Speed | as Agility 12 |
| Downed | 60 s (§5.9). If the king dies, the kingdom falls (`05-systems.md` §2) |
| Skills | a Knack, an Active and an Ultimate (`14-class-library.md` §4); the order wheel over everyone within 96 m |
| Power | 13.8, a level-60 Paragon's, for the ◆ numbers of the king's skills (§11.7) |

With steel the king is worth about 35 Proven soldiers, and about 50 with brimsteel (§9.2): enough to hold off an ambush long enough to escape, never enough to beat an army or a Warden alone. The king can never be a Calamity.

---
## 15. Calamities

### 15.1 What a Calamity is

A person bound to a fire that must be fed: in the lore, a small copy of what the King Below did to himself (`03-lore.md` §3, §6), which is why the Hearth both makes and fears them. Court speech calls them *saiyaku*. Every Calamity has:

- **Mantle.** It counts as grade 7 for Overmatch, so Common and Proven attackers do a tenth of their damage, Tempered a quarter, Elite half and Champions three quarters. It can't be Staggered, Feared or Taunted, and Stunned, Rooted, Frozen and Slowed hold it for a quarter of their time, half a second at most.
- **Sunder.** Its hits and skills break the block they strike and every block within 1 m of it, as siege damage. Against creatures they ignore half of armour. Against Wardens, generals and structures they do double damage, every number included (a Cataclysm's too).
- **Dread.** Enemies below Elite within 32 m lose 5 morale a second, and their AI won't close on it unless ordered to.
- **Flame:** a second life pool (§15.2).
- **A Cataclysm** of its class family (`14-class-library.md` §3.5).
- **No hiding.** It shows, live, on the map of every king whose coverage comes within 2 km of it.

### 15.2 Flame

Flame takes damage after Shielded and before Health (§5.1). A Calamity is never Downed: it dies when its Flame and its Health are both gone.

| Path | Max Flame | Refilled by |
|---|---|---|
| Kindled | 40 per member of the congregation, 40,000 at most | offerings burned at the Great Hearth: 1 Flame per offering point, 300 a second at most, only while the Calamity is inside connected coverage |
| Oathbound | 30,000 | nothing |
| Crownbearer | 15,000 | 5% of the damage it deals to creatures |
| Relic-bound | the relic's (`15-item-library.md` §9) | the relic's hunger, 30 a second at most |

### 15.3 The four paths

**Kindled: the Hearth's way.** The way most kingdoms will try, and the hardest to keep.
- **The candidate:** a Paragon at level 60.
- **The Great Hearth:** one building per kingdom, in the capital's coverage. Its required parts (`05-systems.md` §13): a hearth of 5 × 5 fireclay-brick blocks around a **hearth heart** (4 titan bone, 10 moonsilver ingots, 6 pure mana crystal), a chimney with a path to open sky, and an enclosed stone hall of at least 600 m³.
- **The congregation:** the people whose homes lie within 150 m of a hearth-shrine connected (by coverage) to the Great Hearth. Each shrine counts up to 50 of them, so 300, the least the Kindling needs, takes six shrines. Worship takes a twentieth of their day: they work 5% less.
- **The Kindling:** seven in-game days at the Great Hearth. The candidate never goes farther than 64 m from it, the High Hearthkeeper attends each day, and 100,000 offering points are burned in it over the seven days. If the candidate leaves or the Hearth goes cold, the Kindling starts over and half of what was burned is lost.
- **Offering points:** a good is worth its reference price in Marks (`05-systems.md` §11). Only what burns or is precious counts: fuel, food, drink, cloth, timber, crystal, pearls, precious metals and jewels. Coin and tools don't.
- **Upkeep:** every in-game day, 2,000 offering points plus 4 for each member of the congregation, burned from the capital's stores. Flame regained in a fight costs more on top (§15.2). A day not fully paid leaves the Calamity **Guttering** (§15.4).

**Oathbound: the soldier's way.**
- **Who:** an Assault soldier (§12) of Champion grade or higher.
- **The Oath** is sworn at any hearth-shrine with the king or the High Hearthkeeper within 16 m (`person.oath`, with a confirmation). From then they are **Oathsworn**, and can't be unsworn.
- **The fire:** within three in-game days, the player calls it (`person.fire`, or G while playing them). If nobody calls it, it comes by itself at the end of the third day.
- **One day of fire:** they become a level-70 Calamity at once, with 30,000 Flame that never refills. When the in-game day ends, or when Flame and Health are gone, they burn to ash: dead, for good. Their gear drops.

**Crownbearer: the conqueror's way.**
- When a king is killed by another kingdom's people, **the Broken Crown** (`15-item-library.md` §9) falls where the king died.
- A Paragon who wears it becomes a Calamity at their current level, and climbs to 70 as anyone does. No upkeep.
- The bearer is shown, live, on every king's map wherever it goes, and every faction of the Deep knows where it is. When it dies, the crown falls where it fell. Taking the crown off makes it fall as §15.4 says.

**Relic-bound: the deep way.**
- The three Tier V relics, **the Ichor Heart**, **the Ashen Veil** and **the War-Smith's Hammer**, each make the Paragon who binds one a Calamity at their current level, who then climbs to 70 as anyone does. A Champion who binds one only becomes a Paragon (§9.4). Unbound, the bearer falls as §15.4 says.
- Each has a **hunger** (`15-item-library.md` §9): a hungry relic leaves its bearer Guttering, as an unpaid Hearth does.

### 15.4 Guttering and falling

- **Guttering:** max Flame is halved and nothing refills it, until a full day's upkeep (or the relic's hunger) is met.
- **Three days of Guttering in a row,** or a Crownbearer taking the crown off: the Calamity **falls** to Paragon at level 60, Wounded, and loses all experience above level 60. A Kindled Calamity's fall leaves the Great Hearth cold for four in-game years (four real weeks): no Kindling there until it warms.
- An Oathbound never falls. It burns.

### 15.5 Death, limits and news

- **Death is permanent.** A Kindled Calamity's death also leaves the Great Hearth cold for four in-game years, and costs its congregation 15 loyalty.
- **Limits:** one seated Calamity per kingdom (Kindled, Crownbearer or Relic-bound), plus one Oathbound, sworn or burning. A kingdom may keep a second crown or relic in a store, but nobody can wear it while a Calamity sits.
- **News:** every king hears when a Calamity rises and when one falls or dies, and the Chronicle records it (E1 and E5 of the catalogue).

### 15.6 What one can do

- **Level mountains.** A Cataclysm removes up to 32 m of terrain around its point every ten minutes, and Sunder breaks whatever the Calamity strikes.
- **Break a small kingdom.** After Overmatch and armour, a Proven soldier's hit does about 2 damage to it. It kills nearly one such soldier a second with plain blows, and a Cataclysm flattens a settlement's heart (48 m) at once. Its Flame decides how long it can keep that up away from home.
- **Solo an easier Warden.** Sunder doubles its damage to Wardens and ignores half their armour, about 950 damage a second, and each Cataclysm adds 400,000: about three quarters of an hour against a Tier I Warden (4 million Health), if the player dodges the telegraphed heavy hits. Every hit it takes burns Flame, and Flame is offerings.
- **Hold a kingdom alone.** At home, a Kindled Calamity's Flame refills at up to 300 a second, a point of offerings for each point of Flame, for as long as the stores last: fifty Elites can't outpace it, but the stores can run dry.

### 15.7 How to answer one

Starve it: raid the shrines and the offerings, and the Hearth gutters. Make it fight far from its coverage, where its Flame doesn't refill. Bring siege engines and Champions, which Overmatch barely touches; bring your own Calamity. Let an Oathbound's day run out. Dread doesn't work on Elites, so an Elite core holds where levies flee. And it is one body: it can only be in one place.

---

## 16. Enemies and Wardens on the same scale

The Deep's soldiers use the same rules as people (§5), without Downed. Their grade comes from their tier and rank.

**Kinds of creature.** Rows that name a kind mean these: **people** (anyone of any kingdom, the Steward excepted), **beasts** (animals, tame or wild), **creatures of the Deep** (every Warden's faction, whatever its body), **the risen dead**, **Hollows**, **shades**, **constructs**, **generals** and **Wardens**. A creature can be of more than one kind: a general of the Gravewarden's is of the Deep, risen and a general.

| Tier | Soldier Health | Armour | Hit | Grade |
|---|---|---|---|---|
| I | 350 | 70 | 60 | Proven |
| II | 480 | 85 | 85 | Proven |
| III | 600 | 100 | 110 | Tempered |
| IV | 760 | 115 | 140 | Tempered |
| V | 900 | 130 | 175 | Elite |
| VI | 1,100 | 150 | 215 | Elite |

- **Minion:** ×0.4 Health, ×0.5 hit, half the armour, one grade lower. **Elite:** ×2 Health, ×1.4 hit, +30 armour, one grade higher. **General:** ×12 Health, ×2.5 hit, +60 armour, two grades higher, and skills of its own (written with its Warden in `02-world.md` §7).
- A Tier I soldier is worth about one Proven soldier, a Tier III one about four and a Tier V one about twelve (the measure of §9.2).

| Warden tier | Health | Armour | Heavy hit | Wave |
|---|---|---|---|---|
| I | 4,000,000 | 100 | 900 | 250 |
| II | 10,000,000 | 120 | 1,260 | 350 |
| III | 25,000,000 | 140 | 1,760 | 490 |
| IV | 62,000,000 | 160 | 2,470 | 690 |
| V | 156,000,000 | 180 | 3,460 | 960 |
| The King Below | 390,000,000 | 200 | 4,840 | 1,340 |

- A **heavy hit** strikes one target about every 6 s, telegraphed for at least 1 s, and is **crushing** (§5.5). A **wave** strikes an area about every 15 s, telegraphed for at least 1.5 s. Each Warden's kit (`02-world.md` §7, `05-systems.md` §18) shapes these into its own attacks.
- Wardens ignore Overmatch and get none. They can't be Stunned, Rooted, Frozen, Feared or Taunted; Slowed and Chilled hold them for a quarter of their time; effects that take a share of max Health don't work on them. A Fortress Warden takes 90% less from everything but siege.
- The Tier I figure is the design target of `05-systems.md` §18: 200 Proven soldiers, a third of them striking at any moment, through 100 armour, for 20 minutes.

---

## 17. Min-maxing

### 17.1 The levers

- **Who:** attributes, traits and age decide caps and learning speed (§4, §8). The game flags standouts; the player decides.
- **Attribute points:** one every five levels, placed by hand (§4.1).
- **Careers:** the order of classes decides which Knacks come along as Backgrounds (§10.5).
- **Speciality, advanced class and role** (§10.6, §10.7, §12).
- **Gear:** tier, material traits, quality, runes and charms (`15-item-library.md`).
- **Food and drink:** one meal and one drink at a time (§6).
- **Learning:** played time, First light, Teachers and Masters nearby, Intellect (§7.3).
- **Places and grades:** who gets the scarce Elite, Champion and Paragon places, and when (§9).
- **Officers and posts:** a Foreman's crew, a Sergeant's drill, a Captain's reach (§13).
- **The fight:** flank and rear, falling strikes, parries, high ground, Overmatch, and when to spend Resolve (§5, §11.3).

### 17.2 Stacking rules

- *Increased* bonuses add up; *more* multipliers multiply, and their product stops at ×2.5 unless a row says *uncapped* (§5.1). Increased bonuses matter less as a unit climbs (its own grade and level are increased bonuses too), so item bonuses that should count at the top are written as *more*.
- Different sources add by their kind, even when they raise the same number (a Foreman's +10% and a skill's +20% work speed make +30%). But **the same named effect counts once**, the larger: two Foremen, two copies of one charm, one trait from both a metal and a rune of the same name. Conditions stack only where §6 says.
- Caps: elemental resistance 75%; armour ignored 75% at most (armour-piercing from different sources adds up to it); cooldowns cut by 40% at most; speed raised by 50% at most; damage taken cut by 75% at most by bonuses and conditions (armour and Overmatch apart). Added elemental damage from different sources adds up. Only the largest true damage on a hit counts. Hazard protections multiply (§6).
- Only the highest officer's morale bonus counts (§13.1).

### 17.3 Three builds

- **The deep miner.** A Miner born with Strength 17 (cap 91): three attribute points take it to 20 and the cap to 100. Background: the Prospector's Knack. Speciality: iron. Played during First light near a Master miner, with a rimesteel pick; the Ultimate kept for the biggest veins.
- **The glass cannon.** A Marksman with Agility 20 in the Assault role: +15% damage, rear shots from high ground at Marked targets, and Merry never, because it widens the spread.
- **The wall.** A Bulwark in the Guard role with a tower shield, plate and the Fortified buffs, warding a Mender: Block +25%, armour +20%, and parries that only a player lands.

---

## 18. Off screen

Most people, most of the time, are in the ledger (`05-systems.md` §22). Its version of these rules must agree with the one above on average:

- **Work:** each class's Knack applies always; each Active adds its average uplift (its effect × its time ÷ (its time + its cooldown)), computed from the library when the content is built. Ultimates count only where the policy lets them autocast.
- **Learning:** experience, proficiency and Resolve come at the work rates, without played bonuses.
- **Battles:** each unit brings its effective Health and damage a second, with Overmatch applied against the other side's most common grade and skills counted at their average uplift, into the regiment model of `07-architecture.md` §9.
- **The Downed:** after a battle off screen, 30% of the fallen on the side that holds the field rise Wounded; the rest die, or are taken captive by another king's people.

---

## 19. Content and the pipeline

- **Where content lives:** this doc's tables of conditions (§6) and proficiencies (§8); `14-class-library.md` (classes, skills, deeds, Trials, office skills); `15-item-library.md` (items). Every table whose first column is **ID** is data, as in the catalogue.
- **Words.** Names: 3 words and 24 characters at most, sentence case. Tooltips: one line of 100 characters at most, no full stop, what it does first, then a cost, a limit or a second effect after `·`. No gendered pronouns: people are women and men, and so is the ruler. None of the words A2 of the catalogue bans. The interface adds the slot, cost, cooldown and reach lines itself (`tip.*`), so a tooltip never repeats them.
- **Tone.** Names are plain trade words ("Sound the rock", not "Earthsense"). Outside the mage classes, the Hearth's rites, relics and Calamities, a skill is something a skilled person could do: what an Active reveals is what an expert notices, and an Ultimate is a feat of effort, nerve or craft, not a spell. Mages' skills are mana: costly and dangerous (`03-lore.md` §2).
- **The rules column** names conditions in **bold** by their names in §6, uses the forms of §11.4 and §11.8, marks Might-scaled numbers with ◆, writes damage as a share of a hit where it can, and says **played only** where that applies.
- **The checker.** `node docs/tools/content-check.mjs` checks every content table: unique IDs; names and tooltips against the rules above; every bold word in a rules column is a condition or a keyword; each class has exactly its slots; costs and cooldowns sit inside §11.10's budgets for the slot; every ID a row mentions exists. `--ladder` prints §9.2's table from §4 and §5. `--json` prints the data for the game, and `--upto <phase>` limits it to what ships by then.
- **In the game.** From Milestone 2, `npm run content:build` writes `packages/shared/src/content/content.gen.json` from these docs, and `npm run check` fails when it is out of date, as `ui:strings` does for the catalogue. Skills are data run by a small set of handlers, one per aiming form, information form and condition, so most rows need no code of their own. The rows that do (Masteries, relics and Cataclysms) get one function each, named by the row's ID.
- **Changing content** is editing rows. A balance change is a row edit, made in the same commit as any test or golden-hash update it causes.

---

## 20. What ships when

| Phase | People and power |
|---|---|
| 1.1 | the avatar (§3.2); Shoulder for the free camera |
| 1.4 | Overhead for the free camera |
| M2 | attributes, Health and Stamina; levels and experience, with played time and First light; proficiencies and trade ranks; the classes marked M2; Knacks and Actives on keys, by order and by autocast; Common and Proven; the Band; the charm slot |
| M3 | the other civilian classes; deeds, Resolve and Ultimates; Tempered and Elite, Speciality and Backgrounds; Foremen and Overseers; the Chancellor, Governors, Bailiffs, Storekeepers, Paymasters, the High Hearthkeeper and Hearthkeepers; office skills |
| M4 | fighting (§5), conditions, Downed and Wounded; Overmatch; the military base classes, roles, and ranks up to Captain; Champions, Trials and the civilian Masteries; the first relic slot and the first relic. Until Milestone 6 a bound relic gives its powers but no promotion |
| M5 | advanced classes, their Arts and Masteries; Commanders and Marshals; the Envoy and the Spymaster; balance for war between kings |
| M6 | Mana and the mage classes; runes; Paragons, the second relic slot, the Marrow Rite and the Tier II and III relics; the Magister |
| M7 | Calamities: the four paths, the Great Hearth, the Broken Crown, the Tier IV and V relics and Cataclysms |

Each class, skill and item row carries its own **Since**; the content checker's `--upto` counts what a phase must hold.

**A row that ships before a system it touches** works without that part until the system arrives. A Butcher's Clean kill fells animals from Milestone 3, and its **Bleeding** starts with fighting in Milestone 4; a Hearthkeeper's rite raises loyalty from Milestone 3 and morale from Milestone 5. Each relic ships with its Warden (`08-roadmap.md`).
