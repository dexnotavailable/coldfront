# king-avatar-crown-cloak-01

Proposed single-asset production brief; geometry and tuning remain reversible until rendered and reviewed.

Brief one code-generated King avatar: a square, toothed crown above the existing 1.8 m body, with a short cloak and kingdom-colour edging. Crown and cloak must identify the King at normal Overhead distance without a label, glow or weapon. This is a proposed asset lane, not an implementation or visual-completion claim.

## canon references

- AGENTS.md, Golden rules 3 and 6; Never: generate geometry/textures in code and judge actual opened renders. No external skins or prohibited source.
- docs/01-vision.md §3, §4 and §6 Presentation and build: rule from above and act through physical people; practical human appearance, cold-steel palette, code-produced voxel art and quiet UI.
- docs/06-ui-art.md §9 People, Palette and Texture recipes: 1.8 m rigid-part people; King wears crown and cloak; everyone has kingdom trim; low-contrast procedural texture detail.
- docs/13-units-classes-power.md §3.2, §3.4 and §14: exact body proportions, collider and Overhead rules; King is the player's avatar, has no class or grade, and cannot become a Calamity.
- docs/18-look-and-feel.md §3.3, §5.1, §5.3, §6, §7.1 and §12: display clock, production lighting, shared wind, existing movement poses, rigid body parts, cloth response and motion-strip evidence.
- docs/07-architecture.md §1, §2 and §6 Game layer: allocation-conscious client rendering, Three.js/Lambert material route and fixed controller semantics.
- docs/11-interface-catalogue.md C4: Overhead starts at distance 24 m, tilt 55°, lens 40°, following feet + 1 m; occluded avatar remains visible through the existing silhouette.
- docs/14-class-library.md §4, skill.king.knack, skill.king.active and skill.king.ultimate: future anchors are the King's physical presence and rally/stand actions. These motivate readable identity and unobstructed arms; this lane adds no skill effects or gameplay values.

## geometry

- Reuse packages/client/src/engine/avatar.ts:14 and its constructor. One model pixel p = 1.8/32 = 0.05625 m. Keep head 8×8×8 p, torso 8×12×4 p and four limbs 4×12×4 p. Feet remain the root origin, +Y up, face toward local −Z. Retain existing head, shoulder and hip pivots.
- Proposed crown: four box strips form an open square band, outer footprint 10×10 p and inner opening 8.5×8.5 p. Band occupies body heights 31–32 p; four broad corner teeth rise to 34 p. Parent everything to the head. Total crowned height is approximately 1.913 m; the underlying person remains 1.8 m. The opening leaves hair visible from above.
- Proposed cloak: three thin box panels, lengths 4, 6 and 6 p; widths 8, 10 and 12 p; thickness 0.25 p. Attach its upper centre at body-local (0,24p,+3p). Successive panels pivot at their upper edges. The nominal vertical hem is 8 p above the feet before outward drape, keeping it clear of the ground.
- Use one small clasp at the upper torso and texture-defined trim. Keep the front, hands and feet exposed. Do not add a throne, sceptre, armour set, hood or separate weapon asset.
- At 24 m the intended identifying shapes are the crown's raised corners and the cloak extending behind the torso. Facial pixels, clasp and fabric pattern are close-view detail. Compare against the existing plain Avatar at identical scale; do not enlarge the body to improve recognition.

## materials

- Keep MeshLambertMaterial, fog participation, castShadow and receiveShadow from packages/client/src/engine/avatar.ts:34–56. Reuse its coat #46596a, trousers #303d48 and supplied identity colours. The existing skin/hair values are fixture defaults, not new population canon.
- Proposed cloak base: #303d48, with a three-tone procedural ramp within roughly ±8% brightness. Crown base: lamp-gold #d8b765, already present in packages/client/src/ui/tokens.css:17, with restrained lighter top faces and darker recesses. These material choices are proposals; the King has no prescribed metal tier.
- Generate 16×16 cloth and crown tiles in code with a fixed seed. Cloth uses sparse seam/weave marks; crown uses broad tone blocks. Keep kingdom trim as a continuous approximately 1 p border on cloak sides/hem and cuffs, using supplied kingdom colours. For the fixture, use existing steel #8fb3d9 and gold #d8b765 as sample colours only. Do not invent heraldry or a faction.
- Use the production sun, ambient light, shadows, fog and ACES chain in packages/client/src/engine/renderer.ts:138–211 and setTime(). Crown and cloth are non-emissive. No added beauty lights, bloom contribution, outline post-effect or painted contact shadow. Report missing terrain-equivalent unit lighting/contact shadows as integration gaps rather than compensating with brighter textures.

## motion and pivots

- Preserve Avatar.update(), swing() and step() in packages/client/src/engine/avatar.ts:109–173: position interpolation, 100 ms visual step easing, distance-driven limb phase, sprint lean, sneak offset, swimming/flying poses, 300 ms arm swing and headYaw-relative rotation. Crown follows the head exactly; cloak follows the torso root, not head turns.
- Proposed cloak tuning bounds: upper attachment stays fixed; outward drape starts around 12° at rest and can increase toward 32° during sprint. Limit cumulative outward pitch to 45°, lateral sway to ±6°, and wind tip displacement to 0.18 m from the movement pose. Upper/lower joint flutter caps are ±2°/±4°. These are visual starting limits, not canon or physics constants.
- Drive cloth from the existing display clock plus a caller-supplied shared wind direction/strength and current movement state. Use a bounded analytic wave with increasing movement toward the hem. Pause freezes it; world-speed changes do not accelerate it. Do not build a weather system or spring simulation for this asset.
- Validate panel clearance against rearward arms and legs at walk, sprint, sneak, swim and flight extremes. If intersections remain, shorten panels or adjust their attachment/drape within the stated limits. Do not change limb movement or collision to accommodate the cloak.
- Register every crown/cloak box before the copy loop at packages/client/src/engine/avatar.ts:93. Existing silhouette, outline and depth copies must receive the same final transforms. Retain the through-cover silhouette; do not add an always-on outline. Explicitly dispose generated textures as well as geometry/materials, because current Avatar.dispose() does not own texture maps.
- Keep packages/client/src/game/controller.ts PHYSICS, BodyState, intersectsBody() and collides() unchanged: collider 0.6×1.8×0.6 m, eyes 1.62 m or 1.27 m sneaking, 20 Hz ticks and 0.6 m step-up. Crown and cloak are visual attachments with no collision, reach, sight or movement authority.

