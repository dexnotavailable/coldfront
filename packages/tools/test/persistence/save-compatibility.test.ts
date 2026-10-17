import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditPersistence } from "../../../client/src/game/persistence.js";
import {
  type ApprovedSaveMigration,
  previousSaveIdentity,
} from "../../../client/src/game/save-compatibility.js";
import {
  emptyWorldSave,
  type WorldSave,
  worldKey,
} from "../../../client/src/game/world-save.js";
import type { WorldIdentity } from "../../../shared/src/world/types.js";
import { StorageFixture } from "./storage-fixture.js";

const from = `4:${"a".repeat(64)}`,
  to = `4:${"b".repeat(64)}`,
  unknown = `4:${"c".repeat(64)}`;
const migration: ApprovedSaveMigration = {
  fromGeneration: from,
  toGeneration: to,
};
const main: WorldIdentity = { kind: "main", seed: 1, generation: to },
  test: WorldIdentity = { ...main, kind: "test" };
const edit = { x: 0, y: 6, z: 0, block: 2 },
  pose = { x: 4, y: 9, z: 5, yaw: 0.75, flying: true };
function previous(identity: WorldIdentity): WorldIdentity {
  return { ...identity, generation: from };
}
function record(identity: WorldIdentity): WorldSave {
  return {
    ...emptyWorldSave(identity),
    edits: [edit, { ...edit, x: 1, block: 3 }],
    pose,
    discoveries: identity.kind === "main" ? ["plains", "hellscape"] : [],
  };
}
let storage: StorageFixture, persistence: EditPersistence;
beforeEach(async () => {
  storage = new StorageFixture();
  vi.stubGlobal("indexedDB", storage.factory);
  persistence = new EditPersistence(to, migration);
  await persistence.open();
});
afterEach(() => vi.unstubAllGlobals());
async function done<T>(promise: Promise<T>): Promise<T> {
  await storage.flush();
  return promise;
}
function seed(identity = main): WorldSave {
  const source = record(previous(identity));
  storage.records.set(worldKey(source.identity), structuredClone(source));
  return source;
}
async function peer(): Promise<EditPersistence> {
  const other = new EditPersistence(to, migration);
  await other.open();
  return other;
}

describe("one explicit save-compatibility pair", () => {
  it("keeps kind and seed and requires both the constructor and target generation", () => {
    expect(previousSaveIdentity(main, to, migration)).toEqual(previous(main));
    expect(previousSaveIdentity(test, to, migration)).toEqual(previous(test));
    expect(previousSaveIdentity(main, unknown, migration)).toBeNull();
    expect(
      previousSaveIdentity({ ...main, generation: unknown }, to, migration),
    ).toBeNull();
    expect(
      previousSaveIdentity({ ...main, generation: from }, to, migration),
    ).toBeNull();
    expect(previousSaveIdentity(main, to, undefined)).toBeNull();
    for (const generation of [
      from,
      unknown,
      `5:${"b".repeat(64)}`,
      `${to}:primitive-v1`,
    ])
      expect(
        previousSaveIdentity({ ...main, generation }, generation, migration),
      ).toBeNull();
    expect(previousSaveIdentity({ ...main, seed: 2 }, to, migration)).toEqual({
      ...previous(main),
      seed: 2,
    });
  });
  it.each([
    { ...migration, fromGeneration: to },
    { ...migration, fromGeneration: "4:*" },
    { ...migration, toGeneration: "4:short" },
    { ...migration, fromGeneration: `5:${"a".repeat(64)}` },
    { ...migration, toGeneration: `5:${"b".repeat(64)}` },
    { ...migration, fromGeneration: `${from}:primitive-v1` },
    { ...migration, toGeneration: `${to}:primitive-v1` },
  ])("rejects a malformed or unsupported descriptor: %j", (invalid) => {
    expect(() => previousSaveIdentity(main, to, invalid)).toThrow("hash pair");
  });
  it("does not activate without a caller descriptor or follow a later generation", async () => {
    const source = seed();
    const disabled = new EditPersistence(to),
      future = new EditPersistence(unknown, migration);
    await disabled.open();
    await future.open();
    expect(await done(disabled.loadWorld(main))).toEqual(emptyWorldSave(main));
    const later = { ...main, generation: unknown };
    expect(await done(future.loadWorld(later))).toEqual(emptyWorldSave(later));
    expect(storage.records.size).toBe(1);
    expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
  });
  it("snapshots the supplied pair instead of accepting later caller changes", async () => {
    const supplied = { ...migration };
    const configured = new EditPersistence(to, supplied);
    await configured.open();
    seed();
    supplied.fromGeneration = unknown;
    expect((await done(configured.loadWorld(main))).edits).toEqual(
      record(main).edits,
    );
  });
});

