# Movement rendering performance

This generation-3 increment reduces repeated rendering work while keeping the current terrain, viewing distance, resolution and visible effects. It responds to the owner's report of low FPS or stutter while moving on a friend's RX 9060 XT. That device has not been tested; the measurements below are local lab observations.

## Changes

- Rebuild the HUD depth buffer only when a target outline, placement preview or avatar silhouette needs it.
- Prepare water depth only when a visible water mesh intersects the camera frustum. Its conservative bounds match Three's normal culling; water returning to view receives fresh depth before drawing.
- When Shadows is off, stop repeated shadow-map updates. Initialize the map once when necessary, refresh after graphics-context restoration, and refresh when shadows are enabled again.

No interface words, controls, terrain generation or save identity changed. The larger generation-4 Ibara work remains on its separate branch.

## Measurements

The matched before/after harness used the real game runtime and renderer in external headless Brave/Chromium 155, ANGLE D3D11 on an RTX 4090, at 1920 × 1080 and DPR 1. Both variants used main seed 1, the same spawn, camera and frozen daylight. The seven-second walk covered approximately 29.96 m. Timing instrumentation was present in both variants; measurements are JavaScript render duration, not GPU timer measurements or a promise of performance on other hardware.

| Observation | Before | After |
|---|---:|---:|
| Idle draw calls | 187 | 145 |
| Mean walking draw calls | 191.87 | 155.35 |
| Mean walking render duration | 1.247 ms | 0.828 ms |
| Walking render duration, p95 | 1.90 ms | 1.20 ms |
| Median animation-frame interval | 5.6 ms | 5.6 ms |
| Draw calls in the tested Shadows-off pose | 183 | 38 |

The short walking sample therefore used 19.04% fewer draw calls and 33.61% less measured render time. Both runs remained near the local 180 FPS limit; this does not establish an FPS increase. A separate baseline flight covered 436 m and recorded two frame intervals above 33 ms, none above 50 ms. It was not the matched comparison and does not prove a cause for the friend's stutter.

Generation kernels are unchanged. The preceding isolated generation-3 benchmark remains the reference: generation median/p95 7.369/10.746 ms, lighting 13.569/20.934 ms, meshing 4.545/7.100 ms and full pipeline 97.104/126.991 ms. Lighting and meshing still miss the phase-1.10 targets.

## Verification and limits

The revised renderer passes 349 tests across 55 files, TypeScript/Biome/UI lint, production build and the local browser smoke/drive. These checks ran in an isolated checkout with its own dependencies on Node 22.23.3. A separate clean checkout of committed runtime `71b839263b17ea98d987c173240a795117aad2ed` passes Node 22.23.3/npm 10.9.8 install/build, the site build and local play at its `/coldfront/` base path. Nine selected gallery images pass independent review; fresh source-bound HUD captures preserve the outline, placement preview and under-cover silhouette.

All sixteen regional postcards and TEST-1 were regenerated and individually reviewed. Their JPEGs are byte-identical to the preceding release. TEST-1 remains 15/20; the regional phase-1.2 cards stay ungraded. Regional capture median/p95 is 8.461/21.299 seconds; both capture commands together took 191.599 seconds. The atlas and both slice views were regenerated and opened. These retain the current geography and planned underground bands; they do not claim implemented caves.

Runtime `71b8392` was published on 9 October 2026. Public HTTP200, exact version/build identity, entry JavaScript/CSS hashes and isolation headers match the tested release. [PR #7](https://github.com/dexnotavailable/coldfront/pull/7) carries the final CI/merge state. The save-generation fingerprint remains unchanged.

Nine native image pairs cover ordinary ground, visible and offscreen water, each HUD mark, the cut and shadow transitions. Their maximum channel difference is 1/255. Initial Shadows-off drawing and two actual graphics-context loss/restoration cycles return GL0, with exactly one necessary map refresh and zero subsequent updates while disabled. An earlier candidate failed this real test despite passing its mocked drawing tests; it was repaired before publication.

The private comparison harness retains foreign-context resource-deletion warnings in both variants. Its sampled draws return GL0 and its error arrays are empty; this is not a claim of a warning-free browser session. The comparison's special poses and static images do not replace ordinary controls testing or establish smoothness on the friend's Radeon. The refreshed UI image fixtures also do not independently prove live HUD scaling at every display scale.

The site's earlier public-browser launch remains blocked by automatic approval review. Local browser play and public HTTP/version/asset/header verification remain distinct evidence. A temporary dependency-link removal was also rejected; the link was preserved, and verification used a separate checkout with its own installed dependencies.

## Try this

1. Reload [COLDFRONT](https://dex.place/coldfront/), then walk and rotate the camera through the same area that stuttered.
2. Open Tools with **F4** and toggle **Shadows** to compare. The off setting now removes ongoing shadow rendering work.
3. Aim at a nearby block and try a placement preview; walk behind cover to check the avatar silhouette.

Continue phase 1.3's strict HELL screenshots and startup work next. Distant terrain remains the specified phase 1.4 work; civilization and multiplayer milestones are still ahead.
