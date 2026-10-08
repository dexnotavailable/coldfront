/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
export function Blocking({
  children,
  onClose,
  onEnter,
  dim = false,
  onKey,
}: {
  children: ComponentChildren;
  onClose?: (() => void) | undefined;
  onEnter?: (() => void) | undefined;
  dim?: boolean;
  onKey?: (event: KeyboardEvent) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("input,button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      class={`cf-blocking ${dim ? "cf-blocking-dim" : ""}`}
      data-blocking
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      ref={root}
      onKeyDown={(event) => {
        onKey?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Tab") {
          const controls = [
            ...(root.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
            ) ?? []),
          ];
          if (controls.length) {
            const at = controls.indexOf(document.activeElement as HTMLElement);
            event.preventDefault();
            controls[
              (at + (event.shiftKey ? -1 : 1) + controls.length) %
                controls.length
            ]?.focus();
          }
        }
        if (event.key === "Escape" && onClose) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (
          event.key === "Enter" &&
          onEnter &&
          !(event.target instanceof HTMLButtonElement)
        ) {
          event.preventDefault();
          onEnter();
        }
      }}
    >
      {dim && <div class="cf-dimmer" />}
      {children}
    </div>
  );
}
