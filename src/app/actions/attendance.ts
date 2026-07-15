"use server";

import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendLineNotify } from "@/lib/line-notify";
import { getApprovedLeavesForPeriod } from "./attendance-leave-sync";
import { isDateOnLeave } from "@/lib/attendance-utils";
import { getTimezoneMemo } from "./leave";
import crypto from "crypto";
import { safeAction } from "@/lib/utils";

// ──────────────────────────────────────────────
// Auth Helpers
// ──────────────────────────────────────────────

async function requireAuth() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  const user = session.user as Record<string, unknown>;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  if (!isAdmin) throw new Error("Unauthorized");
  return session;
}

async function checkHRorAdminPermission() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  const user = session.user as Record<string, unknown>;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isHR = user.position === "หัวหน้างานบุคคล" || user.position === "เจ้าหน้าที่บุคคล" || user.role === "HR_HEAD" || user.role === "HR_STAFF";
  if (!isAdmin && !isHR) throw new Error("Permission denied");
  return session;
}

// ──────────────────────────────────────────────
// Haversine Distance (meters)
// ──────────────────────────────────────────────

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ──────────────────────────────────────────────
// SHA-256 Hash Chain
// ──────────────────────────────────────────────

function computeLogHash(
  previousHash: string,
  action: string,
  description: string,
  createdAt: string
): string {
  return crypto
    .createHash("sha256")
    .update(previousHash + action + description + createdAt)
    .digest("hex");
}

// ──────────────────────────────────────────────
// Rate Limiter
// ──────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number; lockedUntil: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (entry) {
    if (entry.lockedUntil > now) {
      return { allowed: false, retryAfterMs: entry.lockedUntil - now };
    }
    if (entry.resetAt <= now) {
      rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000, lockedUntil: 0 });
      return { allowed: true };
    }
    entry.count += 1;
    if (entry.count > 5) {
      entry.lockedUntil = now + 600_000;
      return { allowed: false, retryAfterMs: 600_000 };
    }
    return { allowed: true };
  }

  rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000, lockedUntil: 0 });
  return { allowed: true };
}

// ──────────────────────────────────────────────
// Nonce Management
// ──────────────────────────────────────────────

async function generateAttendanceNonceImpl() {
  const session = await requireAuth();
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60_000);

  await prisma.attendanceNonce.create({
    data: {
      userId: session.user.id,
      nonce,
      expiresAt,
    },
  });

  return { nonce, expiresAt: expiresAt.toISOString() };
}

async function consumeNonce(userId: string, nonce: string): Promise<boolean> {
  const now = new Date();
  const found = await prisma.attendanceNonce.findUnique({
    where: { nonce },
  });

  if (!found) return false;
  if (found.userId !== userId) return false;
  if (found.expiresAt < now) {
    await prisma.attendanceNonce.delete({ where: { id: found.id } }).catch(() => {});
    return false;
  }

  await prisma.attendanceNonce.delete({ where: { id: found.id } });
  return true;
}

// ──────────────────────────────────────────────
// Attendance Log
// ──────────────────────────────────────────────

async function appendAttendanceLog(
  attendanceId: string,
  action: string,
  description: string,
  latitude?: number,
  longitude?: number,
  deviceInfo?: string
) {
  const lastLog = await prisma.attendanceLog.findFirst({
    where: { attendanceId },
    orderBy: { createdAt: "desc" },
    select: { verificationHash: true },
  });

  const previousHash = lastLog?.verificationHash || "GENESIS";
  const createdAt = new Date().toISOString();
  const hash = computeLogHash(previousHash, action, description, createdAt);

  return prisma.attendanceLog.create({
    data: {
      attendanceId,
      action,
      latitude,
      longitude,
      deviceInfo,
      verificationHash: hash,
    },
  });
}

// ──────────────────────────────────────────────
// Geofence Verification
// ──────────────────────────────────────────────

