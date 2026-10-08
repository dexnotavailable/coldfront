import { describe, expect, it } from "vitest";
import { normalizeSeed } from "../../../client/src/ui/controller";
import { fixtureController } from "../../src/ui-harness/sample";

describe("UI adapter behavior", () => {
  it("preserves the full digit draft through Play and return to title", () => {
    const fixture = fixtureController("title");
    const draft = "000000004294967297";
    fixture.ui.seedDraft.value = draft;
    fixture.ui.play();
    expect(fixture.commands).toContainEqual({ type: "start", seed: 1 });
    expect(fixture.ui.seedDraft.value).toBe(draft);
    fixture.ui.quit();
    expect(fixture.ui.seedDraft.value).toBe(draft);
    fixture.ui.dispose();
  });
  it("leaves production input-scope writes to the single external arbiter", () => {
    const fixture = fixtureController("hud", { manageInputScope: false });
    fixture.ui.key("key.pos.inventory");
    fixture.ui.escape();
    fixture.ui.blocking.value = "menu";
    expect(
      fixture.commands.some((command) => command.type === "input-scope"),
    ).toBe(false);
    expect(fixture.commands).toContainEqual({ type: "pause", paused: true });
    fixture.ui.dispose();
  });
  it("F11 toggles while Play requests entry only", () => {
    const fixture = fixtureController("hud");
    fixture.ui.key("key.all.fullscreen");
    expect(fixture.browserActions).toEqual(["toggle-fullscreen"]);
    fixture.ui.play();
    expect(fixture.browserActions).toEqual(["toggle-fullscreen", "fullscreen"]);
    fixture.ui.dispose();
  });
  it("normalizes large decimal seeds without imprecise whole-string conversion", () => {
    expect(normalizeSeed("")).toBe(1);
    expect(normalizeSeed("4294967297")).toBe(1);
    expect(normalizeSeed("00012")).toBe(12);
  });
  it("does not clear edits before the listed confirmation", () => {
    const fixture = fixtureController("hud");
    fixture.ui.requestClear();
    expect(
      fixture.commands.filter((command) => command.type === "clear-edits"),
    ).toHaveLength(0);
    fixture.ui.escape();
    expect(
      fixture.commands.filter((command) => command.type === "clear-edits"),
    ).toHaveLength(0);
    fixture.ui.requestClear();
    fixture.ui.confirmClear();
    expect(
      fixture.commands.filter((command) => command.type === "clear-edits"),
    ).toEqual([{ type: "clear-edits", seed: 1 }]);
    fixture.ui.dispose();
  });
  it("rejects a stale confirmation after changing seeds", () => {
    const fixture = fixtureController("hud");
    fixture.ui.requestClear();
    fixture.ui.game.value = { ...fixture.ui.game.value, seed: 2 };
    fixture.ui.confirmClear();
    expect(
      fixture.commands.filter((command) => command.type === "clear-edits"),
    ).toHaveLength(0);
    fixture.ui.dispose();
  });
  it("Esc resumes in a window and Resume click requests fullscreen", () => {
    const fixture = fixtureController("menu");
    fixture.ui.escape();
    expect(fixture.browserActions).not.toContain("fullscreen");
    fixture.ui.blocking.value = "menu";
    fixture.ui.resume();
    expect(fixture.browserActions).toEqual(["fullscreen"]);
    fixture.ui.dispose();
  });
  it("Tools preserves world input while palette takes it", () => {
    const fixture = fixtureController("hud");
    fixture.ui.key("key.own.tools");
    expect(fixture.ui.blocking.value).toBeNull();
    fixture.ui.key("key.pos.inventory");
    expect(fixture.commands).toContainEqual({
      type: "input-scope",
      scope: "blocking-screen",
    });
    fixture.ui.key("key.pos.inventory");
    expect(fixture.commands.at(-2)).toEqual({
      type: "input-scope",
      scope: "world",
    });
    fixture.ui.dispose();
  });
  it("passes a real block assignment and ignores unsupported engine keys", () => {
    const fixture = fixtureController("palette");
    fixture.ui.assignBlock(9, 3);
    expect(fixture.commands).toContainEqual({
      type: "assign-block",
      blockId: 9,
      index: 3,
    });
    expect(fixture.ui.game.value.hotbar.slots[3]).toBe(9);
    expect(fixture.ui.key("key.pos.forward")).toBe(false);
    fixture.ui.dispose();
  });
});
