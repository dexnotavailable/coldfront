export interface TimingSummary {
  readonly count: number;
  readonly minimumMs: number;
  readonly maximumMs: number;
  readonly meanMs: number;
  readonly medianMs: number;
  /** Nearest-rank p95: sorted[ceil(0.95*N)-1]. */
  readonly p95Ms: number;
}
export interface TimingBudget {
  readonly medianMs?: number;
  readonly p95Ms?: number;
}
export interface BudgetResult {
  readonly enforcement: "informational-until-phase-1.10";
  readonly status: "within-target" | "over-target" | "no-applicable-target";
  readonly target: TimingBudget | null;
  readonly exceeded: readonly string[];
}
export function summariseTimings(values: readonly number[]): TimingSummary {
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error("Timing samples must be nonempty, finite and nonnegative");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: values.length,
    minimumMs: sorted[0] as number,
    maximumMs: sorted[sorted.length - 1] as number,
    meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    medianMs:
      sorted.length % 2
        ? (sorted[middle] as number)
        : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2,
    p95Ms: sorted[Math.ceil(0.95 * sorted.length) - 1] as number,
  };
}
export function compareBudget(
  summary: TimingSummary,
  budget: TimingBudget | null,
): BudgetResult {
  const exceeded: string[] = [];
  if (budget?.medianMs !== undefined && summary.medianMs > budget.medianMs)
    exceeded.push("medianMs");
  if (budget?.p95Ms !== undefined && summary.p95Ms > budget.p95Ms)
    exceeded.push("p95Ms");
  return {
    enforcement: "informational-until-phase-1.10",
    status:
      budget === null
        ? "no-applicable-target"
        : exceeded.length
          ? "over-target"
          : "within-target",
    target: budget,
    exceeded,
  };
}
