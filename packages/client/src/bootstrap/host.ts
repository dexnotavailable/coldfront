import type { UiHost } from "../contracts/game-ui.js";

export interface KeyboardLock {
  lock(): Promise<void>;
  unlock(): void;
}
export interface FullscreenDocument extends EventTarget {
  readonly fullscreenElement: Element | null;
  readonly documentElement: {
    requestFullscreen(
      options?: FullscreenOptions & { keyboardLock: "browser" },
    ): Promise<void>;
  };
  exitFullscreen(): Promise<void>;
}
export interface FullscreenState {
  enter(): void;
  toggle(): void;
  locked(): boolean;
  /** False means the preceding fullscreen-loss event already resolved this Esc. */
  claimEscape(): boolean;
  releaseEscape(): void;
  dispose(): void;
}

/** Only fulfilled browser promises and the actual fullscreen element establish lock. */
export function createFullscreenState(
  doc: FullscreenDocument,
  keyboard: KeyboardLock | undefined,
  onUnexpectedExit: () => void,
  onWindowed: () => void,
  now: () => number = () => performance.now(),
): FullscreenState {
  let locked = false;
  let entering = false;
  let expectedExit = false;
  let wasFullscreen = doc.fullscreenElement !== null;
  let lastEscape = -Infinity;
  let lastUnexpected = -Infinity;
  let escapeHeld = false;
  let disposed = false;
  let attempt = 0;
  const change = (): void => {
    const fullscreen = doc.fullscreenElement !== null;
    if (!fullscreen) {
      attempt++;
      entering = false;
      locked = false;
      keyboard?.unlock();
      if (
        wasFullscreen &&
        !expectedExit &&
        !escapeHeld &&
        now() - lastEscape > 500
      ) {
        lastUnexpected = now();
        onUnexpectedExit();
      }
      expectedExit = false;
    }
    wasFullscreen = fullscreen;
  };
  doc.addEventListener("fullscreenchange", change);
  const enter = (): void => {
    if (entering || disposed) return;
    entering = true;
    const currentAttempt = ++attempt;
    // Invocation stays in the trusted Play/Resume/F11 event, before any await.
    let request: Promise<void>;
    try {
      request = doc.fullscreenElement
        ? Promise.resolve()
        : doc.documentElement.requestFullscreen({ keyboardLock: "browser" });
    } catch {
      entering = false;
      onWindowed();
      return;
    }
    void request
      .then(async () => {
        if (disposed || currentAttempt !== attempt || !doc.fullscreenElement)
          return;
        if (keyboard) {
          await keyboard.lock();
          if (!disposed && currentAttempt === attempt)
            locked = doc.fullscreenElement !== null;
        }
      })
      .catch(() => {
        if (currentAttempt === attempt) locked = false;
      })
      .finally(() => {
        if (currentAttempt === attempt) {
          entering = false;
          if (!disposed && !(locked && doc.fullscreenElement)) onWindowed();
        }
      });
  };
  return {
    enter,
    toggle() {
      if (!doc.fullscreenElement) {
        enter();
        return;
      }
      expectedExit = true;
      locked = false;
      keyboard?.unlock();
      void doc.exitFullscreen().catch(() => {
        expectedExit = false;
      });
    },
    locked: () => locked && doc.fullscreenElement !== null,
    claimEscape() {
      const time = now();
      escapeHeld = true;
      lastEscape = time;
      if (time - lastUnexpected <= 500) {
        lastUnexpected = -Infinity;
        return false;
      }
      return true;
    },
    releaseEscape() {
      if (escapeHeld) lastEscape = now();
      escapeHeld = false;
      lastUnexpected = -Infinity;
    },
    dispose() {
      disposed = true;
      locked = false;
      keyboard?.unlock();
      doc.removeEventListener("fullscreenchange", change);
    },
  };
}

export function appRoute(base: string, route: string, origin: string): string {
  return new URL(route, new URL(base, origin)).href;
}

export function browserHost(fullscreen: FullscreenState, base: string): UiHost {
  return {
    enterFullscreen: () => fullscreen.enter(),
    toggleFullscreen: () => fullscreen.toggle(),
    reload: () => location.reload(),
    openRoute: (route) => {
      window.open(
        appRoute(base, route, location.origin),
        "_blank",
        "noopener,noreferrer",
      );
    },
    downloadPng(blob) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `coldfront-${Date.now()}.png`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
    randomSeed() {
      return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    },
  };
}
