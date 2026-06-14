"use server";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ensureSequencesPopulated } from "./leave";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.user || (session.user.role !== "ADMIN" && (session.user as any).position !== "แอดมิน")) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireHROrAdmin() {
  const session = await getSession();
  const user = session?.user as any;
  if (!user) throw new Error("Unauthorized");
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isHR = user.position === "หัวหน้างานบุคคล" || user.position === "เจ้าหน้าที่บุคคล";
  const isInspector = user.position === "ผู้ตรวจสอบ";
  if (!isAdmin && !isHR && !isInspector) throw new Error("Unauthorized");
  return { session, isAdmin, isHR, isInspector };
}

export async function getNotifications() {
  const session = await getSession();
  if (!session?.user) return { items: [], counts: { users: 0, leaves: 0 } };

  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isHead = user.position === "หัวหน้างานบุคคล";
  const isExec = user.position === "ผู้อำนวยการ";

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
  await requireSuperAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
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
export async function updateUserProfile(userId: string, data: { name?: string; email?: string; username?: string; role?: string; position?: string; subjectGroup?: string; level?: string }) {
  await requireSuperAdmin();

  // If username is changing, ensure it is unique
  if (data.username) {
    const existingUsername = await prisma.user.findFirst({
      where: {
        username: data.username,
        id: { not: userId }
      }
    });
    if (existingUsername) {
      throw new Error("ไอดีเข้าใช้งานนี้ถูกใช้งานแล้วในระบบ");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(data.username !== undefined && { username: data.username || null }),
      ...(data.role && { role: data.role }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.subjectGroup !== undefined && { subjectGroup: data.subjectGroup }),
      ...(data.level !== undefined && { level: data.level }),
    }
  });

  revalidatePath("/users");
  return { success: true };
}

export async function approveUser(userId: string) {
  await requireSuperAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true }
  });

  revalidatePath("/users");
  return { success: true };
}

export async function suspendUser(userId: string) {
  const session = await requireSuperAdmin();
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
  const session = await requireSuperAdmin();

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
  await requireHROrAdmin();
  await ensureSequencesPopulated();

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
    fiscalYear: r.fiscalYear,
    pendingSeq: r.pendingSeq,
    approvedSeq: r.approvedSeq,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getCycleReport(cycleFilter: "current" | "cycle1" | "cycle2" | "year" = "current", targetYear?: number) {
  await requireHROrAdmin();
  await ensureSequencesPopulated();

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
    fiscalYear: r.fiscalYear,
    pendingSeq: r.pendingSeq,
    approvedSeq: r.approvedSeq,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ========= Reset User Password by Admin =========
import { hashPassword } from "better-auth/crypto";

export async function resetUserPasswordByAdmin(userId: string, newPassword: string) {
  await requireSuperAdmin();

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
export async function createUserByAdmin(data: { name: string; email: string; username?: string; password?: string; position: string; subjectGroup: string }) {
  await requireSuperAdmin();

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

  // Check if username already exists
  if (data.username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username }
    });
    if (existingUsername) {
      throw new Error("ไอดีเข้าใช้งานนี้ถูกใช้งานแล้วในระบบ");
    }
  }

  const role = data.position === "แอดมิน" ? "ADMIN" : "TEACHER";
  
  // Create user record
  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      username: data.username || null,
      role,
      position: data.position,
      subjectGroup: data.subjectGroup,
      isApproved: true, // auto approve admin created users
      emailVerified: true
    }
  });

  // Create credentials account
  const rawPassword = data.password || "12345678"; // Default password if empty to 12345678
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

export async function importUsersByAdmin(
  usersList: { name: string; email: string; username?: string; position?: string; subjectGroup?: string }[]
) {
  await requireSuperAdmin();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const positionWhitelist = ["ครู", "นักศึกษาฝึกประสบการณ์", "ผู้ตรวจสอบ", "หัวหน้างานบุคคล", "เจ้าหน้าที่บุคคล", "รองผู้อำนวยการ", "ผู้อำนวยการ", "แอดมิน"];
  const seenEmails = new Set<string>();
  const seenUsernames = new Set<string>();

  for (const u of usersList) {
    const name = u.name?.trim();
    const username = u.username?.trim();

    // 1. Validation: check empty name
    if (!name) {
      errors.push(`แถวที่มีชื่อ "${u.name || '-'}" ไม่ครบถ้วน`);
      skipped++;
      continue;
    }

    // Auto-generate token email if no email provided
    let email = u.email?.trim()?.toLowerCase() || "";
    if (!email || !emailRegex.test(email)) {
      const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(-4);
      email = `user_${token}@noemail.local`;
    }

    // 3. Detect duplicate emails within the import list
    if (seenEmails.has(email)) {
      errors.push(`อีเมล "${email}" ซ้ำกันในรายการนำเข้า`);
      skipped++;
      continue;
    }
    seenEmails.add(email);

    // 4. Detect duplicate usernames within the import list
    if (username) {
      if (seenUsernames.has(username)) {
        errors.push(`ไอดีเข้าใช้งาน "${username}" ซ้ำกันในรายการนำเข้า`);
        skipped++;
        continue;
      }
      seenUsernames.add(username);
    }

    // 5. Position whitelist logic (strictly default to "ครู" if not valid or "แอดมิน")
    let position = u.position?.trim();
    if (!position || !positionWhitelist.includes(position)) {
      position = "ครู";
    }

    const subjectGroup = u.subjectGroup?.trim() || "";

    try {
      // Check if username already exists in database (for another user)
      if (username) {
        const userWithUsername = await prisma.user.findUnique({
          where: { username: username }
        });
        if (userWithUsername && userWithUsername.email !== email) {
          errors.push(`ไอดีเข้าใช้งาน "${username}" มีผู้ใช้อื่นในระบบใช้แล้ว`);
          skipped++;
          continue;
        }
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: email }
      });

      if (existingUser) {
        // If user is ADMIN or position is "แอดมิน", skip and add error
        if (existingUser.role === "ADMIN" || existingUser.position === "แอดมิน") {
          errors.push(`ข้ามผู้ใช้ "${email}" เนื่องจากเป็นแอดมิน`);
          skipped++;
          continue;
        }

        // Update user name, position, subjectGroup, and username
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            position,
            subjectGroup,
            username: username || null
          }
        });
        updated++;
      } else {
        // Hash default password "12345678"
        const hashedPassword = await hashPassword("12345678");

        // Create new user record
        const newUser = await prisma.user.create({
          data: {
            name,
            email,
            username: username || null,
            role: "TEACHER",
            position,
            subjectGroup,
            isApproved: true,
            emailVerified: true
          }
        });

        // Create credentials account for this user
        await prisma.account.create({
          data: {
            userId: newUser.id,
            accountId: email,
            providerId: "credential",
            password: hashedPassword
          }
        });
        created++;
      }
    } catch (err: any) {
      errors.push(`เกิดข้อผิดพลาดในการนำเข้าผู้ใช้ "${email}": ${err.message || err}`);
      skipped++;
    }
  }

  revalidatePath("/users");
  return { created, updated, skipped, errors };
}

