export const KNOWN_WINDOWS_BROWSER_CACHE = "D:/Dex/Temp/ms-playwright";
export interface BrowserCacheSelection {
  readonly path: string | undefined;
  readonly source: "environment" | "known-d-cache" | "playwright-default";
}
/** Must run before importing Playwright: it resolves registry paths during module evaluation. */
export function selectBrowserCache(
  explicit: string | undefined,
  knownCacheExists: boolean,
): BrowserCacheSelection {
  if (explicit) return { path: explicit, source: "environment" };
  return knownCacheExists
    ? { path: KNOWN_WINDOWS_BROWSER_CACHE, source: "known-d-cache" }
    : { path: undefined, source: "playwright-default" };
}
