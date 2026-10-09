# player_smithy_early_01

Proposed single-asset production brief; geometry and tuning remain reversible until rendered and reviewed.

Brief for one code-generated early player workshop: an 8 × 14 m enclosed work hall with a stepped single-pitch roof, external masonry chimney and broad loading entrance. Its long industrial footprint, exposed support frames and concentrated forge end distinguish it from the house lane’s 9 × 11 m cottage. This is a proposed asset, not implemented geometry or a functioning building.

## canon references

- AGENTS.md, Golden rules 3 and 6; Never: code-generated assets, inspect actual rendered images before visual claims, and no unlisted interface content.
- docs/01-vision.md §§2–4: infrastructure, physical logistics, construction constrained by available resources, and practical timber/stone industry.
- docs/05-systems.md §13, lines 304–341: forge block, anvil, chimney with a path to open air, door, enclosed interior, environmental validation and grounded structural support. Listed span limits remain tuning values.
- docs/08-roadmap.md, Milestone 2, line 176: block-by-block workshop templates and limited freeform validation. Milestone 3, lines 185–186: production chains, workstations and moving doors.
- docs/15-item-library.md §17, lines 794–799: anvil, bellows and iron fittings are M3 content. Preparing their geometry does not move their availability into M2.
- docs/06-ui-art.md §9: 1 m structural voxels, procedural 16 × 16 textures, restrained texture contrast, early player timber/stone architecture and a 1.8 m rigid-part avatar.
- docs/18-look-and-feel.md §§2, 3, 5.1, 5.5, 7.1, 7.3 and 12: Overhead readability, terrain-consistent lighting, meaningful motion, steady fire block light, rigid animation, 150 ms doors and inspected motion strips.
- docs/07-architecture.md §§1, 5 and 6: deterministic shared data, block properties and a 0.6 × 1.8 × 0.6 m player collision box. docs/11-interface-catalogue.md C1, C2 and C4 specify the actual camera and cut.
- Existing material evidence: packages/shared/src/blocks/registry.ts, Block and BLOCK_REGISTRY; packages/shared/src/blocks/textures/recipes.ts, TEXTURE_RECIPES and generateTextureArray. Existing presentation owners: packages/client/src/game/camera.ts, OverheadCamera; packages/client/src/engine/avatar.ts, Avatar; packages/client/src/engine/renderer.ts, WorldRenderer.

## geometry

- Coordinate proposal: metres, Y up; origin at the front-left floor corner. Hall occupies X 0–8, Z 0–14. Finished floor is Y=0 on a 1 m foundation course fully supported by terrain. One-block perimeter walls leave a nominal 6 × 12 m interior before fittings. Add an 8 × 3 m entrance apron at Z −3–0.
- Shell: continuous stone foundation, 1 m stone wall plinth, timber posts and plank infill above. Use masonry for the rear forge bay. Close every wall-to-roof step; the loading apron remains outside the enclosed room.
- Support: transverse timber frames at front, approximately 4 m intervals, and rear. Keep clear beam spans at 6 m and roof-plank support intervals at or below 4 m. Posts land directly on foundation blocks; elevated struts transfer the stepped roof load into these frames. Lowest beam underside is 3 m above the floor. These are geometric targets against docs/05-systems.md §13, not a support-validation pass.
- Roof: three connected voxel terraces rising across the 8 m width, with undersides at roughly 4, 5 and 6 m and maximum roof top at 7 m. Limit overhangs to 1 m. Use a continuous low industrial roof profile without a loft; preserve at least 3 m clear height beneath all frame ties.
- Entrance and circulation: centered front opening at X 3–5, 2 m wide and 3 m high, with paired outward-opening leaves. Maintain a flush threshold and a continuous 2 m central aisle toward the rear work bay. Door sweeps, posts and stored materials must remain outside this route.
- Workplaces: reserve the rear-right 2 × 3 m bay for the forge assembly. Opposite it, place an anvil assembly within a 1 × 2 m footprint, working face about 0.95 m above the floor, with a squared horn and broad grounded base. Keep a 1 m operator standing zone clear beside each station. A front-side bench approximately 2 × 0.75 m, top 0.9 m high, and an empty 2 × 2 m staging space explain the entry-to-work flow without implying inventory behavior.
- Chimney: attach a 3 × 3 m masonry stack at the rear-right wall, sharing one wall course with the hall. Preserve a continuous 1 × 1 m internal flue from the forge hood’s short throat to an uncapped opening at Y=8, above the highest roof. Frame the roof around the stack; keep timber out of the duct. Model the hood, throat and hollow shaft explicitly rather than painting a black square on a solid chimney.

## materials

