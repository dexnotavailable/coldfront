import type { CatalogueId } from "./ids.gen";
import { UI_PHASE } from "./phase";
import rows from "./strings.gen.json";

export type { CatalogueId } from "./ids.gen";
export type TextValues = Readonly<Record<string, string | number>>;
export const catalogue = rows;
export function phaseOrder(value: string): number {
  return value.startsWith("M")
    ? 100 + Number(value.slice(1))
    : Number(value.split(".")[0]) * 20 + Number(value.split(".")[1]);
}
export function currentId(id: string): id is CatalogueId {
  return (
    Object.hasOwn(rows, id) &&
    phaseOrder(rows[id as CatalogueId].since) <= phaseOrder(UI_PHASE)
  );
}
export function t(
  id: CatalogueId,
  values: TextValues = {},
  part: "main" | "tooltip" | "key" = "main",
): string {
  if (!currentId(id))
    throw new Error(`Catalogue row is not available in ${UI_PHASE}: ${id}`);
  const row = rows[id];
  const source = part === "main" ? row.text || row.label : row[part];
  return source.replace(/\{([a-z]+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined)
      throw new Error(`Missing substitution ${id}.${key}`);
    return String(value);
  });
}
export function compact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const n = Math.abs(value);
  if (n < 1000) return `${sign}${Math.round(n)}`;
  const div = n < 1_000_000 ? 1000 : 1_000_000;
  return `${sign}${Number((n / div).toPrecision(3))}${div === 1000 ? "k" : "M"}`;
}
export function numeric(
  value: number,
  style: "integer" | "one" | "compact" | "weight" = "integer",
): string {
  if (!Number.isFinite(value)) throw new Error("Non-finite UI number");
  return style === "one"
    ? value.toFixed(1).replace("-", "−")
    : style === "weight"
      ? String(Math.round(value * 1000) / 1000)
      : style === "compact"
        ? compact(value)
        : String(Math.round(value));
}
