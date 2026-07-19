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

/** Assign a repair to a technician */
export async function assignRepairAction(
  repairId: string,
  assigneeId: string,
  currentVersion: number
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position };
  return assignRepair(actor, repairId, assigneeId, currentVersion);
}

/** Technician starts work */
export async function startRepairAction(repairId: string, currentVersion: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position };
  return startRepair(actor, repairId, currentVersion);
}

/** Technician completes work */
export async function completeRepairAction(
  repairId: string,
  currentVersion: number,
  input: { resolutionNote: string; cost?: number | null; materialsUsed?: string | null }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position };
  return completeRepair(actor, repairId, currentVersion, input);
}

/** Cancel a repair request */
export async function cancelRepairAction(
  repairId: string,
  currentVersion: number,
  cancelReason: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position };
  return cancelRepair(actor, repairId, currentVersion, cancelReason);
}

/** Fetch repair list (own or all depending on role) */
export async function getRepairsAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position };
  return getRepairs(actor);
}

/** Fetch single repair detail */
export async function getRepairDetailAction(repairId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = { id: session.user.id, role: (session.user as any).role ?? "TEACHER", position: (session.user as any).position };
  return getRepairDetail(actor, repairId);
}
