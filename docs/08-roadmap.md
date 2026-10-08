# 08 · Roadmap

Every phase ends in a **playable link** plus a short **"try this" list** for the owner. Early phases fit in one session. **Phases 1.3–1.9 usually take 2–4 sessions each**, and every session ends at a green checkpoint: tests, check and build pass, and `progress.md` says exactly what's next. Tick phases off in `docs/progress.md`, never here.

**Postcards that won't pass** follow the timebox rule (`04-terrain.md` §14.4 and §14.6): after 4 fix-and-re-render cycles without a +2 gain, a postcard whose score of record is at most 2 below its bar, with no 0 on R1–R4, stops blocking. The phase is then "done with known issues", and phase 1.10 clears them. HELL-1 and HELL-2 must always pass.

**The interface in every phase** is exactly the rows marked with that phase in `11-interface-catalogue.md` (its Part F lists them phase by phase). A phase builds those rows, puts their states in the gallery, and checks them from screenshots (its A7). Every phase's "Done when" includes `npm run ui:lint -- --complete` passing for its rows. Nothing on screen is invented outside that doc.

Milestone 1 is planned in detail. Later milestones are outlines. **At the start of each later milestone, the agent drafts its detailed phase plan, adds it to this file, and asks the owner to approve it in the PR** before building past its first phase.

---

## Milestone 1 · The World

The goal: Big Globe-class terrain for the whole of Kaldmark, walkable in the browser. The spec is `04-terrain.md` (acceptance rules in its §14.4 and §16). **The order front-loads the owner's biggest worry, the hellscape**, then builds outward.

### 1.1 Foundations
- **Build, in this order** (push a playable build at the end of step 3, so the owner has a link early):
  1. Monorepo scaffold (npm workspaces, Vite, TS strict, Biome, Vitest, `.node-version`); constants; deterministic math (`det.ts`) and the forbidden-token test; hashes and OpenSimplex2 noise, with measured quantiles and tests; the test world (rolling plains with a pond at y = 0, placeholder trees).
  2. **The interface foundation, before the first screen** (`11-interface-catalogue.md` A3, A6, A7): `tokens.css`, the components the 1.1 screens use, the string table (`ui:strings`), the gallery (`/?gallery`), and `ui:lint` inside `npm run check`. Then: block registry and the first ~30 texture recipes; chunk store; worker pool; the bitwise greedy mesher with AO (ported, `10-prior-art.md` §2); the renderer: `SunLight` shadows, three's `Sky`, fog, pmndrs postprocessing; sky light (seeded from column heightmaps, then the ported light queues; coloured block light waits for 1.3); time of day (the cycle, a slider, a fixed postcard time); the player controller: first person, Minecraft's controls, and Minecraft's movement constants at a fixed 20 Hz (walk, sprint, sneak, jump, step-up 0.6 m, fly); break and place with a hotbar; the title screen, the loading bar and the menu (the rows marked 1.1).
  3. COOP/COEP headers (Pages `_headers`, and the Vite dev and preview servers); a build that works on Cloudflare Pages; the "WebGL2 unavailable" screen; the screenshot pipeline, TEST-1, and `ui:shots` for the gallery. **Push a playable build and open the draft PR.**
  4. Golden test and `golden:update`; atlas and slice (on the test world, `height` mode); postcards; `bench:gen`; the shipped CI workflow passing, with `test:golden:browsers` defined.
  5. Edits saved in IndexedDB; the F3 overlay, the Tools panel (F4) and the block palette; the remaining textures; `THIRD_PARTY_NOTICES.md`.
- **Owner tries:**
  1. Open the link and walk around. (Click to play: the game goes fullscreen and locks the keyboard so Ctrl-sprint works; without that, sprint is double-tap W.)
  2. Double-tap Space to fly (like Minecraft creative mode).
  3. Break and place blocks.
  4. Press F3 to see the debug info, and F4 for the tools (time of day, fog, fly speed).
  5. Reload: your edits are still there.
  6. Open `<link>/?gallery` to see every interface screen built so far.
