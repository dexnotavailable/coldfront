import { describe, expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import type { ThornInstance } from "../../../shared/src/features/ibara/types.js";
import type { CameraFirstHit } from "../../src/postcards/geometry.js";
import { createVisibleThornResolver } from "../../src/postcards/hell-visible-instances.js";

// Lookup-only fixtures: no geometry is sampled or generated in this file.
const instance = (id: number, landmark = false) =>
  ({ parameters: { id, cellX: 0, cellZ: 0, landmark } }) as ThornInstance;
const hit = (id: number): CameraFirstHit => ({
  featureId: id,
  x: 0.5,
  y: 20,
  z: 0.5,
  px: 30,
  py: 10,
  distance: 50,
  block: Block.Basalt,
});
describe("bounded visible Ibara instance lookup", () => {
  it("reuses already collected geometry without touching a field cell", () => {
    const thorn = instance(7);
    const fail = () => {
      throw new Error("Unexpected field request");
    };
    const resolve = createVisibleThornResolver(
      { parametersForCell: fail, cell: fail, landmarks: fail },
      new Map([[7, thorn]]),
    );
    expect(resolve([hit(7)])).toMatchObject({
      instances: [thorn],
      receipt: {
        reusedIds: [7],
        parameterCellRequests: 0,
        ownerCellRequests: [],
      },
    });
  });
  it("limits lookup to the same twelve coverage-ordered parents and reuses one owner's geometry", () => {
    const thorns = Array.from({ length: 13 }, (_, i) => instance(i + 1));
    let geometry = 0;
    const resolve = createVisibleThornResolver(
      {
        parametersForCell: (x, z, landmark) =>
          x === 0 && z === 0 && !landmark
            ? thorns.map((t) => t.parameters)
            : [],
        cell: () => {
          geometry++;
          return thorns;
        },
        landmarks: () => [],
      },
      new Map(),
    );
    const checked = resolve(thorns.map((t) => hit(t.parameters.id)));
    expect(checked.receipt.requestedIds).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    expect(checked.instances).toHaveLength(12);
    expect(geometry).toBe(1);
    expect(checked.receipt.ownerCellRequests).toHaveLength(1);
    expect(checked.receipt.ownerCellRequests[0]?.returnedInstances).toBe(13);
    const reused = resolve(thorns.map((t) => hit(t.parameters.id)));
    expect(reused.receipt.parameterCellRequests).toBe(0);
    expect(reused.receipt.ownerCellRequests).toEqual([]);
  });
  it("uses actual landmark ownership and the shared conservative reach without decoding IDs", () => {
    const thorn = instance(987, true);
    let landmarks = 0;
    const resolve = createVisibleThornResolver(
      {
        parametersForCell: (x, z, landmark) =>
          x === 0 && z === 0 && landmark ? [thorn.parameters] : [],
        cell: () => {
          throw new Error("No ordinary geometry owner");
        },
        landmarks: () => {
          landmarks++;
          return [thorn];
        },
      },
      new Map(),
    );
    const checked = resolve([hit(987)]);
    expect(checked.instances).toEqual([thorn]);
    expect(landmarks).toBe(1);
    expect(checked.receipt.parameterCellRequests).toBeLessThanOrEqual(85);
    expect(checked.receipt.ownerCellRequests[0]?.landmark).toBe(true);
  });
  it("keeps truly missing and declared-but-unavailable parents unresolved", () => {
    let geometry = 0;
    const missing = createVisibleThornResolver(
      {
        parametersForCell: () => [],
        cell: () => {
          geometry++;
          return [];
        },
        landmarks: () => {
          geometry++;
          return [];
        },
      },
      new Map(),
    );
    const unknown = missing([hit(999)]);
    expect(unknown.instances).toEqual([]);
    expect(unknown.receipt.missingIds).toEqual([999]);
    expect(unknown.receipt.parameterCellRequests).toBe(85);
    expect(geometry).toBe(0);
    const declared = createVisibleThornResolver(
      {
        parametersForCell: (x, z, landmark) =>
          x === 0 && z === 0 && !landmark ? [instance(999).parameters] : [],
        cell: () => {
          geometry++;
          return [];
        },
        landmarks: () => {
          throw new Error("Declared ordinary owner cannot become a landmark");
        },
      },
      new Map(),
    );
    expect(declared([hit(999)]).receipt.missingIds).toEqual([999]);
    expect(geometry).toBe(1);
  });
});
