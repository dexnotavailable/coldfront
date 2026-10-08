import { computeGoldens, currentGoldenContract, goldenCases } from "./core.js";
import {
  GOLDEN_PATH,
  goldenSourceProvenance,
  writeGoldenFixture,
} from "./fixture.js";

if (process.argv.length > 2)
  throw new Error(
    "golden:update takes no subset flags: always regenerate all seeds and samples",
  );
const records = await computeGoldens(goldenCases(), (done, total) => {
  if (done % 25 === 0) console.log(`Golden generation ${done}/${total}`);
});
await writeGoldenFixture({
  ...currentGoldenContract(),
  provenance: goldenSourceProvenance(),
  records,
});
console.log(
  `Wrote ${records.length} actual chunk records to ${GOLDEN_PATH}. Review the diff; bump WORLDGEN_VERSION at most once per PR when output changes.`,
);
