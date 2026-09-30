# 07 · Architecture

The technical plan. The agent owns technical decisions. Where this doc is silent, choose the simplest thing that respects §1 and log the choice in `docs/progress.md`. Before building any system, check `10-prior-art.md` for code we can take and the licence rules that govern it. Sections marked **(M5+)** are design intent for later milestones: build Milestone 1 so it won't block them, but don't build them yet. Terrain-specific engineering (pipeline, LOD, lighting, postcards) is specified in `04-terrain.md`.

---

## 1. Principles

1. **One codebase, every runtime.** Game rules and world generation live in `packages/shared`, pure TypeScript with no DOM and no Node APIs. The same code runs in the browser main thread, Web Workers, Node tools, tests and (later) the server.
2. **Determinism is a feature.** World generation is bit-identical everywhere (§4). Multiplayer depends on it: clients regenerate terrain locally, and the server only sends edits.
3. **Data-oriented.** Typed arrays, struct-of-arrays, pools. No per-frame allocation in hot paths.
4. **Measure, then optimise.** Benchmarks and budgets exist from day one (`04-terrain.md` §15). Profile before rewriting. Rust→WASM is an option for proven hot loops, not a starting point.
5. **Always shippable.** `main` always builds, and every phase ends in something the owner can open and play.

---

## 2. Stack (fixed)

