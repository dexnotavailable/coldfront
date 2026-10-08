import { join } from "node:path";
import { sliceReview } from "../terrain-review/annotate.js";
import { sourceHashes, writeRaster } from "../terrain-review/output.js";
import { createTestWorldSource } from "../terrain-review/source.js";
import { parseSlice } from "./config.js";
import { renderSection, validateSection } from "./render.js";

const command = parseSlice(process.argv.slice(2));
if (command.help) {
  console.log(
    "slice --seed 1 --world test --from -15556,15556 --to 15556,-15556\n  --window x,z (repeatable) --len 2000 --px 1|2\n  --y-min -64 --y-max 48 --out out/slices/seed-1\nThe overview always covers the full requested line and world height at16m/px.\nWindows use the overview's bearing through each exact requested centre.\nWindow y bounds default to the test-world surface band; no caves or WorldPlan bands are invented.",
  );
} else {
  const source = createTestWorldSource(command.seed),
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
        materials: raster.metadata.materials.map((m) => ({
          id: m.id,
          name: m.name,
          pixels: m.pixels,
        })),
      }),
    );
  }
}
