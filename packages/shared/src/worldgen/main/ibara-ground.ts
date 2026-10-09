import type {
  IbaraGroundSample,
  IbaraPlanData,
  LavaSample,
  WorldBounds,
  XZBounds,
} from "../../world/types.js";
import { smoothUnit } from "../../worldplan/geometry.js";
import {
  clearLava,
  createLavaQueries,
  sampleChannelColumn,
} from "../../worldplan/lava.js";
import {
  calderaHeight,
  createIbaraAnalytic,
  IBARA_SUPPORT,
  intersectsXZ,
  MAX_FISSURE_DEPTH,
  MAX_PLAIN_RISE,
  type PlainSample,
  projectSegment,
} from "./ibara-volcanic.js";
import { MainColumn, type MainField } from "./surface.js";

export interface IbaraGround {
  height(x: number, z: number): number;
  sample(
    x: number,
    y: number,
    z: number,
    out: IbaraGroundSample,
  ): IbaraGroundSample;
  lavaQuery(x: number, z: number, out: LavaSample): LavaSample;
  lavaAt(x: number, z: number, out: Float64Array): Float64Array;
  conservativeBounds(bounds: XZBounds, out: WorldBounds): WorldBounds;
}
/** Complete volcanic height/density before additive thorns and explicit carvers.
 * There are no ambient caves/displacements here: solid under every fluid bed,
 * including the six-metre protective band. Future carvers must consult ownership. */
