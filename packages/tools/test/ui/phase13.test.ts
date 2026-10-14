import { createElement } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";
import {
  postcardPresentations,
  type WorldPostcard,
} from "../../../client/src/game/postcard.js";
import { galleryFixtures } from "../../../client/src/ui/gallery/registry.js";
import { ToolsPanel } from "../../../client/src/ui/screens/OwnerTools.js";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions.js";
import { fixtureController } from "../../src/ui-harness/sample.js";
import { inspectSsr } from "../../src/ui-lint/checks.js";

describe("P8 catalogue-only owner tools", () => {
  it("full gallery matches all production cameras and their three Ibara labels", () => {
    const fixture = fixtureController("tools-postcard-full");
    const identity = fixture.ui.game.value.world?.identity;
    if (!identity) throw new Error("Missing gallery identity");
    const ids = [
      ...SURFACE_REGIONS.map((region) => `P12-${region.id}` as const),
      "HELL-1" as const,
      "HELL-2" as const,
    ];
    const views: WorldPostcard[] = ids.map((id) => ({
      id,
      identity,
      position: { x: 0, y: 1.62, z: 0 },
      target: { x: 1, y: 1.62, z: 0 },
      radius: 128,
      hours: 18,
    }));
    const expected = postcardPresentations(views),
      actual = fixture.ui.game.value.postcards;
    fixture.ui.dispose();
    expect(actual).toHaveLength(18);
    expect(actual).toEqual(expected);
    expect(actual.filter((item) => item.name.startsWith("Ibara"))).toEqual([
      { id: "P12-hellscape", name: "Ibara 1" },
      { id: "HELL-1", name: "Ibara 2" },
      { id: "HELL-2", name: "Ibara 3" },
    ]);
    const full = galleryFixtures.find(
      (item) => item.id === "tools-postcard-full",
    );
    expect(full?.sampleContent).toContain("Ibara 3");
  });
  it("draws the left View label, exact option rows and region/ordinal postcard content", () => {
    const fixture = fixtureController("tools-postcard");
    const html = renderToString(createElement(ToolsPanel, { ui: fixture.ui }));
    const inspected = inspectSsr(html);
    expect(inspected.errors).toEqual([]);
    for (const id of [
      "tools.postcard",
      "tools.view",
      "view.normal",
      "view.clay",
      "view.features",
    ])
      expect(inspected.ids).toContain(id);
    expect(html).toContain('data-text-id="tools.view"');
    expect(html).toContain('data-content="Ibara 1"');
    expect(html).not.toMatch(/>HELL-[12]</);
    fixture.ui.dispose();
  });
  it("hides unusable postcard controls without placeholder or disabled copies", () => {
    for (const scenario of [
      "tools",
      "tools-postcard-error",
      "tools-postcard-pending",
    ]) {
      const fixture = fixtureController(scenario);
      const html = renderToString(
        createElement(ToolsPanel, { ui: fixture.ui }),
      );
      expect(html).not.toContain('data-ui="tools.postcard"');
      fixture.ui.dispose();
    }
  });
  it("routes selection to the game port and Esc resumes the free camera", async () => {
    const fixture = fixtureController("tools-postcard");
    const travel = vi.spyOn(fixture.port, "goToPostcard");
    await fixture.ui.goToPostcard("HELL-2");
    expect(travel).toHaveBeenCalledWith({ sessionId: 1, id: "HELL-2" });
    expect(fixture.ui.game.value.activePostcardId).toBe("HELL-2");
    expect(fixture.ui.toolsOpen.value).toBe(false);
    fixture.ui.escape();
    expect(fixture.commands).toContainEqual({
      type: "postcard",
      active: false,
    });
    fixture.ui.setView("clay");
    expect(fixture.commands).toContainEqual({
      type: "set-view",
      value: "clay",
    });
    expect(fixture.ui.game.value.tools.viewMode).toBe("clay");
    fixture.ui.dispose();
  });
  it("declares exact gallery content and open/full/empty/error/selected fixtures", () => {
    for (const id of [
      "tools-postcard",
      "tools-postcard-open",
      "tools-postcard-full",
      "tools-postcard-pending",
      "tools-postcard-error",
      "tools-clay",
      "tools-features",
    ]) {
      const fixture = galleryFixtures.find((item) => item.id === id)!;
      expect(fixture).toBeDefined();
      expect(fixture.sampleContent).toContain("Ibara 1");
      expect(fixture.sampleContent).toContain("Ibara 2");
      expect(
        inspectSsr(renderToString(createElement(fixture.render, {}))).errors,
      ).toEqual([]);
    }
  });
});