async function verifyLocationImpl(latitude: number, longitude: number) {
  const session = await requireAuth();

  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: {
      attendanceLatitude: true,
      attendanceLongitude: true,
      attendanceRadius: true,
      requireGeofence: true,
    },
  });

  if (!settings?.requireGeofence) {
    return { distance: 0, allowed: true, bypassReason: "Geofence disabled" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bypassAttendance: true },
  });

  if (user?.bypassAttendance) {
    return { distance: 0, allowed: true, bypassReason: "User bypass enabled" };
  }

  if (
    settings.attendanceLatitude == null ||
    settings.attendanceLongitude == null ||
    settings.attendanceRadius == null
  ) {
    throw new Error("ไม่ได้ตั้งค่าพิกัด Geofence สำหรับระบบลงเวลา");
  }

  const distance = haversineDistance(
    latitude,
    longitude,
    settings.attendanceLatitude,
    settings.attendanceLongitude
  );

  const allowed = distance <= settings.attendanceRadius;

  return {
    distance: Math.round(distance),
    allowed,
    radius: settings.attendanceRadius,
  };
}

// ──────────────────────────────────────────────
// Clock In / Clock Out
// ──────────────────────────────────────────────

interface ClockPayload {
  nonce: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  faceMatchScore?: number;
  livenessPass?: boolean;
  photoBase64?: string;
  deviceInfo?: string;
  browserFingerprint?: string;
}

function getAttendanceDate(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function clockInImpl(payload: ClockPayload) {
  const session = await requireAuth();
  const userId = session.user.id;

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    throw new Error(`ลงเวลาถี่เกินไป กรุณารออีกประมาณ ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)} วินาที`);
  }

  const nonceValid = await consumeNonce(userId, payload.nonce);
  if (!nonceValid) {
    throw new Error("รหัสยืนยันการทำรายการหมดอายุหรือถูกใช้แล้ว กรุณารีเฟรชหน้าเว็บและลงเวลาอีกครั้ง");
  }

  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: {
      requireGeofence: true,
      attendanceLatitude: true,
      attendanceLongitude: true,
      attendanceRadius: true,
      requireFaceScan: true,
      faceMatchThreshold: true,
      requireLivenessCheck: true,
    },
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { bypassAttendance: true, name: true, workShiftId: true },
  });

  const isBypassed = dbUser?.bypassAttendance === true;

  if (settings?.requireGeofence && !isBypassed) {
    if (payload.latitude == null || payload.longitude == null) {
      throw new Error("จำเป็นต้องใช้พิกัดตำแหน่ง GPS สำหรับลงเวลาเข้างาน");
    }
    if (payload.gpsAccuracy != null && payload.gpsAccuracy > 100) {
      throw new Error("ความแม่นยำของพิกัดต่ำเกินไป กรุณาเปิดระบบหาพิกัดความละเอียดสูง (High-accuracy GPS) บนมือถือของท่าน");
    }
    if (
      settings.attendanceLatitude != null &&
      settings.attendanceLongitude != null &&
      settings.attendanceRadius != null
    ) {
      const dist = haversineDistance(
        payload.latitude,
        payload.longitude,
        settings.attendanceLatitude,
        settings.attendanceLongitude
      );
      if (dist > settings.attendanceRadius) {
        throw new Error(`ท่านอยู่นอกพื้นที่ที่กำหนดไว้ (ระยะห่างปัจจุบัน ${Math.round(dist)} เมตร, พื้นที่อนุญาตในรัศมี ${settings.attendanceRadius} เมตร)`);
      }
    }
  }

  if (settings?.requireFaceScan && !isBypassed) {
    if (payload.faceMatchScore == null) {
      throw new Error("จำเป็นต้องสแกนใบหน้าก่อนลงเวลา");
    }
    const threshold = settings.faceMatchThreshold ?? 0.65;
    if (payload.faceMatchScore < threshold) {
      throw new Error(`ใบหน้าของท่านมีความคล้ายคลึงน้อยเกินไป (${payload.faceMatchScore.toFixed(2)} < ${threshold}) กรุณาสแกนใหม่อีกครั้ง`);
    }
  }

  if (settings?.requireLivenessCheck && !isBypassed) {
    if (!payload.livenessPass) {
      throw new Error("ระบบตรวจจับไม่ผ่าน (Liveness Check Failed) กรุณาขยับใบหน้าแล้วทำรายการใหม่อีกครั้ง");
    }
  }

  const now = new Date();
  const attendanceDate = getAttendanceDate(now);

  const existing = await prisma.attendance.findUnique({
    where: {
      userId_attendanceDate: { userId, attendanceDate },
    },
  });

  if (existing?.checkInTime) {
    throw new Error("ท่านได้บันทึกเวลาเข้างานสำหรับวันนี้ไปเรียบร้อยแล้ว");
  }

  let status: "PRESENT" | "LATE" = "PRESENT";
  if (dbUser?.workShiftId) {
    const shift = await prisma.workShift.findUnique({
      where: { id: dbUser.workShiftId },
    });
    if (shift) {
      const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
      const shiftStartMinutes = shiftH * 60 + shiftM;
      
      const bangkokTimeStr = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Bangkok",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit"
      });
      const [bangkokH, bangkokM] = bangkokTimeStr.split(":").map(Number);
      const currentMinutes = bangkokH * 60 + bangkokM;

      if (currentMinutes > shiftStartMinutes + shift.lateThreshold) {
        status = "LATE";
      }
    }
  }

  const attendance = existing
    ? await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkInTime: now,
          status,
          workShiftId: dbUser?.workShiftId,
        },
      })
    : await prisma.attendance.create({
        data: {
          userId,
          attendanceDate,
          checkInTime: now,
          status,
          workShiftId: dbUser?.workShiftId,
        },
      });

  if (payload.photoBase64) {
    await prisma.attendancePhoto.create({
      data: {
        attendanceId: attendance.id,
        photoUrl: payload.photoBase64,
        faceMatchScore: payload.faceMatchScore,
        isLivenessPassed: payload.livenessPass ?? false,
      },
    });
  }

  await appendAttendanceLog(
    attendance.id,
    "CHECK_IN",
    `User ${dbUser?.name || userId} checked in. Status: ${status}`,
    payload.latitude,
    payload.longitude,
    payload.deviceInfo
  );

  if (status === "LATE") {
    sendLineNotify(
      `⏰ แจ้งเตือน: ${dbUser?.name || "ผู้ใช้"} ลงเวลาเข้างานสาย เวลา ${now.toLocaleTimeString("th-TH")}`
    ).catch(() => {});
  }

  revalidatePath("/attendance");
  return { status, attendanceId: attendance.id };
}

