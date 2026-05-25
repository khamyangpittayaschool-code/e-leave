"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user || (session.user.role !== "ADMIN" && (session.user as any).position !== "แอดมิน")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getSystemSettings() {
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
  return safeSettings;
}

export async function updateSystemSettings(data: { schoolName: string; subheader: string; logoUrl?: string; lineChannelAccessToken?: string; lineTargetGroupId?: string; leaveRules?: string }) {
  await requireAdmin();

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {
      schoolName: data.schoolName,
      subheader: data.subheader,
      logoUrl: data.logoUrl !== undefined ? (data.logoUrl === "" ? null : data.logoUrl) : undefined,
      lineChannelAccessToken: data.lineChannelAccessToken !== undefined ? data.lineChannelAccessToken : undefined,
      lineTargetGroupId: data.lineTargetGroupId !== undefined ? data.lineTargetGroupId : undefined,
      leaveRules: data.leaveRules !== undefined ? data.leaveRules : undefined
    },
    create: {
      id: "default",
      schoolName: data.schoolName,
      subheader: data.subheader,
      logoUrl: data.logoUrl === "" ? null : data.logoUrl,
      lineChannelAccessToken: data.lineChannelAccessToken,
      lineTargetGroupId: data.lineTargetGroupId,
      leaveRules: data.leaveRules || "การลากิจต้องยื่นคำขอล่วงหน้าอย่างน้อย 3 วันทำการ\nการลาป่วยติดต่อกันเกิน 3 วัน ต้องแนบใบรับรองแพทย์\nระบบจะส่งแจ้งเตือนให้หัวหน้างานบุคคลของท่านพิจารณาเป็นลำดับแรก",
      footerText: "© 2006 Panchapon Getrat KP-school",
      developerSecret: "admin1234"
    }
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}

export async function updateFooter(data: { footerText: string; developerSecret: string }) {
  await requireAdmin();

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
  await requireAdmin();

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
  { type: "SICK", name: "ลาป่วย", maxDaysPerYear: 60, warningThreshold: 5 },
  { type: "MATERNITY", name: "ลาคลอดบุตร", maxDaysPerYear: 90, warningThreshold: 0 },
  { type: "PATERNITY", name: "ลาช่วยเหลือภริยาคลอดบุตร", maxDaysPerYear: 15, warningThreshold: 0 },
  { type: "PERSONAL", name: "ลากิจส่วนตัว", maxDaysPerYear: 45, warningThreshold: 5 },
  { type: "VACATION", name: "ลาพักผ่อน", maxDaysPerYear: 10, warningThreshold: 3 },
  { type: "ORDINATION", name: "ลาอุปสมบท/ฮัจญ์", maxDaysPerYear: 120, warningThreshold: 0 },
  { type: "MILITARY", name: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล", maxDaysPerYear: 0, warningThreshold: 0 },
  { type: "STUDY", name: "ลาศึกษาต่อ/ฝึกอบรม/ดูงาน", maxDaysPerYear: 0, warningThreshold: 0 },
  { type: "INTERNATIONAL", name: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ", maxDaysPerYear: 0, warningThreshold: 0 },
  { type: "SPOUSE", name: "ลาติดตามคู่สมรส", maxDaysPerYear: 0, warningThreshold: 0 },
  { type: "REHABILITATION", name: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ", maxDaysPerYear: 0, warningThreshold: 0 },
];

export async function getLeaveConfigs() {
  const session = await auth.api.getSession({ headers: await headers() });
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

export async function updateLeaveConfig(id: string, data: { maxDaysPerYear: number; warningThreshold: number }) {
  await requireAdmin();

  await prisma.leaveConfig.update({
    where: { id },
    data: {
      maxDaysPerYear: data.maxDaysPerYear,
      warningThreshold: data.warningThreshold,
    }
  });

  return { success: true };
}
