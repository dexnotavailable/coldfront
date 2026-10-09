/**
 * Typed-array port of voxelize/voxelize floodLight/removeLightsBatch and
 * retainLiveFillNodes, b5097e45acba0b5e4c457eb7c4294a6797b2b485.
 * MIT, copyright (c) 2022 Shaoru Ian Huang. Full licence: LICENSE.voxelize.
 * Kept: downward level-15 sunlight, removal frontier, live refill filtering.
 * Adapted: bounded x/z/y array volumes, four nibbles, no world objects/timers.
 */
export interface LightVolume {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly opacity: Uint8Array;
  readonly light: Uint16Array;
  readonly sources: Uint16Array;
}
export function createLightVolume(
  width: number,
  height: number,
  depth: number,
): LightVolume {
  const n = width * height * depth;
  return {
    width,
    height,
    depth,
    opacity: new Uint8Array(n),
    light: new Uint16Array(n),
    sources: new Uint16Array(n),
  };
}
export function lightIndex(
  v: LightVolume,
  x: number,
  y: number,
  z: number,
): number {
  return x + v.width * (z + v.depth * y);
}
export function channel(word: number, shift: number): number {
  return (word >>> shift) & 15;
}
/** Static source RGB only; skylight occupies the independent high nibble. */
export function emissionLight(rgb: readonly [number, number, number]): number {
  return (rgb[0] << 8) | (rgb[1] << 4) | rgb[2];
}
function write(v: LightVolume, i: number, shift: number, value: number): void {
  v.light[i] = ((v.light[i] as number) & ~(15 << shift)) | (value << shift);
}
function neighbours(v: LightVolume, i: number, out: Int32Array): void {
  const x = i % v.width,
    yz = Math.floor(i / v.width),
    z = yz % v.depth,
    y = Math.floor(yz / v.depth);
  out[0] = x + 1 < v.width ? i + 1 : -1;
  out[1] = x > 0 ? i - 1 : -1;
  out[2] = z + 1 < v.depth ? i + v.width : -1;
  out[3] = z > 0 ? i - v.width : -1;
  out[4] = y + 1 < v.height ? i + v.width * v.depth : -1;
  out[5] = y > 0 ? i - v.width * v.depth : -1;
}
export function floodLight(
  v: LightVolume,
  seeds: readonly number[],
  shift: number,
): void {
  const queue = Array.from(seeds);
  const adjacent = new Int32Array(6);
  for (let head = 0; head < queue.length; head++) {
    const i = Number(queue[head]),
      level = channel(v.light[i] as number, shift);
    if (!level) continue;
    neighbours(v, i, adjacent);
    for (let d = 0; d < 6; d++) {
      const j = Number(adjacent[d]);
      if (j < 0 || (v.opacity[j] as number) >= 15) continue;
      const loss =
        shift === 12 && d === 5 && level === 15
          ? (v.opacity[j] as number)
          : Math.max(1, v.opacity[j] as number);
      const next = level - loss;
      if (next > channel(v.light[j] as number, shift)) {
        write(v, j, shift, next);
        queue.push(j);
      }
    }
  }
}
/** Never resurrect a refill node whose light was deleted later in the BFS. */
export function retainLiveFillNodes(
  v: LightVolume,
  fill: readonly number[],
  shift: number,
): number[] {
  const live: number[] = [],
    seen = new Set<number>();
  for (const i of fill)
    if (!seen.has(i) && channel(v.light[i] as number, shift) > 0) {
      seen.add(i);
      live.push(i);
    }
  return live;
}
export function removeLightsBatch(
  v: LightVolume,
  cells: readonly number[],
  shift: number,
): void {
  const queue: number[] = [],
    levels: number[] = [],
    fill: number[] = [],
    emitters = new Set<number>();
  const adjacent = new Int32Array(6);
  for (const i of cells) {
    const level = channel(v.light[i] as number, shift);
    if (level) {
      queue.push(i);
      levels.push(level);
      write(v, i, shift, 0);
    }
    if (channel(v.sources[i] as number, shift)) emitters.add(i);
  }
  for (let head = 0; head < queue.length; head++) {
    const i = Number(queue[head]),
      level = levels[head] as number;
    neighbours(v, i, adjacent);
    for (let d = 0; d < 6; d++) {
      const j = Number(adjacent[d]);
      if (j < 0) continue;
      if (channel(v.sources[j] as number, shift)) emitters.add(j);
      const nl = channel(v.light[j] as number, shift);
      if (!nl) continue;
      if (
        nl < level ||
        (shift === 12 && d === 5 && level === 15 && nl === 15)
      ) {
        queue.push(j);
        levels.push(nl);
        write(v, j, shift, 0);
      } else if (shift === 12 && d === 5 ? nl > level : nl >= level)
        fill.push(j);
    }
  }
  const live = retainLiveFillNodes(v, fill, shift);
  for (const i of emitters) {
    write(v, i, shift, channel(v.sources[i] as number, shift));
    live.push(i);
  }
  floodLight(v, live, shift);
}
export function solveLight(v: LightVolume): void {
  v.light.set(v.sources);
  for (const shift of [0, 4, 8, 12]) {
    const seeds: number[] = [];
    for (let i = 0; i < v.light.length; i++)
      if (channel(v.sources[i] as number, shift)) seeds.push(i);
    floodLight(v, seeds, shift);
  }
}
/** Call after changing opacity/sources. Reuses the existing field and frontiers. */
export function relightEdits(v: LightVolume, cells: readonly number[]): void {
  const adjacent = new Int32Array(6);
  for (const shift of [0, 4, 8, 12]) {
    removeLightsBatch(v, cells, shift);
    const fill: number[] = [];
    for (const i of cells) {
      const source = channel(v.sources[i] as number, shift);
      if (source) {
        write(v, i, shift, source);
        fill.push(i);
      }
      neighbours(v, i, adjacent);
      for (const j of adjacent)
        if (j >= 0 && channel(v.light[j] as number, shift)) fill.push(j);
    }
    floodLight(v, fill, shift);
  }
}
