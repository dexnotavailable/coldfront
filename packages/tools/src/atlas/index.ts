import { atlasReview } from "../terrain-review/annotate.js";
import { sourceHashes, writeRaster } from "../terrain-review/output.js";
import { createReviewSource } from "../terrain-review/source.js";
import { parseAtlas } from "./config.js";
import { renderAtlas } from "./render.js";

const command = parseAtlas(process.argv.slice(2));
if (command.help) {
  console.log(
    "atlas --seed 1 --world main|test --layer surface|upper_deep|undercrown|maw|pit --mode height|regions|sites --size 2048\n  --center x,z --span metres | --bounds minX,minZ,maxX,maxZ\n  --size N|WxH --height-range -256,1024 --relief 4 --out image.png\nMain defaults to the full world frame; test defaults to 512m about the origin.\nBounds are half-open; pixels sample their centres. North (-z) is at the top.\nHeight excludes canopy and uses owned water levels. Underground maps are plan footprints.\nSurface sites project all layers; underground sites filter layer membership. Feature masks await phase 1.3.",
  );
} else {
  if (!command.output.toLowerCase().endsWith(".png"))
    throw new Error("Atlas output must be a .png file");
  const prepareStart = performance.now(),
    source = createReviewSource(command.world, command.seed),
    preparationMs = performance.now() - prepareStart;
  const start = performance.now(),
    raster = renderAtlas(command.request, source),
    elapsed = performance.now() - start;
  const sources = await sourceHashes(process.cwd());
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
      ...raster.metadata.statistics,
    }),
  );
}
