import { describe, expect, it } from "vitest";
import { buildDrainage } from "../../src/worldplan/drainage.js";

describe("WorldPlan Priority-Flood/FlowDirs", () => {
  it("finds a nested depression's spill without replacing or flattening its original DEM", () => {
    const input = new Float64Array([
      9, 9, 9, 9, 9, 9, 1, 8, 2, 9, 5, 0, 8, 1, 9, 9, 2, 8, 3, 9, 9, 9, 9, 9, 9,
    ]);
    const before = input.slice();
    const result = buildDrainage(input, 5, 5, 64);
    expect(input).toEqual(before);
    expect(result.routingHeight[12]).toBe(8);
    expect(result.routingHeight[11]).toBe(5);
    expect(result.routingHeight[13]).toBe(8);
    expect(result.receivers[11]).not.toBe(-1);
    expect(result.routingHeight).not.toEqual(input);
  });
  it("has deterministic tie handling, an acyclic receiver graph and exact area conservation", () => {
    const input = new Float64Array(81).fill(5);
    input[40] = -10;
    const progress: number[] = [];
    const first = buildDrainage(input, 9, 9, 64, undefined, (done) =>
      progress.push(done),
    );
    const again = buildDrainage(input, 9, 9, 64);
    expect(first).toEqual(again);
    expect(new Set(first.routingOrder).size).toBe(81);
    const rank = new Int32Array(81);
    first.routingOrder.forEach((cell, index) => {
      rank[cell] = index;
    });
    let drained = 0;
    for (let cell = 0; cell < 81; cell++) {
      const receiver = first.receivers[cell] as number;
      if (receiver === -1) drained += first.drainageArea[cell] as number;
      else expect(rank[receiver]).toBeLessThan(rank[cell] as number);
      expect(first.routingHeight[cell]).toBeGreaterThanOrEqual(
        input[cell] as number,
      );
    }
    expect(drained).toBe(512 * 512);
    expect(progress).toEqual([81, 162]);
  });
  it("uses explicit interior body outlets without declaring every below-zero cell water", () => {
    const terrain = new Float64Array(49).fill(20);
    terrain[24] = -100;
    const result = buildDrainage(terrain, 7, 7, 64, {
      cells: new Uint32Array([24]),
      levels: new Float64Array([0]),
    });
    expect(result.routingHeight[24]).toBe(0);
    expect(result.receivers[24]).toBe(-1);
    expect(terrain[24]).toBe(-100);
    expect(() =>
      buildDrainage(new Float64Array([NaN, 0, 0, 0]), 2, 2, 64),
    ).toThrow();
  });
});