describe("atomic current-world preference and copy", () => {
  it.each([main, test])(
    "copies and reloads the complete $kind save while retaining the source",
    async (identity) => {
      const source = seed(identity),
        expected = { ...source, identity };
      expect(await done(persistence.loadWorld(identity))).toEqual(expected);
      expect(storage.records.get(worldKey(identity))).toEqual(expected);
      expect(storage.records.get(worldKey(previous(identity)))).toEqual(source);
      await persistence.close();
      const reopened = await peer();
      expect(await done(reopened.loadWorld(identity))).toEqual(expected);
      expect(
        storage.requests.filter(({ kind }) => kind === "add"),
      ).toHaveLength(1);
      expect(storage.records.get(worldKey(previous(identity)))).toEqual(source);
    },
  );
  it.each([false, true])(
    "prefers an existing current record, including empty=%s",
    async (empty) => {
      const current = empty ? emptyWorldSave(main) : record(main);
      storage.records.set(worldKey(main), current);
      storage.records.set(worldKey(previous(main)), { corrupt: true });
      expect(await done(persistence.loadWorld(main))).toEqual(current);
      expect(
        storage.requests.some(({ key }) => key === worldKey(previous(main))),
      ).toBe(false);
      expect(
        storage.requests.some(({ kind }) => kind === "add" || kind === "put"),
      ).toBe(false);
      expect(storage.records.get(worldKey(previous(main)))).toEqual({
        corrupt: true,
      });
    },
  );
  it("keeps main/test, seeds and primitive records isolated without scanning storage", async () => {
    const others = [
      previous(test),
      { ...previous(main), seed: 2 },
      { ...previous(main), generation: `${from}:primitive-v1` },
      { ...main, generation: unknown },
    ];
    for (const identity of others)
      storage.records.set(worldKey(identity), record(identity));
    expect(await done(persistence.loadWorld(main))).toEqual(
      emptyWorldSave(main),
    );
    const primitive = { ...main, generation: `${to}:primitive-v1` };
    expect(await done(persistence.loadWorld(primitive))).toEqual(
      emptyWorldSave(primitive),
    );
    for (const identity of others)
      expect(storage.records.get(worldKey(identity))).toEqual(record(identity));
    expect(storage.requests.filter(({ kind }) => kind === "add")).toEqual([
      { kind: "add", key: worldKey(main) },
    ]);
    expect((await done(persistence.loadWorld(test))).edits).toEqual(
      record(test).edits,
    );
    expect(storage.records.get(worldKey(main))).toEqual(emptyWorldSave(main));
  });
  it("makes a new empty destination durable so a later source cannot resurrect edits", async () => {
    expect(await done(persistence.loadWorld(main))).toEqual(
      emptyWorldSave(main),
    );
    const source = seed();
    const reopened = await peer();
    expect(await done(reopened.loadWorld(main))).toEqual(emptyWorldSave(main));
    expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
  });
  it.each([false, true])(
    "clear retains pose/discoveries and cannot reimport edits, with initial load=%s",
    async (loadFirst) => {
      const source = seed();
      if (loadFirst) await done(persistence.loadWorld(main));
      expect(await done(persistence.clear(main))).toBe(true);
      const expected = { ...source, identity: main, edits: [] };
      expect(await done(persistence.loadWorld(main))).toEqual(expected);
      await persistence.close();
      expect(await done((await peer()).loadWorld(main))).toEqual(expected);
      expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
    },
  );
  it("preserves current-generation legacy TEST priority and leaves the predecessor unread", async () => {
    const source = seed(test),
      legacy = [{ ...edit, block: 4 }];
    storage.records.set(`${to}:1`, legacy);
    const expected = { ...emptyWorldSave(test), edits: legacy };
    expect(await done(persistence.loadWorld(test))).toEqual(expected);
    expect(storage.records.get(worldKey(test))).toEqual(expected);
    expect(
      storage.requests.some(({ key }) => key === worldKey(previous(test))),
    ).toBe(false);
    expect(storage.records.get(worldKey(previous(test)))).toEqual(source);
  });
  it("does not migrate old numeric TEST keys or change numeric-target behavior", async () => {
    storage.records.set(`${from}:1`, [edit]);
    expect(await done(persistence.loadWorld(test))).toEqual(
      emptyWorldSave(test),
    );
    storage.records.set(`${to}:2`, [edit]);
    expect(await done(persistence.load(2))).toEqual([edit]);
    expect(storage.records.get(`${from}:1`)).toEqual([edit]);
    expect(storage.records.has(worldKey({ ...test, seed: 2 }))).toBe(false);
    expect(storage.created.at(-1)).toBe("readonly");
  });
});

