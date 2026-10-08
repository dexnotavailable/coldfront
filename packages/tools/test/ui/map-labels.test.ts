import { describe, expect, it } from "vitest";
import {
  type LabelBox,
  labelsOverlap,
  layoutMapLabels,
} from "../../../client/src/ui/map-labels";
import { fitMap, mapPixel } from "../../../client/src/ui/map-math";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions";
import historical from "../../src/ui-harness/map-anchor-review.json";

function check(
  labels: readonly LabelBox[],
  size: { width: number; height: number },
) {
  const close = { x: size.width - 32, y: 32, width: 32, height: 32 };
  const pin = { x: size.width / 2, y: size.height / 2, width: 12, height: 12 };
  const obstacles = [close, pin],
    result = layoutMapLabels(labels, size, 8, 4, obstacles);
  expect(result.map((x) => x.id).sort()).toEqual(
    labels.map((x) => x.id).sort(),
  );
  for (let i = 0; i < result.length; i++) {
    const a = result[i]!;
    expect(a.x - a.width / 2).toBeGreaterThanOrEqual(8 - 0.01);
    expect(a.y - a.height / 2).toBeGreaterThanOrEqual(8 - 0.01);
    expect(a.x + a.width / 2).toBeLessThanOrEqual(size.width - 8 + 0.01);
    expect(a.y + a.height / 2).toBeLessThanOrEqual(size.height - 8 + 0.01);
    for (const b of [...result.slice(i + 1), ...obstacles])
      expect(labelsOverlap(a, b, 3.9)).toBe(false);
  }
  expect(layoutMapLabels([...labels].reverse(), size, 8, 4, obstacles)).toEqual(
    result,
  );
  return result;
}
describe("measured map-name collision layout", () => {
  it("separates historical real-world anchors across supported scales, zoom and pan without dropping names", () => {
    for (const size of [
      { width: 1280, height: 676 },
      { width: 1920, height: 1036 },
      { width: 1280 / 1.5, height: 720 / 1.5 - 44 },
    ]) {
      const fit = fitMap(
        { minX: -22528, minZ: -22528, maxX: 22528, maxZ: 22528 },
        size,
      );
      for (const zoom of [1, 0.8, 0.5, 0.1])
        for (const pan of [0, -7000, 7000]) {
          const view = {
            ...fit,
            x: pan,
            z: pan,
            metresPerPixel: fit.metresPerPixel * zoom,
          };
          const labels = historical.names.flatMap((anchor) => {
            const at = mapPixel(view, size, anchor.x, anchor.z),
              name = SURFACE_REGIONS.find(
                (region) => region.id === anchor.regionId,
              )!.name;
            return at.x >= 0 &&
              at.x <= size.width &&
              at.y >= 0 &&
              at.y <= size.height
              ? [
                  {
                    id: anchor.regionId,
                    ...at,
                    width: name.length * 8,
                    height: 21,
                  },
                ]
              : [];
          });
          check(labels, size);
        }
    }
  });
  it("retains all sixteen coincident names at the centre and each viewport corner", () => {
    const size = { width: 853, height: 436 };
    for (const [x, y] of [
      [0, 0],
      [853, 0],
      [0, 436],
      [853, 436],
      [426.5, 218],
    ]) {
      const labels = SURFACE_REGIONS.map((region) => ({
        id: region.id,
        x: x!,
        y: y!,
        width: region.name.length * 8,
        height: 21,
      }));
      const before = JSON.stringify(labels);
      check(labels, size);
      expect(JSON.stringify(labels)).toBe(before);
    }
  });
});