- **Done when:** tests, check and build pass; the tools produce images; **TEST-1 ≥ 12/20** (self-scored); the 1.1 screens pass the checklist in `11-interface-catalogue.md` A7 from their screenshots, and `npm run ui:lint -- --complete` passes. Step 5 items and the CI's cross-browser job may slip into 1.2 if the session runs out; say so in the report.

### 1.2 World plan
- **Build:**
  - the WorldPlan: rings and sectors without trigonometry, warped borders, continuous blend weights, macro elevation, basins, water levels, drainage (Priority-Flood+FlowDirs, flow accumulation), the Nadir plateau and Rim, underground footprints and Voronoi, sites
  - a first-pass height function and palette for every surface region; psrdnoise (value and gradient in one call)
  - static surface water (the Grey Mere, the Blackwater, the Sallows, ponds; no open sea)
  - one ungraded first-pass postcard per region, so the owner can see every region early
  - streaming across the whole world
  - map (M) with teleport; discovery cards; the World select and "Go to region" (the rows marked 1.2)
- **Owner tries:**
  1. Open the map and teleport into several regions.
  2. Walk across a border and watch it blend.
  3. Find the Blackwater's shore.
- **Done when:**
  - each of the 12 ring regions measures 90–110 km² in the atlas, and ring borders sit within ±500 m of the radii in `02-world.md` §1
  - the sites atlas shows 30 Seats, every descent type in `02-world.md` §4, 3 land bridges, and spawn candidates only at r ≥ 16 km and ≥ 3 km from any Seat
  - the SW–NE slice matches `docs/diagrams/funnel.svg` for the surface profile, the footprint bands and the shelves (caverns, islands and the Sundering come later)
  - the test world still works as `?world=test`

### 1.3 Terrain toolkit + Ibara
- **Build:**
  - the SDF library (arc-length Béziers, rotation-minimising frames, polygon cross-sections)
  - feature cells with canonical ordering and the narrow band
  - per-voxel feature ID and `t`
  - the **full thorn spec** (`04-terrain.md` §8.5)
  - calderas, fissures, vents, ash dunes
  - Ibara lava network; lava fluid
  - emissive blocks, coloured block light, bloom
  - the terrain report, clay and feature views, the `?primitive=1` calibration anchor

  Postcards may use LOD0 out to 512 m until LOD arrives.
- **Owner tries:**
  1. Teleport to Ibara from the postcard list.
  2. Walk through a thorn forest.
  3. Stand on a caldera rim.
  4. Look at the thorns in clay view (`?view=clay`).
- **Done when:** HELL-1 and HELL-2 pass (including R2 = 2 and the blind review) on seeds 1–3, and the thorn numbers in the terrain report fall inside the pass bands in `04-terrain.md` §8.5.

### 1.4 Far terrain
- **Build:**
  - LOD0–LOD6: a 3D chunk grid for LOD0–1 and a 2D quadtree of full-height column tiles for LOD2+, in `BatchedMesh`, with screen-space-error selection; far tiles rebuilt from edits
  - column meshing at zero crossings for LOD2+; skirts; the vertical band rules
  - feature LOD policies
  - far shadows (horizon map); depth-precision setup; floating origin
  - per-region sky and atmosphere; takram aerial perspective for the far haze
  - the Command camera as king's view, on Tab (`11-interface-catalogue.md` C1, C6), with its tests (C7)
  - settings: the rows marked 1.4 (render distance, far terrain, FOV, shadows, bloom, haze, sensitivity, invert look, fullscreen on play, interface size)
- **Owner tries:**
  1. Climb a high point in Ibara and look at the colossal thorns far away.
  2. Press Tab and zoom out to ~3 km. Pan with W A S D, turn with a right-drag, grab the ground with a middle-drag.
  3. Look across the Blackwater at the Nadir.
  4. Note the FPS from F3 on your laptop.
