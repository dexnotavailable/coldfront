import {
  parseFlags,
  seedValue,
  testWorldOnly,
  tuple,
  value,
} from "../terrain-review/arguments.js";
import type { AtlasRequest } from "./render.js";
export interface AtlasCommand {
  readonly help: boolean;
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
  testWorldOnly(flags);
  if (value(flags, "mode", "height") !== "height")
    throw new Error(
      "Phase 1.1 supports --mode height only; region, feature-mask and site maps need a WorldPlan",
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
    span = Number(value(flags, "span", "512"));
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
  const range = tuple(value(flags, "height-range", "-8,32"), 2, "Height range");
  return {
    help: flags.has("help"),
    seed,
    output: value(flags, "out", `out/atlas/seed-${seed}/surface-height.png`),
    request: {
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
