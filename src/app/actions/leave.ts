"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sendLineNotify, formatLeaveMessage } from "@/lib/line-notify";
import { getCurrentLeaveCycle, getLeaveCycleFilter } from "@/lib/cycle";

// ========= Helper: get session safely =========
async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

// ========= Helper: write system log =========
async function writeLog(actionType: string, description: string, userId: string) {
  await prisma.systemLog.create({
    data: { actionType, description, userId },
  });
}

// ========= Submit Leave Request =========
export async function submitLeaveRequest(data: {
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  documentUrl?: string;
}) {
  const session = await getSession();
  const user = session.user as any;

  // Server-side validation: endDate must not be before startDate
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) {
    throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
  }

  // Determine initial status based on position
  // Teachers -> PENDING_HEAD (wait for Dept Head)
  // Dept Head -> PENDING_EXEC (skip to Executive)
  let initialStatus = "PENDING_HEAD";
  if (user.position === "หัวหน้างานบุคคล") {
    initialStatus = "PENDING_EXEC";
  }

  const newRequest = await prisma.leaveRequest.create({
    data: {
      userId: session.user.id,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
      status: initialStatus,
      ...(data.documentUrl && { documentUrl: data.documentUrl }),
    },
  });

  await writeLog(
    "CREATE_LEAVE",
    `${user.name} ยื่นคำขอ${getLeaveTypeName(data.type)} ${data.startDate} ถึง ${data.endDate}`,
    session.user.id
  );

  const notifyMsg = formatLeaveMessage("CREATE", user.name, data.type, data.startDate, data.endDate, data.reason, {
    subjectGroup: initialStatus === "PENDING_HEAD" ? (user.subjectGroup || undefined) : undefined,
  });
  await sendLineNotify(notifyMsg);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");

  return { success: true, data: newRequest };
}

