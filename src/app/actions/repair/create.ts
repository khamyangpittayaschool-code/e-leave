"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createRepair } from "@/services/repair.service";
import { RepairCategory, RepairUrgency } from "@prisma/client";

export async function createRepairAction(formData: {
  title: string;
  description: string;
  location: string;
  urgency: RepairUrgency;
  category: RepairCategory;
  expectedFinishAt?: string | null;
}) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");

    const rawRepair = await createRepair(
      { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position },
      formData
    );
    const repair = JSON.parse(JSON.stringify(rawRepair));
    return { success: true, repair };
  } catch (err: any) {
    console.error("createRepairAction failed:", err);
    return { success: false, error: err.message || "เกิดข้อผิดพลาดของระบบ" };
  }
}
