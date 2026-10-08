/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useEffect, useRef, useState } from "preact/hooks";
import { type CatalogueId, catalogue, currentId } from "../t";
import { Tooltip } from "./core";
import { ContentText } from "./Text";

interface Target {
  id: CatalogueId;
  content: string | null;
  left: number;
  top: number;
  above: boolean;
}
let activeDismiss: (() => boolean) | undefined;
/** The production input arbiter calls this before handling its next Esc layer. */
export function dismissTooltip(): boolean {
  return activeDismiss?.() ?? false;
}
export function TooltipHost({
  externalInput = false,
}: {
  externalInput?: boolean;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const lastClosed = useRef(-1000);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let element: HTMLElement | null = null;
    let fromKeyboard = false;
    let shown = false;
    const hide = (): void => {
      const wasShown = shown;
      clearTimeout(timer);
      element = null;
      shown = false;
      setTarget(null);
      if (wasShown) lastClosed.current = performance.now();
    };
    const dismiss = (): boolean => {
      const wasShown = shown;
      hide();
      return wasShown;
    };
    activeDismiss = dismiss;
    const show = (next: HTMLElement | null): void => {
      if (next === element) return;
      clearTimeout(timer);
      shown = false;
      setTarget(null);
      element = next;
      if (!next) return;
      const id = next.dataset.ui;
      if (!id || !currentId(id)) return;
      const row = catalogue[id];
      const content = next.dataset.contentName ?? null;
      if (!row.tooltip && row.type !== "icon" && !row.key && !content) return;
      timer = setTimeout(
        () => {
          if (!next.isConnected) return;
          const rect = next.getBoundingClientRect();
          const stage = document.getElementById("gallery-stage");
          const scale = stage ? Number(getComputedStyle(stage).zoom) || 1 : 1;
          const tooltipWidth =
            Number.parseFloat(
              getComputedStyle(next).getPropertyValue("--w-tooltip"),
            ) || 280;
          const above = rect.top > innerHeight / 2;
          shown = true;
          setTarget({
            id,
            content,
            left: Math.max(
              8,
              Math.min(
                rect.left / scale,
                innerWidth / scale - tooltipWidth - 8,
              ),
            ),
            top: above ? rect.top / scale - 8 : rect.bottom / scale + 8,
            above,
          });
        },
        performance.now() - lastClosed.current < 500 ? 0 : 300,
      );
    };
    const hover = (event: PointerEvent): void =>
      show((event.target as Element).closest<HTMLElement>("[data-ui]"));
    const focus = (event: FocusEvent): void => {
      if (fromKeyboard)
        show((event.target as Element).closest<HTMLElement>("[data-ui]"));
    };
    const keys = (event: KeyboardEvent): void => {
      fromKeyboard = event.key === "Tab";
      if (!externalInput && event.key === "Escape" && element) {
        const wasShown = shown;
        hide();
        if (wasShown) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
    };
    document.addEventListener("pointerover", hover);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", focus);
    document.addEventListener("keydown", keys, true);
    return () => {
      clearTimeout(timer);
      if (activeDismiss === dismiss) activeDismiss = undefined;
      document.removeEventListener("pointerover", hover);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("keydown", keys, true);
    };
  }, [externalInput]);
  return target ? (
    <div
      class="cf-tooltip-anchor"
      data-above={target.above}
      style={{ left: `${target.left}px`, top: `${target.top}px` }}
    >
      {target.content ? (
        <div class="cf-tooltip" role="tooltip" data-visible="true">
          <ContentText value={target.content} />
        </div>
      ) : (
        <Tooltip id={target.id} visible />
      )}
    </div>
  ) : null;
}
