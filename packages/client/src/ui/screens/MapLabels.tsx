/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { ContentText } from "../components/Text";
import {
  type LabelBox,
  type LabelObstacle,
  layoutMapLabels,
} from "../map-labels";
import type { MapSize } from "../map-math";

export interface MapLabelAnchor {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
}
export function MapLabels({
  anchors,
  size,
}: {
  anchors: readonly MapLabelAnchor[];
  size: MapSize;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<readonly LabelBox[]>([]);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const style = getComputedStyle(node),
        rect = node.getBoundingClientRect();
      const gap = Number.parseFloat(style.getPropertyValue("--s-1")),
        margin = Number.parseFloat(style.getPropertyValue("--s-2"));
      const labels = anchors.map((anchor) => {
        const element = [
          ...node.querySelectorAll<HTMLElement>("[data-map-label]"),
        ].find((item) => item.dataset.mapLabel === anchor.id);
        return {
          ...anchor,
          width: element?.offsetWidth ?? 0,
          height: element?.offsetHeight ?? 0,
        };
      });
      if (labels.some((label) => !label.width || !label.height)) return;
      const obstacles: LabelObstacle[] = [];
      for (const element of node
        .closest(".cf-map")
        ?.querySelectorAll<HTMLElement>(
          '[data-ui="map.close"],[data-ui="map.pin"][data-on-map="true"]',
        ) ?? []) {
        const box = element.getBoundingClientRect();
        obstacles.push({
          x: ((box.x + box.width / 2 - rect.x) * size.width) / rect.width,
          y: ((box.y + box.height / 2 - rect.y) * size.height) / rect.height,
          width: (box.width * size.width) / rect.width,
          height: (box.height * size.height) / rect.height,
        });
      }
      const next = layoutMapLabels(labels, size, margin, gap, obstacles);
      setPlaced((before) =>
        JSON.stringify(before) === JSON.stringify(next) ? before : next,
      );
    };
    measure();
    void document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    for (const element of node.querySelectorAll("[data-map-label]"))
      observer.observe(element);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [anchors, size]);
  return (
    <div ref={root} class="cf-map-labels" data-map-label-count={anchors.length}>
      {anchors.map((anchor) => {
        const at = placed.find((item) => item.id === anchor.id) ?? anchor;
        return (
          <span
            key={anchor.id}
            class="cf-map-label"
            data-map-label={anchor.id}
            data-anchor-x={anchor.x}
            data-anchor-y={anchor.y}
            style={{ left: `${at.x}px`, top: `${at.y}px` }}
          >
            <ContentText value={anchor.name} />
          </span>
        );
      })}
    </div>
  );
}
