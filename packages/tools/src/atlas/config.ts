import {
  parseFlags,
  seedValue,
  tuple,
  value,
  worldValue,
} from "../terrain-review/arguments.js";
import type { AtlasRequest } from "./render.js";
export interface AtlasCommand {
  readonly help: boolean;
  readonly world: "main" | "test";
  readonly seed: number;
  readonly output: string;
  readonly request: AtlasRequest;
}
export function parseAtlas(args: readonly string[]): AtlasCommand {
  const flags = parseFlags(args, [
    "seed",
    "world",
    "layer",
    "mode",
    "size",
    "center",
    "span",
    "bounds",
    "height-range",
    "relief",
    "out",
  ]);
  const world = worldValue(flags),
    mode = value(flags, "mode", "height"),
    layer = value(flags, "layer", "surface");
  if (mode !== "height" && mode !== "regions" && mode !== "sites")
    throw new Error(
      "Mode must be height, regions or sites; feature masks arrive with the phase 1.3 toolkit",
    );
  if (
    layer !== "surface" &&
    layer !== "upper_deep" &&
    layer !== "undercrown" &&
    layer !== "maw" &&
    layer !== "pit"
  )
    throw new Error("Unknown WorldPlan layer");
  if (world === "test" && (mode !== "height" || layer !== "surface"))
    throw new Error("The test world has no region/site WorldPlan");
  if (mode === "height" && layer !== "surface")
    throw new Error(
      "Underground floor heights do not exist in phase 1.2; use regions or sites",
    );
  if (flags.has("bounds") && (flags.has("center") || flags.has("span")))
    throw new Error("Choose --bounds or --center/--span, not both");
  const seed = seedValue(flags),
    shape = value(flags, "size", "2048").toLowerCase().split("x").map(Number);
  if (
    shape.length < 1 ||
    shape.length > 2 ||
    shape.some((v) => !Number.isInteger(v) || v <= 0)
  )
    throw new Error("Size must be N or WxH in pixels");
  const center = tuple(value(flags, "center", "0,0"), 2, "Center"),
    span = Number(value(flags, "span", world === "main" ? "45056" : "512"));
  if (!Number.isFinite(span) || span <= 0)
    throw new Error("Span must be a positive number of metres");
  const b = flags.has("bounds")
    ? tuple(value(flags, "bounds", ""), 4, "Bounds")
    : [
        Number(center[0]) - span / 2,
        Number(center[1]) - span / 2,
        Number(center[0]) + span / 2,
        Number(center[1]) + span / 2,
      ];
  const range = tuple(
    value(flags, "height-range", world === "main" ? "-256,1024" : "-8,32"),
    2,
    "Height range",
  );
  return {
    help: flags.has("help"),
    world,
    seed,
    output: value(
      flags,
      "out",
      `out/atlas/${world}/seed-${seed}/${layer}-${mode}.png`,
    ),
    request: {
      mode,
      layer,
      width: Number(shape[0]),
      height: Number(shape[1] ?? shape[0]),
      bounds: {
        minX: Number(b[0]),
        minZ: Number(b[1]),
        maxX: Number(b[2]),
        maxZ: Number(b[3]),
      },
      heightMin: Number(range[0]),
      heightMax: Number(range[1]),
      relief: Number(value(flags, "relief", "4")),
    },
  };
}