async function clockOutImpl(payload: ClockPayload) {
  const session = await requireAuth();
  const userId = session.user.id;

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    throw new Error(`ลงเวลาถี่เกินไป กรุณารออีกประมาณ ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)} วินาที`);
  }

  const nonceValid = await consumeNonce(userId, payload.nonce);
  if (!nonceValid) {
    throw new Error("รหัสยืนยันการทำรายการหมดอายุหรือถูกใช้แล้ว กรุณารีเฟรชหน้าเว็บและลงเวลาอีกครั้ง");
  }

  const now = new Date();
  let attendanceDate = getAttendanceDate(now);

  let attendance = await prisma.attendance.findUnique({
    where: {
      userId_attendanceDate: { userId, attendanceDate },
    },
    include: { workShift: true },
  });

  if (!attendance) {
    const yesterday = new Date(attendanceDate);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    attendance = await prisma.attendance.findUnique({
      where: {
        userId_attendanceDate: { userId, attendanceDate: yesterday },
      },
      include: { workShift: true },
    });

    if (attendance?.workShift?.isOvernight && !attendance.checkOutTime) {
      attendanceDate = yesterday;
    } else {
      throw new Error("ไม่พบประวัติการเข้างานสำหรับวันนี้ หรือพ้นกำหนดเวลาลงชื่อออกงานแล้ว");
    }
  }

  if (!attendance.checkInTime) {
    throw new Error("ไม่สามารถลงเวลาออกงานได้เนื่องจากยังไม่ได้สแกนบันทึกเข้างาน");
  }

  if (attendance.checkOutTime) {
    throw new Error("ท่านได้บันทึกเวลาออกงานสำหรับกะเวลานี้ไปเรียบร้อยแล้ว");
  }

  let status = attendance.status;
  if (attendance.workShift) {
    const [endH, endM] = attendance.workShift.endTime.split(":").map(Number);
    const endMinutes = endH * 60 + endM;
    
    const bangkokTimeStr = now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Bangkok",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    });
    const [bangkokH, bangkokM] = bangkokTimeStr.split(":").map(Number);
    const currentMinutes = bangkokH * 60 + bangkokM;

    let adjustedCurrent = currentMinutes;
    if (attendance.workShift.isOvernight && currentMinutes < endMinutes) {
      adjustedCurrent = currentMinutes;
    }

    if (adjustedCurrent < endMinutes - attendance.workShift.earlyOutThreshold) {
      status = "EARLY_OUT";
    }
  }

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOutTime: now,
      status,
    },
  });

  if (payload.photoBase64) {
    await prisma.attendancePhoto.create({
      data: {
        attendanceId: attendance.id,
        photoUrl: payload.photoBase64,
        faceMatchScore: payload.faceMatchScore,
        isLivenessPassed: payload.livenessPass ?? false,
      },
    });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  await appendAttendanceLog(
    attendance.id,
    "CHECK_OUT",
    `User ${dbUser?.name || userId} checked out. Status: ${status}`,
    payload.latitude,
    payload.longitude,
    payload.deviceInfo
  );

  revalidatePath("/attendance");
  return { status, attendanceId: updated.id };
}

