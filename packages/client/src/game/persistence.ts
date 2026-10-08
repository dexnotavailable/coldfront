import type { VoxelEdit } from "../engine/worker-protocol.js";
export class EditPersistence {
  private db: IDBDatabase | null = null;
  private writes: Promise<void> = Promise.resolve();
  blocked = false;
  constructor(private readonly cacheTag: string) {}
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
  async load(seed: number): Promise<readonly VoxelEdit[]> {
    if (!this.db) return [];
    try {
      return await new Promise<readonly VoxelEdit[]>((resolve, reject) => {
        const req = this.db
          ?.transaction("worlds")
          .objectStore("worlds")
          .get(`${this.cacheTag}:${seed}`);
        if (!req) return resolve([]);
        req.onsuccess = () =>
          resolve((req.result as VoxelEdit[] | undefined) ?? []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.blocked = true;
      return [];
    }
  }
  save(seed: number, edits: readonly VoxelEdit[]): Promise<void> {
    const snapshot = [...edits];
    this.writes = this.writes.then(
      () =>
        new Promise<void>((resolve) => {
          if (!this.db) return resolve();
          const tx = this.db.transaction("worlds", "readwrite");
          tx.objectStore("worlds").put(snapshot, `${this.cacheTag}:${seed}`);
          tx.oncomplete = () => resolve();
          tx.onerror = () => {
            this.blocked = true;
            resolve();
          };
          tx.onabort = () => {
            this.blocked = true;
            resolve();
          };
        }),
    );
    return this.writes;
  }
  async clear(seed: number): Promise<boolean> {
    await this.save(seed, []);
    return !this.blocked;
  }
  async close(): Promise<void> {
    await this.writes;
    this.db?.close();
    this.db = null;
  }
}
