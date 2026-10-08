import {
  WORLD_MAX_Y,
  WORLD_MIN_Y,
} from "../../../shared/src/world/constants.js";
import {
  finiteNumber,
  parseFlags,
  seedValue,
  tuple,
  value,
  worldValue,
} from "../terrain-review/arguments.js";
import {
  type SectionRequest,
  sectionLength,
  windowSection,
  type XZ,
} from "./render.js";
export interface SliceCommand {
  readonly help: boolean;
  readonly world: "main" | "test";
  readonly seed: number;
  readonly outputDirectory: string;
  readonly overview: SectionRequest;
  readonly windows: readonly SectionRequest[];
}
function point(text: string, name: string): XZ {
  const p = tuple(text, 2, name);
  return [Number(p[0]), Number(p[1])];
}
export function parseSlice(args: readonly string[]): SliceCommand {
  const flags = parseFlags(
    args,
    [
      "seed",
      "world",
      "layer",
      "overlays",
      "from",
      "to",
      "window",
      "len",
      "px",
      "y-min",
      "y-max",
      "out",
    ],
    ["window"],
  );
  const world = worldValue(flags),
    overlays = value(flags, "overlays", world === "main" ? "plan" : "none");
  if (overlays !== "plan" && overlays !== "none")
    throw new Error("Overlays must be plan or none");
  if (world === "test" && overlays === "plan")
    throw new Error("The test world has no WorldPlan bands");
  if (flags.has("layer"))
    throw new Error(
      "Slices span all depth layers; use --overlays plan|none and --y-min/--y-max",
    );
  const seed = seedValue(flags),
    from = point(value(flags, "from", "-15556,15556"), "From"),
    to = point(value(flags, "to", "15556,-15556"), "To");
  const overview: SectionRequest = {
    kind: "overview",
    from,
    to,
    yMin: WORLD_MIN_Y,
    yMax: WORLD_MAX_Y,
    metresPerPixel: 16,
    overlays,
  };
  const pixels = finiteNumber(value(flags, "px", "1"), "Window pixel size");
  if (pixels !== 1 && pixels !== 2)
    throw new Error("Window --px must be 1 or 2 metres per pixel");
  const length = finiteNumber(
    value(flags, "len", String(Math.min(2000, sectionLength(overview)))),
    "Window length",
  );
  const yMin = finiteNumber(
      value(flags, "y-min", world === "main" ? String(WORLD_MIN_Y) : "-64"),
      "Window y-min",
    ),
    yMax = finiteNumber(
      value(flags, "y-max", world === "main" ? String(WORLD_MAX_Y) : "48"),
      "Window y-max",
    );
  const centres = flags
    .get("window")
    ?.map((v) => point(v, "Window centre")) ?? [
    [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] as XZ,
  ];
  return {
    help: flags.has("help"),
    world,
    seed,
    outputDirectory: value(flags, "out", `out/slices/${world}/seed-${seed}`),
    overview,
    windows: centres.map((centre) =>
      windowSection(overview, centre, length, pixels, yMin, yMax),
    ),
  };
}