// ========= Get Leave History (own or by userId for admin/exec) =========
export async function getMyLeaveHistory(cycleFilter: "current" | "cycle1" | "cycle2" | "year" | "all" = "all", targetUserId?: string) {
  const session = await getSession();
  const user = session.user as any;

  // Determine which userId to query
  let queryUserId = session.user.id;
  if (targetUserId && targetUserId !== "me") {
    // Only admins and executives can view other people's history
    const isPrivileged = user.role === "ADMIN" || user.position === "แอดมิน" || user.position === "ผู้บริหาร";
    if (!isPrivileged) {
      throw new Error("Unauthorized");
    }
    queryUserId = targetUserId;
  }

  const filter = getLeaveCycleFilter(new Date(), cycleFilter);

  const whereClause: any = { userId: queryUserId };
  if (filter) {
    whereClause.startDate = { gte: filter.start, lte: filter.end };
  }

  const requests = await prisma.leaveRequest.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  // Serialize dates for client
  return requests.map((r) => ({
    ...r,
    userName: r.user?.name || "-",
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// ========= Get Staff List (for admin/exec dropdown) =========
export async function getStaffList() {
  const session = await getSession();
  const user = session.user as any;
  const isPrivileged = user.role === "ADMIN" || user.position === "แอดมิน" || user.position === "ผู้บริหาร";
  if (!isPrivileged) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { isApproved: true },
    select: { id: true, name: true, position: true, subjectGroup: true },
    orderBy: { name: "asc" },
  });

  return users;
}

// ========= Get Dashboard Stats (Role-based) =========
export async function getDashboardStats(cycleFilter: "current" | "cycle1" | "cycle2" | "year" | "all" = "current", lang: "th" | "en" = "th") {
  const session = await getSession();
  const user = session.user as any;
  const isApprover = user.role === "ADMIN" || ["ผู้บริหาร", "หัวหน้างานบุคคล", "แอดมิน"].includes(user.position);

  // Fetch Leave Configs dynamically
  const { getLeaveConfigs } = await import("./settings");
  const leaveConfigs = await getLeaveConfigs();

  const filter = getLeaveCycleFilter(new Date(), cycleFilter, lang);
  const cycle = filter || getCurrentLeaveCycle(new Date(), lang); // fallback if all

  const isHead = user.position === "หัวหน้างานบุคคล";

  let requests;
  if (isApprover) {
    requests = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        ...(isHead ? { user: { subjectGroup: user.subjectGroup } } : {}),
        ...(filter ? { startDate: { gte: filter.start, lte: filter.end } } : {})
      },
      include: { user: { select: { name: true, position: true } } }
    });
  } else {
    requests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        status: "APPROVED",
        ...(filter ? { startDate: { gte: filter.start, lte: filter.end } } : {})
      },
      include: { user: { select: { name: true, position: true } } }
    });
  }

  // Calculate days used per type
  const usedDaysMap: Record<string, number> = {};
  for (const config of leaveConfigs) {
    usedDaysMap[config.type] = 0;
  }

  for (const r of requests) {
    const days = Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (usedDaysMap[r.type] !== undefined) {
      usedDaysMap[r.type] += days;
    } else {
      usedDaysMap[r.type] = days;
    }
  }

  // Get pending count
  let pendingWhere: any = { status: { in: ["PENDING_HEAD", "PENDING_EXEC"] } };
  if (!isApprover) {
    pendingWhere = { userId: session.user.id, status: { in: ["PENDING_HEAD", "PENDING_EXEC"] } };
  } else if (user.position === "หัวหน้างานบุคคล") {
    pendingWhere = { status: "PENDING_HEAD" };
  } else if (user.position === "ผู้บริหาร") {
    pendingWhere = { status: "PENDING_EXEC" };
  }

  const pendingCount = await prisma.leaveRequest.count({ where: pendingWhere });

  // Calculate total staff (for Admin/Head KPI)
  const totalStaff = await prisma.user.count({
    where: {
      role: { not: "ADMIN" },
      ...(isHead ? {} : {}) // For HR head, they see all staff. If needed, this can be removed.
    }
  });

  // Get total requests for approval rate
  const allRequestsCount = await prisma.leaveRequest.count({
    where: isApprover
      ? (isHead ? { user: { subjectGroup: user.subjectGroup } } : {})
      : { userId: session.user.id }
  });
  const approvedRequestsCount = await prisma.leaveRequest.count({
    where: isApprover
      ? { status: "APPROVED", ...(isHead ? { user: { subjectGroup: user.subjectGroup } } : {}) }
      : { userId: session.user.id, status: "APPROVED" }
  });
  const approvalRate = allRequestsCount === 0 ? 100 : Math.round((approvedRequestsCount / allRequestsCount) * 100);

  // Generate monthly distribution
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = months.map(name => ({ name, value: 0 }));
  for (const r of requests) {
    const mIndex = r.startDate.getMonth();
    const days = Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    monthlyData[mIndex].value += days;
  }

  // Generate department stats for overview (Mock logic for presentation if data is small)
  const deptStats = [
    { name: "Science", value: 35, fill: "#38BDF8" },
    { name: "Math", value: 25, fill: "#8B5CF6" },
    { name: "Language", value: 20, fill: "#34D399" },
    { name: "PE", value: 10, fill: "#FBBF24" },
    { name: "Arts", value: 10, fill: "#FB7185" },
  ];

  // Get recent requests (all statuses, last 5)
  const recentWhere = isApprover
    ? (isHead ? { user: { subjectGroup: user.subjectGroup } } : {})
    : { userId: session.user.id };
  const recentRequests = await prisma.leaveRequest.findMany({
    where: recentWhere,
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: { select: { name: true } } }
  });

  // Generate Leave Leaderboard & Watchlist
  let leaveLeaderboard: any[] = [];
  let userWatchlistStats = { totalDays: 0, totalTimes: 0, isWarning: false };

  if (isApprover) {
    const userStatsMap: Record<string, any> = {};
    for (const r of requests) {
      if (!r.user) continue;
      const uid = r.userId;
      if (!userStatsMap[uid]) {
        userStatsMap[uid] = { userId: uid, name: r.user.name, totalDays: 0, totalTimes: 0, position: (r.user as any).position || "-" };
      }
      if (r.type === "SICK" || r.type === "PERSONAL") {
        const days = Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        userStatsMap[uid].totalDays += days;
        userStatsMap[uid].totalTimes += 1;
      }
    }
    leaveLeaderboard = Object.values(userStatsMap)
      .map((stat: any) => ({ ...stat, isWarning: stat.totalTimes >= 6 || stat.totalDays >= 15 }))
      .filter((stat: any) => stat.totalTimes > 0)
      .sort((a: any, b: any) => b.totalTimes - a.totalTimes || b.totalDays - a.totalDays)
      .slice(0, 10);
  } else {
    for (const r of requests) {
      if (r.type === "SICK" || r.type === "PERSONAL") {
        const days = Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        userWatchlistStats.totalDays += days;
        userWatchlistStats.totalTimes += 1;
      }
    }
    userWatchlistStats.isWarning = userWatchlistStats.totalTimes >= 6 || userWatchlistStats.totalDays >= 15;
  }

  return {
    isOverview: isApprover,
    usedDaysMap,
    leaveConfigs,
    pendingCount,
    totalStaff,
    approvalRate,
    monthlyData,
    deptStats,
    currentCycle: cycle.label,
    recentRequests: recentRequests.map((r) => ({
      ...r,
      userName: r.user?.name,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    leaveLeaderboard,
    userWatchlistStats,
  };
}

// ========= Get Pending Approvals (role-based) =========
export async function getPendingApprovals() {
  const session = await getSession();
  const user = session.user as any;

  let whereClause: any = {};

  if (user.position === "หัวหน้างานบุคคล") {
    // HR Head sees all PENDING_HEAD requests
    whereClause = {
      status: "PENDING_HEAD",
    };
  } else if (user.position === "ผู้บริหาร") {
    // Executive sees PENDING_EXEC requests (already approved by dept head)
    whereClause = { status: "PENDING_EXEC" };
  } else if (user.role === "ADMIN" || user.position === "แอดมิน") {
    // Admin sees ALL pending requests
    whereClause = {
      status: { in: ["PENDING_HEAD", "PENDING_EXEC"] },
    };
  } else {
    throw new Error("Unauthorized");
  }

  const requests = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      user: {
        select: { id: true, name: true, email: true, position: true, subjectGroup: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    ...r,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// ========= Approve Leave Request (hierarchical) =========
export async function approveLeaveRequest(id: string) {
  const session = await getSession();
  const user = session.user as any;

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });

  if (!request) throw new Error("Request not found");

  let newStatus = "";
  let updateData: any = {};

  if (user.position === "หัวหน้างานบุคคล" && request.status === "PENDING_HEAD") {
    // Head approves -> move to Executive
    newStatus = "PENDING_EXEC";
    updateData = { status: newStatus, headApproverId: session.user.id };
  } else if (
    (user.position === "ผู้บริหาร" || user.role === "ADMIN" || user.position === "แอดมิน") &&
    (request.status === "PENDING_EXEC" || request.status === "PENDING_HEAD")
  ) {
    // Executive/Admin gives final approval
    newStatus = "APPROVED";
    updateData = { status: newStatus, execApproverId: session.user.id };
  } else {
    throw new Error("Cannot approve this request with your role");
  }

  await prisma.leaveRequest.update({ where: { id }, data: updateData });

  await writeLog(
    "APPROVE_LEAVE",
    `${user.name} อนุมัติคำขอลาของ ${request.user?.name} (สถานะ: ${newStatus})`,
    session.user.id
  );

  let statusText = "";
  if (newStatus === "PENDING_EXEC") {
    statusText = "✅ หัวหน้างานบุคคลอนุมัติแล้ว (รอผู้อำนวยการอนุมัติ)";
  } else {
    statusText = "✅ ผู้อำนวยการอนุมัติเรียบร้อยแล้ว";
  }
  const notifyMsg = formatLeaveMessage("APPROVE", request.user?.name || "ไม่ทราบชื่อ", request.type, request.startDate.toISOString().split("T")[0], request.endDate.toISOString().split("T")[0], undefined, {
    actorName: `${user.name} (${user.position || user.role})`,
    statusText,
  });
  await sendLineNotify(notifyMsg);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");

  return { success: true, newStatus };
}

// ========= Reject Leave Request =========
export async function rejectLeaveRequest(id: string, rejectReason?: string) {
  const session = await getSession();
  const user = session.user as any;

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });

  if (!request) throw new Error("Request not found");

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  await writeLog(
    "REJECT_LEAVE",
    `${user.name} ปฏิเสธคำขอลาของ ${request.user?.name}${rejectReason ? ` (เหตุผล: ${rejectReason})` : ""}`,
    session.user.id
  );

  const notifyMsg = formatLeaveMessage("REJECT", request.user?.name || "ไม่ทราบชื่อ", request.type, request.startDate.toISOString().split("T")[0], request.endDate.toISOString().split("T")[0], rejectReason, {
    actorName: `${user.name} (${user.position || user.role})`,
    statusText: `❌ ปฏิเสธการลา${rejectReason ? ` (เหตุผล: ${rejectReason})` : ""}`,
  });
  await sendLineNotify(notifyMsg);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");

  return { success: true };
}

// ========= Cancel Leave Request (by owner) =========
export async function cancelLeaveRequest(id: string) {
  const session = await getSession();

  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) throw new Error("Request not found");
  if (request.userId !== session.user.id) throw new Error("Unauthorized");
  if (request.status === "APPROVED" || request.status === "REJECTED") {
    throw new Error("Cannot cancel an already processed request");
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await writeLog(
    "CANCEL_LEAVE",
    `${(session.user as any).name} ยกเลิกคำขอลา`,
    session.user.id
  );

  const notifyMsg = formatLeaveMessage("CANCEL", (session.user as any).name, request.type, request.startDate.toISOString().split("T")[0], request.endDate.toISOString().split("T")[0], undefined, {
    actorName: (session.user as any).name,
    statusText: "🚫 ยกเลิกคำขอลา",
  });
  await sendLineNotify(notifyMsg);

  revalidatePath("/history");
  revalidatePath("/dashboard");

  return { success: true };
}

// ========= Edit Leave Request (by owner, if pending) =========
export async function editLeaveRequest(id: string, data: { type: string; startDate: string; endDate: string; reason: string; documentUrl?: string }) {
  const session = await getSession();

  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) throw new Error("Request not found");
  if (request.userId !== session.user.id) throw new Error("Unauthorized");
  if (request.status === "APPROVED" || request.status === "REJECTED" || request.status === "CANCELLED") {
    throw new Error("Cannot edit an already processed or cancelled request");
  }

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) {
    throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      type: data.type,
      startDate: start,
      endDate: end,
      reason: data.reason,
      ...(data.documentUrl && { documentUrl: data.documentUrl }),
    },
  });

  await writeLog(
    "EDIT_LEAVE",
    `${(session.user as any).name} แก้ไขคำขอลา`,
    session.user.id
  );

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");

  return { success: true };
}

