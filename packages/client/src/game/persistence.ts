import type { VoxelEdit } from "../engine/worker-protocol.js";
export class EditPersistence {
  private db: IDBDatabase | null = null;
  private operations: Promise<void> = Promise.resolve();
  private readonly unreadableSeeds = new Set<number>();
  blocked = false;
  constructor(private readonly cacheTag: string) {}
  /** Reads share the writer queue so they cannot overtake queued snapshots. */
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
  load(seed: number): Promise<readonly VoxelEdit[]> {
    return this.enqueue(async () => {
      try {
        if (!this.db) throw new Error("Saved data is unavailable");
        const saved = await new Promise<readonly VoxelEdit[]>(
          (resolve, reject) => {
            const req = this.db
              ?.transaction("worlds")
              .objectStore("worlds")
              .get(`${this.cacheTag}:${seed}`);
            if (!req) return reject(new Error("Saved data is unavailable"));
            req.onsuccess = () =>
              resolve((req.result as VoxelEdit[] | undefined) ?? []);
            req.onerror = () => reject(req.error);
          },
        );
        this.unreadableSeeds.delete(seed);
        this.blocked = false;
        return saved;
      } catch {
        this.unreadableSeeds.add(seed);
        this.blocked = true;
        return [];
      }
    });
  }
  save(seed: number, edits: readonly VoxelEdit[]): Promise<boolean> {
    const snapshot = [...edits];
    return this.enqueue(async () => {
      // A failed load is not an empty world. Never overwrite an unread record.
      if (!this.db || this.unreadableSeeds.has(seed)) {
        this.blocked = true;
        return false;
      }
      try {
        const saved = await new Promise<boolean>((resolve) => {
          const tx = this.db?.transaction("worlds", "readwrite");
          if (!tx) return resolve(false);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
          tx.objectStore("worlds").put(snapshot, `${this.cacheTag}:${seed}`);
        });
        this.blocked = !saved;
        return saved;
      } catch {
        this.blocked = true;
        return false;
      }
    });
  }
  async clear(seed: number): Promise<boolean> {
    return this.save(seed, []);
  }
  async close(): Promise<void> {
    await this.enqueue(async () => {
      this.db?.close();
      this.db = null;
    });
  }
}
