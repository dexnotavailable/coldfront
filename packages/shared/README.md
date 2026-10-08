# COLDFRONT shared foundation

Phase 1.1 shared kernels. Pure ES2022 TypeScript with no runtime dependencies, DOM/Node APIs, clocks or random generator state. Node 22.12+ is the build/tool contract. Root `npm run build` emits the shared package and playable client; `npm run build:site` targets the owner's `/coldfront/` mount. The coordinate, maths and noise contract below is preserved as meshing, lighting and review tools are added.

Root commands: `npm ci`, `npm test`, `npm run check`, `npm run build`. The Windows development machine routes npm cache to `D:\Dex\Cache\npm` and temporary files to D. Scripts are cross-platform. Vite is installed for the next step; no placeholder dev, browser, atlas, benchmark or UI checks exist. Persisted golden chunk hashes and browser golden tests are roadmap step 4.

## World and chunk consumer contract

Import from `@coldfront/shared` after building it. Source tools may import `src/index.ts` through their TypeScript runner.

```ts
const chunk = generateTestChunk({ seed: 1, cx: 0, cy: 0, cz: 0, spacing: 1 });
const id = chunk.blocks[voxelIndex(x, y, z)];
const haloId = chunk.haloBlocks[haloIndex(x, y, z)];
const density = chunk.density[haloIndex(x, y, z)];
```

- Core: 32³ samples, `Uint16Array blocks`, x fastest, then z, then y: `x + 32*(z + 32*y)`.
- Halo: 34 × 41 × 34 samples, local x/z −1…32 and y −1…39. One sample on sides/below and eight above. `haloIndex = (x+1) + 34*((z+1) + 34*(y+1))`.
- `Uint16Array haloBlocks` includes core and halo. `Float64Array density` uses the same indices. Positive density means solid; zero is a surface treated as air. Water has negative solid density. Tree trunks and crowns contribute solid density.
- Buffers belong to the caller and can be transferred to a worker. The generator does not invent light values: the separate `src/lighting` solver supplies lighting for `src/meshing`.
- `Float64Array columns` has eight interleaved lanes per halo column: macro+meso height, micro height, total height, dx, dz, slope-distance correction, water level, pond elliptical radius squared. Start: `Column.Stride*((x+1)+34*(z+1))`. The exported `Column` object names each offset. Dry water level is `-Infinity`.
- World centre: `(chunkCoordinate*32 + local + 0.5)*spacing`, including halos. Spacing may be any finite positive value within the query domain, including non-powers of two. Geometry and materials depend on that position, never spacing or request order. Near voxel meshing is implemented; the LOD2+ column-tile topology comes in phase 1.4.
- Seeds are 32-bit integer words, signed or unsigned. Negative cell indices use floor division. Exports include `worldToChunk`, `cellIndex`, `localCoordinate`, `sampleCenter`, and bounded LOD0/1 `packChunkKey`/`unpackChunkKey`.
- Canonical continuous bounds are half-open: XZ [−22528,22528), Y [−1536,1024). Voxel queries outside return air. Worldstone lies below −1504 inside the frame. Column/feature query helpers accept finite XZ up to ±1,000,000m for halos; larger queries throw.

Point queries for collision, tools and later LOD:

```ts
const column = createColumnSample();
const voxel = createVoxelSample();
sampleTestColumn(seed, worldX, worldZ, column);
sampleTestVoxel(seed, worldX, worldY, worldZ, voxel, column);
// voxel = { density, block, fluid }; fluid is Block.Air or Block.Water.
```

For hot loops, precompute `collectTestTrees(seed,minX,minZ,maxX,maxZ)` over the complete query AABB, reuse six-lane noise scratch in `sampleTestColumn`, and pass both exact column and tree list into `sampleTestVoxel`. The chunk generator does this: no per-voxel arrays or objects. Optional precomputations must match seed/position and contain **all** overlapping trees. They are caller-owned scratch, not hidden caches.

`testWorldSpawn()` returns feet at `{x:0,y:6,z:0}`, on dry flat ground with room for a 0.6 × 1.8m avatar. The six-metre-radius plateau blends back by radius 16m. Relief wavelengths are 2048m, 180m and 16m. The closed pond is centred at (44,24), radius 23 × 18m, bottom −4m, water level 0, rim +3m. Other below-zero depressions stay dry. These are phase-1.1 test-world choices; Kaldmark's WorldPlan comes later.

