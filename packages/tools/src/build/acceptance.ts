import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type BrowserContext, chromium, type Page } from "playwright";
import { PerspectiveCamera, Vector3 } from "three";
import { preview } from "vite";
import type { GameSnapshot } from "../../../client/src/contracts/game-ui.js";
import type { GameTelemetry } from "../../../client/src/game/create-game.js";
import { browserExecutable } from "../browser-tests/browser.js";

interface Readback {
  ready: boolean;
  fullscreen: boolean;
  keyboardLocked: boolean;
  telemetry: GameTelemetry;
  snapshot: Pick<
    GameSnapshot,
    | "lifecycle"
    | "seed"
    | "mode"
    | "tools"
    | "hotbar"
    | "worldPaused"
    | "graphics"
    | "storage"
  >;
}
// 2^64 + 1 with leading zeros: exact decimal draft, normalized engine seed 1.
const rawSeedDraft = "00018446744073709551617";
const output = resolve(`out/composition/browser-${Date.now()}`);
await mkdir(output, { recursive: true });
const build = JSON.parse(
  await readFile(resolve("packages/client/dist/version.json"), "utf8"),
) as { basePath: string; commit: string; buildId: string };
assert.equal(build.basePath, "/coldfront/");
const server = await preview({
  configFile: resolve("packages/client/vite.config.ts"),
  preview: { host: "127.0.0.1", port: 0, strictPort: false },
});
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("No production preview URL");
const errors: string[] = [],
  warnings: string[] = [],
  requests = new Set<string>(),
  badResponses: unknown[] = [],
  steps: unknown[] = [];
