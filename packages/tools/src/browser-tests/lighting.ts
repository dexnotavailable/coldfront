import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import type { PostcardCamera } from "../postcards/resolve.js";
import { browserExecutable, browserTestUrl } from "./browser.js";

async function legacyLighting(): Promise<void> {
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
        v / 255 <= 0.04045
          ? v / 255 / 12.92
          : ((v / 255 + 0.055) / 1.055) ** 2.4;
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
}

/** Development-server fixture using the real renderer, mesher and RGB flood.
 * This intentionally generates no WorldPlan and starts no terrain workers.
 * Run only with the coordinator's serialized heavy-work grant. */
async function ibaraLighting(): Promise<void> {
  const outputIndex = process.argv.indexOf("--output");
  const output = resolve(
      outputIndex >= 0
        ? (process.argv[outputIndex + 1] ?? "out/p6-renderer/browser")
        : "out/p6-renderer/browser",
    ),
    root = resolve(".").replaceAll("\\", "/"),
    browser = await chromium.launch({
      headless: true,
      executablePath: browserExecutable(),
      args: ["--enable-unsafe-swiftshader"],
    });
  await mkdir(output, { recursive: true });
  // Resolve bare Three.js through Vite exactly as the engine does. Importing a
  // second raw build would create a different class graph from its prebundle.
  await writeFile(
    resolve(output, "three-fixture.ts"),
    'export * from "three";\n',
  );
  const page = await browser.newPage({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 1,
    }),
    errors: string[] = [],
    warnings: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  const url = new URL("/__p6-fixture__", browserTestUrl());
  await page.route(url.href, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body style="margin:0"><canvas style="display:block;width:960px;height:540px"></canvas></body></html>',
    }),
  );
  try {
    await page.goto(url.href);
    // tsx preserves function names using this helper inside serialized callback
    // bodies. Keep that harmless transform available in the isolated fixture.
    await page.addScriptTag({
      content:
        "globalThis.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });",
    });
    const receipt = await page.evaluate(
      async ({ root, threeFixture }) => {
        const source = (path: string) => `/@fs/${root}/${path}`;
        const engine = (await import(
            source("packages/client/src/engine/renderer.ts")
          )) as typeof import("../../../client/src/engine/renderer.js"),
          materials = (await import(
            source("packages/client/src/engine/terrain-material.ts")
          )) as typeof import("../../../client/src/engine/terrain-material.js"),
          meshing = (await import(
            source("packages/shared/src/meshing/greedy.ts")
          )) as typeof import("../../../shared/src/meshing/greedy.js"),
          blocksModule = (await import(
            source("packages/shared/src/blocks/registry.ts")
          )) as typeof import("../../../shared/src/blocks/registry.js"),
          lighting = (await import(
            source("packages/shared/src/lighting/flood.ts")
          )) as typeof import("../../../shared/src/lighting/flood.js"),
          coordinates = (await import(
            source("packages/shared/src/world/coordinates.ts")
          )) as typeof import("../../../shared/src/world/coordinates.js"),
          controller = (await import(
            source("packages/client/src/game/controller.ts")
          )) as typeof import("../../../client/src/game/controller.js"),
          three = (await import(threeFixture)) as typeof import("three");
        const canvas = document.querySelector("canvas");
        if (!canvas) throw new Error("Fixture canvas missing");
        const renderer = new engine.WorldRenderer(canvas, {
            ink: 0x101820,
            steel: 0x8fb3d9,
            cap: 0x25292b,
          }),
          { Block, BLOCK_REGISTRY } = blocksModule,
          volume = lighting.createLightVolume(34, 41, 34),
          blocks = new Uint16Array(volume.light.length),
          core = new Uint16Array(32768),
          featureIds = new Uint32Array(volume.light.length),
          world = {
            id: 1,
            identity: {
              kind: "test" as const,
              seed: 1,
              generation: "p6-render-fixture",
            },
          },
          body = controller.makeBody(16, 6, 26),
          tools = {
            timeHours: 12,
            viewMode: "normal" as const,
            clockRuns: false,
            fog: false,
            shadows: true,
            chunkBorders: false,
            wireframe: false,
            flying: true,
            flySpeed: 1 as const,
          };
        const checks: Record<string, unknown> = {},
          images: { name: string; png: string }[] = [],
          origin = { x: 0, y: 0, z: 0 };
        let display = 0,
          mode: "normal" | "clay" | "features" = "normal",
          cut = Infinity;
        const put = (
          x: number,
          y: number,
          z: number,
          block: number,
          id = 0,
        ) => {
          const i = coordinates.haloIndex(x, y, z);
          blocks[i] = block;
          core[coordinates.voxelIndex(x, y, z)] = block;
          featureIds[i] = id;
        };
        const box = (
          x0: number,
          y0: number,
          z0: number,
          x1: number,
          y1: number,
          z1: number,
          block: number,
          id = 0,
        ) => {
          for (let y = y0; y < y1; y++)
            for (let z = z0; z < z1; z++)
              for (let x = x0; x < x1; x++) put(x, y, z, block, id);
        };
        const build = (
          sources: boolean,
          rgb = 0,
          waterDepth = 1,
          isolatedEmitter?: number,
        ) => {
          blocks.fill(0);
          core.fill(0);
          featureIds.fill(0);
          volume.opacity.fill(0);
          volume.light.fill(0);
          volume.sources.fill(0);
          box(1, 0, 1, 31, 1, 31, Block.Stone);
          if (isolatedEmitter !== undefined) {
            box(12, 1, 12, 20, 7, 20, isolatedEmitter, 0x02000003);
          } else {
            box(3, 1, 8, 8, 6, 11, Block.Obsidian, 0x80000001);
            box(10, 1, 8, 15, 6, 11, Block.Basalt, 0x80000002);
            box(17, 1, 8, 22, 6, 11, Block.BrimstoneCrust, 0xffffffff);
            box(
              24,
              1,
              8,
              29,
              6,
              11,
              sources ? Block.EmberCrust : Block.Snow,
              0x00000001,
            );
            box(
              3,
              1,
              14,
              11,
              2,
              20,
              sources ? Block.Lava : Block.Obsidian,
              0x02000001,
            );
            box(
              14,
              1,
              16,
              17,
              3,
              19,
              sources ? Block.VentMouth : Block.Basalt,
              0x02000002,
            );
            box(20, 1, 15, 29, 1 + waterDepth, 23, Block.Water);
            // Three coloured spill probes illuminate ordinary limestone, with the
            // source air cells intentionally invisible. No registry changes.
            box(3, 1, 24, 29, 2, 28, Block.Limestone);
          }
          const seeds: number[] = [];
          for (let i = 0; i < blocks.length; i++) {
            const block = BLOCK_REGISTRY[blocks[i] as number];
            if (!block) continue;
            volume.opacity[i] = block.lightFiltering;
            if (block.emissionStrength > 0) {
              volume.sources[i] = lighting.emissionLight(block.emission);
              seeds.push(i);
            }
          }
          if (rgb) {
            const i = coordinates.haloIndex(16, 3, 25);
            volume.sources[i] = rgb;
            seeds.push(i);
          }
          volume.light.set(volume.sources);
          for (const shift of [8, 4, 0])
            lighting.floodLight(volume, seeds, shift);
          for (let i = 0; i < volume.light.length; i++)
            volume.light[i] =
              (volume.light[i] as number) |
              (isolatedEmitter === undefined ? 0xf000 : 0);
          renderer.upload({
            type: "chunk",
            world,
            id: 1,
            address: { cx: origin.x / 32, cy: 0, cz: origin.z / 32 },
            revision: 0,
            blocks: core,
            light: volume.light,
            mesh: meshing.meshChunk(blocks, volume.light, featureIds),
            regionColor: [90, 88, 84],
            timings: { generate: 0, light: 0, mesh: 0 },
            cacheBytes: 0,
          });
        };
        const update = () => {
          renderer.setViewMode(mode);
          renderer.update(
            body,
            body,
            1,
            display,
            cut,
            tools,
            null,
            null,
            Block.Stone,
            false,
          );
          // Fixture keeps the authored sky out of HDR terrain measurements.
          const sky = renderer.scene.children.find(
            (o) => o.constructor.name === "Sky",
          );
          if (sky) sky.visible = false;
          renderer.avatar.group.visible = renderer.avatar.depth.visible = false;
          renderer.render();
        };
        const capture = (name: string) => {
          update();
          images.push({ name, png: canvas.toDataURL("image/png") });
        };
        const hdr = () => {
          const target = new three.WebGLRenderTarget(
              canvas.width,
              canvas.height,
              {
                type: three.HalfFloatType,
              },
            ),
            pixels = new Uint16Array(canvas.width * canvas.height * 4),
            old = renderer.renderer.getRenderTarget();
          try {
            renderer.renderer.setRenderTarget(target);
            renderer.renderer.render(renderer.scene, renderer.camera);
            renderer.renderer.readRenderTargetPixels(
              target,
              0,
              0,
              canvas.width,
              canvas.height,
              pixels,
            );
            let peak = 0,
              componentPeak = 0,
              above = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              const r = three.DataUtils.fromHalfFloat(pixels[i] as number),
                g = three.DataUtils.fromHalfFloat(pixels[i + 1] as number),
                b = three.DataUtils.fromHalfFloat(pixels[i + 2] as number),
                luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              peak = Math.max(peak, luma);
              componentPeak = Math.max(componentPeak, r, g, b);
              if (luma > materials.TERRAIN_BLOOM_THRESHOLD) above++;
            }
            return { peak, componentPeak, above };
          } finally {
            renderer.renderer.setRenderTarget(old);
            target.dispose();
          }
        };
        try {
          renderer.setWorld(1);
          renderer.setHud(false);
          renderer.setPostcard(true);
          renderer.setView({ x: 35, y: 24, z: 40 }, { x: 16, y: 2, z: 16 });
          build(false);
          update();
          renderer.compile();
          capture("source-only-noon");
          checks.noSourceHdr = hdr();
          build(true);
          capture("normal");
          checks.sourceHdr = hdr();
          checks.waterDepthReady = (
            renderer as unknown as {
              terrain: { uniforms: { waterDepthReady: { value: number } } };
            }
          ).terrain.uniforms.waterDepthReady.value;
          mode = "clay";
          capture("clay");
          checks.clayHdr = hdr();
          mode = "features";
          capture("features-high-ids");
          checks.featuresHdr = hdr();
          mode = "normal";
          tools.timeHours = 0;
          build(false);
          capture("rgb-baseline");
          for (const [name, rgb] of [
            ["red", 0xf00],
            ["green", 0x0f0],
            ["blue", 0x00f],
          ] as const) {
            build(false, rgb);
            capture(`rgb-${name}`);
            checks[`rgb-${name}-hdr`] = hdr();
          }
          tools.timeHours = 12;
          build(true);
          display = 0;
          capture("lava-flame-0");
          display = 4000;
          capture("lava-flame-4000");
          capture("postcard-repeat");
          checks.postcard = renderer.ibaraEffects.statistics;
          renderer.setPostcard(false);
          renderer.setView({ x: 35, y: 24, z: 40 }, { x: 16, y: 2, z: 16 });
          display = 700;
          capture("embers-700");
          display = 1700;
          capture("embers-1700");
          capture("embers-paused");
          checks.play = renderer.ibaraEffects.statistics;
          renderer.setView(
            { x: 22, y: 7, z: 27 },
            { x: 15.5, y: 3.6, z: 17.5 },
          );
          display = 0;
          capture("vent-flame-0");
          display = 700;
          capture("vent-flame-700");
          display = 1700;
          capture("vent-flame-1700");
          capture("vent-paused");
          renderer.ibaraEffects.flames.visible = false;
          renderer.render();
          images.push({
            name: "vent-no-flame",
            png: canvas.toDataURL("image/png"),
          });
          renderer.ibaraEffects.flames.visible = true;
          renderer.ibaraEffects.embers.visible = false;
          renderer.render();
          images.push({
            name: "vent-no-embers",
            png: canvas.toDataURL("image/png"),
          });
          renderer.setPostcard(true);
          renderer.setView({ x: 35, y: 24, z: 40 }, { x: 16, y: 2, z: 16 });
          display = 0;
          build(true, 0, 1);
          capture("water-shallow");
          build(true, 0, 5);
          capture("water-deep");
          cut = 4;
          capture("cut");
          cut = Infinity;
          renderer.removeWorld(1);
          origin.x = -12800;
          origin.z = 12800;
          body.x += origin.x;
          body.z += origin.z;
          renderer.setView(
            { x: 35 + origin.x, y: 24, z: 40 + origin.z },
            { x: 16 + origin.x, y: 2, z: 16 + origin.z },
          );
          build(true, 0, 1);
          mode = "features";
          capture("features-rebased");
          checks.glError = renderer.renderer.getContext().getError();
          checks.stats = renderer.statistics;
          checks.effects = renderer.ibaraEffects.statistics;
          renderer.removeWorld(1);
          origin.x = origin.z = 0;
          body.x = 16;
          body.z = 26;
          mode = "normal";
          display = 0;
          tools.timeHours = 0;
          renderer.setView({ x: 29, y: 18, z: 32 }, { x: 16, y: 3, z: 16 });
          const projected = [];
          for (const x of [12, 20])
            for (const y of [1, 7])
              for (const z of [12, 20]) {
                const p = new three.Vector3(x, y, z).project(renderer.camera);
                projected.push({
                  x: ((p.x + 1) * canvas.width) / 2,
                  y: ((1 - p.y) * canvas.height) / 2,
                });
              }
          checks.emitterBounds = {
            left: Math.floor(Math.min(...projected.map((p) => p.x))),
            right: Math.ceil(Math.max(...projected.map((p) => p.x))),
            top: Math.floor(Math.min(...projected.map((p) => p.y))),
            bottom: Math.ceil(Math.max(...projected.map((p) => p.y))),
          };
          const isolated: Record<string, unknown> = {};
          for (const [name, block] of [
            ["ember", Block.EmberCrust],
            ["lava", Block.Lava],
            ["vent", Block.VentMouth],
          ] as const) {
            build(true, 0, 1, block);
            update();
            // Measure each terrain emitter alone: no decorative flame or embers
            // can make a weak block appear to satisfy the bloom requirement.
            renderer.ibaraEffects.flames.visible =
              renderer.ibaraEffects.embers.visible = false;
            renderer.render();
            images.push({
              name: `isolated-${name}-bloom`,
              png: canvas.toDataURL("image/png"),
            });
            isolated[name] = hdr();
            const bloom = (
              renderer as unknown as { bloom: { intensity: number } }
            ).bloom;
            bloom.intensity = 0;
            renderer.render();
            images.push({
              name: `isolated-${name}-no-bloom`,
              png: canvas.toDataURL("image/png"),
            });
            bloom.intensity = 0.2;
          }
          checks.isolatedEmitters = isolated;
          const gl = renderer.renderer.getContext(),
            info = gl.getExtension("WEBGL_debug_renderer_info");
          checks.glInfo = {
            version: gl.getParameter(gl.VERSION),
            renderer: info
              ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
              : gl.getParameter(gl.RENDERER),
          };
          checks.glError = gl.getError();
          return { checks, images };
        } finally {
          renderer.dispose();
        }
      },
      {
        root,
        threeFixture: `/@fs/${output.replaceAll("\\", "/")}/three-fixture.ts`,
      },
    );
    for (const image of receipt.images)
      await writeFile(
        resolve(output, `${image.name}.png`),
        Buffer.from(image.png.split(",")[1] as string, "base64"),
      );
    const strips = [
      ["lava-flame-0", "lava-flame-4000", "postcard-repeat"],
      ["embers-700", "embers-1700", "embers-paused"],
      ["vent-flame-0", "vent-flame-700", "vent-flame-1700"],
    ] as const;
    for (const [i, names] of strips.entries())
      await sharp({
        create: {
          width: 960 * 3,
          height: 540,
          channels: 3,
          background: "#000",
        },
      })
        .composite(
          await Promise.all(
            names.map(async (name, j) => ({
              input: await readFile(resolve(output, `${name}.png`)),
              left: j * 960,
              top: 0,
            })),
          ),
        )
        .png()
        .toFile(resolve(output, `motion-strip-${i}.png`));
    await writeFile(
      resolve(output, "receipt.json"),
      JSON.stringify(
        {
          scope:
            "Synthetic renderer fixtures; not generated-world or HELL acceptance",
          checks: receipt.checks,
          images: receipt.images.map((i) => `${i.name}.png`),
          errors,
          warnings,
        },
        null,
        2,
      ),
    );
    const emitterBounds = receipt.checks.emitterBounds as {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    const isolated = receipt.checks.isolatedEmitters as Record<
      string,
      { peak: number; componentPeak: number; above: number }
    >;
    const emitterProof: Record<string, unknown> = {};
    for (const name of ["ember", "lava", "vent"]) {
      const on = await sharp(resolve(output, `isolated-${name}-bloom.png`))
          .removeAlpha()
          .raw()
          .toBuffer(),
        off = await sharp(resolve(output, `isolated-${name}-no-bloom.png`))
          .removeAlpha()
          .raw()
          .toBuffer();
      let haloPixels = 0,
        haloPeakDelta = 0,
        changedPixels = 0;
      for (let pixel = 0; pixel < 960 * 540; pixel++) {
        const i = pixel * 3,
          x = pixel % 960,
          y = Math.floor(pixel / 960),
          delta =
            0.2126 * ((on[i] as number) - (off[i] as number)) +
            0.7152 * ((on[i + 1] as number) - (off[i + 1] as number)) +
            0.0722 * ((on[i + 2] as number) - (off[i + 2] as number));
        if (delta >= 1) changedPixels++;
        if (
          (x < emitterBounds.left - 2 ||
            x > emitterBounds.right + 2 ||
            y < emitterBounds.top - 2 ||
            y > emitterBounds.bottom + 2) &&
          x > emitterBounds.left - 24 &&
          x < emitterBounds.right + 24 &&
          y > emitterBounds.top - 24 &&
          y < emitterBounds.bottom + 24
        ) {
          haloPeakDelta = Math.max(haloPeakDelta, delta);
          if (delta >= 1) haloPixels++;
        }
      }
      emitterProof[name] = {
        ...isolated[name],
        changedPixels,
        haloPixels,
        haloPeakDelta,
      };
    }
    await writeFile(
      resolve(output, "per-emitter-bloom.json"),
      JSON.stringify(
        {
          scope:
            "Each registry terrain emitter alone, no sky light or decorative flame/embers; bloom-on/off at identical time/camera",
          emitterBounds,
          emitters: emitterProof,
        },
        null,
        2,
      ),
    );
    assert.equal(errors.length, 0, JSON.stringify(errors));
    for (const name of ["ember", "lava", "vent"]) {
      const emitter = emitterProof[name] as {
        above: number;
        peak: number;
        haloPixels: number;
      };
      assert.ok(
        emitter.peak > 2 && emitter.above > 0,
        `${name} alone never crosses bloom luminance threshold2`,
      );
      assert.ok(
        emitter.haloPixels >= 16,
        `${name} alone has no visible bloom beyond its source silhouette`,
      );
    }
    const checks = receipt.checks as {
      noSourceHdr: { above: number; peak: number; componentPeak: number };
      sourceHdr: { above: number };
      clayHdr: { above: number };
      featuresHdr: { above: number };
      glError: number;
      waterDepthReady: number;
    };
    assert.equal(
      checks.noSourceHdr.above,
      0,
      "non-source pixels crossed bloom threshold",
    );
    assert.ok(
      checks.noSourceHdr.componentPeak <= 1.501,
      "ordinary reflected HDR exceeds its explicit1.5 ceiling",
    );
    const mean = async (name: string) => {
      const pixels = await sharp(resolve(output, `${name}.png`))
        .removeAlpha()
        .raw()
        .toBuffer();
      const sums = [0, 0, 0];
      for (let i = 0; i < pixels.length; i++) {
        const v = (pixels[i] as number) / 255;
        sums[i % 3] =
          (sums[i % 3] as number) +
          (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      }
      return sums.map((v) => v / (pixels.length / 3));
    };
    const baseline = await mean("rgb-baseline"),
      deltas: Record<string, number[]> = {};
    for (const [channel, name] of ["red", "green", "blue"].entries()) {
      const light = receipt.checks[`rgb-${name}-hdr`] as {
        peak: number;
        componentPeak: number;
        above: number;
      };
      assert.equal(
        light.above,
        0,
        `${name} spill on non-emissive terrain bloomed`,
      );
      assert.ok(
        light.componentPeak <= 1.501,
        `${name} spill crossed the reflected ceiling`,
      );
      const delta = (await mean(`rgb-${name}`)).map(
        (v, i) => v - (baseline[i] as number),
      );
      deltas[name] = delta;
      assert.ok(
        (delta[channel] as number) > 0.00001,
        `${name} illumination missing on ordinary faces`,
      );
      assert.ok(
        (delta[channel] as number) >
          Math.max(...delta.filter((_, i) => i !== channel)),
        `${name} illumination lost its channel identity`,
      );
    }
    await writeFile(
      resolve(output, "rgb-deltas.json"),
      JSON.stringify({ baseline, deltas }, null, 2),
    );
    assert.ok(checks.sourceHdr.above > 0, "HDR sources missing");
    assert.equal(checks.clayHdr.above, 0);
    assert.equal(checks.featuresHdr.above, 0);
    assert.equal(checks.glError, 0);
    assert.equal(checks.waterDepthReady, 1);
    assert.deepEqual(
      await readFile(resolve(output, "lava-flame-4000.png")),
      await readFile(resolve(output, "postcard-repeat.png")),
      "postcard display-time repeat changed pixels",
    );
    assert.deepEqual(
      await readFile(resolve(output, "embers-1700.png")),
      await readFile(resolve(output, "embers-paused.png")),
      "paused display-time repeat changed pixels",
    );
    assert.deepEqual(
      await readFile(resolve(output, "vent-flame-1700.png")),
      await readFile(resolve(output, "vent-paused.png")),
      "close flame pause changed pixels",
    );
    assert.notDeepEqual(
      await readFile(resolve(output, "vent-flame-1700.png")),
      await readFile(resolve(output, "vent-no-flame.png")),
      "flame contributes no visible pixels",
    );
    assert.notDeepEqual(
      await readFile(resolve(output, "vent-flame-1700.png")),
      await readFile(resolve(output, "vent-no-embers.png")),
      "embers contribute no visible pixels",
    );
    assert.deepEqual(
      await readFile(resolve(output, "features-high-ids.png")),
      await readFile(resolve(output, "features-rebased.png")),
      "feature colours or geometry changed after origin rebase",
    );
    console.log(
      JSON.stringify({
        status: "pass",
        scope: "renderer fixture pixels still require opening",
        output,
      }),
    );
  } finally {
    await browser.close();
  }
}

if (process.argv.includes("--ibara-fixtures")) await ibaraLighting();
else await legacyLighting();
