/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { type CatalogueId, catalogue, type TextValues, t } from "../t";
import { ContentText, Text, Value } from "./Text";
export type ForcedState =
  | "rest"
  | "hover"
  | "pressed"
  | "focus"
  | "selected"
  | "disabled"
  | "pending";
type Base = { id: CatalogueId; state?: ForcedState; disabled?: boolean };
export function Panel({
  children,
  className = "",
  modal = false,
}: {
  children: ComponentChildren;
  className?: string;
  modal?: boolean;
}) {
  if (modal)
    return (
      <div class={`cf-panel ${className}`} role="dialog" aria-modal="true">
        {children}
      </div>
    );
  return <section class={`cf-panel ${className}`}>{children}</section>;
}
export function Button({
  id,
  onClick,
  kind = "secondary",
  state = "rest",
  disabled = false,
  values,
}: Base & {
  onClick?: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  values?: TextValues | undefined;
}) {
  return (
    <button
      type="button"
      class={`cf-button cf-${kind}`}
      data-ui={id}
      data-state={state}
      disabled={disabled || state === "disabled"}
      onClick={onClick}
    >
      <Text id={id} values={values} />
    </button>
  );
}
export function IconButton({
  id,
  onClick,
  children,
  state = "rest",
  disabled = false,
}: Base & { onClick: () => void; children: ComponentChildren }) {
  return (
    <button
      type="button"
      class="cf-icon-button"
      data-ui={id}
      data-state={disabled ? "disabled" : state}
      disabled={disabled || state === "disabled"}
      aria-busy={state === "pending" || undefined}
      aria-label={t(id)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Field({
  id,
  value,
  onChange,
  digits = false,
  placeholder = false,
  state = "rest",
  disabled = false,
}: Base & {
  value: string;
  onChange: (value: string) => void;
  digits?: boolean;
  placeholder?: boolean;
}) {
  const inputId = useId();
  const input = (
    <input
      id={inputId}
      class="cf-field"
      data-ui={id}
      data-state={disabled ? "disabled" : state}
      disabled={disabled || state === "disabled"}
      aria-busy={state === "pending" || undefined}
      aria-label={t(id)}
      inputMode={digits ? "numeric" : "text"}
      value={value}
      placeholder={placeholder ? t(id) : undefined}
      onInput={(event) => {
        const next = event.currentTarget.value;
        if (!digits || /^\d*$/.test(next)) onChange(next);
        else event.currentTarget.value = value;
      }}
      onKeyUp={(event) => {
        if (event.key === "Home") event.currentTarget.scrollLeft = 0;
        else if (event.key === "End")
          event.currentTarget.scrollLeft = event.currentTarget.scrollWidth;
      }}
    />
  );
  return placeholder ? (
    input
  ) : (
    <label
      class="cf-field-row"
      htmlFor={inputId}
      data-disabled={disabled || state === "disabled"}
    >
      <Text id={id} />
      {input}
    </label>
  );
}
export function Toggle({
  id,
  checked,
  onChange,
  state = "rest",
  disabled = false,
}: Base & { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label
      class="cf-control-row"
      data-disabled={disabled || state === "disabled"}
    >
      <Text id={id} />
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        class="cf-toggle"
        data-ui={id}
        data-state={disabled ? "disabled" : state}
        disabled={disabled || state === "disabled"}
        aria-busy={state === "pending" || undefined}
        aria-label={t(id)}
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}
export function Slider({
  id,
  value,
  min = 0,
  max = 24,
  defaultValue = 12,
  onChange,
  state = "rest",
  disabled = false,
}: Base & {
  value: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label
      class="cf-control-row cf-slider-row"
      data-disabled={disabled || state === "disabled"}
    >
      <Text id={id} />
      <input
        type="range"
        class="cf-slider"
        data-ui={id}
        data-state={disabled ? "disabled" : state}
        disabled={disabled || state === "disabled"}
        aria-busy={state === "pending" || undefined}
        aria-label={t(id)}
        min={min}
        max={max}
        step="0.1"
        value={value}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
        onDblClick={() => onChange(defaultValue)}
        onKeyDown={(event) => {
          if (
            event.shiftKey &&
            (event.key === "ArrowLeft" || event.key === "ArrowRight")
          ) {
            event.preventDefault();
            onChange(
              Math.min(
                max,
                Math.max(min, value + (event.key === "ArrowRight" ? 1 : -1)),
              ),
            );
          }
        }}
      />
      <span class="cf-slider-value">
        <Value value={value} style="one" /> <Text id="unit.h" />
      </span>
    </label>
  );
}
export function Bar({ id, value }: Base & { value: number }) {
  return (
    <div
      class="cf-bar"
      data-ui={id}
      role="progressbar"
      aria-label={t(id)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }} />
    </div>
  );
}
export function Slot({
  id,
  name,
  icon,
  selected = false,
  state = selected ? "selected" : "rest",
  disabled = false,
  onClick,
  onNumber,
}: {
  id: CatalogueId;
  name?: string | undefined;
  icon?: string | undefined;
  selected?: boolean;
  state?: ForcedState;
  disabled?: boolean;
  onClick?: () => void;
  onNumber?: (index: number) => void;
}) {
  return (
    <button
      type="button"
      class="cf-slot"
      data-ui={id}
      data-state={disabled ? "disabled" : state}
      disabled={disabled || state === "disabled"}
      aria-busy={state === "pending" || undefined}
      aria-label={name ? t("hud.item", { item: name }) : t(id)}
      data-content-name={name}
      onClick={onClick}
      onKeyDown={(event) => {
        if (/^[1-9]$/.test(event.key) && onNumber) {
          event.preventDefault();
          onNumber(Number(event.key) - 1);
        }
      }}
    >
      {icon && <img src={icon} alt="" aria-hidden="true" />}
    </button>
  );
}
export function Keycap({ id }: Base) {
  return (
    <kbd class="cf-keycap" data-ui={id}>
      <Text id={id} />
    </kbd>
  );
}
export function Tooltip({
  id,
  values,
  visible = false,
}: {
  id: CatalogueId;
  values?: TextValues | undefined;
  visible?: boolean;
}) {
  const row = catalogue[id];
  return (
    <div
      class="cf-tooltip"
      role="tooltip"
      data-tooltip-for={id}
      data-visible={visible}
    >
      {row.type === "icon" && <Text id={id} values={values} />}
      {row.tooltip && <Text id={id} part="tooltip" values={values} />}{" "}
      {row.key && (
        <kbd class="cf-keycap">
          <Text id={id} part="key" />
        </kbd>
      )}
    </div>
  );
}
export function Toast({
  id,
  values,
  anchored = false,
}: {
  id: "toast.shot" | "toast.fly" | "toast.windowed";
  values?: TextValues | undefined;
  anchored?: boolean;
}) {
  return (
    <div
      class={`cf-toast${anchored ? " cf-toast-anchored" : ""}`}
      data-ui={id}
      role="status"
    >
      <Text id={id} values={values} />
    </div>
  );
}
export function Banner({
  id,
  children,
}: {
  id: "sys.storage" | "sys.context" | "sys.update";
  children?: ComponentChildren;
}) {
  return (
    <div class="cf-banner" data-ui={id} role="status">
      <Text id={id} />
      {children}
    </div>
  );
}
export function Modal({
  children,
  onClose,
  exiting = false,
}: {
  children: ComponentChildren;
  onClose: () => void;
  exiting?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    target?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      class="cf-modal-layer"
      role="dialog"
      aria-modal="true"
      data-exiting={exiting}
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Tab") {
          const controls = [
            ...(ref.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) ?? []),
          ];
          const at = controls.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            (at + (event.shiftKey ? -1 : 1) + controls.length) %
            controls.length;
          event.preventDefault();
          controls[next]?.focus();
        }
      }}
    >
      <div class="cf-dimmer" />
      <Panel className="cf-modal">{children}</Panel>
    </div>
  );
}
export function Spinner({ pending }: { pending: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    if (!pending) return;
    const timer = setTimeout(() => setShown(true), 400);
    return () => clearTimeout(timer);
  }, [pending]);
  return shown ? <i class="cf-spinner" aria-hidden="true" /> : null;
}
export function Row({
  id,
  children,
  onClick,
  selected = false,
}: Base & {
  children: ComponentChildren;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <button
      class="cf-row"
      type="button"
      data-ui={id}
      data-state={selected ? "selected" : "rest"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Chip({ children }: { children: ComponentChildren }) {
  return <span class="cf-chip">{children}</span>;
}
export function Note({ id }: Base) {
  return (
    <span class="cf-note" data-ui={id}>
      <Text id={id} />
    </span>
  );
}
export function Card({ children }: { children: ComponentChildren }) {
  return <div class="cf-card">{children}</div>;
}
export function Alert({ id }: Base) {
  return (
    <div class="cf-alert" data-ui={id}>
      <Text id={id} />
    </div>
  );
}
export { Select, type SelectOption } from "./Select";
export function Segmented({
  id,
  ids,
  selected,
  onChange,
}: {
  id?: CatalogueId;
  ids: readonly CatalogueId[];
  selected: CatalogueId;
  onChange: (id: CatalogueId) => void;
}) {
  const control = (
    <fieldset class="cf-segmented" aria-label={id ? t(id) : undefined}>
      {ids.map((id) => (
        <Button
          key={id}
          id={id}
          kind="ghost"
          state={selected === id ? "selected" : "rest"}
          onClick={() => onChange(id)}
        />
      ))}
    </fieldset>
  );
  return id ? (
    <div class="cf-control-row" data-ui={id}>
      <Text id={id} />
      {control}
    </div>
  ) : (
    control
  );
}
export function Tabs({
  ids,
  selected,
  onChange,
}: {
  ids: readonly CatalogueId[];
  selected: CatalogueId;
  onChange: (id: CatalogueId) => void;
}) {
  return (
    <div class="cf-tabs" role="tablist">
      {ids.map((id) => (
        <button
          role="tab"
          type="button"
          aria-selected={id === selected}
          data-ui={id}
          onClick={() => onChange(id)}
          key={id}
        >
          <Text id={id} />
        </button>
      ))}
    </div>
  );
}
export function Stepper({
  id,
  value,
  onChange,
}: Base & { value: number; onChange: (value: number) => void }) {
  return (
    <label class="cf-control-row">
      <Text id={id} />
      <input
        class="cf-stepper"
        type="number"
        data-ui={id}
        aria-label={t(id)}
        value={value}
        onInput={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}
export function Table({
  rows,
}: {
  rows: readonly (readonly [string, number])[];
}) {
  return (
    <table class="cf-table">
      <tbody>
        {rows.map(([name, value]) => (
          <tr key={name}>
            <td>
              <ContentText value={name} />
            </td>
            <td>
              <Value value={value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function Wheel({ children }: { children: ComponentChildren }) {
  return <div class="cf-wheel">{children}</div>;
}
