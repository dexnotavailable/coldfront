import { describe, expect, it } from "vitest";
import {
  type FarSelectionNode,
  type FarSelectionPlan,
  farSkirtMask,
  farTileBounds,
  nearColumnCoversFar,
  planFarTerrain,
  selectFarCoverage,
} from "../../client/src/engine/far-terrain-selection.js";
import { packFarTileKey } from "../src/worldgen/far/coordinates.js";
import type { FarTileAddress } from "../src/worldgen/far/types.js";

function node(
  address: FarTileAddress,
  children: FarSelectionNode[] = [],
): FarSelectionNode {
  return {
    address,
    key: packFarTileKey(address),
    bounds: farTileBounds(address),
    distance: 1000,
    errorPixels: 3,
    children,
  };
}
describe("far terrain selection", () => {
  it("uses negative tile coordinates without key collisions or min-corner truncation", () => {
    const keys = new Set<number>();
    for (const lod of [2, 3, 4, 5, 6] as const)
      for (const tx of [-1, 0, 1])
        for (const tz of [-1, 0, 1]) keys.add(packFarTileKey({ tx, tz, lod }));
    expect(keys.size).toBe(45);
    expect(farTileBounds({ tx: -1, tz: -1, lod: 2 })).toMatchObject({
      minX: -128,
      maxX: 0,
      minZ: -128,
      maxZ: 0,
    });
    const plan = planFarTerrain(
      { x: -1, y: 100, z: -1, reach: 32, fovYRadians: 1, pixelHeight: 720 },
      { layer: "surface" },
    );
    expect(
      plan.leaves.some(
        (leaf) => leaf.address.tx === -1 && leaf.address.tz === -1,
      ),
    ).toBe(true);
    expect(() => packFarTileKey({ tx: -177, tz: 0, lod: 2 })).toThrow();
  });
  it("changes detail with projected error, and respects real frustum planes", () => {
    const view = {
      x: 100,
      y: 4000,
      z: 100,
      reach: 5000,
      fovYRadians: 1.2,
      pixelHeight: 360,
      planes: [{ x: 1, y: 0, z: 0, constant: 0 }],
    };
    const low = planFarTerrain(view, { layer: "surface" });
    const high = planFarTerrain(
      { ...view, pixelHeight: 1440 },
      { layer: "surface" },
    );
    expect(high.leaves.length).toBeGreaterThan(low.leaves.length);
    expect(high.leaves.every((leaf) => leaf.bounds.maxX >= 0)).toBe(true);
    expect(high.requests[0]?.address.lod).toBe(6);
    expect(new Set(high.requests.map((tile) => tile.key)).size).toBe(
      high.requests.length,
    );
  });
  it("balances requested leaves even when neighboring geometric error estimates differ", () => {
    const plan = planFarTerrain(
      { x: 0, y: 100, z: 0, reach: 300, fovYRadians: 1, pixelHeight: 720 },
      {
        layer: "surface",
        errorMetres: (address) => (address.tx < 0 ? 64 : 0),
      },
    );
    const cut = selectFarCoverage(plan, () => true);
    expect(cut.balanced).toBe(true);
    expect(cut.atTarget).toBe(true);
    expect(cut.tiles).toHaveLength(plan.leaves.length);
  });
  it("keeps a parent until all visible children are prepared, including empty children", () => {
    const children = [
      node({ tx: 0, tz: 0, lod: 2 }),
      node({ tx: 1, tz: 0, lod: 2 }),
      node({ tx: 0, tz: 1, lod: 2 }),
      node({ tx: 1, tz: 1, lod: 2 }),
    ];
    const parent = node({ tx: 0, tz: 0, lod: 3 }, children);
    const plan: FarSelectionPlan = {
      layer: "surface",
      roots: [parent],
      requests: [parent, ...children],
      leaves: children,
      refined: new Set([parent.key]),
    };
    const ready = new Set([
      parent.key,
      ...children.slice(0, 3).map((child) => child.key),
    ]);
    expect(
      selectFarCoverage(plan, (tile) => ready.has(tile.key)).tiles,
    ).toEqual([parent]);
    // Empty geometry is represented by the same prepared state as any other child.
    ready.add(children[3]?.key ?? -1);
    const selected = selectFarCoverage(plan, (tile) => ready.has(tile.key));
    expect(selected.tiles).toEqual(children);
    expect(selected.atTarget).toBe(true);
    ready.delete(children[0]?.key ?? -1);
    expect(
      selectFarCoverage(plan, (tile) => ready.has(tile.key)).tiles,
    ).toEqual([parent]);
  });
  it("draws skirts at mixed or missing neighbors and hides same-level shared sides", () => {
    const left = node({ tx: -1, tz: 0, lod: 2 });
    const right = node({ tx: 0, tz: 0, lod: 2 });
    expect(farSkirtMask(left, [left, right]) & 2).toBe(0);
    expect(farSkirtMask(right, [left, right]) & 1).toBe(0);
    expect(farSkirtMask(left, [left, node({ tx: 0, tz: 0, lod: 3 })])).toBe(15);
  });
  it("coarsens a prepared fine branch when its neighbor is still several levels coarser", () => {
    const fine = node({ tx: -1, tz: 0, lod: 2 });
    const ancestor = node({ tx: -1, tz: 0, lod: 3 }, [fine]);
    const coarse = node({ tx: 0, tz: 0, lod: 4 });
    const plan: FarSelectionPlan = {
      layer: "surface",
      roots: [ancestor, coarse],
      requests: [coarse, ancestor, fine],
      leaves: [fine, coarse],
      refined: new Set([ancestor.key]),
    };
    const cut = selectFarCoverage(plan, () => true);
    expect(cut.balanced).toBe(true);
    expect(cut.tiles.map((tile) => tile.key).sort()).toEqual(
      [ancestor.key, coarse.key].sort(),
    );
    expect(cut.atTarget).toBe(false);
    const missing = selectFarCoverage(
      plan,
      (tile) => tile.key !== ancestor.key,
    );
    expect(missing.balanced).toBe(false);
  });
  it("does not hide distant ground beneath a high camera when near terrain is clipped", () => {
    const footprint = farTileBounds({ tx: 0, tz: 0, lod: 2 });
    expect(
      nearColumnCoversFar(32, 32, [
        { ...footprint, ready: true, drawn: false },
      ]),
    ).toBe(false);
    expect(
      nearColumnCoversFar(32, 32, [
        { ...footprint, ready: false, drawn: true },
      ]),
    ).toBe(false);
    expect(
      nearColumnCoversFar(32, 32, [{ ...footprint, ready: true, drawn: true }]),
    ).toBe(true);
    expect(
      nearColumnCoversFar(128, 32, [
        { ...footprint, ready: true, drawn: true },
      ]),
    ).toBe(false);
  });
});
