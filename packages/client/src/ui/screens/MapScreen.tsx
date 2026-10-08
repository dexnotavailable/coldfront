/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { MapFrame, MapPoint } from "../../contracts/game-ui";
import { Blocking } from "../components/Blocking";
import { Button, IconButton, Spinner } from "../components/core";
import { ContentText, Punctuation, Text, Value } from "../components/Text";
import type { UiController } from "../controller";
import {
  clampMap,
  fitMap,
  type MapSize,
  type MapView,
  mapBounds,
  mapPixel,
  mapPoint,
  mapRasterSize,
  scaleBar,
  wheelPixels,
  zoomMap,
} from "../map-math";
import { t } from "../t";
import { MapLabels } from "./MapLabels";

export function MapScreen({ ui }: { ui: UiController }) {
  const info = ui.game.value.mapInfo,
    sessionId = ui.mapSession.value;
  const area = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const raster = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<MapSize>({ width: 1, height: 1 });
  const [view, setView] = useState<MapView>({ x: 0, z: 0, metresPerPixel: 1 });
  const current = useRef(view),
    target = useRef(view),
    keys = useRef(new Set<string>());
  const [frame, setFrame] = useState<MapFrame | null>(null),
    [pending, setPending] = useState(false);
  const [cursor, setCursor] = useState<MapPoint | null>(ui.mapPin.value);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    view: MapView;
    moved: boolean;
  } | null>(null);
  const lastClick = useRef<{ time: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const labelAnchors = useMemo(
    () =>
      (frame?.names ?? []).flatMap((label) => {
        const region = info?.regions.find((item) => item.id === label.regionId);
        const at = mapPixel(view, size, label.x, label.z);
        return region &&
          at.x >= 0 &&
          at.x <= size.width &&
          at.y >= 0 &&
          at.y <= size.height
          ? [{ id: label.regionId, name: region.name, ...at }]
          : [];
      }),
    [frame, info, view, size],
  );
  const maximum = info ? fitMap(info.bounds, size).metresPerPixel : 1;
  const move = (next: MapView, instant = false): void => {
    target.current = next;
    if (instant) {
      current.current = next;
      setView(next);
    }
  };
  const point = (event: { clientX: number; clientY: number }) => {
    const rect = area.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * size.width) / rect.width,
      y: ((event.clientY - rect.top) * size.height) / rect.height,
    };
  };
  useEffect(() => {
    const root = area.current;
    if (!root || !info) return;
    const resize = () => {
      const next = {
        width: Math.max(1, Math.round(root.clientWidth)),
        height: Math.max(1, Math.round(root.clientHeight)),
      };
      setSize(next);
      move(fitMap(info.bounds, next), true);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    return () => observer.disconnect();
  }, [sessionId]);
  useEffect(() => {
    if (!info) return;
    let alive = true,
      last = performance.now(),
      speed = 0,
      raf = 0;
    const step = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let x =
          Number(keys.current.has("KeyD")) - Number(keys.current.has("KeyA")),
        z = Number(keys.current.has("KeyS")) - Number(keys.current.has("KeyW"));
      const length = Math.hypot(x, z),
        moving = length > 0;
      speed = moving
        ? Math.min(1, speed + dt / 0.12)
        : Math.max(0, speed - dt / 0.08);
      if (moving) {
        x /= length;
        z /= length;
        const d =
          (size.height * current.current.metresPerPixel) /
          (2 * Math.tan(Math.PI / 9));
        target.current = clampMap(
          {
            ...target.current,
            x: target.current.x + x * d * speed * dt,
            z: target.current.z + z * d * speed * dt,
          },
          info.bounds,
          maximum,
        );
      }
      const alpha = 1 - Math.exp(-dt / 0.09),
        before = current.current,
        to = target.current;
      if (
        Math.abs(before.x - to.x) +
          Math.abs(before.z - to.z) +
          Math.abs(before.metresPerPixel - to.metresPerPixel) >
        0.0001
      ) {
        const next = {
          x: before.x + (to.x - before.x) * alpha,
          z: before.z + (to.z - before.z) * alpha,
          metresPerPixel:
            before.metresPerPixel +
            (to.metresPerPixel - before.metresPerPixel) * alpha,
        };
        current.current = next;
        setView(next);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const release = () => keys.current.clear();
    window.addEventListener("blur", release);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("blur", release);
      keys.current.clear();
    };
  }, [sessionId, size, maximum]);
  useEffect(() => {
    if (sessionId === null || size.width <= 1 || size.height <= 1) return;
    let active = true;
    setPending(true);
    const timer = setTimeout(() => {
      void ui
        .readMap({
          sessionId,
          bounds: mapBounds(target.current, size),
          ...mapRasterSize(size),
        })
        .then((next) => {
          if (active && next?.sessionId === sessionId) {
            setFrame(next);
            setPending(false);
          }
        })
        .catch((error) => {
          if (active) ui.loadFailed(error);
        });
    }, 60);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sessionId, size, view, ui]);
  useEffect(() => {
    const root = area.current;
    if (!root || !info) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = point(event);
      move(
        zoomMap(
          target.current,
          size,
          at.x,
          at.y,
          Math.exp(0.0016 * wheelPixels(event.deltaY, event.deltaMode)),
          info.bounds,
          maximum,
        ),
      );
    };
    root.addEventListener("wheel", wheel, { passive: false });
    return () => root.removeEventListener("wheel", wheel);
  }, [size, sessionId, maximum]);
  useEffect(() => {
    if (!frame) {
      raster.current = null;
      return;
    }
    const source = document.createElement("canvas");
    source.width = frame.width;
    source.height = frame.height;
    source
      .getContext("2d")
      ?.putImageData(
        new ImageData(
          new Uint8ClampedArray(frame.rgba),
          frame.width,
          frame.height,
        ),
        0,
        0,
      );
    raster.current = source;
  }, [frame]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    el.width = size.width;
    el.height = size.height;
    const context = el.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, size.width, size.height);
    const source = raster.current;
    if (!source || !frame) return;
    const a = mapPixel(view, size, frame.bounds.minX, frame.bounds.minZ),
      b = mapPixel(view, size, frame.bounds.maxX, frame.bounds.maxZ);
    context.imageSmoothingEnabled = false;
    context.drawImage(source, a.x, a.y, b.x - a.x, b.y - a.y);
  }, [frame, view, size]);
  if (!info || sessionId === null) return null;
  const pin = ui.mapPin.value,
    pinPixel = pin ? mapPixel(view, size, pin.x, pin.z) : null;
  const bar = scaleBar(view.metresPerPixel);
  const region = info.regions.find((item) => item.id === cursor?.regionId);
  const key = (event: KeyboardEvent) => {
    if (
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.repeat
    )
      return;
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      keys.current.add(event.code);
      event.preventDefault();
    }
    if (event.code === "KeyM") {
      ui.closeMap();
      event.preventDefault();
    }
  };
  return (
    <Blocking
      onClose={() => ui.closeMap()}
      onEnter={() => {
        void ui.teleportPin();
      }}
      onKey={key}
      onKeyRelease={(event) => {
        keys.current.delete(event.code);
      }}
    >
      <div class="cf-map">
        <div class="cf-map-area" data-grabbing={dragging} ref={area}>
          <canvas
            ref={canvas}
            data-map-ready={!!frame}
            data-map-x={view.x}
            data-map-z={view.z}
            data-map-scale={view.metresPerPixel}
            data-map-width={size.width}
            data-map-height={size.height}
            data-map-max-x={info.bounds.maxX}
            data-map-max-z={info.bounds.maxZ}
            data-map-pin-x={pin?.x}
            data-map-pin-z={pin?.z}
            data-ui="map.view"
            aria-label={t("map.view")}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget
                .closest<HTMLElement>("[data-blocking]")
                ?.focus();
              const at = point(event);
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointer: event.pointerId,
                ...at,
                view: current.current,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              const at = point(event),
                held = drag.current;
              if (held) {
                const dx = at.x - held.x,
                  dy = at.y - held.y;
                if (Math.hypot(dx, dy) >= 6 || held.moved) {
                  held.moved = true;
                  setDragging(true);
                  move(
                    clampMap(
                      {
                        ...held.view,
                        x: held.view.x - dx * held.view.metresPerPixel,
                        z: held.view.z - dy * held.view.metresPerPixel,
                      },
                      info.bounds,
                      maximum,
                    ),
                    true,
                  );
                }
              }
              const location = mapPoint(current.current, size, at.x, at.y);
              const inspected = ui.inspectMap({ sessionId, ...location });
              if (inspected) setCursor(inspected);
            }}
            onPointerUp={(event) => {
              const held = drag.current;
              drag.current = null;
              setDragging(false);
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              if (!held || held.moved) {
                lastClick.current = null;
                return;
              }
              const at = point(event),
                location = mapPoint(current.current, size, at.x, at.y),
                inspected = ui.inspectMap({ sessionId, ...location });
              if (!inspected) return;
              ui.chooseMapPoint(inspected);
              setCursor(inspected);
              const previous = lastClick.current;
              lastClick.current = { time: event.timeStamp, ...at };
              if (
                previous &&
                event.timeStamp - previous.time <= 300 &&
                Math.hypot(at.x - previous.x, at.y - previous.y) < 6
              ) {
                lastClick.current = null;
                void ui.teleportPin();
              }
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(false);
            }}
            onContextMenu={(event) => event.preventDefault()}
          />
          <MapLabels anchors={labelAnchors} size={size} />
          {pinPixel && (
            <div
              class="cf-map-pin"
              data-ui="map.pin"
              data-on-map={
                pinPixel.x >= 8 &&
                pinPixel.y >= 8 &&
                pinPixel.x <= size.width - 8 &&
                pinPixel.y <= size.height - 8
              }
              role="img"
              aria-label={t("map.pin")}
              style={{ left: `${pinPixel.x}px`, top: `${pinPixel.y}px` }}
            />
          )}
          <div class="cf-map-spinner">
            <Spinner pending={pending || ui.travelPending.value} />
          </div>
        </div>
        <div class="cf-map-close">
          <IconButton id="map.close" onClick={() => ui.closeMap()}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </IconButton>
        </div>
        <div class="cf-map-bar">
          <div class="cf-map-position" data-ui="map.where">
            <Text id="map.where" />
            {cursor && (
              <>
                <Value value={cursor.x} />
                <Value value={cursor.z} />
                <Punctuation kind="middle-dot" />
                {region ? (
                  <ContentText value={region.name} />
                ) : ui.game.value.world?.identity.kind === "test" ? (
                  <Text id="title.world.test" />
                ) : null}
              </>
            )}
          </div>
          <Button
            id="map.teleport"
            kind="primary"
            onClick={() => {
              void ui.teleportPin();
            }}
          />
          <div
            class="cf-map-scale"
            data-map-metres={bar.metres}
            data-ui="map.scale"
            role="img"
            aria-label={t("map.scale")}
          >
            <span
              class="cf-map-scale-line"
              style={{ width: `${bar.pixels}px` }}
            />
            <span>
              <Value
                value={bar.metres >= 1000 ? bar.metres / 1000 : bar.metres}
              />
              <Text id={bar.metres >= 1000 ? "unit.km" : "unit.m"} />
            </span>
          </div>
        </div>
      </div>
    </Blocking>
  );
}