| Area | Choice |
|---|---|
| Language | TypeScript, `strict`, ES2022 modules |
| Runtime and packages | Node 22 for builds and tools (the cloud VM's default; `engines: >=22.12`, and a `.node-version` file containing `22`); the server targets **Node 24 LTS** (Node 22 reaches end of life in April 2027). **npm workspaces** |
| Client build | Vite |
| Rendering | three.js **r186, pinned to an exact version**, `WebGLRenderer` (WebGL2). Terrain material = `MeshLambertMaterial` extended via `onBeforeCompile` in one module, with `customProgramCacheKey` overridden (keeps three's shadows and fog). Shadows: `SunLight` (two cascades; in r186 imported from `three/addons/lights/SunLight.js`). Post: **pmndrs `postprocessing`** (`EffectPass`, bloom, tone mapping). Sky: three's `Sky` and fog first; **`@takram/three-atmosphere`** aerial perspective from phase 1.4. |
| UI | Preact + `@preact/signals` (pin the major version), plain CSS with tokens (`06-ui-art.md` §5), `@fontsource` fonts, icons from the framework-free `lucide` package (avoids peer-version clashes with Preact) |
| Threads | Module Web Workers with a typed message protocol and transferables. `SharedArrayBuffer` is an optimisation used when `crossOriginIsolated`; everything must work without it. |
| Tools | Node CLIs run with `tsx`; `pngjs` for images; Playwright (version pinned to match the installed browser) for postcards and smoke tests; contact sheets by screenshotting an HTML grid page; `stats-gl` and Spector.js for profiling |
| Tests | Vitest; Playwright for end-to-end smoke tests |
| Lint and format | Biome |
| Tuning panel | `lil-gui`, loaded only with `?dev` |
| Units **(M2+)** | `packages/shared/src/physics/`: a port of prismarine-physics (Minecraft player physics); a shared action API shaped like mineflayer's; bitECS (MPL-2.0, used unmodified) for simulated units |
| Server **(M5+)** | Node 24 LTS + TS, `ws` (binary WebSocket), `worker_threads`, `better-sqlite3` (WAL, one writer thread); `lmdb-js` only if chunk-edit writes become a bottleneck |
| Hosting | Cloudflare Pages for the client and per-branch previews; the owner self-hosts the server (Docker Compose + a TLS tunnel) |

Nothing loads from a CDN at runtime. Every dependency comes from npm and is bundled.

---

## 3. Repository layout

```
/
├─ CLAUDE.md            agent rules (read every session)
├─ .claude/settings.json  shipped by the owner: ultracode, worktrees from HEAD, pre-approved routine commands, the SessionStart `npm ci` hook. The agent never edits it
├─ .github/workflows/ci.yml shipped by the owner: check, test, build, cross-browser golden hashes. The agent never edits it
├─ .gitignore
├─ THIRD_PARTY_NOTICES.md notices for every ported or copied third-party file (10-prior-art.md §1)
├─ README.md            owner's guide
├─ PROMPTS.md           prompts the owner pastes into sessions
├─ docs/                design docs, diagrams, committed postcards, progress log, owner references
├─ packages/
│  ├─ shared/           pure TS: constants, math, noise, sdf, worldgen, blocks (later: sim, items, protocol)
│  │  ├─ src/world/constants.ts
│  │  ├─ src/math/      hash2..hash5, rand, det.ts (detPow/detLog/detExp/detSinCos), vec
│  │  ├─ src/noise/     OpenSimplex2 2D/3D (+ derivatives), fbm, ridged, derivative-damped fbm, worley, warp, region splines, quantiles
│  │  ├─ src/sdf/       primitives, ops, Bézier spines (arc length, RMF frames), polygon sections
│  │  ├─ src/third_party/ ported MPL files, kept separate with their licence headers (e.g. the erosion filter)
│  │  ├─ src/physics/   (M2) the prismarine-physics port and the shared action API
│  │  ├─ src/worldgen/  plan/ columns/ density/ features/ carvers/ fluids/ materials/ decoration/
│  │  │                 regions/<regionId>.ts (one recipe per region), pipeline.ts, version.ts
│  │  ├─ src/blocks/    registry.ts, textures/recipes.ts
│  │  └─ test/          unit tests, golden/worldgen.json, forbidden-tokens.test.ts
│  ├─ client/           the game (Vite)
│  │  ├─ src/engine/    renderer, chunk store, streaming, lod (3D chunk grid + column-tile quadtree), workers (gen, light, mesh), sky, water, post
│  │  ├─ src/game/      player controller, physics, camera modes, edits persistence
│  │  ├─ src/ui/        tokens.css, components/, hud/, screens/
│  │  ├─ src/dev/       F3 overlay, teleports, view modes, postcard mode, lil-gui (?dev)
│  │  └─ public/_headers
│  ├─ tools/            atlas, slice, postcards (+ cameras/), terrain-report, bench, golden
│  └─ server/           (M5+)
└─ out/                 generated scratch output (gitignored)
```

---

## 4. Determinism rules

These apply to anything whose output must match across machines: world generation now, and later the parts of the simulation clients predict.

- **The allowlist** in `04-terrain.md` §3 is the rule: only `+ − * / %` and `Math.{abs, floor, ceil, round, trunc, sign, min, max, sqrt, fround, imul, clz32}` plus the Math constants.
  - No `**`, no other Math function, no `Date`, `performance`, `crypto`, `Intl` or locale APIs.
  - `det.ts` supplies tested replacements.
- **A Vitest test scans `packages/shared/src`** for forbidden tokens and fails. Only Chromium is available in the cloud VM, so this lint is the cross-engine guard.
- **Numbers:**
  - fixed-arity hashes
  - constants with ≤ 17 significant digits
  - `Math.floor` for cell indices, never `| 0` on possibly-negative floats
  - float64 caches
  - total-order comparators
- Plain IEEE arithmetic is identical across engines: JS never fuses multiply-adds, and `sqrt` is correctly rounded. Any future WASM kernel must be the **only** implementation (used by Node and the browser alike), never a parallel one.
- `WORLDGEN_VERSION` plus the golden test guard all of this (`04-terrain.md` §3 and §14.7).
- **Cross-engine check in CI.** The owner-shipped `.github/workflows/ci.yml` runs the golden chunk hashes in Chromium, Firefox and WebKit through Playwright (GitHub's runners can download all three browsers; the cloud VM can't), as soon as phase 1.1 defines the `test:golden:browsers` script.
- **Gameplay code** (physics, actions, AI, from Milestone 2) follows the same rules: trigonometry from a shared Float32 lookup table; identical number types on client and server (a `Float32Array` field is `Float32Array` everywhere); searches limited by **node count, never wall-clock time**; worker results applied in sorted order at a fixed tick; no `Math.random` or `Date.now`, only seeded random streams.

---

## 5. Data model

### Blocks
- `uint16` IDs. **Append-only from Milestone 2:** never renumber or reuse IDs once saved edits refer to them. During Milestone 1 the registry may change, and saved edits are wiped when the registry or worldgen hash changes.
- Block properties:
  - name
  - render type: opaque / cutout / translucent / fluid
  - solid, granular (falls)
  - emissive colour and level; gloss
  - light filtering, hardness
  - material properties (`05-systems.md` §13): strength, heat resistance, insulation, ward, rot, weight, flammable
  - texture recipe per face, variant count

### Chunks and tiles
- **LOD0–1 chunks** are 32³ samples in a 3D grid. **LOD2+ tiles** are 32 × 32 sample columns covering the vertical band (`04-terrain.md` §13.5), each column stored as vertical runs.
- **In memory:** during generation, lighting and meshing, chunks are raw `Uint16Array`s. After meshing, **only LOD0 chunks keep voxel data** (needed for editing, collision and relighting); LOD1 chunks keep only their meshes; tiles keep their meshes and may keep their runs for rebuilding after edits.
- **Storage and network:** palette compression with bit widths of 1, 2, 4, 8 or 16 (so indices never straddle words). A uniform chunk (all air, all stone) stores a single ID.
- **Light:** `Uint16Array`, 4 bits sky + 3 × 4 bits RGB block light, for LOD0 only.
- **Keys**, each packed into one integer:
  - chunks: `(cx, cy, cz, lod)` with cx, cz −704…703 and cy −48…31 at LOD0; lod 0…1
  - tiles: `(tx, tz, lod)` with lod 2…6

### Edits
- Stored sparsely per chunk: voxel index → block ID (plus metadata later).
- A chunk = base generation + edits.
- An edit on a chunk border also refreshes the neighbour's halo and mesh.
- M1 keeps edits per seed in IndexedDB; M5 moves them to the server database.

### Entities (M2+)
- bitECS over typed arrays, for simulated units only.
- Identities for all people are compact records outside the ECS (plain tables, then SQLite on the server). Only *hydrated* units are ECS entities (§9).
- **One unit model.** Each simulated unit has a swappable controller that emits an `InputFrame` every 50 ms: `{ seq, forward, back, left, right, jump, sprint, sneak, yaw, pitch, action? }`, where `action` is dig, place, use, attack, equip or craft with a target and face. AI controllers and a possessing player's controller emit identical frames; one shared `physics.step()` and one shared `actions.validate/apply()` consume them. Possession swaps the controller. (`10-prior-art.md` §3.)

---

## 6. Client

**Chunk pipeline**
`requested → generating → generated → lighting (LOD0) → meshing → uploaded → visible → evicted`
- A priority queue ordered by screen-space error, distance and frustum.
- Evict by LRU and distance.
- Normal play caps GPU uploads per frame (≤ 8 meshes). Postcard mode has no cap and no render loop (`04-terrain.md` §14.3).

**Workers**
- A pool of `min(hardwareConcurrency − 1, 6)` workers.
- **Every chunk of one column goes to the same worker**, so its column cache hits.
- Each worker holds the WorldPlan: shared memory when available, otherwise a copy (a few MB).
- Messages are small typed objects plus transferable buffers.

**Lighting, meshing, LOD, far shadows**
As specified in `04-terrain.md` §13:
- sky and RGB block light BFS for LOD0, with sky light seeded from per-column heightmaps; analytic region lights underground
- a **bitwise greedy mesher** for LOD0–1 (ported per `10-prior-art.md` §2); zero-crossing column meshing for LOD2+
- LOD0–1 in a 3D chunk grid; LOD2+ as a **2D quadtree of full-height column tiles** packed into `BatchedMesh`; screen-space-error selection and skirts
- a far-shadow horizon map

**WebGL2 or nothing.** If the browser can't create a WebGL2 context (Chrome 137+ no longer falls back to software rendering on blocklisted GPUs), show a clear screen saying so, with what to try. Firefox lacks `WEBGL_multi_draw`, so budget draw calls for it.

**Depth and origin**
- Near plane ≥ 0.2 m.
- **Two-pass render by default:** far terrain (LOD2+) with its own near/far planes, clear depth, then near terrain. It works in every browser. Reversed depth (`EXT_clip_control`, missing in most Firefox installs) is an optional upgrade. Never logarithmic depth: it writes `gl_FragDepth` and disables early depth testing.
- Vertices stay chunk-local, and `gl_Position` always goes through `modelViewMatrix` (three.js builds it in float64 on the CPU).
- A render origin rebases every ~1 km for world-space shader math.

**Post-processing**
pmndrs `postprocessing`: `RenderPass → EffectPass(Bloom with threshold, ACES tone mapping, optional FXAA)`. From phase 1.4, takram's aerial perspective joins the chain.

**Game layer (M1)**
- Pointer lock (`unadjustedMovement: true`); click-to-play enters fullscreen and calls `navigator.keyboard.lock()` where supported, so Ctrl-sprint doesn't trigger Ctrl+W (close tab); where it isn't (Firefox, Safari), sprint is double-tap W and a `beforeunload` guard asks before the tab closes. An AABB player controller; DDA raycast for block picking; camera modes: first person, king's view (RTS), and third person (F5).
- **The player controller is the Minecraft controller** (the owner's rule): first person, Minecraft's controls (`06-ui-art.md` §6) and movement feel. From Milestone 2 the M1 controller is replaced by the shared unit physics (the prismarine-physics port), so the player and every NPC move identically.
- Player constants: **Minecraft's per-tick values at a fixed 20 Hz** (1 block = 1 m; a tick is 50 ms):
  - box 0.6 × 1.8 × 0.6 m; eye at 1.62 m (1.27 m sneaking)
  - walk ≈ 4.317 m/s, sprint ≈ 5.612 m/s, sneak ≈ 1.31 m/s
  - jump: initial vertical velocity 0.42 blocks/tick; gravity 0.08 blocks/tick² with 0.98 vertical drag per tick (≈ 1.25 m jump apex)
  - step-up 0.6 m, always on; auto-jump is an optional setting, off by default
  - swim in water
  - fly 20 m/s, with a ×10 boost key (dev tool through Milestone 4)

**UI layer**
- A Preact app over the canvas.
- Game state reaches the UI through signals, updated at most 10 Hz for HUD values. The UI never touches Three.js objects directly.

---

## 7. Tools (Node)

| Command | What it does |
|---|---|
| `npm run atlas` | top-down PNG maps with coverage reports (`04-terrain.md` §14.1) |
| `npm run slice` | cross-section overview and windows (`04-terrain.md` §14.2) |
| `npm run postcards` | camera resolution and validation, headless screenshots (`04-terrain.md` §14.3). Browser flags are in `CLAUDE.md`. |
| `npm run terrain-report` | numeric terrain diagnostics per region (`04-terrain.md` §14.5) |
| `npm run bench:gen` | generation, lighting and meshing timings on the fixed bench set |
| `npm run golden:update` | regenerate golden hashes whenever generated output changes (bump `WORLDGEN_VERSION` at most once per PR) |

Atlas, slice and the report may use `worker_threads` for speed. Postcards must work in the cloud session's headless environment: software WebGL through SwiftShader.

---

## 8. Build and deploy

- Root `npm run build` builds `shared` and `client` into **`packages/client/dist`**.
- **Cloudflare Pages settings** (the owner sets these once; see `README.md`):
  - build command `npm run build`
  - output directory `packages/client/dist`
  - environment variable `NODE_VERSION=22`
- Every pushed branch gets a preview. The branch alias is the branch name, lowercased, with non-alphanumerics turned into `-`, trimmed, and **truncated to 28 characters**. Read the real URL from Cloudflare's PR comment or commit status (see `CLAUDE.md`).
- **Cross-origin isolation.** `packages/client/public/_headers`:
  ```
  /*
    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp
  ```
  - Set the same headers in the Vite dev and preview servers.
  - The postcard tool asserts `crossOriginIsolated`.
  - `COOP: same-origin` cuts popups off from the page, so sign-in (Discord) and, later, payments use **full-page redirects**, never popups.
  - Because of these headers, every asset (fonts included) must be self-hosted.
  - **MPL files ship with their source.** The build copies `packages/shared/src/third_party/*` into `packages/client/dist/licenses/`, and `THIRD_PARTY_NOTICES.md` and the credits screen link to it. No public repo is needed. The owner must **not** enable Cloudflare Web Analytics: its injected script is cross-origin and gets blocked.
- Keep the build under ~5 minutes and each asset under 25 MiB. Textures are generated at runtime, so assets stay small.

---

## 9. The server (M5+)

**Authoritative simulation**
- **Physics at a fixed 20 Hz** (two steps per simulation tick): every Minecraft movement constant is per 50 ms step, so slower physics would make units move at half speed and jump wrong.
- **AI, jobs and snapshots at 10 Hz.**
- **Simulation tiers T0–T3** (`05-systems.md` §22): possessed, near a camera, loaded but unwatched, ledger.
- **Systems** (ECS): movement and pathing, jobs and tasks, needs, production, logistics, combat, morale, loyalty, network connectivity and news, enemy AI, Wardens, hazards, decay.

**Space and attention**
- The world is divided into 256 m **sectors**, with vertical bands (the world goes 1.5 km deep) and hysteresis at sector edges.
- A sector is **active** when a player's camera or possessed unit is near it. In an active sector, units within ~64–128 m of a camera run at T1 and the rest at T2 (`05-systems.md` §22). Every other sector runs at **T3, the ledger** (aggregates). Battles in ledger sectors resolve with the regiment-level combat model; a camera arriving mid-battle hydrates it.
- Every system provides `hydrate` and `dehydrate` functions. Invariant tests check that ledger and agent simulations agree on average (production rates, consumption, loyalty drift) within tolerance, and **round-trip tests** prove that hydrating and dehydrating never duplicates or loses an item, a person or a hit point.

**Pathfinding** (`10-prior-art.md` §3)
- **Reachability first.** Walkable connected components per chunk section, linked across section faces, with a global component ID per cell: "can A reach B?" is one lookup. Rebuild only changed sections, lazily and in batches per tick.
- **Search.** A reverse, cached search over the component graph, then local A* inside that corridor. Costs in ticks; a node-count budget per search.
- **Flow fields** for goals many units share (stockpiles, marches), built only along the route. Roads lower the cost.
- **Digging** is allowed only in short local searches (the ported mineflayer-pathfinder move set). Tunnels and stairs become construction jobs.
- Path requests are served by worker threads from one queue and cached per route.

**Jobs**
- Officials post work orders to **per-sector job boards**; a unit reserves a job when it takes it; units pick jobs by utility score, and officials can assign directly.
- A job is a list of small steps. At T0/T1 the steps emit InputFrames; at T2 they are timed actions; at T3 they are production rates.
- Hauling matches requests to supplies within one connected transport network. Kingdom-wide logistics planning runs in a worker, and its result applies at a fixed future tick.

**Threads**
- Main: network and orchestration.
- Simulation workers: partitioned by sector.
- A persistence writer.

**Scale goal (validate with load tests before promising it):** 100 kings, tens of thousands of hydrated units with a few thousand at full detail (T0–T1) at once, 1–2M identities, on one self-hosted machine (8+ cores, 32 GB). Even optimised physics at 1–3 µs per step costs 1–3 CPU cores for 50k units at 20 Hz, so measure early.

**Networking**
- Binary WebSocket (WebTransport later). A versioned codec schema in `shared/protocol` (DataView). No JSON on hot paths.
- **Terrain:** clients regenerate base terrain from `(seed, WORLDGEN_VERSION)`. The server sends only sparse chunk edit diffs. A version mismatch blocks joining until the client updates.
- **Entities:** interest-managed by the client's connected coverage and camera area. Snapshots plus deltas at 10 Hz against the last snapshot the client acknowledged, with quantised positions and a per-client priority accumulator; distant units are sent as aggregates or as a path plus start tick. Client interpolation. Prediction and reconciliation only for the possessed unit, including its digging and placing, using sequence numbers the server acknowledges.
- **Commands** are intents. The server validates everything (reach, range, permissions, rate limits). Never trust the client.

**Persistence**
- SQLite: accounts, seasons, kingdoms, people, items and containers, buildings, chunk_edits (compressed diffs), routes, market orders, chronicle, scores.
- In-memory authoritative state, with checkpoints every ~60 s plus immediate writes for critical events (kings' deaths, Warden kills, trades).
- Nightly backups; a season archive at the Frost.

**Auth and admin**
- Discord OAuth2 with a server-side code exchange, using a **full-page redirect, not a popup** (COOP cuts popups off from the page).
- Session tokens.
- An admin CLI (and later a web panel): kick, ban, announcements, season control, metrics.

**Self-hosting** (a guide gets written at M5)
- One `docker compose up -d` on the owner's machine, configured through a `.env` file.
- A TLS tunnel (Cloudflare Tunnel or similar) gives the static client a `wss://` URL.
- Update = pull + restart. Backups are file copies.

---

## 10. Testing strategy

| Layer | What |
|---|---|
| Unit (Vitest) | hash and noise ranges, quantiles and continuity; SDF correctness; stage outputs; mesher correctness (face counts, AO cases, zero-crossing columns); palette codec round-trips |
| Determinism | golden chunk hashes across seeds, regions and LODs; the forbidden-token scan; the same hashes in Chromium, Firefox and WebKit in CI |
| Physics (M2+) | golden movement tests from Minecraft's movement formulas (walk, sprint, jump, fall, swim, ladders) |
| Visual | postcards, rubric, blind review, diagnostics (`04-terrain.md` §14) |
| Smoke (Playwright, headless) | the client loads, generates, walks, breaks and places, teleports from the map, with no console errors and `crossOriginIsolated` true |
| Performance | `bench:gen` numbers against budgets (warn, don't fail, in M1) |
| Later | simulation invariants (ledger vs agent), bot load tests, protocol fuzzing |

`npm test` runs unit, golden and forbidden-token tests. `npm run check` runs types and Biome. Both must pass before every push.

---

## 11. Coding standards

- `strict` TS. No `any` except at I/O boundaries (with a comment). Explicit return types on exports.
- Small modules. Pure functions in `shared`; side effects at the edges.
- **Use the design's words in code:** Warden, Seat, Muster, Reeve, Quartermaster, Descent, Shelf, Coverage, News.
- Each region recipe file starts with a comment linking its section in `04-terrain.md`.
- Comments explain *why*. Put tunables in named constants or recipe objects, never magic numbers inline.
- Fail loudly in dev; degrade gracefully in production (retry the chunk, log it, keep running).
- **Dependencies:** few and well known. Adding a heavy dependency needs a one-line justification in `progress.md`.
- **Third-party code** follows `10-prior-art.md` §1: check the licence, record it in `THIRD_PARTY_NOTICES.md`, keep MPL files separate, and never paste GPL, LGPL, non-commercial or "all rights reserved" source into your context.
- **Git:** small commits with clear messages. `out/` is gitignored; `docs/postcards/**` is committed: phase-end renders, plus the small work-in-progress contact sheets in `docs/postcards/wip/`.
