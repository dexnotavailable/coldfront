import { errors } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type StandardReadinessFailure,
  waitForDiagnosticReadiness,
} from "../../src/postcards/capture-readiness.js";
import { postcardArguments } from "../../src/postcards/prepare.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
const isTimeout = (error: unknown) => error instanceof errors.TimeoutError;
function fixture(readyAt: number, receiptMs = 0) {
  const misses: StandardReadinessFailure[] = [];
  const wait = vi.fn(
    (timeout: number) =>
      new Promise<void>((resolve, reject) => {
        const remaining = readyAt - Date.now();
        setTimeout(
          () =>
            remaining <= timeout
              ? resolve()
              : reject(
                  new errors.TimeoutError(
                    `Readiness timed out after ${timeout}ms`,
                  ),
                ),
          Math.min(timeout, Math.max(0, remaining)),
        );
      }),
  );
  const persist = vi.fn(async (failure: StandardReadinessFailure) => {
    misses.push(failure);
    if (receiptMs)
      await new Promise<void>((resolve) => setTimeout(resolve, receiptMs));
  });
  const operation = waitForDiagnosticReadiness(
    wait,
    persist,
    isTimeout,
    Date.now,
  );
  return { wait, persist, misses, operation };
}

describe("single-postcard diagnostic readiness", () => {
  it("rejects a first wait that resolves after the absolute300s ceiling", async () => {
    const wait = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 300001)),
    );
    const persist = vi.fn();
    const operation = waitForDiagnosticReadiness(
      wait,
      persist,
      isTimeout,
      Date.now,
    );
    const failed = expect(operation).rejects.toThrow("300000ms ceiling");
    await vi.advanceTimersByTimeAsync(300001);
    await failed;
    expect(wait.mock.calls).toHaveLength(1);
    expect(persist).not.toHaveBeenCalled();
  });
  it("finishes within180s with one bounded wait and no failure receipt", async () => {
    const f = fixture(179000);
    await vi.advanceTimersByTimeAsync(179000);
    expect(await f.operation).toMatchObject({
      standardTimingPassed: true,
      elapsedMs: 179000,
      standardFailure: null,
    });
    expect(f.wait.mock.calls).toEqual([[180000]]);
    expect(f.persist).not.toHaveBeenCalled();
  });
  it("persists an immutable180s failure before continuing to late readiness", async () => {
    const f = fixture(220000);
    await vi.advanceTimersByTimeAsync(180000);
    expect(f.misses).toHaveLength(1);
    expect(f.misses[0]).toMatchObject({
      status: "failed",
      deadlineMs: 180000,
      elapsedMs: 180000,
    });
    expect(Object.isFrozen(f.misses[0])).toBe(true);
    expect(f.wait.mock.calls).toEqual([[180000], [120000]]);
    await vi.advanceTimersByTimeAsync(40000);
    const result = await f.operation;
    expect(result.standardTimingPassed).toBe(false);
    expect(result.standardFailure).toBe(f.misses[0]);
    expect(result.elapsedMs).toBe(220000);
    expect(f.persist).toHaveBeenCalledTimes(1);
  });
  it("deducts receipt I/O from the fixed300s ceiling", async () => {
    const f = fixture(299000, 7000);
    await vi.advanceTimersByTimeAsync(187000);
    expect(f.wait.mock.calls).toEqual([[180000], [113000]]);
    await vi.advanceTimersByTimeAsync(112000);
    expect((await f.operation).standardTimingPassed).toBe(false);
  });
  it("retains the first failure when the continuation times out at300s", async () => {
    const f = fixture(300001);
    const failed = expect(f.operation).rejects.toThrow("120000ms");
    await vi.advanceTimersByTimeAsync(300000);
    await failed;
    expect(f.misses).toHaveLength(1);
    expect(f.misses[0]?.elapsedMs).toBe(180000);
    expect(f.wait.mock.calls).toEqual([[180000], [120000]]);
  });
  it("never passes timeout0 after a slow failure-receipt write", async () => {
    const f = fixture(400000, 120000);
    const failed = expect(f.operation).rejects.toThrow("300000ms ceiling");
    await vi.advanceTimersByTimeAsync(300000);
    await failed;
    expect(f.wait.mock.calls).toEqual([[180000]]);
    expect(f.misses).toHaveLength(1);
  });
  it("does not swallow page/cleanup errors or errors merely named TimeoutError", async () => {
    for (const error of [
      new Error("Target page closed"),
      Object.assign(new Error("different failure"), { name: "TimeoutError" }),
    ]) {
      const wait = vi.fn().mockRejectedValue(error),
        persist = vi.fn();
      await expect(
        waitForDiagnosticReadiness(wait, persist, isTimeout, Date.now),
      ).rejects.toBe(error);
      expect(wait).toHaveBeenCalledTimes(1);
      expect(persist).not.toHaveBeenCalled();
    }
  });
  it("aborts if preserving the standard failure fails", async () => {
    const error = new Error("receipt write failed"),
      timeout = new errors.TimeoutError("180s");
    const wait = vi.fn().mockRejectedValue(timeout),
      persist = vi.fn().mockRejectedValue(error);
    await expect(
      waitForDiagnosticReadiness(wait, persist, isTimeout, Date.now),
    ).rejects.toBe(error);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });
  it("propagates a browser-close error during continuation while retaining the miss", async () => {
    const error = new Error("browser closed"),
      misses: StandardReadinessFailure[] = [];
    const wait = vi
      .fn()
      .mockRejectedValueOnce(new errors.TimeoutError("180s"))
      .mockRejectedValueOnce(error);
    await expect(
      waitForDiagnosticReadiness(
        wait,
        async (failure) => {
          misses.push(failure);
        },
        isTimeout,
        Date.now,
      ),
    ).rejects.toBe(error);
    expect(misses).toHaveLength(1);
    expect(Object.isFrozen(misses[0])).toBe(true);
  });
});

describe("diagnostic capture CLI guards before resolution", () => {
  it("accepts an explicit singleHELL view while leaving ordinary multi-shot options unchanged", () => {
    expect(
      postcardArguments([
        "--phase",
        "1.3",
        "--only",
        "HELL-1",
        "--diagnostic-continue",
      ]).ids,
    ).toEqual(["HELL-1"]);
    expect(postcardArguments(["--phase", "1.3"]).ids).toEqual([
      "HELL-1",
      "HELL-2",
    ]);
    expect(postcardArguments(["--phase", "1.3", "--commit"]).ids).toHaveLength(
      2,
    );
  });
  it("rejects multiple diagnostic IDs and default two-shot phase1.3", () => {
    for (const args of [
      ["--phase", "1.3"],
      ["--phase", "1.3", "--only", "HELL-1,HELL-2"],
    ])
      expect(() =>
        postcardArguments([...args, "--diagnostic-continue"]),
      ).toThrow("one postcard");
  });
  it("rejects commit and resolve-only diagnostic combinations", () => {
    for (const flag of ["--commit", "--resolve-only"])
      expect(() =>
        postcardArguments([
          "--phase",
          "1.3",
          "--only",
          "HELL-1",
          "--diagnostic-continue",
          flag,
        ]),
      ).toThrow(flag);
  });
});
