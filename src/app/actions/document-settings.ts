"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-session";

async function checkAuth() {
  // Allow bypassing auth in CLI / test scripts
  if (process.env.BYPASS_AUTH === "true") {
    return { id: "test-user-id", role: "ADMIN" };
  }

  const session = await getSession().catch(() => null);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isHRHead = user.position === "หัวหน้างานบุคคล" || user.role === "HR_HEAD" || user.position === "HR_HEAD";
  const isTeacher = user.role === "TEACHER" || user.position === "ครู" || user.position === "TEACHER";
  
  if (!isAdmin && !isHRHead && !isTeacher) {
    throw new Error("Unauthorized");
  }
  return user;
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (e) {
    // Ignore error when running in CLI test environment
  }
}

// MemoSection Actions
export async function getMemoSections() {
  await checkAuth();
  return prisma.memoSection.findMany({
    orderBy: [
      { sortOrder: "asc" },
      { code: "asc" }
    ]
  });
}

export async function upsertMemoSection(
  id: string | null,
  name: string,
  code: string,
  isActive: boolean = true,
  color: string = "#6366f1",
  icon: string = "Folder",
  sortOrder: number = 0,
  prefix?: string,
  useThaiNumerals?: boolean,
  paddingDigits?: number,
  yearFormat?: string
) {
  await checkAuth();
  const codeUpper = code.trim().toUpperCase();
  if (id) {
    const updated = await prisma.memoSection.update({
      where: { id },
      data: { name, code: codeUpper, isActive, color, icon, sortOrder }
    });
    
    // Create or update DocumentConfig for this section
    await prisma.documentConfig.upsert({
      where: { memoSectionId: updated.id },
      update: {
        prefix: prefix !== undefined ? prefix : `สราลีฟ ${codeUpper}`,
        useThaiNumerals: useThaiNumerals !== undefined ? useThaiNumerals : true,
        paddingDigits: paddingDigits !== undefined ? paddingDigits : 1,
        yearFormat: yearFormat !== undefined ? yearFormat : "TH_BE"
      },
      create: {
        docType: "MEMO",
        memoSectionId: updated.id,
        prefix: prefix !== undefined ? prefix : `สราลีฟ ${codeUpper}`,
        useThaiNumerals: useThaiNumerals !== undefined ? useThaiNumerals : true,
        paddingDigits: paddingDigits !== undefined ? paddingDigits : 1,
        yearFormat: yearFormat !== undefined ? yearFormat : "TH_BE"
      }
    });
    
    safeRevalidatePath("/document/settings");
    return updated;
  } else {
    const created = await prisma.memoSection.create({
      data: { name, code: codeUpper, isActive, color, icon, sortOrder }
    });
    
    await prisma.documentConfig.create({
      data: {
        docType: "MEMO",
        memoSectionId: created.id,
        prefix: prefix !== undefined ? prefix : `สราลีฟ ${codeUpper}`,
        useThaiNumerals: useThaiNumerals !== undefined ? useThaiNumerals : true,
        paddingDigits: paddingDigits !== undefined ? paddingDigits : 1,
        yearFormat: yearFormat !== undefined ? yearFormat : "TH_BE"
      }
    });
    
    safeRevalidatePath("/document/settings");
    return created;
  }
}

export async function deleteMemoSection(id: string) {
  await checkAuth();
  await prisma.memoSection.delete({ where: { id } });
  safeRevalidatePath("/document/settings");
  return { success: true };
}

// SigneePreset Actions
export async function getSigneePresets() {
  await checkAuth();
  return prisma.signeePreset.findMany({
    orderBy: [{ isCommon: "desc" }, { name: "asc" }]
  });
}

export async function upsertSigneePreset(id: string | null, name: string, position: string, isCommon: boolean = true) {
  await checkAuth();
  if (id) {
    const updated = await prisma.signeePreset.update({
      where: { id },
      data: { name, position, isCommon }
    });
    safeRevalidatePath("/document/settings");
    return updated;
  } else {
    const created = await prisma.signeePreset.create({
      data: { name, position, isCommon }
    });
    safeRevalidatePath("/document/settings");
    return created;
  }
}

export async function deleteSigneePreset(id: string) {
  await checkAuth();
  await prisma.signeePreset.delete({ where: { id } });
  safeRevalidatePath("/document/settings");
  return { success: true };
}

// DocumentConfig Actions
export async function getDocumentConfigs() {
  await checkAuth();
  return prisma.documentConfig.findMany({
    include: { memoSection: true }
  });
}

export async function saveDocumentConfig(
  id: string,
  prefix: string,
  useThaiNumerals: boolean,
  paddingDigits: number,
  yearFormat: string
) {
  await checkAuth();
  const updated = await prisma.documentConfig.update({
    where: { id },
    data: { prefix, useThaiNumerals, paddingDigits, yearFormat }
  });
  safeRevalidatePath("/document/settings");
  return updated;
}