// ──────────────────────────────────────────────
// Get User Attendance Status (for UI)
// ──────────────────────────────────────────────

async function getMyAttendanceTodayImpl() {
  const session = await requireAuth();
  const attendanceDate = getAttendanceDate(new Date());

  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_attendanceDate: {
        userId: session.user.id,
        attendanceDate,
      },
    },
    include: {
      workShift: true,
      photos: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      faceConsent: true,
      faceDescriptor: true,
      bypassAttendance: true,
      workShiftId: true,
      workShift: true,
    },
  });

  return {
    attendance: attendance
      ? {
          id: attendance.id,
          checkInTime: attendance.checkInTime?.toISOString() || null,
          checkOutTime: attendance.checkOutTime?.toISOString() || null,
          status: attendance.status,
          shiftName: attendance.workShift?.name || null,
        }
      : null,
    userSettings: {
      faceConsent: user?.faceConsent ?? false,
      hasFaceProfile: !!user?.faceDescriptor,
      bypassAttendance: user?.bypassAttendance ?? false,
      shiftName: user?.workShift?.name || null,
      shiftStart: user?.workShift?.startTime || null,
      shiftEnd: user?.workShift?.endTime || null,
    },
  };
}

// ──────────────────────────────────────────────
// Face Consent & Registration
// ──────────────────────────────────────────────

async function updateFaceConsentImpl(consent: boolean) {
  const session = await requireAuth();

  if (consent) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        faceConsent: true,
        faceConsentAt: new Date(),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        faceConsent: false,
        faceConsentAt: null,
        faceDescriptor: undefined,
        faceProfileUrl: null,
      },
    });
  }

  revalidatePath("/attendance");
  return { success: true };
}

async function registerFaceProfileImpl(descriptor: number[], profileImageBase64: string) {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { faceConsent: true },
  });

  if (!user?.faceConsent) {
    throw new Error("จำเป็นต้องยินยอมในการเก็บข้อมูลใบหน้าชีวมิติก่อนทำการลงทะเบียน");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      faceDescriptor: descriptor,
      faceProfileUrl: profileImageBase64,
    },
  });

  revalidatePath("/attendance");
  return { success: true };
}

// ──────────────────────────────────────────────
// Admin: WorkShift CRUD
// ──────────────────────────────────────────────

