/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { Shuffle } from "lucide";
import { createElement } from "preact";
export function RandomSeedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {Shuffle.map(([tag, attributes], index) =>
        createElement(tag, { ...attributes, key: index }),
      )}
    </svg>
  );
}
