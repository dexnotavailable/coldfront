export const BROWSER_NAMES = ["chromium", "firefox", "webkit"] as const;
export type BrowserName = (typeof BROWSER_NAMES)[number];
export interface BrowserPolicy {
  readonly names: readonly BrowserName[];
  readonly requireAll: boolean;
}
/** CI cannot quietly downgrade to one browser, even when a subset flag is supplied. */
export function browserPolicy(
  args: readonly string[],
  ci: string | undefined,
): BrowserPolicy {
  const requireAll =
    (!!ci && ci !== "false" && ci !== "0") || args.includes("--require-all");
  let names: BrowserName[] = [...BROWSER_NAMES];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--require-all") continue;
    if (arg !== "--browsers")
      throw new Error(`Unknown browser golden argument: ${arg}`);
    const value = args[++i];
    if (!value) throw new Error("--browsers requires a comma-separated list");
    const requested = value.split(",");
    if (
      requested.length === 0 ||
      new Set(requested).size !== requested.length ||
      requested.some(
        (name) => !(BROWSER_NAMES as readonly string[]).includes(name),
      )
    )
      throw new Error("Expected distinct chromium, firefox or webkit names");
    names = requested as BrowserName[];
  }
  if (
    requireAll &&
    (names.length !== 3 || BROWSER_NAMES.some((name) => !names.includes(name)))
  )
    throw new Error(
      "CI/--require-all requires Chromium, Firefox and WebKit; subsets are forbidden",
    );
  return { names, requireAll };
}
export function browserRunSucceeded(
  statuses: readonly ("pass" | "skip" | "fail")[],
  requireAll: boolean,
): boolean {
  return (
    statuses.length > 0 &&
    statuses.includes("pass") &&
    !statuses.includes("fail") &&
    (!requireAll || (statuses.length === 3 && !statuses.includes("skip")))
  );
}
