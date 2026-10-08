# 10 · Prior art: what we take from others

Most of the hard parts of COLDFRONT have been solved somewhere before. This doc lists what to take, what only to study, and what to avoid, with licences checked. It was compiled on 2026-09-30 from three research passes (engine and rendering, terrain generation, units and simulation).

"Verified" in the licence column means the researcher opened the repo's LICENSE file, its package licence field or the author's explicit statement. Anything else is marked unverified: check it yourself before copying.

**Rule for the agent:** before writing a system from scratch, check this doc. Before adding a dependency or porting code that isn't listed, check its licence yourself, add a row here, and mention it in the PR report.

---

## 1. Licence rules (hard)

COLDFRONT will charge money (paid lives), so it is a commercial product.

| Licence | What you may do |
|---|---|
| MIT, BSD, ISC, Apache-2.0, Zlib, CC0, Unlicense | Copy or port. Keep the copyright notice: add an entry to `THIRD_PARTY_NOTICES.md` and a header comment in the ported file naming the source and licence. |
| MPL-2.0 | Only as **separate files** that keep their MPL header. Keep game code out of those files. Their source ships with the game: the build copies them into `packages/client/dist/licenses/`, and `THIRD_PARTY_NOTICES.md` and the credits screen point there (`07-architecture.md` §8). |
| LGPL, GPL, AGPL, Artistic | Study the ideas (docs, talks, papers, changelogs). **Never copy code, and never paste their source into your context**: you could reproduce it without meaning to. Work from written descriptions instead. |
| Non-commercial (CC BY-NC, Shadertoy's default CC BY-NC-SA 3.0), "all rights reserved", or no licence at all | Don't copy. For unlicensed articles, re-derive from the idea in your own code. |

**Off-limits sources: don't open, clone or read their code.**
- **Big Globe.** Version 6 and later are "all rights reserved", and the licence explicitly forbids using its source, data, assets or documentation to train AI. Versions 5 and earlier are CC BY-NC 4.0. It stays our *quality target*: learn from playing it and from its public changelogs only.
- **Voxy** (all rights reserved), **Sodium** (PolyForm Shield), **Distant Horizons** (LGPL-3.0; its public API docs are fine to read), **Veloren** (GPL-3.0), **Baritone** (LGPL-3.0), **Mindustry** (GPL-3.0), **Luanti** (LGPL-2.1).
- **Minecraft itself:** no Mojang assets, textures or data tables (including the `minecraft-data` package), and no ports of decompiled code. Build our own block registry. Public descriptions of how Minecraft behaves (the Minecraft Wiki, talks) are fine to learn from.

**Trust original headers only.** Relabelled copies are common: godotshaders.com labels snippets CC0 whatever the original says; copies of hg_sdf from before 2021-07-28 are non-commercial only; some ports of MPL code carry the wrong licence.

**Determinism.** Anything ported into `packages/shared` must pass the allowlist in `04-terrain.md` §3. Replace these on sight:
- `Math.sin`, `cos`, `pow`, `log`, `exp`, `atan2`, `cbrt`, `hypot`, and the `**` operator
- `Math.random`, `Date.now`, `performance.now` (including wall-clock time limits on searches)
- the shader hash `fract(sin(x) * 43758.5453)`
- GLSL `mod` (differs from JS `%` for negative numbers) and `x | 0` on large or negative floats

---

## 2. Engine and rendering

| Name | Licence | Take | What exactly | Link |
|---|---|---|---|---|
| **three.js r186** | MIT, verified | use (pin the exact version) | `WebGLRenderer`; the `SunLight` addon (`three/addons/lights/SunLight.js`; two cascaded shadow maps that WebGLRenderer supports natively; checked in the r186 source); `BatchedMesh`; `Sky`. `WebGLNodesHandler` (TSL materials on WebGL) is new; spike it before relying on it. | [repo](https://github.com/mrdoob/three.js) |
| **Voxelize** | MIT, verified; active | study, port pieces | The closest prior art: TypeScript + three.js client, workers, Rust server and WASM mesher. Port its BFS light add/remove for R, G, B and sun (`packages/core/src/core/world/lighting.ts`) and its worker-pool helpers. | [repo](https://github.com/shaoruu/voxelize) |
| **binary-greedy-meshing** (cgerikj) | MIT, verified | port | Bitwise face culling and merging, compact quads, quads enlarged by ~1 px to hide T-junction sparkles. v2 has no AO; the v1.0.0 branch has it. | [repo](https://github.com/cgerikj/binary-greedy-meshing) |
| **binary_greedy_mesher_demo** (TanTan) | MIT/Apache-2.0, verified | port | Closest blueprint for **32³ chunks**: padded columns for culling, 32-bit merge planes keyed by block and AO. | [repo](https://github.com/TanTanDev/binary_greedy_mesher_demo) |
| **ao-mesher, greedy-mesher** (Mikola Lysenko) | MIT, verified; old | port the rules | Per-vertex AO `s1 && s2 ? 0 : 3 − (s1 + s2 + c)`; flip the quad diagonal when `a00 + a11 > a01 + a10`; merge only faces whose four AO values match. (The 0fps article code has no licence; use these modules.) | [ao-mesher](https://github.com/mikolalysenko/ao-mesher) |
| **ClassiCube** `FancyLighting.c` | BSD-3, verified | port with attribution | Add and remove light queues; sunlight from a heightmap. | [repo](https://github.com/ClassiCube/ClassiCube) |
| **Divine Voxel Engine** | MIT, verified | study | Splitting work into world, mesher and generator threads; RGB light propagation. | [repo](https://github.com/Divine-Star-Software/DivineVoxelEngine) |
| **noa-engine** | MIT, verified; unmaintained | study | A mature JS greedy mesher that puts AO in the merge key. | [repo](https://github.com/fenomas/noa) |
| **prismarine-viewer, minecraft-web-client** | MIT, verified | study | Worker meshing; input tricks: `requestPointerLock({ unadjustedMovement: true })` and `navigator.keyboard.lock()`. **Never** their textures (Mojang's). | [viewer](https://github.com/PrismarineJS/prismarine-viewer) |
| **Distant Horizons** public API docs | LGPL-3.0 (code) | study the docs only | Each far cell is a column of vertical runs (bottom, top, block, light); far geometry has its own near/far depth range. | [API docs](https://distant-horizons-team.gitlab.io/distant-horizons/allclasses-index.html) |
| **pmndrs postprocessing** | Zlib, verified | use | `EffectPass` merges effects into fewer full-screen passes; `BloomEffect`, tone mapping. Also required by takram's effects. | [repo](https://github.com/pmndrs/postprocessing) |
| **@takram/three-atmosphere** | MIT, plus BSD-3/MIT/Apache file notices, verified | use from phase 1.4 | Physically based sky and **aerial perspective** (the distance haze that sells 5–16 km views). Its light-source mode works with Lambert materials and shadows. Test it together with our depth setup. Generate its lookup textures at runtime (`PrecomputedTexturesGenerator`), never from its default remote URL, and set `worldToECEFMatrix` for our flat world (`04-terrain.md` §13.7). | [repo](https://github.com/takram-design-engineering/three-geospatial) |
| **@takram/three-clouds** | MIT, verified | optional "high" preset | Volumetric clouds. Its default textures load from GitHub at runtime: self-host them (our COEP headers would block them anyway). | same repo |
| **stats-gl, Spector.js, lil-gui** | MIT, verified | use (dev) | Performance overlay; WebGL frame capture; tuning panel. | [stats-gl](https://github.com/RenaudRohlinger/stats-gl) |
| **Playwright, pixelmatch** | Apache-2.0, ISC, verified | use | Screenshots and image diffs (`toHaveScreenshot` bundles pixelmatch). Contact sheets: lay images out on an HTML page and screenshot it, so no extra dependency is needed. `sharp` also works (npm-only install; its bundled libvips is LGPL, fine as a dev tool). | [Playwright](https://playwright.dev) |
| N8AO | CC0/ISC | skip | Screen-space AO is redundant with baked per-vertex AO. | — |
| three.js `Water`, `Water2` | MIT | skip | They re-render the scene every frame. Write a cheap water shader (fresnel, sky reflection, depth fade). | — |
| Bevy / bevy_voxel_world (Rust → WASM) | MIT/Apache-2.0, verified | skip | Slow builds on a 4-vCPU VM, limited web multithreading, and black WebGPU screenshots headless. Not built for a 43 km world. | [repo](https://github.com/splashdust/bevy_voxel_world) |

**Engine decisions this audit confirmed or changed** (applied in `07-architecture.md` and `04-terrain.md`):
- **Keep** TypeScript + three.js **WebGLRenderer (WebGL2)**. On r183, WebGPURenderer measured about twice the CPU time per frame on scenes with thousands of meshes, and headless WebGPU on SwiftShader gives black page screenshots. Keep every hot kernel (noise, meshing, lighting, pathfinding) a pure function over typed arrays, so it can become a Rust/WASM kernel later if profiling demands it.
- **Keep** `MeshLambertMaterial` + `onBeforeCompile`, confined to one module, and **override `customProgramCacheKey`**: by default three.js keys programs by the hook's source text, so two materials with the same hook but different captured values would share one compiled program.
- **Change** the CSM addon to **`SunLight`**. **Change** `EffectComposer` + `UnrealBloomPass` to **pmndrs postprocessing**.
- **Change** far LOD from a full 3D octree to: a 3D chunk grid for LOD0–1, and a **2D quadtree of full-height column tiles** (vertical runs, Distant Horizons style) for LOD2+, packed into `BatchedMesh`. Rebuild far tiles from edited LOD0 data so player builds show at distance.
- **Meshing:** a bitwise greedy mesher. One 32-voxel row fits one int32; find set bits with `31 − Math.clz32(x & −x)`, keep values unsigned with `>>> 0`, OR in neighbour bits from separate border masks, never use BigInt. Put AO (and light) in the merge key and measure the vertex cost.
- **Lighting:** seed sky light from per-column heightmaps instead of flooding down 2.5 km columns.
- **Depth precision:** render far and near terrain in two passes with separate near/far planes by default (works in every browser). Reversed depth is optional: `EXT_clip_control` exists in about 88% of browsers but only about 6% of Firefox installs. Never use logarithmic depth (it writes `gl_FragDepth` and disables early depth testing).
- **Browser gaps:** Chrome 137+ no longer falls back to software WebGL on blocklisted GPUs, so show a clear "WebGL2 unavailable" screen. Firefox lacks `WEBGL_multi_draw`, so `BatchedMesh` falls back to one draw call per item there: budget draw calls for it.
- **Cross-origin isolation:** the `COOP: same-origin` header breaks popup-based sign-in and payment flows. Use full-page redirects for Discord login and, later, payments.

---

## 3. Units, agents and simulation (Milestone 2 onward)

The owner's rule: every unit is a Minecraft-player equivalent, driven by the game's AI or possessed by the player, and a played unit moves exactly like a Minecraft player (seen in third person: `13-units-classes-power.md` §3).

| Name | Licence | Take | What exactly | Link |
|---|---|---|---|---|
| **prismarine-physics** | MIT, verified | **port** into `packages/shared/physics` | Minecraft player physics in JS: the 50 ms tick integrator, constants, collision and step-up, liquids, ladders. Replace its Minecraft block IDs with our block properties (`shapes`, slipperiness, speed factor, jump factor, climbable, fluid), drop its version switches, use a float sine lookup table (it calls `Math.sin`), and stop it allocating objects every step. Add golden tests from the movement formulas on [mcpk.wiki](https://www.mcpk.wiki). | [repo](https://github.com/PrismarineJS/prismarine-physics) |
| **mineflayer** | MIT, verified | mirror its API | Seven movement controls plus look direction on a fixed 50 ms step; `dig`, `digTime`, `placeBlock(ref, face)`, `equip`, `craft`, `attack`. Our shared action API follows this shape. | [repo](https://github.com/PrismarineJS/mineflayer) |
| **prismarine-block** `digTime()` | MIT, verified | port the formula | Break time from tool, material, harvest rules and penalties (underwater, airborne). | [repo](https://github.com/PrismarineJS/prismarine-block) |
| **mineflayer-pathfinder** | MIT, verified; no release since 2023 | port as the **local planner only** | Its move set (walk, diagonal, jump up, drop up to 4, down, pillar, parkour), dig costs from `digTime`, and the executor that turns a path into movement controls. Don't port its A* core: it keys nodes by strings and re-simulates up to 200 physics ticks per shortcut check. | [repo](https://github.com/PrismarineJS/mineflayer-pathfinder) |
| Baritone | LGPL-3.0 | study (no code) | Costs measured in ticks; paths computed in segments and spliced; partial paths when a search budget runs out. | — |
| Hierarchical pathfinding | articles, papers | study | Castle Story's dynamic voxel hierarchy ([GDC 2018](https://gdcvault.com/play/1025151/Hierarchical-Dynamic-Pathfinding-for-Large)); Factorio's cached reverse abstract search ([FFF-317](https://www.factorio.com/blog/post/fff-317)); [HPA*](https://webdocs.cs.ualberta.ca/~jonathan/publications/ai_publications/jogd.pdf); [flow-field tiles](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter23_Crowd_Pathfinding_and_Steering_Using_Flow_Field_Tiles.pdf). | — |
| RimWorld (closed), MineColonies, Widelands, OpenTTD (GPL) | various | study | Jobs as sequences of small steps ("toils") with reservations; reachability checked by region ID before pathing; requests filled by couriers; an "economy" = one connected transport network that matches supply to demand; heavy planning jobs run on threads and are applied at a fixed game time. | [RimWorld reachability](https://ludeon.com/blog/2013/07/reachability-at-last/) |
| Utility AI; GOAP | talks | study | Utility scoring for needs and job choice ([Dave Mark, GDC 2015](https://www.gdcvault.com/play/1021848/Building-a-Better-Centaur-AI)); goal-oriented planning only for bosses ([Orkin, GDC 2006](https://gdcvault.com/play/1013282/Three-States-and-a-Plan)). | — |
| Simulation level of detail | talks, papers | study | S.T.A.L.K.E.R.'s full simulation near the player and graph-level simulation elsewhere ([interview](https://www.gamedeveloper.com/game-platforms/interview-inside-the-ai-of-i-s-t-a-l-k-e-r-i-)); the [LOD Trader](http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter14_Phenomenal_AI_Level-of-Detail_Control_with_the_LOD_Trader.pdf); Veloren's rtsim (GPL, ideas only). SimCity (2013) dropped persistent identities for speed, and players noticed. | — |
| **bitECS** | MPL-2.0, verified | use **unmodified** | ECS over typed arrays you define (shared memory works). | [repo](https://github.com/NateTheGreatt/bitECS) |
| Koota | ISC, verified | client-only option | Max ~1M entities per world; no worker/shared-memory support in its README. | [repo](https://github.com/pmndrs/koota) |
| **ws** | MIT, verified | use | 100 players is well within its range. (uWebSockets.js isn't on npm.) | [repo](https://github.com/websockets/ws) |
| **better-sqlite3** | MIT, verified | use | Synchronous API, WAL mode, works in worker threads. One writer thread, batched transactions. (`node:sqlite` is still experimental.) | [repo](https://github.com/WiseLibs/better-sqlite3) |
| lmdb-js | MIT, verified | optional | Only if saving chunk edits becomes a bottleneck. | [repo](https://github.com/kriszyp/lmdb-js) |
| Netcode articles | — | study | [Gaffer On Games](https://gafferongames.com/post/state_synchronization/) (priority accumulator, quantisation, deltas against the last acknowledged snapshot); [Gambetta](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) (prediction and reconciliation); [Valve](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking); Minecraft's sequence numbers for predicted block edits. | — |
| Minestom | Apache-2.0, verified | study | Its "Acquirable" pattern: the same code runs with one thread per region or one thread for all. | [docs](https://minestom.net/docs/thread-architecture/acquirable-api) |
| Colyseus | MIT, verified | skip | Its 64-field schema limit doesn't fit; copy only the idea of per-client state views. | — |

**Unit architecture from this audit** (applied in `05-systems.md` §3 and §22, and `07-architecture.md` §9):
- **One unit model.** A controller emits an `InputFrame` every 50 ms: `{ seq, forward, back, left, right, jump, sprint, sneak, yaw, pitch, action? }`, where the optional action is dig, place, use, attack, equip or craft with a target and face. AI controllers and a possessing player's controller emit identical frames; one shared `physics.step()` and one shared `actions.validate/apply()` consume them. Possession swaps the controller.
- **Physics runs at a fixed 20 Hz** (every Minecraft movement constant is per 50 ms step); AI, jobs and snapshots run at 10 Hz.
- **Simulation tiers T0–T3** as in `05-systems.md` §22.
- **Pathfinding:** walkable connected components per chunk section, linked across faces, with a global component ID per cell so "can A reach B?" is one lookup. Search the component graph first (reverse, cached), then local A* inside that corridor, with costs in ticks and a **node-count budget** (never wall-clock). Flow fields for goals many units share. Digging is allowed only in short local searches; tunnels and stairs become construction jobs.
- **Jobs:** per-sector job boards, reservations, utility scoring, jobs as step lists; hauling matched within one connected economy; kingdom-wide planning in a worker, applied at a fixed future tick.

---

## 4. Terrain generation

| Name | Licence | Take | What exactly | Link |
|---|---|---|---|---|
| **Minecraft Wiki**: noise router, density functions, aquifers, caves, ore veins | docs; Mojang code and data are proprietary | study | Parameters → splines (offset, factor, jaggedness) → 3D density; interpolated cells; aquifer cells with local fluid levels and barriers; cheese caves; spaghetti and noodle tubes where \|noise\| ≈ 0; ore veins. | [Noise router](https://minecraft.wiki/w/Noise_router), [Aquifer](https://minecraft.wiki/w/Aquifer) |
| Henrik Kniberg, "Reinventing Minecraft world generation" | talk | study | Why the 1.18 spline design works. | [video](https://www.youtube.com/watch?v=ob3VwY4JyzE) |
| **Big Globe** | all rights reserved (V6+), verified | **quality target only** | From playing it and its changelogs: cave systems with themes, rivers that split, river water that doesn't spread, cloud islands over oceans, deep "core" layers, eroded mountains, a 2,048-block-tall world, built-in distant terrain. | [Modrinth](https://modrinth.com/mod/big-globe) |
| Terra, Tectonic, Lithostitched, Iris | mixed (Terra: MIT API, GPL implementation, LGPL samplers; Iris: GPL) | study | Config-driven sampler graphs; density-function datapacks (continent scale, underground rivers, lava tunnels). | [Terra](https://github.com/PolyhedralDev/Terra) |
| **FastNoiseLite** (npm `fastnoise-lite`) | MIT, verified | copy **after an audit** | OpenSimplex2/2S (use 3D "ImproveXZPlanes"), cellular, FBm/ridged/ping-pong. The parts read use only allowed functions; **grep the domain-warp section** before adopting it. | [repo](https://github.com/Auburn/FastNoiseLite) |
| **OpenSimplex2** | CC0, verified | port | The reference noise implementation. | [repo](https://github.com/KdotJPG/OpenSimplex2) |
| **psrdnoise** | MIT, verified | port | Simplex noise that returns value and analytic gradient in one call (the erosion filter needs both). Replace its sin/cos gradient rotation with a hashed table of unit vectors. | [repo](https://github.com/stegu/psrdnoise) |
| Inigo Quilez's articles | no licence stated | re-derive | Noise derivatives and derivative-damped fBm (`a += b·n / (1 + dot(d, d))`), polygon and capsule SDFs, polynomial smooth-min. Write your own versions. | [noise derivatives](https://iquilezles.org/articles/morenoise/) |
| **hg_sdf** (Mercury) | MIT *or* CC BY-NC since 2021-07-28, verified | port, choosing MIT | Round, chamfer, stairs and column unions; groove and pipe operators; domain repetition. Take it only from the official source. | [site](https://mercury.sexy/hg_sdf/) |
| **Erosion filter + Phacelle noise** (Rune Skovbo Johansen, 2026) | MPL-2.0, verified | **port as a separate MPL file** | A per-point erosion filter that carves branching gullies and ridges from height + gradient, fading by slope. Needs no neighbour data, so it works per chunk. Replace its sin/cos with `detSinCos`. | [blog](https://blog.runevision.com/2026/03/fast-and-gorgeous-erosion-filter.html), [C# port](https://github.com/lpmitchell/AdvancedTerrainErosion) |
| Clay John's / Fewes' eroded noise | the core `erosion()` is CC BY-NC-SA | **don't use** | Rune's filter replaces it. | — |
| **StreamPowerErosion** (Schott et al., TOG 2023) | MIT, verified | port | Uplift-vs-stream-power erosion, run once per seed on a coarse grid. | [repo](https://github.com/H-Schott/StreamPowerErosion) |
| Tzathas et al. 2024, analytical stream-power terrain | paper (code licence unverified) | implement from the paper | Height = outlet height + ∫ u / (k·A^m) ds along the drainage tree; with m = 0.5 and n = 1 it needs only `sqrt`. The paper reports ~1.8 s at 512². | [PDF](https://www-sop.inria.fr/reves/Basilic/2024/TGSC24/Analytical_Terrains_EG.pdf) |
| Particle hydraulic erosion (Sebastian Lague, weigert) | MIT, verified | skip at runtime | Global simulations whose result depends on processing order. | — |
| **Priority-Flood** (Barnes et al.) | paper | implement from the paper | The +Epsilon and +FlowDirs variants: fills depressions and gives every cell a drain direction. (RichDEM is GPL; the reference repo has no licence.) | [arXiv](https://arxiv.org/abs/1511.04463) |
| **mapgen4 + FlatQueue** (Red Blob Games) | Apache-2.0, ISC, verified | port | `assignDownslope` (a priority queue working outward from the sea) and `assignFlow` (flow accumulation). Key the heap by (height, index): FlatQueue isn't stable. | [repo](https://github.com/redblobgames/mapgen4) |
| Génevaux et al. 2013 | paper | study | River graph first, terrain around it. | [PDF](https://www.cs.purdue.edu/cgvlab/www/resources/papers/Genevaux-ACM_Trans_Graph-2013-Terrain_Generation_Using_Procedural_Models_Based_on_Hydrology.pdf) |
| Luanti mapgens (v7, valleys, carpathian, floatlands) | LGPL-2.1, verified | study | River = \|n\| − width with bed depth ∝ √(1 − t²); valley profile d·(1 − e^(−t²)); carpathian: cubed terrain noise × ridged noise. | — |
| LayerProcGen | MPL-2.0, verified | study | How much padding each generation layer needs for features that cross chunk borders. | [repo](https://github.com/runevision/LayerProcGen) |
| Space colonization (Runions et al. 2007) | paper | implement | Tree growth toward attractor points in a crown shape. | [PDF](https://algorithmicbotany.org/papers/colonization.egwnp2007.pdf) |
| proctree.js, ez-tree | BSD-3, MIT, verified | study | Branch parameters. | [proctree](https://github.com/supereggbert/proctree.js) |
| poisson-disk-sampling | MIT, verified | skip | Samples a whole area in one ordered pass, so it can't work per chunk; also uses Math.random and trig. | — |
| jasonwebb space-colonization experiments | CC BY-NC-SA 4.0, verified | **don't use** | — | — |

**Terrain decisions this audit confirmed or changed** (applied in `04-terrain.md`):
- **Keep:** the stage order (it matches Minecraft's router and Big Globe's column design); the 4 × 4 × 4 lattice, with thin things (feature narrow band, noodle caves, micro relief) at full resolution; priority-flood water levels; cheese/spaghetti/noodle caves with breach control; strata; LOD from the same functions.
- **Rivers from drainage:** Priority-Flood+FlowDirs on the WorldPlan grid, flow accumulation, a threshold, width ∝ √(drainage area), then meanders limited to the valley width. Rivers taken from drainage always run downhill and join correctly.
- **Coarse erosion in the WorldPlan:** analytical stream-power (Tzathas 2024) or StreamPowerErosion on a 32–64 m grid, using macro elevation as uplift. Output eroded macro height plus drainage area. Per-point filters alone can't make connected drainage.
- **Gullies:** Rune Skovbo Johansen's erosion filter (MPL file) for 16 m–1 km detail; keep derivative-damped fBm for micro relief.
- **Per-region splines** mapping continentalness, erosion and peaks/valleys to offset, factor and jaggedness, as Minecraft does, so every region can be art-directed.
- **Spines:** flatten each Bézier to a polyline at plan time (≤ 0.5 m chord error), frames by double reflection, distance to a capsule chain. Exact Bézier distance needs cbrt and acos.
- **Fillets:** polynomial smooth-min only (the exponential and power variants need exp and pow).
- **Placement:** order-independent Poisson per chunk: hash one candidate per sub-cell and keep it only if no higher-priority candidate lies within r in the neighbouring sub-cells.
- **Structures:** add density under structure massing and remove it above, with a falloff (Minecraft's "beardifier" idea), so the Keep and ruins sit into the ground.
- **Aquifer cells** give caverns local fluid levels with barriers between cells.
- **Cross-engine golden hashes in CI:** hash the golden chunks in Chromium, Firefox and WebKit (Playwright on GitHub Actions), not only Node and the cloud VM's Chromium.

**1 m voxel traps:** detail under ~2 m breaks into speckle and floating blocks (erosion octaves under ~8 m, noodle caves under 2 m, spike tips, knife ridges). Trilinear interpolation erases detail under 4 m and makes 45° facets. Bent or displaced SDFs stop being true distances: widen the narrow band by the Lipschitz factor. Voxel water can't slope: use stepped falls, or river water that doesn't spread.
