import { describe, expect, it } from "vitest";
import {
  clonePlanBuffers,
  planBytes,
  planChecksum,
} from "../../../client/src/engine/plan-transport.js";

describe("immutable plan buffer distribution", () => {
  it("copies exact typed values without detaching the owner or aliasing worker copies", () => {
    const data = {
      grid: { width: 3 },
      values: new Float64Array([1, -0, 3.125]),
      indices: new Uint32Array([2, 0, 1]),
      bridges: [{ centreline: new Float64Array([4, 5]) }],
    };
    const a = clonePlanBuffers(data, false),
      b = clonePlanBuffers(data, false);
    a.values[0] = 9;
    expect(data.values[0]).toBe(1);
    expect(b.values[0]).toBe(1);
    expect(Object.is(b.values[1], -0)).toBe(true);
    expect(data.values.byteLength).toBe(24);
    expect(Object.isFrozen(a.grid)).toBe(true);
    expect(Object.isFrozen(a.bridges)).toBe(true);
    expect(planBytes(data)).toBe(52);
  });
  it("shares only the published SAB buffers across delivery clones", () => {
    const original = { values: new Float64Array([1, 2]) },
      published = clonePlanBuffers(original, true),
      received = structuredClone(published);
    expect(published.values.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(received.values.buffer).toBeInstanceOf(SharedArrayBuffer);
    received.values[0] = 3;
    expect(published.values[0]).toBe(3);
    expect(original.values[0]).toBe(1);
  });
  it("fingerprints payload bytes, type and metadata and detects mutation", async () => {
    const data = { seed: 1, values: new Float64Array([0, -0, 2]) },
      copy = clonePlanBuffers(data, false);
    expect(await planChecksum(copy)).toBe(await planChecksum(data));
    copy.values[1] = 0;
    expect(await planChecksum(copy)).not.toBe(await planChecksum(data));
    expect(await planChecksum({ ...data, seed: 2 })).not.toBe(
      await planChecksum(data),
    );
  });
  it("rejects executable values instead of transporting a sampler closure", () => {
    expect(() => clonePlanBuffers({ query: () => 1 }, false)).toThrow(
      /data only/,
    );
  });
});
