/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";
import { type CatalogueId, t } from "../t";
import type { ForcedState } from "./core";
import { ContentText, Text } from "./Text";

export type SelectOption<Value extends string = string> = Readonly<{
  value: Value;
  label:
    | Readonly<{ kind: "catalogue"; id: CatalogueId }>
    | Readonly<{ kind: "content"; name: string }>;
}>;

let activeDismiss: (() => boolean) | undefined;
/** A4: the sole keyboard arbiter calls this after dismissing a tooltip. */
export function dismissSelect(): boolean {
  return activeDismiss?.() ?? false;
}
function OptionText({ option }: { option: SelectOption }) {
  return option.label.kind === "catalogue" ? (
    <Text id={option.label.id} />
  ) : (
    <ContentText value={option.label.name} />
  );
}
export function Select<Value extends string>({
  id,
  value,
  options,
  onChange,
  state = "rest",
  disabled = false,
  initialOpen = false,
  releaseFocus = false,
}: {
  id: CatalogueId;
  value: Value;
  options: readonly SelectOption<Value>[];
  onChange: (value: Value) => void;
  state?: ForcedState;
  disabled?: boolean;
  /** Gallery uses the same real listbox in its forced-open fixture. */
  initialOpen?: boolean;
  /** Mouse-only panels release keys back to the world after choosing/closing. */
  releaseFocus?: boolean;
}) {
  const controlId = useId();
  const listId = `${controlId}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(initialOpen);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [active, setActive] = useState(Math.max(0, selectedIndex));
  const selected = options[selectedIndex];
  const unavailable = disabled || state === "disabled";
  if (new Set(options.map((option) => option.value)).size !== options.length)
    throw new Error(`Duplicate Select option values: ${id}`);
  for (const option of options)
    if (option.label.kind === "catalogue") t(option.label.id);
  const close = (restore = true): void => {
    setOpen(false);
    if (restore && !releaseFocus) trigger.current?.focus();
    else if (releaseFocus && root.current?.contains(document.activeElement))
      (document.activeElement as HTMLElement | null)?.blur();
  };
  const choose = (index: number): void => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const dismiss = (): boolean => {
      close();
      return true;
    };
    activeDismiss?.();
    activeDismiss = dismiss;
    const outside = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      if (activeDismiss === dismiss) activeDismiss = undefined;
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (open)
      list.current
        ?.querySelectorAll<HTMLButtonElement>("[role=option]")
        [active]?.focus();
  }, [open, active]);
  const key = (event: KeyboardEvent): void => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey)
      return;
    if (event.key === "Tab") {
      if (open) close(false);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (!open) {
        setActive(Math.max(0, selectedIndex));
        setOpen(true);
      } else if (event.key === "Enter" || event.key === " ") choose(active);
      else
        setActive(
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : (active +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  options.length) %
                options.length,
        );
    }
  };
  return (
    <div
      class="cf-control-row cf-select-control"
      ref={root}
      data-select-root
      data-select-open={open}
    >
      <label for={controlId}>
        <Text id={id} />
      </label>
      <div class="cf-select-box">
        <button
          ref={trigger}
          id={controlId}
          type="button"
          class="cf-select"
          data-ui={id}
          data-select-input
          data-state={state}
          disabled={unavailable}
          aria-label={t(id)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-busy={state === "pending" || undefined}
          onKeyDown={key}
          onClick={() => {
            setActive(Math.max(0, selectedIndex));
            setOpen(!open);
          }}
        >
          {selected && <OptionText option={selected} />}
        </button>
        {open && !unavailable && (
          <div
            ref={list}
            id={listId}
            class="cf-select-list"
            role="listbox"
            aria-label={t(id)}
            tabIndex={-1}
            onKeyDown={key}
            data-scroll
            data-select-input
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                class="cf-select-option"
                role="option"
                tabIndex={-1}
                aria-selected={option.value === value}
                data-state={option.value === value ? "selected" : "rest"}
                data-ui={
                  option.label.kind === "catalogue"
                    ? option.label.id
                    : undefined
                }
                data-content-name={
                  option.label.kind === "content"
                    ? option.label.name
                    : undefined
                }
                onClick={() => choose(index)}
              >
                <OptionText option={option} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
