import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditPersistence } from "../../../client/src/game/persistence.js";
import { StorageFixture } from "./storage-fixture.js";

const a = { x: 0, y: 6, z: -3, block: 2 },
  b = { x: 1, y: 6, z: -3, block: 2 };
let storage: StorageFixture;
let persistence: EditPersistence;
beforeEach(async () => {
  storage = new StorageFixture();
  vi.stubGlobal("indexedDB", storage.factory);
  persistence = new EditPersistence("test");
  await persistence.open();
});
afterEach(() => vi.unstubAllGlobals());
async function load(seed = 1) {
  const request = persistence.load(seed);
  await storage.flush();
  return request;
}

describe("retained-edit storage ordering and failure safety", () => {
  it("keeps explicit open-then-save seeding supported when no read has failed", async () => {
    const seeded = persistence.save(1, [a]);
    await storage.flush();
    await seeded;
    expect(storage.records.get("test:1")).toEqual([a]);
    expect(await load()).toEqual([a]);
  });
  it("reads after every previously requested full-snapshot save, not between writes", async () => {
    await load();
    const first = persistence.save(1, [a]),
      second = persistence.save(1, [a, b]);
    const reading = persistence.load(1);
    await storage.flush();
    await Promise.all([first, second]);
    expect(await reading).toEqual([a, b]);
    expect(storage.created.slice(-3)).toEqual([
      "readwrite",
      "readwrite",
      "readonly",
    ]);
  });
  it("a synchronous transaction fault reports blocked without poisoning later saves or close", async () => {
    await load();
    storage.throwWrite = true;
    const failed = persistence.save(1, [a]);
    const failure = await failed.then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeNull();
    expect(persistence.blocked).toBe(true);
    const next = persistence.save(1, [a, b]);
    await storage.flush();
    await next;
    expect(storage.records.get("test:1")).toEqual([a, b]);
    await persistence.close();
    expect(storage.closed).toBe(true);
  });
  it("does not overwrite an existing world after a failed read is presented as empty", async () => {
    storage.records.set("test:1", [a]);
    storage.failRead = true;
    const unread = await load();
    expect(unread).toEqual([]);
    expect(persistence.blocked).toBe(true);
    const quitting = persistence.save(1, unread);
    await storage.flush();
    await quitting;
    expect(storage.records.get("test:1")).toEqual([a]);
  });
  it("reports the current clear result, and recovers after a transient write abort", async () => {
    await load();
    storage.abortWrite = true;
    const failed = persistence.save(1, [a]);
    await storage.flush();
    await failed;
    expect(persistence.blocked).toBe(true);
    const cleared = persistence.clear(1);
    await storage.flush();
    expect(await cleared).toBe(true);
    expect(storage.records.get("test:1")).toEqual([]);
    expect(persistence.blocked).toBe(false);
  });
});