Trees are candidates from 40m cells, identified by the cell-coordinate pair. Each has a varied trunk and ellipsoidal leaf blob; spawn, water and steep ground reject candidates. Both sides of a chunk boundary find the same features. `testTreeInCell`/`collectTestTrees` are exported; no neighbour-first generation exists.

`Block` and `BLOCK_REGISTRY` preserve the original IDs: Air 0, Worldstone 1, Stone 2, Dirt 3, Grass 4, Sand 5, Water 6, Log 7, Leaves 8, DeepStone 9. IDs 10–31 extend this set without renumbering; `src/blocks/registry.ts` is the complete list and `src/blocks/textures/recipes.ts` supplies generated recipes. Definitions provide semantic keys/names, render type, solidity, opacity, breakability, light filtering and texture recipe keys. `WORLDGEN_VERSION = 2` adds the main WorldPlan; the original test-world generator remains unchanged.

## Noise and derivatives

Kernel coordinates are finite input-space coordinates with absolute magnitude below 2²⁸. Frequency is explicit. These allocation-free hot kernels rely on valid caller coordinates and correctly sized output buffers.

| API | Float64 output lanes | Use |
|---|---|---|
| `openSimplex2(seed,x,z,out)` | value, dx, dz, dxx, dxz, dzz | Continuous 2D OpenSimplex2 and analytic Hessian |
| `openSimplex3(seed,x,y,z,out)` | value, dx, dy, dz | Pinned fast OpenSimplex2 3D compatibility |
| `openSimplex2S3` / `terrainNoise3` | value, dx, dy, dz | Smooth production 3D, ImproveXZPlanes |
| `psrd2(seed,x,z,out)` | value, dx, dz, dxx, dxz, dzz | Nonperiodic 2D psrdnoise profile with analytic gradient and Hessian |
| `fbm2`, `billow2`, `ridged2`, `erosionFbm2` | value, dx, dz | Normalised scalar operators |
| `warp2` | vx, vz, Jxx, Jxz, Jzx, Jzz | Vector displacement/Jacobian |
| `warp3` | vx, vy, vz, then 3×3 row-major Jacobian | Smooth production displacement/Jacobian |

`createNoise2Sample()` supplies six lanes, `createNoise3Sample()` four. Operators accept validated fractal options and caller scratch to avoid allocation. Defaults: five octaves, frequency 1, lacunarity 2, gain 0.5; warps use two octaves. Warps return **displacement**: use `p + amplitude*warp(p)` and add the identity to its Jacobian when composing.

Lattice/hash rules and gradient tables come from FastNoiseLite revision `785f37a9ad76e283586a379675085f2063ae03f7`; full MIT notices are in the root notices and port headers. Attenuation is recomputed directly per corner, allowing only binary64 algebraic rounding differences in reference comparisons (2e−11 tolerance). The derivative of `a⁴(g·r)` is `a⁴g − 8a³(g·r)r`; the 2D Hessian differentiates it analytically. 3D gradients transform back using the transpose of ImproveXZPlanes. No numerical finite differences occur in implementation.

**Upstream fast-3D limitation:** for seed 1, y=0, swapping x/z between `1−1e−8` and `1+1e−8` changes the pinned upstream value by about 0.000404134. The compatibility export and a regression test preserve this tie-plane discontinuity. OpenSimplex2S passes the strict value/gradient continuity test at those boundaries; `terrainNoise3` and `warp3` select it. Test-world heights use continuous 2D noise.

`erosionFbm2` accumulates amplitude-weighted gradients D and adds `a*n/(1+strength*|D|²)` per octave. Its analytic gradient differentiates the denominator using the kernel Hessian. Billow/ridged absolute-value and clamp cusps use symmetric zero derivatives. Rune's erosion filter, Worley, SDFs, splines and region-specific operators remain future modules.

`psrd2` ports Stefan Gustavson and Ian McEwan's MIT lattice/attenuation kernel at revision `419175a270862ce7ae692038fafafb42ec0427e9`. It retains the stretched simplex geometry, radius squared 0.8, fourth-power attenuation and normalization 10.9. Per the prior-art design, `hash3` selects from 256 deterministic unit directions, replacing upstream modulo-289 rotating gradients; optional tiling and animation parameters are omitted. It is therefore a separate seeded profile, not bit-compatible upstream output. The Hessian is analytic; callers scaling coordinates by frequency f must scale gradients by f and Hessians by f². Inputs require a signed/unsigned 32-bit seed, finite coordinates with magnitude below 2²⁸ and at least six output lanes; extra lanes remain unchanged.

