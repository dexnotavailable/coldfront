import type {
  SurfaceRegionId,
  WorldIdentity,
} from "../../../shared/src/world/types.js";
import type { VoxelEdit } from "../engine/worker-protocol.js";
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
  blocked = false;
  constructor(private readonly generation: string) {}
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
  loadWorld(target: Target): Promise<WorldSave> {
    const { identity, key, legacy } = this.target(target);
    return this.enqueue(async () => {
      try {
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
    return this.enqueue(async () => {
      if (!this.db || this.unreadable.has(key)) {
        this.blocked = true;
        return false;
      }
      try {
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