// ========= Delete Leave Request (Admin Only) =========
export async function adminDeleteLeaveRequest(id: string) {
  const session = await getSession();
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.position !== "แอดมิน") {
    throw new Error("Unauthorized: Admins only");
  }

  const request = await prisma.leaveRequest.findUnique({ where: { id }, include: { user: true } });
  if (!request) throw new Error("Request not found");

  await prisma.leaveRequest.delete({ where: { id } });

  await writeLog(
    "DELETE_LEAVE",
    `${user.name} ลบข้อมูลการลาของ ${request.user?.name}`,
    session.user.id
  );

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  revalidatePath("/reports");

  return { success: true };
}

// ========= Clear All Leave Data (Admin Only) =========
export async function adminClearAllLeaveData() {
  const session = await getSession();
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.position !== "แอดมิน") {
    throw new Error("Unauthorized: Admins only");
  }

  // Delete all active leave requests
  await prisma.leaveRequest.deleteMany({});

  // Delete all archived cycles (ตัดรอบ)
  await prisma.leaveArchive.deleteMany({});

  // Delete all system logs
  await prisma.systemLog.deleteMany({});

  await writeLog(
    "CLEAR_ALL_LEAVE",
    `${user.name} ล้างข้อมูลประวัติการลาและการตัดรอบทั้งหมดในระบบ (เริ่มระบบใหม่)`,
    session.user.id
  );

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  revalidatePath("/reports");
  revalidatePath("/settings");

  return { success: true };
}