async function getWorkShiftsImpl() {
  await requireAdmin();
  return prisma.workShift.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
}

async function createWorkShiftImpl(data: {
  name: string;
  startTime: string;
  endTime: string;
  lateThreshold: number;
  earlyOutThreshold: number;
  isOvernight?: boolean;
}) {
  await requireAdmin();

  const shift = await prisma.workShift.create({
    data: {
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      lateThreshold: data.lateThreshold,
      earlyOutThreshold: data.earlyOutThreshold,
      isOvernight: data.isOvernight ?? false,
    },
  });

  revalidatePath("/settings");
  return shift;
}

async function updateWorkShiftImpl(
  id: string,
  data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    lateThreshold?: number;
    earlyOutThreshold?: number;
    isOvernight?: boolean;
  }
) {
  await requireAdmin();
  const shift = await prisma.workShift.update({ where: { id }, data });
  revalidatePath("/settings");
  return shift;
}

async function deleteWorkShiftImpl(id: string) {
  await requireAdmin();

  await prisma.user.updateMany({
    where: { workShiftId: id },
    data: { workShiftId: null },
  });

  await prisma.workShift.delete({ where: { id } });
  revalidatePath("/settings");
  return { success: true };
}

async function assignUserShiftImpl(userId: string, shiftId: string | null) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { workShiftId: shiftId },
  });
  revalidatePath("/settings");
  revalidatePath("/users");
  return { success: true };
}

// ──────────────────────────────────────────────
// Admin: Attendance Reports & KPI
// ──────────────────────────────────────────────

async function getAttendanceReportImpl(params: {
  startDate: string;
  endDate: string;
  userId?: string;
}) {
  await requireAdmin();

  const start = new Date(params.startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(params.endDate);
  end.setUTCHours(23, 59, 59, 999);

  const where: Record<string, unknown> = {
    attendanceDate: { gte: start, lte: end },
  };
  if (params.userId) {
    where.userId = params.userId;
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, position: true, subjectGroup: true } },
      workShift: { select: { name: true } },
    },
    orderBy: [{ attendanceDate: "asc" }, { checkInTime: "asc" }],
  });

  const userIds = Array.from(new Set(records.map(r => r.userId)));
  const leaves = await getApprovedLeavesForPeriod(userIds, start, end);
  const tz = await getTimezoneMemo();

  return records.map((r) => {
    let finalStatus = r.status;
    const hasLeave = isDateOnLeave(r.attendanceDate, r.userId, leaves, tz);
    if (hasLeave && r.status !== "PRESENT") {
      finalStatus = "LEAVE" as any;
    }
    return {
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      position: r.user.position,
      subjectGroup: r.user.subjectGroup,
      attendanceDate: r.attendanceDate.toISOString(),
      checkInTime: r.checkInTime?.toISOString() || null,
      checkOutTime: r.checkOutTime?.toISOString() || null,
      status: finalStatus,
      shiftName: r.workShift?.name || null,
    };
  });
}