- Primary hierarchy: cobblestone foundation and apron; lighter stone_bricks for the plinth, forge enclosure and chimney; log for the structural frame; planks for infill and doors; dark_planks for the roof. These families exist in packages/shared/src/blocks/registry.ts and packages/shared/src/blocks/textures/recipes.ts. Large material boundaries should explain construction from above.
- Reuse procedural 16 × 16 recipes with restrained three-to-five-tone ramps and deterministic variants. Align timber grain with each member and masonry courses with the ground. Concentrate soot at the forge mouth and flue outlet; avoid uniform noise, painted highlights or baked directional shadows.
- Anvil and hinge fittings use the canon iron family with a subdued procedural finish. The inspected registry contains iron_ore but no finished-iron block: do not substitute ore texture for forged iron or silently invent a gameplay block ID. Submetre rigid-part surfaces need explicit implementation-owner treatment.
- Use WorldRenderer’s production sun, ambient sky contribution, shadows, fog and post-processing. All parts must receive appropriate world lighting and clipping. Initial proof uses an unlit forge. Any later burning state requires an implemented visible fire and real steady block light; no fake lamps, hidden fill lights or asset-specific exposure boost.

## motion and pivots

- Keep foundation, shell, roof, forge, anvil and chimney static. Generate structural occupancy on the 1 m grid; use rigid code-generated parts for door leaves and tool geometry. The assembly origin stays at the floor corner, with separately addressable required-part locations.
- Each door leaf is approximately 1 × 3 × 0.125 m, pivoted on its outer vertical jamb. Reserve opposite outward 90-degree arcs on the apron. Future animation follows docs/18-look-and-feel.md §7.3: 150 ms ease-move, no overshoot, collision state changes immediately. A pivot demonstration is not implemented door interaction.
- Use the existing 1.8 m Avatar for scale and reach checks. A later work demonstration can use its rigid arm/tool swing against the anvil face; it must be explicitly driven by a work state or labeled as a validation pose in the external report. No automatic hammer, decorative machine loops or implied production.

## validation shots

- Close proof: production-lit entrance three-quarter view with the actual 1.8 m avatar standing at the threshold, then beside the anvil. Inspect foundation contact, timber joints, door thickness, work height, texture scale and unobstructed standing space.
- Overhead proof: use packages/client/src/game/camera.ts OverheadCamera at d=24 m, chosen tilt 55 degrees, and WorldRenderer’s 40-degree gameplay lens. Capture front and opposite-side approaches with the avatar as focus. The entrance, roof direction and chimney must remain identifiable without captions, lights added for the shot or a substitute orthographic camera.
- Interior cut proof: move the avatar through the entrance and work aisle using the actual automatic cut. Verify roof removal, the covered-camera tilt of at least 70 degrees, visible workstations and retained player silhouette. Confirm custom rigid parts obey the cut rather than floating above it.
- Construction cutaway: provide a separate diagnostic section through forge, throat and chimney showing the uninterrupted flue and its open outlet, plus a roof-off support view. Keep this distinct from gameplay-camera evidence; include dimensions in the external receipt rather than adding game UI.
- Readability proof: capture the same asset in production noon and dusk lighting, with the forge cold. Check door recesses and stone/timber separation without clipping highlights or crushing the interior. At Command distances of 80 m and 200 m, judge the workshop mass, stack and entrance apron; fine fittings need only survive close views.
- If door motion is implemented later, inspect frames at 0, 50, 100 and 150 ms and verify collision separately. The implementation owner must open every image and motion strip and report failures, camera settings and file paths. No renders or pixel inspection were performed by this scout.

## implementation boundary

- Deliver one bounded workshop assembly with shell, door pivots, forge/anvil locations and a geometrically open chimney. Reuse existing material and renderer owners; do not introduce a generic building framework or a second settlement scene.
- Forge, anvil, chimney and door remain future gameplay anchors until their part identities, collision, interaction and validation are implemented. The inspected Block registry has none of these functional part types. A correctly shaped mesh cannot certify a working template.
- M2 provides the template-authoring context; M3 owns the cited anvil content, production chains and moving doors. Future integration must establish enclosure, minimum room size, material support, environmental suitability, reachability and chimney connectivity before calling this a valid smithy.
- This brief adds no UI, player-facing copy, races, factions, recipes, output rates, combat statistics or balance claims. No files were written, no assets built, and no renders, installs, network calls or repository mutations were performed.

## assumptions and risks

- All dimensions and station placements above are proposed authoring choices, not established canon. Assume a level Hearthlands presentation site; this is not a universal environment-resistant template.
- docs/05-systems.md §13 does not specify the minimum forge-room volume or exact enclosure treatment of doors and chimney ducts. The future validator must distinguish an intentional exhaust connection from an invalid room opening without filling the flue for appearance.
- Support limits are documented, but the inspected BlockDefinition lacks material-strength and beam semantics. Timber-shaped geometry alone does not establish the wooden-beam support classification.
- The scout found a stale recipe comment calling IDs 10 and above integration proposals. Root verified that canonical IDs 0–31 were already accepted and shipped in phase 1.1; reuse is allowed. This does not authorize new registry IDs or functional part types.
- Camera and renderer source inspection establishes reusable owners, not demonstrated appearance. Cut compatibility, production-light readability, movement clearance and the final silhouette remain unverified until the implementation owner renders and inspects them.

Prepared by the Astra design route in Dexflow. This is a design brief, not proof of a completed asset.