// ========= Get System Logs =========
export async function getSystemLogs(filter?: { actionType?: string; month?: number; year?: number }) {
  const session = await getSession();
  const user = session.user as any;

  if (user.role !== "ADMIN" && user.position !== "แอดมิน") {
    throw new Error("Unauthorized");
  }

  let whereClause: any = {};

  if (filter?.actionType) {
    whereClause.actionType = filter.actionType;
  }

  if (filter?.month && filter?.year) {
    const startOfMonth = new Date(filter.year, filter.month - 1, 1);
    const endOfMonth = new Date(filter.year, filter.month, 0, 23, 59, 59);
    whereClause.createdAt = { gte: startOfMonth, lte: endOfMonth };
  } else if (filter?.year) {
    const startOfYear = new Date(filter.year, 0, 1);
    const endOfYear = new Date(filter.year, 11, 31, 23, 59, 59);
    whereClause.createdAt = { gte: startOfYear, lte: endOfYear };
  }

  const logs = await prisma.systemLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return logs.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));
}

// ========= Helper: leave type name =========
function getLeaveTypeName(type: string): string {
  const map: Record<string, string> = {
    SICK: "ลาป่วย",
    MATERNITY: "ลาคลอดบุตร",
    PATERNITY: "ลาช่วยเหลือภริยาคลอดบุตร",
    PERSONAL: "ลากิจส่วนตัว",
    VACATION: "ลาพักผ่อน",
    ORDINATION: "ลาอุปสมบท/ฮัจญ์",
    MILITARY: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล",
    STUDY: "ลาศึกษาต่อ/ฝึกอบรม/ดูงาน",
    INTERNATIONAL: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
    SPOUSE: "ลาติดตามคู่สมรส",
    REHABILITATION: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ",
  };
  return map[type] || type;
}