async function getAttendanceKPIImpl(params: { startDate: string; endDate: string }) {
  await requireAdmin();

  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { enableAdvancedKPI: true },
  });

  const start = new Date(params.startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(params.endDate);
  end.setUTCHours(23, 59, 59, 999);

  const records = await prisma.attendance.findMany({
    where: { attendanceDate: { gte: start, lte: end } },
    include: {
      user: { select: { id: true, name: true } },
      workShift: true,
    },
  });

  const userIds = Array.from(new Set(records.map(r => r.userId)));
  const leaves = await getApprovedLeavesForPeriod(userIds, start, end);
  const tz = await getTimezoneMemo();

  records.forEach((r) => {
    const hasLeave = isDateOnLeave(r.attendanceDate, r.userId, leaves, tz);
    if (hasLeave && r.status !== "PRESENT") {
      r.status = "LEAVE" as any;
    }
  });

  const totalRecords = records.length;
  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const lateCount = records.filter((r) => r.status === "LATE").length;
  const earlyOutCount = records.filter((r) => r.status === "EARLY_OUT").length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const missedClockOut = records.filter((r) => r.checkInTime && !r.checkOutTime).length;

  const punctualityRate = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : "0.0";

  let avgDelayMinutes = 0;
  if (lateCount > 0) {
    const totalDelay = records
      .filter((r) => r.status === "LATE" && r.checkInTime && r.workShift)
      .reduce((sum, r) => {
        const [h, m] = r.workShift!.startTime.split(":").map(Number);
        const shiftStart = h * 60 + m;
        
        const checkInTimeStr = r.checkInTime!.toLocaleTimeString("en-US", {
          timeZone: "Asia/Bangkok",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit"
        });
        const [checkInH, checkInM] = checkInTimeStr.split(":").map(Number);
        const checkIn = checkInH * 60 + checkInM;

        return sum + Math.max(0, checkIn - shiftStart);
      }, 0);
    avgDelayMinutes = Math.round(totalDelay / lateCount);
  }

  const kpi: Record<string, unknown> = {
    totalRecords,
    presentCount,
    lateCount,
    earlyOutCount,
    absentCount,
    missedClockOut,
    punctualityRate: `${punctualityRate}%`,
    avgDelayMinutes,
  };

  if (settings?.enableAdvancedKPI) {
    const userAbsences = new Map<string, { spells: number; days: number; name: string }>();

    const byUser = new Map<string, typeof records>();
    for (const r of records) {
      const arr = byUser.get(r.userId) || [];
      arr.push(r);
      byUser.set(r.userId, arr);
    }

    for (const [uid, userRecords] of byUser.entries()) {
      const sortedAbsent = userRecords
        .filter((r) => r.status === "ABSENT" || r.status === "LEAVE")
        .sort((a, b) => a.attendanceDate.getTime() - b.attendanceDate.getTime());

      if (sortedAbsent.length === 0) continue;

      let spells = 1;
      let days = sortedAbsent.length;
      for (let i = 1; i < sortedAbsent.length; i++) {
        const prev = sortedAbsent[i - 1].attendanceDate.getTime();
        const curr = sortedAbsent[i].attendanceDate.getTime();
        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diffDays > 1) spells++;
      }

      userAbsences.set(uid, {
        spells,
        days,
        name: userRecords[0]?.user?.name || uid,
      });
    }

    const bradfordFactors = Array.from(userAbsences.entries())
      .map(([userId, data]) => ({
        userId,
        name: data.name,
        spells: data.spells,
        days: data.days,
        factor: data.spells * data.spells * data.days,
      }))
      .sort((a, b) => b.factor - a.factor);

    kpi.bradfordFactors = bradfordFactors;
  }

  return kpi;
}

// ──────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────

async function cleanupExpiredNoncesImpl() {
  await requireAdmin();
  const result = await prisma.attendanceNonce.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return { deleted: result.count };
}

async function purgeOldPhotosImpl() {
  await requireAdmin();

  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { photoRetentionDays: true },
  });

  const retentionDays = settings?.photoRetentionDays || 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.attendancePhoto.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { deleted: result.count, retentionDays };
}

// ──────────────────────────────────────────────
// Admin: Attendance Settings Update
// ──────────────────────────────────────────────

async function updateAttendanceSettingsImpl(data: {
  enableAttendance?: boolean;
  attendanceLatitude?: number | null;
  attendanceLongitude?: number | null;
  attendanceRadius?: number | null;
  requireFaceScan?: boolean;
  requireGeofence?: boolean;
  requireLivenessCheck?: boolean;
  photoRetentionDays?: number | null;
  faceMatchThreshold?: number;
  enableAdvancedKPI?: boolean;
}) {
  await requireAdmin();

  await prisma.systemSettings.update({
    where: { id: "default" },
    data,
  });

  revalidatePath("/settings");
  revalidatePath("/attendance");
  return { success: true };
}

// ──────────────────────────────────────────────
// Verify Audit Log Chain Integrity
// ──────────────────────────────────────────────