const corrupt: readonly [string, (identity: WorldIdentity) => unknown][] = [
  ["undefined", () => undefined],
  ["null", () => null],
  ["schema", (identity) => ({ ...record(identity), schema: 1 })],
  ["identity", (identity) => record({ ...identity, seed: 2 })],
  [
    "edit",
    (identity) => ({ ...record(identity), edits: [{ ...edit, block: -1 }] }),
  ],
  ["pose", (identity) => ({ ...record(identity), pose: { ...pose, x: NaN } })],
  [
    "discovery",
    (identity) => ({ ...record(identity), discoveries: ["not-a-region"] }),
  ],
];
describe.each(["current", "previous"] as const)(
  "corrupt %s record safety",
  (which) => {
    it.each(corrupt)(
      "blocks %s without replacing either record",
      async (_label, value) => {
        seed();
        const identity = which === "current" ? main : previous(main),
          key = worldKey(identity);
        storage.records.set(key, value(identity));
        const before = structuredClone(storage.records);
        expect(await done(persistence.loadWorld(main))).toEqual(
          emptyWorldSave(main),
        );
        expect(persistence.blocked).toBe(true);
        expect(await done(persistence.save(main, [edit]))).toBe(false);
        expect(await done(persistence.savePose(main, pose))).toBe(false);
        expect(await done(persistence.discover(main, "plains"))).toBe(false);
        expect(await done(persistence.clear(main))).toBe(false);
        expect(storage.records).toEqual(before);
      },
    );
    it("also guards an open-then-save call before any load", async () => {
      const identity = which === "current" ? main : previous(main);
      storage.records.set(worldKey(identity), undefined);
      const before = structuredClone(storage.records);
      expect(await done(persistence.savePose(main, pose))).toBe(false);
      expect(persistence.blocked).toBe(true);
      expect(await done(persistence.clear(main))).toBe(false);
      expect(storage.records).toEqual(before);
    });
  },
);

