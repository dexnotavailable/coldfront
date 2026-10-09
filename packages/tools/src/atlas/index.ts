import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { atlasReview } from "../terrain-review/annotate.js";
import { sourceHashes, writeRaster } from "../terrain-review/output.js";
import { createReviewSource } from "../terrain-review/source.js";
import { parseAtlas } from "./config.js";
import { renderAtlas } from "./render.js";

/** Existing source manifest plus the coverage helper imported by feature maps. */
export async function atlasSourceHashes(root: string) {
  const sources = await sourceHashes(root);
  const path = "packages/tools/src/terrain-report/ibara.ts";
  const entries = [
    ...sources,
    {
      path,
      sha256: createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex"),
    },
  ];
  return [
    ...new Map(entries.map((entry) => [entry.path, entry])).values(),
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
export async function runAtlas(args: readonly string[]): Promise<void> {
  const command = parseAtlas(args);
  if (command.help) {
    console.log(
      "atlas --seed 1 --world main|test --layer surface|upper_deep|undercrown|maw|pit --mode height|regions|sites|features --size 2048\n  --center x,z --span metres | --bounds minX,minZ,maxX,maxZ\n  --size N|WxH --height-range -256,1024 --relief 4 --out image.png\nMain defaults to the full world frame; test defaults to 512m about the origin.\nBounds are half-open; pixels sample their centres. North (-z) is at the top.\nHeight excludes canopy and uses owned water levels. Underground maps are plan footprints.\nSurface sites project all layers; underground sites filter layer membership. Surface features samples production Ibara mask density and reports achieved coverage in the requested domain.",
    );
  } else {
    if (!command.output.toLowerCase().endsWith(".png"))
      throw new Error("Atlas output must be a .png file");
    const sources = await atlasSourceHashes(process.cwd());
    const prepareStart = performance.now(),
      source = createReviewSource(command.world, command.seed),
      preparationMs = performance.now() - prepareStart;
    const start = performance.now(),
      raster = renderAtlas(command.request, source),
      elapsed = performance.now() - start;
    if (
      JSON.stringify(await atlasSourceHashes(process.cwd())) !==
      JSON.stringify(sources)
    )
      throw new Error("Source changed during atlas sampling; receipt invalid");
    const receipt = await writeRaster(
      process.cwd(),
      command.output,
      raster,
      elapsed,
      sources,
      preparationMs,
    );
    const reviewPath = command.output.replace(/\.png$/i, "-review.png"),
      reviewStart = performance.now(),
      review = await atlasReview(raster);
    const reviewReceipt = await writeRaster(
      process.cwd(),
      reviewPath,
      review,
      performance.now() - reviewStart,
      sources,
      preparationMs,
    );
    console.log(
      JSON.stringify({
        image: command.output,
        receipt,
        review: reviewPath,
        reviewReceipt,
        samplingMs: elapsed,
        preparationMs,
        regions: raster.metadata.regions,
        sites: raster.metadata.sites,
        features: raster.metadata.features,
        ...raster.metadata.statistics,
      }),
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await runAtlas(process.argv.slice(2));
