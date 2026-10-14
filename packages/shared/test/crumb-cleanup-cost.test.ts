import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, Block } from "../src/blocks/registry.js";
import { createIbaraSample } from "../src/features/ibara/types.js";
import { createCrumbCleanup } from "../src/worldgen/main/crumb-cleanup.js";
import {
  type MainIbaraSampler,
  sampleMainVoxel,
} from "../src/worldgen/main/features.js";
import { MainColumn } from "../src/worldgen/main/surface.js";
import { createLavaSample } from "../src/worldplan/lava.js";

const haloSweep = (removed: (x: number, y: number, z: number) => boolean) => {
  for (let z = -1; z <= 32; z++)
    for (let x = -1; x <= 32; x++)
      for (let y = -1; y <= 39; y++)
        if (removed(x, y, z))
          throw new Error(`Full solid halo removed at ${x},${y},${z}`);
};

describe("answer-preserving crumb cost shortcuts", () => {
  it("answers every direct boundary face before raw/proof/exemption callbacks or owner allocation", () => {
    const forbidden = () => {
      throw new Error("Boundary must not sample");
    };
    for (const rawSolidAt of [() => false, () => true, forbidden]) {
      const cleanup = createCrumbCleanup({
        rawSolidAt,
        allowsFloating: forbidden,
        provenSolidBelow: forbidden,
      });
      for (const offset of [-64, -32, 0, 32])
        for (let axis = 0; axis < 3; axis++)
          for (const face of [0, 31]) {
            const p: [number, number, number] = [
              offset + 7,
              offset + 9,
              offset + 11,
            ];
            p[axis] = offset + face;
            expect(cleanup.removed(...p)).toBe(false);
          }
      expect(cleanup.statistics()).toMatchObject({
        ownerChunks: 0,
        flagBufferBytes: 0,
        searches: 0,
        rawQueries: 0,
      });
      expect(() => cleanup.removed(0, 0.5, 0)).toThrow("safe integers");
    }
  });
  it("still tests solidity at a boundary reached from an interior component", () => {
    for (const offset of [-32, 0])
      for (const boundarySolid of [false, true]) {
        const cleanup = createCrumbCleanup({
          rawSolidAt: (x, y, z) =>
            y === 5 &&
            z === 5 &&
            (x === offset + 1 || (boundarySolid && x === offset)),
          allowsFloating: () => false,
        });
        expect(cleanup.removed(offset, 5, 5)).toBe(false);
        expect(cleanup.removed(offset + 1, 5, 5)).toBe(!boundarySolid);
        expect(cleanup.statistics().rawQueries).toBeGreaterThan(0);
      }
  });
  it("does not promote an existing owner when only its boundary is requested", () => {
    let raw = 0;
    const cleanup = createCrumbCleanup(
      {
        rawSolidAt: () => {
          raw++;
          return false;
        },
        allowsFloating: () => false,
      },
      2,
    );
    cleanup.removed(5, 5, 5); // oldest owner A
    cleanup.removed(37, 5, 5); // owner B
    cleanup.removed(0, 5, 5); // boundary A must not become most-recent
    cleanup.removed(69, 5, 5); // owner C evicts A
    const before = raw;
    cleanup.removed(37, 5, 5);
    expect(raw).toBe(before); // B survived
    cleanup.removed(5, 5, 5);
    expect(raw).toBe(before + 1); // A really was evicted
  });
  it("keeps useful interior flags through complete boundary-heavy halo sweeps without a larger cache", () => {
    let raw = 0;
    const cleanup = createCrumbCleanup({
      rawSolidAt: () => {
        raw++;
        return true;
      },
      allowsFloating: () => false,
    });
    haloSweep(cleanup.removed);
    const cold = cleanup.statistics();
    expect(cold.ownerChunks).toBe(2);
    expect(cold.ownerChunkLimit).toBe(16);
    expect(cold.flagBufferBytes).toBe(2 * 32768);
    expect(raw).toBeGreaterThan(0);
    haloSweep(cleanup.removed);
    expect(cleanup.statistics()).toEqual(cold);
    expect(raw).toBe(cold.rawQueries);
  });
  it("retains a proven all-solid halo without any raw/exemption callback, including its warm pass", () => {
    let proofs = 0;
    const cleanup = createCrumbCleanup({
      rawSolidAt: () => {
        throw new Error("Proven solid must skip geometry");
      },
      allowsFloating: () => {
        throw new Error("Proven solid needs no exemption");
      },
      provenSolidBelow: () => {
        proofs++;
        return 100;
      },
    });
    haloSweep(cleanup.removed);
    expect(cleanup.statistics()).toMatchObject({
      ownerChunks: 2,
      searches: 33300,
      rawQueries: 0,
      maxSearchDiscoveries: 1,
    });
    expect(proofs).toBe(33300);
    haloSweep(cleanup.removed);
    expect(proofs).toBe(33300);
    expect(cleanup.statistics().rawQueries).toBe(0);
  });
  it("uses raw geometry for false/absent proofs and a centre exactly equal to its bound", () => {
    for (const proof of [undefined, () => -Infinity]) {
      let raw = 0;
      const cleanup = createCrumbCleanup({
        rawSolidAt: (x, y, z) => {
          raw++;
          return x === 5 && y === 5 && z === 5;
        },
        allowsFloating: () => false,
        ...(proof ? { provenSolidBelow: proof } : {}),
      });
      expect(cleanup.removed(5, 5, 5)).toBe(true);
      expect(raw).toBe(7);
    }
    const visited: number[] = [];
    const exact = createCrumbCleanup({
      rawSolidAt: (_x, y) => {
        visited.push(y);
        return y <= 5;
      },
      provenSolidBelow: () => 5.5,
      allowsFloating: () => false,
    });
    expect(exact.removed(5, 5, 5)).toBe(false);
    expect(visited[0]).toBe(5);
    expect(visited).not.toContain(4); // lower neighbour is proven, not resampled
  });
  it.each([63, 64])(
    "keeps the %i threshold unchanged above a valid lower proof",
    (count) => {
      const cells = new Set<string>();
      for (let z = 0; z < 4; z++)
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++)
            if (cells.size < count) cells.add(`${x + 5},${y + 5},${z + 5}`);
      const cleanup = createCrumbCleanup({
        rawSolidAt: (x, y, z) => y < 0 || cells.has(`${x},${y},${z}`),
        provenSolidBelow: () => 0,
        allowsFloating: () => false,
      });
      for (const p of cells)
        expect(
          cleanup.removed(
            ...(p.split(",").map(Number) as [number, number, number]),
          ),
        ).toBe(count < 64);
      expect(cleanup.statistics().maxSearchDiscoveries).toBe(count);
    },
  );
  it("clears unfinished flags if the proof provider throws during discovery", () => {
    let fail = true;
    const cleanup = createCrumbCleanup({
      rawSolidAt: (x, y, z) => y === 5 && z === 5 && (x === 5 || x === 6),
      provenSolidBelow: (x) => {
        if (x === 6 && fail) throw new Error("proof unavailable");
        return -Infinity;
      },
      allowsFloating: () => false,
    });
    expect(() => cleanup.removed(5, 5, 5)).toThrow("proof unavailable");
    fail = false;
    expect(cleanup.removed(6, 5, 5)).toBe(true);
    expect(cleanup.removed(5, 5, 5)).toBe(true);
  });
  it.each(["ordinary", "bridge", "volcanic"] as const)(
    "matches raw %s column solidity down to a negative owner's bottom without cleanup geometry calls",
    (kind) => {
      const height = -12;
      const column = new Float64Array(MainColumn.Stride);
      column[MainColumn.Height] = height;
      column[MainColumn.NaturalHeight] = kind === "bridge" ? -40 : height;
      column[MainColumn.DistanceScale] = 0.25;
      column[MainColumn.WaterLevel] = -Infinity;
      column[MainColumn.BridgeMargin] = kind === "bridge" ? 2 : -Infinity;
      column[MainColumn.BridgeTop] = kind === "bridge" ? height : -Infinity;
      column[MainColumn.PaletteRegion] = 9;
      const ibara =
        kind === "volcanic"
          ? ({
              spacing: 1,
              groundSample: { density: 0, surfaceY: height, tag: "basalt" },
              featureSample: createIbaraSample(),
              lavaSample: createLavaSample(),
              sampleGround: (
                _x: number,
                y: number,
                _z: number,
                _column: Float64Array,
                out: { density: number; surfaceY: number; tag: string },
              ) =>
                Object.assign(out, {
                  density: (height - y) * 0.25,
                  surfaceY: height,
                  tag: "basalt",
                }),
              batch: { instances: [], density: (terrain: number) => terrain },
            } as unknown as MainIbaraSampler)
          : undefined;
      // Independently evaluate the real composition/material function before
      // asserting that the same valid bound lets cleanup skip its callback.
      for (let y = -32; y < height; y++) {
        const raw = sampleMainVoxel(
          -16.5,
          y + 0.5,
          -16.5,
          { density: 0, block: Block.Air, fluid: 0 },
          column,
          [],
          ibara,
        );
        expect(raw.density).toBeGreaterThan(0);
        expect(BLOCK_REGISTRY[raw.block]?.solid).toBe(true);
      }
      const cleanup = createCrumbCleanup({
        rawSolidAt: () => {
          throw new Error("Unneeded raw geometry");
        },
        provenSolidBelow: () => height,
        allowsFloating: () => false,
      });
      expect(cleanup.removed(-17, -13, -17)).toBe(false);
      expect(cleanup.statistics().rawQueries).toBe(0);
    },
  );
});
