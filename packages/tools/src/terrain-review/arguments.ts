export type Arguments = ReadonlyMap<string, readonly string[]>;
/** Strict flag reader: negative coordinate values remain values, not flags. */
export function parseFlags(
  args: readonly string[],
  allowed: readonly string[],
  repeated: readonly string[] = [],
): Arguments {
  const result = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (arg === "--help") {
      result.set("help", ["true"]);
      continue;
    }
    if (!arg.startsWith("--"))
      throw new Error(`Unexpected positional argument: ${arg}`);
    const eq = arg.indexOf("="),
      key = arg.slice(2, eq < 0 ? undefined : eq);
    if (!allowed.includes(key)) throw new Error(`Unsupported option --${key}`);
    const value = eq < 0 ? args[++i] : arg.slice(eq + 1);
    if (value === undefined || value.startsWith("--") || value.length === 0)
      throw new Error(`--${key} needs a value`);
    if (result.has(key) && !repeated.includes(key))
      throw new Error(`--${key} may only appear once`);
    const list = result.get(key) ?? [];
    list.push(value);
    result.set(key, list);
  }
  return result;
}
export function value(flags: Arguments, key: string, fallback: string): string {
  return flags.get(key)?.[0] ?? fallback;
}
export function finiteNumber(text: string, name: string): number {
  if (!text.trim() || !Number.isFinite(Number(text)))
    throw new Error(`${name} must be a finite number`);
  return Number(text);
}
export function tuple(text: string, length: number, name: string): number[] {
  const values = text.split(",");
  if (values.length !== length)
    throw new Error(`${name} requires ${length} comma-separated numbers`);
  return values.map((v) => finiteNumber(v, name));
}
export function seedValue(flags: Arguments): number {
  const seed = finiteNumber(value(flags, "seed", "1"), "Seed");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Seed must be an unsigned 32-bit integer");
  return seed;
}
export function worldValue(flags: Arguments): "main" | "test" {
  const world = value(flags, "world", "main");
  if (world !== "main" && world !== "test")
    throw new Error("World must be main or test");
  return world;
}
