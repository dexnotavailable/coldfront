import { readFile } from "node:fs/promises";
import {
  compareGoldenRecords,
  computeGoldens,
  currentGoldenContract,
  type GoldenFixture,
  goldenCases,
} from "./core.js";
import {
  GOLDEN_PATH,
  goldenSourceProvenance,
  writeGoldenFixture,
} from "./fixture.js";
import { createWorldResolver } from "./worlds.js";

if (process.argv.length > 2)
  throw new Error(
    "golden:update takes no subset flags: always regenerate all seeds and samples",
  );
const worlds = createWorldResolver();
const cases = goldenCases(worlds);
const previous = JSON.parse(
  await readFile(GOLDEN_PATH, "utf8"),
) as GoldenFixture;
const preserved = previous.records.filter(
  (record) => record.sample.world === "test",
);
if (preserved.length !== 150)
  throw new Error("Expected 150 preserved test-world records");
const records = await computeGoldens(
  cases,
  (done, total) => {
    if (done % 25 === 0) console.log(`Golden generation ${done}/${total}`);
  },
  worlds,
);
const regressions = compareGoldenRecords(
  preserved,
  records.filter((record) => record.sample.world === "test"),
);
if (regressions.length > 0)
  throw new Error(
    `Preserved test-world goldens changed:\n${regressions.join("\n")}`,
  );
await writeGoldenFixture(
  {
    ...currentGoldenContract(),
    provenance: goldenSourceProvenance(),
    records,
  },
  GOLDEN_PATH,
  cases,
);
console.log(
  `Wrote ${records.length} actual chunk records to ${GOLDEN_PATH}. Review the diff; bump WORLDGEN_VERSION at most once per PR when output changes.`,
);
