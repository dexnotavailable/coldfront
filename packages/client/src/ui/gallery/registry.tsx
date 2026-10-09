/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import {
  Banner,
  Bar,
  Button,
  Field,
  type ForcedState,
  Keycap,
  Panel,
  Slider,
  Slot,
  Toast,
  Toggle,
  Tooltip,
} from "../components/core";
import { Stat, Text, Value } from "../components/Text";
import { matrixFixtures } from "./matrices";
import { phase12PrimitiveFixtures } from "./phase12";
import { phase13Fixtures } from "./phase13";
import { currentScreenFixtures } from "./screens";
import { worldFixtures } from "./world-fixtures";
export interface GalleryFixture {
  readonly id: string;
  readonly kind: "primitive" | "screen";
  readonly render: () => ComponentChildren;
  readonly sampleContent: readonly string[];
  readonly closeable?: boolean;
  readonly motion?: boolean;
  readonly motionCapture?: Readonly<{
    selector: string;
    times: readonly number[];
  }>;
  readonly prepare?:
    | { readonly kind: "select-open"; readonly selector: string }
    | {
        readonly kind: "map";
        readonly action: "selected" | "zoom" | "edge" | "pan" | "detail";
      }
    | {
        readonly kind: "field-endpoint";
        readonly endpoint: "Home" | "End";
        readonly selector: string;
        readonly value: string;
      }
    | {
        readonly kind: "tooltip";
        readonly method: "hover" | "focus";
        readonly selector: string;
      };
}
const states: readonly ForcedState[] = [
  "rest",
  "hover",
  "pressed",
  "focus",
  "selected",
  "disabled",
  "pending",
];
function PrimitiveControls() {
  const [seed, setSeed] = useState("1");
  const [on, setOn] = useState(true);
  const [time, setTime] = useState(12);
  return (
    <div class="gallery-primitive">
      <div class="gallery-buttons">
        {states.map((state) => (
          <Button
            key={state}
            id="title.play"
            state={state}
            kind={state === "selected" ? "primary" : "secondary"}
          />
        ))}
      </div>
      <Field id="title.seed" value={seed} onChange={setSeed} digits />
      <Toggle id="tools.fog" checked={on} onChange={setOn} />
      <Slider id="tools.time" value={time} onChange={setTime} />
      <Bar id="load.bar" value={0.6} />
      <div class="gallery-buttons">
        <Keycap id="keyname.enter" />
        <Keycap id="keyname.esc" />
        <Slot id="hud.hotbar" selected />
        <Slot id="hud.hotbar" />
      </div>
    </div>
  );
}
function PrimitiveReadouts() {
  return (
    <Panel className="gallery-primitive">
      <Stat id="f3.fps">
        <Value value={60} />
        <Value value={18.3} style="one" />
        <Text id="unit.ms" />
      </Stat>
      <Stat id="f3.pos">
        <Value value={-256.1} style="one" />
        <Value value={22.3} style="one" />
        <Value value={24.5} style="one" />
      </Stat>
      <Stat id="f3.facing">
        <Text id="compass.nw" />
        <Value value={55} />
      </Stat>
      <Stat id="tools.speed">
        <Text id="fmt.multiple" values={{ n: 4 }} />
      </Stat>
      <Bar id="load.bar" value={0.8} />
    </Panel>
  );
}
function PrimitiveOverlays() {
  return (
    <>
      <Banner id="sys.update">
        <Button id="sys.reload" />
      </Banner>
      <div class="gallery-primitive">
        <Button id="tools.clear" kind="danger" />
        <Tooltip id="tools.clear" visible />
      </div>
      <Toast id="toast.fly" values={{ n: 8 }} />
    </>
  );
}
export const primitiveFixtures: readonly GalleryFixture[] = [
  {
    id: "primitive-controls",
    kind: "primitive",
    render: PrimitiveControls,
    sampleContent: [],
  },
  {
    id: "primitive-readouts",
    kind: "primitive",
    render: PrimitiveReadouts,
    sampleContent: [],
  },
  {
    id: "primitive-overlays",
    kind: "primitive",
    render: PrimitiveOverlays,
    sampleContent: [],
  },
];
export const screenFixtures: readonly GalleryFixture[] = [
  ...currentScreenFixtures,
  ...worldFixtures,
];
export const galleryFixtures: readonly GalleryFixture[] = [
  ...primitiveFixtures,
  ...matrixFixtures,
  ...phase12PrimitiveFixtures,
  ...phase13Fixtures,
  ...screenFixtures,
];
