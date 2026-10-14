# Reusable asset data

These assets are source data for future gameplay integration. They are not registered or spawned in the playable world.

## Early watchtower

`player-watchtower-early-01`, revision 1: a stone footing, timber frame, five block-stair flights and a lookout platform 25 metres above the surrounding ground.

- [Model and integer sampler](../../packages/shared/src/assets/structures/watchtower.ts): internal exports `WATCHTOWER` and `sampleWatchtower`.
- [Seven geometry tests](../../packages/shared/test/assets/watchtower.test.ts).
- [Historical construction brief](../plans/assets/watchtower.md).
- [Current browser ascent evidence](../reports/watchtower-ascent.md).

Coordinates are local metres. Ground is Y=0, the buried footing begins at Y=-1, the entrance faces -Z, and the placement pivot is `[5.5, 0, 0]`. The sampler accepts integer coordinates and returns `Block.Air` outside the asset. Exported voxel data is frozen and ordered by Y, Z, then X. Each full-metre stair rise uses the existing jump mechanic.

The voxel cells provide the authoritative collision shape. Eight decorative braces are separate endpoint, width and material records; their presentation helper is not part of this library adoption. A future renderer must draw and cut them consistently, without treating them as authoritative collision.

The model's pending-review state string and construction brief are preserved historical study records. Their old capture command and `out/` references belong to the isolated study, not to a runnable tool in a clean library checkout. The ascent report records the newer evidence and its limits. No new package subpath, runtime registration, block ID or generation rule is introduced.

Run the existing geometry tests with:

```text
npm test -- packages/shared/test/assets/watchtower.test.ts
```

Placement, rotation, foundations and saves; brace presentation; construction and structural support; NPC navigation; staffing, sight and networking remain future integration work.

## Early smithy

`player_smithy_early_01`, revision 2: a 604-voxel timber and masonry workshop with a three-terrace roof, an open chimney and a cold ash bed. Its separate presentation helper supplies the door leaves, anvil and bench.

- [Model and integer sampler](../../packages/shared/src/assets/structures/early-smithy.ts): internal exports `EARLY_SMITHY`, `sampleEarlySmithy` and `smithyRoofY`.
- [Presentation helper](../../packages/client/src/engine/assets/smithy-parts.ts): `SmithyParts` owns its meshes, depth copies, materials and textures; call `dispose()` when finished.
- [Seven geometry tests](../../packages/shared/test/assets/early-smithy.test.ts) and [three presentation/camera tests](../../packages/tools/test/assets/smithy-parts.test.ts).
- [Historical construction brief](../plans/assets/smithy.md) and [reviewed cold-hearth evidence](../reports/smithy-hearth-study.md).

Coordinates are local metres, Y up, entrance facing -Z, pivot `[0, 0, 0]`. The floor is Y=0 and the foundation occupies Y=-1. The integer sampler returns Air outside its bounds; exported cells are frozen and ordered Y/Z/X. No new registry ID, dependency or generation rule is introduced.

A future renderer must provide solved local-coordinate skylight to `SmithyParts`, position its group, call `syncDepth()` after transformations and pass world-Y cuts to `setCut()`. The default all-sky sampler and static open-door pose are study conveniences. Lighting is sampled at construction; moving doors and changing light require future integration work. Presentation pieces do not supply collision.

The pending-functional-parts state and construction brief are historical study records. The machine-specific capture helper remains in the isolated study. The library is unregistered: placement, construction, structural validation, functional stations, recipes, fire, heat, fuel, interaction, collision and NPC navigation remain future work.

```text
npm test -- packages/shared/test/assets/early-smithy.test.ts packages/tools/test/assets/smithy-parts.test.ts
```

## Hearthlands house

`hearthlands-house`, revision 4: a 498-voxel timber and masonry shell with a stepped roof, covered stoop and open chimney. Its 9 × 11 m main shell preserves 63 m² of living floor. A separate presentation helper supplies the plank door.

- [Model and integer sampler](../../packages/shared/src/assets/structures/hearthlands-house.ts): `HEARTHLANDS_HOUSE` and `sampleHearthlandsHouse`.
- [Door presentation](../../packages/client/src/engine/assets/house-door.ts): `HOUSE_DOOR` and `HouseDoor`.
- [Four geometry tests](../../packages/shared/test/hearthlands-house.test.ts) and [five door tests](../../packages/tools/test/assets/house-door.test.ts).
- [Accepted static door study and fresh adoption evidence](../reports/house-door-wolf-stance-studies.md#house-library-adoption-14-october-2026).

Coordinates are local metres, Y up, entrance facing -Z. The occupied bounds run from `[1, 0, 1]` to exclusive `[12, 11, 17]`; the pivot is `[6.5, 0, 4]`. Floor and approach are Y=1, while the foundation bottom is Y=0. Future site preparation must bring the approach to floor height. Exported cells are frozen and ordered Y/Z/X; integer sampling outside the template returns Air.

The door's skylight callback takes **world coordinates**. Call `sync()` after changing the assembly transform to update depth and sampled lighting, pass world-Y cuts, and call `dispose()` when finished. `setOpen()` selects a static outward pose from closed to 90 degrees. The leaf does not supply collision or close the voxel doorway for enclosure checks.

The pending-functional-parts state, bed/lamp anchors and support intentions remain study metadata. The historical brief and capture harness stay in the isolated study. Placement, rotation, foundations, construction, structural validation, functional doors/hearths, furnishings, heating, interaction, collision and NPC navigation remain future work. No new block ID, dependency, world-generation rule or settlement registration is introduced.

```text
npm test -- packages/shared/test/hearthlands-house.test.ts packages/tools/test/assets/house-door.test.ts
```
