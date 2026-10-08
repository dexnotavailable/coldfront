/** Gallery-only data adapter. This is not a world simulation or a playable build. */
import type {
  BlockPresentation,
  GameCommand,
  GameEvent,
  GamePort,
  GameSnapshot,
  MapFrame,
  MapRequest,
  SurfaceRegionId,
  TeleportRequest,
  UiHost,
  WorldKind,
} from "../../../client/src/contracts/game-ui";
import { createUiController } from "../../../client/src/ui/controller";
import { BLOCK_REGISTRY } from "../../../shared/src/blocks/registry";
import { SURFACE_REGIONS } from "../../../shared/src/world/regions";
import mapAnchorReview from "./map-anchor-review.json";

const colors = [
  "#242932",
  "#48586b",
  "#785546",
  "#64884b",
  "#baa579",
  "#436f88",
  "#87674b",
  "#417157",
  "#354554",
];
export const fixtureBlocks: readonly BlockPresentation[] =
  BLOCK_REGISTRY.filter((block) => block.id !== 0).map((block, index) => ({
    id: block.id,
    name: block.name,
    regionId: "plains",
    icon: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${colors[index % colors.length]}" d="M3 6 12 1 21 6 21 18 12 23 3 18Z"/><path fill="#ffffff" fill-opacity=".2" d="M3 6 12 1 21 6 12 11Z"/><path fill="#000000" fill-opacity=".2" d="M12 11 21 6 21 18 12 23Z"/></svg>`)}`,
  }));
