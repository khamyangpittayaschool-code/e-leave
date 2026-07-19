"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { deleteRepair } from "@/services/repair.service";

export async function deleteRepairAction(repairId: string, deleteReason: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position };
  return deleteRepair(actor, repairId, deleteReason);
}
