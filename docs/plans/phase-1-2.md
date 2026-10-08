# Phase 1.2 · WorldPlan and travel

Build Kaldmark's geography and make it explorable from the existing Overhead view. Keep the test world available through the World selector and `?world=test`. The first regional terrain is explicitly ungraded: detailed thorns, cavern carving, river carving, erosion and far LOD keep their roadmap phases.

## Sequence and acceptance

1. **Deterministic shared foundation.** Port the permitted psrdnoise 2D kernel independently of the accepted OpenSimplex kernels. Preserve original attribution, derive analytic gradients/Hessians, and measure its quantiles. Keep all 150 existing test-world chunk hashes unchanged.
2. **WorldPlan.** Build bounded warped rings and sectors, continuous top-three weights, macro elevation, drainage, owned water bodies, underground footprint/Voronoi metadata and sites. Routing fill heights are separate from rendered terrain. Base heights, bowl/owned shapes and macro/meso/micro relief each contribute once. World queries are pure functions of seed and position, including negative coordinates and different sample spacings.
3. **Shared context and engine.** A cloneable plan is built once in a worker and cached by generation identity; workers acknowledge installation before chunk requests. SharedArrayBuffer and independent-copy paths produce the same data. One context supplies columns, voxels, water, conservative whole-area bounds and sky inputs to generation, collision, lighting and tools. Preserve the test world's eight-lane column layout instead of overloading its pond lane. Main generation must never silently fall back to test terrain.
4. **Catalogue UI.** Add exactly the fifteen 1.2 rows, plus content-only discovery cards: World selection, Planning the world, map/Teleport, Region debug weights, Go to region and map distance units. The phase-aware string/audit pipeline and typed Select primitive pass before screens. Command mode, map layer tabs, marker controls and Go to postcard do not ship early.
5. **Tools, proof and publication.** Extend atlas/slice/golden/benchmark/postcard tools to the real context. Produce the sites atlas, required SW→NE plan section and sixteen first-pass surface postcards. Exercise both worlds, boundaries, map/region travel, edits and restored positions in the local production build. Publish verified increments and keep their report current.

The phase closes only when each of the twelve ring regions measures 90–110 km² and warped ring boundaries stay within ±500 m; the sites output accounts for 30 Seats, 106 general forts, every documented descent type with actual source/destination overlap, three broken bridges and valid spawn candidates. Spawns are dry, buildable, at radius ≥16 km, ≥3 km from Seats, with water/timber nearby. Named descent exceptions remain explicit; unsatisfied links are errors, not omitted markers. A ranked reserve of 256 candidates is the initial engineering target; mutable player-network exclusions belong to later gameplay.

The section shows surface profile, footprint bands and solid shelves, with a legend distinguishing plan overlays from actual material. It must not imply unbuilt caverns. Tests also cover weight continuity, deterministic drainage/accumulation, flat owned water with closed shores, negative/world-edge coordinates, no cross-world saves, and stale/failed/cancelled navigation. Run Node and three-browser goldens, tests/check/build, clean Node22 build, inspected terrain images and A7 screen checks. Performance targets remain measured and reported, not silently relaxed.

## Shared boundary

Public imports are `world/types.ts`, `world/regions.ts`, `world/world-context.ts` and `worldplan/index.ts`.

- `buildWorldPlan(seed, onProgress?)` produces structured-cloneable `WorldPlanData`; progress reports work counts, never a time budget.
- `hydrateWorldPlan(data)` validates and exposes surface/layer weights, footprint, macro height, water and sites.
- `createWorldContext({kind, seed, plan?})` uses `main | test`; main requires its matching plan. The context supplies reusable point/area sampling, an explicit column layout and conservative bounds over the complete requested rectangle. The original test generator and its values remain intact.
- Region indices are stable members of the explicit `REGION_IDS` table, never hashes of display names. Sixteen surface definitions include the Frost and source-grounded name/kanji/discovery content. Underground IDs remain metadata until their playable phases.
- `terrainMacro` caches the baseline, bowl/owned shapes and regional macro contribution once. Columns add the separate remaining relief. `routingHeight` is a flood result and never substitutes for terrain. Float64 precision is preserved in caches and transferred plans.

## Client boundary

The UI receives plain data through `contracts/game-ui.ts`, with no renderer objects or duplicate terrain generator. World identity is `{kind, seed, generation}`. A dedicated world-session ID guards asynchronous work and stays distinct from ordinary snapshot revisions.

The snapshot adds loaded-world identity, plan/terrain stage and map metadata. Starting explicitly supplies a world kind; clearing edits targets the full world session. Map requests carry that session, bounds and dimensions; responses contain actual region/water pixels and label anchors. Exact cursor-to-region inspection comes from the context. The UI owns pan, zoom, cursor and chosen point; the initial chosen point is the avatar position.

Teleport requests contain x/z or a stable surface-region ID, never y. The engine resolves safe ground against generation plus edits, prepares destination chunks and render resources, and commits body/camera together. Until success, the previous world/pose remains valid. Cancellation, failure and stale sessions cannot commit later. Chosen yaw/zoom/tilt survive; interpolation, aim and cut are reset coherently. C3's short glide/long fade and reduced-motion rule apply, without exposing unloaded terrain during a glide. Movement, edits and requests respect the canonical frame.

The map blocks world input without pausing the clocks. Closing it cancels a pending map teleport; successful travel closes it. A preparation failure uses the existing load-failed presentation rather than invented copy. Go to region is absent in the sandbox, which has no named regions.

First entry is remembered by world save identity, with a session-only fallback when storage is unavailable. Clear my edits does not clear discoveries. A new arrival replaces an older active discovery card so old regions are not narrated over the new location. The test world emits no regional card.

The custom Select exposes field ownership to the sole keyboard arbiter. Escape dismisses tooltip, Select, focused field, then the relevant panel/screen. World arrows and movement keys cannot leak through a Select. The new Map key is registered exactly once.

## Implementation ownership

Three isolated Astra writers handle shared WorldPlan/context, client engine/lifecycle and catalogue UI. The psrdnoise port is an independently verified dependency. Shared and client contracts are exchanged as exact file/hash snapshots; writers do not author competing contracts. Root integrates, updates version/goldens/notices/configuration, runs combined acceptance and publishes. Rendering, full-plan sampling and benchmarks use one exclusive lane.

The public-site browser launch remains unavailable after the recorded automatic approval-review rejection. It is not retried through a different route. Local production gameplay, source-bound images and public HTTP/artifact checks remain separate evidence; the limitation stays explicit in reports.
