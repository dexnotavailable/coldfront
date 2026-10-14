# Watchtower asset study

## Revised brief, before production geometry

One early player-built stone-and-timber watchtower: a grounded masonry base,
four timber uprights, a sheltered lookout, and an uninterrupted block stair
route from the entrance. No placement UI, costs, heraldry, factions, watcher,
network, sight, combat or world-generation behavior is added.

Canon: `01-vision.md` sections 3-4 and `06-ui-art.md` section 9 require physical,
practical timber-and-stone construction, metre voxels, existing procedural
textures and clear silhouettes. `05-systems.md` section 4 and `16-sight.md`
sections 3.2/6 require a platform at least 12 m above surrounding ground;
this study uses the documented **25 m** example. Network and sight are separate
future systems. `18-look-and-feel.md` requires production light, camera and fog.

## Engineering assumptions

- Finished surrounding ground is `y=0`; the 11 x 11 m stone footing is buried
  from `y=-1` to zero. The entrance faces `-Z`, is 2 m wide and 3 m tall.
- A 5 m stone plinth surrounds the lower ascent; four metre-square log posts
  support the upper frame. Landings and support ties follow the alternating
  flight heights. No unsupported subvoxel stairs are authoritative.
- Five flights each rise 5 m via five full-block steps, 2 m wide and 1 m deep.
  Turning landings are 2 m deep. **Every one-metre rise requires the existing
  Minecraft-style jump.** This is a broad voxel stair adapted to the existing
  movement contract, not a real-world conventional walking staircase.
- Clearance checks use a 0.6 m body and a 3.1 m envelope over each tread for
  standing height plus a jump. At the two-metre turning landings, the next
  flight is beside the previous one; flights in the same footprint are 10 m
  apart vertically. Both sides of every flight have full-block guards. Root
  granted a bounded unchanged-controller check; its receipt records the
  actual legal inputs and body positions, separately from visual acceptance.
- The 25 m platform is 11 x 11 m gross, with a guarded stairwell and four clear
  watch positions. The metre-high perimeter is below avatar eye level. Roof
  underside is 28 m; the stepped slate hip ends at 32 m. Timber side braces
  are decorative rigid members outside the clearance route, using existing
  log textures. All access, floors, guards and primary massing are full voxels.
- Post/landing alignment and short corbels describe support intent. The future
  collapse solver and real-world engineering compliance are not validated.

## Frozen capture plan and limits

Source checks prove dimensions, stable ordering, route clearance and platform
circulation. They do not prove visual quality, runtime traversal, staffing,
network behavior or durability. The rejected quarter-metre stair draft was
never rendered and is superseded by the entirely voxel-authoritative ascent.

Use full-fit front/rear actual Overhead-camera views through the production
40-degree lens, plus a Command-scale view. A 32 m structure cannot fit at a
24 m camera distance. Separate `native24-entry-detail`, `native24-stair-detail`
and `native24-platform-detail` shots keep the real 24 m distance and explicitly
record crop and cut. Each detail includes the unchanged 1.8 m avatar and a
one-metre scale block. Filenames/receipts carry labels; no on-screen UI is added.

Run only after root grants the exclusive heavy lane:

```text
node --import tsx packages/tools/src/asset-studies/watchtower/capture.ts --output out/watchtower/pass-01
```

The driver freezes source hashes, preserves the seeded canonical snapshot,
refuses output-directory reuse, and records camera, crop, cut, source drift,
WebGL warnings/errors and external requests. Flat ground is an isolated fixture,
not accepted regional terrain. Root is sole integrator/publisher. Until images
are captured and opened, this asset is **visually unreviewed**.

## Authored result and bounded evidence

The finished source geometry is in
`packages/shared/src/assets/structures/watchtower.ts`. The seven geometry
checks and 52 shared determinism checks pass. Tools and shared-test TypeScript
checks pass, and the eight authored TypeScript/HTML files pass scoped Biome.

With the unchanged production controller, the scripted entrance-to-lookout
ascent reaches all 37 route points in 459 fixed ticks with exactly 25 jump
inputs. Inputs are ordinary movement and jumping; no flight, teleporting,
velocity resets or controller modifications are used. Full inputs, body
positions and source hashes are in
`out/watchtower/verification/final/controller-and-projection.json`. This is
Node physics evidence, not an exercised browser journey or NPC pathfinding.

The frozen full-fit front/rear views use the production Overhead camera at
100 m. Pure projection checks place the full tower between approximately
173 and 543 vertical pixels of the 720-pixel frame. The 200 m view also fits.
An earlier subject placement clipped the tower at 100 m and was rejected;
moving the subject to the far side of the tower corrected framing without
changing the lens or asset. Those numbers prove projection, not actual pixels.

No render, bake, WorldPlan, census, full suite, benchmark, canonical integration,
publication or commit was performed by this lane. Remaining acceptance:
production capture, inspection of every view, fresh visual review, and a real
browser traversal when root opens that scope. Weather/load/support simulation
and sight/network functionality remain outside this asset study.
