"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { assertRepairPermission } from "@/lib/permissions";
import { archiveOldRepairs } from "@/services/archive.service";

/**
 * Server Action สำหรับสั่งล้างระบบสำรองข้อมูลงานซ่อม (สำหรับผู้ดูแลระบบเท่านั้น)
 * @param olderThanMonths ย้อนหลังกี่เดือน
 */
export async function archiveRepairsAction(olderThanMonths: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");

  const actor = {
    id: session.user.id,
    role: (session.user as any).role ?? "TEACHER",
    position: (session.user as any).position ?? null,
  };

  // ตรวจสอบสิทธิ์ว่ามีสิทธิ์รัน Archive หรือไม่ (แอดมินเท่านั้น)
  assertRepairPermission(actor, "repair:archive");

  return archiveOldRepairs(actor.id, olderThanMonths);
}
