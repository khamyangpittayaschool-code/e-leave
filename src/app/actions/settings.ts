"use server";

import { auth } from "@/lib/auth";

import { getSession } from "@/lib/auth-session";

import { prisma } from "@/lib/db";

import { headers, cookies } from "next/headers";

import { revalidatePath } from "next/cache";

async function getActualUser() {

  const session = await auth.api.getSession({

    headers: await headers()

  });

  if (!session?.user) throw new Error("Unauthorized");

  

  const dbUser = await prisma.user.findUnique({

    where: { id: session.user.id },

    select: { role: true, position: true }

  });

  

  const isActualAdmin = dbUser?.role === "ADMIN" || dbUser?.position === "แอดมิน";

  if (!isActualAdmin) {

    throw new Error("Unauthorized");

  }

  return session.user;

}

async function requireSuperAdmin() {

  const session = await getSession();

  if (!session?.user || (session.user.role !== "ADMIN" && (session.user as any).position !== "แอดมิน")) {

    throw new Error("Unauthorized");

  }

  return session;

}

export async function requireAdminOrHR() {

  const session = await getSession();

  const user = session?.user as any;

  if (!user) throw new Error("Unauthorized");

  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";

  const isHR = user.position === "หัวหน้างานบุคคล" || user.position === "เจ้าหน้าที่บุคคล";

  const isInspector = user.position === "ผู้ตรวจสอบ";

  const isDirector = user.position === "ผู้อำนวยการ" || user.position === "รองผู้อำนวยการ";

  if (!isAdmin && !isHR && !isInspector && !isDirector) throw new Error("Unauthorized");

  return { session, isAdmin, isHR, isInspector, isDirector };

}

async function requireHROrAdmin() {

  const { session, isAdmin, isHR } = await requireAdminOrHR();

  if (!isAdmin && !isHR) throw new Error("Unauthorized");

  return { session, isAdmin, isHR };

}