- **Done when:** HELL-3, HELL-4, VISTA-1, MTN-2 and KING-1 show ≥ 5 km of real terrain with no LOD artifacts (rings, terraces, cracks, flattened peaks). Kurogane can still be first-pass here.

### 1.5 Kurogane + Selva
- **Build:**
  - coarse stream-power erosion from the WorldPlan, the erosion filter (the MPL file), cirques, glaciers, displacement overhangs
  - **the river network** (jittered, meandering, monotone levels); falling water
  - karst towers, giant trees, cutout vegetation
  - the cenote carver (with its water); gorges and waterfalls
- **Owner tries:**
  1. Stand under a 700 m cliff.
  2. Follow a river down a valley.
  3. Walk among karst towers.
  4. Look down a cenote.
- **Done when:** all Kurogane and Selva postcards pass on seeds 1–3.

### 1.6 Fantasy regions
- **Build:**
  - **Sundered Isles:** floating islands, strands, the Sundering's surface part down to a misty floor, island waterfalls
  - **Hoshikuzu:** crystal clusters, storm scars, hovering shards
  - **Tasogare:** monoliths, black-glass lakes with gloss, glowcaps, the dusk sky and the wound
- **Owner tries:**
  1. Fly among the islands and look down into the Sundering.
  2. Stand by a colossal crystal.
  3. Walk Tasogare by glowcap light.
- **Done when:** their postcards pass on seeds 1–3 (except ISLE-3, which belongs to 1.9).

### 1.7 The rest of the surface
- **Build:**
  - Hearthlands, Shirogane, Kogane, Boneyard, Sallows, Grey Mere
  - the Nadir with its Keep massing, the Blackwater with its causeways, the Rim and the Frost
  - rivers in every region (wadis, frozen rivers, channels)
  - coarse erosion and the erosion filter for the remaining regions
- **Owner tries:**
  1. Tour every region.
  2. Cross a broken causeway to the Nadir (fly the gap) and walk to the Keep.
- **Done when:** every surface postcard passes, including BORDER-1.

### 1.8 Caves + Layer 1
- **Build:**
  - crust caves with breach control; ravines
  - the cavern template; the 8 Layer 1 regions; shelves
  - descents from the surface
  - underground light (ambient, fog in-scatter, region lights)
  - aquifers
  - **the cut** (`11-interface-catalogue.md` C2): king's view can look underground. Its keys, the depth gauge, and the map's layer tabs (the rows marked 1.8)
- **Owner tries:**
  1. Find a cave mouth and follow it down.
  2. Go down a cenote or lava tube into Layer 1.
  3. Visit two Layer 1 regions.
  4. Press Tab inside a cavern, then step the view down and up with PageDown and PageUp.
- **Done when:**
  - the Layer 1 postcards and CAVE-1 pass
  - in the slices, shelves are solid except at descents, caverns appear only inside their band and footprint, and there is no floating or stepped water
  - a path test in the terrain report confirms every surface → Layer 1 descent reaches its region
  - the cut's tests pass (`11-interface-catalogue.md` C7), and you have looked at a cavern through it in a screenshot

### 1.9 The deep
- **Build:**
  - Layers 2 and 3 and the Pit
  - the Sundering into the Hollow Sky
  - the Delvers' Road, the Great Shear, the Leyflow and the Leyfall
  - the Nadir Stair
- **Owner tries:**
  1. Fly down the Sundering into the Hollow Sky.
  2. Follow the Delvers' Road to the Buried City.
  3. Descend the Stair to the Throne.
- **Done when:** the deep postcards pass the deep bar (`04-terrain.md` §14.4).

