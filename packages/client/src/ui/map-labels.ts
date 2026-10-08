/** Measured screen-space label placement; input geographic anchors stay intact. */
export interface LabelBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface LabelObstacle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export function labelsOverlap(
  a: LabelObstacle,
  b: LabelObstacle,
  gap = 0,
): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + gap
  );
}
/** Each candidate touches an anchor, viewport boundary, or placed rectangle edge.
 * Choose the nearest free rectangle, with stable IDs breaking ties. Never omit
 * an on-screen anchor merely because another name occupies the same pixels. */
export function layoutMapLabels(
  labels: readonly LabelBox[],
  size: { readonly width: number; readonly height: number },
  margin: number,
  gap: number,
  obstacles: readonly LabelObstacle[] = [],
): LabelBox[] {
  const placed: LabelBox[] = [];
  const occupied: LabelObstacle[] = [...obstacles];
  const ordered = [...labels].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
  );
  for (const label of ordered) {
    const minX = margin + label.width / 2,
      maxX = size.width - minX;
    const minY = margin + label.height / 2,
      maxY = size.height - minY;
    const clampX = (x: number) => Math.max(minX, Math.min(maxX, x));
    const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
    const xs = new Set([clampX(label.x), minX, maxX]);
    const ys = new Set([clampY(label.y), minY, maxY]);
    for (const other of occupied) {
      xs.add(clampX(other.x - (other.width + label.width) / 2 - gap));
      xs.add(clampX(other.x + (other.width + label.width) / 2 + gap));
      ys.add(clampY(other.y - (other.height + label.height) / 2 - gap));
      ys.add(clampY(other.y + (other.height + label.height) / 2 + gap));
    }
    let best: LabelBox | undefined,
      score = Infinity;
    for (const y of ys)
      for (const x of xs) {
        const candidate = { ...label, x, y };
        if (
          occupied.some((other) => labelsOverlap(candidate, other, gap - 0.01))
        )
          continue;
        const distance = (x - label.x) ** 2 + (y - label.y) ** 2;
        if (distance < score) {
          best = candidate;
          score = distance;
        }
      }
    // Sixteen one-line surface names fit in the smallest supported viewport.
    // A full-height ordered stack is the deterministic escape from a fragmented
    // greedy packing, preserving every name instead of silently dropping one.
    if (!best) {
      const total =
        ordered.reduce((sum, item) => sum + item.height, 0) +
        gap * (ordered.length - 1);
      let top = Math.max(margin, (size.height - total) / 2);
      return ordered.map((item) => {
        const y = top + item.height / 2;
        top += item.height + gap;
        const lo = margin + item.width / 2,
          hi = size.width - margin - item.width / 2;
        const clamp = (x: number) => Math.max(lo, Math.min(hi, x));
        const xs = [
          clamp(item.x),
          lo,
          hi,
          ...obstacles.flatMap((other) => [
            clamp(other.x - (other.width + item.width) / 2 - gap),
            clamp(other.x + (other.width + item.width) / 2 + gap),
          ]),
        ].sort((a, b) => Math.abs(a - item.x) - Math.abs(b - item.x));
        const x =
          xs.find(
            (x) =>
              !obstacles.some((other) =>
                labelsOverlap({ ...item, x, y }, other, gap - 0.01),
              ),
          ) ?? clamp(item.x);
        return { ...item, x, y };
      });
    }
    placed.push(best);
    occupied.push(best);
  }
  return placed;
}
