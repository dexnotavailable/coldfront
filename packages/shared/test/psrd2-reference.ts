// Independent, unoptimised scalar transcription of stegu/psrdnoise's GLSL vector equations.
// Copyright (c) 2021 Stefan Gustavson and Ian McEwan. MIT; full licence:
// ../src/noise/LICENSE.psrdnoise. Source src/psrdnoise2.glsl at
// 419175a270862ce7ae692038fafafb42ec0427e9.
// The explicitly changed gradient profile uses native trig here, never the port's
// private table or detSinCos. Only tests use this reference, not shared runtime.
import { hash3 } from "../src/math/hash.js";

export function psrd2Reference(seed: number, x: number, z: number): number[] {
  const uv = [x + z * 0.5, z];
  const i0 = uv.map(Math.floor);
  const f0 = uv.map((value, i) => value - (i0[i] as number));
  const cmp = (f0[0] as number) >= (f0[1] as number) ? 1 : 0;
  const offsets = [
    [0, 0],
    [cmp, 1 - cmp],
    [1, 1],
  ];
  const indices = offsets.map((o) => [
    (i0[0] as number) + (o[0] as number),
    (i0[1] as number) + (o[1] as number),
  ]);
  const vertices = indices.map(([u, v]) => [
    (u as number) - 0.5 * (v as number),
    v as number,
  ]);
  const distances = vertices.map(([vx, vz]) => [
    x - (vx as number),
    z - (vz as number),
  ]);
  const gradients = indices.map(([u, v]) => {
    const angle =
      ((hash3(seed, u as number, v as number) & 255) * 2 * Math.PI) / 256;
    const gx = Math.cos(angle),
      gz = Math.sin(angle);
    const length = Math.hypot(gx, gz);
    return [gx / length, gz / length];
  });
  const w = distances.map(([dx, dz]) =>
    Math.max(0.8 - (dx as number) ** 2 - (dz as number) ** 2, 0),
  );
  const dots = distances.map(
    ([dx, dz], i) =>
      (dx as number) * (gradients[i]?.[0] as number) +
      (dz as number) * (gradients[i]?.[1] as number),
  );
  const value = w.reduce(
    (sum, weight, i) => sum + weight ** 4 * (dots[i] as number),
    0,
  );
  const derivative = [0, 1].map((axis) =>
    w.reduce(
      (sum, weight, i) =>
        sum +
        weight ** 4 * (gradients[i]?.[axis] as number) -
        8 *
          weight ** 3 *
          (dots[i] as number) *
          (distances[i]?.[axis] as number),
      0,
    ),
  );
  return [value, ...derivative].map((value) => value * 10.9);
}
