"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { RepairPhotoType } from "@prisma/client";
import {
  uploadRepairPhoto,
  getRepairPhotosWithUrls,
  deleteRepairPhoto,
} from "@/services/photo.service";
import { findRepairById } from "@/repositories/repair.repository";
import { hasRepairPermission } from "@/lib/permissions";

function getActor(user: any) {
  return {
    id: user.id,
    role: user.role ?? "TEACHER",
    position: user.position ?? null,
  };
}

/** อัปโหลดรูปภาพ — รับ FormData (ต้องใช้ FormData เพราะเป็น binary) */
export async function uploadRepairPhotoAction(formData: FormData) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const actor = getActor(session.user as any);

    const repairId   = formData.get("repairId") as string;
    const photoType  = formData.get("photoType") as RepairPhotoType;
    const file       = formData.get("file") as File;
    const countStr   = formData.get("currentCount") as string;

    if (!repairId || !photoType || !file) throw new Error("ข้อมูลไม่ครบถ้วน");

    // ตรวจสิทธิ์ — ช่างหรือ Admin เท่านั้นที่อัปโหลดได้
    if (!hasRepairPermission(actor, "repair:update") && !hasRepairPermission(actor, "repair:create")) {
      throw new Error("ไม่มีสิทธิ์อัปโหลดรูปภาพ");
    }

    // ตรวจว่า repair ยังมีอยู่
    const repair = await findRepairById(repairId);
    if (!repair) throw new Error("ไม่พบรายการแจ้งซ่อม");

    // ตรวจสอบความปลอดภัยเพิ่มเติม: ผู้แจ้ง (ไม่มีสิทธิ์ update) สามารถอัปโหลดได้เฉพาะรายการของตนเอง
    const isTechnicianOrAdmin = hasRepairPermission(actor, "repair:update");
    if (!isTechnicianOrAdmin && repair.requesterId !== actor.id) {
      throw new Error("ไม่มีสิทธิ์อัปโหลดรูปภาพในรายการของผู้อื่น");
    }

    // ผู้แจ้งอัปโหลดได้เฉพาะ BEFORE, ช่างอัปโหลดได้ทั้ง BEFORE/AFTER
    if (photoType === "AFTER" && !isTechnicianOrAdmin) {
      throw new Error("เฉพาะช่างเท่านั้นที่สามารถอัปโหลดรูปภาพ AFTER ได้");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const photo = await uploadRepairPhoto({
      repairId,
      photoType,
      fileBuffer: buffer,
      originalMimeType: file.type,
      uploadedById: actor.id,
      currentPhotoCount: parseInt(countStr ?? "0", 10),
    });

    return { success: true, photo };
  } catch (err: any) {
    console.error("uploadRepairPhotoAction failed:", err);
    return { success: false, error: err.message || "อัปโหลดรูปภาพไม่สำเร็จ" };
  }
}

/** ดึงรูปภาพพร้อม URL (generate ทุกครั้ง ไม่เคย cache URL) */
export async function getRepairPhotosAction(repairId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  return getRepairPhotosWithUrls(repairId);
}

/** ลบรูปภาพ */
export async function deleteRepairPhotoAction(photoId: string, repairId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const actor = getActor(session.user as any);
  const isAdmin = actor.role === "ADMIN" || actor.position === "แอดมิน";
  const isTechnician = actor.position === "ช่าง";
  const canOverride = isAdmin || isTechnician;

  return deleteRepairPhoto(photoId, actor.id, canOverride, repairId);
}
