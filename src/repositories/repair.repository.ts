/**
 * Repair Repository — the ONLY layer that touches Prisma for RepairRequest data.
 *
 * Rules:
 *  - All queries must filter deletedAt: null (unless intentionally querying deleted records).
 *  - All status updates use Atomic Compare-And-Swap (check id + version in WHERE clause).
 *  - repairNo generation uses RunningNumber table — always inside a transaction.
 *  - Never import this file from UI components or pages. Only Services may use it.
 */

import prisma from "@/lib/prisma";
import {
  RepairCategory,
  RepairStatus,
  RepairUrgency,
  SLAStatus,
} from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateRepairInput {
  title: string;
  description: string;
  location: string;
  urgency: RepairUrgency;
  category: RepairCategory;
  requesterId: string;
  expectedFinishAt?: Date | null;
}

export interface UpdateRepairStatusInput {
  repairId: string;
  currentVersion: number;
  expectedCurrentStatus: RepairStatus;
  nextStatus: RepairStatus;
  assigneeId?: string | null;
  resolutionNote?: string | null;
  cost?: number | null;
  materialsUsed?: string | null;
  cancelReason?: string | null;
  slaStatus?: SLAStatus | null;
  finishedAt?: Date | null;
  assignedAt?: Date | null;
  actualFinishAt?: Date | null;
}

// ─── RunningNumber (Thread-Safe repairNo generator) ───────────────────────────

/**
 * Atomically generates the next repairNo for the given year.
 * Must be called INSIDE a Prisma transaction.
 */
export async function generateRepairNo(
  tx: Omit<
    typeof prisma,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  year: number
): Promise<string> {
  const thaiYear = year > 2500 ? year : year + 543;
  const key = `repair_${thaiYear}`;

  // Upsert: create with current=1 if first request of the year, otherwise increment
  const running = await tx.runningNumber.upsert({
    where: { key },
    update: { current: { increment: 1 } },
    create: { key, year: thaiYear, current: 1 },
  });

  return `REP-${thaiYear}-${String(running.current).padStart(6, "0")}`;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function findRepairById(id: string) {
  return prisma.repairRequest.findFirst({
    where: { id, deletedAt: null },
    include: {
      requester: { select: { id: true, name: true, position: true, signatureUrl: true } },
      assignee: { select: { id: true, name: true, position: true, signatureUrl: true } },
      photos: {
        select: {
          id: true,
          photoType: true,
          mimeType: true,
          fileSize: true,
          storageKey: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function findRepairsByRequester(requesterId: string) {
  return prisma.repairRequest.findMany({
    where: { requesterId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      repairNo: true,
      title: true,
      location: true,
      urgency: true,
      category: true,
      status: true,
      slaStatus: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      assignee: { select: { id: true, name: true } },
    },
  });
}

export async function findAllRepairs() {
  return prisma.repairRequest.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      repairNo: true,
      title: true,
      location: true,
      urgency: true,
      category: true,
      status: true,
      slaStatus: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      requester: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createRepairRequest(input: CreateRepairInput) {
  const year = new Date().getFullYear();

  return prisma.$transaction(async (tx) => {
    const repairNo = await generateRepairNo(tx, year);

    return tx.repairRequest.create({
      data: {
        repairNo,
        title: input.title,
        description: input.description,
        location: input.location,
        urgency: input.urgency,
        category: input.category,
        requesterId: input.requesterId,
        expectedFinishAt: input.expectedFinishAt ?? null,
        status: "PENDING",
        version: 1,
      },
    });
  });
}

/**
 * Atomic Compare-And-Swap status update.
 * Returns the updated record, or throws if version/status mismatch (concurrent edit).
 */
export async function updateRepairStatus(input: UpdateRepairStatusInput) {
  const {
    repairId,
    currentVersion,
    expectedCurrentStatus,
    nextStatus,
    ...rest
  } = input;

  const result = await prisma.repairRequest.updateMany({
    where: {
      id: repairId,
      version: currentVersion,
      status: expectedCurrentStatus,
      deletedAt: null,
    },
    data: {
      status: nextStatus,
      version: { increment: 1 },
      assigneeId: rest.assigneeId,
      resolutionNote: rest.resolutionNote,
      cost: rest.cost ?? undefined,
      materialsUsed: rest.materialsUsed,
      cancelReason: rest.cancelReason,
      slaStatus: rest.slaStatus,
      finishedAt: rest.finishedAt,
      assignedAt: rest.assignedAt,
      actualFinishAt: rest.actualFinishAt,
    },
  });

  if (result.count === 0) {
    throw new Error(
      "สถานะงานนี้มีการเปลี่ยนแปลงโดยผู้ใช้อื่น หรือข้อมูลเวอร์ชันไม่ตรงกัน กรุณารีเฟรชหน้าร้านใหม่"
    );
  }

  return prisma.repairRequest.findUniqueOrThrow({ where: { id: repairId } });
}

/** Soft delete — does NOT remove data, sets deletedAt + audit fields */
export async function softDeleteRepair(
  repairId: string,
  deletedBy: string,
  deleteReason: string
) {
  return prisma.repairRequest.update({
    where: { id: repairId },
    data: {
      deletedAt: new Date(),
      deletedBy,
      deleteReason,
    },
  });
}
