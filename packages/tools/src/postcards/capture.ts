import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { browserExecutable, browserTestUrl } from "../browser-tests/browser.js";
import { resolveTestCamera } from "./resolve.js";

const args = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i < 0 ? fallback : (args[i + 1] ?? fallback);
}
const seed = Number(flag("--seed", "1")),
  only = flag("--only", "TEST-1");
if (only !== "TEST-1") throw new Error("Only TEST-1 exists in phase 1.1");
const base = browserTestUrl(),
  root = process.cwd();
const camera = await resolveTestCamera(seed, root);
const output = resolve(root, "out/postcards");
await mkdir(output, { recursive: true });
const executablePath = browserExecutable();
const browser = await chromium.launchPersistentContext(
  resolve(root, "out/postcards/profile"),
  {
    headless: true,
    executablePath,
    args: ["--enable-unsafe-swiftshader"],
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
);
const page = await browser.newPage(),
  errors: string[] = [],
  warnings: string[] = [],
  external: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
  if (message.type() === "warning") warnings.push(message.text());
});
page.on("request", (request) => {
  const url = request.url();
  if (/^https?:/.test(url) && new URL(url).origin !== new URL(base).origin)
    external.push(url);
});
try {
  const url = new URL(base);
  url.searchParams.set("postcard", "TEST-1");
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("camera", JSON.stringify(camera));
  const started = performance.now();
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      (window as unknown as { __cf?: { ready: boolean } }).__cf?.ready === true,
    undefined,
    { timeout: 180000 },
  );
  const receipt = await page.evaluate(async () => {
    const cf = (
      window as unknown as {
        __cf: {
          ready: boolean;
          queued: number;
          renderStill(time: number): Promise<string>;
          telemetry: unknown;
        };
      }
    ).__cf;
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("World canvas missing");
    const gl = canvas.getContext("webgl2");
    if (!crossOriginIsolated || !gl || gl.isContextLost())
      throw new Error("Postcard preflight failed");
    if (cf.queued !== 0)
      throw new Error("Ready before all requested meshes completed");
    const png = await cf.renderStill(0);
    return {
      png,
      isolated: crossOriginIsolated,
      contextLost: gl.isContextLost(),
      telemetry: cf.telemetry,
    };
  });
  if (errors.length || external.length)
    throw new Error(JSON.stringify({ errors, external }));
  const png = Buffer.from(receipt.png.split(",")[1] as string, "base64"),
    path = resolve(output, `TEST-1-s${seed}.jpg`);
  await sharp(png).jpeg({ quality: 85 }).toFile(path);
  if (args.includes("--commit")) {
    const committed = resolve(root, "docs/postcards/m1");
    await mkdir(committed, { recursive: true });
    await sharp(png)
      .jpeg({ quality: 85 })
      .toFile(resolve(committed, `TEST-1-s${seed}.jpg`));
  }
  await writeFile(
    resolve(output, `TEST-1-s${seed}.receipt.json`),
    JSON.stringify(
      {
        seed,
        camera,
        durationMs: performance.now() - started,
        isolated: receipt.isolated,
        contextLost: receipt.contextLost,
        telemetry: receipt.telemetry,
        errors,
        warnings,
        external,
        screenshot: path,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ image: path, warnings, errors }));
} finally {
  await browser.close();
}
