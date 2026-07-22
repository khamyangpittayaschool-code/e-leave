/**
 * Photo Service — Business Logic Layer สำหรับรูปภาพการซ่อม (Sprint 2)
 *
 * Rules:
 *  - Compress ก่อน Upload เสมอ (target: ≤ 800px wide, quality 80)
 *  - ตรวจ mimeType whitelist ก่อน accept
 *  - storageKey format: "repair/<repairNo>/<type>-<timestamp>.webp"
 *  - URL generate ที่ runtime ผ่าน storage.getUrl(storageKey)
 *  - ETag / dedup สามารถ extend ได้ใน Sprint 3
 */

import { RepairPhotoType } from "@prisma/client";
import { getStorageProvider } from "@/services/storage";
import { prisma } from "@/lib/db";
import {
  createPhoto,
  deletePhoto,
  findPhotosByRepair,
  PHOTO_LIMITS,
} from "@/repositories/photo.repository";
import { logRepairAction, REPAIR_ACTIONS } from "@/services/audit.service";
import { findRepairById } from "@/repositories/repair.repository";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const TARGET_WIDTH = 800;
const WEBP_QUALITY = 80;

// ─── Compress ─────────────────────────────────────────────────────────────────

async function compressToWebp(
  inputBuffer: Buffer,
  originalMimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default || sharpModule;
    const compressed = await sharp(inputBuffer)
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return { buffer: compressed, mimeType: "image/webp" };
  } catch (err) {
    console.warn(
      "[PhotoService] Sharp compression unavailable or native module failed, using original file buffer:",
      err
    );
    return { buffer: inputBuffer, mimeType: originalMimeType || "image/jpeg" };
  }
}

// ─── storageKey builder ────────────────────────────────────────────────────────

function buildStorageKey(
  repairNo: string,
  photoType: RepairPhotoType,
  index: number
): string {
  // e.g. "REP-2026-000001/BEFORE-0-1721389200000.webp"
  return `${repairNo}/${photoType}-${index}-${Date.now()}.webp`;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

interface UploadPhotoParams {
  repairId: string;
  photoType: RepairPhotoType;
  fileBuffer: Buffer;
  originalMimeType: string;
  uploadedById: string;
  currentPhotoCount: number; // เพื่อสร้าง index ใน storageKey
}

export async function uploadRepairPhoto({
  repairId,
  photoType,
  fileBuffer,
  originalMimeType,
  uploadedById,
  currentPhotoCount,
}: UploadPhotoParams) {
  // 1. Validate
  if (!ALLOWED_MIME_TYPES.has(originalMimeType)) {
    throw new Error(
      `ประเภทไฟล์ ${originalMimeType} ไม่รองรับ กรุณาอัปโหลดเป็น JPEG, PNG, WebP หรือ HEIC`
    );
  }

  // ดึงขนาดสูงสุดแบบไดนามิกจากระบบตั้งค่า
  let maxSizeBytes = MAX_FILE_SIZE_BYTES;
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
    if (settings?.rolePermissions) {
      const parsed = JSON.parse(settings.rolePermissions);
      if (parsed.repairMaxFileSizeMb !== undefined) {
        maxSizeBytes = Number(parsed.repairMaxFileSizeMb) * 1024 * 1024;
      }
    }
  } catch (e) {
    console.error("Failed to load dynamic file size limit:", e);
  }

  if (fileBuffer.byteLength > maxSizeBytes) {
    throw new Error(`ขนาดไฟล์เกิน ${maxSizeBytes / (1024 * 1024)} MB`);
  }

  // 2. Load repair
  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

  // 3. Compress → WebP (or fallback to original buffer)
  const processed = await compressToWebp(fileBuffer, originalMimeType);

  // 4. Build storageKey
  const storageKey = buildStorageKey(repair.repairNo, photoType, currentPhotoCount);

  // 5. Upload to storage provider
  const storage = getStorageProvider();
  const uploadParams = {
    buffer: processed.buffer,
    mimeType: processed.mimeType,
    storageKey,
  };
  await storage.upload(uploadParams);
  const finalStorageKey = uploadParams.storageKey;

  // 6. Persist metadata in DB (count-check inside transaction)
  const photo = await createPhoto({
    repairId,
    photoType,
    storageKey: finalStorageKey,
    mimeType: processed.mimeType,
    fileSize: processed.buffer.byteLength,
    uploadedById,
  });

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId: uploadedById,
    action: REPAIR_ACTIONS.REPAIR_CREATED, // reuse — Sprint 3 will add PHOTO_UPLOADED action
    detail: `อัปโหลดรูป ${photoType} (${finalStorageKey})`,
  });

  return photo;
}

// ─── Get Photos with URLs ─────────────────────────────────────────────────────

export async function getRepairPhotosWithUrls(repairId: string) {
  const photos = await findPhotosByRepair(repairId);
  const storage = getStorageProvider();

  // Generate URLs in parallel
  const withUrls = await Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      url: await storage.getUrl(photo.storageKey),
    }))
  );

  // ดึงขีดจำกัดสูงสุดแบบไดนามิกจากระบบตั้งค่า
  let limits = { BEFORE: 2, AFTER: 2 };
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
    if (settings?.rolePermissions) {
      const parsed = JSON.parse(settings.rolePermissions);
      if (parsed.repairPhotoLimitBefore !== undefined) limits.BEFORE = Number(parsed.repairPhotoLimitBefore);
      if (parsed.repairPhotoLimitAfter !== undefined) limits.AFTER = Number(parsed.repairPhotoLimitAfter);
    }
  } catch (e) {
    console.error("Failed to load dynamic photo limits:", e);
  }

  // Group by type
  return {
    BEFORE: withUrls.filter((p) => p.photoType === "BEFORE"),
    AFTER: withUrls.filter((p) => p.photoType === "AFTER"),
    limits,
  };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteRepairPhoto(
  photoId: string,
  actorId: string,
  isAdmin: boolean,
  repairId: string
) {
  const repair = await findRepairById(repairId);
  if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

  // Delete from DB — get storageKey back
  const storageKey = await deletePhoto(photoId, actorId, isAdmin);

  // Delete from Object Storage
  const storage = getStorageProvider();
  await storage.delete(storageKey);

  await logRepairAction({
    repairId,
    repairNo: repair.repairNo,
    actorId,
    action: REPAIR_ACTIONS.REPAIR_DELETED,
    detail: `ลบรูปภาพ (${storageKey})`,
  });
}
