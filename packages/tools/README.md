# Terrain review tools · phase 1.1

Atlas
npm run atlas -- --seed 1 --layer surface --mode height
Default: test world; 2048 x 2048 data pixels; X/Z bounds [-256,256) metres; 0.25 m per pixel in both axes; north (-z) at top.
The ground-height colour ramp is fixed at [-8,32] m for comparable seed views. Analytic-gradient hillshade uses relief 4 by default; this changes shading, not sampled heights or horizontal scale. Water is drawn only where the generator supplies a finite basin level above the ground.
Flags: --world test; --layer surface; --mode height; --size N or WxH; --center x,z plus --span metres, or --bounds minX,minZ,maxX,maxZ; --height-range min,max; --relief 0..64; --out path.png.
Non-square bounds require matching pixel dimensions so X/Z metres per pixel remain equal. Unknown flags, unsupported worlds/layers/modes and invalid or out-of-world bounds fail clearly.
Default raw image: out/atlas/seed-1/surface-height.png. Companion: surface-height-review.png. Each has a JSON receipt.

Slice
npm run slice -- --seed 1 --from -15556,15556 --to 15556,-15556
Default overview: the exact requested SW-to-NE line; 16 m per pixel; full world height [-1536,1024) m. Its measured length is 43999.012352551734 m, producing 2750 x 160 data pixels. The last column is 15.012352551733784 m wide; its sample stays at the centre of that clipped extent.
Default window: midpoint (0,0), 2000 m along the same bearing; 1 m per pixel; y [-64,48) m, producing 2000 x 112 pixels. --px 2 is also supported.
Flags: --window x,z (repeatable); --len up to 2000 m; --px 1|2; --y-min/--y-max for window height; --out directory. A requested window centre is exact: it defines a parallel transect with the overview's bearing. It is not silently projected onto the overview.
Pond example:
npm run slice -- --seed 1 --from=-256,24 --to=256,24 --window=44,24 --len 512 --px 1 --y-min=-64 --y-max=48 --out out/slices/seed-1/pond
That raw window is 512 x 112 pixels, from XZ (-212,24) to (300,24), and crosses the pond centre. The 32 x 160 overview remains physically narrow at 16 m per pixel; the window is the useful local view.
Default outputs: out/slices/seed-1/{overview,window-1}.png, companion *-review.png and individual JSON receipts.

Review images copy every raw data pixel 1:1 into a labelled margin frame. Coordinate ticks, metre units, sampling scale and colour/material legends are visible. Receipts record the plot rectangle, exact source bounds, sample convention, material counts, density range, basin-water share, PNG hash, source hashes and stage timings. No WorldPlan regions, layer footprints, caves or fictitious terrain are drawn in phase 1.1.

The sampling adapters live in `src/terrain-review`, with atlas/slice CLI modules and corresponding tests. They read the shared pointwise generator without changing runtime state.
