import { signal } from "@preact/signals";
import { render } from "preact";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/cormorant-sc/600.css";
import "./ui/tokens.css";
import "./ui/components/components.css";
import "./ui/screens/screens.css";
import "./bootstrap/layout.css";
import {
  browserHost,
  createFullscreenState,
  type KeyboardLock,
} from "./bootstrap/host.js";
import { bindInput } from "./bootstrap/input.js";
import {
  bindWorldLifecycle,
  rememberedSeed,
  watchForUpdate,
} from "./bootstrap/lifecycle.js";
import { loadPostcard } from "./bootstrap/postcard.js";
import { exposeTelemetry } from "./bootstrap/telemetry.js";
import { createGameHandle } from "./game/create-game.js";
import {
  createUiController,
  normalizeSeed,
  type UiController,
} from "./ui/controller.js";
import { GameUi } from "./ui/GameUi.js";

const target = document.getElementById("app");
if (!target) throw new Error("Missing application mount");
const query = new URLSearchParams(location.search);
const base = import.meta.env.BASE_URL;

async function boot(): Promise<void> {
  if (!target) return;
  if (query.has("gallery")) {
    const { Gallery } = await import("./ui/gallery/Gallery.js");
    await import("./ui/gallery/gallery.css");
    render(<Gallery />, target);
    return;
  }
  target.className = "cf-game";
  const canvas = document.createElement("canvas");
  canvas.className = "cf-world";
  const uiRoot = document.createElement("div");
  uiRoot.className = "cf-ui-root";
  target.append(canvas, uiRoot);
  const draft = rememberedSeed(query);
  const seed = normalizeSeed(draft);
  let postcard: Awaited<ReturnType<typeof loadPostcard>>;
  let postcardError: unknown;
  try {
    postcard = await loadPostcard(query, seed, base);
  } catch (error) {
    postcardError = error;
  }
  const tokens = getComputedStyle(document.documentElement);
  const color = (name: string): string => {
    const value = tokens.getPropertyValue(name).trim();
    if (!value) throw new Error(`Missing world UI color token ${name}`);
    return value;
  };
  let ui: UiController | undefined;
  let input: ReturnType<typeof bindInput> | undefined;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const fullscreen = createFullscreenState(
    document,
    (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard,
    () => {
      input?.escape();
    },
    () => {
      if (!mac && ui?.game.peek().lifecycle === "ready") ui.reportWindowed();
    },
  );
  const game = createGameHandle(canvas, {
    colors: {
      ink: color("--ink-0"),
      steel: color("--steel"),
      cap: color("--ink-1"),
    },
    keyboardLocked: () => fullscreen.locked(),
    onWindowedSprint: () => ui?.reportWindowed(),
    build: { version: __CF_BUILD__.version, commit: __CF_BUILD__.commit },
    cacheTag: __CF_BUILD__.cacheTag,
    externalKeyboard: true,
    ...(postcard ? { postcard } : {}),
  });
  ui = createUiController(game.port, browserHost(fullscreen, base), {
    manageInputScope: false,
  });
  ui.seedDraft.value = draft;
  input = bindInput(ui, game, fullscreen);
  const controller = ui;
  const updateAvailable = signal(false);
  const context = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    stencil: true,
  });
  function Application() {
    return (
      <GameUi
        controller={controller}
        externalInput
        updateAvailable={updateAvailable.value}
        forceSystem={context ? undefined : "sys.nogl"}
      />
    );
  }
  render(<Application />, uiRoot);
  exposeTelemetry(game, () => fullscreen.locked());
  const stopLifecycle = bindWorldLifecycle(
    game.port,
    window,
    () => controller.blocking.value !== "title",
    () => controller.seedDraft.value,
  );
  const stopWindowedNotice = game.port.subscribe((event) => {
    if (
      event.type === "snapshot" &&
      event.snapshot.lifecycle === "ready" &&
      !mac &&
      !fullscreen.locked()
    )
      controller.reportWindowed();
  });
  const stopUpdates = watchForUpdate(base, __CF_BUILD__.buildId, () => {
    updateAvailable.value = true;
  });
  if (postcardError) {
    controller.blocking.value = "load-failed";
    console.error(postcardError);
  } else if (postcard) {
    controller.blocking.value = "loading";
    game.port.apply({ type: "start", seed });
    await game.ready();
  }
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      stopUpdates();
      stopLifecycle();
      stopWindowedNotice();
      input?.dispose();
      controller.dispose();
      fullscreen.dispose();
      render(null, uiRoot);
      void game.port.dispose();
    });
}
void boot().catch((error: unknown) => {
  console.error(error);
});