describe("migration failures and queue ordering", () => {
  it("does not bypass a corrupt current numeric TEST record", async () => {
    seed(test);
    storage.records.set(`${to}:1`, undefined);
    const before = structuredClone(storage.records);
    expect(await done(persistence.loadWorld(test))).toEqual(
      emptyWorldSave(test),
    );
    expect(persistence.blocked).toBe(true);
    expect(await done(persistence.clear(test))).toBe(false);
    expect(storage.records).toEqual(before);
  });
  it.each(["current", "previous"])(
    "recovers a failed %s read only after successful reload and isolates other worlds",
    async (which) => {
      const source = seed();
      storage.failReadKey = worldKey(
        which === "current" ? main : previous(main),
      );
      expect(await done(persistence.loadWorld(main))).toEqual(
        emptyWorldSave(main),
      );
      expect(await done(persistence.clear(main))).toBe(false);
      expect(await done(persistence.save(test, [edit]))).toBe(true);
      expect(await done(persistence.clear(main))).toBe(false);
      expect(await done(persistence.loadWorld(main))).toEqual({
        ...source,
        identity: main,
      });
      expect(await done(persistence.savePose(main, { ...pose, x: 8 }))).toBe(
        true,
      );
      expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
    },
  );
  it.each(["throwWrite", "failWrite", "abortWrite"] as const)(
    "preserves the source after %s and can retry a failed load",
    async (fault) => {
      const source = seed();
      storage[fault] = true;
      expect(await done(persistence.loadWorld(main))).toEqual(
        emptyWorldSave(main),
      );
      expect(persistence.blocked).toBe(true);
      expect(storage.records.has(worldKey(main))).toBe(false);
      expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
      expect(await done(persistence.save(main, []))).toBe(false);
      expect(await done(persistence.loadWorld(main))).toEqual({
        ...source,
        identity: main,
      });
    },
  );
  it.each(["throwWrite", "failWrite", "abortWrite"] as const)(
    "retries mutation after transient %s through a fresh validated transaction",
    async (fault) => {
      const source = seed();
      await done(persistence.loadWorld(main));
      storage[fault] = true;
      expect(await done(persistence.savePose(main, { ...pose, x: 18 }))).toBe(
        false,
      );
      expect(storage.records.get(worldKey(main))).toEqual({
        ...source,
        identity: main,
      });
      expect(await done(persistence.clear(main))).toBe(true);
      expect(storage.records.get(worldKey(main))).toEqual({
        ...source,
        identity: main,
        edits: [],
      });
      expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
    },
  );
  it("does not publish an add request as success before commit, including a late abort", async () => {
    const source = seed();
    storage.holdCommits = true;
    let settled = false;
    const loading = persistence.loadWorld(main).then((saved) => {
      settled = true;
      return saved;
    });
    await storage.flush();
    expect(storage.requests.at(-1)).toEqual({
      kind: "add",
      key: worldKey(main),
    });
    expect(settled).toBe(false);
    expect(storage.records.has(worldKey(main))).toBe(false);
    storage.abortWrite = true;
    await storage.flush();
    expect(await loading).toEqual(emptyWorldSave(main));
    expect(storage.records.has(worldKey(main))).toBe(false);
    expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
    storage.holdCommits = false;
    expect(await done(persistence.save(main, []))).toBe(false);
    expect(await done(persistence.loadWorld(main))).toEqual({
      ...source,
      identity: main,
    });
  });
  it("serializes two migration clients and performs only one initial add", async () => {
    const source = seed(),
      other = await peer();
    storage.holdCommits = true;
    const first = persistence.loadWorld(main),
      second = other.loadWorld(main);
    await storage.flush();
    expect(storage.pending).toHaveLength(2);
    expect(storage.records.has(worldKey(main))).toBe(false);
    storage.holdCommits = false;
    expect(await done(Promise.all([first, second]))).toEqual([
      { ...source, identity: main },
      { ...source, identity: main },
    ]);
    expect(storage.requests.filter(({ kind }) => kind === "add")).toHaveLength(
      1,
    );
    expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
  });
  it.each([true, false])(
    "orders a competing clear with migration, clear first=%s",
    async (clearFirst) => {
      const source = seed(),
        other = await peer();
      const operations = clearFirst
        ? [other.clear(main), persistence.loadWorld(main)]
        : [persistence.loadWorld(main), other.clear(main)];
      const loaded = { ...source, identity: main };
      expect(await done(Promise.all(operations))).toEqual(
        clearFirst ? [true, { ...loaded, edits: [] }] : [loaded, true],
      );
      expect(await done(persistence.loadWorld(main))).toEqual({
        ...source,
        identity: main,
        edits: [],
      });
      expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
    },
  );
  it("rereads fields changed by another client instead of overwriting them from memory", async () => {
    const source = seed(),
      other = await peer();
    await done(persistence.loadWorld(main));
    await done(other.loadWorld(main));
    await done(other.discover(main, "mountains"));
    await done(persistence.savePose(main, { ...pose, x: 8 }));
    await done(other.save(main, [edit]));
    expect(await done(persistence.loadWorld(main))).toEqual({
      ...source,
      identity: main,
      pose: { ...pose, x: 8 },
      discoveries: [...source.discoveries, "mountains"],
      edits: [edit],
    });
    storage.records.set(worldKey(main), undefined);
    expect(await done(persistence.savePose(main, pose))).toBe(false);
    expect(storage.records.has(worldKey(main))).toBe(true);
    expect(storage.records.get(worldKey(main))).toBeUndefined();
  });
  it("keeps queued snapshots, fields and clear in order and closes only after commit", async () => {
    const source = seed(),
      mutable = { ...edit, block: 4 },
      moved = { ...pose, x: 12 };
    const loading = persistence.loadWorld(main),
      moving = persistence.savePose(main, moved),
      discovery = persistence.discover(main, "mountains"),
      saving = persistence.save(main, [mutable]);
    mutable.block = 3;
    moved.x = 14;
    const read = persistence.loadWorld(main);
    await done(Promise.all([loading, moving, discovery, saving]));
    expect(await read).toEqual({
      ...source,
      identity: main,
      edits: [{ ...edit, block: 4 }],
      pose: { ...pose, x: 12 },
      discoveries: [...source.discoveries, "mountains"],
    });
    storage.holdCommits = true;
    const clearing = persistence.clear(main),
      closing = persistence.close();
    await storage.flush();
    expect(storage.closed).toBe(false);
    storage.holdCommits = false;
    await done(Promise.all([clearing, closing]));
    expect(storage.closed).toBe(true);
    expect((storage.records.get(worldKey(main)) as WorldSave).edits).toEqual(
      [],
    );
    expect(storage.records.get(worldKey(previous(main)))).toEqual(source);
  });
});