export async function getSystemSettings() {

  try {

    let settings = await prisma.systemSettings.findUnique({

      where: { id: "default" }

    });

    if (!settings) {

      settings = await prisma.systemSettings.create({

        data: {

          id: "default",

          schoolName: "ชื่อโรงเรียน",

          subheader: "ระบบจัดการการลา",

          footerText: "© 2006 Panchapon Getrat KP-school",

          developerSecret: "admin1234"

        }

      });

    }

    // Don't send developerSecret to the client

    const { developerSecret, ...safeSettings } = settings;

    return {

      ...safeSettings,

      iappApiKey: (safeSettings as any).iappApiKey || "",
      enableAttendance: (safeSettings as any).enableAttendance ?? false,
      enableDocument: (safeSettings as any).enableDocument ?? false,
      enableRepair: (safeSettings as any).enableRepair ?? false,

      // Ensure new fields have defaults even if DB column doesn't exist yet

      pdfFont: (safeSettings as any).pdfFont || "Prompt",

      googleDriveFormat: (safeSettings as any).googleDriveFormat || "PDF",

      lastLeaveMode: (safeSettings as any).lastLeaveMode || "SAME",

      quotaExceededAction: (safeSettings as any).quotaExceededAction || "ALLOW_WITH_MEMO",

      rolePermissions: (safeSettings as any).rolePermissions || "{\"calendar\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\",\"TEACHER\"],\"reports\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"approvals\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"logs\":[\"ADMIN\"],\"backups\":[\"ADMIN\"],\"users\":[\"ADMIN\"],\"settings\":[\"ADMIN\"]}",

    };

  } catch (err: any) {

    // Fallback: if query fails due to missing columns, try raw query

    console.error("getSystemSettings error, trying fallback:", err?.message);

    try {

      const rows: any[] = await prisma.$queryRaw`SELECT * FROM "SystemSettings" WHERE id = 'default' LIMIT 1`;

      if (rows && rows.length > 0) {

        const row = rows[0];

        const { developerSecret, ...safeRow } = row;

        return {

          ...safeRow,

          iappApiKey: row.iappApiKey || "",
          enableAttendance: row.enableAttendance ?? false,
          enableDocument: row.enableDocument ?? false,
          enableRepair: row.enableRepair ?? false,

          pdfFont: row.pdfFont || "Prompt",

          googleDriveFormat: row.googleDriveFormat || "PDF",

          lastLeaveMode: row.lastLeaveMode || "SAME",

          quotaExceededAction: row.quotaExceededAction || "ALLOW_WITH_MEMO",

          rolePermissions: row.rolePermissions || "{\"calendar\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\",\"TEACHER\"],\"reports\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"approvals\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"logs\":[\"ADMIN\"],\"backups\":[\"ADMIN\"],\"users\":[\"ADMIN\"],\"settings\":[\"ADMIN\"]}",

        };

      }

    } catch (rawErr) {

      console.error("Raw query fallback also failed:", rawErr);

    }

    // Ultimate fallback - return minimal defaults so the page can still render

    return {

      id: "default",

      schoolName: "ชื่อโรงเรียน",

      affiliation: "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาอุดรธานี",

      subheader: "ระบบจัดการการลา",

      logoUrl: null,

      footerText: "© 2006 Panchapon Getrat KP-school",

      lineChannelAccessToken: null,

      lineTargetGroupId: null,

      enableLineNotify: true,

      leaveRules: "",

      requirePersonalAdvance: true,

      memoThresholdTimes: 6,

      memoThresholdDays: 15,

      defaultInspectorId: null,

      actingDirectorTitle: "รักษาการในตำแหน่งผู้อำนวยการโรงเรียน",

      finalApproverUserIds: "",

      showActingDirectorTitle: true,

      pdfFont: "Prompt",

      googleDriveFormat: "PDF",

      lastLeaveMode: "SAME",

      quotaExceededAction: "ALLOW_WITH_MEMO",

      rolePermissions: "{\"calendar\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\",\"TEACHER\"],\"reports\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"approvals\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"logs\":[\"ADMIN\"],\"backups\":[\"ADMIN\"],\"users\":[\"ADMIN\"],\"settings\":[\"ADMIN\"]}",

      iappApiKey: "",
      enableAttendance: false,
      enableDocument: false,
      enableRepair: false,

      updatedAt: new Date(),

    };

  }

}

export async function getEligibleInspectors() {

  const session = await getSession();

  if (!session?.user) throw new Error("Unauthorized");

  const users = await prisma.user.findMany({

    where: { isApproved: true },

    select: {

      id: true,

      name: true,

      position: true,

      username: true,

      email: true

    },

    orderBy: { name: "asc" }

  });

  return users;

}

export async function updateDefaultInspector(defaultInspectorId: string | null) {

  await requireHROrAdmin();

  await prisma.systemSettings.upsert({

    where: { id: "default" },

    update: {

      defaultInspectorId: defaultInspectorId || null

    },

    create: {

      id: "default",

      schoolName: "ชื่อโรงเรียน",

      subheader: "ระบบจัดการการลา",

      footerText: "© 2006 Panchapon Getrat KP-school",

      developerSecret: "admin1234",

      defaultInspectorId: defaultInspectorId || null

    }

  });

  revalidatePath("/settings");

  revalidatePath("/");

  return { success: true };

}

