/**
 * Repair Service — Business Logic Layer for the Repair Request System (Sprint 1).
 *
 * Rules:
 *  - Must NOT import from prisma directly. Use repair.repository.ts for data access.
 *  - Must NOT be called from UI components. Only Server Actions may use this.
 *  - All permission checks use assertRepairPermission() from permissions.ts.
 *  - Sprint 1 scope: CRUD + Status Workflow only. Photo/Archive logic is Sprint 2/3.
 */

import { RepairCategory, RepairStatus, RepairUrgency } from "@prisma/client";
import { assertRepairPermission } from "@/lib/permissions";
import {
  createRepairRequest,
  findAllRepairs,
  findRepairById,
  findRepairsByRequester,
  softDeleteRepair,
  updateRepairStatus,
} from "@/repositories/repair.repository";
import { logRepairAction, REPAIR_ACTIONS } from "@/services/audit.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  role: string;
  position?: string | null;
}

// ─── SLA Helper ───────────────────────────────────────────────────────────────

function computeSlaStatus(
  expectedFinishAt: Date | null | undefined,
  status: RepairStatus
): "ON_TIME" | "WARNING" | "OVERDUE" | null {
  if (!expectedFinishAt) return null;
  if (status === "COMPLETED" || status === "CANCELLED") return null;

  const now = new Date();
  const hoursRemaining =
    (expectedFinishAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining < 0) return "OVERDUE";
  if (hoursRemaining < 24) return "WARNING";
  return "ON_TIME";
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createRepair(
  actor: SessionUser,
  input: {
    title: string;
    description: string;
    location: string;
    urgency: RepairUrgency;
    category: RepairCategory;
    expectedFinishAt?: string | null;
  }
) {
  assertRepairPermission(actor, "repair:create");

  const repair = await createRepairRequest({
    title: input.title,
    description: input.description,
    location: input.location,
    urgency: input.urgency,
    category: input.category,
    requesterId: actor.id,
    expectedFinishAt: input.expectedFinishAt
      ? new Date(input.expectedFinishAt)
      : null,
  });

  await logRepairAction({
    repairId: repair.id,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_CREATED,
    detail: repair.title,
  });

  return repair;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getRepairs(actor: SessionUser) {
  const canViewAll = actor.role === "ADMIN" || actor.position === "ช่าง" ||
    actor.position === "หัวหน้างาน" || actor.position === "หัวหน้าหมวด" ||
    actor.position === "ผู้อำนวยการ";

  if (canViewAll) {
    assertRepairPermission(actor, "repair:view.all");
    return findAllRepairs();
  }

  assertRepairPermission(actor, "repair:view.own");
  return findRepairsByRequester(actor.id);
}

export async function getRepairDetail(actor: SessionUser, repairId: string) {
  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

  const isOwner = repair.requesterId === actor.id;

  if (!isOwner) {
    assertRepairPermission(actor, "repair:view.all");
  }

  // Strip cost if user lacks repair:view.cost
  const canViewCost =
    actor.role === "ADMIN" ||
    actor.position === "หัวหน้างาน" ||
    actor.position === "หัวหน้าหมวด" ||
    actor.position === "ผู้อำนวยการ";

  return {
    ...repair,
    cost: canViewCost && repair.cost != null ? repair.cost.toNumber() : null,
  };
}

// ─── Assign ───────────────────────────────────────────────────────────────────

export async function assignRepair(
  actor: SessionUser,
  repairId: string,
  assigneeId: string,
  currentVersion: number
) {
  assertRepairPermission(actor, "repair:assign");

  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

  const updated = await updateRepairStatus({
    repairId,
    currentVersion,
    expectedCurrentStatus: "PENDING",
    nextStatus: "ASSIGNED",
    assigneeId,
    assignedAt: new Date(),
    slaStatus: computeSlaStatus(repair.expectedFinishAt, "ASSIGNED"),
  });

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_ASSIGNED,
    detail: `มอบหมายให้ ${assigneeId}`,
  });

  return updated;
}

// ─── Start Work ───────────────────────────────────────────────────────────────

export async function startRepair(
  actor: SessionUser,
  repairId: string,
  currentVersion: number
) {
  assertRepairPermission(actor, "repair:update");

  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");
  if (repair.assigneeId !== actor.id && actor.role !== "ADMIN") {
    throw new Error("คุณไม่ใช่ช่างที่รับผิดชอบงานชิ้นนี้");
  }

  const updated = await updateRepairStatus({
    repairId,
    currentVersion,
    expectedCurrentStatus: "ASSIGNED",
    nextStatus: "IN_PROGRESS",
    slaStatus: computeSlaStatus(repair.expectedFinishAt, "IN_PROGRESS"),
  });

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_STARTED,
  });

  return updated;
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export async function completeRepair(
  actor: SessionUser,
  repairId: string,
  currentVersion: number,
  input: {
    resolutionNote: string;
    cost?: number | null;
    materialsUsed?: string | null;
  }
) {
  assertRepairPermission(actor, "repair:update");

  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");
  if (repair.assigneeId !== actor.id && actor.role !== "ADMIN") {
    throw new Error("คุณไม่ใช่ช่างที่รับผิดชอบงานชิ้นนี้");
  }

  const now = new Date();
  const updated = await updateRepairStatus({
    repairId,
    currentVersion,
    expectedCurrentStatus: "IN_PROGRESS",
    nextStatus: "COMPLETED",
    resolutionNote: input.resolutionNote,
    cost: input.cost ?? null,
    materialsUsed: input.materialsUsed ?? null,
    slaStatus: null,
    finishedAt: now,
    actualFinishAt: now,
  });

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_COMPLETED,
    detail: input.resolutionNote,
  });

  return updated;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelRepair(
  actor: SessionUser,
  repairId: string,
  currentVersion: number,
  cancelReason: string
) {
  // Only admin or the original requester can cancel
  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

  const isOwner = repair.requesterId === actor.id;
  if (!isOwner) {
    assertRepairPermission(actor, "repair:delete");
  }

  if (!["PENDING", "ASSIGNED"].includes(repair.status)) {
    throw new Error("ไม่สามารถยกเลิกงานที่อยู่ระหว่างดำเนินการหรือเสร็จสิ้นแล้ว");
  }

  const updated = await updateRepairStatus({
    repairId,
    currentVersion,
    expectedCurrentStatus: repair.status as RepairStatus,
    nextStatus: "CANCELLED",
    cancelReason,
    slaStatus: null,
  });

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_CANCELLED,
    detail: cancelReason,
  });

  return updated;
}

// ─── Soft Delete ──────────────────────────────────────────────────────────────

export async function deleteRepair(
  actor: SessionUser,
  repairId: string,
  deleteReason: string
) {
  assertRepairPermission(actor, "repair:delete");

  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

  await softDeleteRepair(repairId, actor.id, deleteReason);

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_DELETED,
    detail: deleteReason,
  });
}
