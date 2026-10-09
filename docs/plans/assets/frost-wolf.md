# frost_wolf

Proposed single-asset production brief; geometry and tuning remain reversible until rendered and reviewed.

Prepare one implementation brief for Shirogane’s existing frost wolf: a code-generated quadruped distinguished by a broad stepped shoulder ruff, narrow hindquarters, short ears, wide paws and a low, flattened tail. This is a proposed visual asset, with rendering and acceptance left to the implementation owner and root.

## canon references

- AGENTS.md, Golden rules 3 and 6; Never: generate geometry and textures in code, and inspect rendered images before claiming visual quality.
- docs/01-vision.md §3 Pillars and §4 Tone: physical expansion and supply lines, readable command and possession views, grounded high fantasy and restrained magic.
- docs/02-world.md §2 Names and IDs and Shirogane region sheet, lines 79 and 115–119: region ID tundra; frozen plains, drifts, lakes and crevasses; frost wolves are existing enemies.
- docs/02-world.md §5 Resources, line 298: Shirogane supplies furs and ice for cold gear and preservation. This does not establish a wolf drop table.
- docs/06-ui-art.md §9: silhouette-first enemy families; procedural textures with 3–5 tones and low internal contrast; Shirogane snow #e8eef2, ice-blue #9cc8e0 and fog #e3eaef; code-generated 1.8 m people.
- docs/13-units-classes-power.md §3.2, §5.6 and §16 Kinds of creature: avatar proportions; existing animal rules; beasts are tame or wild animals, while membership in a Warden’s faction also makes a creature of the Deep. The region sheet does not resolve the wolf’s faction membership.
- docs/18-look-and-feel.md §2, §3.3, §5.1, §5.6, §6, §7.2 and §12: readability at 24 m, production lighting and fog, distance-driven movement, rigid generated creature parts, and inspected motion strips.
- docs/07-architecture.md §1, §5 Entities and §6 Client: avoid per-frame allocation, separate content from presentation, and use the existing rendering and camera systems.
- docs/11-interface-catalogue.md C1 and C4; packages/client/src/game/camera.ts, OverheadCamera at line 89: default distance 24 m, tilt 55°, focus at avatar feet + 1 m. packages/client/src/engine/renderer.ts:79 supplies the 40° perspective lens.
- packages/client/src/engine/avatar.ts:14 and Avatar constructor: existing geometry uses 1.8/32 m units, rigid boxes and shadow-receiving Lambert materials. packages/client/src/engine/renderer.ts:198 implements bloom followed by nonadaptive ACES.

## geometry

- Proposed dimensions, not canon: shoulder height approximately 1.01 m, rump 0.90 m, ear tips 1.29 m, nose-to-rump approximately 1.9 m. Place the unchanged 1.8 m avatar beside it during review. Use q = 1.8/32 m = 0.05625 m as the modeling increment; terrain remains 1 m blocks.
- Build the torso from overlapping cuboids: approximately 22q long, a 10q-wide ribcage, 8q-wide hindquarters and a 14q-wide shoulder ruff. Raise the shoulder roof two increments above the rump and lift the belly toward the rear. Preserve visible space beneath the belly.
- Make the ruff three broad, backward-stepping layers across the shoulders, each retreating about 2q. Add one blunt cheek shelf per side. These volumes must form the identification cue even with every surface assigned the same material; their ends are squared fur masses, without horns or crystalline spikes.
- Use a skull approximately 7q wide, 6q high and 7q long. Extend a 6q muzzle in two narrowing rectangular steps, ending in a dark nose. Keep the muzzle visible ahead of the shoulder mass from Overhead. Two ears rise only 3q above the skull, each made from a wide base and a smaller offset upper block; leave a clear gap between them.
- Forelegs are nearly straight, substantial columns; hindlegs have a fixed backward hock step in their geometry. Use approximately 3q-thick shafts and broad paws around 5q wide, 6q long and 2q high. The front stance is wider than the rear stance. Indicate toes through two short texture breaks, not separate claws.
- The tail is one rigid assembly, about 12q long, with a flattened 6q-by-4q base narrowing through three blunt steps. Carry it below the back, angled downward, with the tip clear of the ground. Its broad base and low carriage must remain distinct from the muzzle at small screen sizes.
- Start with seven visible rigid assemblies: torso including ruff, head including neck and ears, four legs including paws, and tail. Merge stationary cuboids within each assembly. A provisional ceiling of 48 source cuboids keeps this single asset bounded; measured rendering cost remains unproven.

