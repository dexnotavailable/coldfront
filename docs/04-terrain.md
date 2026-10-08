# 04 · Terrain (Milestone 1: the world)

Milestone 1 is the world. The owner's previous attempt, with another model, failed here: the terrain looked procedural and primitive, and the hellscape "spikes" were plain cones. **Terrain quality is the product in this milestone.** "It generates" is not done. Done means it meets the phase's bar in `08-roadmap.md`, proven with screenshots graded against the rubric (§14).

Read §1–§3 before writing any code. §4–§10 are the generation pipeline, §11–§12 the region recipes, §13 rendering, §14 tooling and the review loop, §15 budgets, §16 the phase checklist.

World geometry (rings, layers, regions, descents) is defined in `02-world.md`. This doc says how to *generate* it. `10-prior-art.md` §4 lists code we can port (noise, erosion, drainage, SDF operators) and sources that are off-limits: **Big Globe is our quality target, but its code is all rights reserved and forbids AI use. Never open it; learn from playing it and its changelogs.** Code paths follow `07-architecture.md` §3 (`packages/shared/src/noise/`, `packages/shared/src/sdf/`, `packages/shared/src/worldgen/`, `packages/tools/`).

---

## 1. The quality bar ("Big Globe class")

1. **Vast.** From a mountain top you see 5–10 km of real terrain: ranges, valleys, lakes, region changes on the horizon. Distant terrain comes from LOD (§13.5), never a fog wall at 200 m.
2. **Vertical.** Peaks to +900 m, cliffs hundreds of metres high, deep gorges, overhangs, floating islands, a chasm that opens into a cavern with its own clouds.
3. **Varied at three scales.** Every region has:
   - **macro** forms, 1–8 km: ranges, basins, plateaus
   - **meso** forms, 40–500 m: hills, towers, thorn clusters, mesas
   - **micro** detail, 1–30 m: hummocks, rubble, ledges, drifts

   Primitive terrain almost always lacks meso and micro detail.
4. **Natural.** Erosion-like valleys and gullies, drainage that makes sense, rock strata, weathering by slope and height. Features look *grown into* the ground.
5. **Distinct.** A screenshot of any region is recognisable at a glance by silhouette, palette and atmosphere.
6. **Readable at 1 m voxels.** No long 1-block sticks, no speckle, no staircase mush where a clean form was intended. **Detail with amplitude under 0.5 m is invisible, and a body narrower than ~1.5 m reads as a stick.** Size things accordingly.
7. **Playable.** You can walk, climb and find routes. Not every slope is a cliff, and flat ground exists where settlements belong.

Not in scope for Milestone 1: NPCs, gameplay hazards (only their *visuals*), multiplayer, structures beyond simple massing.

---

## 2. Failure modes (hard rules)

The rubric (§14) fails any postcard that shows these.

**Primitive spikes, the specific failure last time:**
- straight cones or cylinders
- uniform size or even spacing
- all vertical, or all leaning the same way
- round cross-sections only
- hard intersection with the ground (no flared base, no rubble)
- a single flat material
- no clusters, branches or breaks
- long 1-block sticks at the tips

**General:**
- **Noise soup.** Uniform 3D-noise blobs everywhere, with floating crumbs.
- **Single-scale noise.** Everything equally bumpy.
- **Stamped features.** Shapes pasted on terrain without blending.
- **Grid regularity.** A visible (jittered) lattice of features, clones of the same size.
- **Seams.** Straight or blocky region borders, height cliffs at borders, material lines that follow chunk edges or chunk tops.
- **Floating crumbs.** Disconnected bits, except the deliberate floating features (Sundered Isles; hovering shards near big Hoshikuzu clusters; Hollow Sky ceiling features).
- **Swiss-cheese surface.** Too many cave holes breaking the surface.
- **Flat or black lighting.** No AO or fog depth; underground spaces that are just black.
- **Visible tiling.** The same texture repeating identically over large areas.
- **Impossible fluids.** Water hanging in the air, lakes spilling over rims, 1 m water steps at borders. (Falling water in waterfalls is fine; it's its own block, §9.5.)
- **LOD artifacts.** Visible LOD rings, terraced distant slopes, cracks and holes at LOD seams, flattened peaks, popping.

---

## 3. Frame, determinism and versioning

- Constants come from `02-world.md` §1. Keep them in one module.
- **Pure function of (seed, position).** The block at (x, y, z) must not depend on generation order, which worker ran it, or which LOD was requested first.

**Determinism uses an allowlist**, enforced by a test (see also `07-architecture.md` §4). Deterministic code may use only:
- `+ − * / %`
- `Math.abs, floor, ceil, round, trunc, sign, min, max, sqrt, fround, imul, clz32`, and the Math constants

Nothing else:
- no `**`
- no other `Math` member (`hypot`, `sin`, `pow`, `log2`, … all vary between engines)
- no `Date`, `performance`, `crypto`, `Intl`, `localeCompare` or `toLocale*`

`packages/shared/src/math/det.ts` provides `detPow` (via tested range-reduced exp2/log2 polynomials, relative error ≤ 1e−7 over the documented finite-normal terrain-shaping domain), `detLog`, `detExp` and `detSinCos`, all with tests. The first implementation uses degree-16/19 series rather than claiming an unverified minimax fit; `packages/shared/README.md` records its domains, empirical errors and special-value tests. A Vitest test scans `packages/shared/src` for forbidden tokens and fails the build if it finds any. It scans TypeScript tokens with comments and strings stripped, so a JSDoc `/**` isn't mistaken for `**`.

Coding rules for deterministic code:
- **Randomness:** only from integer hashing, with fixed-arity `hash2(seed, a)` … `hash5(seed, a, b, c, d)` built on `Math.imul` (fixed arity avoids allocating arrays), plus `rand01(h)`.
- **Constants:** at most 17 significant digits.
- **Cells and coordinates:** cell index = `Math.floor(x / n)`; local coordinate = `((a % n) + n) % n`. Never use `x | 0` on floats that may be negative, which is half the world.
- **Caches** hold float64 values. Mixing float32 caches with float64 recomputation makes halos and LODs disagree.
- **Sorting** uses total-order comparators.

**Versioning:**
- Bump `WORLDGEN_VERSION` **at most once per pull request** that changes generated output. Regenerate the golden file (§14.7) with `npm run golden:update` **whenever** generated output changes, so `npm test` stays green on every push, and list the golden updates in the report.
- In dev builds and tools, caches (the WorldPlan in IndexedDB, postcard caches) are keyed by a **content hash of the worldgen source**, injected with Vite `define` or computed by the tools. That way, tuning never serves stale data.
- During Milestone 1 the block registry may still change. Saved M1 edits are wiped when the worldgen or registry hash changes. The registry becomes append-only at Milestone 2.

**Evaluability.** Density, materials and fluids must be computable at any sample spacing, so the same functions produce LOD chunks. Anything that spans chunks (trees, thorns, islands, skeletons) comes from deterministic **feature cells** (§8.1), never from "generate the neighbour first".

---

## 4. Pipeline overview

```
seed ─► WorldPlan (once per seed; ~64 m grids + analytic fields; cached)
          rings · region weights · macro elevation · rivers & lava network · water levels
          funnel footprints · underground Voronoi · descents · Seats · spawn sites

chunk(cx, cy, cz, lod) for LOD0–1, or tile(tx, tz, lod) for LOD2+ (§13.5)
                                  density grid includes a halo: 1 voxel sideways/down, 8 voxels up
  1. Columns    per (x, z): region weights, blended params, Hm (macro+meso), Hμ (micro), ∇Hm, g, water level
  2. Density    d = [Hμ + Hm(x+δx, z+δz) − y]·g  + karst/wall terms + micro  (lattice 4×4×4, world-anchored)
  3. Features   SDF features from overlapping cells, narrow-band evaluated, combined in canonical order;
                writes per-voxel (featureId, t)
  4. Carvers    crust caves, layer caverns (floor/ceiling template), ravines, descents, the Stair
  5. Fluids     water / falling water / lava / liquid mana / ichor, by basin level
  6. Materials  surface rules (3D-gradient slope), strata, ores, variants, feature materials
  7. Decoration trees, plants, small rocks (feature cells; anchors found in the density function)
  8. Light      sky and block light (LOD0 only; §13.3)
  9. Mesh       LOD0–1: greedy voxel mesh with AO · LOD2+: column mesh at density zero crossings (§13.5)
```

Positive density means solid. Generation runs in Web Workers (a pool of `hardwareConcurrency − 1`, max 6) and in Node for tools and tests.

---

## 5. Stage A: the WorldPlan

Built once per seed, in a worker, in ≤ 3 s. Cached (§3), and shared with the other workers: through `SharedArrayBuffer` when available, otherwise copied. It's only a few MB.

### 5.1 Rings and sectors (no trigonometry needed)
1. **Warp the point.** `p' = p + 350 m × warp2(p / 5 km)`, a 2-octave vector noise. All boundary tests use `p'`, so borders wander organically.
2. **Ring distance:** `|p'| − R` for each ring radius (`02-world.md` §1).
3. **Sector tests:** use the dot product of `p'` with 12 precomputed boundary normals (outer boundaries at bearings 22.5° + 45°k; inner at 0°, 90°, 180°, 270°). Only use a normal where `p'` is on that boundary ray's side. This gives signed distances in metres, with no `atan2`.
4. **Directions:** bearing is x = sin, z = −cos, clockwise from north (−z). Precompute normals with `detSinCos` or as exact constants.

### 5.2 Region weights and blending
- Weight per region = `smoothstep(−W/2, +W/2, signed distance)`.
- Keep it continuous: `w' = max(0, w − w₄)` (subtract the 4th-largest), then renormalise the top 3. Hard truncation to the top 3 would create seams.
- Blend width `W` by region pair:
  - default 400 m
  - anything ↔ Kurogane: 600 m
  - land ↔ Blackwater coast: 150 m (a real coastline)
  - outer ring ↔ Rim: 800 m
- Numeric parameters blend by weight. **Feature shapes never blend.** Each feature type's *density* is multiplied by its region's weight, so forests thin out toward a border instead of shrinking into miniatures.
- Materials at borders **dither** (weight vs a 2D noise threshold), so transitions are patchy, not straight.

### 5.3 Macro elevation
- The basin is a shallow **bowl**: the Rim is high, and the land trends down toward the Blackwater by about 40 m over 15 km, so rivers flow inward.
- **How heights combine (one rule, no double counting).** Each region recipe gives a **base** height (the absolute height at its centroid, in §11) and **zero-mean relief** around it. `macroHeight` = the blended region bases + the bowl's inward tilt, applied as a zero-mean slope across each region so the centroid keeps its base height + the WorldPlan-owned shapes below. Regions that sit at water level (the Sallows, the Grey Mere) take no tilt.
- Where the WorldPlan owns the macro shape, region relief is **zero-mean detail on top of it**:
  - Grey Mere: region centre about −120, shelving to its shores.
  - Blackwater: floor −150 to −250, with cliffs on both sides.
  - Nadir: +150 to +250, rising to the crag at +320.
  - Rim: rises to +600 over 20.5–21.5 km.
- **Coarse erosion** (phase 1.2 builds the drainage; phase 1.5 turns erosion on for Kurogane and the Selva, the others follow in 1.7). On a 32–64 m grid, run analytical steady-state stream-power erosion (Tzathas et al. 2024) or a port of StreamPowerErosion (MIT), using the macro elevation as uplift. It outputs an **eroded macro height** and a **drainage area** per cell. This is what gives mountains connected valleys and ridges that per-point noise can't. If it breaks the WorldPlan budget, run it only over rugged regions (Kurogane, the Selva, Shirogane's Rim edge) and cache the result (§3).

