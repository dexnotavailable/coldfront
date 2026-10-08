import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import type { PostcardCamera } from "../postcards/resolve.js";
import { browserExecutable, browserTestUrl } from "./browser.js";

const camera = JSON.parse(
  await readFile("packages/tools/postcards/cameras/seed-1.json", "utf8"),
) as PostcardCamera;
const output = resolve("out/engine/lighting");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  }),
  errors: string[] = [],
  warnings: string[] = [],
  means: number[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
try {
  for (const [name, hours] of [
    ["noon", 12],
    ["night", 0],
  ] as const) {
    const url = new URL(browserTestUrl());
    url.searchParams.set("seed", "1");
    url.searchParams.set("postcard", "TEST-1");
    url.searchParams.set("camera", JSON.stringify({ ...camera, hours }));
    await page.goto(url.href);
    await page.waitForFunction(
      () => (window as unknown as { __cf?: { ready: boolean } }).__cf?.ready,
      undefined,
      { timeout: 180000 },
    );
    const png = await page.evaluate(() =>
      (
        window as unknown as {
          __cf: { renderStill(t: number): Promise<string> };
        }
      ).__cf.renderStill(0),
    );
    const bytes = Buffer.from(png.split(",")[1] as string, "base64");
    await writeFile(resolve(output, `${name}.png`), bytes);
    const pixels = await sharp(bytes)
      .extract({ left: 0, top: 300, width: 1280, height: 420 })
      .removeAlpha()
      .raw()
      .toBuffer();
    let total = 0;
    const linear = (v: number) =>
      v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4;
    for (let i = 0; i < pixels.length; i += 3)
      total +=
        0.2126 * linear(pixels[i] as number) +
        0.7152 * linear(pixels[i + 1] as number) +
        0.0722 * linear(pixels[i + 2] as number);
    means.push(total / (pixels.length / 3));
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(
      {
        linearLuminanceMeans: means,
        ratio: (means[1] as number) / (means[0] as number),
        errors,
        warnings,
        sample: "lower420px includes pond and terrain; fixed exposure",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      status: "pass",
      ratio: (means[1] as number) / (means[0] as number),
    }),
  );
} finally {
  await browser.close();
}
