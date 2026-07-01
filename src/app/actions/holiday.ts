"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth-session";
import { revalidatePath } from "next/cache";

// Check permissions: ADMIN, HR Head (หัวหน้างานบุคคล/เจ้าหน้าที่บุคคล), or INSPECTOR (ผู้ตรวจสอบ)
async function checkPermission() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  
  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isHR = user.position === "หัวหน้างานบุคคล" || user.position === "เจ้าหน้าที่บุคคล";
  const isInspector = user.position === "ผู้ตรวจสอบ";

  if (!isAdmin && !isHR && !isInspector) {
    throw new Error("Permission denied");
  }
  return user;
}

export async function getHolidays(yearBE?: number) {
  const where: any = {};
  if (yearBE) {
    const yearCE = yearBE - 543;
    const start = new Date(Date.UTC(yearCE, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(yearCE, 11, 31, 23, 59, 59));
    where.date = {
      gte: start,
      lte: end,
    };
  }
  return prisma.holiday.findMany({
    where,
    orderBy: { date: "asc" },
  });
}

export async function createHoliday(dateStr: string, name: string, isWorkday: boolean = false) {
  await checkPermission();
  const date = new Date(dateStr + "T00:00:00.000Z");
  
  const res = await prisma.holiday.upsert({
    where: { date },
    update: { name, isWorkday, isCustom: true },
    create: { date, name, isWorkday, isCustom: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return res;
}

export async function updateHoliday(id: string, dateStr: string, name: string, isWorkday: boolean = false, isCustom: boolean = true) {
  await checkPermission();
  const date = new Date(dateStr + "T00:00:00.000Z");

  const res = await prisma.holiday.update({
    where: { id },
    data: { date, name, isWorkday, isCustom },
  });

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return res;
}

export async function deleteHoliday(id: string) {
  await checkPermission();
  const res = await prisma.holiday.delete({
    where: { id },
  });

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return res;
}

export async function fetchAndSaveInternetHolidays(yearBE: number) {
  await checkPermission();
  const yearCE = yearBE - 543;

  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${yearCE}/TH`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from Nager.Date API: ${response.statusText}`);
    }

    const externalHolidays = await response.json();
    
    const savedHolidays = [];
    for (const item of externalHolidays) {
      const date = new Date(item.date + "T00:00:00.000Z");
      const holiday = await prisma.holiday.upsert({
        where: { date },
        update: { name: item.localName || item.name },
        create: {
          date,
          name: item.localName || item.name,
          isCustom: false,
          isWorkday: false,
        },
      });
      savedHolidays.push(holiday);
    }

    revalidatePath("/dashboard");
    revalidatePath("/history");
    return { success: true, count: savedHolidays.length };
  } catch (error: any) {
    console.error("Error fetching holidays:", error);
    return { success: false, error: error.message || "Failed to fetch holidays" };
  }
}
