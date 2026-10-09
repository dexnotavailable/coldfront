import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { createServer } from "vite";
import { sourceFiles } from "../build/metadata.js";
import { browserExecutable } from "./browser.js";

interface ProbeState {
  telemetry: {
    queued: number;
    camera: { position: { x: number; y: number; z: number }; fov: number };
  };
  snapshot: {
    lifecycle: string;
    mode: string;
    world: { identity: { kind: string } } | null;
    debug: { queues: { generate: number; light: number; mesh: number } } | null;
  };
}
interface ProbeApi {
  state(): ProbeState;
  capture(): Promise<string>;
  restore(): Promise<void>;
}
const index = process.argv.indexOf("--canonical-root");
if (index < 0 || !process.argv[index + 1])
  throw new Error("Explicit canonical source root is required");
const canonical = resolve(process.argv[index + 1] as string);
const output = resolve(`out/phase12-engine/sky-canonical-${Date.now()}`);
await mkdir(output, { recursive: true });
const digest = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest("hex");
const sourcePaths = [
  "packages/client/src/engine",
  "packages/client/src/game",
  "packages/shared/src",
].flatMap((path) => sourceFiles(resolve(canonical, path)));
const sources = await Promise.all(
  sourcePaths.map(async (path) => ({
    path: path.slice(canonical.length + 1).replaceAll("\\", "/"),
    sha256: digest(await readFile(path)),
  })),
);
const rendererHash = sources.find(
  (source) => source.path === "packages/client/src/engine/renderer.ts",
)?.sha256;
const expectedAt = process.argv.indexOf("--expected-renderer-sha");
if (expectedAt >= 0)
  assert.equal(
    rendererHash,
    process.argv[expectedAt + 1],
    "Canonical renderer preimage changed",
  );
const view = {
  position: { x: 18000, y: 60, z: 17000 },
  target: { x: 18000, y: 12, z: 16900 },
  hours: 17.25,
  radius: 128,
};
const html = `<!doctype html><html><meta charset="utf-8"><body style="margin:0"><canvas style="display:block;width:100vw;height:100vh"></canvas><script type="module">
import { createGameHandle } from '/src/game/create-game.ts';
const metadata=await (await fetch('/version.json')).json();
const canvas=document.querySelector('canvas');
const game=createGameHandle(canvas,{colors:{ink:'#11151a',steel:'#8fb3d9',cap:'#11151a'},keyboardLocked:()=>false,onWindowedSprint:()=>{},build:{version:metadata.version,commit:metadata.commit},cacheTag:metadata.cacheTag,postcard:${JSON.stringify(view)}});
const png=async()=>{const blob=await game.renderStill(0);return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});};
window.__skyProbe={state:()=>({telemetry:game.telemetry(),snapshot:game.port.read()}),capture:png,restore:async()=>{game.port.apply({type:'postcard',active:false});await game.ready();},dispose:()=>game.port.dispose()};
game.port.apply({type:'input-scope',scope:'world'});game.port.apply({type:'start',seed:1,worldKind:'test'});
</script></body></html>`;
const server = await createServer({
  root: resolve(canonical, "packages/client"),
  configFile: resolve(canonical, "packages/client/vite.config.ts"),
  base: "/",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  plugins: [
    {
      name: "private-canonical-sky-probe",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url?.split("?")[0] !== "/__sky_probe.html") return next();
          response.setHeader("Content-Type", "text/html");
          response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          response.end(
            await server.transformIndexHtml("/__sky_probe.html", html),
          );
        });
      },
    },
  ],
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null,
  failure: unknown;
const errors: string[] = [],
  warnings: string[] = [],
  results: unknown[] = [];
