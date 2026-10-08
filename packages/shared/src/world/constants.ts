/** Canonical frame: docs/02-world.md section 1. Bounds are half-open in metres. */
export const BLOCK_SIZE = 1;
export const CHUNK_SIZE = 32;
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;
export const WORLD_MIN_XZ = -22_528;
export const WORLD_MAX_XZ = 22_528;
export const WORLD_MIN_Y = -1_536;
export const WORLD_MAX_Y = 1_024;
export const SEA_LEVEL = 0;
export const WORLDSTONE_CEILING = -1_504;
export const PLAYABLE_RADIUS = 21_500;
export const RING_RADII = Object.freeze({
  nadir: 5_000,
  blackwater: 6_200,
  inner: 12_900,
  outer: 20_500,
  rim: PLAYABLE_RADIUS,
});
export const DEPTH_BANDS = Object.freeze({
  upper_deep: Object.freeze({
    bottom: -368,
    top: -48,
    innerRadius: 6_500,
    outerRadius: 16_500,
  }),
  undercrown: Object.freeze({
    bottom: -720,
    top: -400,
    innerRadius: 3_500,
    outerRadius: 11_500,
  }),
  maw: Object.freeze({
    bottom: -1_072,
    top: -752,
    innerRadius: 2_000,
    outerRadius: 7_000,
  }),
  pit: Object.freeze({
    bottom: -1_504,
    top: -1_104,
    innerRadius: 0,
    outerRadius: 2_200,
  }),
});
export const HALO_SIDE = 1;
export const HALO_BELOW = 1;
export const HALO_ABOVE = 8;
export const HALO_WIDTH = CHUNK_SIZE + 2 * HALO_SIDE;
export const HALO_HEIGHT = CHUNK_SIZE + HALO_BELOW + HALO_ABOVE;
export const HALO_VOLUME = HALO_WIDTH * HALO_WIDTH * HALO_HEIGHT;
