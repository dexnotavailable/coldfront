import { batch, effect, type Signal, signal, untracked } from "@preact/signals";
import type {
  GamePort,
  GameSnapshot,
  HotbarIndex,
  MapFrame,
  MapPoint,
  MapPointRequest,
  MapRequest,
  SurfaceRegionId,
  TeleportTarget,
  TerrainViewMode,
  ToolBoolean,
  UiHost,
  WorldKind,
  WorldSession,
} from "../contracts/game-ui";
import type { PostcardId } from "../game/postcard";
import type { DiscoveryContent } from "./components/DiscoveryCard";
import type { CatalogueId, TextValues } from "./t";
export type BlockingScreen =
  | "title"
  | "loading"
  | "load-failed"
  | "menu"
  | "blocks"
  | "map"
  | null;
export interface ToastState {
  readonly id: "toast.shot" | "toast.fly" | "toast.windowed";
  readonly values?: TextValues;
}
export interface UiController {
  readonly game: Signal<GameSnapshot>;
  readonly blocking: Signal<BlockingScreen>;
  readonly seedDraft: Signal<string>;
  readonly worldKind: Signal<WorldKind>;
  readonly mapSession: Signal<number | null>;
  readonly mapPin: Signal<MapPoint | null>;
  readonly travelPending: Signal<boolean>;
  readonly discovery: Signal<{
    serial: number;
    content: DiscoveryContent;
  } | null>;
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
  setView(value: TerrainViewMode): void;
  goToPostcard(id: PostcardId): Promise<void>;
  selectSlot(index: HotbarIndex): void;
  assignBlock(blockId: number, index?: HotbarIndex): void;
  randomizeSeed(): void;
  requestClear(): void;
  confirmClear(): void;
  openRoute(route: "licenses/" | "?gallery"): void;
  reload(): void;
  reportWindowed(): void;
  postcard(): void;
  openMap(): void;
  closeMap(): void;
  readMap(request: MapRequest): Promise<MapFrame | null>;
  inspectMap(request: MapPointRequest): MapPoint | null;
  chooseMapPoint(point: MapPoint): void;
  teleportPin(): Promise<void>;
  goToRegion(regionId: SurfaceRegionId): Promise<void>;
  loadFailed(error: unknown): void;
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
  options: { manageInputScope?: boolean; initialWorld?: WorldKind } = {},
): UiController {
  const game = signal(port.read());
  const blocking = signal<BlockingScreen>(
    game.value.lifecycle === "ready" ? null : "title",
  );
  const seedDraft = signal(String(game.value.seed));
  const worldKind = signal<WorldKind>(
    options.initialWorld ?? game.value.world?.identity.kind ?? "main",
  );
  const mapSession = signal<number | null>(null);
  const mapPin = signal<MapPoint | null>(null);
  const travelPending = signal(false);
  const discovery = signal<{
    serial: number;
    content: DiscoveryContent;
  } | null>(null);
  let discoverySerial = 0;
  let discoveryTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTarget: WorldSession | null = null;
  let travelSequence = 0;
  const sameWorld = (a: WorldSession | null, b: WorldSession | null): boolean =>
    !!a &&
    !!b &&
    a.id === b.id &&
    a.identity.kind === b.identity.kind &&
    a.identity.seed === b.identity.seed &&
    a.identity.generation === b.identity.generation;
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
        if (!sameWorld(game.value.world, event.snapshot.world)) {
          clearTarget = null;
          confirmSeed.value = null;
          clearTimeout(discoveryTimer);
          discovery.value = null;
          if (
            mapSession.value !== null &&
            mapSession.value !== event.snapshot.world?.id
          ) {
            port.cancelTeleport(mapSession.value);
            mapSession.value = null;
            mapPin.value = null;
            travelSequence++;
            travelPending.value = false;
            if (blocking.value === "map") blocking.value = null;
          }
        }
        const activeCard = discovery.value;
        const weights = event.snapshot.debug?.regionWeights;
        if (
          event.snapshot.lifecycle === "ready" &&
          activeCard &&
          weights?.length
        ) {
          const maximum = Math.max(...weights.map((region) => region.weight));
          // Only the incoming snapshot decides location. A first-entry event
          // can precede its matching publish while game.value is still old.
          // Equal maxima are ambiguous at a boundary; do not falsely retire
          // a card whose region is still tied for the dominant weight.
          if (
            !weights.some(
              (region) =>
                region.regionId === activeCard.content.id &&
                region.weight === maximum,
            )
          ) {
            clearTimeout(discoveryTimer);
            discovery.value = null;
          }
        }
        game.value = event.snapshot;
        if (
          event.snapshot.lifecycle === "ready" &&
          blocking.value === "loading"
        )
          blocking.value = null;
        if (event.snapshot.lifecycle === "failed")
          blocking.value = "load-failed";
      });
    if (
      event.type === "region-entered" &&
      event.sessionId === game.value.world?.id &&
      game.value.world.identity.kind === "main"
    ) {
      const region = game.value.mapInfo?.regions.find(
        (item) => item.id === event.regionId,
      );
      if (region?.discoverySentence) {
        clearTimeout(discoveryTimer);
        discovery.value = {
          serial: ++discoverySerial,
          content: {
            id: region.id,
            name: region.name,
            sentence: region.discoverySentence,
            ...(region.kanji ? { kanji: region.kanji } : {}),
          },
        };
        discoveryTimer = setTimeout(() => {
          discovery.value = null;
        }, 4600);
      }
    }
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
        : blocking.value || travelPending.value
          ? "blocking-screen"
          : "world";
    const paused = blocking.value === "menu";
    // A real port may publish synchronously. Its callbacks are external effects,
    // not dependencies of this scope computation.
    untracked(() => {
      if (options.manageInputScope !== false)
        port.apply({ type: "input-scope", scope });
      port.apply({ type: "pause", paused });
    });
  });
  const refresh = (): void => {
    game.value = port.read();
  };
  const fail = (error: unknown): void => {
    console.error(error);
    blocking.value = "load-failed";
  };
  const closeMap = (): void => {
    const id = mapSession.value;
    if (id !== null) port.cancelTeleport(id);
    travelSequence++;
    batch(() => {
      mapSession.value = null;
      mapPin.value = null;
      travelPending.value = false;
      if (blocking.value === "map") blocking.value = null;
    });
  };
  const travel = async (
    target: TeleportTarget,
    fromMap: boolean,
  ): Promise<void> => {
    const world = game.value.world;
    if (!world || game.value.lifecycle !== "ready") return;
    const sequence = ++travelSequence;
    travelPending.value = true;
    try {
      const result = await port.teleport({ sessionId: world.id, target });
      if (sequence !== travelSequence || !sameWorld(world, game.value.world))
        return;
      refresh();
      if (result.committed && result.sessionId === world.id && fromMap)
        closeMap();
    } catch (error) {
      if (sequence === travelSequence && sameWorld(world, game.value.world))
        fail(error);
    } finally {
      if (sequence === travelSequence) travelPending.value = false;
    }
  };
  const controller: UiController = {
    game,
    blocking,
    seedDraft,
    worldKind,
    mapSession,
    mapPin,
    travelPending,
    discovery,
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
      port.apply({ type: "start", seed, worldKind: worldKind.value });
      refresh();
    },
    resume(fullscreen = true) {
      if (fullscreen) host.enterFullscreen();
      blocking.value = null;
    },
    quit() {
      closeMap();
      clearTimeout(discoveryTimer);
      discovery.value = null;
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
        clearTarget = null;
        confirmSeed.value = null;
        return true;
      }
      if (blocking.value === "map") {
        closeMap();
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
      if (id === "key.all.map") {
        if (blocking.value === "map") closeMap();
        else controller.openMap();
        return true;
      }
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
    setView(value) {
      port.apply({ type: "set-view", value });
      refresh();
    },
    async goToPostcard(id) {
      const world = game.value.world;
      if (
        !world ||
        game.value.lifecycle !== "ready" ||
        travelPending.value ||
        !game.value.postcards.some((camera) => camera.id === id)
      )
        return;
      const sequence = ++travelSequence;
      travelPending.value = true;
      try {
        const result = await port.goToPostcard({ sessionId: world.id, id });
        refresh();
        if (
          sequence === travelSequence &&
          sameWorld(world, game.value.world) &&
          result.committed &&
          result.sessionId === world.id
        )
          toolsOpen.value = false;
      } catch (error) {
        if (sequence === travelSequence) fail(error);
      } finally {
        if (sequence === travelSequence) travelPending.value = false;
      }
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
      clearTarget = game.value.world;
      confirmSeed.value = clearTarget?.identity.seed ?? null;
    },
    confirmClear() {
      if (confirmSeed.value === null) return;
      const target = clearTarget;
      clearTarget = null;
      confirmSeed.value = null;
      if (
        target &&
        sameWorld(target, game.value.world) &&
        target.identity.seed === game.value.seed
      )
        port.apply({ type: "clear-edits", world: target });
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
    openMap() {
      const snapshot = port.read();
      const feet = snapshot.debug?.feet;
      if (
        snapshot.lifecycle !== "ready" ||
        !snapshot.world ||
        !snapshot.mapInfo ||
        !feet
      )
        return;
      const pin = port.inspectMap({
        sessionId: snapshot.world.id,
        x: feet[0],
        z: feet[2],
      });
      if (!pin) return;
      batch(() => {
        game.value = snapshot;
        mapSession.value = snapshot.world!.id;
        mapPin.value = pin;
        blocking.value = "map";
      });
    },
    closeMap,
    readMap: (request) => port.readMap(request),
    inspectMap: (request) => port.inspectMap(request),
    chooseMapPoint(point) {
      mapPin.value = point;
    },
    teleportPin() {
      const point = mapPin.value;
      return point
        ? travel({ kind: "point", x: point.x, z: point.z }, true)
        : Promise.resolve();
    },
    goToRegion: (regionId) => travel({ kind: "region", regionId }, false),
    loadFailed: fail,
    dispose() {
      closeMap();
      unsubscribe();
      stopScope();
      clearTimeout(toastTimer);
      clearTimeout(nameTimer);
      clearTimeout(discoveryTimer);
    },
  };
  return controller;
}