`npm run noise:calibrate:psrd2` measures 1,000,000 points in [−4096,4096)², cycling world seeds 1–3 with sequence seed `0xb7e15162`. `psrd2Quantile(p)` applies only to `psrd2-nonperiodic-hash3-unit256-v1` at frequency one. The independent 100,000-point sequence `0x8aed2a6b`, seeds 17–19, measured 45.321% above q(0.55) and 20.340% above q(0.8). These are empirical coverage checks; sampled extrema are not universal bounds. The port, scalar reference and complete licence are retained in source and the root notices.

## Quantile provenance

`noiseQuantile(profile,p)` returns an empirical inverse CDF with linear interpolation; p∈[0,1]. Threshold q(0.55) covers approximately the top 45%. Tables apply to each named **default profile**, not arbitrary parameter changes. Endpoints are measured extrema, not theoretical bounds.

`npm run noise:calibrate` regenerates `src/noise/quantiles.generated.ts` using the committed sampling utility: **1,000,000 points per each of nine profiles**, uniform hash sequence in [−4096,4096)³, cycling seeds 1,2,3, sequence seed `0x243f6a88`. Numeric sorting and interpolation of rank `p*(N−1)` define the quantiles. The test recomputes all million points, not a proxy. Run Biome after calibration to format its generated source.

A held-out sequence (`0x6a09e667`), seeds 17–19, 100,000 points per profile, measured these top-45%/top-20% coverages on Node 24.18:

| Profile | Top 45% | Top 20% |
|---|---:|---:|
| OpenSimplex2 2D | 44.902% | 19.898% |
| OpenSimplex2 fast 3D | 44.803% | 19.920% |
| OpenSimplex2S smooth 3D | 45.092% | 20.042% |
| fBm2 | 45.033% | 20.057% |
| ridged2 | 44.838% | 19.901% |
| billow2 | 45.033% | 19.969% |
| erosionFbm2 | 45.001% | 19.997% |
| warp2 component | 44.975% | 20.156% |
| warp3 component | 45.109% | 19.938% |

## Deterministic math and verification limits

`detLog2` uses exact binary reduction to [√½,√2] followed by an odd atanh series through degree 19. `detExp2` uses a degree-16 exponential polynomial on [−ln2/2,ln2/2] and exact integer powers of two for scaling. `detPow` composes these; `detLog`/`detExp` change logarithm base. This implementation uses documented range-reduced series, without claiming a fitted minimax polynomial.

The measured power domain is base [2⁻⁶⁴,2⁶⁴], exponent [−16,16], with finite normal results. It covers terrain shaping and bases far smaller than meaningful world-coordinate precision. In 100,000 broad-range samples the maximum relative error was **4.063416270128073e−14** on Node 24.18 and **4.085620730620576e−14** on Node 22.23.3, below 1e−7. The native reference functions can differ across Node versions. Natural-log maximum absolute error was 7.105427357601002e−15; exponential maximum relative error on [−700,700] was 4.929390229335695e−14. These are empirical bounds, not universal correctly-rounded claims. Separate tests cover special values, negative-base integer powers, all exact binary exponents −1074…1023, subnormals and overflow. Relative guarantees exclude subnormal outputs.

`detSinCos(angle,out)` writes [sin,cos] using split-π/2 reduction and degree-17/16 polynomials, for finite |angle|≤2²⁰ radians. Larger/nonfinite inputs throw. The maximum absolute error across 50,000 samples plus axis/tie values was **3.3306690738754696e−16**.

The TypeScript AST guard scans every shared source. It rejects exponentiation, forbidden Math members, Math-object aliasing/destructuring, dynamic/global indirection, clocks, randomness, DOM/Node globals, locale APIs, external imports and nonnumeric computed member access. Comments and ordinary strings are not executable tokens. Hostile fixtures cover aliases, computed members, quoted binding keys and assignment destructuring. Reflection descriptors are forbidden, and forbidden API member names are also reserved as ordinary object-literal keys; shared data must use other field names. Shared strict compilation uses only ES2022 libraries and no ambient Node/DOM types.

Tests cover independent upstream values; analytic derivatives vs finite differences; production continuity and the fast-kernel exception; exact repeat/request-order output; changed seeds; all-axis negative-coordinate halo seams; equal points at different spacings; bounded water; origin clearance; tree seams; coordinates and frame boundaries. This package makes no screenshot, render, benchmark, client UI or gameplay acceptance claim.
