"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { assertRepairPermission } from "@/lib/permissions";
import { getRepairDashboardStats } from "@/services/report.service";

export async function getRepairDashboardStatsAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");

  const actor = {
    id: session.user.id,
    role: (session.user as any).role ?? "TEACHER",
    position: (session.user as any).position ?? null,
  };

  // เฉพาะผู้ได้รับอนุญาตเท่านั้นที่มีสิทธิ์ดู Dashboard วิเคราะห์และสถิติการแจ้งซ่อม
  assertRepairPermission(actor, "repair:dashboard");

  return getRepairDashboardStats();
}
