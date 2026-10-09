import { describe, expect, it } from "vitest";
import { createCrumbCleanup } from "../src/worldgen/main/crumb-cleanup.js";

type Cell = readonly [number, number, number];
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const box = (
  width: number,
  height: number,
  depth: number,
  offset: Cell = [5, 5, 5],
): Cell[] => {
  const cells: Cell[] = [];
  for (let z = 0; z < depth; z++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        cells.push([offset[0] + x, offset[1] + y, offset[2] + z]);
  return cells;
};
function fixture(
  cells: readonly Cell[],
  exempt: readonly Cell[] = [],
  capacity = 16,
) {
  const solids = new Set(cells.map((p) => key(...p)));
  const exceptions = new Set(exempt.map((p) => key(...p)));
  return createCrumbCleanup(
    {
      rawSolidAt: (x, y, z) => solids.has(key(x, y, z)),
      allowsFloating: (x, y, z) => exceptions.has(key(x, y, z)),
    },
    capacity,
  );
}

describe("canonical LOD0 crumb classifier", () => {
  it.each([1, 63, 64])(
    "classifies exactly %i six-connected voxels",
    (count) => {
      const cells =
        count === 1 ? box(1, 1, 1) : count === 63 ? box(3, 3, 7) : box(4, 4, 4);
      const cleanup = fixture(cells);
      for (const p of cells) expect(cleanup.removed(...p)).toBe(count < 64);
      expect(cleanup.statistics().maxSearchDiscoveries).toBe(count);
      expect(cleanup.statistics().rawQueries).toBeLessThanOrEqual(
        1 + 6 * count,
      );
    },
  );
  it("does not connect diagonal or edge-only contacts", () => {
    const cells: Cell[] = [
      [10, 10, 10],
      [11, 11, 11],
      [10, 11, 12],
    ];
    const cleanup = fixture(cells);
    for (const p of cells) expect(cleanup.removed(...p)).toBe(true);
    expect(cleanup.statistics().maxSearchDiscoveries).toBe(1);
  });
  it("retains every owner face, with floor ownership at negative coordinates", () => {
    for (const offset of [0, -32, -64]) {
      for (let axis = 0; axis < 3; axis++)
        for (const face of [0, 31]) {
          const a: [number, number, number] = [
            offset + 10,
            offset + 10,
            offset + 10,
          ];
          a[axis] = offset + face;
          const b: [number, number, number] = [...a];
          b[axis] = Number(b[axis]) + (face === 0 ? 1 : -1);
          const cleanup = fixture([a, b]);
          expect(cleanup.removed(...b)).toBe(false);
          expect(cleanup.removed(...a)).toBe(false);
        }
      expect(
        fixture([[offset + 1, offset + 1, offset + 1]]).removed(
          offset + 1,
          offset + 1,
          offset + 1,
        ),
      ).toBe(true);
    }
  });
  it("keeps a connected component when any member is exempt, but no neighbouring component", () => {
    const cells = box(3, 3, 7);
    const exempt = cells.at(-1) as Cell;
    const cleanup = fixture([...cells, [15, 15, 15]], [exempt]);
    for (const p of cells) expect(cleanup.removed(...p)).toBe(false);
    expect(cleanup.removed(15, 15, 15)).toBe(true);
  });
  it("has identical cold, warm, reverse and evicted answers with fixed byte limits", () => {
    const small = box(3, 3, 7),
      large = box(4, 4, 4, [40, 5, 5]);
    const boundary: Cell[] = [
      [64, 10, 10],
      [65, 10, 10],
    ];
    const cells = [...small, ...large, ...boundary];
    const fresh = fixture(cells),
      evicted = fixture(cells, [], 1);
    const expected = cells.map((p) => fresh.removed(...p));
    for (const order of [cells, [...cells].reverse(), cells])
      for (const p of order) {
        evicted.removed(200, 10, 10); // Force a different owner between every query.
        expect(evicted.removed(...p)).toBe(expected[cells.indexOf(p)]);
      }
    expect(evicted.statistics()).toMatchObject({
      ownerChunks: 1,
      ownerChunkLimit: 1,
      flagBufferBytes: 32768,
      searchBufferBytes: 128,
    });
    const capped = fixture([]);
    for (let n = 0; n < 40; n++) capped.removed(n * 32 + 5, 5, 5);
    expect(capped.statistics()).toMatchObject({
      ownerChunks: 16,
      flagBufferBytes: 524288,
      searchBufferBytes: 128,
    });
  });
  it("bounds searches in a huge solid volume and accepts only a proven lower-bound shortcut", () => {
    const full = createCrumbCleanup({
      rawSolidAt: () => true,
      allowsFloating: () => false,
    });
    expect(full.removed(16, 16, 16)).toBe(false);
    expect(full.statistics().maxSearchDiscoveries).toBe(64);
    expect(full.statistics().rawQueries).toBe(64);
    const lower = createCrumbCleanup({
      rawSolidAt: (_x, y) => y < 16,
      provenSolidBelow: () => 16,
      allowsFloating: () => false,
    });
    expect(lower.removed(16, 15, 16)).toBe(false);
    expect(lower.statistics().maxSearchDiscoveries).toBe(1);
    expect(lower.removed(16, 16, 16)).toBe(false); // Air is never removed.
  });
  it("does not cache an unfinished search as removal and validates limits/addresses", () => {
    let fail = true;
    const cleanup = createCrumbCleanup({
      rawSolidAt: (x, y, z) => {
        if (fail && x === 6) throw new Error("raw probe failed");
        return y === 5 && z === 5 && (x === 5 || x === 6);
      },
      allowsFloating: () => false,
    });
    expect(() => cleanup.removed(5, 5, 5)).toThrow("raw probe failed");
    fail = false;
    expect(cleanup.removed(5, 5, 5)).toBe(true);
    expect(cleanup.removed(6, 5, 5)).toBe(true);
    for (const limit of [0, -1, 1.5, NaN])
      expect(() => fixture([], [], limit)).toThrow();
    for (const n of [0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(() => cleanup.removed(n, 0, 0)).toThrow();
  });
});
