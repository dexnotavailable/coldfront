import type {
  WorldIdentity,
  WorldPlanData,
} from "../../../shared/src/world/types.js";
import { sameIdentity, worldKey } from "../game/world-save.js";
import { clonePlanBuffers, planChecksum } from "./plan-transport.js";
import { validateWorldPlan } from "./plan-validation.js";

interface StoredPlan {
  schema: 1;
  identity: WorldIdentity;
  data: WorldPlanData;
  checksum: string;
}
/** Optional rebuildable cache, deliberately separate from retained-edit transactions. */
export class WorldPlanCache {
  private database: Promise<IDBDatabase | null> | null = null;
  private readonly pending = new Map<string, Promise<WorldPlanData>>();
  private open(): Promise<IDBDatabase | null> {
    this.database ??= new Promise((resolve) => {
      try {
        const request = indexedDB.open("coldfront-world-plans", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("plans");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.database;
  }
  async read(
    identity: WorldIdentity,
    version: number,
  ): Promise<WorldPlanData | null> {
    const db = await this.open();
    if (!db) return null;
    try {
      const cached = await new Promise<StoredPlan | undefined>(
        (resolve, reject) => {
          const request = db
            .transaction("plans")
            .objectStore("plans")
            .get(`1:${worldKey(identity)}`);
          request.onsuccess = () =>
            resolve(request.result as StoredPlan | undefined);
          request.onerror = () => reject(request.error);
        },
      );
      if (cached?.schema !== 1 || !sameIdentity(cached.identity, identity))
        return null;
      validateWorldPlan(cached.data, identity, version);
      if (cached.checksum !== (await planChecksum(cached.data))) return null;
      return clonePlanBuffers(cached.data, false);
    } catch {
      return null;
    }
  }
  async write(
    identity: WorldIdentity,
    version: number,
    data: WorldPlanData,
  ): Promise<void> {
    validateWorldPlan(data, identity, version);
    const db = await this.open();
    if (!db) return;
    try {
      const copy = clonePlanBuffers(data, false),
        record: StoredPlan = {
          schema: 1,
          identity: { ...identity },
          data: copy,
          checksum: await planChecksum(copy),
        };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("plans", "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.objectStore("plans").put(record, `1:${worldKey(identity)}`);
      });
    } catch {
      /* Cache failure cannot destroy edits or stop deterministic rebuilding. */
    }
  }
  ensure(
    identity: WorldIdentity,
    version: number,
    build: () => Promise<WorldPlanData>,
  ): Promise<WorldPlanData> {
    const key = worldKey(identity),
      old = this.pending.get(key);
    if (old) return old;
    const request = (async () => {
      const cached = await this.read(identity, version);
      if (cached) return cached;
      const plan = await build();
      await this.write(identity, version, plan);
      return clonePlanBuffers(plan, false);
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
  async close(): Promise<void> {
    await Promise.allSettled(this.pending.values());
    (await this.database)?.close();
    this.database = null;
  }
}