try {
  await server.listen();
  const base = server.resolvedUrls?.local[0];
  if (!base) throw new Error("No private probe URL");
  assert.equal(
    resolve(server.config.root),
    resolve(canonical, "packages/client"),
  );
  console.log(
    JSON.stringify({
      pid: process.pid,
      canonical,
      rendererHash,
      url: new URL("__sky_probe.html", base).href,
    }),
  );
  browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutable(),
    args: ["--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto(new URL("__sky_probe.html", base).href, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => {
      const state = (
        window as unknown as { __skyProbe?: ProbeApi }
      ).__skyProbe?.state();
      return state && ["ready", "failed"].includes(state.snapshot.lifecycle);
    },
    undefined,
    { timeout: 180000 },
  );
  const capture = async (name: string) => {
    const result = await page.evaluate(async () => {
      const probe = (window as unknown as { __skyProbe: ProbeApi }).__skyProbe;
      const canvas = document.querySelector("canvas");
      const gl = canvas?.getContext("webgl2");
      if (!crossOriginIsolated || !gl || gl.isContextLost())
        throw new Error("Sky probe WebGL/isolation failed");
      const png = await probe.capture();
      return {
        ...probe.state(),
        png,
        isolated: crossOriginIsolated,
        contextLost: gl.isContextLost(),
      };
    });
    const png = Buffer.from(
      String(result.png).split(",")[1] as string,
      "base64",
    );
    const jpeg = await sharp(png).jpeg({ quality: 85 }).toBuffer();
    await writeFile(resolve(output, `${name}.png`), png);
    await writeFile(resolve(output, `${name}.jpg`), jpeg);
    const { png: _png, ...data } = result;
    const record = { name, ...data, imageSha256: digest(jpeg) };
    results.push(record);
    await writeFile(
      resolve(output, `${name}.json`),
      JSON.stringify(record, null, 2),
    );
    return data;
  };
  const distant = await capture("distant-test-sky");
  assert.equal(distant.snapshot.world?.identity.kind, "test");
  assert.deepEqual(distant.telemetry.camera.position, view.position);
  assert.equal(distant.telemetry.camera.fov, 70);
  await page.evaluate(() =>
    (window as unknown as { __skyProbe: ProbeApi }).__skyProbe.restore(),
  );
  // Existing canonical streaming begins on the first physics tick. Observe the
  // restore request, then require both workers and upload queue to drain.
  await page.waitForFunction(
    () =>
      (window as unknown as { __skyProbe: ProbeApi }).__skyProbe.state()
        .telemetry.queued > 0,
    undefined,
    { timeout: 10000 },
  );
  await page.waitForFunction(
    () => {
      const state = (
        window as unknown as { __skyProbe: ProbeApi }
      ).__skyProbe.state();
      const queues = state.snapshot.debug?.queues;
      return (
        state.telemetry.queued === 0 &&
        queues &&
        queues.generate + queues.light + queues.mesh === 0
      );
    },
    undefined,
    { timeout: 180000 },
  );
  const restored = await capture("restored-overhead");
  assert.equal(restored.snapshot.mode, "overhead");
  assert.equal(restored.telemetry.camera.fov, 40);
  assert(
    Math.abs(restored.telemetry.camera.position.x) < 100 &&
      Math.abs(restored.telemetry.camera.position.z) < 100,
  );
  if (errors.length) throw new Error(errors.join("\n"));
  for (const source of sources)
    assert.equal(
      digest(await readFile(resolve(canonical, source.path))),
      source.sha256,
      `Canonical source drift: ${source.path}`,
    );
} catch (error) {
  failure = String(error);
} finally {
  await browser?.close();
  await server.close();
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(
      {
        status: failure ? "failed" : "passed",
        failure: failure ?? null,
        canonical,
        rendererHash,
        fixture: {
          world: "test",
          camera: view,
          api: "existing canonical createGameHandle/GamePort only",
        },
        results,
        sources,
        errors,
        warnings,
        browserClosed: true,
        serverClosed: true,
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
    failure: failure ?? null,
  }),
);
if (failure) throw new Error(String(failure));
