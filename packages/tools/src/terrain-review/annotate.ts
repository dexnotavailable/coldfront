import { createRequire } from "node:module";
import sharp from "sharp";
import type { AtlasMetadata } from "../atlas/render.js";
import type { SectionMetadata } from "../slice/render.js";
import type { Raster } from "./output.js";

const fontfile = createRequire(import.meta.url).resolve(
  "@fontsource/inter/files/inter-latin-400-normal.woff",
);
interface LegendEntry {
  readonly name: string;
  readonly rgb: readonly number[];
}
interface ReviewMetadata<T> {
  readonly data: T;
  readonly review: Readonly<{
    plot: { x: number; y: number; width: number; height: number };
    dataPixelsCopiedWithoutResizing: true;
    font: "@fontsource/inter 5.3.0";
  }>;
}
function escapeMarkup(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function number(value: number): string {
  return Number(value.toFixed(Math.abs(value) < 100 ? 2 : 1)).toString();
}
async function frame<T>(
  raster: Raster<T>,
  title: string,
  subtitle: string,
  xTicks: readonly { t: number; text: string }[],
  yTicks: readonly { t: number; text: string }[],
  xLabel: string,
  yLabel: string,
  legend: readonly LegendEntry[],
  verticalLegend: boolean,
): Promise<Raster<ReviewMetadata<T>>> {
  const left = 84,
    top = raster.width > 600 ? 38 : 60,
    right = verticalLegend ? 150 : 24;
  const legendRows: LegendEntry[][] = [[]];
  let rowWidth = 0;
  if (!verticalLegend)
    for (const entry of legend) {
      const w = 28 + entry.name.length * 9;
      if (rowWidth + w > Math.max(raster.width, 160) && rowWidth > 0) {
        legendRows.push([]);
        rowWidth = 0;
      }
      legendRows.at(-1)?.push(entry);
      rowWidth += w;
    }
  const bottom = verticalLegend ? 64 : 66 + legendRows.length * 23;
  const width = Math.max(512, left + raster.width + right),
    height =
      top +
      Math.max(raster.height, verticalLegend ? legend.length * 25 + 24 : 0) +
      bottom;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 20;
    rgba[i + 1] = 25;
    rgba[i + 2] = 30;
    rgba[i + 3] = 255;
  }
  for (let row = 0; row < raster.height; row++)
    rgba.set(
      raster.rgba.subarray(
        row * raster.width * 4,
        (row + 1) * raster.width * 4,
      ),
      ((row + top) * width + left) * 4,
    );
  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    rgb: readonly number[],
  ): void {
    for (
      let py = Math.max(0, Math.round(y));
      py < Math.min(height, Math.round(y + h));
      py++
    )
      for (
        let px = Math.max(0, Math.round(x));
        px < Math.min(width, Math.round(x + w));
        px++
      ) {
        const i = (py * width + px) * 4;
        for (let c = 0; c < 3; c++) rgba[i + c] = Number(rgb[c]);
      }
  }
  async function text(
    x: number,
    y: number,
    label: string,
    align: "left" | "center" | "right" = "left",
  ): Promise<void> {
    const rendered = await sharp({
      text: {
        text: `<span foreground="#dfe5e9">${escapeMarkup(label)}</span>`,
        font: "Inter 14",
        fontfile,
        rgba: true,
      },
    })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ox = Math.round(
        x -
          (align === "right"
            ? rendered.info.width
            : align === "center"
              ? rendered.info.width / 2
              : 0),
      ),
      oy = Math.round(y);
    for (let py = 0; py < rendered.info.height; py++)
      for (let px = 0; px < rendered.info.width; px++) {
        if (ox + px < 0 || ox + px >= width || oy + py < 0 || oy + py >= height)
          continue;
        const a = (py * rendered.info.width + px) * 4,
          b = ((oy + py) * width + ox + px) * 4,
          alpha = Number(rendered.data[a + 3]) / 255;
        for (let c = 0; c < 3; c++)
          rgba[b + c] = Math.round(
            Number(rendered.data[a + c]) * alpha +
              Number(rgba[b + c]) * (1 - alpha),
          );
      }
  }
  await text(left, 8, title);
  if (raster.width > 600) await text(left + raster.width, 8, subtitle, "right");
  else await text(left, 30, subtitle);
  await text(left - 10, 8, yLabel, "right");
  for (const tick of xTicks) {
    if (raster.width < 240 && tick.t > 0 && tick.t < 1) continue;
    const x = left + tick.t * raster.width;
    rect(x, top + raster.height, 1, 5, [118, 130, 140]);
    await text(
      raster.width < 80 ? x + (tick.t === 0 ? -8 : 8) : x,
      top + raster.height + 10,
      tick.text,
      raster.width < 80
        ? tick.t === 0
          ? "right"
          : "left"
        : tick.t === 0
          ? "left"
          : tick.t === 1
            ? "right"
            : "center",
    );
  }
  for (const tick of yTicks) {
    const y = top + tick.t * raster.height;
    rect(left - 5, y, 5, 1, [118, 130, 140]);
    await text(
      left - 10,
      y - (tick.t === 1 ? 14 : tick.t === 0 ? 0 : 7),
      tick.text,
      "right",
    );
  }
  await text(
    left + raster.width / 2,
    top + raster.height + 34,
    xLabel,
    "center",
  );
  if (verticalLegend) {
    await text(left + raster.width + 16, top, "Height (m)");
    for (let i = 0; i < legend.length; i++) {
      const item = legend[i];
      if (!item) continue;
      const y = top + 24 + i * 25;
      rect(left + raster.width + 16, y, 18, 14, item.rgb);
      await text(left + raster.width + 43, y, item.name);
    }
  } else
    for (let row = 0; row < legendRows.length; row++) {
      let x = left;
      const y = top + raster.height + 58 + row * 23;
      for (const entry of legendRows[row] ?? []) {
        rect(x, y, 16, 14, entry.rgb);
        await text(x + 23, y, entry.name);
        x += 28 + entry.name.length * 9;
      }
    }
  return {
    width,
    height,
    rgba,
    metadata: {
      data: raster.metadata,
      review: {
        plot: { x: left, y: top, width: raster.width, height: raster.height },
        dataPixelsCopiedWithoutResizing: true,
        font: "@fontsource/inter 5.3.0",
      },
    },
  };
}
export function atlasReview(
  raster: Raster<AtlasMetadata>,
): Promise<Raster<ReviewMetadata<AtlasMetadata>>> {
  const m = raster.metadata,
    b = m.bounds;
  return frame(
    raster,
    "Ground height",
    `Test world · seed ${m.seed} · ${number(m.metresPerPixel.x)} m/px · north ↑`,
    [
      { t: 0, text: number(b.minX) },
      { t: 0.5, text: number((b.minX + b.maxX) / 2) },
      { t: 1, text: number(b.maxX) },
    ],
    [
      { t: 0, text: number(b.minZ) },
      { t: 0.5, text: number((b.minZ + b.maxZ) / 2) },
      { t: 1, text: number(b.maxZ) },
    ],
    "X (m)",
    "Z (m)",
    [
      ...m.heightRamp.map((stop) => ({
        name: number(stop.height),
        rgb: stop.rgb,
      })),
      { name: "Water", rgb: [63, 115, 145] },
    ],
    true,
  );
}
export function sliceReview(
  raster: Raster<SectionMetadata>,
): Promise<Raster<ReviewMetadata<SectionMetadata>>> {
  const m = raster.metadata,
    zero =
      m.yMax > 0 && m.yMin < 0
        ? [{ t: m.yMax / (m.yMax - m.yMin), text: "0" }]
        : [];
  return frame(
    raster,
    `${m.kind === "overview" ? "Overview" : "Window"} · ${number(m.metresPerPixel)} m/px`,
    `XZ ${m.from.map(number).join(",")} → ${m.to.map(number).join(",")} · test seed ${m.seed}`,
    [
      { t: 0, text: "0" },
      { t: 0.5, text: number(m.lengthMetres / 2) },
      { t: 1, text: number(m.lengthMetres) },
    ],
    [{ t: 0, text: number(m.yMax) }, ...zero, { t: 1, text: number(m.yMin) }],
    "Distance along section (m)",
    "Y (m)",
    m.materials.map((item) => ({ name: item.name, rgb: item.rgb })),
    false,
  );
}