// ========= Prune System Logs =========
export async function pruneSystemLogs(days: number) {
  const session = await getSession();
  const user = session.user as any;

  if (user.role !== "ADMIN" && user.position !== "แอดมิน") {
    throw new Error("Unauthorized");
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  await prisma.systemLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  return { success: true };
}

// ========= Get My Leave Usage for Current Cycle (for request page warnings) =========
export async function getMyLeaveUsageForCurrentCycle() {
  const session = await getSession();
  const cycle = getCurrentLeaveCycle();

  const requests = await prisma.leaveRequest.findMany({
    where: {
      userId: session.user.id,
      status: "APPROVED",
      startDate: { gte: cycle.start, lte: cycle.end },
    },
  });

  let sickTimes = 0;
  let sickDays = 0;
  let personalTimes = 0;
  let personalDays = 0;

  for (const r of requests) {
    const days = Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (r.type === "SICK") {
      sickTimes += 1;
      sickDays += days;
    } else if (r.type === "PERSONAL") {
      personalTimes += 1;
      personalDays += days;
    }
  }

  return {
    cycleLabel: cycle.label,
    sickTimes,
    sickDays,
    personalTimes,
    personalDays,
    sickWarning: sickTimes >= 6 || sickDays >= 15,
    personalWarning: personalTimes >= 6 || personalDays >= 15,
  };
}