const receipt = {
  status: "running",
  pid: process.pid,
  url,
  profile: resolve(output, "profile"),
  build,
  submittedSeedDraft: rawSeedDraft,
  steps,
  errors,
  warnings,
  badResponses,
  requests: [] as string[],
  browserClosed: false,
  serverClosed: false,
};
const save = async (): Promise<void> => {
  receipt.requests = [...requests].sort();
  await writeFile(
    resolve(output, "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
};
let context: BrowserContext | undefined;
let failures = 0;
await save();
console.log(
  JSON.stringify({ event: "started", pid: process.pid, url, output }),
);
async function readback(page: Page): Promise<Readback> {
  return page.evaluate(() => {
    const cf = (window as unknown as { __cf: Readback }).__cf;
    const {
      lifecycle,
      seed,
      mode,
      tools,
      hotbar,
      worldPaused,
      graphics,
      storage,
    } = cf.snapshot;
    return {
      ready: cf.ready,
      fullscreen: cf.fullscreen,
      keyboardLocked: cf.keyboardLocked,
      telemetry: cf.telemetry,
      snapshot: {
        lifecycle,
        seed,
        mode,
        tools,
        hotbar,
        worldPaused,
        graphics,
        storage,
      },
    };
  });
}
async function capture(page: Page, name: string): Promise<string> {
  await page.evaluate(() => document.fonts.ready);
  const path = resolve(output, `${name}.jpg`);
  await page.screenshot({ path, type: "jpeg", quality: 85 });
  return path;
}
async function step(
  name: string,
  action: () => Promise<unknown>,
): Promise<boolean> {
  console.log(JSON.stringify({ step: name, status: "running", output }));
  try {
    const result = await action();
    steps.push({ name, status: "pass", result });
    await save();
    console.log(JSON.stringify({ step: name, status: "pass" }));
    return true;
  } catch (error) {
    failures++;
    const failure = error instanceof Error ? error.stack : String(error);
    steps.push({ name, status: "fail", failure });
    await save();
    console.error(JSON.stringify({ step: name, status: "fail", failure }));
    return false;
  }
}
async function aim(
  page: Page,
  point: readonly [number, number, number],
): Promise<Readback> {
  const { camera: c } = (await readback(page)).telemetry;
  const view = page.viewportSize();
  if (!view) throw new Error("No viewport");
  const camera = new PerspectiveCamera(
    c.fov,
    view.width / view.height,
    0.2,
    1600,
  );
  camera.position.set(c.position.x, c.position.y, c.position.z);
  camera.lookAt(c.focus.x, c.focus.y, c.focus.z);
  camera.updateMatrixWorld();
  const p = new Vector3(...point).project(camera);
  await page.mouse.move(
    ((p.x + 1) * view.width) / 2,
    ((1 - p.y) * view.height) / 2,
  );
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
  return readback(page);
}
try {
  context = await chromium.launchPersistentContext(receipt.profile, {
    headless: true,
    executablePath: browserExecutable(),
    args: ["--enable-unsafe-swiftshader"],
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
  });
  await context.addInitScript({
    content:
      "Object.defineProperty(globalThis, '__name', {value: fn => fn, configurable: true});",
  });
  context.on("request", (request) => requests.add(request.url()));
  context.on("response", (response) => {
    if (response.status() >= 400)
      badResponses.push({ url: response.url(), status: response.status() });
  });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.setDefaultTimeout(15_000);
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator('[data-ui="title.play"]').waitFor();
  await step("production title and isolation", async () => {
    const state = await readback(page);
    assert.equal(state.ready, false);
    assert.equal(state.snapshot.lifecycle, "idle");
    const flags = await page.evaluate(() => ({
      isolated: crossOriginIsolated,
      canvas: !!document.querySelector("canvas.cf-world"),
      gallery: !!document.querySelector("[data-gallery-index]"),
      text: document.body.innerText,
    }));
    assert(flags.isolated && flags.canvas && !flags.gallery);
    return {
      flags,
      headers: await response?.allHeaders(),
      image: await capture(page, "01-title"),
      state,
    };
  });
  await step(
    "long leading-zero seed remains an exact draft before Play",
    async () => {
      const field = page.locator('input[data-ui="title.seed"]');
      await field.fill(rawSeedDraft);
      assert.equal(await field.inputValue(), rawSeedDraft);
      const stored = await page.evaluate(() =>
        localStorage.getItem("coldfront.seed"),
      );
      assert.equal(
        stored,
        null,
        "An unplayed draft was persisted as a successful seed",
      );
      return {
        draft: await field.inputValue(),
        stored,
        image: await capture(page, "01b-title-raw-seed"),
      };
    },
  );
  await page.locator('[data-ui="title.play"]').click();
  await page.waitForFunction(
    () => (window as unknown as { __cf?: Readback }).__cf?.ready,
    undefined,
    { timeout: 180_000 },
  );
  await step("Play enters actual world", async () => {
    const state = await readback(page);
    assert.equal(state.snapshot.lifecycle, "ready");
    assert.equal(state.snapshot.seed, 1);
    const stored = await page.evaluate(() =>
      localStorage.getItem("coldfront.seed"),
    );
    assert.equal(
      stored,
      rawSeedDraft,
      "Successful Play lost raw seed digits or leading zeros",
    );
    assert(state.telemetry.loaded > 0);
    const graphics = await page.evaluate(() => {
      const gl = document.querySelector("canvas")?.getContext("webgl2");
      return {
        available: !!gl,
        lost: gl?.isContextLost(),
        isolated: crossOriginIsolated,
      };
    });
    assert(graphics.available && !graphics.lost && graphics.isolated);
    return {
      state,
      storedSeedDraft: stored,
      graphics,
      image: await capture(page, "02-play"),
    };
  });
  await step("real place and break", async () => {
    await page.keyboard.press("Digit3");
    const target = await aim(page, [0.5, 6, -2.5]);
    assert(
      target.telemetry.target && target.telemetry.target.distance <= 5,
      "Reachable real target missing",
    );
    assert(
      target.telemetry.ghost,
      "Legal placement cell missing (visual ghost is not graded here)",
    );
    const p = target.telemetry.ghost;
    await page.mouse.down({ button: "right" });
    await page.waitForTimeout(90);
    await page.mouse.up({ button: "right" });
    await page.waitForFunction(
      () =>
        (window as unknown as { __cf: Readback }).__cf.telemetry.lastEdit
          ?.block === 2,
    );
    const placed = await readback(page);
    await aim(page, [p.x + 0.5, p.y + 0.99, p.z + 0.5]);
    await page.mouse.down({ button: "left" });
    await page.waitForTimeout(90);
    await page.mouse.up({ button: "left" });
    await page.waitForFunction(
      () =>
        (window as unknown as { __cf: Readback }).__cf.telemetry.lastEdit
          ?.block === 0,
    );
    return { target, placed, broken: await readback(page) };
  });
  await step("walking and input release", async () => {
    const before = await readback(page);
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
    await page.waitForTimeout(150);
    const after = await readback(page);
    assert(
      after.telemetry.body.z < before.telemetry.body.z - 0.5,
      "W did not move the real body",
    );
    return { before: before.telemetry.body, after: after.telemetry.body };
  });
  await step("F11 exits to actual windowed fallback", async () => {
    const before = await readback(page);
    if (before.fullscreen) await page.keyboard.press("F11");
    await page.waitForFunction(
      () => !(window as unknown as { __cf: Readback }).__cf.fullscreen,
    );
    const windowed = await readback(page);
    assert.equal(windowed.keyboardLocked, false);
    await page.keyboard.down("ControlLeft");
    await page.waitForTimeout(120);
    const ctrl = await readback(page);
    await page.keyboard.up("ControlLeft");
    assert.equal(ctrl.telemetry.body.sprinting, false);
    assert.equal(
      await page.locator('[data-ui="menu.resume"]').count(),
      0,
      "Intentional F11 exit opened menu",
    );
    return {
      before: { fullscreen: before.fullscreen, lock: before.keyboardLocked },
      windowed: {
        fullscreen: windowed.fullscreen,
        lock: windowed.keyboardLocked,
      },
      ctrlSprinting: ctrl.telemetry.body.sprinting,
    };
  });
  await step("Tools controls use the real port", async () => {
    await page.keyboard.press("F4");
    await page.locator('[data-ui="tools.title"]').waitFor();
    const original = (await readback(page)).snapshot.tools;
    const values: unknown[] = [];
    for (const [id, key] of [
      ["clock", "clockRuns"],
      ["fog", "fog"],
      ["shadows", "shadows"],
      ["borders", "chunkBorders"],
      ["wire", "wireframe"],
      ["fly", "flying"],
    ] as const) {
      await page.locator(`[data-ui="tools.${id}"]`).click();
      await page.waitForTimeout(100);
      const changed = (await readback(page)).snapshot.tools;
      assert.equal(changed[key], !original[key]);
      values.push({ key, value: changed[key] });
      if (id !== "clock") {
        await page.locator(`[data-ui="tools.${id}"]`).click();
        await page.waitForTimeout(80);
      }
    }
    const slider = page.locator('[data-ui="tools.time"]');
    const box = await slider.boundingBox();
    assert(box);
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
    await page.waitForTimeout(100);
    const hours = (await readback(page)).snapshot.tools.timeHours;
    assert(hours > 17 && hours < 19);
    await slider.dblclick();
    await page.waitForTimeout(100);
    assert(
      Math.abs((await readback(page)).snapshot.tools.timeHours - 12) < 0.05,
    );
    await page.keyboard.press("BracketRight");
    assert.equal((await readback(page)).snapshot.tools.flySpeed, 2);
    await page.keyboard.press("BracketLeft");
    assert.equal((await readback(page)).snapshot.tools.flySpeed, 1);
    const beforeWalk = (await readback(page)).telemetry.body;
    await page.keyboard.down("a");
    await page.waitForTimeout(500);
    await page.keyboard.up("a");
    assert(
      (await readback(page)).telemetry.body.x < beforeWalk.x - 0.3,
      "Tools stole movement keys",
    );
    const edits = (await readback(page)).telemetry.editCount;
    await page.locator('[data-ui="tools.clear"]').click();
    await page.locator('[data-ui="confirm.cancel"]').click();
    assert.equal((await readback(page)).telemetry.editCount, edits);
    await page.locator('[data-ui="tools.clock"]').click();
    const image = await capture(page, "03-tools");
    await page.keyboard.press("F4");
    return { values, sliderHours: hours, image };
  });
  await step("real PNG download", async () => {
    const pending = page.waitForEvent("download");
    await page.keyboard.press("F2");
    const download = await pending;
    const path = resolve(output, "player-shot.png");
    await download.saveAs(path);
    const bytes = await readFile(path);
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
    return {
      path,
      bytes: bytes.byteLength,
      suggested: download.suggestedFilename(),
    };
  });
  await step("Menu pauses and Resume preserves the real world", async () => {
    await page.mouse.move(20, 20);
    await page.keyboard.press("Escape");
    await page.locator('[data-ui="menu.resume"]').waitFor();
    const before = await readback(page);
    assert.equal(before.snapshot.worldPaused, true);
    const image = await capture(page, "04-menu");
    await page.waitForTimeout(300);
    const paused = await readback(page);
    assert.equal(
      paused.telemetry.worldTimeSeconds,
      before.telemetry.worldTimeSeconds,
    );
    assert.equal(
      paused.telemetry.displayTimeMs,
      before.telemetry.displayTimeMs,
    );
    await page.locator('[data-ui="menu.resume"]').click();
    await page.waitForTimeout(150);
    const resumed = await readback(page);
    assert.equal(resumed.snapshot.worldPaused, false);
    assert.equal(resumed.snapshot.lifecycle, "ready");
    return { before, paused, resumed, image };
  });
  await step("Quit returns to title and removes the unload guard", async () => {
    await page.mouse.move(20, 20);
    await page.keyboard.press("Escape");
    await page.locator('[data-ui="menu.title"]').click();
    await page.locator('[data-ui="title.play"]').waitFor();
    await page.waitForFunction(
      () =>
        (window as unknown as { __cf: Readback }).__cf.snapshot.lifecycle ===
        "idle",
    );
    const guard = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(guard, false);
    const returnedDraft = await page
      .locator('input[data-ui="title.seed"]')
      .inputValue();
    assert.equal(
      returnedDraft,
      rawSeedDraft,
      "Quit to title replaced the raw draft with the engine seed",
    );
    return {
      guard,
      returnedDraft,
      state: await readback(page),
      image: await capture(page, "05-title-after-quit"),
    };
  });
  await step(
    "raw seed survives reload while the title stays idle",
    async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      const field = page.locator('input[data-ui="title.seed"]');
      await field.waitFor();
      const restored = await field.inputValue();
      assert.equal(restored, rawSeedDraft);
      const state = await readback(page);
      assert.equal(state.ready, false);
      assert.equal(state.snapshot.lifecycle, "idle");
      return {
        restored,
        state,
        image: await capture(page, "06-title-after-reload"),
      };
    },
  );
  await step("production asset and error boundaries", async () => {
    const origin = new URL(url).origin;
    const external = [...requests].filter(
      (request) =>
        /^https?:/.test(request) && new URL(request).origin !== origin,
    );
    const wrongBase = [...requests].filter(
      (request) =>
        /^https?:/.test(request) &&
        new URL(request).origin === origin &&
        !new URL(request).pathname.startsWith("/coldfront/"),
    );
    assert.equal(external.length, 0, JSON.stringify(external));
    assert.equal(wrongBase.length, 0, JSON.stringify(wrongBase));
    assert.equal(badResponses.length, 0, JSON.stringify(badResponses));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    return { requests: requests.size, external, wrongBase, errors, warnings };
  });
  receipt.status = failures ? "failed" : "pass";
} catch (error) {
  receipt.status = "failed";
  failures++;
  errors.push(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
} finally {
  await context?.close();
  receipt.browserClosed = true;
  await server.close();
  receipt.serverClosed = true;
  await save();
  console.log(
    JSON.stringify({
      status: receipt.status,
      output,
      receipt: resolve(output, "receipt.json"),
      failures,
    }),
  );
}
if (failures) process.exitCode = 1;
