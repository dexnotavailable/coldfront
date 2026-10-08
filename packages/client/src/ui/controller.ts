import { batch, effect, type Signal, signal } from "@preact/signals";
import type {
  GamePort,
  GameSnapshot,
  HotbarIndex,
  ToolBoolean,
  UiHost,
} from "../contracts/game-ui";
import type { CatalogueId, TextValues } from "./t";
export type BlockingScreen =
  | "title"
  | "loading"
  | "load-failed"
  | "menu"
  | "blocks"
  | null;
export interface ToastState {
  readonly id: "toast.shot" | "toast.fly" | "toast.windowed";
  readonly values?: TextValues;
}
export interface UiController {
  readonly game: Signal<GameSnapshot>;
  readonly blocking: Signal<BlockingScreen>;
  readonly seedDraft: Signal<string>;
  readonly toolsOpen: Signal<boolean>;
  readonly debugOpen: Signal<boolean>;
  readonly hudVisible: Signal<boolean>;
  readonly paletteQuery: Signal<string>;
  readonly confirmSeed: Signal<number | null>;
  readonly toast: Signal<ToastState | null>;
  readonly heldName: Signal<string | null>;
  play(): void;
  resume(fullscreen?: boolean): void;
  quit(): void;
  escape(): boolean;
  key(id: CatalogueId): boolean;
  toggleTool(key: ToolBoolean, value: boolean): void;
  setTime(hours: number): void;
  selectSlot(index: HotbarIndex): void;
  assignBlock(blockId: number, index?: HotbarIndex): void;
  randomizeSeed(): void;
  requestClear(): void;
  confirmClear(): void;
  openRoute(route: "licenses/" | "?gallery"): void;
  reload(): void;
  reportWindowed(): void;
  postcard(): void;
  dispose(): void;
}
/** Same documented 32-bit world-seed normalization for arbitrary decimal drafts. */
export function normalizeSeed(draft: string): number {
  let seed = 0;
  for (const character of draft || "1")
    seed = (seed * 10 + Number(character)) >>> 0;
  return seed;
}
export function createUiController(
  port: GamePort,
  host: UiHost,
  options: { manageInputScope?: boolean } = {},
): UiController {
  const game = signal(port.read());
  const blocking = signal<BlockingScreen>(
    game.value.lifecycle === "ready" ? null : "title",
  );
  const seedDraft = signal(String(game.value.seed));
  const toolsOpen = signal(false);
  const debugOpen = signal(false);
  const hudVisible = signal(true);
  const paletteQuery = signal("");
  const confirmSeed = signal<number | null>(null);
  const toast = signal<ToastState | null>(null);
  const heldName = signal<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let nameTimer: ReturnType<typeof setTimeout> | undefined;
  let windowedShown = false;
  const showToast = (next: ToastState): void => {
    clearTimeout(toastTimer);
    toast.value = next;
    toastTimer = setTimeout(() => {
      toast.value = null;
    }, 2300);
  };
  const unsubscribe = port.subscribe((event) => {
    if (event.type === "snapshot")
      batch(() => {
        game.value = event.snapshot;
        if (
          event.snapshot.lifecycle === "ready" &&
          blocking.value === "loading"
        )
          blocking.value = null;
        if (event.snapshot.lifecycle === "failed")
          blocking.value = "load-failed";
      });
    if (event.type === "item-changed") {
      clearTimeout(nameTimer);
      heldName.value = port.read().hotbar.itemName;
      nameTimer = setTimeout(() => {
        heldName.value = null;
      }, 2500);
    }
    if (event.type === "fly-speed-changed")
      showToast({ id: "toast.fly", values: { n: event.value } });
  });
  const stopScope = effect(() => {
    const scope =
      confirmSeed.value !== null
        ? "modal"
        : blocking.value
          ? "blocking-screen"
          : "world";
    if (options.manageInputScope !== false)
      port.apply({ type: "input-scope", scope });
    port.apply({ type: "pause", paused: blocking.value === "menu" });
  });
  const refresh = (): void => {
    game.value = port.read();
  };
  const controller: UiController = {
    game,
    blocking,
    seedDraft,
    toolsOpen,
    debugOpen,
    hudVisible,
    paletteQuery,
    confirmSeed,
    toast,
    heldName,
    play() {
      const seed = normalizeSeed(seedDraft.value);
      host.enterFullscreen();
      blocking.value = "loading";
      port.apply({ type: "start", seed });
      refresh();
    },
    resume(fullscreen = true) {
      if (fullscreen) host.enterFullscreen();
      blocking.value = null;
    },
    quit() {
      port.apply({ type: "quit" });
      batch(() => {
        blocking.value = "title";
        toolsOpen.value = false;
        debugOpen.value = false;
        confirmSeed.value = null;
      });
      refresh();
    },
    escape() {
      if (confirmSeed.value !== null) {
        confirmSeed.value = null;
        return true;
      }
      if (blocking.value === "menu" || blocking.value === "blocks") {
        blocking.value = null;
        return true;
      }
      if (game.value.mode === "postcard") {
        port.apply({ type: "postcard", active: false });
        refresh();
        return true;
      }
      if (toolsOpen.value) {
        toolsOpen.value = false;
        return true;
      }
      if (!blocking.value) {
        blocking.value = "menu";
        return true;
      }
      return false;
    },
    key(id) {
      if (id === "key.pos.inventory") {
        blocking.value = blocking.value === "blocks" ? null : "blocks";
        return true;
      }
      if (id === "key.all.hud") {
        hudVisible.value = !hudVisible.value;
        port.apply({ type: "hud-visible", visible: hudVisible.value });
        return true;
      }
      if (id === "key.all.debug") {
        debugOpen.value = !debugOpen.value;
        return true;
      }
      if (id === "key.all.fullscreen") {
        host.toggleFullscreen();
        return true;
      }
      if (id === "key.own.tools") {
        toolsOpen.value = !toolsOpen.value;
        return true;
      }
      if (id === "key.all.shot") {
        void port
          .capturePng()
          .then((blob) => {
            host.downloadPng(blob);
            showToast({ id: "toast.shot" });
          })
          .catch((error) => console.error(error));
        return true;
      }
      return false;
    },
    toggleTool(key, value) {
      port.apply({ type: "set-tool", key, value });
      refresh();
    },
    setTime(hours) {
      port.apply({ type: "set-time", hours });
      refresh();
    },
    selectSlot(index) {
      port.apply({ type: "select-slot", index });
      refresh();
    },
    assignBlock(blockId, index = game.value.hotbar.selected) {
      port.apply({ type: "assign-block", blockId, index });
      refresh();
    },
    randomizeSeed() {
      seedDraft.value = String(host.randomSeed() >>> 0);
    },
    requestClear() {
      confirmSeed.value = game.value.seed;
    },
    confirmClear() {
      const seed = confirmSeed.value;
      confirmSeed.value = null;
      if (seed !== null && seed === game.value.seed)
        port.apply({ type: "clear-edits", seed });
    },
    openRoute(route) {
      host.openRoute(route);
    },
    reload() {
      host.reload();
    },
    reportWindowed() {
      if (!windowedShown) {
        windowedShown = true;
        showToast({ id: "toast.windowed" });
      }
    },
    postcard() {
      toolsOpen.value = false;
      port.apply({ type: "postcard", active: true });
      refresh();
    },
    dispose() {
      unsubscribe();
      stopScope();
      clearTimeout(toastTimer);
      clearTimeout(nameTimer);
    },
  };
  return controller;
}