export async function updateSystemSettings(data: {

  schoolName: string;

  subheader: string;

  affiliation?: string;

  logoUrl?: string;

  lineChannelAccessToken?: string;

  lineTargetGroupId?: string;

  enableLineNotify?: boolean;

  leaveRules?: string;

  requirePersonalAdvance?: boolean;

  memoThresholdTimes?: number;

  memoThresholdDays?: number;

  defaultInspectorId?: string | null;

  actingDirectorTitle?: string;

  finalApproverUserIds?: string;

  showActingDirectorTitle?: boolean;

  pdfFont?: string;

  googleDriveFormat?: string;

  googleDriveUploadUrl?: string;

  googleDriveSecret?: string;

  googleDriveFolderId?: string;

  lastLeaveMode?: string;

  quotaExceededAction?: string;

  rolePermissions?: string;

  timezone?: string;

  iappApiKey?: string;
  enableAttendance?: boolean;
  enableDocument?: boolean;
  enableRepair?: boolean;
  repairLineChannelAccessToken?: string;
  repairLineTargetGroupId?: string;
  enableRepairLineNotify?: boolean;

}) {

  await requireHROrAdmin();

  await prisma.systemSettings.upsert({

    where: { id: "default" },

    update: {

      schoolName: data.schoolName,

      subheader: data.subheader,

      affiliation: data.affiliation !== undefined ? data.affiliation : undefined,

      logoUrl: data.logoUrl !== undefined ? (data.logoUrl === "" ? null : data.logoUrl) : undefined,

      lineChannelAccessToken: data.lineChannelAccessToken !== undefined ? data.lineChannelAccessToken : undefined,

      lineTargetGroupId: data.lineTargetGroupId !== undefined ? data.lineTargetGroupId : undefined,

      enableLineNotify: data.enableLineNotify !== undefined ? data.enableLineNotify : undefined,

      leaveRules: data.leaveRules !== undefined ? data.leaveRules : undefined,

      requirePersonalAdvance: data.requirePersonalAdvance !== undefined ? data.requirePersonalAdvance : undefined,

      memoThresholdTimes: data.memoThresholdTimes !== undefined ? data.memoThresholdTimes : undefined,

      memoThresholdDays: data.memoThresholdDays !== undefined ? data.memoThresholdDays : undefined,

      defaultInspectorId: data.defaultInspectorId !== undefined ? data.defaultInspectorId : undefined,

      actingDirectorTitle: data.actingDirectorTitle !== undefined ? data.actingDirectorTitle : undefined,

      finalApproverUserIds: data.finalApproverUserIds !== undefined ? data.finalApproverUserIds : undefined,

      showActingDirectorTitle: data.showActingDirectorTitle !== undefined ? data.showActingDirectorTitle : undefined,

      pdfFont: data.pdfFont !== undefined ? data.pdfFont : undefined,

      googleDriveFormat: data.googleDriveFormat !== undefined ? data.googleDriveFormat : undefined,

      googleDriveUploadUrl: data.googleDriveUploadUrl !== undefined ? data.googleDriveUploadUrl : undefined,

      googleDriveSecret: data.googleDriveSecret !== undefined ? data.googleDriveSecret : undefined,

      googleDriveFolderId: data.googleDriveFolderId !== undefined ? data.googleDriveFolderId : undefined,

      lastLeaveMode: data.lastLeaveMode !== undefined ? data.lastLeaveMode : undefined,

      quotaExceededAction: data.quotaExceededAction !== undefined ? data.quotaExceededAction : undefined,

      rolePermissions: data.rolePermissions !== undefined ? data.rolePermissions : undefined,

      timezone: data.timezone !== undefined ? data.timezone : undefined,

      iappApiKey: data.iappApiKey !== undefined ? data.iappApiKey : undefined,
      enableAttendance: data.enableAttendance !== undefined ? data.enableAttendance : undefined,
      enableDocument: data.enableDocument !== undefined ? data.enableDocument : undefined,
      enableRepair: data.enableRepair !== undefined ? data.enableRepair : undefined,
      repairLineChannelAccessToken: data.repairLineChannelAccessToken !== undefined ? data.repairLineChannelAccessToken : undefined,
      repairLineTargetGroupId: data.repairLineTargetGroupId !== undefined ? data.repairLineTargetGroupId : undefined,
      enableRepairLineNotify: data.enableRepairLineNotify !== undefined ? data.enableRepairLineNotify : undefined,

    },

    create: {

      id: "default",

      schoolName: data.schoolName,

      subheader: data.subheader,

      affiliation: data.affiliation || "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาอุดรธานี",

      logoUrl: data.logoUrl === "" ? null : data.logoUrl,

      lineChannelAccessToken: data.lineChannelAccessToken,

      lineTargetGroupId: data.lineTargetGroupId,

      enableLineNotify: data.enableLineNotify !== undefined ? data.enableLineNotify : true,

      leaveRules: data.leaveRules || "การลากิจต้องยื่นคำขอล่วงหน้าอย่างน้อย 3 วันทำการ\nการลาป่วยติดต่อกันเกิน 3 วัน ต้องแนบใบรับรองแพทย์\nระบบจะส่งแจ้งเตือนให้หัวหน้างานบุคคลของท่านพิจารณาเป็นลำดับแรก",

      requirePersonalAdvance: data.requirePersonalAdvance !== undefined ? data.requirePersonalAdvance : true,

      memoThresholdTimes: data.memoThresholdTimes !== undefined ? data.memoThresholdTimes : 6,

      memoThresholdDays: data.memoThresholdDays !== undefined ? data.memoThresholdDays : 15,

      defaultInspectorId: data.defaultInspectorId !== undefined ? data.defaultInspectorId : null,

      actingDirectorTitle: data.actingDirectorTitle || "รักษาการในตำแหน่งผู้อำนวยการโรงเรียน",

      finalApproverUserIds: data.finalApproverUserIds || "",

      showActingDirectorTitle: data.showActingDirectorTitle !== undefined ? data.showActingDirectorTitle : true,

      pdfFont: data.pdfFont || "Prompt",

      googleDriveFormat: data.googleDriveFormat || "PDF",

      googleDriveUploadUrl: data.googleDriveUploadUrl || null,

      googleDriveSecret: data.googleDriveSecret || null,

      googleDriveFolderId: data.googleDriveFolderId || null,

      lastLeaveMode: data.lastLeaveMode || "SAME",

      quotaExceededAction: data.quotaExceededAction || "ALLOW_WITH_MEMO",

      rolePermissions: data.rolePermissions || "{\"calendar\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\",\"TEACHER\"],\"reports\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"approvals\":[\"ADMIN\",\"DIRECTOR\",\"HR\",\"INSPECTOR\"],\"logs\":[\"ADMIN\"],\"backups\":[\"ADMIN\"],\"users\":[\"ADMIN\"],\"settings\":[\"ADMIN\"]}",

      timezone: data.timezone || "Asia/Bangkok",

      footerText: "© 2006 Panchapon Getrat KP-school",

      developerSecret: "admin1234",

      iappApiKey: data.iappApiKey || "",
      enableAttendance: data.enableAttendance !== undefined ? data.enableAttendance : false,
      enableDocument: data.enableDocument !== undefined ? data.enableDocument : false,
      enableRepair: data.enableRepair !== undefined ? data.enableRepair : false

    }

  });

  revalidatePath("/settings");

  revalidatePath("/");

  return { success: true };

}

