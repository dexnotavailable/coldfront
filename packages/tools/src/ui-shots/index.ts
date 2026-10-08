import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type BrowserContext, chromium } from "playwright";
import { createServer } from "vite";
import { galleryFixtures } from "../../../client/src/ui/gallery/registry";
import config from "../ui-harness/vite.config";
import { extractCatalogue, root } from "../ui-strings/index";
import { inspectKeys, inspectPage } from "./assertions";
import { inspectInteractions } from "./interactions";
import { prepareFixture } from "./prepare";

const out = resolve(root, "out/ui");
await mkdir(out, { recursive: true });
process.env.TEMP = resolve(out, "temp");
process.env.TMP = process.env.TEMP;
process.env.TMPDIR = process.env.TEMP;
await mkdir(process.env.TEMP, { recursive: true });
const wanted = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]?.split(",")
  : undefined;
const strip = process.argv.includes("--strip")
  ? process.argv[process.argv.indexOf("--strip") + 1]
  : undefined;
const sheet = process.argv.includes("--sheet")
  ? process.argv[process.argv.indexOf("--sheet") + 1]?.split(",")
  : undefined;
const fixtures = galleryFixtures.filter(
  (fixture) =>
    (!wanted || wanted.includes(fixture.id)) &&
    (!strip || fixture.id === strip) &&
    (!sheet || sheet.includes(fixture.id)) &&
    (!process.argv.includes("--screens") || fixture.kind === "screen"),
);
const profiles = [
  { id: "1280", width: 1280, height: 720, scale: 1 },
  { id: "1920", width: 1920, height: 1080, scale: 1 },
  { id: "150", width: 1280, height: 720, scale: 1.5 },
].filter((profile) => !strip || profile.id === "1280");
if (!fixtures.length)
  throw new Error("No registered fixture matched the request");
const receipt: {
  at: string;
  status: string;
  captures: unknown[];
  errors: string[];
  auditProbes: string[];
} = {
  at: new Date().toISOString(),
  status: "running",
  captures: [],
  errors: [],
  auditProbes: [],
};
const server = await createServer({
  ...config,
  configFile: false,
  logLevel: "error",
  server: { ...config.server, port: 0 },
});
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string")
  throw new Error("No loopback address");
