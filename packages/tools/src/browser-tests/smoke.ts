import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { browserExecutable, browserTestUrl } from "./browser.js";

const output = resolve("out/engine");
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
  warnings: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
  if (message.type() === "warning") warnings.push(message.text());
});
try {
  await page.goto(browserTestUrl(), {
    waitUntil: "domcontentloaded",
  });
  const play = page.locator('[data-ui="title.play"]');
  if (await play.isVisible()) await play.click();
  await page.waitForFunction(
    () => (window as unknown as { __cf?: { ready: boolean } }).__cf?.ready,
    undefined,
    { timeout: 180000 },
  );
  const before = await page.evaluate(
    () =>
      (window as unknown as { __cf: { telemetry: unknown } }).__cf.telemetry,
  );
  const proof = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("Missing canvas");
    const gl = canvas.getContext("webgl2");
    if (!crossOriginIsolated || !gl || gl.isContextLost())
      throw new Error("Isolation/WebGL2 preflight failed");
    return {
      isolated: crossOriginIsolated,
      contextLost: gl.isContextLost(),
      png: canvas.toDataURL("image/png"),
    };
  });
  await writeFile(
    resolve(output, "first-view.png"),
    Buffer.from(proof.png.split(",")[1] as string, "base64"),
  );
  const receipt = {
    before,
    proof: { isolated: proof.isolated, contextLost: proof.contextLost },
    errors,
    warnings,
  };
  await writeFile(
    resolve(output, "smoke.json"),
    JSON.stringify(receipt, null, 2),
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
  console.log(
    JSON.stringify({
      image: resolve(output, "first-view.png"),
      receipt: resolve(output, "smoke.json"),
      errors: errors.length,
      warnings: warnings.length,
    }),
  );
} catch (error) {
  await writeFile(
    resolve(output, "smoke-failure.json"),
    JSON.stringify({ errors, warnings, failure: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
