/** Polynomial operators, independently derived; negative values are solid. */
export function union(a: number, b: number): number {
  return Math.min(a, b);
}
export function intersection(a: number, b: number): number {
  return Math.max(a, b);
}
export function subtraction(body: number, cut: number): number {
  return Math.max(body, -cut);
}
export function smoothUnion(a: number, b: number, k: number): number {
  if (!(k > 0)) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smoothIntersection(a: number, b: number, k: number): number {
  return -smoothUnion(-a, -b, k);
}
export function smoothSubtraction(
  body: number,
  cut: number,
  k: number,
): number {
  return -smoothUnion(-body, cut, k);
}
export function onion(distance: number, thickness: number): number {
  return Math.abs(distance) - thickness;
}
export function noiseDisplacement(
  distance: number,
  value: number,
  amplitude: number,
): number {
  return distance + value * amplitude;
}
export function repeatCoordinate(value: number, period: number): number {
  if (!(period > 0)) throw new RangeError("Repetition period must be positive");
  return value - period * Math.floor(value / period + 0.5);
}
/** Nearest hexagonal lattice cell, returned as local X/Z and integer column/row. */
export function repeatHex(
  x: number,
  z: number,
  radius: number,
  out: Float64Array,
): Float64Array {
  if (!(radius > 0) || out.length < 4)
    throw new RangeError("Invalid hex workspace");
  const width = Math.sqrt(3) * radius;
  const row = Math.floor(z / (1.5 * radius) + 0.5);
  let best = Infinity;
  for (let rz = row - 1; rz <= row + 1; rz++) {
    const column = Math.floor(x / width - 0.5 * rz + 0.5);
    for (let cx = column - 1; cx <= column + 1; cx++) {
      const dx = x - width * (cx + 0.5 * rz);
      const dz = z - 1.5 * radius * rz;
      const d = dx * dx + dz * dz;
      if (d < best) {
        best = d;
        out[0] = dx;
        out[1] = dz;
        out[2] = cx;
        out[3] = rz;
      }
    }
  }
  return out;
}
