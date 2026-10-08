import type { VoxelEdit } from "../../../client/src/engine/worker-protocol.js";

interface Request {
  result?: unknown;
  error?: Error;
  onsuccess?: () => void;
  onerror?: () => void;
}
interface Transaction {
  mode: IDBTransactionMode;
  key?: string;
  value?: readonly VoxelEdit[];
  request?: Request;
  oncomplete?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  objectStore(): {
    get(key: string): Request;
    put(value: readonly VoxelEdit[], key: string): Request;
  };
}
/** FIFO transaction scheduler: later-created reads cannot pass an existing write. */
export class StorageFixture {
  readonly records = new Map<string, readonly VoxelEdit[]>();
  readonly pending: Transaction[] = [];
  readonly created: IDBTransactionMode[] = [];
  throwWrite = false;
  failRead = false;
  abortWrite = false;
  closed = false;
  readonly db = {
    close: () => {
      this.closed = true;
    },
    createObjectStore: () => {},
    transaction: (
      _name: string,
      mode: IDBTransactionMode = "readonly",
    ): Transaction => {
      if (mode === "readwrite" && this.throwWrite) {
        this.throwWrite = false;
        throw new DOMException("fixture connection fault", "InvalidStateError");
      }
      this.created.push(mode);
      const tx: Transaction = {
        mode,
        objectStore: () => ({
          get: (key) => {
            tx.key = key;
            tx.request = {};
            return tx.request;
          },
          put: (value, key) => {
            tx.key = key;
            tx.value = structuredClone(value);
            tx.request = {};
            return tx.request;
          },
        }),
      };
      this.pending.push(tx);
      return tx;
    },
  };
  readonly factory = {
    open: () => {
      const request: Request = { result: this.db };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  async flush(): Promise<void> {
    for (let step = 0; step < 50; step++) {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const tx = this.pending.shift();
      if (!tx) continue;
      if (tx.mode === "readonly") {
        if (this.failRead) {
          this.failRead = false;
          if (tx.request) {
            tx.request.error = new Error("fixture read failed");
            tx.request.onerror?.();
          }
          tx.onabort?.();
        } else {
          if (tx.request) {
            tx.request.result = structuredClone(this.records.get(tx.key ?? ""));
            tx.request.onsuccess?.();
          }
          tx.oncomplete?.();
        }
      } else if (this.abortWrite) {
        this.abortWrite = false;
        tx.onerror?.();
        tx.onabort?.();
      } else {
        this.records.set(tx.key ?? "", tx.value ?? []);
        tx.oncomplete?.();
      }
    }
  }
}
