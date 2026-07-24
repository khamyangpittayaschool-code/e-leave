import { prisma } from "@/lib/db";

/**
 * Concurrency-Safe Atomic Running Number Sequence Generator
 * Uses PostgreSQL atomic upsert & increment to prevent race conditions during high-concurrency requests.
 */
export async function generateNextRepairNo(): Promise<string> {
  const currentYear = new Date().getFullYear() + 543; // Thai Buddhist Era Year (e.g. 2569)
  const sequenceKey = `REPAIR_${currentYear}`;

  // Atomic operation: increment currentValue by 1 safely under heavy load
  const sequence = await prisma.systemSequence.upsert({
    where: { key: sequenceKey },
    update: { currentValue: { increment: 1 } },
    create: { key: sequenceKey, currentValue: 1 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(6, "0");
  return `REP-${currentYear}-${paddedNumber}`; // e.g. REP-2569-000152
}
