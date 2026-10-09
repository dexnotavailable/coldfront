import { detSinCos } from "../math/det.js";
/** Unit facet normals prepared once per shape; radius is the apothem. */
export function polygonNormals(facets: number): Float64Array {
  if (!Number.isInteger(facets) || facets < 3 || facets > 32)
    throw new RangeError("Invalid facet count");
  const normals = new Float64Array(facets * 2),
    trig = new Float64Array(2);
  for (let i = 0; i < facets; i++) {
    detSinCos((i * 2 * Math.PI) / facets, trig);
    normals[i * 2] = Number(trig[1]);
    normals[i * 2 + 1] = Number(trig[0]);
  }
  return normals;
}
/** Maximum of facet half-planes blended with the circle; no angular inverse functions. */
export function polygonSection(
  x: number,
  y: number,
  radius: number,
  normals: Float64Array,
  facetiness: number,
): number {
  let polygon = -Infinity;
  for (let i = 0; i < normals.length; i += 2)
    polygon = Math.max(
      polygon,
      x * Number(normals[i]) + y * Number(normals[i + 1]),
    );
  const circle = Math.sqrt(x * x + y * y);
  return circle + (polygon - circle) * facetiness - radius;
}
