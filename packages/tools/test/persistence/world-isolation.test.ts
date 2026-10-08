import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditPersistence } from "../../../client/src/game/persistence.js";
import { worldKey } from "../../../client/src/game/world-save.js";
import type { WorldIdentity } from "../../../shared/src/world/types.js";
import { StorageFixture } from "./storage-fixture.js";

const test: WorldIdentity = { kind: "test", seed: 1, generation: "g1" },
  main: WorldIdentity = { ...test, kind: "main" };
const edit = { x: 0, y: 6, z: 0, block: 2 };
let storage: StorageFixture, persistence: EditPersistence;
beforeEach(async () => {
  storage = new StorageFixture();
  vi.stubGlobal("indexedDB", storage.factory);
  persistence = new EditPersistence("g1");
  await persistence.open();
});
afterEach(() => vi.unstubAllGlobals());
async function done<T>(promise: Promise<T>): Promise<T> {
  await storage.flush();
  return promise;
}
describe("complete world save identity", () => {
  it("same-seed worlds isolate edits, poses and discoveries; clearing retains exploration", async () => {
    await done(persistence.loadWorld(main));
    await done(persistence.loadWorld(test));
    const a = persistence.save(main, [edit]),
      b = persistence.save(test, [{ ...edit, block: 3 }]),
      c = persistence.savePose(main, {
        x: 2,
        y: 6,
        z: 3,
        yaw: 1,
        flying: false,
      }),
      d = persistence.discover(main, "plains");
    await storage.flush();
    await Promise.all([a, b, c, d]);
    expect((await done(persistence.loadWorld(main))).edits[0]?.block).toBe(2);
    expect((await done(persistence.loadWorld(test))).edits[0]?.block).toBe(3);
    await done(persistence.clear(main));
    const cleared = await done(persistence.loadWorld(main));
    expect(cleared.edits).toEqual([]);
    expect(cleared.discoveries).toEqual(["plains"]);
    expect(cleared.pose?.x).toBe(2);
    expect((await done(persistence.loadWorld(test))).edits[0]?.block).toBe(3);
  });
  it("legacy data can only hydrate the matching test generation", async () => {
    storage.records.set("g1:1", [edit]);
    expect((await done(persistence.loadWorld(test))).edits).toEqual([edit]);
    expect((await done(persistence.loadWorld(main))).edits).toEqual([]);
    expect(
      (await done(persistence.loadWorld({ ...test, generation: "g2" }))).edits,
    ).toEqual([]);
  });
  it("a failed main read cannot wipe main, and does not poison a valid test save", async () => {
    await done(persistence.save(main, [edit]));
    await done(persistence.save(test, [edit]));
    storage.failRead = true;
    await done(persistence.loadWorld(main));
    expect(await done(persistence.clear(main))).toBe(false);
    expect(await done(persistence.save(test, [{ ...edit, block: 4 }]))).toBe(
      true,
    );
    expect(
      (storage.records.get(worldKey(main)) as { edits: unknown[] }).edits,
    ).toEqual([edit]);
  });
  it("test discoveries are never recorded and queued edits snapshot their data", async () => {
    await done(persistence.loadWorld(test));
    const mutable = { ...edit };
    const save = persistence.save(test, [mutable]);
    mutable.block = 4;
    await storage.flush();
    await save;
    await done(persistence.discover(test, "plains"));
    const result = await done(persistence.loadWorld(test));
    expect(result.edits[0]?.block).toBe(2);
    expect(result.discoveries).toEqual([]);
  });
});
