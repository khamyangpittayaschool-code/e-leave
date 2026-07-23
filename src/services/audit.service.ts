/**
 * Audit Service — writes structured SystemLog entries for the Repair module.
 *
 * Rules:
 *  - Every state change must call logRepairAction().
 *  - description follows the structured format: [REPAIR_ID:xxx][ACTOR_ID:xxx][ACTION:xxx] ...
 *  - metadata is a JSON object for future dashboard queries.
 */

import prisma from "@/lib/prisma";

export const REPAIR_ACTIONS = {
  REPAIR_CREATED: "REPAIR_CREATED",
  REPAIR_ASSIGNED: "REPAIR_ASSIGNED",
  REPAIR_STARTED: "REPAIR_STARTED",
  REPAIR_COMPLETED: "REPAIR_COMPLETED",
  REPAIR_CANCELLED: "REPAIR_CANCELLED",
  REPAIR_DELETED: "REPAIR_DELETED",
  REPAIR_ARCHIVED: "REPAIR_ARCHIVED",
  REPAIR_RATED: "REPAIR_RATED",
} as const;

export type RepairAction = (typeof REPAIR_ACTIONS)[keyof typeof REPAIR_ACTIONS];

interface LogRepairActionParams {
  repairId: string;
  repairNo: string;
  actorId: string;
  action: RepairAction;
  detail?: string;
  /** Pass a Prisma transaction client to write inside a transaction */
  tx?: typeof prisma;
}

export async function logRepairAction({
  repairId,
  repairNo,
  actorId,
  action,
  detail = "",
  tx,
}: LogRepairActionParams): Promise<void> {
  const client = tx ?? prisma;
  const description = `[REPAIR_ID:${repairId}][ACTOR_ID:${actorId}][ACTION:${action}] ${repairNo}${detail ? " — " + detail : ""}`;

  await (client as typeof prisma).systemLog.create({
    data: {
      actionType: action,
      description,
      userId: actorId,
      metadata: {
        repairId,
        repairNo,
        actorId,
        action,
        detail: detail || null,
      },
    },
  });
}
