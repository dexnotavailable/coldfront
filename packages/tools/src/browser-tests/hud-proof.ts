import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { PerspectiveCamera, Vector3 } from "three";
import type { GameTelemetry } from "../../../client/src/game/create-game.js";
import { browserExecutable, browserTestUrl } from "./browser.js";

const output = resolve("out/engine/hud-repair");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ["--enable-unsafe-swiftshader"],
});
const errors: string[] = [],
  warnings: string[] = [],
  results: unknown[] = [];
const telemetry = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __cf: { telemetry: GameTelemetry } }).__cf
        .telemetry,
  );
async function open(scene = ""): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  const url = new URL(browserTestUrl());
  if (scene) url.searchParams.set("scene", scene);
  await page.goto(url.href);
  const play = page.locator('[data-ui="title.play"]');
  if (await play.isVisible()) await play.click();
  await page.waitForFunction(
    () => (window as unknown as { __cf?: { ready: boolean } }).__cf?.ready,
    undefined,
    { timeout: 180000 },
  );
  return page;
}
function projectCamera(state: GameTelemetry): PerspectiveCamera {
  const c = new PerspectiveCamera(state.camera.fov, 1280 / 720, 0.2, 1600);
  c.position.set(
    state.camera.position.x,
    state.camera.position.y,
    state.camera.position.z,
  );
  c.lookAt(state.camera.focus.x, state.camera.focus.y, state.camera.focus.z);
  c.updateMatrixWorld();
  return c;
}
async function image(page: Page, name: string, time: number): Promise<Buffer> {
  const png = await page.evaluate(
    (t) =>
      (
        window as unknown as {
          __cf: { renderStill(time: number): Promise<string> };
        }
      ).__cf.renderStill(t),
    time,
  );
  const bytes = Buffer.from(png.split(",")[1] as string, "base64");
  await writeFile(resolve(output, `${name}.png`), bytes);
  return bytes;
}
try {
  const page = await open();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(70);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(260);
  await page.keyboard.press("Digit8");
  const pose = await telemetry(page);
  assert(Math.abs(pose.camera.distance - 24) < 0.01);
  assert(Math.abs(pose.camera.yaw - 45) < 0.1);
  const c = projectCamera(pose),
    aim = new Vector3(1.5, 6, -2.5).project(c);
  await page.mouse.move((aim.x + 1) * 640, (1 - aim.y) * 360);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const before = await telemetry(page),
    time = before.displayTimeMs;
  assert.equal(before.ghost, null);
  const baseline = await image(page, "ghost-empty-slot-baseline", time);
  await page.keyboard.press("Digit6"); // Normal creative hotbar Sand, no test-only material.
  const withGhost = await image(page, "outline-ghost", time),
    state = await telemetry(page);
  assert(state.target && state.target.distance <= 5);
  assert(state.ghost);
  assert.equal(state.rendered.ghost, true);
  const a = await sharp(baseline).removeAlpha().raw().toBuffer(),
    b = await sharp(withGhost).removeAlpha().raw().toBuffer();
  const xs: number[] = [],
    ys: number[] = [];
  for (const x of [0, 1])
    for (const y of [0, 1])
      for (const z of [0, 1]) {
        const p = new Vector3(
          state.ghost.x + x,
          state.ghost.y + y,
          state.ghost.z + z,
        ).project(c);
        xs.push((p.x + 1) * 640);
        ys.push((1 - p.y) * 360);
      }
  const bounds = {
    left: Math.max(0, Math.floor(Math.min(...xs)) - 2),
    top: Math.max(0, Math.floor(Math.min(...ys)) - 2),
    right: Math.min(1279, Math.ceil(Math.max(...xs)) + 2),
    bottom: Math.min(719, Math.ceil(Math.max(...ys)) + 2),
  };
  let changedPixels = 0,
    totalDifference = 0;
  for (let y = bounds.top; y <= bounds.bottom; y++)
    for (let x = bounds.left; x <= bounds.right; x++) {
      const i = (x + y * 1280) * 3,
        diff =
          Math.abs((a[i] as number) - (b[i] as number)) +
          Math.abs((a[i + 1] as number) - (b[i + 1] as number)) +
          Math.abs((a[i + 2] as number) - (b[i + 2] as number));
      if (diff > 9) changedPixels++;
      totalDifference += diff;
    }
  const ghostPixelProof = {
    bounds,
    changedPixels,
    totalDifference,
    baseline: "ghost-empty-slot-baseline.png",
    selectedKey: "Digit6",
    selectedBlock: "Sand",
    normalDistance: 24,
    yaw: 45,
    displayTimeMs: time,
  };
  await writeFile(
    resolve(output, "ghost-pixel-difference.json"),
    JSON.stringify(ghostPixelProof, null, 2),
  );
  await writeFile(
    resolve(output, "outline-ghost.json"),
    JSON.stringify(state, null, 2),
  );
  results.push({ name: "outline-ghost", telemetry: state });
  await page.context().close();
  const silhouette = await open("silhouette");
  await silhouette.waitForTimeout(1200);
  const hidden = await telemetry(silhouette);
  assert(hidden.rendered.silhouette);
  assert.equal(hidden.camera.cut, null);
  await image(silhouette, "silhouette", hidden.displayTimeMs);
  const s = await telemetry(silhouette);
  await writeFile(
    resolve(output, "silhouette.json"),
    JSON.stringify(s, null, 2),
  );
  results.push({ name: "silhouette", telemetry: s });
  await silhouette.context().close();
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify({ results, ghostPixelProof, errors, warnings }, null, 2),
  );
  console.log(
    JSON.stringify({
      captures: results.length,
      ghostPixelProof,
      errors: errors.length,
    }),
  );
} finally {
  await browser.close();
}
