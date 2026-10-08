import { existsSync } from "node:fs";
import { chromium } from "playwright";
/** Keep the proven Windows browser; elsewhere use the pinned Playwright install. */
export function browserExecutable(): string {
  const known =
    "D:/Dex/Temp/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe";
  return (
    process.env.CF_CHROMIUM ??
    (existsSync(known) ? known : chromium.executablePath())
  );
}
export function browserTestUrl(): string {
  const index = process.argv.indexOf("--url");
  const url = index >= 0 ? process.argv[index + 1] : process.env.CF_URL;
  if (!url)
    throw new Error("Run browser-tests/run.ts or supply --url / CF_URL");
  return url;
}
