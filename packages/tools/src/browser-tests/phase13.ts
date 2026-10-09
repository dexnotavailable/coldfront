/** Interactive P8 acceptance, run only after source-bound cameras/build freeze.
 * Mutations go through the shipped controls; the hook is read-only evidence. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { validatePostcardSelection } from "../../../client/src/bootstrap/postcard.js";
import type { GameSnapshot } from "../../../client/src/contracts/game-ui.js";
import type { GameTelemetry } from "../../../client/src/game/create-game.js";
import { generationKey } from "../../../shared/src/world/generation-variant.js";
import { WORLDGEN_VERSION } from "../../../shared/src/worldgen/version.js";
import { sourceFiles, sourceFingerprints } from "../build/metadata.js";
import { browserExecutable, browserTestUrl } from "./browser.js";

interface Hook {
  readonly ready: boolean;
  readonly snapshot: GameSnapshot;
  readonly telemetry: GameTelemetry;
}
const root = process.cwd(),
  base = browserTestUrl(),
  output = resolve(root, `out/phase13/browser-${Date.now()}`);
await mkdir(output, { recursive: true });
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const sourcePaths = [
  "packages/client/src",
  "packages/shared/src",
  "packages/tools/src/postcards",
  "packages/tools/src/browser-tests",
  "packages/tools/postcards/cameras",
].flatMap((path) => sourceFiles(resolve(root, path)));
const sources = await Promise.all(
  sourcePaths.map(async (path) => ({
    path: path.slice(root.length + 1).replaceAll("\\", "/"),
    sha256: hash(await readFile(path)),
  })),
);
const errors: string[] = [],
  external: string[] = [],
  results: unknown[] = [];
let failure: string | null = null,
  browserClosed = false;
const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable(),
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const metadataResponse = await fetch(new URL("version.json", base));
  assert(metadataResponse.ok, "Missing served build metadata");
  const metadata = (await metadataResponse.json()) as {
    cacheTag: string;
    basePath: string;
    commit: string;
    buildId: string;
  };
  const fingerprints = sourceFingerprints(root, metadata.basePath);
  assert.equal(metadata.cacheTag, fingerprints.cacheTag);
  assert.equal(
    metadata.buildId,
    `${metadata.commit}-${fingerprints.releaseHash}`,
    "Stale built source or cameras",
  );
  const cameraResponse = await fetch(
    new URL("postcards/cameras/seed-1.json", base),
  );
  assert(
    cameraResponse.ok,
    "Resolve generation4 HELL cameras before this browser test",
  );
  const cameraDocument = await cameraResponse.json();
  // Each variant has isolated storage and its own actual world/worker context.
  for (const variant of ["production", "primitive"] as const) {
    const selected = validatePostcardSelection(
      cameraDocument,
      "HELL-1",
      1,
      fingerprints.cacheTag,
      variant,
    );
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    await context.route("**/*", (route) => {
      const request = route.request().url();
      if (
        /^https?:/.test(request) &&
        new URL(request).origin !== new URL(base).origin
      ) {
        external.push(request);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const state = () =>
      page.evaluate(() => {
        const hook = (window as unknown as { __cf: Hook }).__cf;
        return {
          ready: hook.ready,
          snapshot: hook.snapshot,
          telemetry: hook.telemetry,
        };
      });
    const url = new URL(base);
    url.searchParams.set("world", "main");
    url.searchParams.set("seed", "1");
    if (variant === "primitive") url.searchParams.set("primitive", "1");
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await page.locator('[data-ui="title.play"]').click();
    await page.waitForFunction(
      () => {
        const hook = (window as unknown as { __cf?: Hook }).__cf;
        return (
          hook?.ready &&
          hook.snapshot.postcards.some((camera) => camera.id === "HELL-2")
        );
      },
      undefined,
      { timeout: 300_000 },
    );
    const loaded = await state();
    assert.equal(
      loaded.snapshot.world?.identity.generation,
      generationKey(WORLDGEN_VERSION, fingerprints.cacheTag, variant),
    );
    const session = loaded.snapshot.world?.id;
    for (const id of ["HELL-1", "HELL-2"] as const) {
      if (!(await page.locator('[data-ui="tools.title"]').isVisible()))
        await page.keyboard.press("F4");
      const presentation = (await state()).snapshot.postcards.find(
        (camera) => camera.id === id,
      );
      assert(presentation, `Missing presentation for ${id}`);
      const expected = selected.cameras.find((camera) => camera.id === id);
      assert(expected);
      await page.locator('[data-ui="tools.postcard"]').click();
      await page
        .getByRole("option", { name: presentation.name, exact: true })
        .click();
      await page.waitForFunction(
        (id) => {
          const hook = (window as unknown as { __cf: Hook }).__cf;
          return (
            hook.ready &&
            hook.snapshot.mode === "postcard" &&
            hook.snapshot.activePostcardId === id
          );
        },
        id,
        { timeout: 300_000 },
      );
      const arrived = await state();
      assert.equal(arrived.snapshot.world?.id, session);
      assert.deepEqual(arrived.telemetry.camera.position, expected.position);
      assert.deepEqual(arrived.telemetry.camera.focus, expected.target);
      assert.equal(
        arrived.telemetry.postcard?.readyChunks,
        arrived.telemetry.postcard?.requestedChunks,
      );
      assert((arrived.telemetry.postcard?.requestedChunks ?? 0) > 0);
      assert.equal(arrived.telemetry.displayTimeMs, 0);
      const modeHashes: string[] = [];
      for (const view of ["normal", "clay", "features"] as const) {
        if (!(await page.locator('[data-ui="tools.title"]').isVisible()))
          await page.keyboard.press("F4");
        await page.locator(`[data-ui="view.${view}"]`).click();
        await page.waitForFunction(
          (view) =>
            (window as unknown as { __cf: Hook }).__cf.snapshot.tools
              .viewMode === view,
          view,
        );
        await page.keyboard.press("F4");
        await page.waitForTimeout(250);
        const proof = await page.evaluate(() => {
          const canvas =
              document.querySelector<HTMLCanvasElement>("canvas.cf-world"),
            gl = canvas?.getContext("webgl2");
          assertBrowser(crossOriginIsolated && !!gl && !gl.isContextLost());
          function assertBrowser(value: boolean) {
            if (!value) throw new Error("Isolation/WebGL2 failure");
          }
          return {
            isolated: crossOriginIsolated,
            contextLost: gl?.isContextLost(),
            width: canvas?.width,
            height: canvas?.height,
          };
        });
        const image = `${id}-${variant}-${view}.png`;
        const bytes = await page
          .locator("canvas.cf-world")
          .screenshot({ path: resolve(output, image) });
        const imageSha256 = hash(bytes);
        modeHashes.push(imageSha256);
        results.push({
          variant,
          id,
          view,
          image,
          imageSha256,
          proof,
          ...(await state()),
        });
      }
      assert.equal(
        new Set(modeHashes).size,
        3,
        "Three requested terrain views produced identical canvas captures",
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          (window as unknown as { __cf: Hook }).__cf.snapshot.mode ===
          "overhead",
      );
      const resumed = await state();
      assert(Math.abs(resumed.telemetry.body.x - expected.position.x) < 0.01);
      assert(Math.abs(resumed.telemetry.body.z - expected.position.z) < 0.01);
      assert(
        Math.abs(resumed.telemetry.body.y - (expected.position.y - 1.62)) < 1,
        "Escape must resume beside the resolved eye",
      );
      assert.equal(resumed.snapshot.world?.id, session);
    }
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal(external.length, 0);
    await context.close();
  }
  for (const source of sources)
    assert.equal(
      hash(await readFile(resolve(root, source.path))),
      source.sha256,
      `Source changed: ${source.path}`,
    );
} catch (error) {
  failure = String(error);
} finally {
  await browser.close();
  browserClosed = true;
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(
      {
        status: failure ? "failed" : "passed",
        failure,
        results,
        errors,
        external,
        sources,
        browserClosed,
        limits: [
          "Canvas differences verify distinct output, not artistic quality",
          "Edited-world travel and primitive cache isolation additionally require focused runtime/worker tests",
        ],
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify({
    output,
    status: failure ? "failed" : "passed",
    captures: results.length,
    browserClosed,
  }),
);
if (failure) throw new Error(failure);
