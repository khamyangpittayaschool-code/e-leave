"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  assignRepair,
  startRepair,
  completeRepair,
  cancelRepair,
  getRepairs,
  getRepairDetail,
} from "@/services/repair.service";

function getActor(user: any) {
  return {
    id: user.id,
    role: user.role ?? "TEACHER",
    position: user.position ?? null,
  };
}

/** Assign a repair to a technician */
export async function assignRepairAction(
  repairId: string,
  assigneeId: string,
  currentVersion: number
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const actor = getActor(session.user);
    
    const repair = await assignRepair(actor, repairId, assigneeId, currentVersion);
    return { success: true, repair };
  } catch (err: any) {
    console.error("assignRepairAction failed:", err);
    return { success: false, error: err.message || "มอบหมายงานซ่อมไม่สำเร็จ" };
  }
}

/** Technician starts work */
export async function startRepairAction(repairId: string, currentVersion: number) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const actor = getActor(session.user);

    const repair = await startRepair(actor, repairId, currentVersion);
    return { success: true, repair };
  } catch (err: any) {
    console.error("startRepairAction failed:", err);
    return { success: false, error: err.message || "เริ่มดำเนินการซ่อมไม่สำเร็จ" };
  }
}

/** Technician completes work */
export async function completeRepairAction(
  repairId: string,
  currentVersion: number,
  input: { resolutionNote: string; cost?: number | null; materialsUsed?: string | null }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const actor = getActor(session.user);

    const repair = await completeRepair(actor, repairId, currentVersion, input);
    return { success: true, repair };
  } catch (err: any) {
    console.error("completeRepairAction failed:", err);
    return { success: false, error: err.message || "บันทึกผลการซ่อมไม่สำเร็จ" };
  }
}

/** Cancel a repair request */
export async function cancelRepairAction(
  repairId: string,
  currentVersion: number,
  cancelReason: string
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const actor = getActor(session.user);

    const repair = await cancelRepair(actor, repairId, currentVersion, cancelReason);
    return { success: true, repair };
  } catch (err: any) {
    console.error("cancelRepairAction failed:", err);
    return { success: false, error: err.message || "ยกเลิกคำขอแจ้งซ่อมไม่สำเร็จ" };
  }
}

/** Fetch repair list (own or all depending on role) */
export async function getRepairsAction() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const actor = getActor(session.user);

    const repairs = await getRepairs(actor);
    return { success: true, repairs };
  } catch (err: any) {
    console.error("getRepairsAction failed:", err);
    return { success: false, error: err.message || "ดึงข้อมูลรายการแจ้งซ่อมไม่สำเร็จ" };
  }
}

/** Fetch single repair detail */
export async function getRepairDetailAction(repairId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const actor = getActor(session.user);

    const repair = await getRepairDetail(actor, repairId);
    return { success: true, repair };
  } catch (err: any) {
    console.error("getRepairDetailAction failed:", err);
    return { success: false, error: err.message || "ดึงข้อมูลรายละเอียดไม่สำเร็จ" };
  }
}