### 1.10 Polish + performance
- **Build:**
  - meet the budgets
  - revisit the timeboxed Known issues
  - the interface rows marked 1.10: the complete settings
  - final postcard runs on seeds 1–3
  - a milestone summary in `progress.md`
- **Owner tries:** a full tour, then sign off (or send notes).
- **Done when:** the owner signs off.

---

## Milestone 2 · A Tiny Kingdom (solo, in the browser)
The simulation runs in a worker using `shared` code, standing in for the future server.
- **The unit model** (`07-architecture.md` §5): controllers emit InputFrames into shared Minecraft physics (the prismarine-physics port, 20 Hz) and a shared action API; bitECS. The player's M1 controller is replaced by the same physics, so possessing anyone feels like playing Minecraft.
- The king, 20 people and the Steward (who also teaches the basics) on a spawn site; identities, stats and skills.
- Items as physical stacks; stockpiles; hauling.
- Pathfinding v1: walkable components per chunk section for reachability, a cached component-graph search, and the local planner ported from mineflayer-pathfinder (walk, jump, drop, pillar, short digs). Budgets by node count.
- The job system and the Reeve.
- Farming, woodcutting, quarrying, simple crafting.
- Templates (house, stockpile, farm, workshop) built block by block; freeform validation for 2–3 building types.
- Command view (select, blueprints, zones) and possession (Minecraft controls; break and place using real items).
- Tier-1 needs, the calendar and a first winter.
- The interface rows marked M2 in `11-interface-catalogue.md`: the top bar, alerts, minimap, the command bar, Build and Zones, the inspector, Realm, the Ledger, Find, the key list, inventories, the Dig tool, the death screen, and the cut's rule that you see underground only where your people have been (its C2).

## Milestone 3 · Production and logistics
- Medium chains (bread, tools, iron, weapons) and workstations; tool wear, quality, spoilage and preservation.
- Carts, roads, routes (drawn and auto-generated) and the Quartermaster; several settlements.
- Money: mint, wages, markets, taxes, treasury, pay chests.
- Needs tiers 2–3 and loyalty; more officials.
- Wanderers, neutral villages, reputation.

## Milestone 4 · A hostile world
- Hazards for the first regions; material properties and regional building requirements.
- Support and collapse; decay and repair.
- The network (watchtowers, riders, signal towers, connection to the capital) and news delivery.
- Enemies: musters, roamers, scouts and reports, war parties, occupation.
- Combat basics; companies and Captains; the officer command radius.
- The first Seat and Warden: Marshal Varn.

## Milestone 5 · Multiplayer
- The authoritative, self-hosted server (Node 24 LTS, `ws`, better-sqlite3): protocol, persistence, Discord login (redirect flow).
- Many kings; interest management; simulation tiers T0–T3 (`05-systems.md` §22).
- PvP, morale and surrender, capture, swaying people; Marshals and armies; siege engines.
- Market board and trading posts; diplomacy.
- Self-hosting guide and Docker setup; a 10–20 player playtest.

## Milestone 6 · Depth and mana
- The mana grid: crystals, ley wells, generators, conduits, relays, cells, wards.
- Mages and the Academy; heroes and abilities.
- Lifts and warded lifts; ascent sickness.
- Hand-built factories (machines, conveyors).
- Layer 1 hazards, enemies and Wardens; Tier II Wardens; Ibara eruptions.

## Milestone 7 · The Season
- All 29 Wardens, ~100 generals and the King Below; content for Layers 2–3.
- The season loop (Thaw → Front → Frost → reset), scoring, leaderboards, achievements, the Chronicle and the Ledger.
- Lives, sworn units for eliminated players, late joining, inactive decay, anti-alt measures.
- Bot load tests toward 100 kings; admin tools.

## Milestone 8 · Launch polish
- Audio; UI polish and accessibility; the full Steward-led onboarding.
- Cosmetics, titles and the crest editor.
- Paid lives (1 free + 2 paid, capped at 3).
- Low-end performance; a player guide.