export function createIbaraGround(
  baseField: MainField,
  plan: IbaraPlanData,
): IbaraGround {
  const analytic = createIbaraAnalytic(plan.seed);
  const lava = createLavaQueries(plan, analytic);
  const plain: PlainSample = { offset: 0, tag: "base", weight: 0 };
  const projection = new Float64Array(6);
  const channel = new Float64Array(4);
  const baseColumn = baseField.createColumn();
  const ground: IbaraGroundSample = { density: 0, surfaceY: 0, tag: "base" };
  const cache = new Map<string, Pick<IbaraGroundSample, "surfaceY" | "tag">>();
  const scales = new Map<string, number>();
  const point = (
    x: number,
    z: number,
    out: IbaraGroundSample,
  ): IbaraGroundSample => {
    const key = `${x},${z}`;
    const cached = cache.get(key);
    if (cached) {
      out.surfaceY = cached.surfaceY;
      out.tag = cached.tag;
      return out;
    }
    const base = baseField.height(x, z);
    analytic.plain(x, z, plain);
    out.surfaceY = base;
    out.tag = "base";
    if (plain.weight === 0) return out;
    let height = base + plain.offset;
    out.tag = plain.tag;
    for (const f of lava.fissuresAt(x, z)) {
      projectSegment(x, z, f.ax, f.az, f.bx, f.bz, projection);
      const t = Number(projection[0]) / f.halfWidth;
      if (t < 1) {
        height = Math.min(height, base + plain.offset - f.depth * (1 - t * t));
        out.tag = "basalt";
      }
    }
    for (const c of plan.calderas) {
      const next = calderaHeight(c, x, z, height);
      if (next !== height) {
        height = next;
        out.tag = "basalt";
      }
    }
    sampleChannelColumn(
      lava.segmentsAt(x, z),
      x,
      z,
      height,
      channel,
      projection,
    );
    if (Number(channel[2]) !== height) {
      let channelHeight = Number(channel[2]);
      if (channelHeight > height) {
        // A channel's submerged banks cannot replace a lake with dry strips:
        // proximity owns the complete lake disc. Fade additive banks in over
        // the inner caldera slope, rather than clip them at the wet shore.
        let lake = 0;
        for (const c of plan.calderas) {
          const dx = x - c.x;
          const dz = z - c.z;
          const r = Math.sqrt(dx * dx + dz * dz);
          lake = Math.max(
            lake,
            1 - smoothUnit((r - c.lavaRadius) / (c.radius - c.lavaRadius)),
          );
        }
        channelHeight = height + (channelHeight - height) * (1 - lake);
      }
      height = channelHeight;
      out.tag = channel[3] === 1 ? "obsidian" : "basalt";
    }
    for (const v of plan.vents) {
      const dx = x - v.x;
      const dz = z - v.z;
      const r = Math.sqrt(dx * dx + dz * dz);
      if (r >= v.radius) continue;
      // Blend the central foundation into the actual local ground. This tends
      // continuously to ground at the footprint edge even on a sloping plain,
      // and stays between ground and the declared central top bound.
      const cone =
        height + (v.baseY + v.height - height) * (1 - smoothUnit(r / v.radius));
      height = Math.max(
        height,
        cone - 0.3 * v.height * (1 - smoothUnit(r / v.mouthRadius)),
      );
      out.tag = r < v.mouthRadius ? "vent" : "sulphur";
    }
    // Cooled low ground is an explicit material observation near an actual
    // caldera/channel. Avoid expensive nearest-fissure searches for every voxel.
    if (out.tag === "basalt" || out.tag === "ash") {
      for (const c of plan.calderas) {
        const dx = x - c.x;
        const dz = z - c.z;
        const radius = c.radius + c.rimWidth + 48;
        if (height < c.baseY + 4 && dx * dx + dz * dz < radius * radius)
          out.tag = "obsidian";
      }
    }
    out.surfaceY = height;
    if (cache.size >= 4096) cache.clear();
    cache.set(key, { surfaceY: height, tag: out.tag });
    return out;
  };
  const height = (x: number, z: number): number => point(x, z, ground).surfaceY;
  return {
    height,
    sample(x, y, z, out) {
      if (!Number.isFinite(y))
        throw new RangeError("Ground point must be finite");
      point(x, z, out);
      if (out.tag === "base") {
        baseField.sampleColumn(x, z, baseColumn);
        out.density = Math.max(
          (Number(baseColumn[MainColumn.NaturalHeight]) - y) *
            Number(baseColumn[MainColumn.DistanceScale]),
          Math.min(
            Number(baseColumn[MainColumn.BridgeMargin]),
            Number(baseColumn[MainColumn.BridgeTop]) - y,
          ),
        );
      } else {
        const key = `${x},${z}`;
        let scale = scales.get(key);
        if (scale === undefined) {
          const dx = height(x + 0.5, z) - height(x - 0.5, z);
          const dz = height(x, z + 0.5) - height(x, z - 0.5);
          scale = 1 / Math.sqrt(1 + Math.min(dx * dx + dz * dz, 64));
          if (scales.size >= 4096) scales.clear();
          scales.set(key, scale);
        }
        out.density = (out.surfaceY - y) * scale;
      }
      return out;
    },
    lavaQuery(x, z, out) {
      const plainHeight =
        baseField.height(x, z) + analytic.plain(x, z, plain).offset;
      lava.query(x, z, plainHeight, out);
      if (out.kind === "none") return out;
      // The solid shore owns the final footprint. Bed is the actual complete
      // ground, so an excavated cave below it cannot inherit this fluid level.
      const floor = height(x, z);
      if (floor >= out.level) return clearLava(out);
      out.bed = floor;
      return out;
    },
    lavaAt: (x, z, out) => lava.nearest(x, z, out),
    conservativeBounds(bounds, out) {
      baseField.surfaceBounds(bounds, out);
      if (!intersectsXZ(bounds, IBARA_SUPPORT)) return out;
      out.minSurfaceY -= MAX_FISSURE_DEPTH;
      out.maxSurfaceY += MAX_PLAIN_RISE;
      // No sampled-height estimate: intervals include every supported shape,
      // all its banks/excavation, plus continuous base-field displacement.
      for (const item of [...plan.calderas, ...plan.channels, ...plan.vents]) {
        if (!intersectsXZ(bounds, item.bounds)) continue;
        out.minSurfaceY = Math.min(out.minSurfaceY, item.bounds.minY);
        out.maxSurfaceY = Math.max(out.maxSurfaceY, item.bounds.maxY);
      }
      for (const c of plan.calderas)
        if (intersectsXZ(bounds, c.bounds))
          out.maxFluidY = Math.max(out.maxFluidY, c.lavaLevel);
      for (const c of plan.channels)
        if (intersectsXZ(bounds, c.bounds)) {
          for (let i = 3; i < c.points.length; i += 5)
            out.maxFluidY = Math.max(out.maxFluidY, Number(c.points[i]));
        }
      // Analytic fissure levels cannot exceed the original surface +4 m.
      out.maxFluidY = Math.max(out.maxFluidY, out.maxSurfaceY);
      out.maxSolidY = Math.max(out.maxSolidY, out.maxSurfaceY);
      return out;
    },
  };
}
