import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";
import type { GameTelemetry } from "../../../client/src/game/create-game.js";
import { browserExecutable, browserTestUrl } from "./browser.js";

const output = resolve("out/engine/drive");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ["--enable-unsafe-swiftshader"],
});
const base = browserTestUrl(),
  errors: string[] = [],
  warnings: string[] = [],
  results: unknown[] = [];
const state = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __cf: { telemetry: GameTelemetry } }).__cf
        .telemetry,
  );
async function frames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function capture(page: Page, name: string): Promise<void> {
  await frames(page);
  const telemetry = await state(page);
  const data = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("No canvas");
    const gl = canvas.getContext("webgl2");
    if (!crossOriginIsolated || !gl || gl.isContextLost())
      throw new Error("Graphics preflight failed");
    return canvas.toDataURL("image/png");
  });
  await writeFile(
    resolve(output, `${name}.png`),
    Buffer.from(data.split(",")[1] as string, "base64"),
  );
  await writeFile(
    resolve(output, `${name}.json`),
    JSON.stringify(telemetry, null, 2),
  );
  results.push({ name, telemetry });
}
async function open(scene = ""): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  const url = new URL(base);
  url.searchParams.set("world", "test");
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
async function aim(
  page: Page,
  point: readonly [number, number, number],
): Promise<GameTelemetry> {
  const telemetry = await state(page),
    c = telemetry.camera;
  const camera = new PerspectiveCamera(c.fov, 1280 / 720, 0.2, 1600);
  camera.position.set(c.position.x, c.position.y, c.position.z);
  camera.lookAt(c.focus.x, c.focus.y, c.focus.z);
  camera.updateMatrixWorld();
  const p = new Vector3(...point).project(camera);
  await page.mouse.move((p.x + 1) * 640, (1 - p.y) * 360);
  await frames(page);
  return state(page);
}
try {
  const page = await open();
  await page.keyboard.press("Digit3");
  const target = await aim(page, [0.5, 6, -2.5]);
  assert(
    target.target && target.target.distance <= 5,
    "Actual eye target must be reachable",
  );
  assert(target.ghost, "Valid placement ghost missing");
  await capture(page, "outline-ghost");
  const placement = target.ghost;
  // Re-aim after any pointer move; right click invokes the actual world action.
  await aim(page, [0.5, 6, -2.5]);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(70);
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(
    () =>
      (window as unknown as { __cf: { telemetry: GameTelemetry } }).__cf
        .telemetry.editCount > 0,
  );
  const placed = await state(page);
  assert.equal(placed.lastEdit?.block, 2);
  assert.deepEqual(
    [placed.lastEdit?.x, placed.lastEdit?.y, placed.lastEdit?.z],
    [placement.x, placement.y, placement.z],
  );
  await aim(page, [placement.x + 0.5, placement.y + 0.99, placement.z + 0.5]);
  await page.mouse.down({ button: "left" });
  await page.waitForTimeout(70);
  await page.mouse.up({ button: "left" });
  await page.waitForTimeout(100);
  assert.equal(
    (await state(page)).lastEdit?.block,
    0,
    "Creative break must remove the real block",
  );
  const before = (await state(page)).body;
  await page.keyboard.down("w");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  await page.waitForTimeout(150);
  const walked = (await state(page)).body;
  assert(walked.z < before.z - 1.5, "W must walk screen-forward");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(70);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(250);
  assert(
    Math.abs((await state(page)).camera.yaw - 45) < 0.1,
    "Short arrow tap must snap45",
  );
  const distance = (await state(page)).camera.requestedDistance;
  await page.mouse.wheel(0, 10000);
  await frames(page);
  assert(
    (await state(page)).camera.requestedDistance <= distance * 1.25 + 0.001,
  );
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");
  await page.waitForTimeout(70);
  assert((await state(page)).body.flying, "DoubleSpace must enter flight");
  const flightY = (await state(page)).body.y;
  await page.keyboard.down("Space");
  await page.waitForTimeout(220);
  await page.keyboard.up("Space");
  assert(
    (await state(page)).body.y > flightY + 0.5,
    "Flight up must move the avatar",
  );
  await capture(page, "movement-flight");
  await page.context().close();
  if (process.argv.includes("--fixtures")) {
    const tunnel = await open("tunnel");
    await tunnel.waitForFunction(
      () =>
        (window as unknown as { __cf: { camera: { cut: number | null } } }).__cf
          .camera.cut !== null,
    );
    await tunnel.waitForTimeout(350);
    assert.equal((await state(tunnel)).camera.cut, 7.5);
    assert((await state(tunnel)).camera.tilt >= 69.9);
    await aim(tunnel, [0.5, 6, -1.5]);
    await capture(tunnel, "tunnel-cap");
    await tunnel.keyboard.down("s");
    await tunnel.waitForTimeout(1500);
    await tunnel.keyboard.up("s");
    await tunnel.waitForTimeout(650);
    assert.equal(
      (await state(tunnel)).camera.cut,
      null,
      "Exiting cover for0.5s must close the cut",
    );
    await capture(tunnel, "tunnel-exit");
    await tunnel.keyboard.down("w");
    await tunnel.waitForTimeout(1500);
    await tunnel.keyboard.up("w");
    await tunnel.waitForTimeout(350);
    assert.equal(
      (await state(tunnel)).camera.cut,
      7.5,
      "Reentry must reopen roof cut",
    );
    await capture(tunnel, "tunnel-reentry");
    await tunnel.context().close();
    const silhouette = await open("silhouette");
    await silhouette.waitForTimeout(300);
    assert.equal(
      (await state(silhouette)).camera.cut,
      null,
      "Adjacent wall must not activate cut",
    );
    assert(
      (await state(silhouette)).rendered.silhouette,
      "Occluded unit must draw silhouette",
    );
    await capture(silhouette, "silhouette");
    await silhouette.context().close();
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(
      {
        results,
        errors,
        warnings,
        fixture: process.argv.includes("--fixtures")
          ? "dev/test-scenes.ts seeds explicit two-block-high tunnel and adjacent wall; all camera/body changes came from real keyboard/mouse"
          : null,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      status: "pass",
      captures: results.length,
      errors: errors.length,
    }),
  );
} catch (error) {
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify(
      { failure: String(error), results, errors, warnings },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
