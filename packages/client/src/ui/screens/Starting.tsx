/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { Blocking } from "../components/Blocking";
import { Bar, Button, Field, IconButton } from "../components/core";
import { RandomSeedIcon } from "../components/Icon";
import { Text } from "../components/Text";
import type { UiController } from "../controller";
export function TitleScreen({ ui }: { ui: UiController }) {
  return (
    <Blocking onEnter={() => ui.play()}>
      <div class="cf-column cf-title-column">
        <h1 data-ui="title.name">
          <Text id="title.name" />
        </h1>
        <div class="cf-seed-row">
          <Field
            id="title.seed"
            value={ui.seedDraft.value}
            digits
            onChange={(value) => {
              ui.seedDraft.value = value;
            }}
          />
          <IconButton id="title.random" onClick={() => ui.randomizeSeed()}>
            <RandomSeedIcon />
          </IconButton>
        </div>
        <Button id="title.play" kind="primary" onClick={() => ui.play()} />
      </div>
    </Blocking>
  );
}
export function LoadingScreen({
  ui,
  failed = false,
}: {
  ui: UiController;
  failed?: boolean;
}) {
  return (
    <Blocking onEnter={failed ? () => ui.reload() : undefined}>
      <div class="cf-column cf-loading-column">
        {failed ? (
          <>
            <Text id="load.failed" />
            <Button
              id="load.retry"
              kind="primary"
              onClick={() => ui.reload()}
            />
          </>
        ) : (
          <>
            <Bar id="load.bar" value={ui.game.value.loadProgress} />
            <Text id="load.terrain" />
          </>
        )}
      </div>
    </Blocking>
  );
}
export function MenuScreen({ ui }: { ui: UiController }) {
  return (
    <Blocking dim onClose={() => ui.resume(false)}>
      <div class="cf-column">
        <Button id="menu.resume" kind="primary" onClick={() => ui.resume()} />
        <Button id="menu.title" onClick={() => ui.quit()} />
        <Button id="menu.licences" onClick={() => ui.openRoute("licenses/")} />
      </div>
    </Blocking>
  );
}
export function SystemBlocker({ id }: { id: "sys.nogl" | "sys.small" }) {
  return (
    <Blocking>
      <div class="cf-system-line">
        <Text id={id} />
      </div>
    </Blocking>
  );
}
