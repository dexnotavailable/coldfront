/** Avalanche of a 32-bit integer; all multiplication explicitly wraps at 32 bits. */
function avalanche(value: number): number {
  let h = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Fixed-arity hashes. Arguments are integer words, interpreted modulo 2^32. */
export function hash2(seed: number, a: number): number {
  return avalanche(Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ a);
}
export function hash3(seed: number, a: number, b: number): number {
  return avalanche(Math.imul(hash2(seed, a), 0x9e3779b1) ^ b);
}
export function hash4(seed: number, a: number, b: number, c: number): number {
  return avalanche(Math.imul(hash3(seed, a, b), 0x9e3779b1) ^ c);
}
export function hash5(
  seed: number,
  a: number,
  b: number,
  c: number,
  d: number,
): number {
  return avalanche(Math.imul(hash4(seed, a, b, c), 0x9e3779b1) ^ d);
}
/** Uniform word-to-double mapping, including 0 and excluding 1. */
export function rand01(hash: number): number {
  return (hash >>> 0) / 4_294_967_296;
}
