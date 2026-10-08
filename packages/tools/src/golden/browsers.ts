import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createServer } from "vite";
import {
  KNOWN_WINDOWS_BROWSER_CACHE,
  selectBrowserCache,
} from "./browser-cache.js";
import {
  type BrowserName,
  browserPolicy,
  browserRunSucceeded,
} from "./browser-policy.js";
import {
  compareGoldenRecords,
  currentGoldenContract,
  type GoldenRecord,
  goldenCases,
} from "./core.js";
import {
  goldenSourceProvenance,
  REPO_ROOT,
  readGoldenFixture,
} from "./fixture.js";
import { createWorldResolver } from "./worlds.js";

interface BrowserResult {
  browser: BrowserName;
  status: "pass" | "skip" | "fail";
  executable: string;
  version?: string;
  elapsedMs?: number;
  checkedChunks?: number;
  reason?: string;
  failures?: string[];
}
const cache = selectBrowserCache(
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  existsSync(KNOWN_WINDOWS_BROWSER_CACHE),
);
if (cache.path !== undefined) process.env.PLAYWRIGHT_BROWSERS_PATH = cache.path;
// Deliberately dynamic: importing either module earlier would freeze default C:
// paths before the machine's established D: cache was selected.
const { chromium, firefox, webkit } = await import("playwright");
const { browserExecutable } = await import("../browser-tests/browser.js");
const policy = browserPolicy(process.argv.slice(2), process.env.CI);
const samples = goldenCases(createWorldResolver());
const fixture = await readGoldenFixture(undefined, samples);
const output = join(REPO_ROOT, "out/step4/golden-browsers.json");
const startedAt = new Date().toISOString();
const attemptOutput = join(
  REPO_ROOT,
  `out/step4/golden-browsers-${startedAt.replaceAll(":", "-")}.json`,
);
const results: BrowserResult[] = [];
const receipt = {
  schema: 1,
  startedAt,
  attemptOutput,
  policy,
  browserCache: cache,
  expected: currentGoldenContract(),
  source: goldenSourceProvenance(),
  fixtureSource: fixture.provenance,
  results,
  status: "running",
  serverClosed: false,
};
await mkdir(join(REPO_ROOT, "out/step4"), { recursive: true });
const save = async (): Promise<void> => {
  const json = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(attemptOutput, json);
  await writeFile(output, json);
};
await save();
const server = await createServer({
  configFile: false,
  root: REPO_ROOT,
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true },
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});
server.middlewares.use((request, response, next) => {
  if (request.url !== "/") {
    next();
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  response.end(
    '<!doctype html><title>Local determinism test</title><link rel="icon" href="data:,"><body></body>',
  );
});
try {
  await server.listen();
  const origin = server.resolvedUrls?.local[0];
  if (!origin || new URL(origin).hostname !== "127.0.0.1")
    throw new Error("Golden server must expose its own loopback origin");
  for (const name of policy.names) {
    const browserType = { chromium, firefox, webkit }[name];
    const override =
      name === "chromium"
        ? browserExecutable()
        : process.env[name === "firefox" ? "CF_FIREFOX" : "CF_WEBKIT"];
    const executable = override ?? browserType.executablePath();
    if (!existsSync(executable)) {
      const reason = `Browser executable is not installed: ${executable}. Runner never downloads browsers.`;
      results.push({ browser: name, status: "skip", executable, reason });
      console.log(`[${name}] SKIP: ${reason}`);
      await save();
      continue;
    }
    let browser: Awaited<ReturnType<typeof browserType.launch>> | undefined;
    const result: BrowserResult = { browser: name, status: "fail", executable };
    results.push(result);
    const started = performance.now();
    try {
      browser = await browserType.launch({
        executablePath: executable,
        headless: true,
        timeout: 30_000,
        ...(name === "chromium"
          ? { args: ["--enable-unsafe-swiftshader"] }
          : {}),
      });
      result.version = browser.version();
      const page = await browser.newPage();
      page.setDefaultTimeout(120_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
        else if (message.text().startsWith("golden-progress"))
          console.log(`[${name}] ${message.text()}`);
      });
      // This is only a local test harness. No public site or external asset is requested.
      await page.route("**/*", async (route) => {
        if (new URL(route.request().url()).origin !== new URL(origin).origin) {
          errors.push(`Unexpected external request: ${route.request().url()}`);
          await route.abort();
        } else await route.continue();
      });
      await page.goto(origin);
      const actual = await page.evaluate(
        async ({ cases, entry }) => {
          const harness = (await import(
            entry
          )) as typeof import("./browser-entry.js");
          const worlds = harness.createWorldResolver();
          return {
            contract: harness.currentGoldenContract(),
            cases: harness.goldenCases(worlds),
            records: await harness.computeGoldens(
              cases,
              (done, total) => {
                if (done % 25 === 0)
                  console.log(`golden-progress ${done}/${total}`);
              },
              worlds,
            ),
          };
        },
        {
          cases: samples,
          entry: new URL("packages/tools/src/golden/browser-entry.ts", origin)
            .href,
        },
      );
      const failures = compareGoldenRecords(
        fixture.records,
        actual.records as GoldenRecord[],
      );
      if (
        JSON.stringify(actual.contract) !==
        JSON.stringify(currentGoldenContract())
      )
        failures.push("Browser generation/version contract differs");
      if (JSON.stringify(actual.cases) !== JSON.stringify(samples))
        failures.push("Browser sample-set coordinates differ");
      failures.push(...errors);
      result.failures = failures;
      result.checkedChunks = actual.records.length;
      result.status = failures.length === 0 ? "pass" : "fail";
      console.log(
        `[${name}] ${result.status.toUpperCase()} ${actual.records.length} actual chunks, ${failures.length} failures`,
      );
    } catch (error) {
      result.reason = error instanceof Error ? error.message : String(error);
      console.error(`[${name}] FAIL: ${result.reason}`);
    } finally {
      result.elapsedMs = performance.now() - started;
      await browser?.close();
      await save();
    }
  }
  const passed = browserRunSucceeded(
    results.map((result) => result.status),
    policy.requireAll,
  );
  receipt.status = passed
    ? results.some((result) => result.status === "skip")
      ? "partial-local-pass"
      : "pass"
    : "fail";
  if (!passed) process.exitCode = 1;
} catch (error) {
  receipt.status = "fail";
  process.exitCode = 1;
  console.error(error);
} finally {
  await server.close();
  receipt.serverClosed = true;
  await save();
  console.log(`Browser golden receipt: ${attemptOutput} (latest: ${output})`);
}
