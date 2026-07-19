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

  // เฉพาะ Admin หรือหัวหน้าหมวดเท่านั้นที่มีสิทธิ์ดู Dashboard วิเคราะห์และสถิติค่าซ่อม
  assertRepairPermission(actor, "repair:view.cost");

  return getRepairDashboardStats();
}
