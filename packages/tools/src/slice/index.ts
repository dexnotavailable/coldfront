import { join } from "node:path";
import { sliceReview } from "../terrain-review/annotate.js";
import { sourceHashes, writeRaster } from "../terrain-review/output.js";
import { createReviewSource } from "../terrain-review/source.js";
import { parseSlice } from "./config.js";
import { renderSection, validateSection } from "./render.js";

const command = parseSlice(process.argv.slice(2));
if (command.help) {
  console.log(
    "slice --seed 1 --world main|test --from -15556,15556 --to 15556,-15556\n  --window x,z (repeatable) --len 2000 --px 1|2 --overlays plan|none\n  --y-min -1536 --y-max 1024 --out out/slices/main/seed-1\nThe overview covers the full line and world height at 16m/px.\nWindows use the overview's bearing through each exact requested centre.\nMain defaults to full-height windows with planned footprint/shelf tints on actual solid rock.\nTest defaults to -64..48m windows without plan tints. No caverns are carved in phase 1.2.",
  );
} else {
  const prepareStart = performance.now(),
    source = createReviewSource(command.world, command.seed),
    preparationMs = performance.now() - prepareStart,
    sources = await sourceHashes(process.cwd());
  const sections = [command.overview, ...command.windows];
  for (const section of sections) validateSection(section, source);
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    if (!section) throw new Error("Missing section");
    const start = performance.now(),
      raster = renderSection(section, source),
      elapsed = performance.now() - start;
    const image = join(
      command.outputDirectory,
      index === 0 ? "overview.png" : `window-${index}.png`,
    );
    const receipt = await writeRaster(
      process.cwd(),
      image,
      raster,
      elapsed,
      sources,
      preparationMs,
    );
    const reviewPath = image.replace(/\.png$/i, "-review.png"),
      reviewStart = performance.now(),
      review = await sliceReview(raster);
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
        image,
        receipt,
        review: reviewPath,
        reviewReceipt,
        width: raster.width,
        height: raster.height,
        samplingMs: elapsed,
        preparationMs,
        materials: raster.metadata.materials.map((m) => ({
          id: m.id,
          name: m.name,
          pixels: m.pixels,
        })),
      }),
    );
  }
}