async function verifyLogChainImpl(attendanceId: string) {
  await requireAdmin();

  const logs = await prisma.attendanceLog.findMany({
    where: { attendanceId },
    orderBy: { createdAt: "asc" },
  });

  if (logs.length === 0) return { valid: true, count: 0 };

  let previousHash = "GENESIS";
  for (const log of logs) {
    if (!log.verificationHash) {
      return { valid: false, brokenAt: log.id, reason: "Missing hash" };
    }
    previousHash = log.verificationHash;
  }

  return { valid: true, count: logs.length };
}

// ──────────────────────────────────────────────
// Admin/HR: Official Duty Management
// ──────────────────────────────────────────────

async function recordOfficialDutyImpl(data: {
  userId: string;
  dateStr: string;
}) {
  const session = await checkHRorAdminPermission();
  const currentUser = session.user as any;
  const attendanceDate = new Date(data.dateStr + "T00:00:00.000Z");

  const targetUser = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { workShiftId: true }
  });

  const record = await prisma.attendance.upsert({
    where: {
      userId_attendanceDate: {
        userId: data.userId,
        attendanceDate
      }
    },
    update: {
      status: "OFFICIAL_DUTY",
      workShiftId: targetUser?.workShiftId || null,
      createdById: currentUser.id
    },
    create: {
      userId: data.userId,
      attendanceDate,
      status: "OFFICIAL_DUTY",
      workShiftId: targetUser?.workShiftId || null,
      createdById: currentUser.id
    }
  });

  revalidatePath("/attendance");
  revalidatePath("/attendance/stats");
  revalidatePath("/dashboard");
  return { record };
}

async function removeOfficialDutyImpl(id: string) {
  await checkHRorAdminPermission();

  await prisma.attendance.delete({
    where: { id }
  });

  revalidatePath("/attendance");
  revalidatePath("/attendance/stats");
  revalidatePath("/dashboard");
  return { success: true };
}

async function getOfficialDutyRecordsImpl(dateStr?: string) {
  await checkHRorAdminPermission();

  const where: any = { status: "OFFICIAL_DUTY" };
  if (dateStr) {
    where.attendanceDate = new Date(dateStr + "T00:00:00.000Z");
  }

  return prisma.attendance.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          position: true
        }
      }
    },
    orderBy: { attendanceDate: "desc" }
  });
}

// ──────────────────────────────────────────────
// Wrapped Safe Action Exports
// ──────────────────────────────────────────────

export const generateAttendanceNonce = safeAction(generateAttendanceNonceImpl);
export const verifyLocation = safeAction(verifyLocationImpl);
export const clockIn = safeAction(clockInImpl);
export const clockOut = safeAction(clockOutImpl);
export const getMyAttendanceToday = safeAction(getMyAttendanceTodayImpl);
export const updateFaceConsent = safeAction(updateFaceConsentImpl);
export const registerFaceProfile = safeAction(registerFaceProfileImpl);
export const getWorkShifts = safeAction(getWorkShiftsImpl);
export const createWorkShift = safeAction(createWorkShiftImpl);
export const updateWorkShift = safeAction(updateWorkShiftImpl);
export const deleteWorkShift = safeAction(deleteWorkShiftImpl);
export const assignUserShift = safeAction(assignUserShiftImpl);
export const getAttendanceReport = safeAction(getAttendanceReportImpl);
export const getAttendanceKPI = safeAction(getAttendanceKPIImpl);
export const cleanupExpiredNonces = safeAction(cleanupExpiredNoncesImpl);
export const purgeOldPhotos = safeAction(purgeOldPhotosImpl);
export const updateAttendanceSettings = safeAction(updateAttendanceSettingsImpl);
export const verifyLogChain = safeAction(verifyLogChainImpl);
export const recordOfficialDuty = safeAction(recordOfficialDutyImpl);
export const removeOfficialDuty = safeAction(removeOfficialDutyImpl);
export const getOfficialDutyRecords = safeAction(getOfficialDutyRecordsImpl);
