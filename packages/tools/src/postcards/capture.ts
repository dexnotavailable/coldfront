import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { validatePostcardSelection } from "../../../client/src/bootstrap/postcard.js";
import type { GameSnapshot } from "../../../client/src/contracts/game-ui.js";
import type { GameTelemetry } from "../../../client/src/game/create-game.js";
import type { PostcardId } from "../../../client/src/game/postcard.js";
import { browserExecutable, browserTestUrl } from "../browser-tests/browser.js";
import { sourceFiles, sourceFingerprints } from "../build/metadata.js";
import { postcardOutputStem, preparePostcards } from "./prepare.js";

interface Hook {
  ready: boolean;
  queued: number;
  telemetry: GameTelemetry;
  snapshot: GameSnapshot;
  renderStill(time: number): Promise<string>;
  renderPostcard(id: string): Promise<string>;
}
const prepared = await preparePostcards(),
  base = browserTestUrl(),
  root = process.cwd();
const output = resolve(root, "out/postcards"),
  attempt = resolve(
    output,
    "runs",
    `${postcardOutputStem(prepared.world, prepared.seed, prepared.variant, prepared.view, prepared.sourceHash)}-${Date.now()}`,
  );
await mkdir(attempt, { recursive: true });
const hash = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");
const sourcePaths = [
  ...sourceFiles(resolve(root, "packages/client/src")),
  ...sourceFiles(resolve(root, "packages/shared/src")),
  ...sourceFiles(resolve(root, "packages/tools/src/postcards")),
  prepared.path,
];
const sources = await Promise.all(
  sourcePaths.map(async (path) => ({
    path: path.slice(root.length + 1).replaceAll("\\", "/"),
    sha256: hash(await readFile(path)),
  })),
);
const errors: string[] = [],
  warnings: string[] = [],
  external: string[] = [],
  results: unknown[] = [],
  sheets: unknown[] = [];
let browser: Awaited<
  ReturnType<typeof chromium.launchPersistentContext>
> | null = null;
let failure: unknown,
  build: unknown,
  browserClosed = false;