## validation shots

- Capture contract: future owner renders at 1280×720, DPR 1, with production shadows/fog/post-processing enabled. Record world/seed, coordinates, time of day, camera distance/tilt/yaw/FOV, appearance inputs, wind and display time. Save under proposed out/assets/king-avatar-crown-cloak-01/. Open every full-resolution image and strip before reporting acceptance.
- close.png: four production-camera views at d=10 m, tilt 30°, yaw 0/90/180/270°, FOV 40°, noon. Include a 1 m terrain block and unchanged plain avatar for scale. Inspect crown opening, tooth spacing, texture seams, skin/hair fit, cape hinges and limb clearance. Any enlarged crops must accompany the original frame.
- overhead.png: actual OverheadCamera from packages/client/src/game/camera.ts:89, d=24 m, tilt 55°, FOV 40°, focus feet+1 m; four yaw directions at noon. Require crown and cloak recognition at native image size without relying on trim colour or a label. Repeat the rear-quarter view at 18:00 and 00:00 to expose merged dark shapes or false crown bloom.
- distance-cover.png: secondary views at d=80 and 120 m with actual camera telemetry; record where detail stops reading without enlarging the mesh. Separately test the played avatar behind an occluder and beneath a roof with the automatic cut at ≥70°. Crown/cloak must remain attached in the silhouette and depth passes, without stray rims or detached teeth.
- movement-strip.png: replay recorded controller states for walk, sprint and sneak; sample 0/200/400/600/800/1000 ms. Add swim/flight pose extremes and a step-up strip at 0/25/50/75/100 ms. Inspect foot placement, rear limb clearance, cloak ground clearance and unchanged body motion.
- attachment-strip.png: arm swing at 0/75/150/225/300 ms; idle at 0/750/1500/2250/3000 ms; fixed-input wind at 0/250/500/750/1000 ms. Include a head-turn sequence and a pause/resume pair. Crown must follow the head, cloak must stay on the torso, and paused frames must match.
- Capture implementation caveat: renderer.ts:448–450 hides avatars in postcard mode, and setPostcard() at :507 changes FOV to 70°. Use the non-postcard production renderer. create-game.ts:1450 renderStill(time) supplies fixed display time but does not advance movement; the harness must supply/replay BodyState snapshots separately. packages/tools/src/browser-tests/motion.ts is the inspected precedent for fixed-time captures and strips.
- Functional proof: replay identical input with plain and King appearances and compare BodyState, collision/step outcomes and action targeting. Report draw calls, triangles and texture bytes as measurements, not crowd-performance claims. Run the appropriate existing checks after implementation; none were run in this read-only scout.

## implementation boundary

- Proposed asset file: packages/client/src/engine/king-avatar.ts, containing only the crown/cloak box recipe, procedural texture recipe, attachment constants and bounded cloak pose function. No general outfit framework or class catalogue.
- Proposed integration: a small optional appearance path in packages/client/src/engine/avatar.ts, retaining its default avatar and public movement methods. Root/integrator owns any shared renderer or game-fixture wiring; do not make every avatar or free-camera user a King.
- Proposed proof driver: packages/tools/src/browser-tests/king-avatar.ts, following the inspected motion-capture pattern and writing images plus a receipt to the stated out/ directory. A fixture-only state/appearance hook may require integrator wiring; it must add no player-facing control or copy.
- Future hooks are limited to identity/kingdom colour inputs, torso/head attachments and clear existing hands for later equipment or documented King poses. Skills, armour systems, combat statistics, balance, new races/factions, crowd instancing and other classes remain outside this brief.

## assumptions and risks

- All geometry dimensions, crown construction, cloak limits and sample kingdom colours above are proposed implementation choices. Canon fixes the proportions and crown/cloak identity, not a particular royal costume or kingdom.
- The inspected Avatar constructor has fixed colours and no identity/kingdom appearance input. A minimal adapter is therefore needed; an existing finished character-customisation system was not established.
- No shared wind provider was found among the inspected packages/client/src/engine files. Accept supplied wind values for this bounded asset and label fixture wind honestly. Production wind integration remains the integrator's responsibility.
- Current avatar materials use ordinary Lambert lighting; they do not establish the local light/survey response required by docs/18-look-and-feel.md §5.1. The inspected renderer/avatar also do not establish the specified person contact-shadow disc. These are explicit acceptance risks, not permission to expand this lane into renderer work.
- Crown height exceeds the unchanged body collider, and cloak width/length may intersect nearby terrain or animated limbs. The required ceiling, cover and pose proofs must determine whether the proposed accessory dimensions need reduction.
- Read-only inspection only: no files changed, code executed for validation, renders produced, assets completed or visual quality verified. Root judges the brief; the later implementation owner must render and inspect actual pixels.

Prepared by the Astra design route in Dexflow. This is a design brief, not proof of a completed asset.
