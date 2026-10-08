import type { Page } from "playwright";
import type { GalleryFixture } from "../../../client/src/ui/gallery/registry";
import { catalogue, currentId, t } from "../../../client/src/ui/t";
export async function prepareFixture(
  page: Page,
  fixture: GalleryFixture,
): Promise<{ errors: string[]; evidence: unknown }> {
  const prepare = fixture.prepare;
  if (!prepare) return { errors: [], evidence: null };
  const errors: string[] = [];
  if (prepare.kind === "field-endpoint") {
    const input = page.locator(prepare.selector);
    await input.focus();
    const original = await input.inputValue();
    const read = () =>
      input.evaluate((element) => {
        const field = element as HTMLInputElement;
        return {
          value: field.value,
          selectionStart: field.selectionStart,
          selectionEnd: field.selectionEnd,
          scrollLeft: field.scrollLeft,
          scrollWidth: field.scrollWidth,
          clientWidth: field.clientWidth,
          focused: document.activeElement === field,
        };
      });
    await input.press("Home");
    const home = await read();
    await input.press("End");
    const end = await read();
    await input.press(prepare.endpoint);
    await page.waitForTimeout(30);
    const final = await read();
    if (
      original !== prepare.value ||
      home.value !== original ||
      end.value !== original ||
      final.value !== original
    )
      errors.push("Horizontal editing changed the exact seed draft");
    if (
      home.selectionStart !== 0 ||
      home.selectionEnd !== 0 ||
      home.scrollLeft > 1
    )
      errors.push("Home did not reveal the first character and caret");
    if (
      end.selectionStart !== original.length ||
      end.selectionEnd !== original.length ||
      end.scrollLeft + end.clientWidth < end.scrollWidth - 1
    )
      errors.push("End did not reveal the last character and caret");
    if (!final.focused) errors.push("Endpoint capture lost the editor focus");
    return {
      errors,
      evidence: {
        kind: prepare.kind,
        endpoint: prepare.endpoint,
        original,
        firstCharacter: original[0],
        lastCharacter: original.at(-1),
        home,
        end,
        final,
        exactValueRetained: errors.length === 0,
      },
    };
  }
  const target = page.locator(prepare.selector);
  if (prepare.method === "hover") await target.hover();
  else {
    let focused = false;
    for (let index = 0; index < 64; index++) {
      await page.keyboard.press("Tab");
      if (
        await target.evaluate((element) => element === document.activeElement)
      ) {
        focused = true;
        break;
      }
    }
    if (!focused)
      errors.push("Keyboard traversal did not reach tooltip target");
  }
  await page.waitForTimeout(450);
  const tooltip = page.locator('[role="tooltip"]').filter({ visible: true });
  if ((await tooltip.count()) !== 1)
    errors.push("Expected exactly one visible tooltip");
  const targetId = await target.getAttribute("data-ui");
  const blockName = await target.getAttribute("data-content-name");
  const tooltipText = await tooltip.allTextContents();
  let expectedText = blockName ?? "";
  if (!blockName && targetId && currentId(targetId)) {
    const row = catalogue[targetId];
    expectedText = [
      row.type === "icon" ? t(targetId) : "",
      row.tooltip,
      row.key,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (
    tooltipText.join(" ").replace(/\s+/g, " ").trim() !==
    expectedText.replace(/\s+/g, " ").trim()
  )
    errors.push("Tooltip did not show the requested target's exact content");
  const targetBox = await target.boundingBox();
  const tooltipBox = await tooltip.boundingBox();
  const scale = await page
    .locator("#gallery-stage")
    .evaluate((element) => Number(getComputedStyle(element).zoom) || 1);
  const anchor =
    targetBox && tooltipBox
      ? {
          target: targetBox,
          tooltip: tooltipBox,
          verticalGap: Math.max(
            tooltipBox.y - (targetBox.y + targetBox.height),
            targetBox.y - (tooltipBox.y + tooltipBox.height),
          ),
          horizontalGap: Math.max(
            0,
            tooltipBox.x - (targetBox.x + targetBox.width),
            targetBox.x - (tooltipBox.x + tooltipBox.width),
          ),
          expectedGap: 8 * scale,
        }
      : null;
  if (
    !anchor ||
    Math.abs(anchor.verticalGap - anchor.expectedGap) > 1 ||
    anchor.horizontalGap > 1
  )
    errors.push("Tooltip is detached from its target");
  const evidence = {
    kind: prepare.kind,
    method: prepare.method,
    targetId,
    targetName: await target.getAttribute("aria-label"),
    tooltipText,
    expectedText,
    anchor,
    focused: await target.evaluate(
      (element) => document.activeElement === element,
    ),
  };
  return { errors, evidence };
}