try {
  const version = await fetch(new URL("version.json", base));
  if (!version.ok) throw new Error("Served build metadata missing");
  const metadata = (await version.json()) as {
    basePath: string;
    cacheTag: string;
    commit: string;
    buildId: string;
  };
  build = metadata;
  const local = sourceFingerprints(root, metadata.basePath);
  if (
    metadata.cacheTag !== prepared.sourceHash ||
    metadata.buildId !== `${metadata.commit}-${local.releaseHash}`
  )
    throw new Error(
      "Served renderer/camera source differs; resolve first, then rebuild or restart the local server",
    );
  const response = await fetch(
    new URL(`postcards/cameras/seed-${prepared.seed}.json`, base),
  );
  if (!response.ok)
    throw new Error(
      "Served camera manifest missing; resolve then rebuild preview",
    );
  const selection = validatePostcardSelection(
    await response.json(),
    prepared.ids[0] as string,
    prepared.seed,
    prepared.sourceHash,
    prepared.variant,
  );
  for (const camera of prepared.cameras)
    assert.deepEqual(
      selection.cameras.find((item) => item.id === camera.id),
      camera,
      "Built camera differs from freshly validated source; rebuild preview",
    );
  browser = await chromium.launchPersistentContext(
    resolve(root, "out/postcards/profile"),
    {
      headless: true,
      executablePath: browserExecutable(),
      args: ["--enable-unsafe-swiftshader"],
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    },
  );
  await browser.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:/.test(url) && new URL(url).origin !== new URL(base).origin) {
      external.push(url);
      return route.abort();
    }
    return route.continue();
  });
  const page = browser.pages()[0] ?? (await browser.newPage());
  const observe = (target: typeof page): void => {
    target.on("pageerror", (error) => errors.push(error.message));
    target.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
      if (message.type() === "warning") warnings.push(message.text());
    });
  };
  observe(page);
  const url = new URL(base);
  url.searchParams.set("postcard", prepared.ids[0] as string);
  url.searchParams.set("seed", String(prepared.seed));
  url.searchParams.set("world", prepared.world);
  url.searchParams.set("view", prepared.view);
  if (prepared.variant === "primitive") url.searchParams.set("primitive", "1");
  const startup = performance.now();
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => (window as unknown as { __cf?: Hook }).__cf?.ready === true,
    undefined,
    { timeout: 180000 },
  );
  let session: number | undefined;
  const captured: { id: PostcardId; region: string; data: string }[] = [];
  for (let index = 0; index < prepared.ids.length; index++) {
    const id = prepared.ids[index] as PostcardId,
      started = index === 0 ? startup : performance.now();
    const receipt = await page.evaluate(
      async ({ id, first }) => {
        const cf = (window as unknown as { __cf: Hook }).__cf;
        const canvas =
          document.querySelector<HTMLCanvasElement>("canvas.cf-world") ??
          document.querySelector("canvas");
        const gl = canvas?.getContext("webgl2");
        if (!canvas || !crossOriginIsolated || !gl || gl.isContextLost())
          throw new Error("Postcard isolation/WebGL2 preflight failed");
        const png = first
          ? await cf.renderStill(0)
          : await cf.renderPostcard(id);
        if (
          !cf.ready ||
          cf.queued !== 0 ||
          cf.snapshot.mode !== "postcard" ||
          gl.isContextLost()
        )
          throw new Error("Postcard is not fully ready after capture");
        const telemetry = cf.telemetry;
        if (
          telemetry.camera.fov !== 70 ||
          telemetry.displayTimeMs !== 0 ||
          telemetry.rendered.outline ||
          telemetry.rendered.ghost ||
          telemetry.rendered.silhouette
        )
          throw new Error("Postcard camera/HUD/frozen-time invariant failed");
        if (
          !telemetry.postcard ||
          telemetry.postcard.id !== id ||
          telemetry.postcard.requestedChunks < 1 ||
          telemetry.postcard.readyChunks !== telemetry.postcard.requestedChunks
        )
          throw new Error("Postcard requested set is incomplete");
        if (canvas.width !== 1280 || canvas.height !== 720)
          throw new Error("Postcard is not1280x720 atDPR1");
        return {
          png,
          telemetry,
          snapshot: cf.snapshot,
          isolated: crossOriginIsolated,
          contextLost: gl.isContextLost(),
          canvas: { width: canvas.width, height: canvas.height },
        };
      },
      { id, first: index === 0 },
    );
    const world = receipt.snapshot.world;
    const expected = prepared.cameras.find((camera) => camera.id === id);
    if (!expected) throw new Error("Missing validated camera");
    assert.deepEqual(
      receipt.telemetry.camera.position,
      expected.position,
      "Renderer did not use the resolved eye",
    );
    assert.deepEqual(
      receipt.telemetry.camera.focus,
      expected.target,
      "Renderer did not use the resolved target",
    );
    assert.equal(
      receipt.telemetry.editCount,
      0,
      "Postcards must show the sampled generation",
    );
    assert.equal(
      receipt.snapshot.tools.viewMode,
      prepared.view,
      "Renderer view selection differs from requested capture",
    );
    assert.deepEqual(
      world?.identity,
      expected.identity,
      "Generation variant/source differs from resolved camera",
    );
    assert.equal(
      receipt.telemetry.rendering.animationRenders,
      0,
      "Automatic postcard page must not run a3D animation loop",
    );
    assert(
      world &&
        world.identity.kind === prepared.world &&
        world.identity.seed === prepared.seed,
    );
    session ??= world.id;
    assert.equal(
      world.id,
      session,
      "All shots must reuse one loaded world session/plan",
    );
    if (index > 0) assert.equal(receipt.telemetry.postcard?.planReused, true);
    if (errors.length || external.length)
      throw new Error(JSON.stringify({ errors, external }));
    const png = Buffer.from(receipt.png.split(",")[1] as string, "base64");
    const dimensions = await sharp(png).metadata();
    assert.equal(dimensions.width, 1280);
    assert.equal(dimensions.height, 720);
    const jpeg = await sharp(png).jpeg({ quality: 85 }).toBuffer();
    const name = postcardOutputStem(
        id,
        prepared.seed,
        prepared.variant,
        prepared.view,
        prepared.sourceHash,
      ),
      image = resolve(output, `${name}.jpg`),
      original = resolve(attempt, `${name}.png`);
    await writeFile(original, png);
    await writeFile(resolve(attempt, `${name}.jpg`), jpeg);
    await writeFile(image, jpeg);
    const best = resolve(output, "_best");
    await mkdir(best, { recursive: true });
    try {
      await writeFile(resolve(best, `${name}.jpg`), jpeg, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    if (process.argv.includes("--commit")) {
      const directory = resolve(root, "docs/postcards/m1");
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, `${name}.jpg`), jpeg);
    }
    const { png: _png, ...proof } = receipt;
    const record = {
      id,
      seed: prepared.seed,
      phase: prepared.phase,
      variant: prepared.variant,
      view: prepared.view,
      ungraded: prepared.world === "main",
      camera: prepared.definitions.find((item) => item.id === id),
      durationMs: performance.now() - started,
      ...proof,
      image,
      imageSha256: hash(jpeg),
      sourcePng: original,
      sourcePngSha256: hash(png),
      encoding: {
        encoder: "sharp",
        encoderVersion: sharp.versions.sharp,
        format: "jpeg",
        quality: 85,
        width: 1280,
        height: 720,
        resized: false,
      },
      build,
      sourceHash: prepared.sourceHash,
      sources,
      errors: [...errors],
      warnings: [...warnings],
      external: [...external],
      resolutionReceipt: prepared.receipt,
      status: "captured",
    };
    await writeFile(
      resolve(attempt, `${name}.receipt.json`),
      JSON.stringify(record, null, 2),
    );
    await writeFile(
      resolve(output, `${name}.receipt.json`),
      JSON.stringify(record, null, 2),
    );
    results.push(record);
    captured.push({
      id,
      region:
        prepared.definitions.flatMap((item) =>
          item.id === id && "region" in item ? [item.region] : [],
        )[0] ?? "test",
      data: receipt.png,
    });
    console.log(
      JSON.stringify({
        id,
        image,
        milliseconds: record.durationMs,
        requestedChunks: receipt.telemetry.postcard?.requestedChunks,
      }),
    );
  }
  const groups = new Map<string, typeof captured>();
  for (const shot of captured)
    groups.set(shot.region, [...(groups.get(shot.region) ?? []), shot]);
  if (captured.length > 1)
    groups.set(`phase${prepared.phase.replace(".", "")}`, captured);
  const sheet = await browser.newPage();
  observe(sheet);
  try {
    for (const [region, shots] of groups) {
      const columns = Math.ceil(Math.sqrt(shots.length)),
        rows = Math.ceil(shots.length / columns),
        started = performance.now();
      await sheet.setContent(
        `<!doctype html><html><meta charset="utf-8"><style>html,body{margin:0;width:1280px;height:720px;background:#11151a}body{display:grid;grid-template-columns:repeat(${columns},1fr);grid-template-rows:repeat(${rows},1fr)}img{display:block;width:100%;height:100%;object-fit:contain}</style><body>${shots.map(() => '<img alt="">').join("")}</body></html>`,
      );
      await sheet.locator("img").evaluateAll(
        async (elements, sources) => {
          await Promise.all(
            elements.map(async (element, index) => {
              const image = element as HTMLImageElement;
              image.src = sources[index] as string;
              await image.decode();
            }),
          );
        },
        shots.map((shot) => shot.data),
      );
      const jpeg = await sheet.screenshot({ type: "jpeg", quality: 85 });
      if (errors.length || external.length)
        throw new Error(JSON.stringify({ errors, external }));
      const name = `${postcardOutputStem(`_sheet-${region}`, prepared.seed, prepared.variant, prepared.view, prepared.sourceHash)}.jpg`;
      await writeFile(resolve(output, name), jpeg);
      await writeFile(resolve(attempt, name), jpeg);
      if (process.argv.includes("--commit"))
        await writeFile(resolve(root, "docs/postcards/m1", name), jpeg);
      sheets.push({
        region,
        phase: prepared.phase,
        variant: prepared.variant,
        view: prepared.view,
        sourceHash: prepared.sourceHash,
        image: resolve(output, name),
        imageSha256: hash(jpeg),
        ids: shots.map((shot) => shot.id),
        width: 1280,
        height: 720,
        quality: 85,
        durationMs: performance.now() - started,
      });
    }
  } finally {
    await sheet.close();
  }
  for (const result of results) {
    const record = result as { id: PostcardId; contactSheet?: unknown };
    const region = captured.find((item) => item.id === record.id)?.region;
    record.contactSheet = sheets.find(
      (value) => (value as { region: string }).region === region,
    );
    const name = `${postcardOutputStem(record.id, prepared.seed, prepared.variant, prepared.view, prepared.sourceHash)}.receipt.json`;
    await writeFile(resolve(attempt, name), JSON.stringify(record, null, 2));
    await writeFile(resolve(output, name), JSON.stringify(record, null, 2));
  }
  for (const source of sources)
    if (hash(await readFile(resolve(root, source.path))) !== source.sha256)
      throw new Error(`Source changed during postcard run: ${source.path}`);
} catch (error) {
  failure = String(error);
} finally {
  if (browser) {
    await browser.close();
    browserClosed = true;
  }
  await writeFile(
    resolve(attempt, "run.json"),
    JSON.stringify(
      {
        status: failure ? "failed" : "passed",
        failure: failure ?? null,
        world: prepared.world,
        phase: prepared.phase,
        variant: prepared.variant,
        view: prepared.view,
        sourceHash: prepared.sourceHash,
        seed: prepared.seed,
        ids: prepared.ids,
        results,
        sheets,
        build,
        sources,
        errors,
        warnings,
        external,
        browserClosed,
        resolutionReceipt: prepared.receipt,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify({
    run: resolve(attempt, "run.json"),
    status: failure ? "failed" : "passed",
    images: results.length,
    browserClosed,
  }),
);
if (failure) throw new Error(String(failure));
