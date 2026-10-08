import type { Page } from "playwright";
import type { CatalogueRow } from "../ui-strings/index";
import { auditPolicy } from "./policy";
export async function inspectPage(
  page: Page,
  catalogue: Record<string, CatalogueRow>,
  sampleContent: readonly string[],
) {
  return page.evaluate(
    ({ rows, content, policy }) => {
      const errors: string[] = [];
      const texts: string[] = [];
      const ids = new Set<string>();
      // Compare what is drawn, rather than offscreen portions of scrolled controls.
      const visibleBox = (el: Element) => {
        const rect = el.getBoundingClientRect();
        let left = rect.left,
          right = rect.right,
          top = rect.top,
          bottom = rect.bottom;
        let ancestor = el.parentElement;
        while (ancestor) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          if (
            [style.overflowX, style.overflow].some((value) =>
              ["auto", "scroll", "hidden", "clip"].includes(value),
            )
          ) {
            left = Math.max(left, bounds.left);
            right = Math.min(right, bounds.right);
          }
          if (
            [style.overflowY, style.overflow].some((value) =>
              ["auto", "scroll", "hidden", "clip"].includes(value),
            )
          ) {
            top = Math.max(top, bounds.top);
            bottom = Math.min(bottom, bounds.bottom);
          }
          ancestor = ancestor.parentElement;
        }
        return {
          left,
          right,
          top,
          bottom,
          width: right - left,
          height: bottom - top,
        };
      };
      const visible = (el: Element): boolean => {
        const rect = visibleBox(el);
        return (
          el.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          }) &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < innerWidth &&
          rect.top < innerHeight
        );
      };
      const allowedIds = new Set<string>(policy.currentIds);
      const current = (id: string): boolean => allowedIds.has(id);
      const resolveText = (
        id: string,
        part: string,
        values: Record<string, string | number>,
      ): string => {
        const row = rows[id];
        if (!row || !current(id)) {
          errors.push(`unknown/future text ${id}`);
          return "";
        }
        const source =
          part === "tooltip"
            ? row.tooltip
            : part === "key"
              ? row.key
              : row.text || row.label;
        return source.replace(/\{([a-z]+)\}/g, (_, key: string) =>
          String(values[key]),
        );
      };
      const stage = document.querySelector("#gallery-stage");
      if (!stage) throw new Error("Missing gallery stage");
      for (const el of stage.querySelectorAll<HTMLElement>("[data-ui]")) {
        if (!visible(el)) continue;
        const id = el.dataset.ui!;
        ids.add(id);
        if (!current(id)) errors.push(`unknown/future control ${id}`);
        const name = el.getAttribute("aria-label");
        if (name) {
          const row = rows[id];
          const allowed = row?.label || row?.text;
          if (name !== allowed && !content.includes(name))
            errors.push(`unlisted accessible name ${id}: ${name}`);
        }
      }
      const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
      for (
        let node = walker.nextNode();
        node !== null;
        node = walker.nextNode()
      ) {
        const text = node.textContent?.trim();
        const parent = node.parentElement;
        if (
          !text ||
          !parent ||
          !visible(parent) ||
          parent.closest("script,style,svg,option")
        )
          continue;
        const owner = parent.closest<HTMLElement>(
          "[data-text-id],[data-numeric],[data-content],[data-punctuation]",
        );
        if (!owner) errors.push(`unlisted drawn text: ${text}`);
        else if (owner.dataset.textId) {
          const id = owner.dataset.textId;
          ids.add(id);
          const expected = resolveText(
            id,
            owner.dataset.textPart ?? "main",
            JSON.parse(owner.dataset.textValues ?? "{}") as Record<
              string,
              string | number
            >,
          );
          if (owner.textContent !== expected)
            errors.push(
              `text mismatch ${id}: ${owner.textContent} != ${expected}`,
            );
        } else if (owner.dataset.numeric !== undefined) {
          if (
            !/^[−-]?\d+(?:\.\d+)?[kM]?$/.test(text) ||
            text !== owner.dataset.numeric
          )
            errors.push(`invalid numeric text ${text}`);
        } else if (owner.dataset.punctuation !== undefined) {
          if (owner.dataset.punctuation !== "middle-dot" || text !== "·")
            errors.push(`unlisted punctuation: ${text}`);
        } else if (!content.includes(text))
          errors.push(`unregistered content ${text}`);
        texts.push(text);
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        const lines = [...range.getClientRects()];
        // Catalogue A2 decision 100 permits natural wrapping in Tooltip only.
        if (lines.length > 1 && !parent.closest(".cf-tooltip[role=tooltip]"))
          errors.push(`unexpected wrapping: ${text}`);
        let ancestor: HTMLElement | null = parent;
        while (ancestor && ancestor !== stage) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          const scroll = [
            style.overflow,
            style.overflowX,
            style.overflowY,
          ].some((v) => v === "auto" || v === "scroll");
          if (scroll) break;
          if (
            [style.overflow, style.overflowX, style.overflowY].some(
              (v) => v === "hidden" || v === "clip",
            ) &&
            (box.left < bounds.left - 1 ||
              box.right > bounds.right + 1 ||
              box.top < bounds.top - 1 ||
              box.bottom > bounds.bottom + 1)
          )
            errors.push(`clipped text: ${text}`);
          ancestor = ancestor.parentElement;
        }
        if (!ancestor || ancestor === stage)
          if (
            box.left < -1 ||
            box.right > innerWidth + 1 ||
            box.top < -1 ||
            box.bottom > innerHeight + 1
          )
            errors.push(`text outside viewport: ${text}`);
      }
      const openLists = [
        ...stage.querySelectorAll<HTMLElement>('[role="listbox"]'),
      ];
      const controls = [
        ...stage.querySelectorAll<HTMLElement>("button,input,select,a"),
      ].filter(
        (el) =>
          visible(el) &&
          !openLists.some(
            (list) =>
              !list.contains(el) &&
              (() => {
                const box = el.getBoundingClientRect(),
                  cover = list.getBoundingClientRect();
                return (
                  box.left >= cover.left &&
                  box.right <= cover.right &&
                  box.top >= cover.top &&
                  box.bottom <= cover.bottom
                );
              })(),
          ),
      );
      const focusOutlines: {
        id: string;
        extent: number;
        contained: boolean;
        clips: { className: string; horizontal: boolean; vertical: boolean }[];
      }[] = [];
      const scale = Number(getComputedStyle(stage).zoom) || 1;
      for (const control of controls) {
        if (!control.matches(':focus-visible, [data-state="focus"]')) continue;
        const style = getComputedStyle(control);
        if (style.outlineStyle === "none") {
          errors.push(`missing focus outline: ${control.dataset.ui}`);
          continue;
        }
        const extent =
          (Number.parseFloat(style.outlineWidth) +
            Number.parseFloat(style.outlineOffset)) *
          scale;
        const bounds = control.getBoundingClientRect();
        const ring = {
          left: bounds.left - extent,
          right: bounds.right + extent,
          top: bounds.top - extent,
          bottom: bounds.bottom + extent,
        };
        let contained =
          ring.left >= 0 &&
          ring.top >= 0 &&
          ring.right <= innerWidth &&
          ring.bottom <= innerHeight;
        const clips: {
          className: string;
          horizontal: boolean;
          vertical: boolean;
        }[] = [];
        let ancestor = control.parentElement;
        while (ancestor) {
          const clipStyle = getComputedStyle(ancestor);
          const clipping = (value: string): boolean =>
            ["auto", "scroll", "hidden", "clip"].includes(value);
          const horizontal = clipping(clipStyle.overflowX);
          const vertical = clipping(clipStyle.overflowY);
          if (horizontal || vertical) {
            const clip = ancestor.getBoundingClientRect();
            const left = clip.left + ancestor.clientLeft * scale;
            const top = clip.top + ancestor.clientTop * scale;
            const right = left + ancestor.clientWidth * scale;
            const bottom = top + ancestor.clientHeight * scale;
            // clientWidth/clientHeight round to CSS pixels; half a scaled pixel
            // allows that rounding without accepting a whole clipped ring pixel.
            const tolerance = scale / 2;
            if (
              (horizontal &&
                (ring.left < left - tolerance ||
                  ring.right > right + tolerance)) ||
              (vertical &&
                (ring.top < top - tolerance ||
                  ring.bottom > bottom + tolerance))
            )
              contained = false;
            clips.push({ className: ancestor.className, horizontal, vertical });
          }
          ancestor = ancestor.parentElement;
        }
        focusOutlines.push({
          id: control.dataset.ui ?? "",
          extent,
          contained,
          clips,
        });
        if (!contained)
          errors.push(`clipped focus outline: ${control.dataset.ui}`);
      }
      const toastAnchors: {
        id: string;
        anchor: string;
        gap: number;
        expected: number;
      }[] = [];
      for (const toast of stage.querySelectorAll<HTMLElement>(
        ".cf-ui .cf-toast",
      )) {
        if (!visible(toast)) continue;
        if (!toast.classList.contains("cf-toast-anchored")) {
          errors.push("Game toast has no actual content anchor");
          continue;
        }
        const palette = toast
          .closest(".cf-palette-anchor")
          ?.querySelector<HTMLElement>(".cf-palette");
        const hotbar = toast.closest(".cf-hotbar-area");
        const name = hotbar?.querySelector<HTMLElement>(".cf-held-name");
        const anchor =
          palette ??
          (name && visible(name)
            ? name
            : hotbar?.querySelector<HTMLElement>(".cf-hotbar"));
        if (!anchor) {
          errors.push("Game toast anchor is missing");
          continue;
        }
        const scale = Number(getComputedStyle(stage).zoom) || 1;
        const gap =
          anchor.getBoundingClientRect().top -
          toast.getBoundingClientRect().bottom;
        const expected = 16 * scale;
        toastAnchors.push({
          id: toast.dataset.ui ?? "",
          anchor: palette
            ? "palette"
            : name && visible(name)
              ? "held-name"
              : "hotbar",
          gap,
          expected,
        });
        if (Math.abs(gap - expected) > 1.5)
          errors.push(`Toast gap ${gap} does not match ${expected}`);
      }
      for (let a = 0; a < controls.length; a++)
        for (let b = a + 1; b < controls.length; b++) {
          const x = controls[a]!;
          const y = controls[b]!;
          if (x.contains(y) || y.contains(x)) continue;
          // An open Select is an intentional overlay; siblings inside that
          // same list are still audited against one another, as usual.
          const xList = x.closest('.cf-select-list[role="listbox"]');
          const yList = y.closest('.cf-select-list[role="listbox"]');
          if (xList !== yList && (xList || yList)) continue;
          const r = visibleBox(x);
          const s = visibleBox(y);
          if (
            Math.min(r.right, s.right) - Math.max(r.left, s.left) > 1 &&
            Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) > 1
          )
            errors.push(`overlapping controls ${x.dataset.ui}/${y.dataset.ui}`);
        }
      let discoveryEvidence: unknown = null;
      const discovery = stage.querySelector<HTMLElement>("[data-discovery]");
      if (discovery) {
        const style = getComputedStyle(discovery);
        const probe = document.createElement("span");
        probe.style.color = "var(--ink-0)";
        probe.style.paintOrder = "stroke fill";
        stage.append(probe);
        const expectedStroke = getComputedStyle(probe).color;
        const expectedPaintOrder = getComputedStyle(probe).paintOrder;
        probe.remove();
        const animations = discovery.getAnimations().map((animation) => ({
          currentTime: animation.currentTime,
          playState: animation.playState,
          duration: animation.effect?.getTiming().duration,
        }));
        const opacity = Number(style.opacity),
          strokeWidth = Number.parseFloat(style.webkitTextStrokeWidth),
          strokeColor = style.webkitTextStrokeColor;
        if (stage.querySelector("[data-discovery-backdrop]")) {
          if (Math.abs(opacity - 1) > 0.001)
            errors.push(
              "Discovery contrast fixture is not at full hold opacity",
            );
          if (
            animations.length !== 1 ||
            animations.some(
              (animation) =>
                typeof animation.currentTime !== "number" ||
                animation.currentTime < 300 ||
                animation.currentTime > 4300 ||
                animation.duration !== 4600,
            )
          )
            errors.push(
              "Discovery contrast fixture is outside its documented hold interval",
            );
          if (
            strokeWidth !== 1 ||
            strokeColor !== expectedStroke ||
            style.paintOrder !== expectedPaintOrder
          )
            errors.push(
              "Discovery glyph contrast treatment does not match Card rule",
            );
        }
        discoveryEvidence = {
          capturedAt: Date.now(),
          performanceTime: performance.now(),
          opacity,
          strokeWidth,
          strokeColor,
          paintOrder: style.paintOrder,
          animations,
        };
      }
      let mapEvidence: unknown = null;
      const regionNames = [
        ...stage.querySelectorAll<HTMLElement>(
          '[data-ui="f3.region"] [data-content]',
        ),
      ];
      if (
        regionNames.some(
          (element) =>
            Math.abs(
              element.getBoundingClientRect().top -
                regionNames[0]!.getBoundingClientRect().top,
            ) > 1,
        )
      )
        errors.push("F3 Region weights span more than one line");
      const mapCanvas = stage.querySelector<HTMLCanvasElement>(
        '[data-ui="map.view"]',
      );
      if (mapCanvas) {
        const data = mapCanvas.dataset,
          scale = Number(data.mapScale),
          width = Number(data.mapWidth),
          height = Number(data.mapHeight),
          rect = mapCanvas.getBoundingClientRect();
        const legend = stage.querySelector<HTMLElement>(
            '[data-ui="map.scale"]',
          ),
          line = legend?.querySelector<HTMLElement>(".cf-map-scale-line");
        const metres = Number(legend?.dataset.mapMetres),
          linePixels = line
            ? line.getBoundingClientRect().width /
              (Number(getComputedStyle(stage).zoom) || 1)
            : 0;
        if (data.mapReady !== "true") errors.push("Map frame not ready");
        if (!Number.isFinite(scale) || scale < 0.999)
          errors.push("Map zoom is below1m/pixel");
        if (Math.abs(linePixels - metres / scale) > 1)
          errors.push("Map scale bar does not match actual metres per pixel");
        const context = mapCanvas.getContext("2d");
        let drawnSamples = 0;
        if (context && mapCanvas.width && mapCanvas.height)
          for (let row = 1; row < 8; row++)
            for (let column = 1; column < 8; column++)
              if (
                context.getImageData(
                  Math.floor((mapCanvas.width * column) / 8),
                  Math.floor((mapCanvas.height * row) / 8),
                  1,
                  1,
                ).data[3]
              )
                drawnSamples++;
        if (!drawnSamples) errors.push("Map canvas is blank");
        const labelElements = [
          ...stage.querySelectorAll<HTMLElement>("[data-map-label]"),
        ];
        const labelRects = labelElements.map((element) => {
          const box = element.getBoundingClientRect();
          return {
            id: element.dataset.mapLabel,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          };
        });
        const expectedLabels = Number(
          stage.querySelector<HTMLElement>("[data-map-label-count]")?.dataset
            .mapLabelCount,
        );
        if (labelRects.length !== expectedLabels)
          errors.push("Map omitted an on-screen anchor's name");
        for (let i = 0; i < labelElements.length; i++) {
          const a = labelElements[i]!.getBoundingClientRect();
          if (
            a.left < rect.left ||
            a.right > rect.right ||
            a.top < rect.top ||
            a.bottom > rect.bottom
          )
            errors.push("Map label clips at viewport");
          for (let j = i + 1; j < labelElements.length; j++) {
            const b = labelElements[j]!.getBoundingClientRect();
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
            )
              errors.push(
                `Map names overlap ${labelElements[i]!.dataset.mapLabel}/${labelElements[j]!.dataset.mapLabel}`,
              );
          }
        }
        const marker = stage.querySelector<HTMLElement>('[data-ui="map.pin"]');
        let pinError: number | null = null;
        if (marker && visible(marker)) {
          const bounds = marker.getBoundingClientRect();
          const x =
            (((Number(data.mapPinX) - Number(data.mapX)) / scale + width / 2) *
              rect.width) /
              width +
            rect.left;
          const y =
            (((Number(data.mapPinZ) - Number(data.mapZ)) / scale + height / 2) *
              rect.height) /
              height +
            rect.top;
          pinError = Math.hypot(
            x - (bounds.left + bounds.width / 2),
            y - (bounds.top + bounds.height / 2),
          );
          if (pinError > 2)
            errors.push("Map pin diverges from its chosen world point");
        }
        mapEvidence = {
          metresPerPixel: scale,
          metres,
          linePixels,
          drawnSamples,
          pinError,
          labelRects,
          expectedLabels,
          scope:
            "Map component against the declared gallery port; not real-world geography acceptance",
        };
      }
      return {
        errors: [...new Set(errors)],
        texts: [...new Set(texts)],
        visibleIds: [...ids],
        crossOriginIsolated,
        dimensions: { width: innerWidth, height: innerHeight },
        toastAnchors,
        focusOutlines,
        phase: policy.phase,
        mapEvidence,
        discoveryEvidence,
      };
    },
    { rows: catalogue, content: [...sampleContent], policy: auditPolicy() },
  );
}
export async function inspectKeys(page: Page, closeable: boolean) {
  const blocking = page.locator("[data-blocking], [role=dialog]").last();
  if ((await blocking.count()) === 0)
    return {
      applicable: false,
      order: [] as string[],
      errors: [] as string[],
      escapeSteps: [],
    };
  const expected = await blocking
    .locator(
      'button:not(:disabled):not([tabindex="-1"]),input:not(:disabled),select:not(:disabled),a[href]',
    )
    .evaluateAll((elements) =>
      elements.map((element, index) => ({
        id: (element as HTMLElement).dataset.ui ?? `control-${index}`,
        index,
      })),
    );
  const errors: string[] = [];
  const order: string[] = [];
  const escapeSteps: unknown[] = [];
  const escapeState = () =>
    page.evaluate(() => {
      const blockers = [
        ...document.querySelectorAll<HTMLElement>(
          "[data-blocking], [role=dialog]",
        ),
      ];
      const focused = document.activeElement as HTMLElement | null;
      return {
        blockingCount: blockers.length,
        blockingControls: blockers.map((blocker) =>
          [...blocker.querySelectorAll<HTMLElement>("[data-ui]")].map(
            (element) => element.dataset.ui,
          ),
        ),
        focused: {
          tag: focused?.tagName ?? null,
          id: focused?.dataset.ui ?? null,
          type: focused instanceof HTMLInputElement ? focused.type : null,
        },
        fieldFocused:
          focused instanceof HTMLInputElement &&
          !["range", "checkbox"].includes(focused.type),
        tooltipVisible: [...document.querySelectorAll("[role=tooltip]")].some(
          (element) =>
            element.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            }),
        ),
      };
    });
  if (expected.length) {
    await blocking
      .locator(
        'button:not(:disabled):not([tabindex="-1"]),input:not(:disabled),select:not(:disabled),a[href]',
      )
      .first()
      .focus();
    for (let i = 0; i < expected.length; i++) {
      const actual = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset.ui ?? "",
      );
      order.push(actual);
      if (actual !== expected[i]!.id)
        errors.push(`Tab order ${i}: ${actual} expected ${expected[i]!.id}`);
      await page.keyboard.press("Tab");
    }
    await page.keyboard.press("Shift+Tab");
    const last = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.ui ?? "",
    );
    if (last !== expected.at(-1)!.id)
      errors.push("Shift+Tab did not return to the last control");
  }
  if (closeable) {
    // Exercise the actual A4 stack, not merely a screen with nothing above it.
    // Every palette state first gives its search editor focus; a non-empty
    // palette then opens a block tooltip while that editor still owns focus.
    const field = blocking
      .locator('input:not([type="range"]):not([type="checkbox"])')
      .first();
    if (await field.count()) await field.focus();
    const tooltipTarget = blocking
      .locator('[data-content-name], [data-ui="menu.licences"]')
      .last();
    const expectsTooltip = (await tooltipTarget.count()) > 0;
    if (expectsTooltip) {
      await page.mouse.move(0, 0);
      await tooltipTarget.hover();
    }
    await page.waitForTimeout(450);
    let before = await escapeState();
    if (expectsTooltip && !before.tooltipVisible)
      errors.push("A4 tooltip layer did not appear before the Escape probe");
    if (before.tooltipVisible) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(30);
      const after = await escapeState();
      const passed =
        !after.tooltipVisible &&
        after.blockingCount === before.blockingCount &&
        after.fieldFocused === before.fieldFocused;
      escapeSteps.push({
        key: "Escape",
        expected: "tooltip-dismissed",
        before,
        after,
        outcome: passed ? "tooltip-dismissed" : "failed",
      });
      if (!passed) errors.push("Esc did not dismiss only the tooltip");
      before = after;
    }
    if (before.fieldFocused) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(30);
      const after = await escapeState();
      const passed =
        !after.fieldFocused && after.blockingCount === before.blockingCount;
      escapeSteps.push({
        key: "Escape",
        expected: "field-released",
        before,
        after,
        outcome: passed ? "field-released" : "failed",
      });
      if (!passed) errors.push("Esc did not release only the focused field");
      before = after;
    }
    await page.keyboard.press("Escape");
    try {
      await page.waitForFunction(
        () => !document.querySelector("[data-blocking], [role=dialog]"),
        null,
        { timeout: 1000 },
      );
    } catch {
      errors.push("Esc did not close the blocking screen");
    }
    const after = await escapeState();
    escapeSteps.push({
      key: "Escape",
      expected: "screen-dismissed",
      before,
      after,
      outcome: after.blockingCount === 0 ? "screen-dismissed" : "failed",
    });
  }
  return { applicable: true, order, escapeSteps, errors };
}
