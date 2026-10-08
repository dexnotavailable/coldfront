/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useEffect, useState } from "preact/hooks";
import { Banner, Button } from "./components/core";
import { Presence } from "./components/Presence";
import { dismissTooltip, TooltipHost } from "./components/TooltipHost";
import type { UiController } from "./controller";
import {
  BlockPalette,
  ClearConfirmation,
  ToolsPanel,
} from "./screens/OwnerTools";
import {
  LoadingScreen,
  MenuScreen,
  SystemBlocker,
  TitleScreen,
} from "./screens/Starting";
import { DebugOverlay, Hotbar } from "./screens/WorldHud";
import type { CatalogueId } from "./t";

const bindings: Readonly<Record<string, CatalogueId>> = {
  KeyE: "key.pos.inventory",
  F1: "key.all.hud",
  F2: "key.all.shot",
  F3: "key.all.debug",
  F4: "key.own.tools",
  F11: "key.all.fullscreen",
};
export function GameUi({
  controller: ui,
  updateAvailable = false,
  forceSystem,
  externalInput = false,
}: {
  controller: UiController;
  updateAvailable?: boolean;
  forceSystem?: "sys.nogl" | "sys.small" | undefined;
  externalInput?: boolean;
}) {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const resize = (): void => setSmall(innerWidth < 1024 || innerHeight < 600);
    resize();
    window.addEventListener("resize", resize);
    const keys = (event: KeyboardEvent): void => {
      if (event.repeat || event.altKey || event.metaKey) return;
      const field =
        event.target instanceof HTMLInputElement &&
        !["range", "checkbox"].includes(event.target.type);
      if (event.key === "Escape") {
        if (dismissTooltip()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (field) {
          (event.target as HTMLInputElement).blur();
          (event.target as HTMLElement)
            .closest<HTMLElement>("[data-blocking]")
            ?.focus();
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (ui.escape()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (field || ui.confirmSeed.value !== null) return;
      if (
        ui.blocking.value &&
        !(event.code === "KeyE" && ui.blocking.value === "blocks")
      )
        return;
      const id = bindings[event.code];
      if (id && ui.key(id)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    if (!externalInput) document.addEventListener("keydown", keys, true);
    const worldPointer = (event: PointerEvent): void => {
      if (ui.toolsOpen.value && !(event.target as Element).closest(".cf-ui"))
        ui.toolsOpen.value = false;
    };
    if (!externalInput)
      document.addEventListener("pointerdown", worldPointer, true);
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("keydown", keys, true);
      document.removeEventListener("pointerdown", worldPointer, true);
    };
  }, [ui, externalInput]);
  const game = ui.game.value;
  const blocking = ui.blocking.value;
  return (
    <div class="cf-ui">
      {forceSystem || small || game.graphics === "unavailable" ? (
        <SystemBlocker id={forceSystem ?? (small ? "sys.small" : "sys.nogl")} />
      ) : (
        <>
          {blocking === "title" && <TitleScreen ui={ui} />}{" "}
          {blocking === "loading" && <LoadingScreen ui={ui} />}{" "}
          {blocking === "load-failed" && <LoadingScreen ui={ui} failed />}
          {game.lifecycle === "ready" &&
            ui.hudVisible.value &&
            game.mode !== "postcard" && (
              <>
                <Hotbar ui={ui} />
                {ui.debugOpen.value && <DebugOverlay ui={ui} />}{" "}
                <Presence visible={ui.toolsOpen.value} leaveMs={130}>
                  {(leaving) => <ToolsPanel ui={ui} exiting={leaving} />}
                </Presence>{" "}
                {game.graphics === "rebuilding" ? (
                  <Banner id="sys.context" />
                ) : game.storage === "blocked" ? (
                  <Banner id="sys.storage" />
                ) : updateAvailable ? (
                  <Banner id="sys.update">
                    <Button id="sys.reload" onClick={() => ui.reload()} />
                  </Banner>
                ) : null}
              </>
            )}
          {blocking === "menu" && <MenuScreen ui={ui} />}{" "}
          {blocking === "blocks" && <BlockPalette ui={ui} />}{" "}
          <Presence visible={ui.confirmSeed.value !== null} leaveMs={100}>
            {(leaving) => <ClearConfirmation ui={ui} exiting={leaving} />}
          </Presence>{" "}
          <TooltipHost externalInput={externalInput} />{" "}
        </>
      )}
    </div>
  );
}
