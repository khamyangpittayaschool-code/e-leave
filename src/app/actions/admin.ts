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

export async function getNotifications() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user) return { items: [], counts: { users: 0, leaves: 0 } };

  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isHead = user.position === "หัวหน้างานบุคคล";
  const isExec = user.position === "ผู้บริหาร";

  const items: { id: string; type: "user" | "leave"; title: string; desc: string; time: string; href: string }[] = [];
  let pendingUsers = 0;
  let pendingLeaves = 0;

  if (isAdmin) {
    const unapproved = await prisma.user.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, email: true, createdAt: true }
    });
    pendingUsers = unapproved.length;
    for (const u of unapproved) {
      items.push({
        id: `user-${u.id}`,
        type: "user",
        title: u.name || "ผู้ใช้ใหม่",
        desc: `${u.email} ขอสมัครใช้งานระบบ`,
        time: u.createdAt.toISOString(),
        href: "/users"
      });
    }
  }

  // Pending leave requests
  const statusFilter: string[] = [];
  if (isAdmin) {
    statusFilter.push("PENDING_HEAD", "PENDING_EXEC");
  } else if (isHead) {
    statusFilter.push("PENDING_HEAD");
  } else if (isExec) {
    statusFilter.push("PENDING_EXEC");
  }

  if (statusFilter.length > 0) {
    const leaves = await prisma.leaveRequest.findMany({
      where: { status: { in: statusFilter } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } }
    });
    pendingLeaves = leaves.length;
    const typeMap: Record<string, string> = { SICK: "ลาป่วย", PERSONAL: "ลากิจ", VACATION: "ลาพักร้อน" };
    for (const l of leaves) {
      items.push({
        id: `leave-${l.id}`,
        type: "leave",
        title: l.user?.name || "-",
        desc: `ขอ${typeMap[l.type] || l.type} ${Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / 86400000) + 1} วัน`,
        time: l.createdAt.toISOString(),
        href: "/approvals"
      });
    }
  }

  // Sort by time descending
  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return { items: items.slice(0, 15), counts: { users: pendingUsers, leaves: pendingLeaves } };
}

// ========= Get All Users =========
export async function getAllUsers() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      position: true,
      subjectGroup: true,
      image: true,
      isApproved: true,
      createdAt: true,
    }
  });

  return users.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));
}

// ========= Update User Profile =========
export async function updateUserProfile(userId: string, data: { name?: string; email?: string; role?: string; position?: string; subjectGroup?: string }) {
  await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(data.role && { role: data.role }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.subjectGroup !== undefined && { subjectGroup: data.subjectGroup }),
    }
  });

  revalidatePath("/users");
  return { success: true };
}

export async function approveUser(userId: string) {
  await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true }
  });

  revalidatePath("/users");
  return { success: true };
}

export async function suspendUser(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    throw new Error("ไม่สามารถระงับบัญชีของตัวเองได้");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: false }
  });

  revalidatePath("/users");
  return { success: true };
}

// ========= Delete User =========
export async function deleteUser(userId: string) {
  const session = await requireAdmin();

  if (userId === session.user.id) {
    throw new Error("ไม่สามารถลบบัญชีของตัวเองได้");
  }

  // Delete related data first
  await prisma.leaveRequest.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/users");
  return { success: true };
}

// ========= Get Monthly Report Data =========
import { getLeaveCycleFilter } from "@/lib/cycle";

export async function getMonthlyReport(month: number, year: number) {
  await requireAdmin();

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const requests = await prisma.leaveRequest.findMany({
    where: {
      createdAt: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      user: { select: { name: true, position: true, subjectGroup: true } }
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map(r => ({
    id: r.id,
    userName: r.user?.name || "-",
    position: r.user?.position || "-",
    subjectGroup: r.user?.subjectGroup || "-",
    type: r.type,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    reason: r.reason,
    status: r.status,
    documentUrl: r.documentUrl,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getCycleReport(cycleFilter: "current" | "cycle1" | "cycle2" | "year" = "current", targetYear?: number) {
  await requireAdmin();

  let targetDate = new Date();
  if (targetYear) {
    const westernYear = targetYear - 543;
    // Set targetDate to June 15th of the western year (which falls in cycle 2 of that fiscal year)
    targetDate = new Date(westernYear, 5, 15);
  }

  const filter = getLeaveCycleFilter(targetDate, cycleFilter);

  const requests = await prisma.leaveRequest.findMany({
    where: filter ? {
      startDate: { gte: filter.start, lte: filter.end },
    } : {},
    include: {
      user: { select: { name: true, position: true, subjectGroup: true } }
    },
    orderBy: { startDate: "desc" },
  });

  return requests.map(r => ({
    id: r.id,
    userName: r.user?.name || "-",
    position: r.user?.position || "-",
    subjectGroup: r.user?.subjectGroup || "-",
    type: r.type,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    reason: r.reason,
    status: r.status,
    documentUrl: r.documentUrl,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ========= Reset User Password by Admin =========
import { hashPassword } from "better-auth/crypto";

export async function resetUserPasswordByAdmin(userId: string, newPassword: string) {
  await requireAdmin();

  if (!newPassword || newPassword.length < 6) {
    throw new Error("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.account.updateMany({
    where: {
      userId: userId,
      password: { not: null }
    },
    data: {
      password: hashedPassword
    }
  });

  return { success: true };
}

// ========= Create User by Admin =========
export async function createUserByAdmin(data: { name: string; email: string; password?: string; position: string; subjectGroup: string }) {
  await requireAdmin();

  if (!data.email) {
    throw new Error("กรุณากรอกอีเมล");
  }
  if (!data.name) {
    throw new Error("กรุณากรอกชื่อ-นามสกุล");
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  });
  if (existingUser) {
    throw new Error("อีเมลนี้ถูกใช้งานแล้วในระบบ");
  }

  const role = data.position === "แอดมิน" ? "ADMIN" : "TEACHER";
  
  // Create user record
  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role,
      position: data.position,
      subjectGroup: data.subjectGroup,
      isApproved: true, // auto approve admin created users
      emailVerified: true
    }
  });

  // Create credentials account
  const rawPassword = data.password || "123456"; // Default password if empty
  const hashedPassword = await hashPassword(rawPassword);

  await prisma.account.create({
    data: {
      userId: newUser.id,
      accountId: data.email,
      providerId: "credential",
      password: hashedPassword
    }
  });

  revalidatePath("/users");
  return { success: true };
}
