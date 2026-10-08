/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
/** Retains only the outgoing picture; input state changes immediately. */
export function Presence({
  visible,
  leaveMs,
  children,
}: {
  visible: boolean;
  leaveMs: number;
  children: (leaving: boolean) => ComponentChildren;
}) {
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const reduced =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setMounted(false), reduced ? 0 : leaveMs);
    return () => clearTimeout(timer);
  }, [visible, mounted, leaveMs]);
  return visible || mounted ? children(!visible) : null;
}
