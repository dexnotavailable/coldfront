/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useEffect, useMemo } from "preact/hooks";
import {
  fixtureController,
  sampleContent,
} from "../../../../tools/src/ui-harness/sample";
import { Keycap } from "../components/core";
import { Text, Value } from "../components/Text";
import { GameUi } from "../GameUi";
import type { CatalogueId } from "../t";
import type { GalleryFixture } from "./registry";

function StateFixture({ scenario }: { scenario: string }) {
  const { ui } = useMemo(() => fixtureController(scenario), [scenario]);
  const blocking = ui.blocking.value;
  const confirm = ui.confirmSeed.value;
  useEffect(() => () => ui.dispose(), [ui]);
  useEffect(() => {
    if (window.__cfUi)
      window.__cfUi.closed =
        scenario === "confirm-clear"
          ? confirm === null
          : (scenario === "menu" || scenario.startsWith("palette")) &&
            blocking === null;
  }, [blocking, confirm, scenario]);
  return (
    <GameUi
      controller={ui}
      updateAvailable={scenario === "system-update"}
      forceSystem={
        scenario === "system-nogl"
          ? "sys.nogl"
          : scenario === "system-small"
            ? "sys.small"
            : undefined
      }
    />
  );
}
const scenarios = [
  "title",
  "title-empty",
  "title-long",
  "title-long-home",
  "title-long-end",
  "loading-start",
  "loading",
  "loading-ready",
  "loading-failed",
  "hud",
  "hud-name",
  "hud-hidden",
  "menu",
  "tools",
  "tools-on",
  "debug",
  "debug-largest",
  "palette",
  "palette-filtered",
  "palette-empty",
  "system-nogl",
  "system-small",
  "system-storage",
  "system-context",
  "system-update",
  "toast-shot",
  "toast-fly",
  "toast-windowed",
  "toast-held-name",
  "toast-palette",
  "confirm-clear",
] as const;
const compass: readonly CatalogueId[] = [
  "compass.n",
  "compass.ne",
  "compass.e",
  "compass.se",
  "compass.s",
  "compass.sw",
  "compass.w",
  "compass.nw",
];
function FixedWords() {
  return (
    <div class="gallery-primitive">
      <div class="gallery-buttons">
        <Value value={12} />
        <Text id="unit.h" />
        <Value value={16.7} style="one" />
        <Text id="unit.ms" />
        <Value value={9} />
        <Text id="unit.mb" />
        <Text id="fmt.multiple" values={{ n: 16 }} />
      </div>
      <div class="gallery-buttons">
        {compass.map((id) => (
          <Text key={id} id={id} />
        ))}
      </div>
      <div class="gallery-buttons">
        <Keycap id="keyname.enter" />
        <Keycap id="keyname.esc" />
      </div>
    </div>
  );
}
export const currentScreenFixtures: readonly GalleryFixture[] = [
  ...scenarios.map((scenario) => ({
    id: scenario,
    kind: "screen" as const,
    render: () => <StateFixture scenario={scenario} />,
    sampleContent,
    closeable:
      scenario === "menu" ||
      scenario.startsWith("palette") ||
      scenario === "toast-palette" ||
      scenario === "confirm-clear",
    ...(scenario.startsWith("title-long")
      ? {
          prepare: {
            kind: "field-endpoint" as const,
            endpoint:
              scenario === "title-long-home"
                ? ("Home" as const)
                : ("End" as const),
            selector: '[data-ui="title.seed"]',
            value: "123456789012345678901234567890",
          },
        }
      : {}),
  })),
  ...(
    [
      { name: "seed", scenario: "title", selector: '[data-ui="title.seed"]' },
      {
        name: "random",
        scenario: "title",
        selector: '[data-ui="title.random"]',
      },
      {
        name: "licences",
        scenario: "menu",
        selector: '[data-ui="menu.licences"]',
      },
      {
        name: "postcard",
        scenario: "tools",
        selector: '[data-ui="tools.still"]',
      },
      {
        name: "block",
        scenario: "palette",
        selector: '[data-ui="blocks.grid"]:last-child',
      },
    ] as const
  ).flatMap((item) =>
    (["hover", "focus"] as const).map((method) => ({
      id: `tooltip-${item.name}-${method}`,
      kind: "screen" as const,
      render: () => <StateFixture scenario={item.scenario} />,
      sampleContent,
      closeable: item.scenario === "menu" || item.scenario === "palette",
      prepare: { kind: "tooltip" as const, method, selector: item.selector },
    })),
  ),
  { id: "fixed-words", kind: "screen", render: FixedWords, sampleContent: [] },
];
