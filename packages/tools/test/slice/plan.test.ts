import { describe, expect, it } from "vitest";
import {
  planBandAt,
  renderSection,
  type SectionRequest,
} from "../../src/slice/render.js";
import { createTestWorldSource } from "../../src/terrain-review/source.js";
import { geometryPlan } from "../terrain-review/plan-fixture.js";

describe("planned slice annotations", () => {
  it("uses canonical depth bands and unions adjacent footprint weights at shelves", () => {
    const masks = [0.2, 0.7, 0.4, 1];
    expect(planBandAt(-100, masks)).toEqual({ index: 0, weight: 0.2 });
    expect(planBandAt(-384, masks)).toEqual({ index: 4, weight: 0.7 });
    expect(planBandAt(-500, masks)).toEqual({ index: 1, weight: 0.7 });
    expect(planBandAt(-736, masks)).toEqual({ index: 4, weight: 0.7 });
    expect(planBandAt(-800, masks)).toEqual({ index: 2, weight: 0.4 });
    expect(planBandAt(-1088, masks)).toEqual({ index: 4, weight: 1 });
    expect(planBandAt(-1200, masks)).toEqual({ index: 3, weight: 1 });
    expect(planBandAt(-1510, masks)).toBeNull();
    expect(planBandAt(100, masks)).toBeNull();
  });
  it("tints existing solid rock, preserves exact density/material counts, and never paints air or water", () => {
    const source = {
      ...createTestWorldSource(1),
      world: "main",
      plan: geometryPlan(),
    };
    const request: SectionRequest = {
      kind: "window",
      from: [0, 0],
      to: [2, 0],
      yMin: -1536,
      yMax: 16,
      metresPerPixel: 2,
    };
    const raw = renderSection({ ...request, overlays: "none" }, source),
      annotated = renderSection({ ...request, overlays: "plan" }, source);
    expect(annotated.metadata.density).toEqual(raw.metadata.density);
    expect(annotated.metadata.materials).toEqual(raw.metadata.materials);
    expect(annotated.metadata.fluidPixels).toBe(raw.metadata.fluidPixels);
    expect(
      annotated.metadata.overlays.bands.find((b) => b.name === "Pit plan")
        ?.pixels,
    ).toBe(200);
    expect(
      annotated.metadata.overlays.bands.find(
        (b) => b.name === "Upper Deep plan",
      )?.pixels,
    ).toBe(0);
    expect([...annotated.rgba.slice(0, 16)]).toEqual([
      ...raw.rgba.slice(0, 16),
    ]);
    const pond = {
      ...request,
      from: [43, 24] as const,
      to: [45, 24] as const,
      yMin: -4,
      yMax: 4,
      metresPerPixel: 1,
    };
    expect(renderSection({ ...pond, overlays: "plan" }, source).rgba).toEqual(
      renderSection({ ...pond, overlays: "none" }, source).rgba,
    );
  });
});
