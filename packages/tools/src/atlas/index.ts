import { atlasReview } from "../terrain-review/annotate.js";
import { sourceHashes, writeRaster } from "../terrain-review/output.js";
import { createTestWorldSource } from "../terrain-review/source.js";
import { parseAtlas } from "./config.js";
import { renderAtlas } from "./render.js";

const command = parseAtlas(process.argv.slice(2));
if (command.help) {
  console.log(
    "atlas --seed 1 --world test --layer surface --mode height --size 2048\n  --center x,z --span 512 | --bounds minX,minZ,maxX,maxZ\n  --size N|WxH --height-range -8,32 --relief 4 --out image.png\nBounds are half-open; pixels sample their centres. North (-z) is at the top.\nHeight excludes tree canopy. Water comes from actual basin levels.\nPhase 1.1 has no region, feature-mask, site or underground WorldPlan maps.",
  );
} else {
  if (!command.output.toLowerCase().endsWith(".png"))
    throw new Error("Atlas output must be a .png file");
  const start = performance.now(),
    raster = renderAtlas(command.request, createTestWorldSource(command.seed)),
    elapsed = performance.now() - start;
  const sources = await sourceHashes(process.cwd());
  const receipt = await writeRaster(
    process.cwd(),
    command.output,
    raster,
    elapsed,
    sources,
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
  );
  console.log(
    JSON.stringify({
      image: command.output,
      receipt,
      review: reviewPath,
      reviewReceipt,
      samplingMs: elapsed,
      ...raster.metadata.statistics,
    }),
  );
}
