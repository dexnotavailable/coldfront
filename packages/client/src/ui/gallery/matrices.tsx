/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import {
  fixtureBlocks,
  sampleContent,
} from "../../../../tools/src/ui-harness/sample";
import {
  Bar,
  Field,
  type ForcedState,
  IconButton,
  Keycap,
  Panel,
  Slider,
  Slot,
  Spinner,
  Toggle,
} from "../components/core";
import { RandomSeedIcon } from "../components/Icon";
import { Stat, Value } from "../components/Text";
import type { GalleryFixture } from "./registry";

const editorStates: readonly ForcedState[] = [
  "rest",
  "hover",
  "pressed",
  "focus",
  "disabled",
  "pending",
];
const slotStates: readonly ForcedState[] = [
  "rest",
  "hover",
  "pressed",
  "focus",
  "selected",
  "disabled",
  "pending",
];
const noop = (): void => {};
function FieldMatrix() {
  return (
    <div class="gallery-primitive gallery-matrix">
      {editorStates.map((state) => (
        <Field
          key={state}
          id="title.seed"
          value="1"
          digits
          state={state}
          onChange={noop}
        />
      ))}
    </div>
  );
}
function ToggleMatrix() {
  return (
    <div class="gallery-primitive gallery-matrix">
      {slotStates.map((state) => (
        <Toggle
          key={state}
          id="tools.fog"
          checked={state !== "rest"}
          state={state}
          onChange={noop}
        />
      ))}
    </div>
  );
}
function SliderMatrix() {
  return (
    <div class="gallery-primitive gallery-matrix">
      {editorStates.map((state) => (
        <Slider
          key={state}
          id="tools.time"
          value={12}
          state={state}
          onChange={noop}
        />
      ))}
      <Slider id="tools.time" value={0} onChange={noop} />
      <Slider id="tools.time" value={24} onChange={noop} />
    </div>
  );
}
function SlotMatrix() {
  const block = fixtureBlocks.at(-1);
  return (
    <div class="gallery-primitive">
      <div class="gallery-buttons">
        {slotStates.map((state) => (
          <Slot
            key={state}
            id="hud.hotbar"
            name={block?.name}
            icon={block?.icon}
            state={state}
          />
        ))}
      </div>
      <div class="gallery-buttons">
        <Slot id="hud.hotbar" />
        <Slot id="hud.hotbar" selected />
      </div>
    </div>
  );
}
function IconMatrix() {
  return (
    <div class="gallery-primitive">
      <div class="gallery-buttons">
        {slotStates.map((state) => (
          <IconButton
            key={state}
            id="title.random"
            state={state}
            onClick={noop}
          >
            <RandomSeedIcon />
          </IconButton>
        ))}
      </div>
    </div>
  );
}
function ReadoutMatrix() {
  return (
    <Panel className="gallery-primitive">
      <Stat id="f3.seed">
        <Value value={4294967295} />
      </Stat>
      <Bar id="load.bar" value={0} />
      <Bar id="load.bar" value={0.5} />
      <Bar id="load.bar" value={1} />
      <div class="gallery-buttons">
        <Keycap id="keyname.enter" />
        <Keycap id="keyname.esc" />
        <Spinner pending />
      </div>
    </Panel>
  );
}
export const matrixFixtures: readonly GalleryFixture[] = [
  { id: "matrix-field", render: FieldMatrix },
  { id: "matrix-toggle", render: ToggleMatrix },
  { id: "matrix-slider", render: SliderMatrix },
  { id: "matrix-slot", render: SlotMatrix },
  { id: "matrix-icon", render: IconMatrix },
  { id: "matrix-readouts", render: ReadoutMatrix },
].map((item) => ({ ...item, kind: "primitive", sampleContent }));
