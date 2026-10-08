import { describe, expect, it, vi } from "vitest";
import type { SurfaceRegionId } from "../../../client/src/contracts/game-ui";
import { normalizeSeed } from "../../../client/src/ui/controller";
import { fixtureController } from "../../src/ui-harness/sample";

describe("UI adapter behavior", () => {
  it("does not track synchronous port snapshot callbacks as scope dependencies", () => {
    const fixture = fixtureController("hud");
    const apply = fixture.port.apply;
    fixture.port.apply = (command) => {
      apply(command);
      const snapshot = fixture.port.read();
      fixture.emit({
        type: "snapshot",
        snapshot: { ...snapshot, revision: snapshot.revision + 1 },
      });
    };
    fixture.commands.length = 0;
    expect(() => {
      fixture.ui.blocking.value = "menu";
      fixture.ui.escape();
    }).not.toThrow();
    expect(
      fixture.commands.filter((command) => command.type === "pause"),
    ).toEqual([
      { type: "pause", paused: true },
      { type: "pause", paused: false },
    ]);
    fixture.ui.dispose();
  });
  it("keeps chosen world separate from the raw seed and guards same-seed Clear", () => {
    const fixture = fixtureController("title");
    fixture.ui.worldKind.value = "test";
    fixture.ui.seedDraft.value = "0001";
    fixture.ui.play();
    expect(fixture.commands).toContainEqual({
      type: "start",
      seed: 1,
      worldKind: "test",
    });
    expect(fixture.ui.seedDraft.value).toBe("0001");
    fixture.ui.requestClear();
    const before = fixture.ui.game.value;
    fixture.ui.game.value = {
      ...before,
      world: before.world
        ? {
            ...before.world,
            identity: { ...before.world.identity, kind: "main" },
          }
        : null,
    };
    fixture.ui.confirmClear();
    expect(
      fixture.commands.some((command) => command.type === "clear-edits"),
    ).toBe(false);
    fixture.ui.dispose();
  });
  it("map initializes from actual feet, blocks input without pausing, and closes after commit", async () => {
    const fixture = fixtureController("hud");
    const feet = fixture.ui.game.value.debug!.feet;
    fixture.ui.openMap();
    expect(fixture.ui.mapPin.value).toMatchObject({ x: feet[0], z: feet[2] });
    expect(fixture.ui.blocking.value).toBe("map");
    expect(fixture.ui.game.value.worldPaused).toBe(false);
    await fixture.ui.teleportPin();
    expect(fixture.travels).toHaveLength(1);
    expect(fixture.travels[0]?.target).toEqual({
      kind: "point",
      x: feet[0],
      z: feet[2],
    });
    expect(fixture.ui.blocking.value).toBeNull();
    fixture.ui.dispose();
  });
  it("Escape cancels the map's session and cannot confirm an already-cancelled Clear", () => {
    const fixture = fixtureController("map-main");
    fixture.ui.escape();
    expect(fixture.cancelled).toContain(1);
    expect(fixture.ui.blocking.value).toBeNull();
    fixture.ui.requestClear();
    fixture.ui.escape();
    fixture.ui.confirmClear();
    expect(
      fixture.commands.some((command) => command.type === "clear-edits"),
    ).toBe(false);
    fixture.ui.dispose();
  });
  it("discovery is latest-wins, ignores obsolete sessions and uses only source metadata", () => {
    vi.useFakeTimers();
    const fixture = fixtureController("hud");
    fixture.emit({ type: "region-entered", sessionId: 1, regionId: "rim" });
    expect(fixture.ui.discovery.value?.content.name).toBe("the Rim");
    vi.advanceTimersByTime(1000);
    fixture.emit({ type: "region-entered", sessionId: 1, regionId: "frost" });
    fixture.emit({
      type: "region-entered",
      sessionId: 0,
      regionId: "hellscape",
    });
    expect(fixture.ui.discovery.value?.content.name).toBe("the Frost");
    vi.advanceTimersByTime(4599);
    expect(fixture.ui.discovery.value).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(fixture.ui.discovery.value).toBeNull();
    fixture.ui.dispose();
    vi.useRealTimers();
  });
  it("clears the outgoing card on returning to a discovered region without replaying a card", () => {
    const fixture = fixtureController("hud");
    const at = (regionId: SurfaceRegionId) => {
      const snapshot = fixture.ui.game.value;
      fixture.emit({
        type: "snapshot",
        snapshot: {
          ...snapshot,
          revision: snapshot.revision + 1,
          debug: {
            ...snapshot.debug!,
            regionWeights: [{ regionId, weight: 1 }],
          },
        },
      });
    };
    fixture.emit({ type: "region-entered", sessionId: 1, regionId: "plains" });
    at("plains");
    const plainsCard = fixture.ui.discovery.value;
    at("plains");
    expect(fixture.ui.discovery.value).toBe(plainsCard);
    // Teleport publishes its first-entry event before the matching snapshot.
    fixture.emit({ type: "region-entered", sessionId: 1, regionId: "tundra" });
    expect(fixture.ui.game.value.debug?.regionWeights[0]?.regionId).toBe(
      "plains",
    );
    expect(fixture.ui.discovery.value?.content.id).toBe("tundra");
    const tundraCard = fixture.ui.discovery.value;
    at("tundra");
    expect(fixture.ui.discovery.value).toBe(tundraCard);
    // A known region has only a snapshot, not another first-entry event.
    at("plains");
    expect(fixture.ui.discovery.value).toBeNull();
    at("plains");
    expect(fixture.ui.discovery.value).toBeNull();
    fixture.ui.dispose();
  });
  it("keeps an active card at tied dominance and retains world-session guards", () => {
    const fixture = fixtureController("hud");
    fixture.emit({ type: "region-entered", sessionId: 1, regionId: "tundra" });
    const snapshot = fixture.ui.game.value;
    fixture.emit({
      type: "snapshot",
      snapshot: {
        ...snapshot,
        debug: {
          ...snapshot.debug!,
          regionWeights: [
            { regionId: "plains", weight: 0.5 },
            { regionId: "tundra", weight: 0.5 },
          ],
        },
      },
    });
    expect(fixture.ui.discovery.value?.content.id).toBe("tundra");
    fixture.emit({
      type: "snapshot",
      snapshot: {
        ...snapshot,
        world: { ...snapshot.world!, id: 2 },
      },
    });
    expect(fixture.ui.discovery.value).toBeNull();
    fixture.emit({ type: "region-entered", sessionId: 1, regionId: "tundra" });
    expect(fixture.ui.discovery.value).toBeNull();
    fixture.ui.dispose();
  });
  it("preserves the full digit draft through Play and return to title", () => {
    const fixture = fixtureController("title");
    const draft = "000000004294967297";
    fixture.ui.seedDraft.value = draft;
    fixture.ui.play();
    expect(fixture.commands).toContainEqual({
      type: "start",
      seed: 1,
      worldKind: "main",
    });
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
    ).toEqual([{ type: "clear-edits", world: fixture.ui.game.value.world }]);
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
