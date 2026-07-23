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
  updateRepairRating,
} from "@/repositories/repair.repository";
import { logRepairAction, REPAIR_ACTIONS } from "@/services/audit.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  role: string;
  position?: string | null;
}

import { prisma } from "@/lib/db";

// ─── SLA Helper ───────────────────────────────────────────────────────────────

async function getSlaWarningHours(): Promise<number> {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
    if (settings?.rolePermissions) {
      const parsed = JSON.parse(settings.rolePermissions);
      if (parsed.repairSlaWarningHours !== undefined) {
        return Number(parsed.repairSlaWarningHours);
      }
    }
  } catch (e) {
    console.error("Failed to load SLA warning hours:", e);
  }
  return 24; // Default fallback
}

function computeSlaStatus(
  expectedFinishAt: Date | null | undefined,
  status: RepairStatus,
  warningHours: number = 24
): "ON_TIME" | "WARNING" | "OVERDUE" | null {
  if (!expectedFinishAt) return null;
  if (status === "COMPLETED" || status === "CANCELLED") return null;

  const now = new Date();
  const hoursRemaining =
    (expectedFinishAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining < 0) return "OVERDUE";
  if (hoursRemaining < warningHours) return "WARNING";
  return "ON_TIME";
}

// ─── Create ───────────────────────────────────────────────────────────────────

import { sendRepairLineNotify } from "@/lib/line-notify";

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

  const parseDate = (d?: string | null) => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const repair = await createRepairRequest({
    title: input.title,
    description: input.description,
    location: input.location,
    urgency: input.urgency,
    category: input.category,
    requesterId: actor.id,
    expectedFinishAt: parseDate(input.expectedFinishAt),
  });

  await logRepairAction({
    repairId: repair.id,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_CREATED,
    detail: repair.title,
  });

  sendRepairLineNotify("CREATE", {
    repairNo: repair.repairNo,
    title: repair.title,
    location: repair.location,
    requesterName: (repair as any).requester?.name || actor.position || actor.id,
    urgency: repair.urgency === "URGENT_MOST" ? "เร่งด่วนมาก" : repair.urgency === "URGENT" ? "เร่งด่วน" : "ปกติ",
  }).catch((e) => console.error("Failed to send LINE repair create notify:", e));

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

  const warningHours = await getSlaWarningHours();
  const updated = await updateRepairStatus({
    repairId,
    currentVersion,
    expectedCurrentStatus: "PENDING",
    nextStatus: "ASSIGNED",
    assigneeId,
    assignedAt: new Date(),
    slaStatus: computeSlaStatus(repair.expectedFinishAt, "ASSIGNED", warningHours),
  });

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_ASSIGNED,
    detail: `มอบหมายให้ ${assigneeId}`,
  });

  const assigneeUser = await prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true } });

  sendRepairLineNotify("ASSIGN", {
    repairNo: repair.repairNo,
    title: repair.title,
    location: repair.location,
    assigneeName: assigneeUser?.name || assigneeId,
  }).catch((e) => console.error("Failed to send LINE repair assign notify:", e));

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

  const warningHours = await getSlaWarningHours();
  const updated = await updateRepairStatus({
    repairId,
    currentVersion,
    expectedCurrentStatus: "ASSIGNED",
    nextStatus: "IN_PROGRESS",
    slaStatus: computeSlaStatus(repair.expectedFinishAt, "IN_PROGRESS", warningHours),
  });

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_STARTED,
  });

  sendRepairLineNotify("START", {
    repairNo: repair.repairNo,
    title: repair.title,
    location: repair.location,
    assigneeName: (repair as any).assignee?.name || actor.id,
  }).catch((e) => console.error("Failed to send LINE repair start notify:", e));

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

  sendRepairLineNotify("COMPLETE", {
    repairNo: repair.repairNo,
    title: repair.title,
    location: repair.location,
    assigneeName: (repair as any).assignee?.name || actor.id,
    resolutionNote: input.resolutionNote,
  }).catch((e) => console.error("Failed to send LINE repair complete notify:", e));

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

  sendRepairLineNotify("CANCEL", {
    repairNo: repair.repairNo,
    title: repair.title,
    location: repair.location,
    cancelReason,
  }).catch((e) => console.error("Failed to send LINE repair cancel notify:", e));

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

// ─── Rating & Satisfaction ──────────────────────────────────────────────────

export async function rateRepairService(
  actor: SessionUser,
  repairId: string,
  rating: number,
  comment?: string | null
) {
  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

  if (repair.requesterId !== actor.id && actor.role !== "ADMIN") {
    throw new Error("เฉพาะผู้แจ้งซ่อมจึงจะสามารถประเมินความพึงพอใจได้");
  }

  if (repair.status !== "COMPLETED") {
    throw new Error("สามารถประเมินความพึงพอใจได้เฉพาะรายการที่ซ่อมเสร็จสิ้นแล้วเท่านั้น");
  }

  if (rating < 1 || rating > 5) {
    throw new Error("คะแนนการประเมินต้องอยู่ระหว่าง 1 ถึง 5 ดาว");
  }

  const updated = await updateRepairRating(repairId, rating, comment);

  await logRepairAction({
    repairId: repair.id,
    repairNo: repair.repairNo,
    actorId: actor.id,
    action: REPAIR_ACTIONS.REPAIR_RATED,
    detail: `ประเมินความพึงพอใจ ${rating} ดาว`,
  });

  return updated;
}
