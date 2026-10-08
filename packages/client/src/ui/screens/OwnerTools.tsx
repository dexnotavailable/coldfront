/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { useRef } from "preact/hooks";
import type { HotbarIndex } from "../../contracts/game-ui";
import { Blocking } from "../components/Blocking";
import {
  Button,
  Field,
  Modal,
  Panel,
  Slider,
  Slot,
  Toast,
  Toggle,
} from "../components/core";
import { Stat, Text } from "../components/Text";
import type { UiController } from "../controller";
export function ToolsPanel({
  ui,
  exiting = false,
}: {
  ui: UiController;
  exiting?: boolean;
}) {
  const state = ui.game.value.tools;
  return (
    <div
      class="cf-tools-frame"
      data-exiting={exiting}
      onPointerDown={(event) => {
        event.stopPropagation();
        if ((event.target as Element).closest("button")) event.preventDefault();
      }}
      onPointerUp={(event) => {
        if (event.target instanceof HTMLElement) event.target.blur();
      }}
    >
      <Panel>
        <div class="cf-tools-content" data-scroll>
          <h2 data-ui="tools.title">
            <Text id="tools.title" />
          </h2>
          <Slider
            id="tools.time"
            value={state.timeHours}
            onChange={(value) => ui.setTime(value)}
          />
          <Toggle
            id="tools.clock"
            checked={state.clockRuns}
            onChange={(value) => ui.toggleTool("clockRuns", value)}
          />
          <Toggle
            id="tools.fog"
            checked={state.fog}
            onChange={(value) => ui.toggleTool("fog", value)}
          />
          <Toggle
            id="tools.shadows"
            checked={state.shadows}
            onChange={(value) => ui.toggleTool("shadows", value)}
          />
          <Toggle
            id="tools.borders"
            checked={state.chunkBorders}
            onChange={(value) => ui.toggleTool("chunkBorders", value)}
          />
          <Toggle
            id="tools.wire"
            checked={state.wireframe}
            onChange={(value) => ui.toggleTool("wireframe", value)}
          />
          <Toggle
            id="tools.fly"
            checked={state.flying}
            onChange={(value) => ui.toggleTool("flying", value)}
          />
          <Stat id="tools.speed">
            <Text id="fmt.multiple" values={{ n: state.flySpeed }} />
          </Stat>
          <Button id="tools.still" onClick={() => ui.postcard()} />
          <Button id="tools.gallery" onClick={() => ui.openRoute("?gallery")} />
          <Button
            id="tools.clear"
            kind="danger"
            onClick={() => ui.requestClear()}
          />
        </div>
      </Panel>
    </div>
  );
}
export function BlockPalette({ ui }: { ui: UiController }) {
  const hovered = useRef<number | null>(null);
  const number = (event: KeyboardEvent): void => {
    const focused = (event.target as Element).closest<HTMLElement>(
      "[data-content-name]",
    );
    const blockId =
      hovered.current ??
      ui.game.value.blocks.find(
        (block) => block.name === focused?.dataset.contentName,
      )?.id;
    if (
      blockId === undefined ||
      !/^Digit[1-9]$/.test(event.code) ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.repeat ||
      document.activeElement instanceof HTMLInputElement
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    ui.assignBlock(blockId, (Number(event.code.slice(-1)) - 1) as HotbarIndex);
  };
  const query = ui.paletteQuery.value.toLocaleLowerCase();
  const toast = ui.toast.value;
  const blocks = ui.game.value.blocks.filter((block) =>
    block.name.toLocaleLowerCase().includes(query),
  );
  return (
    <Blocking
      dim
      onKey={number}
      onClose={() => {
        ui.blocking.value = null;
      }}
    >
      <div class="cf-palette-anchor">
        <Panel className="cf-palette">
          <h2 data-ui="blocks.title">
            <Text id="blocks.title" />
          </h2>
          <Field
            id="blocks.search"
            value={ui.paletteQuery.value}
            placeholder
            onChange={(value) => {
              ui.paletteQuery.value = value;
            }}
          />
          <div
            class="cf-block-grid"
            data-scroll
            onPointerOver={(event) => {
              const slot = (event.target as Element).closest<HTMLElement>(
                "[data-content-name]",
              );
              hovered.current =
                blocks.find((block) => block.name === slot?.dataset.contentName)
                  ?.id ?? null;
            }}
            onPointerLeave={() => {
              hovered.current = null;
            }}
          >
            {blocks.map((block) => (
              <Slot
                key={block.id}
                id="blocks.grid"
                name={block.name}
                icon={block.icon}
                onClick={() => ui.assignBlock(block.id)}
              />
            ))}
          </div>
        </Panel>
        {toast && <Toast id={toast.id} values={toast.values} anchored />}
      </div>
    </Blocking>
  );
}
export function ClearConfirmation({
  ui,
  exiting = false,
}: {
  ui: UiController;
  exiting?: boolean;
}) {
  return (
    <Modal
      exiting={exiting}
      onClose={() => {
        ui.confirmSeed.value = null;
      }}
    >
      <h2 data-ui="confirm.clear.title">
        <Text id="confirm.clear.title" />
      </h2>
      <div data-ui="confirm.clear.body">
        <Text id="confirm.clear.body" />
      </div>
      <div class="cf-confirm-actions">
        <Button
          id="confirm.clear.do"
          kind="danger"
          onClick={() => ui.confirmClear()}
        />
        <Button
          id="confirm.cancel"
          onClick={() => {
            ui.confirmSeed.value = null;
          }}
        />
      </div>
    </Modal>
  );
}
