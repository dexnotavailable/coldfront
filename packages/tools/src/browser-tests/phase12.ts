import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Worker } from "playwright";
import type { GameSnapshot } from "../../../client/src/contracts/game-ui.js";
import type { GameTelemetry } from "../../../client/src/game/create-game.js";
import { sourceFiles } from "../build/metadata.js";
import { browserExecutable, browserTestUrl } from "./browser.js";

interface Hook {
  ready: boolean;
  snapshot: GameSnapshot;
  telemetry: GameTelemetry;
}
const output = resolve(`out/phase12/browser-${Date.now()}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ["--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const page = await context.newPage(),
  errors: string[] = [],
  warnings: string[] = [],
  results: unknown[] = [];
const workers = new Set<Worker>(),
  workerEvents: { event: string; count: number; url: string }[] = [];
let peakWorkers = 0;
page.on("worker", (worker) => {
  workers.add(worker);
  peakWorkers = Math.max(peakWorkers, workers.size);
  workerEvents.push({
    event: "created",
    count: workers.size,
    url: worker.url(),
  });
  worker.on("close", () => {
    workers.delete(worker);
    workerEvents.push({
      event: "closed",
      count: workers.size,
      url: worker.url(),
    });
  });
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
  if (message.type() === "warning") warnings.push(message.text());
});
const state = () =>
  page.evaluate(() => {
    const h = (window as unknown as { __cf: Hook }).__cf;
    return { ready: h.ready, snapshot: h.snapshot, telemetry: h.telemetry };
  });
async function ready(): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __cf?: Hook }).__cf?.ready,
    undefined,
    { timeout: 300_000 },
  );
}
async function capture(name: string): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
  const proof = await page.evaluate(() => {
    const gl = document
      .querySelector<HTMLCanvasElement>("canvas.cf-world")
      ?.getContext("webgl2");
    if (!crossOriginIsolated || !gl || gl.isContextLost())
      throw new Error("Isolation/WebGL2 preflight failed");
    const card = document.querySelector(".cf-discovery");
    const style = card ? getComputedStyle(card) : null;
    const glyphStyle = card
      ? getComputedStyle(card.querySelector(".cf-discovery-name") ?? card)
      : null;
    return {
      isolated: crossOriginIsolated,
      contextLost: gl.isContextLost(),
      discovery: card
        ? {
            dateNow: Date.now(),
            performanceNow: performance.now(),
            opacity: style?.opacity,
            strokeTarget: "name",
            webkitTextStrokeWidth: glyphStyle?.webkitTextStrokeWidth,
            webkitTextStrokeColor: glyphStyle?.webkitTextStrokeColor,
            paintOrder: glyphStyle?.paintOrder,
            animations: card.getAnimations().map((animation) => ({
              currentTime: animation.currentTime,
              playState: animation.playState,
              duration: animation.effect?.getTiming().duration,
            })),
          }
        : null,
    };
  });
  const data = await state();
  const image = `${name}.jpg`;
  const bytes = await page.screenshot({
    type: "jpeg",
    quality: 85,
    path: resolve(output, image),
  });
  await writeFile(
    resolve(output, `${name}.json`),
    JSON.stringify({ ...data, proof }, null, 2),
  );
  results.push({
    name,
    image,
    imageSha256: createHash("sha256").update(bytes).digest("hex"),
    ...data,
    proof,
  });
}
let failure: unknown;
const timings: Record<string, number> = {};
try {
  const url = new URL(browserTestUrl());
  url.searchParams.set("world", "main");
  url.searchParams.set("seed", "1");
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  const startupStarted = Date.now();
  await page.locator('[data-ui="title.play"]').click();
  await ready();
  timings.startupUiWaitMs = Date.now() - startupStarted;
  await page.waitForTimeout(350);
  const loaded = await state();
  assert.equal(loaded.snapshot.world?.identity.kind, "main");
  assert.equal(loaded.snapshot.mapInfo?.regions.length, 16);
  assert(
    loaded.snapshot.debug?.feet,
    "Map initial pin requires actual feet even with F3 closed",
  );
  await capture("main-spawn");
  const mapStarted = Date.now();
  await page.keyboard.press("KeyM");
  await page
    .locator('[data-ui="map.view"][data-map-ready="true"]')
    .waitFor({ timeout: 120_000 });
  timings.mapUiWaitMs = Date.now() - mapStarted;
  await capture("main-map");
  const mapBefore = await state();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyW");
  const mapAfter = await state();
  assert.equal(mapAfter.telemetry.body.x, mapBefore.telemetry.body.x);
  assert.equal(mapAfter.telemetry.body.z, mapBefore.telemetry.body.z);
  assert(
    mapAfter.telemetry.worldTimeSeconds > mapBefore.telemetry.worldTimeSeconds,
    "Map must not pause the world clock",
  );
  assert.equal(
    mapAfter.telemetry.rendering.animationRenders,
    mapBefore.telemetry.rendering.animationRenders,
    "Opaque map must not redraw hidden3D",
  );
  assert(
    mapAfter.telemetry.rendering.hiddenFrames >
      mapBefore.telemetry.rendering.hiddenFrames,
    "Opaque-map RAF/simulation must continue",
  );
  await page.keyboard.press("KeyM");
  await page.locator('[data-ui="map.view"]').waitFor({ state: "detached" });
  await page.keyboard.press("F4");
  await page.locator('[data-ui="tools.region"]').click();
  const bodyBefore = (await state()).telemetry.body;
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  const afterSelect = (await state()).telemetry.body;
  assert.deepEqual(
    [afterSelect.x, afterSelect.y, afterSelect.z],
    [bodyBefore.x, bodyBefore.y, bodyBefore.z],
    "Select arrows cannot drive the body",
  );
  assert(
    await page.locator('[data-ui="tools.title"]').isVisible(),
    "First Escape only dismisses the open Select",
  );
  const limitIndex = process.argv.indexOf("--limit-regions");
  const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : 16;
  if (!Number.isInteger(limit) || limit < 1 || limit > 16)
    throw new Error("Region limit must be1..16");
  for (const region of (loaded.snapshot.mapInfo?.regions ?? []).slice(
    0,
    limit,
  )) {
    if (!(await page.locator('[data-ui="tools.title"]').isVisible()))
      await page.keyboard.press("F4");
    await page.locator('[data-ui="tools.region"]').click();
    await page.getByRole("option", { name: region.name, exact: true }).click();
    await page.waitForFunction(
      (id) => {
        const h = (window as unknown as { __cf: Hook }).__cf;
        return h.ready && h.snapshot.debug?.regionWeights[0]?.regionId === id;
      },
      region.id,
      { timeout: 300_000 },
    );
    await page.keyboard.press("F4");
    await page.waitForTimeout(350);
    const arrived = await state();
    assert.equal(
      arrived.snapshot.world?.id,
      loaded.snapshot.world?.id,
      "Within-world jumps retain the session",
    );
    assert.equal(arrived.telemetry.camera.requestedDistance, 24);
    assert.equal(arrived.telemetry.camera.chosenTilt, 55);
    await capture(`region-${region.id}`);
  }
  await page.keyboard.press("Escape");
  await page.locator('[data-ui="menu.title"]').click();
  await page.locator('[data-ui="title.world"]').click();
  await page.locator('[data-ui="title.world.test"]').click();
  await page.locator('[data-ui="title.play"]').click();
  await ready();
  const test = await state();
  assert.equal(test.snapshot.world?.identity.kind, "test");
  assert.equal(test.snapshot.mapInfo?.regions.length, 0);
  assert.equal(
    test.telemetry.editCount,
    0,
    "Main/test retained edits must remain isolated",
  );
  await page.keyboard.press("F4");
  assert.equal(await page.locator('[data-ui="tools.region"]').count(), 0);
  await page.keyboard.press("F4");
  await capture("test-reentry");
  if (errors.length) throw new Error(errors.join("\n"));
} catch (error) {
  failure = String(error);
  await page
    .screenshot({
      type: "jpeg",
      quality: 85,
      path: resolve(output, "failure.jpg"),
    })
    .catch(() => {});
} finally {
  const sources = await Promise.all(
    [
      "packages/client/src/engine",
      "packages/client/src/game",
      "packages/client/src/bootstrap",
      "packages/client/src/ui",
      "packages/client/src/contracts",
      "packages/tools/src/browser-tests",
      "packages/shared/src",
    ]
      .flatMap(sourceFiles)
      .filter((file) => /\.[cm]?tsx?$/.test(file))
      .map(async (path) => ({
        path: path.replaceAll("\\", "/"),
        sha256: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      })),
  );
  await browser.close();
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(
      {
        results,
        errors,
        warnings,
        failure: failure ?? null,
        sources,
        peakWorkers,
        workerEvents,
        workersRemaining: workers.size,
        timings,
        status: failure ? "failed" : "passed",
        browserClosed: true,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify({
    output,
    cases: results.length,
    errors: errors.length,
    failure: failure ?? null,
  }),
);
if (failure) throw new Error(String(failure));
