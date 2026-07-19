/**
 * Archive Service — จัดการย้ายงานซ่อมที่ปิดแล้ว (COMPLETED / CANCELLED)
 * ไปยังตาราง Archive เพื่อให้ฐานข้อมูลหลักทำงานได้รวดเร็วอยู่เสมอ
 *
 * Rules:
 *  - ทำงานภายใต้ Transaction เดียวกันทั้งหมด
 *  - ใช้ pg_advisory_xact_lock(45729) เพื่อป้องกัน Race Condition จากการรันซ้ำซ้อน
 *  - ทำงานแบบมีระบบป้องกันการทำงานชนกัน (Concurrent protection)
 */

import prisma from "@/lib/prisma";
import { logRepairAction, REPAIR_ACTIONS } from "./audit.service";

interface ArchiveResult {
  archivedCount: number;
  message: string;
}

/**
 * ย้ายงานซ่อมที่มีสถานะเสร็จสิ้นหรือยกเลิกแล้ว และไม่มีการแก้ไขเลยในช่วงระยะเวลาที่กำหนด (เช่น 12 เดือน)
 * @param actorId User ID ของผู้สั่งการ Archive (แอดมิน)
 * @param olderThanMonths จำนวนเดือนย้อนหลังขั้นต่ำ (default: 12 เดือน)
 */
export async function archiveOldRepairs(
  actorId: string,
  olderThanMonths: number = 12
): Promise<ArchiveResult> {
  const thresholdDate = new Date();
  thresholdDate.setMonth(thresholdDate.getMonth() - olderThanMonths);

  // ค้นหาและทำงานแบบ Transaction
  return prisma.$transaction(
    async (tx) => {
      // 1. ล็อก Transaction ด้วย pg_advisory_xact_lock (ปลดล็อกอัตโนมัติเมื่อสิ้นสุด Transaction)
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(45729);`);

      // 2. หางานซ่อมที่เข้าข่าย
      const candidates = await tx.repairRequest.findMany({
        where: {
          status: { in: ["COMPLETED", "CANCELLED"] },
          updatedAt: { lte: thresholdDate },
          deletedAt: null, // ไม่เอาตัวที่โดน Soft Delete
        },
        include: {
          photos: true,
        },
      });

      if (candidates.length === 0) {
        return {
          archivedCount: 0,
          message: "ไม่มีงานซ่อมที่ตรงตามเงื่อนไขการเก็บสำรอง",
        };
      }

      // 3. ย้ายข้อมูลเข้าตาราง Archive ทีละคำขอ
      for (const repair of candidates) {
        // ย้าย RepairRequest
        await tx.repairRequestArchive.create({
          data: {
            id: repair.id,
            repairNo: repair.repairNo,
            title: repair.title,
            description: repair.description,
            location: repair.location,
            urgency: repair.urgency,
            category: repair.category,
            status: repair.status,
            version: repair.version,
            requesterId: repair.requesterId,
            assigneeId: repair.assigneeId,
            resolutionNote: repair.resolutionNote,
            cost: repair.cost,
            materialsUsed: repair.materialsUsed,
            cancelReason: repair.cancelReason,
            expectedFinishAt: repair.expectedFinishAt,
            actualFinishAt: repair.actualFinishAt,
            slaStatus: repair.slaStatus,
            assignedAt: repair.assignedAt,
            finishedAt: repair.finishedAt,
            createdAt: repair.createdAt,
            updatedAt: repair.updatedAt,
          },
        });

        // ย้าย RepairPhoto
        if (repair.photos.length > 0) {
          await tx.repairPhotoArchive.createMany({
            data: repair.photos.map((p) => ({
              id: p.id,
              repairId: p.repairId,
              photoType: p.photoType,
              mimeType: p.mimeType,
              fileSize: p.fileSize,
              storageKey: p.storageKey,
              uploadedById: p.uploadedById,
              createdAt: p.createdAt,
            })),
          });
        }

        // ลบจากตารางหลัก (ด้วย cascade delete จะลบรูปใน RepairPhoto ด้วยอัตโนมัติ)
        await tx.repairRequest.delete({
          where: { id: repair.id },
        });

        // บันทึกระบบประวัติการทำ Archive
        await logRepairAction({
          repairId: repair.id,
          repairNo: repair.repairNo,
          actorId,
          action: REPAIR_ACTIONS.REPAIR_ARCHIVED,
          detail: `จัดเก็บประวัติสำรอง (Archive) เรียบร้อย`,
          tx: tx as any,
        });
      }

      return {
        archivedCount: candidates.length,
        message: `จัดเก็บประวัติงานซ่อมเรียบร้อย จำนวน ${candidates.length} รายการ`,
      };
    },
    {
      // ขยายเวลา Timeout สำหรับการย้ายข้อมูลขนาดใหญ่
      timeout: 30000,
    }
  );
}
