import { effect } from "@preact/signals";
import type { GamePort } from "../contracts/game-ui.js";
import { appRoute } from "./host.js";

const seedKey = "coldfront.seed";
export function rememberedSeed(query: URLSearchParams): string {
  const requested = query.get("seed");
  if (requested !== null && /^\d*$/.test(requested)) return requested;
  try {
    const remembered = localStorage.getItem(seedKey);
    if (remembered !== null && /^\d*$/.test(remembered)) return remembered;
  } catch {
    /* Private storage cannot prevent play. */
  }
  return "1";
}

/** The guard is absent on title/loading, and removed on quit/dispose. */
export function bindWorldLifecycle(
  port: GamePort,
  target: Window = window,
  worldVisible: () => boolean = () => true,
  rawSeedDraft?: () => string,
): () => void {
  let guarded = false;
  let savedDraft: string | undefined;
  let loading = false;
  let attempt: { seed: number; draft: string } | undefined;
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    event.returnValue = "";
  };
  const refresh = (): void => {
    const snapshot = port.read();
    const nextLoading = snapshot.lifecycle === "loading";
    if (nextLoading && (!loading || attempt?.seed !== snapshot.seed)) {
      attempt = {
        seed: snapshot.seed,
        draft: rawSeedDraft?.() ?? String(snapshot.seed),
      };
    }
    loading = nextLoading;
    if (snapshot.lifecycle === "idle" || snapshot.lifecycle === "failed")
      attempt = undefined;
    const visible = worldVisible();
    const playing = snapshot.lifecycle === "ready" && visible;
    if (playing !== guarded) {
      guarded = playing;
      if (guarded) target.addEventListener("beforeunload", beforeUnload);
      else target.removeEventListener("beforeunload", beforeUnload);
    }
    const successfulDraft =
      attempt?.seed === snapshot.seed
        ? attempt.draft
        : (rawSeedDraft?.() ?? String(snapshot.seed));
    if (playing && successfulDraft !== savedDraft) {
      savedDraft = successfulDraft;
      try {
        localStorage.setItem(seedKey, successfulDraft);
      } catch {
        /* The engine reports IndexedDB availability independently. */
      }
    }
  };
  const unsubscribe = port.subscribe((event) => {
    if (event.type === "snapshot") refresh();
  });
  const stopVisibility = effect(refresh);
  return () => {
    unsubscribe();
    stopVisibility();
    target.removeEventListener("beforeunload", beforeUnload);
  };
}

export function watchForUpdate(
  base: string,
  buildId: string,
  onUpdate: () => void,
): () => void {
  const abort = new AbortController();
  let checking = false;
  const check = async (): Promise<void> => {
    if (checking || document.hidden || abort.signal.aborted) return;
    checking = true;
    try {
      const response = await fetch(
        appRoute(base, "version.json", location.origin),
        { cache: "no-store", signal: abort.signal },
      );
      if (response.ok) {
        const release = (await response.json()) as {
          buildId?: unknown;
          commit?: unknown;
        };
        if (
          typeof release.buildId === "string" &&
          typeof release.commit === "string" &&
          /^[a-f0-9]{40,64}$/.test(release.commit) &&
          release.buildId.startsWith(`${release.commit}-`) &&
          /^[a-f0-9]{64}$/.test(
            release.buildId.slice(release.commit.length + 1),
          ) &&
          release.buildId !== buildId
        )
          onUpdate();
      }
    } catch {
      /* An offline request is not evidence of a newer build. */
    } finally {
      checking = false;
    }
  };
  const focus = (): void => {
    void check();
  };
  const timer = setInterval(focus, 60_000);
  window.addEventListener("focus", focus);
  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", focus);
    abort.abort();
  };
}
