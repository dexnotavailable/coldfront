/** Clone data for immutable ownership; typed buffers alone remain writable by JS. */
export function clonePlanBuffers<T>(value: T, shared: boolean): T {
  function copy(input: unknown): unknown {
    if (
      input === null ||
      typeof input === "string" ||
      typeof input === "number" ||
      typeof input === "boolean"
    )
      return input;
    if (ArrayBuffer.isView(input)) {
      const buffer = shared
        ? new SharedArrayBuffer(input.byteLength)
        : new ArrayBuffer(input.byteLength);
      new Uint8Array(buffer).set(
        new Uint8Array(input.buffer, input.byteOffset, input.byteLength),
      );
      if (input instanceof Float64Array) return new Float64Array(buffer);
      if (input instanceof Int32Array) return new Int32Array(buffer);
      if (input instanceof Uint32Array) return new Uint32Array(buffer);
      if (input instanceof Uint8Array) return new Uint8Array(buffer);
      throw new Error("Unsupported plan buffer type");
    }
    if (Array.isArray(input)) return Object.freeze(input.map(copy));
    if (typeof input === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(input))
        Object.defineProperty(result, key, {
          value: copy(item),
          enumerable: true,
        });
      return Object.freeze(result);
    }
    throw new Error("WorldPlan transport must contain data only");
  }
  return copy(value) as T;
}
export function planBytes(value: unknown): number {
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (Array.isArray(value))
    return value.reduce((n, item) => n + planBytes(item), 0);
  if (value && typeof value === "object")
    return Object.values(value).reduce<number>(
      (n, item) => n + planBytes(item),
      0,
    );
  return 0;
}
/** Buffer fingerprints protect persisted cache data; never imported by deterministic shared code. */
export async function planChecksum(value: unknown): Promise<string> {
  async function digest(bytes: Uint8Array): Promise<string> {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const hash = await crypto.subtle.digest("SHA-256", copy);
    return [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  async function descriptor(input: unknown): Promise<unknown> {
    if (ArrayBuffer.isView(input))
      return {
        type:
          input instanceof Float64Array
            ? "f64"
            : input instanceof Int32Array
              ? "i32"
              : input instanceof Uint32Array
                ? "u32"
                : "u8",
        bytes: input.byteLength,
        hash: await digest(
          new Uint8Array(input.buffer, input.byteOffset, input.byteLength),
        ),
      };
    if (Array.isArray(input)) {
      const result: unknown[] = [];
      for (const item of input) result.push(await descriptor(item));
      return result;
    }
    if (input && typeof input === "object") {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(input).sort())
        result[key] = await descriptor((input as Record<string, unknown>)[key]);
      return result;
    }
    return input;
  }
  return digest(
    new TextEncoder().encode(JSON.stringify(await descriptor(value))),
  );
}