## materials

- Generate opaque 16×16 fur tiles from fixed seeds, using 3–5 close tones per tile. Direct short clustered marks backward along the flank and downward on legs. Use broad color regions for the back, cheek shelves and underside; avoid independent random speckling on every texel. This follows docs/06-ui-art.md §9.
- Proposed palette: frost-white highlights drawn from Shirogane’s snow color, a darker silver-gray main coat, and a broad slate-gray saddle reaching the shoulder shelves. Keep the pale muzzle and cheek surfaces separate from the darker back through geometry and broad color boundaries. Exact gray values are reversible look-development choices.
- Use dark, nonemissive nose, eyes and paw undersides. Eyes are small side-facing marks beneath a squared brow; no glowing eyes, translucent ice coat, particles or frost aura. Surface frost, if needed after review, is a few pale patches on upper fur planes.
- Use the production scene’s sun, ambient illumination, fog, shadow reception and ACES chain. Keep fur matte, with zero emissive contribution. Do not add a private key light or outline to recover a weak silhouette. The canonical soft contact shadow is approximately body-width and 35% dark, fading with elevation, per docs/18-look-and-feel.md §5.1; verify its integration separately.

## motion and pivots

- Coordinate proposal: +Y up, -Z forward, X lateral; placement origin on the ground below the torso center. Store placement separately from visual pose. Representative joint positions in q: shoulders (±4,13,-7), hips (±3,12,8), neck (0,15,-9), tail base (0,14,11). These are adjustable construction coordinates.
- Rotate each entire leg at its shoulder or hip. Keep its hock shape and paw rigid; ears and muzzle remain attached to the head. Hide attachment seams within the chest and haunch volumes. Avoid deforming skin, squash/stretch, simulated fur or a new general-purpose rig system.
- Idle proposal: feet and root stay planted, with a three-second breathing cycle expressed through less than one degree of rigid torso/head pitch. Keep the tail quiet. Head yaw must come from a supplied facing or sight direction, following the state-driven principle in docs/18-look-and-feel.md §6–§7; do not invent decorative scanning behavior.
- Walk proposal: a four-beat sequence of left hind, left fore, right hind, right fore. Advance phase from actual traveled distance, using 0.75 m per cycle as an initial visual tuning value. Begin with leg swings no greater than 20° and a small opposing torso roll; head pitch counters the torso enough to keep the muzzle readable.
- Check support height against the rigid paw soles and keep any visual root correction small. Stop the gait when displacement stops and settle into planted idle without overshoot. Stride length and swing angle must be tuned together against the rendered ground contacts; these values define neither gameplay speed nor acceleration.
- Keep the authored state set to idle and walk. Death presentation remains unassigned: docs/18-look-and-feel.md §7.2 distinguishes beast collapse/fade from creatures-of-the-Deep ash, and the inspected wolf mention does not settle that classification.

## validation shots

