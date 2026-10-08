import type { Page } from "playwright";
/** Exercises production UI components against the explicitly gallery-only port. */
export async function inspectInteractions(
  page: Page,
  fixture: string,
): Promise<{ checks: string[]; errors: string[] }> {
  const checks: string[] = [];
  const errors: string[] = [];
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
      await search.fill("stone");
      const slots = page.locator('[data-ui="blocks.grid"]');
      if ((await slots.count()) !== 3)
        throw new Error("Palette filter did not match registry names");
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
