/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useState } from "preact/hooks";
import { SURFACE_REGIONS } from "../../../../shared/src/world/regions";
import {
  type ForcedState,
  Select,
  type SelectOption,
} from "../components/core";
import {
  DiscoveryCard,
  type DiscoveryContent,
} from "../components/DiscoveryCard";
import { Text, Value } from "../components/Text";
import { TooltipHost } from "../components/TooltipHost";
import type { GalleryFixture } from "./registry";

export const worldOptions: readonly SelectOption<"main" | "test">[] = [
  { value: "main", label: { kind: "catalogue", id: "title.world.main" } },
  { value: "test", label: { kind: "catalogue", id: "title.world.test" } },
];
// Declared samples transcribed from world§2/lore§11; not an engine content table.
const discoveries: readonly DiscoveryContent[] = [
  {
    id: "hellscape",
    name: "Ibara",
    kanji: "茨",
    sentence:
      "Where the deep's heat broke through; the thorns are the underworld's roots pushing up.",
  },
  {
    id: "isles",
    name: "the Sundered Isles",
    sentence: "The land that fell upward.",
  },
  {
    id: "rim",
    name: "the Rim",
    sentence: "The Kaldfolk survive the Frost in halls deep in the ice.",
  },
  {
    id: "frost",
    name: "the Frost",
    sentence: "Nothing lives in the whiteout beyond the Rim.",
  },
];
const content = discoveries.flatMap((item) => [
  item.name,
  item.sentence,
  ...(item.kanji ? [item.kanji] : []),
]);
const regionOptions: readonly SelectOption[] = discoveries.map((item) => ({
  value: item.id,
  label: { kind: "content", name: item.name },
}));
const states: readonly ForcedState[] = [
  "rest",
  "hover",
  "pressed",
  "focus",
  "selected",
  "disabled",
  "pending",
];
function SelectMatrix() {
  return (
    <div class="gallery-primitive gallery-matrix">
      {states.map((state) => (
        <Select
          key={state}
          id="title.world"
          value={state === "selected" ? "test" : "main"}
          options={worldOptions}
          state={state}
          onChange={() => {}}
        />
      ))}
    </div>
  );
}
function SelectFixture({
  regions = false,
  open = false,
}: {
  regions?: boolean;
  open?: boolean;
}) {
  const [value, setValue] = useState(regions ? "hellscape" : "main");
  return (
    <>
      <div class="gallery-primitive gallery-select-open">
        <Select
          id={regions ? "tools.region" : "title.world"}
          value={value}
          options={regions ? regionOptions : worldOptions}
          onChange={setValue}
          initialOpen={open}
        />
      </div>
      <TooltipHost />
    </>
  );
}
function DistanceFixture() {
  return (
    <div class="gallery-primitive gallery-buttons">
      <span>
        <Value value={999} /> <Text id="unit.m" />
      </span>
      <span>
        <Value value={1} /> <Text id="unit.km" />
      </span>
    </div>
  );
}
export const phase12PrimitiveFixtures: readonly GalleryFixture[] = [
  ...(
    [
      { id: "snow", regionId: "tundra", backdrop: "bright" },
      { id: "dark", regionId: "tundra", backdrop: "dark" },
      { id: "long-snow", regionId: "hellscape", backdrop: "bright" },
    ] as const
  ).map((sample) => {
    const region = SURFACE_REGIONS.find((item) => item.id === sample.regionId)!;
    const card = {
      id: region.id,
      name: region.name,
      sentence: region.discoverySentence!,
      ...(region.kanji ? { kanji: region.kanji } : {}),
    };
    return {
      id: `primitive-discovery-${sample.id}`,
      kind: "primitive" as const,
      render: () => (
        <div
          class="gallery-discovery-backdrop"
          data-discovery-backdrop={sample.backdrop}
        >
          <DiscoveryCard content={card} />
        </div>
      ),
      sampleContent: [
        card.name,
        card.sentence,
        ...(card.kanji ? [card.kanji] : []),
      ],
    };
  }),
  {
    id: "matrix-select",
    kind: "primitive",
    render: SelectMatrix,
    sampleContent: [],
  },
  {
    id: "primitive-select-world",
    kind: "primitive",
    render: () => <SelectFixture open />,
    sampleContent: [],
  },
  {
    id: "primitive-select-region",
    kind: "primitive",
    render: () => <SelectFixture regions open />,
    sampleContent: content,
  },
  {
    id: "primitive-select-world-tooltip",
    kind: "primitive",
    render: () => <SelectFixture />,
    sampleContent: [],
    prepare: {
      kind: "tooltip",
      method: "hover",
      selector: '[data-ui="title.world"]',
    },
  },
  {
    id: "primitive-distance",
    kind: "primitive",
    render: DistanceFixture,
    sampleContent: [],
  },
  ...discoveries.map((item) => ({
    id: `primitive-discovery-${item.id}`,
    kind: "primitive" as const,
    render: () => <DiscoveryCard content={item} />,
    sampleContent: content,
    motionCapture: {
      selector: ".cf-discovery",
      times: [0, 150, 300, 2300, 4300, 4450, 4600],
    },
  })),
];
