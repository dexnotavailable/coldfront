export interface StandardReadinessFailure {
  readonly status: "failed";
  readonly deadlineMs: 180000;
  readonly elapsedMs: number;
  readonly error: string;
}

export interface DiagnosticReadiness {
  readonly standardDeadlineMs: 180000;
  readonly diagnosticDeadlineMs: 300000;
  readonly standardTimingPassed: boolean;
  readonly elapsedMs: number;
  readonly standardFailure: StandardReadinessFailure | null;
}

/** Only the existing initial readiness wait may continue. Polling again does
 * not restart the world or change its requested chunk set. The owner persists
 * the first failure before continuation and closes the browser on any error. */
export async function waitForDiagnosticReadiness(
  wait: (timeoutMs: number) => Promise<void>,
  persistFailure: (failure: StandardReadinessFailure) => Promise<void>,
  isTimeout: (error: unknown) => boolean,
  now: () => number = () => performance.now(),
): Promise<DiagnosticReadiness> {
  const started = now();
  let standardFailure: StandardReadinessFailure | null = null;
  try {
    await wait(180000);
  } catch (error) {
    if (!isTimeout(error)) throw error;
    standardFailure = Object.freeze({
      status: "failed",
      deadlineMs: 180000,
      elapsedMs: now() - started,
      error: String(error),
    });
    await persistFailure(standardFailure);
    const remaining = 300000 - (now() - started);
    // Playwright interprets timeout:0 as unlimited, so never pass it through.
    if (remaining <= 0)
      throw new Error("Diagnostic readiness exceeded its 300000ms ceiling");
    await wait(remaining);
  }
  const elapsedMs = now() - started;
  if (elapsedMs > 300000)
    throw new Error("Diagnostic readiness exceeded its 300000ms ceiling");
  return {
    standardDeadlineMs: 180000,
    diagnosticDeadlineMs: 300000,
    standardTimingPassed: standardFailure === null,
    elapsedMs,
    standardFailure,
  };
}
