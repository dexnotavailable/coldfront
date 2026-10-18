import type {
  SurfaceRegionId,
  WorldIdentity,
} from "../../../shared/src/world/types.js";
import type { VoxelEdit } from "../engine/worker-protocol.js";
import {
  type ApprovedSaveMigration,
  previousSaveIdentity,
} from "./save-compatibility.js";
import {
  emptyWorldSave,
  parseWorldSave,
  type SavedPose,
  type WorldSave,
  worldKey,
} from "./world-save.js";

type Target = WorldIdentity | number;
export class EditPersistence {
  private db: IDBDatabase | null = null;
  private operations: Promise<void> = Promise.resolve();
  private readonly unreadable = new Set<string>();
  private readonly memory = new Map<string, WorldSave>();
  private readonly migration: ApprovedSaveMigration | undefined;
  blocked = false;
  constructor(
    private readonly generation: string,
    migration?: ApprovedSaveMigration,
  ) {
    this.migration = migration ? Object.freeze({ ...migration }) : undefined;
  }
  private target(target: Target): {
    identity: WorldIdentity;
    key: string;
    legacy: boolean;
  } {
    if (typeof target === "number")
      return {
        identity: { kind: "test", seed: target, generation: this.generation },
        key: `${this.generation}:${target}`,
        legacy: true,
      };
    return { identity: target, key: worldKey(target), legacy: false };
  }
  /** Every read/write/clear shares one queue; failed reads never permit replacement. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation);
    this.operations = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  async open(): Promise<void> {
    if (this.db) return;
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("coldfront-edits", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("worlds");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB blocked"));
      });
    } catch {
      this.blocked = true;
    }
  }
  private readKey(key: string): Promise<unknown> {
    if (!this.db) return Promise.reject(new Error("Saved data is unavailable"));
    return new Promise((resolve, reject) => {
      const request = this.db
        ?.transaction("worlds")
        .objectStore("worlds")
        .get(key);
      if (!request) return reject(new Error("Saved data is unavailable"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  /** One transaction protects the conditional copy across database connections. */
  private approvedWorld(
    identity: WorldIdentity,
    previous: WorldIdentity,
    update?: (record: WorldSave) => WorldSave,
  ): Promise<WorldSave> {
    return new Promise((resolve, reject) => {
      const tx = this.db?.transaction("worlds", "readwrite");
      if (!tx) return reject(new Error("Saved data is unavailable"));
      const store = tx.objectStore("worlds"),
        key = worldKey(identity);
      let result: WorldSave | undefined,
        baseValidated = false,
        failure: unknown;
      const abort = (error: unknown): void => {
        failure = error;
        if (!baseValidated) this.unreadable.add(key);
        try {
          tx.abort();
        } catch {
          reject(error);
        }
      };
      const guard = (action: () => void): void => {
        try {
          action();
        } catch (error) {
          abort(error);
        }
      };
      tx.onerror = () => {
        failure ??= tx.error;
      };
      tx.onabort = () => {
        if (!baseValidated) this.unreadable.add(key);
        reject(failure ?? tx.error ?? new Error("Save transaction aborted"));
      };
      tx.oncomplete = () => {
        if (result) resolve(result);
        else reject(new Error("Save transaction completed without a record"));
      };
      const read = (
        entryKey: string,
        consume: (present: boolean, value: unknown) => void,
      ): void => {
        const presence = store.getKey(entryKey);
        presence.onerror = () => abort(presence.error);
        presence.onsuccess = () =>
          guard(() => {
            if (presence.result === undefined) return consume(false, undefined);
            const request = store.get(entryKey);
            request.onerror = () => abort(request.error);
            request.onsuccess = () =>
              guard(() => {
                if (request.result === undefined)
                  throw new Error("Existing save contains undefined");
                consume(true, request.result);
              });
          });
      };
      const finish = (saved: WorldSave, present: boolean): void => {
        baseValidated = true;
        result = update ? update(saved) : saved;
        const request = !present
          ? store.add(result, key)
          : update
            ? store.put(result, key)
            : null;
        if (request) request.onerror = () => abort(request.error);
      };
      const readPrevious = (): void => {
        read(worldKey(previous), (present, value) => {
          const saved = present
            ? parseWorldSave(value, previous, false)
            : emptyWorldSave(identity);
          finish({ ...saved, identity: { ...identity } }, false);
        });
      };
      guard(() =>
        read(key, (present, value) => {
          if (present)
            return finish(parseWorldSave(value, identity, false), true);
          if (identity.kind !== "test") return readPrevious();
          read(
            `${this.generation}:${identity.seed}`,
            (legacyPresent, legacy) => {
              if (legacyPresent)
                finish(parseWorldSave(legacy, identity, true), false);
              else readPrevious();
            },
          );
        }),
      );
    });
  }
  loadWorld(target: Target): Promise<WorldSave> {
    const { identity, key, legacy } = this.target(target);
    const previous = legacy
      ? null
      : previousSaveIdentity(identity, this.generation, this.migration);
    return this.enqueue(async () => {
      try {
        if (previous) {
          const saved = await this.approvedWorld(identity, previous);
          this.memory.set(key, saved);
          this.unreadable.delete(key);
          this.blocked = false;
          return saved;
        }
        let value = await this.readKey(key),
          allowLegacy = legacy;
        if (
          value === undefined &&
          !legacy &&
          identity.kind === "test" &&
          identity.generation === this.generation
        ) {
          value = await this.readKey(`${this.generation}:${identity.seed}`);
          allowLegacy = true;
        }
        const saved = parseWorldSave(value, identity, allowLegacy);
        this.memory.set(key, saved);
        this.unreadable.delete(key);
        this.blocked = false;
        return saved;
      } catch {
        this.unreadable.add(key);
        this.blocked = true;
        return emptyWorldSave(identity);
      }
    });
  }
  async load(target: Target): Promise<readonly VoxelEdit[]> {
    return (await this.loadWorld(target)).edits;
  }
  private mutate(
    target: Target,
    update: (record: WorldSave) => WorldSave,
  ): Promise<boolean> {
    const { identity, key, legacy } = this.target(target);
    const previous = legacy
      ? null
      : previousSaveIdentity(identity, this.generation, this.migration);
    return this.enqueue(async () => {
      if (!this.db || this.unreadable.has(key)) {
        this.blocked = true;
        return false;
      }
      try {
        if (previous) {
          const saved = await this.approvedWorld(identity, previous, update);
          this.memory.set(key, saved);
          this.blocked = false;
          return true;
        }
        const next = update(this.memory.get(key) ?? emptyWorldSave(identity));
        const saved = await new Promise<boolean>((resolve) => {
          const tx = this.db?.transaction("worlds", "readwrite");
          if (!tx) return resolve(false);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
          tx.objectStore("worlds").put(legacy ? next.edits : next, key);
        });
        if (saved) this.memory.set(key, next);
        this.blocked = !saved;
        return saved;
      } catch {
        this.blocked = true;
        return false;
      }
    });
  }
  save(target: Target, edits: readonly VoxelEdit[]): Promise<boolean> {
    const snapshot = edits.map((edit) => ({ ...edit }));
    return this.mutate(target, (previous) => ({
      ...previous,
      edits: snapshot,
    }));
  }
  savePose(identity: WorldIdentity, pose: SavedPose): Promise<boolean> {
    const snapshot = { ...pose };
    return this.mutate(identity, (previous) => ({
      ...previous,
      pose: snapshot,
    }));
  }
  discover(identity: WorldIdentity, region: SurfaceRegionId): Promise<boolean> {
    if (identity.kind === "test") return Promise.resolve(true);
    return this.mutate(identity, (previous) => ({
      ...previous,
      discoveries: [...new Set([...previous.discoveries, region])],
    }));
  }
  clear(target: Target): Promise<boolean> {
    return this.save(target, []);
  }
  async close(): Promise<void> {
    await this.enqueue(async () => {
      this.db?.close();
      this.db = null;
    });
  }
}