- Overhead acceptance: capture uncropped 1280×720 frames through the actual OverheadCamera at d=24 m, tilt=55° and the production 40° lens. Focus on the existing avatar and place the wolf nearby on the same snow surface. Capture front-quarter, side-quarter and rear-quarter orientations. Require readable muzzle direction, shoulder-to-rump taper, tail separation and grounded paws.
- Close proof: use actual Overhead at d=10 m with its 40° lens. Include the 1.8 m avatar and a 1 m terrain block. Inspect cuboid intersections, ear spacing, muzzle projection, fur texel scale and attachment seams. Close detail cannot substitute for the 24 m result.
- Side proof: produce a separate diagnostic side view using the same production material, lighting and tone mapping, retaining a 40° perspective lens and the avatar scale reference. Show shoulder/rump heights, tucked belly, fixed hock shapes and tail clearance. This is an inspection camera, not a proposed player camera.
- Stride proof: in a controlled visual fixture, move 0.75 m over one second and capture 0, 125, 250, 375, 500, 625, 750, 875 and 1000 ms from both Overhead and the diagnostic side view. Inspect contact order, planted-foot drift, penetration, hovering, muzzle stability and loop continuity. The fixture timing is not a movement-stat proposal.
- Idle proof: capture 0, 750, 1500, 2250 and 3000 ms with fixed placement and facing. Check that the body breathes without changing dimensions, sliding its feet or rotating its head independently of supplied state.
- Readability stress: repeat the 24 m view on snow and ice under production noon and low-sun settings, then inspect at d=80 m and d=400 m. Record which anatomical cues survive at native resolution. At distant Command scale judge orientation and overall body mass, not eyes or fur markings; do not promise species recognition without pixels.
- The implementation owner must open every proof image and motion strip and report observed failures with camera settings and asset parameters. No renders or visual acceptance occurred during this scout.

## implementation boundary

- Deliver one isolated generated wolf model, one fixed-seed fur recipe and its idle/walk pose functions through the existing client rendering path. Reuse geometry and materials across instances, and avoid allocating meshes or textures during animation, consistent with docs/07-architecture.md §1 and docs/18-look-and-feel.md §6.
- Keep dimensions, ruff width, ear height, paw width, tail angle, coat tones and gait parameters local and reversible. Root selects the final values after pixel review. No asset framework, terrain-generation change, UI, copy, race or faction expansion belongs in this lane.
- Future gameplay anchor: this provides the visual body for the frost wolves already named in the tundra region sheet. Its eventual use can support the documented need to defend expansion through hostile regions; this brief adds no patrol, pack, aggro, attack, resistance or balance rules.
- Shirogane’s documented fur resource supports material context only. Do not assign harvesting, drops, taming, riding or barding because docs/13-units-classes-power.md §5.6 discusses animals generally.
- Any eventual content identity, creature-kind membership, visibility, collision dimensions and combat behavior must come from the owning content/simulation lane. Visual bounds and pose parameters must not become gameplay values implicitly.

## assumptions and risks

- frost_wolf is a proposed asset identifier. A scoped search for frost-wolf spellings across docs, packages/client/src and packages/shared/src found only docs/02-world.md:118; no inspected source establishes its anatomy, stats or faction.
- All measurements, fur patterning and gait tuning above are reversible design proposals. Canon supplies the enemy’s name and region, the rigid-part visual language and rendering constraints.
- The broad ruff could obscure the head from above or make the body resemble a bear. Preserve the projecting muzzle, narrow rear body and long low tail; reduce ruff width before adding decorative features.
- The pale coat may disappear into snow under ACES and fog. Adjust broad coat values and silhouette first; visual success remains unknown until production screenshots are inspected.
- packages/client/src/engine/renderer.ts:448 hides the avatar in postcard mode, and setPostcard at line 507 switches the lens to 70°. Ordinary postcard output therefore cannot stand in for the required Overhead-and-avatar proof.
- The inspected renderer uses time-based fog in setTime at line 478. Shirogane-specific air, local block-light treatment and canonical creature contact shadows were not established by this inspection. Record available production behavior and any integration gaps without silently substituting studio lighting.
- Single-piece legs intentionally retain the avatar’s simple rigid construction. Broad paws can reveal skating or penetration; the stride strip must decide whether the proposed swing envelope works before adding articulation.
- This read-only scout inspected repository text and source only. It made no files, assets, renders, installations or completion claims.

Prepared by the Astra design route in Dexflow. This is a design brief, not proof of a completed asset.
