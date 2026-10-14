import { Region } from "../../../shared/src/world/regions.js";
import type { RegionWeights } from "../../../shared/src/world/types.js";
import {
  accumulateCoverage,
  type CoverageAccumulator,
  coverageSummary,
} from "../terrain-report/ibara.js";
import type { Raster } from "../terrain-review/output.js";
import type { TerrainReviewSource } from "../terrain-review/source.js";
import { ATLAS_REGIONS, SITE_LEGEND } from "./palette.js";
import type { AtlasMetadata, AtlasRequest } from "./render.js";

/** Plan-only maps never substitute drainage elevations for rendered terrain. */
export function renderPlanAtlas(
  request: AtlasRequest,
  source: TerrainReviewSource,
): Raster<AtlasMetadata> {
  const plan = source.plan;
  if (!plan) throw new Error("A main WorldPlan is required");
  const { width, height, bounds } = request,
    layer = request.layer ?? "surface",
    mode = request.mode ?? "regions";
  const dx = (bounds.maxX - bounds.minX) / width,
    dz = (bounds.maxZ - bounds.minZ) / height,
    area = (dx * dz) / 1e6;
  const rgba = new Uint8Array(width * height * 4),
    dominant = new Float64Array(33),
    weighted = new Float64Array(33);
  const weights: RegionWeights = {
    count: 0,
    ids: new Uint8Array(3),
    weights: new Float64Array(3),
  };
  let coreAreaKm2 = 0,
    weightedAreaKm2 = 0;
  const coverage: CoverageAccumulator = {
    samples: 0,
    weight: 0,
    thornWeight: 0,
    denseWeight: 0,
    dominantSamples: 0,
    dominantThorns: 0,
    dominantDense: 0,
  };
  const featureMask = { weight: 0, thorn: 0 };
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      const x = bounds.minX + (col + 0.5) * dx,
        z = bounds.minZ + (row + 0.5) * dz;
      const mask = layer === "surface" ? 1 : plan.footprint(layer, x, z);
      if (layer === "surface") plan.surfaceWeights(x, z, weights);
      else plan.layerWeights(layer, x, z, weights);
      if (mask >= 0.5) {
        coreAreaKm2 += area;
        if (weights.count) {
          const id = Number(weights.ids[0]);
          dominant[id] = Number(dominant[id]) + area;
        }
      }
      weightedAreaKm2 += mask * area;
      const color = [0, 0, 0];
      for (let k = 0; k < weights.count; k++) {
        const id = Number(weights.ids[k]),
          weight = Number(weights.weights[k]),
          entry = ATLAS_REGIONS[id];
        if (!entry || !Number.isFinite(weight) || weight < 0)
          throw new Error("Invalid plan region weights");
        weighted[id] = Number(weighted[id]) + weight * mask * area;
        for (let c = 0; c < 3; c++)
          color[c] = Number(color[c]) + Number(entry.rgb[c]) * weight;
      }
      const i = (row * width + col) * 4,
        dim = mode === "sites" ? 0.52 : 1;
      for (let c = 0; c < 3; c++)
        rgba[i + c] = Math.round(
          (Number(color[c]) * mask + 18 * (1 - mask)) * dim,
        );
      rgba[i + 3] = 255;
      if (mode === "features") {
        if (!source.writeFeatureMasks)
          throw new Error("Production feature mask adapter unavailable");
        source.writeFeatureMasks(x, z, featureMask);
        accumulateCoverage(
          coverage,
          featureMask.weight,
          featureMask.thorn,
          weights.ids[0] === Region.Hellscape,
        );
        // Density heatmap of the actual production mask; dark outside Ibara.
        rgba[i] = Math.round(18 + 220 * featureMask.thorn);
        rgba[i + 1] = Math.round(22 + 120 * featureMask.thorn);
        rgba[i + 2] = Math.round(28 + 20 * featureMask.weight);
      }
    }
  const counts: { kind: string; total: number; visible: number }[] = [];
  function pixel(x: number, z: number, rgb: readonly number[]): void {
    if (x < 0 || z < 0 || x >= width || z >= height) return;
    const i = (z * width + x) * 4;
    for (let c = 0; c < 3; c++) rgba[i + c] = Number(rgb[c]);
  }
  const visible = (x: number, z: number) =>
    x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ;
  function marker(x: number, z: number, kind: number): void {
    const cx = Math.floor((x - bounds.minX) / dx),
      cy = Math.floor((z - bounds.minZ) / dz),
      rgb = SITE_LEGEND[kind]?.rgb ?? [255, 255, 255];
    for (let y = -4; y <= 4; y++)
      for (let x = -4; x <= 4; x++) {
        const mark =
          kind === 0
            ? Math.max(Math.abs(x), Math.abs(y)) === 3
            : kind === 1
              ? Math.abs(x) + Math.abs(y) === 3
              : kind === 2
                ? (x === 0 || y === 0) && Math.abs(x + y) <= 3
                : x * x + y * y <= 2;
        if (mark) pixel(cx + x, cy + y, rgb);
        else if (
          kind < 3 &&
          Math.max(Math.abs(x), Math.abs(y)) <= 4 &&
          (x === 0 || y === 0)
        )
          pixel(cx + x, cy + y, [10, 13, 18]);
      }
  }
  if (mode === "sites") {
    // Surface map is the full census projection; deep maps filter membership.
    const site = plan.sites;
    if (layer === "surface") {
      let bridgeVisible = 0;
      for (const bridge of site.bridges) {
        let arc = 0,
          seen = false;
        for (let i = 0; i + 3 < bridge.centreline.length; i += 2) {
          const ax = Number(bridge.centreline[i]),
            az = Number(bridge.centreline[i + 1]),
            bx = Number(bridge.centreline[i + 2]),
            bz = Number(bridge.centreline[i + 3]);
          const length = Math.hypot(bx - ax, bz - az);
          let low = 0,
            high = 1;
          for (const [start, delta, min, max] of [
            [ax, bx - ax, bounds.minX, bounds.maxX],
            [az, bz - az, bounds.minZ, bounds.maxZ],
          ]) {
            if (delta === 0) {
              if (Number(start) < Number(min) || Number(start) >= Number(max))
                high = -1;
            } else {
              const a = (Number(min) - Number(start)) / Number(delta),
                b = (Number(max) - Number(start)) / Number(delta);
              low = Math.max(low, Math.min(a, b));
              high = Math.min(high, Math.max(a, b));
            }
          }
          if (low > high) {
            arc += length;
            continue;
          }
          const steps = Math.max(
            1,
            Math.ceil(((length * (high - low)) / Math.min(dx, dz)) * 2),
          );
          for (let j = 0; j <= steps; j++) {
            const t = low + ((high - low) * j) / steps,
              x = ax + (bx - ax) * t,
              z = az + (bz - az) * t,
              s = arc + t * length;
            if (!visible(x, z)) continue;
            seen = true;
            let gap = false;
            for (let g = 0; g < bridge.gaps.length; g += 2)
              if (
                s >= Number(bridge.gaps[g]) &&
                s <= Number(bridge.gaps[g + 1])
              )
                gap = true;
            const rgb = SITE_LEGEND[gap ? 5 : 4].rgb;
            pixel(
              Math.floor((x - bounds.minX) / dx),
              Math.floor((z - bounds.minZ) / dz),
              rgb,
            );
          }
          arc += length;
        }
        if (seen) bridgeVisible++;
      }
      counts.push({
        kind: "bridges",
        total: site.bridges.length,
        visible: bridgeVisible,
      });
    }
    const groups = [
      {
        kind: "spawns",
        symbol: 3,
        items: layer === "surface" ? site.spawns : [],
      },
      {
        kind: "forts",
        symbol: 1,
        items: site.forts.filter(
          (s) => layer === "surface" || s.layer === layer,
        ),
      },
      {
        kind: "descents",
        symbol: 2,
        items: site.descents.filter(
          (s) =>
            layer === "surface" || s.fromLayer === layer || s.toLayer === layer,
        ),
      },
      {
        kind: "seats",
        symbol: 0,
        items: site.seats.filter(
          (s) => layer === "surface" || s.layer === layer,
        ),
      },
    ];
    for (const group of groups) {
      let n = 0;
      for (const s of group.items)
        if (visible(s.x, s.z)) {
          marker(s.x, s.z, group.symbol);
          n++;
        }
      counts.push({ kind: group.kind, total: group.items.length, visible: n });
    }
  }
  const regions = ATLAS_REGIONS.flatMap((r, i) =>
    Number(weighted[i]) > 0
      ? [
          {
            id: r.id,
            dominantAreaKm2: Number(dominant[i]),
            weightedAreaKm2: Number(weighted[i]),
          },
        ]
      : [],
  );
  const typeCounts = new Map<
    string,
    { type: string; total: number; visible: number }
  >();
  for (const descent of plan.sites.descents) {
    if (
      layer !== "surface" &&
      descent.fromLayer !== layer &&
      descent.toLayer !== layer
    )
      continue;
    const entry = typeCounts.get(descent.type) ?? {
      type: descent.type,
      total: 0,
      visible: 0,
    };
    entry.total++;
    if (visible(descent.x, descent.z)) entry.visible++;
    typeCounts.set(descent.type, entry);
  }
  const descentTypes = [...typeCounts.values()].sort((a, b) =>
    a.type < b.type ? -1 : a.type > b.type ? 1 : 0,
  );
  let minimumRadius = Infinity,
    minimumSeatDistance = Infinity;
  if (layer === "surface")
    for (const spawn of plan.sites.spawns) {
      minimumRadius = Math.min(minimumRadius, Math.hypot(spawn.x, spawn.z));
      for (const seat of plan.sites.seats)
        minimumSeatDistance = Math.min(
          minimumSeatDistance,
          Math.hypot(spawn.x - seat.x, spawn.z - seat.z),
        );
    }
  const countLabel = (kind: string) => {
    const c = counts.find((c) => c.kind === kind);
    return c ? `${c.visible}/${c.total}` : "0/0";
  };
  const coveragePercent = (fraction: number | null) =>
    fraction === null ? "n/a" : `${(100 * fraction).toFixed(2)}%`;
  return {
    width,
    height,
    rgba,
    metadata: {
      world: source.world,
      seed: source.seed,
      worldgenVersion: source.version,
      layer,
      mode,
      bounds,
      metresPerPixel: { x: dx, z: dz },
      orientation: "north (-z) at top; east (+x) at right",
      sampleConvention:
        mode === "features"
          ? "pixel centres; half-open requested bounds; production Ibara mask density, not projected voxel occupancy; coverage percentages describe this requested raster domain"
          : "pixel centres; half-open bounds; region RGB blends top-three weights; underground footprint alpha is a plan overlay, not cavern air",
      shading: { verticalExaggeration: 0, lightDirection: [], ambient: 1 },
      heightRamp: [],
      statistics: {
        minHeight: null,
        maxHeight: null,
        meanHeight: null,
        waterPixels: null,
        waterShare: null,
        dryBelowDatumPixels: null,
        rampClippedLow: null,
        rampClippedHigh: null,
      },
      regions,
      ...(mode === "features"
        ? {
            features: {
              region: "hellscape" as const,
              ...coverageSummary(coverage),
            },
          }
        : {}),
      footprint: { coreAreaKm2, weightedAreaKm2, threshold: 0.5 },
      legend:
        mode === "features"
          ? [
              {
                name: `hellscape thorn ${coveragePercent(coverageSummary(coverage).weighted.thorn)} weighted (${coverage.weight ? "sampled" : "no region samples"})`,
                rgb: [238, 142, 48],
              },
              {
                name: `hellscape dense ${coveragePercent(coverageSummary(coverage).weighted.dense)} weighted`,
                rgb: [158, 98, 43],
              },
              {
                name: "mask density 0 to 1; targets approximately 45% / 20%",
                rgb: [18, 22, 28],
              },
            ]
          : mode === "sites"
            ? [
                ...SITE_LEGEND.map((entry, i) => ({
                  name: `${entry.name}${i < 5 ? ` ${countLabel(["seats", "forts", "descents", "spawns", "bridges"][i] ?? "")}` : ""}`,
                  rgb: entry.rgb,
                })),
                ...descentTypes.map((d) => ({
                  name: `${d.type} ${d.visible}/${d.total}`,
                  rgb: SITE_LEGEND[2].rgb,
                })),
              ]
            : ATLAS_REGIONS.flatMap((r, i) =>
                Number(weighted[i]) > 0
                  ? [
                      {
                        name: `${r.name} (${Number(dominant[i]).toFixed(1)} km²)`,
                        rgb: r.rgb,
                      },
                    ]
                  : [],
              ),
      ...(mode === "sites"
        ? {
            sites: {
              scope:
                layer === "surface"
                  ? "all layers projected to XZ"
                  : "sites in this layer; descents incident to this layer",
              symbols:
                "fixed pixel symbols, not physical site footprints; causeway centreline and actual arc gaps",
              counts,
              descentTypes,
              spawnClearance: {
                minimumRadius: Number.isFinite(minimumRadius)
                  ? minimumRadius
                  : null,
                minimumSeatDistance: Number.isFinite(minimumSeatDistance)
                  ? minimumSeatDistance
                  : null,
              },
            },
          }
        : {}),
    },
  };
}