export async function updateLeaveRules(leaveRules: string) {

  await requireHROrAdmin();

  await prisma.systemSettings.upsert({

    where: { id: "default" },

    update: {

      leaveRules: leaveRules

    },

    create: {

      id: "default",

      schoolName: "ชื่อโรงเรียน",

      subheader: "ระบบจัดการการลา",

      footerText: "© 2006 Panchapon Getrat KP-school",

      developerSecret: "admin1234",

      leaveRules: leaveRules

    }

  });

  revalidatePath("/settings");

  revalidatePath("/");

  return { success: true };

}

export async function updateFooter(data: { footerText: string; developerSecret: string }) {

  await requireSuperAdmin();

  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });

  if (settings?.developerSecret !== data.developerSecret) {

    throw new Error("Invalid Developer Secret");

  }

  await prisma.systemSettings.update({

    where: { id: "default" },

    data: { footerText: data.footerText }

  });

  revalidatePath("/settings");

  revalidatePath("/");

  return { success: true };

}

export async function generateBackup() {

  await requireSuperAdmin();

  const users = await prisma.user.findMany();

  const leaveRequests = await prisma.leaveRequest.findMany();

  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });

  const backupData = {

    timestamp: new Date().toISOString(),

    users,

    leaveRequests,

    settings

  };

  return JSON.stringify(backupData, null, 2);

}

