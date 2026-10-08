/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { type CatalogueId, numeric, type TextValues, t } from "../t";
export function Text({
  id,
  values,
  part = "main",
}: {
  id: CatalogueId;
  values?: TextValues | undefined;
  part?: "main" | "tooltip" | "key";
}) {
  return (
    <span
      data-text-id={id}
      data-text-part={part}
      data-text-values={JSON.stringify(values ?? {})}
    >
      {t(id, values, part)}
    </span>
  );
}
export function ContentText({ value }: { value: string }) {
  return <span data-content={value}>{value}</span>;
}
/** D7 requires this separator between coordinates and the region name. */
export function Punctuation({ kind }: { kind: "middle-dot" }) {
  return <span data-punctuation={kind}>·</span>;
}
export function Value({
  value,
  style = "integer",
}: {
  value: number;
  style?: "integer" | "one" | "compact" | "weight";
}) {
  const text = numeric(value, style);
  return <span data-numeric={text}>{text}</span>;
}
export function Stat({
  id,
  children,
}: {
  id: CatalogueId;
  children: ComponentChildren;
}) {
  return (
    <div class="cf-stat" data-ui={id}>
      <Text id={id} />
      <span class="cf-stat-value">{children}</span>
    </div>
  );
}
