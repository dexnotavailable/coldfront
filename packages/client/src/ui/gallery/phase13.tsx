/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useState } from "preact/hooks";
import { Segmented } from "../components/core";
import type { CatalogueId } from "../t";
import type { GalleryFixture } from "./registry";

function ViewFixture({ initial }: { initial: CatalogueId }) {
  const [selected, setSelected] = useState(initial);
  return (
    <div class="gallery-primitive">
      <Segmented
        id="tools.view"
        ids={["view.normal", "view.clay", "view.features"]}
        selected={selected}
        onChange={setSelected}
      />
    </div>
  );
}
export const phase13Fixtures: readonly GalleryFixture[] = (
  ["normal", "clay", "features"] as const
).map((mode) => ({
  id: `primitive-view-${mode}`,
  kind: "primitive",
  sampleContent: [],
  render: () => <ViewFixture initial={`view.${mode}`} />,
}));
