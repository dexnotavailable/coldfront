import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";
import type { GameTelemetry } from "../../../client/src/game/create-game.js";
import { browserExecutable, browserTestUrl } from "./browser.js";

const output = resolve("out/engine/motion");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ["--enable-unsafe-swiftshader"],
});
const errors: string[] = [],
  warnings: string[] = [],
  receipts: unknown[] = [];
try {
  for (const kind of ["place", "break"] as const) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
      if (m.type() === "warning") warnings.push(m.text());
    });
    const url = new URL(browserTestUrl());
    if (kind === "break") url.searchParams.set("scene", "block");
    await page.goto(url.href);
    await page.waitForFunction(
      () => (window as unknown as { __cf?: { ready: boolean } }).__cf?.ready,
      undefined,
      { timeout: 180000 },
    );
    await page.keyboard.press("Digit3");
    const initial = await page.evaluate(
        () =>
          (window as unknown as { __cf: { telemetry: GameTelemetry } }).__cf
            .telemetry,
      ),
      c = initial.camera;
    const camera = new PerspectiveCamera(c.fov, 1280 / 720, 0.2, 1600);
    camera.position.set(c.position.x, c.position.y, c.position.z);
    camera.lookAt(c.focus.x, c.focus.y, c.focus.z);
    camera.updateMatrixWorld();
    const aim = new Vector3(0.5, kind === "place" ? 6 : 7, -2.5).project(
        camera,
      ),
      px = (aim.x + 1) * 640,
      py = (1 - aim.y) * 360;
    await page.mouse.move(px, py);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.mouse.down({ button: kind === "place" ? "right" : "left" });
    await page.waitForFunction(
      (k) =>
        (window as unknown as { __cf: { telemetry: GameTelemetry } }).__cf
          .telemetry.lastAction?.type === k,
      kind,
    );
    await page.mouse.up({ button: kind === "place" ? "right" : "left" });
    const action = await page.evaluate(
      () =>
        (window as unknown as { __cf: { telemetry: GameTelemetry } }).__cf
          .telemetry.lastAction,
    );
    assert(action);
    const times =
        kind === "place" ? [0, 25, 50, 75, 100] : [0, 50, 100, 200, 400],
      frames: string[] = [];
    for (const ms of times) {
      const data = await page.evaluate(
        (t) =>
          (
            window as unknown as {
              __cf: { renderStill(time: number): Promise<string> };
            }
          ).__cf.renderStill(t),
        action.displayTimeMs + ms,
      );
      frames.push(data);
      await writeFile(
        resolve(output, `${kind}-${ms}.png`),
        Buffer.from(data.split(",")[1] as string, "base64"),
      );
    }
    await page.close();
    const sheet = await context.newPage();
    await sheet.setViewportSize({ width: 1280, height: 256 });
    const left = Math.max(0, Math.min(1024, px - 128)),
      top = Math.max(0, Math.min(464, py - 128));
    await sheet.setContent(
      `<body style="margin:0;display:grid;grid-template-columns:repeat(5,256px)">${frames.map((src) => `<div style="width:256px;height:256px;overflow:hidden;position:relative"><img src="${src}" style="position:absolute;left:-${left}px;top:-${top}px;width:1280px;height:720px"></div>`).join("")}</body>`,
    );
    await sheet
      .locator("img")
      .evaluateAll((images) =>
        Promise.all(
          images.map((image) => (image as HTMLImageElement).decode()),
        ),
      );
    await sheet.screenshot({ path: resolve(output, `${kind}-strip.png`) });
    receipts.push({
      kind,
      action,
      times,
      crop: { left, top, width: 256, height: 256 },
      strip: resolve(output, `${kind}-strip.png`),
    });
    await context.close();
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify({ receipts, errors, warnings }, null, 2),
  );
  console.log(JSON.stringify({ status: "pass", strips: 2, errors: 0 }));
} finally {
  await browser.close();
}
