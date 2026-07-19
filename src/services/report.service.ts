/**
 * Report & SLA Service — คำนวณข้อมูลสถิติและวิเคราะห์ระดับการให้บริการ (SLA)
 * สำหรับหน้า Dashboard วิเคราะห์สำหรับแอดมินและหัวหน้างาน
 */

import prisma from "@/lib/prisma";
import { RepairStatus, RepairUrgency, SLAStatus } from "@prisma/client";

export interface SlaSummary {
  totalActive: number;
  onTimeCount: number;
  warningCount: number;
  overdueCount: number;
  overduePercentage: number;
}

export interface CategorySummary {
  category: string;
  count: number;
  totalCost: number;
}

export interface MonthlyTrend {
  month: string; // e.g. "2026-07"
  count: number;
  completed: number;
}

export interface TechnicianPerformance {
  id: string;
  name: string;
  assignedCount: number;
  completedCount: number;
  avgResolutionHours: number;
}

export interface DashboardReportData {
  sla: SlaSummary;
  categories: CategorySummary[];
  monthlyTrend: MonthlyTrend[];
  technicians: TechnicianPerformance[];
  totalCostOverall: number;
}

/** คำนวณสถิติและรายงาน SLA */
export async function getRepairDashboardStats(): Promise<DashboardReportData> {
  const now = new Date();

  // 1. ดึงข้อมูลงานซ่อมหลัก
  const allRepairs = await prisma.repairRequest.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      status: true,
      category: true,
      urgency: true,
      cost: true,
      slaStatus: true,
      createdAt: true,
      finishedAt: true,
      assignee: { select: { id: true, name: true } },
    },
  });

  // --- SLA Status Summary ---
  const activeRepairs = allRepairs.filter(
    (r) => r.status !== "COMPLETED" && r.status !== "CANCELLED"
  );
  const totalActive = activeRepairs.length;
  const onTimeCount = activeRepairs.filter((r) => r.slaStatus === "ON_TIME").length;
  const warningCount = activeRepairs.filter((r) => r.slaStatus === "WARNING").length;
  const overdueCount = activeRepairs.filter((r) => r.slaStatus === "OVERDUE").length;

  const overduePercentage =
    totalActive > 0 ? Math.round((overdueCount / totalActive) * 100) : 0;

  // --- Category stats & costs ---
  const categoryMap = new Map<string, { count: number; totalCost: number }>();
  let totalCostOverall = 0;

  for (const r of allRepairs) {
    const cost = r.cost ? Number(r.cost) : 0;
    totalCostOverall += cost;

    const curr = categoryMap.get(r.category) ?? { count: 0, totalCost: 0 };
    categoryMap.set(r.category, {
      count: curr.count + 1,
      totalCost: curr.totalCost + cost,
    });
  }

  const categories: CategorySummary[] = Array.from(categoryMap.entries()).map(
    ([category, data]) => ({
      category,
      count: data.count,
      totalCost: data.totalCost,
    })
  );

  // --- Monthly trends ---
  const trendMap = new Map<string, { count: number; completed: number }>();
  for (const r of allRepairs) {
    const month = r.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
    const curr = trendMap.get(month) ?? { count: 0, completed: 0 };
    trendMap.set(month, {
      count: curr.count + 1,
      completed: curr.completed + (r.status === "COMPLETED" ? 1 : 0),
    });
  }

  const monthlyTrend: MonthlyTrend[] = Array.from(trendMap.entries())
    .map(([month, data]) => ({
      month,
      count: data.count,
      completed: data.completed,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // --- Technician Performance Leaderboard ---
  const techMap = new Map<
    string,
    { name: string; assigned: number; completed: number; totalHours: number }
  >();

  for (const r of allRepairs) {
    if (!r.assignee) continue;
    const techId = r.assignee.id;
    const name = r.assignee.name ?? "ไม่ระบุชื่อ";

    const curr = techMap.get(techId) ?? {
      name,
      assigned: 0,
      completed: 0,
      totalHours: 0,
    };
    curr.assigned += 1;

    if (r.status === "COMPLETED" && r.finishedAt) {
      curr.completed += 1;
      const resHours =
        (r.finishedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
      curr.totalHours += resHours;
    }
    techMap.set(techId, curr);
  }

  const technicians: TechnicianPerformance[] = Array.from(techMap.entries()).map(
    ([id, d]) => ({
      id,
      name: d.name,
      assignedCount: d.assigned,
      completedCount: d.completed,
      avgResolutionHours:
        d.completed > 0 ? Math.round((d.totalHours / d.completed) * 10) / 10 : 0,
    })
  );

  return {
    sla: {
      totalActive,
      onTimeCount,
      warningCount,
      overdueCount,
      overduePercentage,
    },
    categories,
    monthlyTrend,
    technicians,
    totalCostOverall,
  };
}
