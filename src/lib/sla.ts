export type SlaStatusType = "ON_TIME" | "WARNING" | "OVERDUE";

export interface SlaCalculationResult {
  status: SlaStatusType;
  label: string;
  color: string;
}

/**
 * Dynamic SLA Status Evaluator
 * Evaluates SLA status dynamically without relying on stale database flags.
 */
export function calculateSlaStatus(
  createdAt: Date | string,
  expectedFinishAt: Date | string | null | undefined,
  finishedAt: Date | string | null | undefined,
  warningHours: number = 4
): SlaCalculationResult {
  const now = new Date();
  const created = new Date(createdAt);
  const finishDate = finishedAt ? new Date(finishedAt) : null;
  const targetDate = expectedFinishAt
    ? new Date(expectedFinishAt)
    : new Date(created.getTime() + 24 * 60 * 60 * 1000); // Default 24 hours SLA

  // Finished repairs
  if (finishDate) {
    if (finishDate <= targetDate) {
      return { status: "ON_TIME", label: "เสร็จตามกำหนด", color: "text-emerald-600 dark:text-emerald-400" };
    }
    return { status: "OVERDUE", label: "เสร็จเกินเวลา", color: "text-amber-600 dark:text-amber-400" };
  }

  // Active repairs (Pending, Assigned, In Progress)
  if (now > targetDate) {
    return { status: "OVERDUE", label: "⚠️ เกินเวลากำหนด", color: "text-red-600 dark:text-red-400 font-bold" };
  }

  const hoursLeft = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft <= warningHours) {
    return { status: "WARNING", label: "ใกล้ครบกำหนด", color: "text-amber-600 dark:text-amber-400 font-semibold" };
  }

  return { status: "ON_TIME", label: "ปกติ", color: "text-slate-500 dark:text-slate-400" };
}
