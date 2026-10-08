import type { Page } from "playwright";
import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry";
/** Exercises production UI components against the explicitly gallery-only port. */
export async function inspectInteractions(
  page: Page,
  fixture: string,
): Promise<{ checks: string[]; errors: string[] }> {
  const checks: string[] = [];
  const errors: string[] = [];
  if (fixture === "map-main" || fixture === "map-test") {
    try {
      await page.reload({ waitUntil: "networkidle" });
      const map = page.locator('[data-ui="map.view"][data-map-ready="true"]');
      await map.waitFor();
      const read = () =>
        map.evaluate((el) => {
          const d = (el as HTMLElement).dataset;
          return {
            x: Number(d.mapX),
            z: Number(d.mapZ),
            scale: Number(d.mapScale),
            pinX: Number(d.mapPinX),
            pinZ: Number(d.mapPinZ),
          };
        });
      const box = await map.boundingBox();
      if (!box) throw new Error("Missing map canvas");
      await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
      const chosen = await read();
      const label = await page.locator('[data-ui="map.where"]').textContent();
      if (!label?.includes("Position")) throw new Error("Map Position missing");
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(220);
      await page.keyboard.up("KeyW");
      await page.waitForTimeout(150);
      const panned = await read();
      if (panned.z >= chosen.z) throw new Error("North-up W did not pan north");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(500);
      const zoomed = await read();
      if (zoomed.scale >= panned.scale)
        throw new Error("Map wheel did not zoom");
      if (zoomed.pinX !== chosen.pinX || zoomed.pinZ !== chosen.pinZ)
        throw new Error("Map pan/zoom changed the chosen world point");
      await page.locator('[data-ui="map.teleport"]').click();
      await page
        .locator('[data-ui="map.view"]')
        .waitFor({ state: "hidden", timeout: 1500 });
      checks.push(
        "real map click, coordinate readout, north-up W pan, cursor wheel zoom, stable pin, Teleport commit closure (fixture port)",
      );
    } catch (error) {
      errors.push(String(error));
    }
    return { checks, errors };
  }
  if (
    fixture === "primitive-select-world" ||
    fixture === "primitive-select-region"
  ) {
    let step = "initial Escape";
    try {
      const trigger = page.locator("button[data-select-input]");
      const list = page.locator('[role="listbox"]');
      const initial = await trigger.textContent();
      const fieldHook = await page.evaluate(
        () => !!document.activeElement?.closest("[data-select-input]"),
      );
      if (!fieldHook)
        throw new Error("Focused Select option lacks the field-ownership hook");
      await page.keyboard.press("Escape");
      await list.waitFor({ state: "hidden", timeout: 1000 });
      if ((await trigger.textContent()) !== initial)
        throw new Error("Escape changed Select value");
      await trigger.press("ArrowDown");
      await list.waitFor();
      step = "keyboard commit";
      await page.keyboard.press("End");
      const last = await list.locator('[role="option"]').last().textContent();
      await page.keyboard.press("Enter");
      await list.waitFor({ state: "hidden", timeout: 1000 });
      if ((await trigger.textContent()) !== last)
        throw new Error("Select did not commit its last stable option");
      await trigger.click();
      await list.waitFor();
      step = "outside pointer dismissal";
      await page.mouse.click(8, 8);
      await list.waitFor({ state: "hidden", timeout: 1000 });
      checks.push(
        "Select hook, Escape without mutation, keyboard open/End/commit, pointer outside dismissal",
      );
    } catch (error) {
      errors.push(`${step}: ${String(error)}`);
    }
    return { checks, errors };
  }
  if (
    !["title", "hud", "tools", "palette", "menu", "confirm-clear"].includes(
      fixture,
    )
  )
    return { checks, errors };
  try {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__cfUi?.ready);
    if (fixture === "title") {
      const seed = page.locator('[data-ui="title.seed"]');
      await seed.fill("letters");
      if (!/^\d*$/.test(await seed.inputValue()))
        throw new Error("Seed accepted non-digits");
      await page.locator('[data-ui="title.random"]').click();
      if (!/^\d+$/.test(await seed.inputValue()))
        throw new Error("Random seed did not fill digits");
      await seed.fill("4294967297");
      await page.locator('[data-ui="title.play"]').click();
      await page.locator('[data-text-id="load.terrain"]').waitFor();
      checks.push("digits-only seed, random seed and Play-to-loading");
      await page.reload({ waitUntil: "networkidle" });
      await page.setViewportSize({ width: 1023, height: 600 });
      await page.locator('[data-text-id="sys.small"]').waitFor();
      await page.setViewportSize({ width: 1024, height: 599 });
      await page.locator('[data-text-id="sys.small"]').waitFor();
      await page.setViewportSize({ width: 1024, height: 600 });
      await page.locator('[data-ui="title.play"]').waitFor();
      checks.push("exact1024x600 minimum viewport boundary");
    }
    if (fixture === "hud") {
      await page.keyboard.press("F3");
      await page.locator('[data-ui="f3.pos"]').waitFor();
      await page.keyboard.press("F1");
      await page
        .locator('[data-ui="hud.hotbar"]')
        .first()
        .waitFor({ state: "hidden" });
      await page.keyboard.press("F1");
      await page.locator('[data-ui="hud.hotbar"]').first().waitFor();
      await page.keyboard.press("F4");
      await page.locator('[data-ui="tools.title"]').waitFor();
      await page.keyboard.press("F4");
      await page
        .locator('[data-ui="tools.title"]')
        .waitFor({ state: "hidden" });
      checks.push("F1/F3/F4 route through actual UI events");
    }
    if (fixture === "tools") {
      const fog = page.locator('[data-ui="tools.fog"]');
      const before = await fog.isChecked();
      await fog.click();
      if ((await fog.isChecked()) === before)
        throw new Error("Fog toggle did not update");
      if (await fog.evaluate((el) => document.activeElement === el))
        throw new Error("Nonblocking Tools kept checkbox keyboard focus");
      const slider = page.locator('[data-ui="tools.time"]');
      const box = await slider.boundingBox();
      if (!box) throw new Error("Missing time slider");
      await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
      if (Number(await slider.inputValue()) === 12)
        throw new Error("Time slider did not change");
      await slider.dblclick({
        position: { x: box.width * 0.25, y: box.height / 2 },
      });
      if (Number(await slider.inputValue()) !== 12)
        throw new Error("Time slider did not reset");
      await page.mouse.click(20, 350);
      await page
        .locator('[data-ui="tools.title"]')
        .waitFor({ state: "hidden" });
      checks.push(
        "live tool toggle and slider, no focus capture, world-click dismissal",
      );
    }
    if (fixture === "palette") {
      const search = page.locator('[data-ui="blocks.search"]');
      const query = "stone";
      const expectedNames = BLOCK_REGISTRY.filter(
        (block) => block.id !== 0 && block.name.toLowerCase().includes(query),
      ).map((block) => block.name);
      await search.fill(query);
      const slots = page.locator('[data-ui="blocks.grid"]');
      await page.waitForFunction((expected) => {
        const actual = [
          ...document.querySelectorAll('[data-ui="blocks.grid"]'),
        ].map((element) => element.getAttribute("aria-label"));
        return JSON.stringify(actual) === JSON.stringify(expected);
      }, expectedNames);
      const actualNames = await slots.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label")),
      );
      if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames))
        throw new Error(
          `Palette names ${JSON.stringify(actualNames)} did not match registry names ${JSON.stringify(expectedNames)}`,
        );
      await slots.first().click();
      const target = slots.last();
      const name = await target.getAttribute("aria-label");
      await target.hover();
      await page.keyboard.press("Digit3");
      if (
        (await page
          .locator('[data-ui="hud.hotbar"]')
          .nth(2)
          .getAttribute("aria-label")) !== name
      )
        throw new Error("Hovered palette block did not fill slot3");
      await search.fill("zzzz");
      if ((await slots.count()) !== 0)
        throw new Error("Empty search retained blocks");
      checks.push("name filter, empty state and hovered1–9 assignment");
    }
    if (fixture === "menu") {
      await page.locator('[data-ui="menu.resume"]').click();
      await page.locator("[data-blocking]").waitFor({ state: "hidden" });
      checks.push("Resume click leaves menu");
    }
    if (fixture === "confirm-clear") {
      await page.locator('[data-ui="confirm.cancel"]').click();
      await page.locator('[role="dialog"]').waitFor({ state: "hidden" });
      checks.push("Cancel closes confirmation");
    }
  } catch (error) {
    errors.push(String(error));
  }
  return { checks, errors };
}