// ========= Leave Configuration Actions =========

const DEFAULT_LEAVE_CONFIGS = [

  { type: "SICK", name: "ลาป่วย", maxDaysPerYear: 60, warningThreshold: 5, isActive: true },

  { type: "MATERNITY", name: "ลาคลอดบุตร", maxDaysPerYear: 90, warningThreshold: 0, isActive: true },

  { type: "PATERNITY", name: "ลาช่วยเหลือภริยาคลอดบุตร", maxDaysPerYear: 15, warningThreshold: 0, isActive: true },

  { type: "PERSONAL", name: "ลากิจส่วนตัว", maxDaysPerYear: 45, warningThreshold: 5, isActive: true },

  { type: "VACATION", name: "ลาพักผ่อน", maxDaysPerYear: 10, warningThreshold: 3, isActive: true },

  { type: "ORDINATION", name: "ลาอุปสมบท/ฮัจญ์", maxDaysPerYear: 120, warningThreshold: 0, isActive: true },

  { type: "MILITARY", name: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล", maxDaysPerYear: 0, warningThreshold: 0, isActive: true },

  { type: "STUDY", name: "ลาศึกษาต่อ/ฝึกอบรม/ดูงาน", maxDaysPerYear: 0, warningThreshold: 0, isActive: true },

  { type: "INTERNATIONAL", name: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ", maxDaysPerYear: 0, warningThreshold: 0, isActive: true },

  { type: "SPOUSE", name: "ลาติดตามคู่สมรส", maxDaysPerYear: 0, warningThreshold: 0, isActive: true },

  { type: "REHABILITATION", name: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ", maxDaysPerYear: 0, warningThreshold: 0, isActive: true },

];

export async function getLeaveConfigs() {

  const session = await getSession();

  if (!session?.user) throw new Error("Unauthorized");

  let configs = await prisma.leaveConfig.findMany({ orderBy: { maxDaysPerYear: "desc" } });

  // Check if any default configs are missing

  const existingTypes = new Set(configs.map(c => c.type));

  const missingConfigs = DEFAULT_LEAVE_CONFIGS.filter(c => !existingTypes.has(c.type));

  if (missingConfigs.length > 0) {

    await prisma.leaveConfig.createMany({ data: missingConfigs });

    configs = await prisma.leaveConfig.findMany({ orderBy: { maxDaysPerYear: "desc" } });

  }

  return configs;

}

export async function updateLeaveConfig(id: string, data: { maxDaysPerYear: number; warningThreshold: number; isActive?: boolean }) {

  await requireHROrAdmin();

  await prisma.leaveConfig.update({

    where: { id },

    data: {

      maxDaysPerYear: data.maxDaysPerYear,

      warningThreshold: data.warningThreshold,

      isActive: data.isActive !== undefined ? data.isActive : undefined,

    }

  });

  return { success: true };

}

export async function setImpersonationCookie(position: string | null, role: string | null) {

  // Verify that the requester is actually an admin in the database

  await getActualUser();

  const cookieStore = await cookies();

  

  if (position) {

    cookieStore.set("imp_position", encodeURIComponent(position), { path: "/" });

  } else {

    cookieStore.set("imp_position", "CLEAR", { path: "/" });

  }

  

  if (role) {

    cookieStore.set("imp_role", role, { path: "/" });

  } else {

    cookieStore.set("imp_role", "CLEAR", { path: "/" });

  }

  revalidatePath("/");

  return { success: true };

}

export async function clearImpersonation() {

  // Verify that the requester is actually an admin in the database

  await getActualUser();

  const cookieStore = await cookies();

  cookieStore.delete("imp_position");

  cookieStore.delete("imp_role");

  revalidatePath("/");

  return { success: true };

}

export async function getSimpleUsersList() {

  await requireHROrAdmin();

  return prisma.user.findMany({

    where: { isApproved: true },

    select: { id: true, username: true, name: true, position: true, email: true },

    orderBy: { username: "asc" }

  });

}

