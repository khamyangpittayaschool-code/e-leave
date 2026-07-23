/**
 * Photo Repository — Prisma layer สำหรับ RepairPhoto และ RepairPhotoArchive
 *
 * Rules:
 *  - ทุก count query ที่เกี่ยวกับ limit ต้อง run ใน Transaction
 *  - MAX 2 รูป BEFORE + MAX 2 รูป AFTER — enforce ที่ database level
 *  - storageKey คือ source of truth — ไม่เก็บ URL ใน DB
 */

import prisma from "@/lib/prisma";
import { RepairPhotoType } from "@prisma/client";

export const PHOTO_LIMITS: Record<RepairPhotoType, number> = {
  BEFORE: 2,
  AFTER: 2,
};

export interface CreatePhotoInput {
  repairId: string;
  photoType: RepairPhotoType;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
}

/** อัปโหลดรูปพร้อม enforce limit ใน Transaction เดียวกัน (Database-level guard) */
export async function createPhoto(input: CreatePhotoInput) {
  return prisma.$transaction(async (tx) => {
    // Count ก่อน Insert — Atomic
    const currentCount = await tx.repairPhoto.count({
      where: { repairId: input.repairId, photoType: input.photoType },
    });

    const limit = await (async () => {
      let l = PHOTO_LIMITS[input.photoType];
      try {
        const settings = await tx.systemSettings.findUnique({ where: { id: "default" } });
        if (settings?.rolePermissions) {
          const parsed = JSON.parse(settings.rolePermissions);
          if (input.photoType === "BEFORE" && parsed.repairPhotoLimitBefore !== undefined) {
            l = Number(parsed.repairPhotoLimitBefore);
          } else if (input.photoType === "AFTER" && parsed.repairPhotoLimitAfter !== undefined) {
            l = Number(parsed.repairPhotoLimitAfter);
          }
        }
      } catch (e) {
        console.error("Failed to parse settings rolePermissions in createPhoto", e);
      }
      return l;
    })();

    if (currentCount >= limit) {
      throw new Error(
        `ไม่สามารถอัปโหลดได้ เนื่องจากรูปประเภท ${input.photoType} มีครบ ${limit} รูปแล้ว`
      );
    }

    return tx.repairPhoto.create({
      data: {
        repairId: input.repairId,
        photoType: input.photoType,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedById: input.uploadedById,
      },
    });
  });
}

/** ดูรูปทั้งหมดของคำขอซ่อม (ไม่ include binary data) */
export async function findPhotosByRepair(repairId: string) {
  return prisma.repairPhoto.findMany({
    where: { repairId },
    select: {
      id: true,
      photoType: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** ลบรูปภาพ — คืนค่า storageKey เพื่อให้ Service ลบออกจาก Object Storage ด้วย */
export async function deletePhoto(
  photoId: string,
  requesterId: string,
  isAdmin: boolean
): Promise<string> {
  const photo = await prisma.repairPhoto.findUnique({
    where: { id: photoId },
    include: { repair: { select: { requesterId: true } } },
  });

  if (!photo) throw new Error("ไม่พบรูปภาพ");
  const isRequester = photo.repair?.requesterId === requesterId;
  const isUploader = photo.uploadedById === requesterId;
  if (!isAdmin && !isRequester && !isUploader) {
    throw new Error("ไม่มีสิทธิ์ลบรูปภาพนี้");
  }

  await prisma.repairPhoto.delete({ where: { id: photoId } });
  return photo.storageKey;
}