const origin = `http://127.0.0.1:${address.port}`;
let context: BrowserContext | undefined;
try {
  const provenWindowsBrowser =
    "D:/Dex/Temp/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe";
  const executablePath =
    process.env.CF_CHROMIUM?.trim() ||
    (existsSync(provenWindowsBrowser) ? provenWindowsBrowser : undefined);
  context = await chromium.launchPersistentContext(resolve(out, "profile"), {
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    chromiumSandbox: true,
    args: ["--enable-unsafe-swiftshader"],
    deviceScaleFactor: 1,
  });
  const page = context.pages()[0]!;
  const rows = extractCatalogue();
  let pageErrors: string[] = [];
  // tsx preserves function names with this helper when serializing audit callbacks.
  // It affects the audit runner only, and does not change any assertion or app state.
  await page.addInitScript(
    "globalThis.__name = (target, name) => Object.defineProperty(target, 'name', {value: name, configurable: true});",
  );
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(origin + "/") && !url.startsWith("data:")) {
      pageErrors.push(`external asset ${url}`);
      await route.abort();
    } else await route.continue();
  });
  for (const fixture of fixtures)
    for (const profile of profiles) {
      pageErrors = [];
      await page.setViewportSize({
        width: profile.width,
        height: profile.height,
      });
      const response = await page.goto(
        `${origin}/?gallery&state=${fixture.id}&scale=${profile.scale}${strip ? "&motion=1" : ""}`,
        { waitUntil: "networkidle" },
      );
      if (
        response?.headers()["cross-origin-opener-policy"] !== "same-origin" ||
        response.headers()["cross-origin-embedder-policy"] !== "require-corp"
      )
        pageErrors.push("Missing isolation headers");
      await page.waitForFunction(() => window.__cfUi?.ready);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(350);
      const prepared = await prepareFixture(page, fixture);
      pageErrors.push(...prepared.errors);
      if (strip) {
        const times =
          fixture.motionCapture?.times ??
          (fixture.id.startsWith("toast")
            ? [0, 50, 100, 2000, 2150, 2300]
            : fixture.id === "hud-name"
              ? [0, 1000, 2000, 2250, 2500]
              : fixture.id === "confirm-clear"
                ? [0, 50, 100, 150]
                : [0, 50, 100, 150, 200]);
        const selector =
          fixture.motionCapture?.selector ??
          (fixture.id.startsWith("tools")
            ? ".cf-tools-frame>.cf-panel"
            : fixture.id === "confirm-clear"
              ? ".cf-modal"
              : fixture.id === "hud-name"
                ? ".cf-held-name"
                : fixture.id.startsWith("toast")
                  ? ".cf-toast"
                  : ".cf-tooltip");
        const clip = await page.locator(selector).evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const x = Math.max(0, Math.floor(rect.x - 24));
          const y = Math.max(0, Math.floor(rect.y - 24));
          return {
            x,
            y,
            width: Math.min(innerWidth - x, Math.ceil(rect.width + 48)),
            height: Math.min(innerHeight - y, Math.ceil(rect.height + 48)),
          };
        });
        const animationEvidence = await page
          .locator(selector)
          .evaluate((element) => ({
            timingFunction: getComputedStyle(element).animationTimingFunction,
            easeOut: getComputedStyle(element).getPropertyValue("--ease-out"),
            animations: element.getAnimations().map((animation) => ({
              timing: animation.effect?.getTiming(),
              keyframes: (animation.effect as KeyframeEffect).getKeyframes(),
            })),
          }));
        const frames: {
          time: number;
          file: string;
          data: string;
          opacity: number;
        }[] = [];
        for (const time of times) {
          await page.evaluate((time) => {
            for (const animation of document.getAnimations()) {
              animation.pause();
              animation.currentTime = time;
            }
          }, time);
          await page.screenshot({
            path: resolve(out, `${fixture.id}-motion-${time}.png`),
            clip,
          });
          const file = resolve(out, `${fixture.id}-motion-${time}.png`);
          const opacity = await page
            .locator(selector)
            .evaluate((element) => Number(getComputedStyle(element).opacity));
          if (selector === ".cf-discovery") {
            if (time === 150 && opacity < 0.9)
              pageErrors.push(
                "Discovery entrance did not use catalogue ease-out",
              );
            if (
              [300, 2300, 4300].includes(time) &&
              Math.abs(opacity - 1) > 0.001
            )
              pageErrors.push("Discovery four-second hold changed");
            if ([0, 4600].includes(time) && opacity > 0.001)
              pageErrors.push("Discovery endpoint is not invisible");
          }
          frames.push({
            time,
            file,
            opacity,
            data: (await readFile(file)).toString("base64"),
          });
        }
        await page.setContent(
          `<style>body{margin:0;background:#11151a;color:#e6eaef;font:14px sans-serif}main{display:flex;gap:8px}figure{margin:0}figcaption{padding:8px}</style><main>${frames.map((frame) => `<figure><figcaption>${frame.time} ms</figcaption><img src="data:image/png;base64,${frame.data}"></figure>`).join("")}</main>`,
        );
        await page.setViewportSize({
          width: Math.ceil((clip.width + 8) * frames.length),
          height: Math.ceil(clip.height + 40),
        });
        await page.screenshot({
          path: resolve(out, `${fixture.id}-strip.png`),
          fullPage: true,
        });
        receipt.captures.push({
          fixture: fixture.id,
          times,
          animationEvidence,
          frames: frames.map(({ time, file, opacity }) => ({
            time,
            file,
            opacity,
          })),
          strip: resolve(out, `${fixture.id}-strip.png`),
        });
        receipt.errors.push(...pageErrors);
        console.log(`${fixture.id}: motion strip captured`);
        continue;
      }
      if (fixture === fixtures[0] && profile === profiles[0]) {
        await page.evaluate(() => {
          const probe = document.createElement("button");
          probe.id = "future-phase-probe";
          probe.dataset.ui = "tools.postcard";
          probe.style.cssText =
            "position:absolute;left:0;top:0;width:32px;height:32px";
          document.querySelector("#gallery-stage")!.append(probe);
        });
        const future = await inspectPage(page, rows, fixture.sampleContent);
        if (!future.errors.includes("unknown/future control tools.postcard"))
          throw new Error(
            "Phase 1.3 control was incorrectly accepted in phase 1.2",
          );
        await page.evaluate(() =>
          document.getElementById("future-phase-probe")!.remove(),
        );
        receipt.auditProbes.push("phase 1.3 control rejected in phase 1.2");
        await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.id = "wrap-policy-probe";
          probe.dataset.textId = "title.play";
          probe.dataset.intentionalWrap = "attempted-exemption";
          probe.textContent = "Play";
          probe.style.cssText =
            "position:absolute;left:0;top:0;width:2px;word-break:break-all";
          document.querySelector("#gallery-stage")!.append(probe);
        });
        const outside = await inspectPage(page, rows, fixture.sampleContent);
        if (!outside.errors.includes("unexpected wrapping: Play"))
          throw new Error("Hostile non-tooltip wrap was incorrectly accepted");
        await page.evaluate(() => {
          const probe = document.getElementById("wrap-policy-probe")!;
          probe.className = "cf-tooltip";
          probe.setAttribute("role", "tooltip");
          probe.dataset.visible = "true";
        });
        const inside = await inspectPage(page, rows, fixture.sampleContent);
        if (inside.errors.includes("unexpected wrapping: Play"))
          throw new Error(
            "Documented tooltip wrapping was incorrectly rejected",
          );
        await page.evaluate(() =>
          document.getElementById("wrap-policy-probe")!.remove(),
        );
        receipt.auditProbes.push(
          "non-tooltip wrapping rejected",
          "tooltip natural wrapping accepted",
        );
        await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.id = "hostile-text-probe";
          probe.textContent = "unauthorised filler";
          document.querySelector("#gallery-stage")!.append(probe);
        });
        const textProbe = await inspectPage(page, rows, fixture.sampleContent);
        if (
          !textProbe.errors.includes("unlisted drawn text: unauthorised filler")
        )
          throw new Error("Unlisted text was incorrectly accepted");
        await page.evaluate(() =>
          document.getElementById("hostile-text-probe")!.remove(),
        );
        receipt.auditProbes.push("unlisted text rejected");
        await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.id = "clipping-probe";
          probe.dataset.textId = "title.play";
          probe.textContent = "Play";
          probe.style.cssText =
            "position:absolute;left:0;top:0;width:2px;overflow:hidden;white-space:nowrap";
          document.querySelector("#gallery-stage")!.append(probe);
        });
        const clippingProbe = await inspectPage(
          page,
          rows,
          fixture.sampleContent,
        );
        if (!clippingProbe.errors.includes("clipped text: Play"))
          throw new Error("Clipped text was incorrectly accepted");
        await page.evaluate(() =>
          document.getElementById("clipping-probe")!.remove(),
        );
        receipt.auditProbes.push("clipped text rejected");
        await page.evaluate(() => {
          const clip = document.createElement("div");
          clip.id = "focus-clipping-probe";
          clip.style.cssText =
            "position:absolute;left:16px;top:16px;width:32px;height:32px;overflow:hidden";
          const button = document.createElement("button");
          button.dataset.ui = "title.play";
          button.dataset.state = "focus";
          button.style.cssText = "display:block;width:32px;height:32px";
          clip.append(button);
          document.querySelector("#gallery-stage")!.append(clip);
        });
        const clippedFocus = await inspectPage(
          page,
          rows,
          fixture.sampleContent,
        );
        if (!clippedFocus.errors.includes("clipped focus outline: title.play"))
          throw new Error("Clipped focus outline was incorrectly accepted");
        await page.evaluate(() => {
          const clip = document.getElementById("focus-clipping-probe")!;
          clip.style.width = "40px";
          clip.style.height = "40px";
          clip.style.padding = "4px";
        });
        const paddedFocus = await inspectPage(
          page,
          rows,
          fixture.sampleContent,
        );
        if (paddedFocus.errors.includes("clipped focus outline: title.play"))
          throw new Error("Contained focus outline was incorrectly rejected");
        await page.evaluate(() =>
          document.getElementById("focus-clipping-probe")!.remove(),
        );
        receipt.auditProbes.push(
          "clipped focus outline rejected",
          "contained focus outline accepted",
        );
      }
      const inspection = await inspectPage(page, rows, fixture.sampleContent);
      if (!inspection.crossOriginIsolated)
        inspection.errors.push("crossOriginIsolated is false");
      const file = resolve(out, `${fixture.id}-${profile.id}.png`);
      await page.screenshot({
        path: file,
        caret: fixture.prepare?.kind === "field-endpoint" ? "initial" : "hide",
      });
      if (fixture.prepare?.kind === "field-endpoint")
        await page.locator(fixture.prepare.selector).screenshot({
          path: resolve(out, `${fixture.id}-${profile.id}-field.png`),
          caret: "initial",
        });
      const scrolls = page.locator(
        fixture.prepare?.kind === "select-open"
          ? '[role="listbox"][data-scroll]'
          : "[data-scroll]",
      );
      if (await scrolls.count()) {
        if (fixture.prepare?.kind === "select-open")
          await page.keyboard.press("End");
        await scrolls.evaluateAll((elements) => {
          for (const element of elements)
            element.scrollTop = element.scrollHeight;
        });
        const after = await inspectPage(page, rows, fixture.sampleContent);
        inspection.errors.push(...after.errors);
        await page.screenshot({
          path: resolve(out, `${fixture.id}-${profile.id}-end.png`),
        });
      }
      const keys = await inspectKeys(page, fixture.closeable ?? false);
      const interactions =
        profile.id === "1280"
          ? await inspectInteractions(page, fixture.id)
          : { checks: [], errors: [] };
      await writeFile(
        resolve(out, `${fixture.id}-${profile.id}.keys.txt`),
        JSON.stringify(keys, null, 2),
      );
      const errors = [
        ...pageErrors,
        ...inspection.errors,
        ...keys.errors,
        ...interactions.errors,
      ];
      receipt.errors.push(
        ...errors.map((error) => `${fixture.id}/${profile.id}: ${error}`),
      );
      receipt.captures.push({
        fixture: fixture.id,
        profile,
        file,
        ...inspection,
        keys,
        preparation: prepared.evidence,
        interactions,
        failures: errors,
      });
      console.log(
        `${fixture.id}/${profile.id}: ${errors.length ? "FAIL" : "pass"}`,
      );
    }
  if (sheet) {
    const tiles = [];
    for (const fixture of fixtures) {
      const file = resolve(out, `${fixture.id}-1280.png`);
      tiles.push({
        id: fixture.id,
        data: (await readFile(file)).toString("base64"),
      });
    }
    await page.setContent(
      `<style>body{margin:0;background:#11151a;color:#e6eaef;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px}</style><main>${tiles.map((tile) => `<figure><figcaption>${tile.id}</figcaption><img src="data:image/png;base64,${tile.data}"></figure>`).join("")}</main>`,
    );
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({
      path: resolve(out, "_sheet-ui.jpg"),
      type: "jpeg",
      quality: 85,
      fullPage: true,
    });
  }
  receipt.status = receipt.errors.length ? "fail" : "pass";
} catch (error) {
  receipt.status = "fail";
  receipt.errors.push(String(error));
} finally {
  await context?.close();
  await server.close();
  await writeFile(
    resolve(out, strip ? `strip-${strip}.json` : "shots.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}
if (receipt.errors.length) {
  console.error(receipt.errors.join("\n"));
  process.exitCode = 1;
}