export const sampleContent = [
  ...fixtureBlocks.map((block) => block.name),
  "0.1.0",
  "eced20f",
  "ffffffffffffffffffffffffffffffffffffffff",
  ...SURFACE_REGIONS.flatMap((region) => [
    region.name,
    ...(region.kanji ? [region.kanji] : []),
    ...(region.discoverySentence ? [region.discoverySentence] : []),
  ]),
];
const mapBounds = { minX: -22528, minZ: -22528, maxX: 22528, maxZ: 22528 };
/** Explicit gallery-only coloured cells; this is not WorldPlan geography proof. */
function fixtureRegion(x: number, z: number) {
  const column = Math.min(
    3,
    Math.max(0, Math.floor((x - mapBounds.minX) / 11264)),
  );
  const row = Math.min(
    3,
    Math.max(0, Math.floor((z - mapBounds.minZ) / 11264)),
  );
  return SURFACE_REGIONS[row * 4 + column]!;
}
function fixtureMap(request: MapRequest, main: boolean): MapFrame {
  const clipped = {
    minX: Math.max(mapBounds.minX, request.bounds.minX),
    minZ: Math.max(mapBounds.minZ, request.bounds.minZ),
    maxX: Math.min(mapBounds.maxX, request.bounds.maxX),
    maxZ: Math.min(mapBounds.maxZ, request.bounds.maxZ),
  };
  request = {
    ...request,
    bounds: clipped,
    width: Math.max(
      1,
      Math.round(
        (request.width * (clipped.maxX - clipped.minX)) /
          (request.bounds.maxX - request.bounds.minX),
      ),
    ),
    height: Math.max(
      1,
      Math.round(
        (request.height * (clipped.maxZ - clipped.minZ)) /
          (request.bounds.maxZ - request.bounds.minZ),
      ),
    ),
  };
  const rgba = new Uint8ClampedArray(request.width * request.height * 4);
  for (let y = 0; y < request.height; y++)
    for (let x = 0; x < request.width; x++) {
      const wx =
        request.bounds.minX +
        ((x + 0.5) * (request.bounds.maxX - request.bounds.minX)) /
          request.width;
      const wz =
        request.bounds.minZ +
        ((y + 0.5) * (request.bounds.maxZ - request.bounds.minZ)) /
          request.height;
      const color = main ? fixtureRegion(wx, wz).color : [100, 110, 120];
      const at = (y * request.width + x) * 4;
      rgba[at] = color[0]!;
      rgba[at + 1] = color[1]!;
      rgba[at + 2] = color[2]!;
      rgba[at + 3] = 255;
    }
  return {
    ...request,
    rgba,
    names: main
      ? SURFACE_REGIONS.map((region, index) => ({
          regionId: region.id,
          x: mapBounds.minX + ((index % 4) + 0.5) * 11264,
          z: mapBounds.minZ + (Math.floor(index / 4) + 0.5) * 11264,
        }))
      : [],
  };
}
export function sampleSnapshot(): GameSnapshot {
  return {
    world: {
      id: 1,
      identity: { kind: "main", seed: 1, generation: "gallery-only" },
    },
    loadStage: "terrain",
    mapInfo: { bounds: mapBounds, regions: SURFACE_REGIONS },
    revision: 1,
    lifecycle: "ready",
    loadProgress: 0.6,
    seed: 1,
    mode: "overhead",
    worldPaused: false,
    tools: {
      timeHours: 12,
      clockRuns: true,
      fog: true,
      shadows: true,
      chunkBorders: false,
      wireframe: false,
      flying: false,
      flySpeed: 1,
    },
    hotbar: {
      slots: fixtureBlocks.slice(0, 9).map((block) => block.id),
      selected: 0,
      itemName: fixtureBlocks[0]!.name,
    },
    blocks: fixtureBlocks,
    storage: "available",
    graphics: "available",
    debug: {
      regionWeights: [
        { regionId: "jungle", weight: 0.64 },
        { regionId: "swamp", weight: 0.26 },
        { regionId: "isles", weight: 0.1 },
      ],
      feet: [-256.1, 24.5, 312.8],
      facing: "compass.nw",
      pitchDegrees: 55,
      chunk: [-9, 0, 9],
      skyLight: 15,
      blockLight: [0, 0, 0],
      fps: 60,
      slowestFrameMs: 19.7,
      drawCalls: 82,
      triangles: 84932,
      trackedMemoryBytes: 9437184,
      queues: { generate: 12, light: 3, mesh: 7 },
      seed: 1,
      build: { version: "0.1.0", commit: "eced20f" },
    },
  };
}
export function fixtureController(
  scenario: string,
  options: { manageInputScope?: boolean; initialWorld?: WorldKind } = {},
) {
  let snapshot = sampleSnapshot();
  const listeners = new Set<(event: GameEvent) => void>();
  const commands: GameCommand[] = [];
  const browserActions: string[] = [];
  const travels: TeleportRequest[] = [];
  const cancelled: number[] = [];
  const emit = (event: GameEvent): void => {
    for (const listener of listeners) listener(event);
  };
  if (scenario.endsWith("-test"))
    snapshot = {
      ...snapshot,
      world: {
        id: 1,
        identity: { kind: "test", seed: 1, generation: "gallery-only" },
      },
      mapInfo: { bounds: mapBounds, regions: [] },
      debug: snapshot.debug ? { ...snapshot.debug, regionWeights: [] } : null,
    };
  if (scenario.startsWith("title"))
    snapshot = { ...snapshot, lifecycle: "idle" };
  if (scenario.startsWith("loading"))
    snapshot = {
      ...snapshot,
      lifecycle: "loading",
      loadProgress:
        scenario === "loading-start"
          ? 0
          : scenario === "loading-ready"
            ? 0.98
            : 0.6,
    };
  if (scenario === "loading-failed")
    snapshot = { ...snapshot, lifecycle: "failed" };
  if (scenario.startsWith("loading-plan"))
    snapshot = {
      ...snapshot,
      loadStage: "plan",
      loadProgress: scenario.endsWith("start")
        ? 0
        : scenario.endsWith("done")
          ? 0.35
          : 0.2,
    };
  if (scenario === "system-storage")
    snapshot = { ...snapshot, storage: "blocked" };
  if (scenario === "system-context")
    snapshot = { ...snapshot, graphics: "rebuilding" };
  const publish = (): void => {
    for (const listener of listeners) listener({ type: "snapshot", snapshot });
  };
  const port: GamePort = {
    read: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    apply(command) {
      commands.push(command);
      if (command.type === "input-scope") return;
      if (command.type === "pause") {
        if (snapshot.worldPaused === command.paused) return;
        snapshot = { ...snapshot, worldPaused: command.paused };
      }
      if (command.type === "set-tool")
        snapshot = {
          ...snapshot,
          tools: { ...snapshot.tools, [command.key]: command.value },
        };
      if (command.type === "set-time")
        snapshot = {
          ...snapshot,
          tools: { ...snapshot.tools, timeHours: command.hours },
        };
      if (command.type === "select-slot")
        snapshot = {
          ...snapshot,
          hotbar: { ...snapshot.hotbar, selected: command.index },
        };
      if (command.type === "assign-block") {
        const slots = [...snapshot.hotbar.slots];
        slots[command.index] = command.blockId;
        snapshot = { ...snapshot, hotbar: { ...snapshot.hotbar, slots } };
      }
      if (command.type === "start")
        snapshot = {
          ...snapshot,
          lifecycle: "loading",
          seed: command.seed,
          world: {
            id: (snapshot.world?.id ?? 0) + 1,
            identity: {
              kind: command.worldKind,
              seed: command.seed,
              generation: "gallery-only",
            },
          },
        };
      if (command.type === "postcard")
        snapshot = {
          ...snapshot,
          mode: command.active ? "postcard" : "overhead",
        };
      publish();
    },
    async readMap(request) {
      if (request.sessionId !== snapshot.world?.id) return null;
      if (scenario.startsWith("map-review"))
        return {
          ...fixtureMap(request, false),
          // Historical real anchors on a neutral fixture raster. This exercises
          // collisions without masquerading as current WorldPlan geography.
          names: mapAnchorReview.names.flatMap((anchor) => {
            const region = SURFACE_REGIONS.find(
              (item) => item.id === anchor.regionId,
            );
            return region ? [{ ...anchor, regionId: region.id }] : [];
          }),
        };
      return fixtureMap(request, snapshot.world.identity.kind === "main");
    },
    inspectMap(request) {
      if (
        request.sessionId !== snapshot.world?.id ||
        request.x < mapBounds.minX ||
        request.x >= mapBounds.maxX ||
        request.z < mapBounds.minZ ||
        request.z >= mapBounds.maxZ
      )
        return null;
      return {
        x: request.x,
        z: request.z,
        regionId:
          snapshot.world.identity.kind === "main"
            ? fixtureRegion(request.x, request.z).id
            : null,
      };
    },
    async teleport(request) {
      travels.push(request);
      if (request.sessionId !== snapshot.world?.id)
        return { sessionId: request.sessionId, committed: false };
      const destination = request.target;
      const index =
        destination.kind === "region"
          ? SURFACE_REGIONS.findIndex(
              (region) => region.id === destination.regionId,
            )
          : -1;
      const point =
        request.target.kind === "point"
          ? request.target
          : {
              x: mapBounds.minX + ((index % 4) + 0.5) * 11264,
              z: mapBounds.minZ + (Math.floor(index / 4) + 0.5) * 11264,
            };
      snapshot = {
        ...snapshot,
        debug: snapshot.debug
          ? { ...snapshot.debug, feet: [point.x, 24.5, point.z] }
          : null,
      };
      publish();
      if (snapshot.world?.identity.kind === "main")
        emit({
          type: "region-entered",
          sessionId: request.sessionId,
          regionId: fixtureRegion(point.x, point.z).id,
        });
      return { sessionId: request.sessionId, committed: true };
    },
    cancelTeleport(sessionId) {
      cancelled.push(sessionId);
    },
    capturePng: () =>
      Promise.reject(new Error("Gallery adapter cannot capture a game world")),
    dispose: async () => {
      listeners.clear();
    },
  };
  const host: UiHost = {
    enterFullscreen() {
      browserActions.push("fullscreen");
    },
    toggleFullscreen() {
      browserActions.push("toggle-fullscreen");
    },
    reload() {
      browserActions.push("reload");
    },
    openRoute(route) {
      browserActions.push(route);
    },
    downloadPng() {
      browserActions.push("download");
    },
    randomSeed: () => 123456789,
  };
  const ui = createUiController(port, host, options);
  if (scenario.startsWith("title")) {
    ui.blocking.value = "title";
    if (scenario.startsWith("title-long"))
      ui.seedDraft.value = "123456789012345678901234567890";
    if (scenario === "title-empty") ui.seedDraft.value = "";
  }
  if (scenario.startsWith("map")) ui.openMap();
  if (scenario.startsWith("discovery-"))
    emit({
      type: "region-entered",
      sessionId: 1,
      regionId: scenario.slice(10) as SurfaceRegionId,
    });
  if (scenario.startsWith("loading"))
    ui.blocking.value =
      scenario === "loading-failed" ? "load-failed" : "loading";
  if (scenario === "menu") ui.blocking.value = "menu";
  if (scenario.startsWith("palette")) {
    ui.blocking.value = "blocks";
    if (scenario === "palette-filtered") ui.paletteQuery.value = "stone";
    if (scenario === "palette-empty") ui.paletteQuery.value = "zzzz";
  }
  if (scenario.startsWith("tools")) {
    ui.toolsOpen.value = true;
    if (scenario === "tools-on") {
      snapshot = {
        ...snapshot,
        tools: {
          ...snapshot.tools,
          timeHours: 24,
          clockRuns: false,
          chunkBorders: true,
          wireframe: true,
          flying: true,
          flySpeed: 16,
        },
      };
      publish();
    }
  }
  if (scenario.startsWith("debug")) ui.debugOpen.value = true;
  if (scenario === "debug-largest" && snapshot.debug) {
    snapshot = {
      ...snapshot,
      seed: 4294967295,
      debug: {
        ...snapshot.debug,
        feet: [-22528, -1536, 22527],
        chunk: [-704, -48, 703],
        pitchDegrees: 85,
        skyLight: 15,
        blockLight: [15, 15, 15],
        fps: 144,
        slowestFrameMs: 99999.9,
        drawCalls: 1500,
        triangles: 4000000,
        trackedMemoryBytes: 1610612736,
        queues: { generate: 999, light: 999, mesh: 999 },
        seed: 4294967295,
        build: {
          version: "0.1.0",
          commit: "ffffffffffffffffffffffffffffffffffffffff",
        },
      },
    };
    publish();
  }
  if (scenario === "hud-name" || scenario === "toast-held-name") {
    const selected = 8;
    const block = fixtureBlocks.find(
      (item) => item.id === snapshot.hotbar.slots[selected],
    );
    snapshot = {
      ...snapshot,
      hotbar: { ...snapshot.hotbar, selected, itemName: block?.name ?? null },
    };
    publish();
    ui.heldName.value = block?.name ?? null;
  }
  if (scenario === "hud-hidden") ui.hudVisible.value = false;
  if (scenario === "confirm-clear") ui.confirmSeed.value = 1;
  if (scenario === "toast-shot") ui.toast.value = { id: "toast.shot" };
  if (scenario === "toast-fly")
    ui.toast.value = { id: "toast.fly", values: { n: 16 } };
  if (scenario === "toast-windowed") ui.toast.value = { id: "toast.windowed" };
  if (scenario === "toast-held-name") ui.toast.value = { id: "toast.shot" };
  if (scenario === "toast-palette") {
    ui.blocking.value = "blocks";
    ui.toast.value = { id: "toast.shot" };
  }
  return { ui, commands, browserActions, travels, cancelled, port, emit };
}
