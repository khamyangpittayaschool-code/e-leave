"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { rateRepairService } from "@/services/repair.service";

export async function submitRepairRatingAction(
  repairId: string,
  rating: number,
  comment?: string | null
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");

    const actor = {
      id: session.user.id,
      role: (session.user as any).role ?? "TEACHER",
      position: (session.user as any).position,
    };

    const updated = await rateRepairService(actor, repairId, rating, comment);
    return { success: true, repair: JSON.parse(JSON.stringify(updated)) };
  } catch (err: any) {
    console.error("submitRepairRatingAction failed:", err);
    return { success: false, error: err.message || "ประเมินไม่สำเร็จ" };
  }
}