### 5.4 Water levels, rivers and the lava network
- **Water levels** come from a priority-flood on a 64 m grid of coarse heights. They're **spill heights**: a basin's level is the height where it would overflow.
- **There is no open sea.** y = 0 is a datum, never a global fill: nothing below 0 fills with water unless a water body puts it there.
- **Not every basin holds water.** A basin fills only if its drainage area × the region's moisture passes a threshold. Kogane's basins stay dry (salt flats); Tasogare's hollows hold shadowglass (a solid); Ibara's hold ash or lava.
  - The Grey Mere and the Blackwater are at 0.
  - The Sallows' level is **0**, with land at +1 to +3.
  - Adjacent water bodies never differ by a 1 m step at a border.
- **Rivers** (phase 1.5 for Kurogane and the Selva; the other regions in 1.7):
  - Derive them from **drainage**: nodes on a jittered grid (offset ±24 m by hash, so rivers don't follow grid lines), **Priority-Flood+FlowDirs** (Barnes et al.) so every node has a downhill direction even across flats and pits, then flow accumulation, then a threshold. Break every tie by (height, index), and accumulate in one fixed order on one thread: floating-point sums depend on order. mapgen4's `assignDownslope` and `assignFlow` (Apache-2.0) are a good starting point.
  - Trace polylines and apply the region-border warp to them.
  - Add **meanders**: lateral offset = (2–4) × width × noise1(arcLength / ((10–14) × width)).
  - Width 4–60 m (∝ √drainage area) and depth 2–10 m come from accumulation. The valley falloff reaches 5–10 × the width, and meanders stay inside the valley.
  - The river level is defined along the centreline, **never rises downstream**, and equals the lake or sea level at the mouth.
  - Rivers that run into dry regions end in a sink, or continue as a **dry wadi** (Kogane) with no water.
  - Region styles: the Selva, wide and muddy with waterfalls at slope breaks; Shirogane, frozen over; Kogane, dry.
- **The lava network** (phase 1.3, local to Ibara): calderas feed channels 4–20 m wide with raised levees. The same jittered-grid routing, with lava levels monotonic downstream.
- **Output:** a spatial hash of segments, so the column stage can query distance, bed height, width, level and kind fast.

### 5.5 Underground layout
- **Footprints:** radius per layer (`02-world.md` §1), warped by ±600 m noise, with a ~500 m **fray** band where cave density falls to zero.
- **Region cells:** seed points from `02-world.md` §3 (bearing, radius), jittered ±1 km by seed, assigned by warped Voronoi (warp amplitude 700 m) with 300 m blend bands. The weight rules in §5.2 apply here too.
- Each underground region supplies its cavern floor `F(x, z)` and ceiling `C(x, z)` (§9.2).

### 5.6 Sites
- **Seats:** one per Warden region (the 30 in `02-world.md` §7; none in the Blackwater or the Rim). The Nadir's Seat is Nadir Keep at (0, 0); the Throne's is the Wellspring bowl. For the others, candidates lie within 40% of the region's *radius* (the distance from its centroid to its nearest border) of the centroid; pick the one that maximises a desolation score. In M1 that score is elevation extremity (hazard intensity joins it in M4). Seats are placed before spawn candidates.
- **Generals' forts:** on each Seat's middle ring (`02-world.md` §7). M1 only marks them on the atlas.
- **Descents:** every descent type in `02-world.md` §4 gets 2–4 deterministic sites in its region that satisfy its constraints, including overlap with the region below. The named descents in bold there are single features with their own rules (the Throats are three, one per Maw region). Keep them ≥ 1.5 km from Seats, **except** the Nadir Stair, the Sundering, the Great Shear and the Throats, which are Seat-adjacent by design.
- **Land bridges:** three natural rock causeways, once paved by the Old Crown, across the Blackwater at bearings ~20°, ~140° and ~255°. Each has 1–3 broken gaps of 20–80 m.
- **Nadir Keep and the Stair** are at (0, 0).
- **Spawn candidates:** buildable spots at r ≥ 16 km and ≥ 3 km from any Seat (gentle slope, dry, water and trees within 300 m; `02-world.md` §8). M1 only shows them on the atlas.

### 5.7 API (sketch)

```ts
interface WorldPlan {
  seed: number;
  version: number;
  surfaceWeights(x: number, z: number, out: RegionWeights): void;   // continuous top-3
  layerWeights(layer: Layer, x: number, z: number, out: RegionWeights): void;
  footprint(layer: Layer, x: number, z: number): number;            // 0..1 incl. fray
  macroHeight(x: number, z: number): number;                        // bowl, basins, plateau, Rim
  waterQuery(x: number, z: number, out: WaterSample): void;          // level, kind, river distance/bed/width
  sites: { seats: Site[]; forts: Site[]; descents: Descent[]; bridges: Bridge[]; spawns: Site[] };
}
```

---

## 6. Stage B: columns

Per (x, z), at the chunk's sample spacing. Results are cached per chunk column in an LRU cache, with a halo wide enough for displacement (≥ 16 m) and gradients (1 column). Schedule every vertical chunk of a column on the same worker so its cache hits.

**Outputs:**
- region weights and blended parameters
- `Hm(x, z)`: macro + meso height: `macroHeight` (§5.3: blended bases, bowl tilt, WorldPlan shapes, coarse erosion) plus Σ wᵢ · Hᵢ, where every `Hᵢ` is zero-mean relief; rivers carved (the valley profile lowers `Hm` toward the bed).
- `Hμ(x, z)`: micro height detail (4–30 m wavelength, ±0.5–2 m amplitude)
- `∇Hm` from central differences
- `g = 1 / sqrt(1 + min(|∇Hm|², 64))`, the distance correction (§7)
- water level and kind; moisture and temperature proxies; feature masks; dominant region

**Height-function toolkit** (`packages/shared/src/noise/`):
- `fbm2`, `ridged2` (weight feedback), `billow2`, `warp2`, `warp3`
- `erosionFbm2`: derivative-damped fBm (Inigo Quilez's "noise with derivatives"). It needs noise with analytic derivatives.
- **`erosionFilter2`**: Rune Skovbo Johansen's erosion filter (MPL-2.0), ported as a separate file in `packages/shared/src/third_party/` with its licence header and `detSinCos` in place of sin/cos. It carves branching gullies and sharp ridges at 16 m–1 km from height plus gradient, fading by slope, and needs no neighbour data. Don't use the older "eroded terrain noise" shaders: their core is non-commercial.
- **`regionSplines`**: per-region monotone splines that map continentalness, erosion and peaks/valleys values to height offset, factor and jaggedness, as Minecraft's terrain shaper does. They are data, so each region can be art-directed in the `?dev` panel.
- `terrace(h, step, sharpness, jitter)`, polynomial `smin` / `smax`, monotone piecewise-cubic `spline`
- `worley2` / `worley3` (F1, F2, F2−F1)

**Masks by target area, not raw thresholds.** Raw noise thresholds are misleading: normalised 5-octave fBm has SD ≈ 0.25, so "> 0.35" covers only ~9%. The noise module exports **measured quantiles** for each noise type (a unit test samples 10⁶ points). Recipes write masks as `smoothstep(q(0.55), q(0.80), v)`, meaning "top 45% of the area, fully on in the top 20%". `atlas --mode features` prints the achieved coverage per mask per region.

**The three-scales rule.** Every `Hᵢ` combines a macro term (1–8 km), a meso term (60–500 m) and the micro term. Features add more meso structure on top.

---

## 7. Stage C: density

```
T(x, y, z) = Hμ(x, z) + Hm(x + δx, z + δz) − y          // height term with horizontal displacement
δ = A(x, z) · warp3(x/λh, y/λv, z/λh)                    // λh ≥ 150 m, λv 16–40 m, A ≤ 0.05·λh
d = T · g  +  K(x, y, z)  +  micro(x, y, z)
```

- **`g` makes `d` approximately a distance in metres** on slopes (`H − y` alone is not: its gradient grows as 1/cos(slope)). Use `|d|`, never `|y − H|`, wherever a distance is meant: the micro band, the cave-breach taper, fillet radii, narrow-band tests.
- **Overhangs, ledges and undercuts come from the horizontal displacement δ** of `Hm`. `A` comes from the region's overhang parameter times a steepness gate. Within these limits the mapping stays invertible, so you get undercuts without floating blobs. Sample `Hm` at displaced positions bilinearly from the column cache.
- **`K`** is additive 3D noise, used **only** for karst walls and cave walls, with amplitude ≤ 0.3 · λv.
- **`micro`** is 3D noise with amplitude 0.6–2 m, applied where `|d| < 8`. It's what gives cliffs their roughness.
- **Lattice.** δ, K and cave noise are evaluated on a **4 × 4 × 4 lattice anchored to world coordinates** (nodes at multiples of 4 m, so every LOD samples the same function) and interpolated trilinearly. An 8-m vertical spacing would under-sample the 16–40 m wavelengths into flat slabs.
- **Halo.** Every density grid includes 1 voxel on the sides and below, and **8 voxels above**. The material rules need to see the surface above the chunk top; otherwise dirt/stone lines follow chunk tops.
- **Thin things at full resolution.** The lattice smooths away detail under ~4 m and creates 45° facets. Evaluate the feature narrow band (§8.3), noodle caves and `micro` per voxel, not on the lattice.
- **Structure fitting.** Under structure massing (the Keep, ruins, the Buried City) add density, and above it remove density, with a falloff, so buildings sit into the ground (Minecraft's "beardifier" idea).
- **Crumb cleanup (LOD0).** After carving, flood-fill solids. Remove components under 64 voxels that **don't touch the chunk's outermost voxel layer**, except where the region allows floating features.

---

## 8. Stage D: features (the SDF system)

Most of the "wow" lives here. Features are **signed distance functions** (SDFs) merged into the density field, so they grow out of the terrain.

### 8.1 Feature cells
- Each type has a cell size `C`: thorn clusters 192 m, crystal clusters 128 m, karst towers 160 m, giant trees 48 m, floating islands 320 m, titan skeletons 1,200 m, trees 12 m, boulders 24 m.
- **Anti-grid rules.**
  - Clustered types draw **0–3 clusters per cell** (Poisson with a mask-scaled mean, capped).
  - Instances are jittered across the whole cell.
  - Groups use local minimum-spacing rules that don't depend on chunk order: hash one candidate per sub-cell, and keep it only if no higher-priority candidate (by hash) lies within the spacing radius in the neighbouring sub-cells.
  - Low-frequency masks make dense and empty zones.
  - **Never** use one instance per cell at a fixed probability: that shows up as a lattice wherever the mask is high.
- **Bounds.** Each instance's AABB includes its shape + fillet radius `k` + displacement amplitude + LOD thickening. Otherwise fillets get cut off along straight lines at chunk borders.
- **Caching.** Keep a per-worker LRU cache of *instantiated* cells (spines, frames, parameters), so neighbouring chunks don't rebuild the same thorn.
- **Canonical order.** Polynomial `smin` is not associative, so combine instances in a fixed order: type priority, then cellZ, cellX, instance index. Otherwise halos, neighbours and LODs disagree.

### 8.2 SDF library (`packages/shared/src/sdf/`)
- **Primitives:** sphere, ellipsoid (approx.), box, round box, capsule, round cone (`sdRoundCone`), cylinder, torus, hex prism, plane.
- **Ops:** union, subtraction, intersection, smooth union and subtraction (`smin` with radius `k`), onion, noise displacement, domain repetition (hex columns).
- **Spines:**
  - Cubic Bézier curves, **arc-length parametrised**, flattened at plan time into a polyline, subdivided adaptively until every joint bends ≤ 12° and the chord error is ≤ 0.5 m (cap 24 segments). Distance is measured to that capsule chain; exact Bézier distance would need cbrt and acos. Uniform 6–10 segments turn a hooked tip into a single kink.
  - Frames are **rotation-minimising, by double reflection** (Wang et al. 2008). It needs only `+ − × ÷ sqrt`.
  - Twist comes from `detSinCos` per sample, with frames nlerp'd within a segment.
- **Polygonal cross-sections:** the maximum over the facet half-planes in the frame plane, with apothem = r. Blend with the circle distance by `facetiness`. No per-voxel `atan2`.
- **Angular noise** (karst fluting, storm scars): sample noise on the unit direction from the centre times a reference radius (plus height), instead of computing an angle.

### 8.3 Combining with terrain, and evaluation
- **Additive feature** with SDF `f` (negative inside): `d = smax(d, −f, k)`. The radius `k` creates the flared base (fillet).
- **Subtractive feature:** `d = smin(d, f, k)`.
- The feature stage writes the **dominant feature ID and its spine parameter `t`** per voxel, for the material stage (tips, per-thorn materials).
- **Narrow-band evaluation (mandatory):**
  1. Evaluate on a 4 m grid first.
  2. Refine per voxel only where `|f| < 4.6 m + k` (3.5 × a 1.3 Lipschitz allowance).
  3. Cull with per-segment bounding capsules.

### 8.4 LOD policy per feature type
Each type declares one policy:
- **landmark:** never culled (colossal thorns and arches, titan skeletons, karst towers, big islands, crystal colossi, the Keep)
- **thicken:** only if `h ≥ 2s`; thicken by at most `min(0.5·s, 0.3·h)` so forests still read from afar
- **drop:** if `h < 2s`

Check sizes *before* building geometry. **Trees** drop their trunks from LOD2. From LOD3 up, trees aren't instanced at all: a canopy height (mask × 8–25 m, leaf material) is added to the column instead.

### 8.5 Ibara thorns (full spec)

This is the feature that failed before. Follow it closely, then tune by eye. Every Ibara postcard needs **R2 = 2** on the rubric.

**Placement**
- `thornMask = smoothstep(q(0.55), q(0.80), fbm2(p / 900 m))` × Ibara weight. That's ~45% of the region with thorns and ~20% dense forest. The rest is ash flats and calderas.
- Clusters: 0–3 per 192 m cell (Poisson, mean `1.2 × mask`).
  - centre anywhere in the cell
  - count `n = round(lerp(6, 40, mask))`
  - radius `R = lerp(15, 22) × √n` m
- **Flow vector `F`** per cluster: away from the nearest lava fissure or caldera (from the lava network), falling back to a hashed direction. Thorns lean with the flow, which gives each field a readable grain.

**Per thorn** (all draws from `hashN(seed, cell, cluster, i, k)`)
- **Base:** inside the cluster disc, with centre spacing ≥ `0.8 × (rᵢ + rⱼ)`. Up to 8 hashed attempts; skip the thorn if all fail.
- **Height:** a truncated power law, `h = 12 · (1 − u · (1 − (12/160)^α))^(−1/α)` with `α = 1.82`, using `detPow`. Most thorns are 12–30 m, some 60–120 m, a few approach 160 m, with no pile-up at the cap.
- **Base radius:** `r₀ = max(1.6 m, h × lerp(0.07, 0.16, u₂))`.
- **Lean direction:** `normalize(F + 0.6 · (b − c)/R + 0.3 · randDir)`. Angle 5–35°, skewed low. 5% outliers at 45–65°.
- **Spine:** a cubic Bézier from `b − 0.12h · up` (the root starts buried) to `b + h · leanDir`.
  - Sideways bend 0–0.35 h.
  - 20% of thorns get an S-curve; 10% get a hooked tip (the last 15% curls).
- **Profile:** `r(t) = r_tip + (r₀ − r_tip) · (1 − t)^p · (1 + kn(t))`, with `r_tip = 0.45 m`. **No tip clipping**: the profile always runs to `r_tip` at full height (the broken thorns below are the only ones cut short).
  - Draw `p` from [0.5, 1.4], then clamp it so the part thinner than 0.7 m is no longer than `max(1.5 m, 4% of the length L)`:
    `p ≤ detLog(0.25 / (r₀ − 0.45)) / detLog(max(1.5, 0.04·L) / L)`.
    A one-voxel point at the very tip reads as a point. A long one-voxel stick does not.
  - **Knuckles** `kn(t)`: only when `r₀ ≥ 4 m`. 2–4 smooth bumps, each of absolute amplitude `max(0.6 m, 0.12 · r)`.
- **Cross-section:** a polygon whose facet count depends on size.
  - `r₀ < 4 m`: 3–4 facets, facetiness ≥ 0.6
  - 4–10 m: 4–6 facets
  - colossi: 5–8 facets
  - Twist 0–120° along the spine. Surface roughness only where `r ≥ 4 m`, amplitude ≥ 0.6 m.
- **Branches:** only on thorns with `h ≥ 40 m`. 35% of those get 1–3 branches from `t ∈ [0.2, 0.6]`, 0.2–0.4 h long, with branch `r₀ ≥ 1.5 m`, angled outward and up.
- **Broken:** 12% are truncated at `t ∈ [0.45, 0.8]` with a jagged cap (a noise-displaced half-space subtraction), plus 1–3 **fallen shards** (`r ≥ 1.2 m`), half-buried nearby.
- **Scree:** shards 4–10 m tall with `r₀ ≥ max(1.2 m, 0.3 · h)`, plus rubble boulders, within 1–2 × `r₀` of big bases.
- **Fillet:** `k = max(2 m, 0.5 · r₀)`. This is what flares the roots.

**Landmarks: colossi and arches**
- About 1 per 2.5 km², so roughly 40 in the region. `h` = 220–350 m, `r₀` = 18–30 m.
- 30% are **arches**: the spine curves back down and re-enters the ground 80–200 m away. It tapers only to `0.35 · r₀` at re-entry and lands on the terrain surface. Some cross or pair.
- Visible from kilometres away (the landmark policy).

**Materials** (from the per-voxel feature ID and `t`)
- Core: obsidian (black, glossy) or basalt (dark grey), per thorn.
- Horizontal strata every 3–7 m in 2–3 tones, warped.
- Tips (t > 0.85):
  - 40% of thorns near lava get **ember crust** (dark red, emissive)
  - otherwise 15% get pale **brimstone crust**
- Bases: ash and scree.

**The ground between**
- **Ash plains** with wind-aligned ash dunes (anisotropic ridged noise, 2–4 m).
- **Cracked basalt plates:** Worley F2−F1 fissures 1.5–3 m wide and 2–10 m deep. Hot fissures have lava floors.
- **Calderas:** 3–6 in the region, 300–900 m across, with 40–120 m rims and lava-lake floors. **Sulphur vents** are 3–10 m cones with a yellow crust and an emissive mouth.
- **Lava channels** from the lava network, with levees and crusted edges.
- **Obsidian flats** where lava meets low ground.

**Checks every Ibara postcard must pass**
- no two neighbouring thorns alike in height, lean and bend
- clusters have visible gaps and density gradients
- at least 3 size classes in any vista
- the silhouettes include curves, hooks, branches and broken tops
- the numeric report (§14.5) shows the parameter spreads and nearest-neighbour dissimilarity required above

**Terrain-report pass bands** (whole region, each of seeds 1–3):
- thorns 12–30 m tall: 75–88% of all thorns (the power law gives ~82%)
- thorns ≥ 60 m: 3–7% (~4.5%)
- lean outliers at 45–65°: 3–7%
- S-curves 17–23%; hooked tips 7–13%; broken 9–15%
- branched: 30–40% of thorns ≥ 40 m
- ≥ 95% of thorns differ from their nearest neighbour by ≥ 20% in height, ≥ 8° in lean or ≥ 0.1 h in bend
- no tip thinner than 0.7 m for longer than `max(1.5 m, 0.04 L)`

### 8.6 Feature catalogue (other regions)

| Feature | Used in | Construction notes |
|---|---|---|
| **Icicles, stalactites, stalagmites** | Frost Hollows, caves, Hollow Sky | The thorn spine generator pointing down or up; rounder and icier. Hollow Sky mega-columns fuse top and bottom pieces with `smin`. |
| **Ice spires** | Shirogane (near the Rim) | Thorn generator: ice, near-vertical, 20–80 m, fewer facets. |
| **Crystal clusters** | Hoshikuzu, Kagami Grottos, Leyflow banks | Hex prisms (3 slab pairs) with pyramidal tips, radiating from a root point with 0–50° spread. Power-law sizes, 2–60 m, colossi 80–150 m. Minimum width 1.5 m. 15% broken. Emissive cores on big ones. |
| **Hovering shards** | Hoshikuzu, near big clusters only | 1.5–4 m shards floating 2–20 m up. Few. The one deliberate floating exception there. |
| **Karst towers** | Selva | Elliptical columns, 15–60 m radius, 60–220 m tall. Base undercut, mid bulge, vertical fluting (angular noise), vegetated ledges every 8–20 m, domed vegetated tops. Grouped, with valleys between. |
| **Giant trees** | Selva | Trunk 3–8 m wide, 40–80 m tall. 4–6 buttress roots (flared slabs ≥ 1.5 m thick). Branch chains; canopy from noisy ellipsoid clusters. Spacing 30–80 m. |
| **Trees** | temperate regions | Species: oak, birch, pine, spruce, willow, root-arch swamp tree, bent storm-pine, dead tree, stone tree. Capsule branches plus leaf blobs, from 12 m cells. |
| **Floating islands** | Sundered Isles, Hollow Sky ceiling | Top: flattened ellipsoid, 20–250 m radius, 10–40 m thick. Underside: tapered, **0.6–1.4 × R deep (≤ 220 m)**, with ridges, dangling roots and skystone stalactites. Tilt 0–15°. **Altitude ≥ (ground or chasm floor below) + underside depth + 40 m.** Rock strands (sagging capsule chains) link some. Pools with waterfalls off an edge (the island owns its fluid). |
| **Titan skeletons** | Boneyard (fossils in the Bone Pits) | Skull (ellipsoid shell with sockets and jaw), vertebra chain, ribcage (curved capsule chains arching to the ground), limb bones. 150–400 m long, 20–40% buried. 6–12 whole plus fragments; colossal rusted blades stuck in the ground. |
| **Mesas, buttes, hoodoos** | Kogane | Mesas from terraced `Hm`; buttes as terraced cylinders; hoodoos as stacked ellipsoids ≥ 2 m wide with a darker caprock. |
| **Basalt columns** | Ember Veins, Ibara edges, Nadir cliffs | Hex-grid domain repetition, per-column height variation, stepped cliffs. |
| **Giant mushrooms** | Sporewood, Sallows edge | Curved stalk (≥ 2 m); squashed-ellipsoid cap with gill ridges and emissive spots. 5–60 m. |
| **Giant roots** | Root Halls | Tapering capsule chains from ceiling to floor and wall to wall, branching, ≥ 2 m thick. |
| **Sea stacks** | Grey Mere | Eroded pillars 20–60 m high near shore cliffs. |
| **Pingos** | Shirogane | Ice-cored domes 10–40 m high and 50–200 m wide, some with a collapsed crater. |
| **Monoliths, stone curtains** | Tasogare | Leaning slabs 10–60 m tall, ≥ 2 m thick; draped sheets hanging from overhangs. |
| **Boulders, scree** | everywhere | Noisy ellipsoids 1.5–12 m; scree fans at cliff bases. |
| **Nadir Keep (massing)** | Nadir | A fortress silhouette of stacked boxes, towers and walls on the crag. Placeholder, but ominous from 5 km. |
| **Old Crown ruins (massing)** | Hearthlands hills, Sallows, Buried City | Broken walls, arches, stairs, heavily decayed. |

**Decoration anchors** (trees, plants, rocks) are found **in the density function**: search downward from the feature's top bound for a solid sample with 2 air above. Never use chunk voxel data. That's what places trees correctly on islands, karst tops and ledges.

---

## 9. Stage E: caves, caverns and carvers

### 9.1 Crust caves (surface down to −48)
- **Cheese** (big voids): lattice 3D noise above a threshold. **Spaghetti** (tunnels): `|n₁| < t ∧ |n₂| < t`, with radius from a third noise. **Noodles**: the same, thinner.
- Per-region scale: Kurogane and the Selva have lots; the Sallows almost none.
- **Breach control.** Cave density tapers to zero where `d < 8–16 m` (use `d`, not height), *except* at cave-mouth sites (one per 300–500 m, from feature cells). You get real mouths, not a pocked surface or pocked cliffs.
- **Ravines:** per 1 km cell (probability by region), a 3–8 segment polyline, 6–20 m wide and 40–120 m deep, carved as a vertically stretched capsule chain.
- **Near fluids:** suppress carvers and overhang displacement within 6 m of any fluid, and under any column with a water level. That's how you prevent leaks.
- **Postcard CAVE-1:** a Kurogane crust cave seen from just inside its mouth: cheese and spaghetti voids, daylight behind, the cave's own dark and ambient light ahead.

### 9.2 The cavern template (layer regions)
Each underground region defines a **floor `F(x, z)`** and a **ceiling `C(x, z)`**. Build them with the same three-scales toolkit and cache them per column, like `Hm`.

```
c = min((y − F) · g_F, (C − y) · g_C)     // g from ∇F and ∇C, as in §6
d = min(d, −(c + wall(x, y, z)))          // air where c > 0; wall = lattice noise for pillars and alcoves
```

- A cavern exists where `C − F > 6 m`.
- **Under surface water**, cavern ceilings stay ≥ 24 m below the water body's bed, except at the Grey Mere trench descents, whose connected caverns are flooded to level 0.
- Pillars appear where the wall term pushes `c` below zero.
- SDF features (mushrooms, roots, crystals, columns) are added on top.

Examples:
- **Hollow Sky:** `C` ≈ −420 with drapes, `F` ≈ −700 rolling.
- **The Throne:** `F` is a bowl sloping to about −1,400 at the centre, with terraces.
- **Sporewood:** very wide, 40–100 m tall.

### 9.3 Layers, shelves and deeprock
- **Shelves** are forced solid (a strong positive bias) except where descents cut through.
- **Deeprock** (outside footprints) has only cracks and small pockets: no aquifers, poor ore.

### 9.4 Descents and big carves
All come from WorldPlan sites (`02-world.md` §4):
- **Cenote:** a noisy vertical cylinder 20–60 m wide, into Layer 1, with water at its floor (the cenote owns that water).
- **Bog-hole:** a wide pit with water, then a narrow flooded shaft.
- **Lava tube:** a long sloping tube 6–15 m in diameter, with a glassy lining.
- **Crevasse:** a tall slot 2–6 m wide.
- **Mine mouth:** a rectangular portal into the Old Workings grid.
- **Geode breach:** a crater opening into a crystal cavern.
- **The Delvers' Road:** a helix ramp 8 m wide (radius ~120 m, pitch ~1:8) from the Old Workings down to the Buried City, with broken sections. It sits where the two regions overlap in top view.
- **The Sundering:** a warped union of large vertical voids and rifts covering ~35% of the Sundered Isles, with sheer, strata-banded walls, ledges and mist.
  - Only the rifts **above the Hollow Sky** break through its ceiling at about −400.
  - The others end in Layer 1 caves or on the shelf.
  - Phase 1.6 carves the surface part down to a misty floor. Phase 1.9 connects it to the Hollow Sky.
- **The Nadir Stair:** a cylinder of radius 96 m from the Keep crag (+320) down to the Throne's rim terrace at about −1,200, where its last gate opens onto the bowl. A ring floor every 64 m, 20 m wide, around a central void. Massing only in M1.
- **The Great Shear:** a vast vertical chasm along a 3–5 km fault. One wall runs ~670 m from the Undercrown's ceiling (−400) to the Maw's floor (−1,072), cutting the shelf, with the Undercrown's caverns opening onto it along ledges.

### 9.5 Fluids (static in M1)
- Fluid kinds: **water**, **falling water** (a non-source block for waterfalls; allowed to hang in columns), **lava**, **liquid mana**, **ichor**.
- **Placement by basin level:**
  - the Grey Mere, the Blackwater and the Sallows: 0 (no open sea: y = 0 is never a global fill)
  - rivers: their centreline level
  - aquifer levels per underground region, in **aquifer cells** (Minecraft style): each cell of a cavern region has its own fluid level, with rock barriers between cells at different levels
  - lava levels per caldera, channel or cavern
- **Features own their fluids:** island pools, oases, cenote floors, caldera lava lakes, the Leyflow channel.
- **Guards:**
  - carvers are suppressed near fluids (§9.1)
  - a cave opening to air below its basin level stays dry
  - never generate a 1 m step between adjacent water bodies
- **By region:**
  - Drowned Caverns: mostly flooded, with air domes under the ceilings
  - Ember Veins: lava lakes
  - Leyflow: liquid mana
  - The Gut: ichor pools

---

## 10. Stage F: materials

### 10.1 Surface rules (top-down per column, using the 8-voxel upward halo)
1. **Surface voxels:** solid, with air or fluid above.
2. **Slope comes from the 3D density gradient**, not from `∇Hm`, so thorns, towers, islands and overhangs get correct rock, snow and moss.
3. Choose the **top block** and **subsoil** (2–6 blocks), then **stone** (strata), by depth below surface, slope, altitude, moisture, temperature and region.
4. Overrides:
   - **Cliffs:** slope > ~50° exposes rock. Overhang undersides are always rock.
   - **Snow:** above the region's snowline, only where slope < 60°.
   - **Beaches:** within ±2 m of a water level: sand, gravel or shingle.
   - **Underwater:** sand, gravel, clay or mud.

### 10.2 Strata
- `band = floor((y + warp(x, z) · A + tilt · (x, z)) / thickness)`, mapped through a per-region palette of 3–5 stones.
- Thickness 2–12 m; tilt up to 1:10.
- Strata show on every cliff face. They are the cheapest source of "natural" detail.

### 10.3 Depth
- Crust stone gives way to darker **deep stone** below −48.
- Deeprock is darker and harder.
- Each underground region has its own stone palette (§12).

### 10.4 Ores
- Vein rules per region and depth: thresholded lattice noise, or blobs from cells.
- **Exposure tells stories:** gold in Kogane canyon walls, silver on Shirogane outcrops, moonsilver glowing faintly on Tasogare cliffs.

### 10.5 Anti-tiling and render types
- Every block has 2–4 texture variants. **Variant and tint are chosen in the shader** from the integer world cell, so they don't break greedy merging.
- Per-vertex micro tint: ±6% value, ±3% hue.
- **Macro tint:** ±12% over 64–512 m, driven by slope, height and moisture. Tune by eye.
- Distant LOD uses per-material average colours with the same tints.
- **Render types:**
  - **opaque**
  - **cutout** (alpha-tested): grass, ferns and reeds as cross quads; vines; leaves
  - **translucent:** water, lake ice, glass
  - an **emissive** flag
  - a **gloss** value with an analytic sky reflection (shadowglass, obsidian, wet rock, ice). This is how black-glass lakes "reflect the wound".
- Glacier and packed ice are **opaque**.
- Check `MAX_ARRAY_TEXTURE_LAYERS` (WebGL2 guarantees only 256).

---

## 11. Surface region recipes

Starting values; tune by eye. Heights are absolute y unless the WorldPlan owns the macro shape (§5.3). Every region lists its postcards (§14.3).

### Test world (phase 1.1 only)
- **TEST-1:** eye level on rolling plains with a pond and a few placeholder trees (a trunk and a leaf blob), golden hour. Used to validate the tools. Self-scored in phase 1.1 (blind reviews start in 1.3): R2 = variety in terrain and trees; R7 = reads as grassland with a pond.
- The test world stays available after 1.1 as `?world=test`, for tools and tests.

### Hearthlands (plains)
- **Macro:** base +40; fBm at 2–4 km, ±25 m. Broad river valleys 6–15 m deep.
- **Meso:** hills (300–600 m, 8–20 m). A few lone rounded hills with rock tors. Chalk bluffs (10–25 m) on river bends.
- **Micro:** hummocks (8–20 m, 0.5–1.5 m).
- **Features:** oak and birch groves, boulders, wildflower grass variants (cutout), Old Crown ruin massing on 2–3 hilltops.
- **Materials:** grass (3 tints), dirt, loam, riverbank clay, chalk, granite fieldstone, limestone strata.
- **Water:** rivers, ponds.
- **Atmosphere:** clear soft-blue sky, light haze, warm sun.
- **Postcards:** PLAINS-1 (golden hour, river valley with a grove and a bluff), PLAINS-2 (aerial at 1 km looking inward, Tasogare's dark sky on the horizon).

### Shirogane (tundra)
- **Macro:** base +60; rolling ±30 m at 3 km. Flat ice-sheet plateaus near the Rim; frozen lakes in hollows.
- **Meso:**
  - pingos
  - crevasse fields on the ice sheets (Worley ridges, 2–6 m wide, 15–60 m deep)
  - ice spires near the Rim
- **Micro:** sastrugi (anisotropic ridged noise, 0.5–1 m); patterned ground (raised Worley cell edges, 0.5 m).
- **Materials:** snow, packed snow, blue ice (opaque), frozen dirt, gravel, gneiss/marble strata, silver veins in exposed rock.
- **Vegetation:** sparse dead shrubs; stunted spruce toward the south edge.
- **Water:** frozen lakes (translucent lake ice over water).
- **Atmosphere:** white-blue sky, low bright sun, pale blowing-snow haze, cold grade.
- **Postcards:** TUNDRA-1 (pingo field, ice spires on the horizon, low sun), TUNDRA-2 (crevasse field close up).

### Kurogane (mountains)
- **Macro:** ridged multifractal ranges with domain warp, oriented every which way (never radial spokes). Peaks +600 to +900; valleys +100 to +200. The WorldPlan's coarse stream-power erosion sets the valley network; `erosionFilter2` adds branching gullies and sharp ridges on steep ground, and `erosionFbm2` the micro relief.
- **Meso:**
  - cirques (ellipsoid subtractions at mid height) with tarns (their own water)
  - knife-edge arêtes
  - glaciers in high valley heads (opaque ice above +450)
  - cliffs with undercuts and ledges (large displacement `A` on steep slopes)
  - scree fans
- **Micro:** cliff roughness (1–3 m); strata ledges every 4–10 m.
- **Materials:**
  - granite, slate, marble strata
  - alpine grass from +200 to +450
  - pines below +350
  - snow above +450 (slope < 55°)
  - scree, glacier ice
  - iron and coal outcrops
- **Features:** pines, boulders, Old Crown mine mouths.
- **Atmosphere:** crisp, high contrast, cool blue shadows.
- **Postcards:** MTN-1 (valley floor looking up a 700 m wall with a glacier and cirque), MTN-2 (summit vista over 5–10 km), MTN-3 (king's view over a massif).

### Kogane (desert)
- **Sub-zones** from low-frequency masks: dune sea (40%), mesa country (40%), salt flats (20%).
- **Macro:** base +80; plateaus.
- **Meso:**
  - mesas and buttes (terraced `Hm`, steps 12–30 m, undercut bases)
  - dry canyons and wadis (10–60 m deep, meandering)
  - dunes (wind-aligned warped ridges, 5–40 m; crescents where sand is thin)
  - hoodoo fields
- **Micro:** sand ripples (0.5 m), gravel pavement, cracked salt crust.
- **Materials:** golden and red sand, sandstone strata (red/orange/cream, 2–6 m bands), grey-brown caprock, salt crust, glass sand, **gold veins visible in canyon walls**.
- **Vegetation:** sparse dry shrubs; a rare oasis (pool plus palms).
- **Atmosphere:** hot pale sky, light warm haze, hard sun.
- **Postcards:** DESERT-1 (mesa country at sunset, long shadows), DESERT-2 (dune sea meeting a salt flat).

### The Boneyard
- **Macro:** base +30; flat to gently rolling (±10 m); a few shallow craters.
- **Meso:** titan skeletons; craters 50–200 m; the Pits (sinkholes 30–80 m wide).
- **Micro:** grass tussocks, bone fragments, ash-white dust patches.
- **Materials:** pale dead grass, grey soil, ash dust, titan bone (weathered and cracked variants), rust, limestone strata.
- **Atmosphere:** overcast, desaturated, low fog in hollows.
- **Postcards:** BONE-1 (standing under a ribcage arch), BONE-2 (aerial of a whole skeleton on the plain).

### The Selva (jungle)
- **Sub-zones:** karst tower fields (35%), gorge country (35%), rolling jungle (30%).
- **Macro:** base +60, very hilly; river gorges 30–80 m deep.
- **Meso:** karst towers, cenotes, waterfalls off tower edges and gorge lips (falling water).
- **Micro:** undergrowth, surface roots, mossy boulders.
- **Vegetation:** giant trees, two jungle tree species, hanging vines on canopy edges and cliffs, ferns.
- **Materials:** rich soil, jungle grass, moss, grey-white limestone, riverbank mud, ironwood logs (dark red-brown).
- **Atmosphere:** humid green-grey haze, soft diffuse light.
- **Postcards:** JUNGLE-1 (karst towers rising from misty valleys at dawn), JUNGLE-2 (under the canopy beside a giant tree), JUNGLE-3 (looking down a cenote).

### The Sallows (swamp)
- **Macro:** water level **0**; land at +1 to +3.
- **Meso:** meandering channels (warped ridged-noise valleys), hummocks and small islands (1–4 m), peat bogs, bog-holes, sunken ruin massing.
- **Micro:** tussocks, mud ripples, reeds (cutout), lily pads.
- **Vegetation:** root-arch swamp trees, hanging moss, reeds, fungi toward the region's Sporewood side.
- **Materials:** mud, peat, murky bog water (tinted), moss, swamp grass, clay, bog-iron nodules.
- **Atmosphere:** thick low fog, dim diffuse light, green-grey grade.
- **Postcards:** SWAMP-1 (fog-bound channel with root-arched trees), SWAMP-2 (aerial of the channel network).

### The Grey Mere (great lake)
- **Macro:** the WorldPlan basin (centre −120, shelving); level 0; shores +5 to +30.
- **Meso:**
  - 20–40 islands (50–800 m, rocky, forested)
  - sea stacks; shore cliffs (20–60 m)
  - shingle and sand beaches; reed shallows (< 2 m deep)
  - a drowned forest of dead trunks
  - underwater trenches (the descents)
- **Micro:** pebble and shingle variation; rocks in the shallows.
- **Materials:** sand, shingle, gravel, clay, granite cliffs, island grass and pine.
- **Atmosphere:** grey-blue overcast, wide horizon, mist over water, cool grade.
- **Postcards:** LAKE-1 (shore cliff, sea stacks, islands fading into haze), LAKE-2 (aerial across the islands).

### Tasogare (twilight)
- **Macro:** base +50; hilly (±30 m at 1.5 km) with sharp ridges.
- **Meso:**
  - leaning monoliths; stone curtains
  - **black-glass lakes**: depressions filled with glossy black shadowglass (a solid)
  - ravines with pale fungal light at the bottom
  - moonsilver veins glowing faintly on cliffs
- **Micro:** moss hummocks, pale grass tufts (cutout), scattered glowcaps.
- **Vegetation:** twisted dead trees, **glowcaps** (emissive, pale cyan-white light), indigo moss.
- **Materials:** indigo moss, dark slate, shadowglass (high gloss), moonsilver ore (emissive), pale bone-grey rock bands.
- **Sky:** permanent dusk, with the sun locked just below the horizon (violet to indigo). A dark **wound** (a dark disc with a faint rim) hangs over the Seat. Violet-blue fog. The look depends on emissives, coloured block light and bloom.
- **Postcards:** TWILIGHT-1 (black-glass lake reflecting the wound, monoliths), TWILIGHT-2 (ravine lit by glowcaps).

### Ibara (hellscape)
- **Macro:** base +40; ash plains and low basalt shields, ±20 m at 2–4 km; calderas as subtractive bowls (§8.5).
- **Water:** none. Lava only (the lava network, caldera lakes).
- **Features and ground:** see §8.5.
- **Atmosphere:** smoky ochre-grey sky, dense warm dark fog at low altitude, dim red-tinted sun, bloom on lava and ember crust.
- **Postcards:** HELL-1 (ground level, thorn forest at dusk with lava fissures), HELL-2 (on a caldera rim looking in), HELL-3 (a colossal thorn arch from 1 km away, in haze), HELL-4 (king's view over a thorn forest).

### Hoshikuzu (shardfields)
- **Macro:** base +70; gentle plains with low ridges (±15 m).
- **Meso:**
  - crystal clusters
  - **storm scars**: star-shaped streaks of fused glass radiating from big clusters (angular noise on unit directions)
  - geode breaches
  - hovering shards
- **Micro:** glassy cracks, shard scatter (≥ 1.5 m).
- **Materials:** dark slate, fused glass (gloss), mana crystal (cyan, emissive), crystal-veined rock.
- **Atmosphere:** dark storm sky with cyan auroral ribbons (sky shader), cool cyan-grey fog.
- **Postcards:** SHARD-1 (a colossal cluster in storm light), SHARD-2 (aerial of the storm-scar patterns).

### The Sundered Isles (isles)
- **Macro:** ground at about +20; **the Sundering** (§9.4) covers ~35% of the region.
- **Meso:** floating islands above the chasm and the ground, rock strands, waterfalls pouring into the chasm mist.
- **Micro:** wind-scoured rock, leaning grass.
- **Materials:** grey-blue stone, skystone (pale blue-white, faint emissive; most visible on island undersides), wind grass, bent storm-pines.
- **Atmosphere:** bright, windy, high contrast; white fog inside the chasm.
- **Postcards:** ISLE-1 (on the chasm lip, islands above the void), ISLE-2 (from an island looking down into the Sundering), ISLE-3 (from the Hollow Sky floor looking up through the Sundering; phase 1.9).

### The Nadir, the Blackwater, the Rim
- **Nadir:**
  - the WorldPlan plateau and crag
  - black cliffs 60–200 m on the Blackwater coast
  - a petrified black forest, old roads (flattened strips from the land bridges to the Keep)
  - basalt-column cliffs, ash drifts, blackened snow
  - the Keep massing
  - Sky: a slowly turning dark vortex over the Keep, dim cold light, heavy desaturation.
- **Blackwater:** a ring-sea with black-sand beaches, dark stone and mist. The three causeways have broken gaps.
- **Rim:** an ice shelf rising into ice cliffs (up to +600) with crevasses. Beyond 21.5 km, **the Frost**: a whiteout wall of dense white fog and blowing snow over flat ice.
- **Postcards:** NADIR-1 (from a land bridge, across the plateau to the Keep), NADIR-2 (king's view over the Keep), RIM-1 (the ice cliffs from the outer ring).

### Cross-region postcards
- **BORDER-1:** a Hearthlands → Tasogare transition, gradual and patchy in terrain, materials and atmosphere.
- **KING-1:** king's view from 3 km altitude over the inner ring and the Blackwater.
- **VISTA-1:** eye level on a high Kurogane ridge at golden hour, looking inward across three regions.

---

## 12. Underground recipes

Every region uses the cavern template (§9.2) inside its layer band and footprint.

### Layer 1 (−48 → −368)
- **Frost Hollows.** Ice caverns: blue-ice walls, icicle forests, frozen underground lakes, faint pale-blue rime ore. Postcard FROST-1.
- **Old Workings.** Natural caverns mixed with an Old Crown **mine grid**:
  - straight tunnels 4–6 m wide and 4–5 m tall, on levels 24–40 m apart, with random turns
  - shafts; galleries of 20–40 m
  - rubble plugs where sections collapsed; timber supports every 4–6 m
  - thick coal seams

  Postcard WORK-1.
- **Kagami Grottos.** Geode caverns: ellipsoid voids 20–150 m across, lined with crystal clusters rooted analytically on the ellipsoid surface. The crystals glow. Postcard CRYST-1.
- **Ember Veins.** Magma caverns: lava lakes and rivers, basalt columns, orange-brown fireclay layers, lava tubes, heat haze. Postcard EMBER-1.
- **Bone Pits.** Fossil strata with titan bones embedded in the rock (exposed where caverns cut them), ossuary tunnels, faint red marrow nodules. Postcard BONEPIT-1.
- **Root Halls.** Tall halls (40–120 m) crossed by giant roots, root-woven walls, amber heartroot resin (faint glow), moss. Postcard ROOT-1.
- **Sporewood.** Huge caverns with giant mushrooms, a white-purple mycelium floor, glowing fungi and purple spore haze. Postcard SPORE-1.
- **Drowned Caverns.** Mostly flooded, with air domes, underwater arches and pearl beds. Linked to the Grey Mere trenches. Postcard DROWN-1.

### Layer 2 (−400 → −720)
- **Sekitei.** Stone trees and statue-like pillars; pale stone with green-veined living-stone patches. Postcard GARDEN-1.
- **Buried City.** A 2–4 km cavern (`C − F` ≈ 200–300 m) holding the ruined city of Undervault, as massing:
  - a street grid; buildings 8–40 m; towers 40–120 m
  - bridges; walls; decay
  - faint mana-lamp emissives

  Postcard CITY-1.
- **Leyflow.** A winding canyon cavern along a spline from near the Kagami Grottos' pipes to the Leyfall. A 20–80 m river of liquid mana (emissive, cyan light), crystal banks, mana falls. Postcard LEY-1.
- **Great Shear.** The chasm wall of §9.4: strata, ledges, cave mouths, swarm-nest clusters, dark lodestone veins. Postcard SHEAR-1.
- **Hollow Sky.** `C` ≈ −420, `F` ≈ −700, 4–6 km across.
  - a cloud layer under the ceiling
  - mega-columns 100–280 m
  - hanging islands under the ceiling
  - light shafts where the Sundering breaks through
  - a moss-and-fungus floor

  Postcards HOLLOW-1 and ISLE-3.

### Layer 3 (−752 → −1,072)
- **The Gut.** Wide tubes (10–30 m) with ribbed walls (rings along the tube axis), dark red-purple flesh, emissive ichor pools, narrowing chokepoints. Postcard GUT-1.
- **Deep Forges.** Artificial halls of 100–300 m (box carves), straight lava channels, forge massing, chains and bridges, black iron. Postcard FORGE-1.
- **Yomi.** A vast cavern floored with grey ash dunes, islands of obsidian and bone, thick grey-green miasma, pale soulglass crystals. Postcard ASH-1.

### The Pit (−1,104 → −1,504)
- **The Throne.** A bowl cavern ~4 km across, its floor falling to about −1,400 at the centre, with terraced rings.
  - At the centre: **the Wellspring**, a ~40 m emissive heart-crystal that lights the bowl through an analytic region light (§13.3), and the throne dais.
  - Three Throat entrances; the Stair's final gate on the rim terrace.

  Postcards THRONE-1 and STAIR-1.

---

## 13. Rendering the terrain (M1)

Engine details are in `07-architecture.md` §6. This is what the terrain needs to look right. The life around it (wind in the plants, cloud shadows, weather, each region's air, night, flame and glow) is `18-look-and-feel.md` §5; postcards leave out its particles and cloud shadows and stop its motion at their fixed time (§11 there).

### 13.1 Material
- Extend **`MeshLambertMaterial` through `onBeforeCompile`**, in one module: vertex unpacking plus texture-array sampling, variant and tint selection, gloss, emissive.
- **Override `customProgramCacheKey`.** By default three.js keys the compiled program by the hook's source text, so materials sharing a hook but capturing different values would share one program.
- This keeps three.js's shadows (the `SunLight` cascades) and fog working unchanged; tone mapping happens in the post-processing `EffectPass` (§13.7). **Don't write a from-scratch `ShaderMaterial`**, or you'll be reimplementing cascaded shadows.
- In r186, `SunLight` ships as an addon that WebGLRenderer supports natively: `import { SunLight } from 'three/addons/lights/SunLight.js'`. If a later three.js moves it into the core, import it from `'three'` instead.

### 13.2 Meshing
- **LOD0–1:** greedy meshing with per-vertex AO (4 levels). Flip the quad diagonal on anisotropic AO. Merge only faces with equal block, AO and light.
- Separate draws for opaque, cutout, translucent and fluid geometry.
- **Skirts** are the boundary faces the mesher culled because the halo neighbour is solid. Emit them as a separate draw: invisible against same-LOD neighbours, they fill cracks at LOD seams.
- **LOD2+** uses column meshing (§13.5).

### 13.3 Light
- **Sky light (LOD0):** seeded from per-column heightmaps (never flood down a 2.5 km column), then BFS over the chunk's 3 × 3 × 3 neighbourhood. Light entering from above:
  - comes from the chunk above if it's generated
  - otherwise is 15 if the chunk is above the column's surface band, else 0
  - unless an analytic **sky-open mask** says the column opens to the sky (the Sundering, cenotes, crevasses)

  Ignore blockers more than 64 m above; direct sun is handled by shadows.
- **Block light:** 3 × 4-bit RGB (so glowcaps light cyan, lava orange, ichor red). BFS from emissives, relit incrementally on edits.
- **LOD chunks:** no BFS. Sky light is 15 on upward faces. Emissives come from a block flag.
- **Underground ambience:**
  - per-region cavern ambient (colour, intensity, height gradient)
  - fog with in-scatter
  - BFS block light for local glow
  - **up to 8 analytic region lights** evaluated in the terrain shader (the Wellspring, big lava lakes, colossal crystals, Sundering light shafts)

  Big caverns must never render as black voids.
- **Sun:**
  - direction light plus hemisphere ambient scaled by sky light, with ACES tone mapping
  - **cascaded shadow maps** from three.js's `SunLight` addon (2 cascades; shadow range ~200–400 m). Only near chunks cast shadows
  - **far shadows** beyond that: a 1024² sun **horizon map** covering 16 km around the camera, built in a worker from LOD column heights. Rebuild it when the sun moves ≥ 0.5° or the camera moves ≥ 1 km.

  Long terrain shadows at golden hour are part of the look.

### 13.4 Atmosphere and sky
- Height-based exponential fog plus distance fog with aerial perspective.
- **Per-region atmosphere** (sky gradient, fog colour and density, sun tint, ambient, grading) blends by the camera's region weights over ~2 s.
- Sky dome with sun disc, horizon glow and night stars. Region overrides: Tasogare dusk and wound, Nadir vortex, Ibara smoke, Hoshikuzu aurora, Frost whiteout.

### 13.5 LOD and far terrain

| Level | Spacing | Default reach | Mesh |
|---|---|---|---|
| LOD0 | 1 m | 192 m (settings 128–384) | greedy voxels + AO, BFS light |
| LOD1 | 2 m | ~512 m | greedy voxels |
| LOD2 | 4 m | ~1 km | column mesh |
| LOD3 | 8 m | ~2 km | column mesh |
| LOD4 | 16 m | ~4 km | column mesh |
| LOD5 | 32 m | ~8 km | column mesh |
| LOD6 | 64 m | ~16 km (king's view at altitude) | column mesh |

- **Structure.** LOD0–1 are 32³ chunks in a 3D grid. LOD2+ are **full-height column tiles in a 2D quadtree**: an LODn tile covers 2 × 2 LODn−1 tiles and stores, per sample column, its vertical runs (bottom, top, block, light), as Distant Horizons does. A tile is drawn only when its children aren't, and a parent stays visible until all of its visible children are meshed. Selection uses screen-space error. Far tiles are packed into `BatchedMesh`; near chunks keep one mesh each because they change often.
- **Edits show at distance.** When LOD0 chunks are edited, rebuild the covering far tiles from the edited data, so a player's fortress stays visible from kilometres away.
- **Sample at voxel centres** (`x + s/2`) at every level, never at min corners.
- **Column meshing (LOD2+), in the style of Distant Horizons:**
  1. For each sample column, find the vertical runs of solid samples.
  2. Place each run's top and bottom face at the **density zero crossing**, linearly interpolated between the bracketing samples. Vertex y carries 4 fractional bits.
  3. Side faces cover the height difference with the neighbouring columns' runs.

  This avoids the contour terraces that blocky coarse voxels produce.
- **Vertical band per LOD column:** `[minH − max(2s, A + 16), maxH + max(2s, A + 8)]`, from a 2D pre-pass. Add feature AABBs, analytic voids (the Sundering, calderas, cenotes) and floating-island bands. Underground, select the current layer's cavern band `[F − 16, C + 16]` instead, because the Buried City and Hollow Sky need kilometre-scale LOD.
- For spacing ≥ 8 m, take `Hm` as the **max of 2 × 2 sub-samples**, so peaks don't shrink or pop.
- Skip crust caves at LOD2+ unless they breach the surface.
- Feature LOD policies are in §8.4.

### 13.6 Draw calls, depth, origin
- **Draw calls:**
  - skip empty meshes
  - only LOD0 (and LOD1 within 300 m) cast into the shadow cascades
  - merge LOD3+ chunks or draw them through `BatchedMesh`
  - free CPU-side vertex arrays after upload
- **Depth precision:**
  - near plane ≥ 0.2 m
  - **default:** render a far pass (LOD2+, near 200 m), clear depth, then the near pass. It works in every browser
  - optional upgrade: reversed-Z with float depth where `EXT_clip_control` exists (most browsers except Firefox)
  - never logarithmic depth (it disables early depth testing)
- **Floating origin.** three.js builds `modelViewMatrix` in float64 on the CPU, so chunk-local vertices don't jitter even 22 km out, provided `gl_Position` uses `modelViewMatrix`. Rebase a render origin every ~1 km for any **world-space** shader math (fog, tint cells, sky reflection).

### 13.7 Fluids, post, time
- **Water:** translucent, depth-tinted, fresnel, animated procedural normals. **Falling water:** a streaked animated texture.
- **Lava** and **liquid mana:** emissive, slowly animated. **Ichor:** dark red, emissive.
- **Post:** pmndrs `postprocessing` (`EffectPass`): bloom with a threshold, ACES, optional FXAA. From phase 1.4, `@takram/three-atmosphere`'s aerial perspective for the 5–16 km haze. Test it with the two-pass depth setup. Generate its lookup textures at runtime (`PrecomputedTexturesGenerator`), never from its default remote URL; set `worldToECEFMatrix` for our flat world; postcard "Ready" waits until generation finishes.
- **Time of day:** a 60-minute cycle (40 min day, 20 min night), a slider, and a fixed-time mode for postcards. Tasogare overrides it.

---

## 14. Tooling and the review loop

Terrain is judged by eye. These tools make looking fast, repeatable and affordable in context.

### 14.1 Atlas (Node, no browser)
`npm run atlas -- --seed 1 --layer surface|upper_deep|undercrown|maw|pit --mode regions|height|features|sites --size 2048`
- Renders a top-down PNG with `pngjs`.
  - **regions:** surface colours from `docs/diagrams/world-layout.svg`; underground colours from a palette in the region data
  - **height:** hypsometric tint + hillshade + water overlay
  - **features:** density heatmaps, **printing the achieved coverage % per mask per region**
  - **sites:** Seats, forts, descents, bridges, spawns
- Output: `out/atlas/seed-<n>/<layer>-<mode>.png`. Target ≤ 30 s at 2048².

### 14.2 Slices (Node)
`npm run slice -- --seed 1 --from -15556,15556 --to 15556,-15556`
- Writes a **16 m/px overview** of the whole line, plus windows of up to 2 km at 1–2 m/px (`--window x,z --len 2000 --px 1`).
- Coloured by material (air black, water blue, lava orange, emissive highlighted). It shows caves, caverns, shelves, the funnel and descents.
- **Required slice:** the SW→NE line through (0, 0) above, compared in spirit with `docs/diagrams/funnel.svg`. In phase 1.2, before caverns exist, the slice shows the surface profile plus footprint and shelf bands tinted from the WorldPlan.

### 14.3 Postcards (headless browser)
`npm run postcards -- --seed 1 [--only HELL-1,HELL-3] [--phase 1.3] [--commit]`

**Definitions.** Each postcard id (§11–§12) has: region, kind (eye-level, aerial, king's view, cave), time of day, a **camera search rule**, and a **checklist** of what must be visible.

**Camera resolution:**
- Score ~50 candidate cameras by casting a 64 × 36 grid of rays through the density function: 2 m steps out to 300 m, height-only beyond that.
- Scoring rules:
  - aerial altitude is measured from the highest terrain in view
  - golden hour: sun azimuth 60–150° off the view axis, elevation 5–20°
  - vistas: horizon 30–45% down from the top of the frame
  - the target feature fills at least 15% of the frame
- Save resolved cameras to `packages/tools/postcards/cameras/seed-<n>.json` (committed).
- **Validate every camera on every run:**
  - the eye isn't inside solid
  - eye-level shots stand on a walkable voxel, with the eye at +1.62 m
  - nothing within 5 m in the central 60% of the view
  - the sky fraction is within range for the shot type

  If validation fails, re-resolve automatically and log it.

**Postcard mode** (the client with `?postcard=<id>&seed=<n>`):
- no render loop and no upload cap
- DPR 1, FOV 70°, animation time frozen
- **Ready** means: the screen-space-error chunk set, computed once from the final camera, is generated, meshed and uploaded. A one-chunk margin is generated (not drawn) for LOD0 lighting. LOD chunks aren't BFS-lit.
- Render twice, then capture **in the page** (`preserveDrawingBuffer` or `canvas.toBlob`). Encode to JPEG in Node.
- **Fail loudly** on `webglcontextlost`, and assert `crossOriginIsolated`.

**Throughput:**
- Run all of a seed's shots in one page (teleport, evict), with a persistent browser profile, so the WorldPlan cache and compiled shaders survive between shots.
- Log plan, gen, light, mesh and render milliseconds per shot. **Budget: ≤ 60 s per shot** in the cloud VM. Generation dominates; rendering is ~4–10 s.

**Files:**
- Iteration renders go to `out/postcards/<id>-s<seed>.jpg` (not committed).
- Keep the best-so-far image per id in `out/postcards/_best/`.
- With `--commit` (phase ends only): seed-1 renders and per-region contact sheets go to `docs/postcards/m1/<id>-s1.jpg` and `docs/postcards/m1/_sheet-<region>.jpg`, JPEG q85, 1280 × 720.
- **Contact sheets:** lay the images out on a plain HTML grid page and screenshot it with the same browser, so no image library is needed.

### 14.4 The rubric
Score each postcard 0–2 on each criterion (20 max).

| # | Criterion | 2 means |
|---|---|---|
| R1 | Scale hierarchy | macro, meso and micro all visible and distinct |
| R2 | Not primitive | variety in size, lean, curvature, cross-section, branching, breakage; no clones |
| R3 | Grounded | fillets, scree and debris; nothing stamped; no crumbs |
| R4 | Distribution | clusters and gaps, density gradients, no visible grid |
| R5 | Silhouette | varied, readable skyline |
| R6 | Materials | strata, weathering, patchy transitions, no visible tiling |
| R7 | Identity | region recognisable at a glance |
| R8 | Light and atmosphere | AO, sun and shadow, fog depth, emissives; caverns not black |
| R9 | Voxel readability | no long 1-block sticks, no speckle, clean forms |
| R10 | Playable | walkable routes exist; see the numeric proxy in §14.5 |

**Passing bars:**
- **The surface bar** applies to every surface postcard, BORDER-1, KING-1, VISTA-1, and the Layer 1 postcards and CAVE-1: seed 1 ≥ 16 with no 0 on R1–R4. Seeds 2 and 3: every postcard ≥ 14 with no 0 on R1–R4. **HELL-*** also needs R2 = 2.
- **The deep bar** (a Milestone 1 default the owner may change) applies to GARDEN-1, CITY-1, LEY-1, SHEAR-1, HOLLOW-1, ISLE-3, GUT-1, FORGE-1, ASH-1, THRONE-1 and STAIR-1: ≥ 14, R7 = 2, no zeros. The full bar applies when those layers become playable (M6–M7).
- **TEST-1:** ≥ 12, self-scored, phase 1.1 only.
- **Timeboxed postcards** (§14.6 step 4) stop blocking their phase when their score of record is at most 2 below the bar with no 0 on R1–R4. The phase is then "done with known issues" in `progress.md`, and phase 1.10 clears them. **HELL-1 and HELL-2 are exempt: they must pass.**

### 14.5 Diagnostics
- **Clay mode** (`?view=clay`): neutral albedo, no textures, strong sun plus AO. Judges form without palette.
- **Feature-ID false colour** (`?view=features`): spots clones and grid regularity.
- **Turntable:** 4 views around a feature.
- **Numeric report** per region (`npm run terrain-report -- --seed 1 --region hellscape`), from Node:
  - coverage % per mask
  - slope histogram (< 30°, 30–50°, > 50°)
  - **walkable share**: the fraction of surface cells where the rise is ≤ 1 block per metre. This is the R10 proxy; target ≥ 35% for the eight outer-ring regions (where kings start), ≥ 15% elsewhere.
  - counts of 1-voxel spires and floating components per 100 chunks
  - thorn (and other feature) parameter histograms and nearest-neighbour similarity
- **Calibration anchor:** `?primitive=1` renders Ibara with straight round cones at even spacing. The blind reviewer must score it ≤ 8, or its review is discarded.
- **References:** if the owner adds images to `docs/references/<region>/`, give them to the blind reviewer as the target look.

### 14.6 How to review (mandatory, and context-safe)
1. Grade from **per-region contact sheets** (≤ 6 tiles). Open a full-size image (or a 2× crop) only for the shot you're fixing. **Open every image you grade** (with your tool's image viewer; `12-sessions.md` §2). Never grade from memory or from code.
2. **Delegate** seed-2 and seed-3 grading and the **blind review** to fresh subagents that have *not* seen the code. They get the rubric, the region recipe and the images, and return scores and critique as text. The **score of record = min(yours, blind)**.
3. **A/B.** Compare each new render with `_best/`. Accept a change only if it's preferred.
4. **Timebox.** After 4 fix-and-re-render cycles on a postcard without a +2 gain, log its best score and critique under Known issues and move on. Phase 1.10 revisits it. A timeboxed postcard within 2 of its bar doesn't block its phase (§14.4); HELL-1 and HELL-2 always must pass.
5. Write scores and one line of critique per postcard in `docs/progress.md`. Put the contact sheets and the 4–6 best postcards in the PR report.

### 14.7 Other checks
- **Golden determinism test** (`npm test`): hashes of ~50 chunks per seed (seeds 1–3), across regions and LODs, in `packages/shared/test/golden/worldgen.json`. Regenerate with `npm run golden:update` whenever generated output changes (so every push is green), and bump `WORLDGEN_VERSION` at most once per PR (§3).
- **Forbidden-token test** for deterministic code (§3).
- **Bench** (`npm run bench:gen`): a fixed set of 50 surface-intersecting chunks per region, plus 20 LOD chunks or tiles per level. Report median and p95.
- **In-game tools. Every build through Milestone 4 ships them, previews included,** because the owner uses them to test:
  - F3 overlay (position, chunk, region weights, LOD stats, queues, FPS, draw calls, triangles, memory)
  - fly (double-tap Space)
  - the region and postcard teleport list
  - time-of-day slider
  - view modes (clay, features)
  - render toggles (fog, shadows, LOD colours, chunk borders, wireframe)

  Their exact controls are in `11-interface-catalogue.md` D12 (F3, and the Tools panel on F4).

  Only the `lil-gui` tuning panel is hidden, behind `?dev`.

---

## 15. Budgets (M1)

| What | Budget |
|---|---|
| WorldPlan build (cold) | ≤ 3 s |
| LOD0 surface chunk generation (Node, 1 thread, bench set) | median ≤ 12 ms, p95 ≤ 40 ms |
| LOD0 feature-dense chunk (thick Ibara forest) | p95 ≤ 60 ms (needs the narrow band, §8.3) |
| LOD tile generation (LOD2–6, one 32 × 32-column tile, with the feature size filter) | median ≤ 20 ms |
| LOD0 lighting | median ≤ 3 ms |
| Meshing an LOD0 chunk | median ≤ 4 ms |
| First view (LOD0 within 96 m + LOD out to 2 km; the rest streams in) | ≤ 6 s cold, ≤ 3 s warm, on a mid-range laptop |
| Tab memory at default settings | ≤ 1.5 GB |
| Draw calls / triangles at default settings | ≤ 1,500 / ≤ 4 M |
| Postcard (cloud VM) | ≤ 60 s per shot |
| Frame rate (the owner checks on their laptop) | 60 fps target, 30 fps floor |

**Budgets are targets for phase 1.10.** Before then, measure them every session with `npm run bench:gen`, report the numbers, and log misses under Known issues; don't stall a phase to hit a number early. If a budget and the quality bar conflict, keep the quality and find the optimisation: caching, early-outs, the narrow band, worker scheduling, WASM for a proven hot loop. Log the trade-off in `progress.md`.

---

## 16. Phase checklist (Milestone 1)

These mirror `08-roadmap.md`, which is the source of truth for scope and "done when". Phases 1.3–1.9 usually take 2–4 sessions each. Every session ends at a green checkpoint.

| Phase | Terrain content | Acceptance |
|---|---|---|
| 1.1 Foundations | engine, tools, determinism, test world | TEST-1 ≥ 12 |
| 1.2 World plan | layout, drainage, first-pass heights and palettes, surface water | the measurable checks in `08-roadmap.md` 1.2 |
| 1.3 Toolkit + Ibara | SDF system, thorns, lava network, lava, emissives, coloured light, bloom | HELL-1, HELL-2 pass |
| 1.4 Far terrain | LOD0–6 (chunk grid + column-tile quadtree), column meshing, far shadows, atmosphere and aerial perspective, king's view | HELL-3, HELL-4, VISTA-1, MTN-2, KING-1 show ≥ 5 km with no LOD artifacts |
| 1.5 Kurogane + Selva | coarse erosion, erosion filter, rivers, falling water, karst towers, giant trees, cenotes | their postcards pass |
| 1.6 Fantasy regions | Sundered Isles (surface part), Hoshikuzu, Tasogare | their postcards pass (except ISLE-3) |
| 1.7 Rest of the surface | the other grounded regions, Nadir, Blackwater, Rim, rivers everywhere | all surface postcards and BORDER-1 pass |
| 1.8 Caves + Layer 1 | crust caves, cavern template, Layer 1 regions, descents, underground light, aquifers | Layer 1 postcards and CAVE-1 pass; the measurable checks in `08-roadmap.md` 1.8 |
| 1.9 The deep | Layers 2–3, the Pit, the Sundering into the Hollow Sky, the Stair | deep postcards pass the deep bar |
| 1.10 Polish + performance | budgets, weakest regions, final runs on seeds 1–3 | owner sign-off |
