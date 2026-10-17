interface Request {
  result?: unknown;
  error?: Error;
  onsuccess?: () => void;
  onerror?: () => void;
}
interface Operation {
  kind: "getKey" | "get" | "add" | "put";
  key: string;
  value?: unknown;
  request: Request;
}
interface Transaction {
  mode: IDBTransactionMode;
  requests: Operation[];
  writes: Map<string, unknown>;
  aborted: boolean;
  error?: Error;
  oncomplete?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  abort(): void;
  objectStore(): {
    getKey(key: string): Request;
    get(key: string): Request;
    add(value: unknown, key: string): Request;
    put(value: unknown, key: string): Request;
  };
}
/** FIFO transaction scheduler: later-created reads cannot pass an existing write. */
export class StorageFixture {
  readonly records = new Map<string, unknown>();
  readonly pending: Transaction[] = [];
  readonly created: IDBTransactionMode[] = [];
  readonly requests: { kind: Operation["kind"]; key: string }[] = [];
  throwWrite = false;
  failRead = false;
  failReadKey: string | null = null;
  failWrite = false;
  abortWrite = false;
  holdCommits = false;
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
      const request = (
        kind: Operation["kind"],
        key: string,
        value?: unknown,
      ): Request => {
        const result: Request = {};
        tx.requests.push({
          kind,
          key,
          value: structuredClone(value),
          request: result,
        });
        return result;
      };
      const tx: Transaction = {
        mode,
        requests: [],
        writes: new Map(),
        aborted: false,
        abort: () => {
          tx.aborted = true;
        },
        objectStore: () => ({
          getKey: (key) => request("getKey", key),
          get: (key) => request("get", key),
          add: (value, key) => request("add", key, value),
          put: (value, key) => request("put", key, value),
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
      const tx = this.pending[0];
      if (!tx) continue;
      while (tx.requests.length && !tx.aborted) {
        const operation = tx.requests.shift();
        if (!operation) break;
        const { kind, key, value, request } = operation;
        this.requests.push({ kind, key });
        const present = tx.writes.has(key) || this.records.has(key),
          reading = kind === "get" || kind === "getKey";
        let error: Error | null = null;
        if (reading && (this.failRead || this.failReadKey === key)) {
          this.failRead = false;
          this.failReadKey = null;
          error = new Error("fixture read failed");
        } else if (!reading && this.failWrite) {
          this.failWrite = false;
          error = new Error("fixture write request failed");
        } else if (kind === "add" && present) {
          error = new DOMException("fixture duplicate key", "ConstraintError");
        }
        if (error) {
          request.error = tx.error = error;
          request.onerror?.();
          tx.onerror?.();
          tx.abort();
          break;
        }
        if (kind === "getKey") request.result = present ? key : undefined;
        else if (kind === "get")
          request.result = structuredClone(
            tx.writes.has(key) ? tx.writes.get(key) : this.records.get(key),
          );
        else {
          tx.writes.set(key, value);
          request.result = key;
        }
        request.onsuccess?.();
      }
      if (tx.mode === "readwrite" && this.abortWrite && !tx.aborted) {
        this.abortWrite = false;
        tx.error = new Error("fixture transaction aborted");
        tx.onerror?.();
        tx.abort();
      }
      if (tx.aborted) {
        this.pending.shift();
        tx.writes.clear();
        tx.onabort?.();
        continue;
      }
      // Requests have succeeded, but staged writes are not durable until commit.
      if (tx.mode === "readwrite" && this.holdCommits) return;
      for (const [key, value] of tx.writes) this.records.set(key, value);
      this.pending.shift();
      tx.oncomplete?.();
    }
  }
}
