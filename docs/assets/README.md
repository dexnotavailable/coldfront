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
