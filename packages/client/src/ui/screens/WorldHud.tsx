/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { HotbarIndex } from "../../contracts/game-ui";
import { Slot, Toast } from "../components/core";
import { ContentText, Stat, Text, Value } from "../components/Text";
import type { UiController } from "../controller";
export function Hotbar({ ui }: { ui: UiController }) {
  const game = ui.game.value;
  const toast = ui.toast.value;
  return (
    <div class="cf-hotbar-area">
      {toast && ui.blocking.value !== "blocks" && (
        <Toast id={toast.id} values={toast.values} anchored />
      )}
      {ui.heldName.value && (
        <div class="cf-held-name" data-ui="hud.item">
          <Text id="hud.item" values={{ item: ui.heldName.value }} />
        </div>
      )}
      <div class="cf-hotbar">
        {game.hotbar.slots.map((id, index) => {
          const block = game.blocks.find((item) => item.id === id);
          return (
            <Slot
              key={index}
              id="hud.hotbar"
              name={block?.name}
              icon={block?.icon}
              selected={game.hotbar.selected === index}
              onClick={() => ui.selectSlot(index as HotbarIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}
export function DebugOverlay({ ui }: { ui: UiController }) {
  const value = ui.game.value.debug;
  if (!value) return null;
  return (
    <div class="cf-debug">
      <Stat id="f3.pos">
        {value.feet.map((number, index) => (
          <Value key={index} value={number} style="one" />
        ))}
      </Stat>
      <Stat id="f3.facing">
        <Text id={value.facing} />
        <Value value={value.pitchDegrees} style="one" />
      </Stat>
      <Stat id="f3.chunk">
        {value.chunk.map((number, index) => (
          <Value key={index} value={number} />
        ))}
      </Stat>
      <Stat id="f3.light">
        <Value value={value.skyLight} />
        {value.blockLight.map((number, index) => (
          <Value key={index} value={number} />
        ))}
      </Stat>
      <Stat id="f3.fps">
        <Value value={value.fps} />
        <Value value={value.slowestFrameMs} style="one" />
        <Text id="unit.ms" />
      </Stat>
      <Stat id="f3.draws">
        <Value value={value.drawCalls} style="compact" />
      </Stat>
      <Stat id="f3.tris">
        <Value value={value.triangles} style="compact" />
      </Stat>
      <Stat id="f3.memory">
        <Value value={value.trackedMemoryBytes / 1048576} style="one" />
        <Text id="unit.mb" />
      </Stat>
      <Stat id="f3.queue">
        <Value value={value.queues.generate} />
        <Value value={value.queues.light} />
        <Value value={value.queues.mesh} />
      </Stat>
      <Stat id="f3.seed">
        <Value value={value.seed} />
      </Stat>
      <Stat id="f3.build">
        <ContentText value={value.build.version} />
        <ContentText value={value.build.commit} />
      </Stat>
    </div>
  );
}
