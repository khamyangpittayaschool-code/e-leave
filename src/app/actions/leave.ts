"use server";

import { auth } from "@/lib/auth";
import { getSession as getAuthSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sendLineNotify, formatLeaveMessage } from "@/lib/line-notify";
import { getCurrentLeaveCycle, getLeaveCycleFilter } from "@/lib/cycle";

// ========= Helper: Calculate leave days excluding weekends (except maternity) =========
function calculateLeaveDays(startDate: Date, endDate: Date, type: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < start) return 0;

  if (type === "MATERNITY") {
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ========= Helper: get session safely =========
async function getSession() {
  const session = await getAuthSession();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

// ========= Helper: write system log =========
async function writeLog(actionType: string, description: string, userId: string) {
  await prisma.systemLog.create({
    data: { actionType, description, userId },
  });
}

// ========= Helpers: Fiscal Year and Sequence Backfill =========
function getFiscalYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 9 = Oct
  return (month >= 9 ? year + 1 : year) + 543;
}

export async function ensureSequencesPopulated() {
  try {
    const unsequenced = await prisma.leaveRequest.findMany({
      where: {
        OR: [
          { fiscalYear: null },
          { pendingSeq: null },
          { status: "APPROVED", approvedSeq: null }
        ]
      },
      orderBy: { createdAt: "asc" }
    });

    if (unsequenced.length === 0) return;

    for (const req of unsequenced) {
      const fy = req.fiscalYear || getFiscalYear(req.startDate);
      let updateData: any = { fiscalYear: fy };

      if (req.pendingSeq === null) {
        const maxPending = await prisma.leaveRequest.aggregate({
          where: { fiscalYear: fy },
          _max: { pendingSeq: true }
        });
        const nextPending = (maxPending._max.pendingSeq || 0) + 1;
        updateData.pendingSeq = nextPending;
        req.pendingSeq = nextPending;
      }

      if (req.status === "APPROVED" && req.approvedSeq === null) {
        const maxApproved = await prisma.leaveRequest.aggregate({
          where: { fiscalYear: fy, status: "APPROVED" },
          _max: { approvedSeq: true }
        });
        updateData.approvedSeq = (maxApproved._max.approvedSeq || 0) + 1;
      }

      await prisma.leaveRequest.update({
        where: { id: req.id },
        data: updateData
      });
    }
  } catch (error) {
    console.error("Error populating sequences:", error);
  }
}

// ========= Submit Leave Request =========
export async function submitLeaveRequest(data: {
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  documentUrl?: string;
  extraFields?: string;
}) {
  const session = await getSession();
  const user = session.user as any;

  // Server-side validation: endDate must not be before startDate
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) {
    throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
  }

  // Calculate requested days
  const requestedDays = calculateLeaveDays(start, end, data.type);

  // 1. Check if leave config exists and is active
  const config = await prisma.leaveConfig.findUnique({
    where: { type: data.type }
  });
  if (config && !config.isActive) {
    throw new Error("ขออภัย ประเภทการลานี้ถูกปิดใช้งานชั่วคราว");
  }

  // 2. Advance personal leave validation
  if (data.type === "PERSONAL") {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { requirePersonalAdvance: true }
    });
    if (settings?.requirePersonalAdvance) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startCopy = new Date(start);
      startCopy.setHours(0, 0, 0, 0);
      if (startCopy <= today) {
        throw new Error("การลากิจส่วนตัวต้องยื่นคำขอล่วงหน้าอย่างน้อย 1 วันทำการ (ไม่สามารถลาในวันนี้หรือย้อนหลังได้)");
      }
    }
  }

  // 3. Accumulation validation for SICK and PERSONAL
  if (data.type === "SICK" || data.type === "PERSONAL") {
    const cycle = getCurrentLeaveCycle();
    const pastRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
        type: { in: ["SICK", "PERSONAL"] },
        status: "APPROVED",
        startDate: { gte: cycle.start, lte: cycle.end },
      },
    });

    let totalTimes = pastRequests.length;
    let totalDays = 0;
    for (const r of pastRequests) {
      const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
      totalDays += days;
    }

    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { memoThresholdTimes: true, memoThresholdDays: true }
    });
    const thresholdTimes = settings?.memoThresholdTimes ?? 6;
    const thresholdDays = settings?.memoThresholdDays ?? 15;

    if (totalTimes >= thresholdTimes || totalDays >= thresholdDays) {
      if (!data.documentUrl || data.documentUrl.trim() === "") {
        throw new Error(`เนื่องจากสถิติลารวมของท่านสะสมเกินเกณฑ์ (เกิน ${thresholdTimes} ครั้ง หรือ ${thresholdDays} วัน) จำเป็นต้องแนบเอกสารบันทึกข้อความเสนอผู้อำนวยการด้วย`);
      }
    }
  }

  // Validate leave quota ONLY for non-sick and non-personal leave types
  if (data.type !== "SICK" && data.type !== "PERSONAL") {
    const { getLeaveConfigs } = await import("./settings");
    const leaveConfigs = await getLeaveConfigs();
    const config = leaveConfigs.find((c) => c.type === data.type);

    if (config) {
      const cycle = getCurrentLeaveCycle();
      const pastRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: session.user.id,
          type: data.type,
          status: { in: ["APPROVED", "PENDING_HEAD", "PENDING_EXEC"] },
          startDate: { gte: cycle.start, lte: cycle.end },
        },
      });

      let usedDays = 0;
      for (const r of pastRequests) {
        const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
        usedDays += days;
      }

      if (config.maxDaysPerYear > 0 && (usedDays + requestedDays > config.maxDaysPerYear)) {
        throw new Error(`ขออภัย จำนวนวันลาประเภทนี้เกินโควตาสูงสุดที่กำหนด (คุณเหลือสิทธิ์ลาได้อีก ${Math.max(config.maxDaysPerYear - usedDays, 0)} วัน จากทั้งหมด ${config.maxDaysPerYear} วัน)`);
      }
    }
  }

  // Determine initial status based on position
  // Teachers -> PENDING_HEAD (wait for Dept Head)
  // Dept Head -> PENDING_EXEC (skip to Executive)
  let initialStatus = "PENDING_HEAD";
  if (user.position === "หัวหน้างานบุคคล") {
    initialStatus = "PENDING_EXEC";
  }

  const startD = new Date(data.startDate);
  const fy = getFiscalYear(startD);

  const maxPending = await prisma.leaveRequest.aggregate({
    where: { fiscalYear: fy },
    _max: { pendingSeq: true }
  });
  const nextPendingSeq = (maxPending._max.pendingSeq || 0) + 1;

  const newRequest = await prisma.leaveRequest.create({
    data: {
      userId: session.user.id,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
      status: initialStatus,
      fiscalYear: fy,
      pendingSeq: nextPendingSeq,
      ...(data.documentUrl && { documentUrl: data.documentUrl }),
      extraFields: data.extraFields,
    },
  });

  await writeLog(
    "CREATE_LEAVE",
    `${user.name} ยื่นคำขอ${getLeaveTypeName(data.type)} ${data.startDate} ถึง ${data.endDate}`,
    session.user.id
  );

  const notifyMsg = formatLeaveMessage("CREATE", user.name, data.type, data.startDate, data.endDate, data.reason, {
    subjectGroup: initialStatus === "PENDING_HEAD" ? (user.subjectGroup || undefined) : undefined,
    requestedDays,
  });
  await sendLineNotify(notifyMsg);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");

  return { success: true, data: newRequest };
}

// ========= Get Leave History (own or by userId for admin/exec) =========
export async function getMyLeaveHistory(cycleFilter: "current" | "cycle1" | "cycle2" | "year" | "all" = "all", targetUserId?: string) {
  await ensureSequencesPopulated();
  const session = await getSession();
  const user = session.user as any;

  const isPrivileged = user.role === "ADMIN" || ["แอดมิน", "ผู้อำนวยการ", "รองผู้อำนวยการ", "หัวหน้างานบุคคล", "เจ้าหน้าที่บุคคล"].includes(user.position);

  const whereClause: any = {};
  
  if (targetUserId === "all") {
    if (!isPrivileged) {
      throw new Error("Unauthorized");
    }
    // Omit userId filter to fetch all users' requests
  } else {
    let queryUserId = session.user.id;
    if (targetUserId && targetUserId !== "me") {
      if (!isPrivileged) {
        throw new Error("Unauthorized");
      }
      queryUserId = targetUserId;
    }
    whereClause.userId = queryUserId;
  }

  const filter = getLeaveCycleFilter(new Date(), cycleFilter);

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
  const isPrivileged = user.role === "ADMIN" || ["แอดมิน", "ผู้อำนวยการ", "รองผู้อำนวยการ", "หัวหน้างานบุคคล", "เจ้าหน้าที่บุคคล"].includes(user.position);
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

// ========= Helper: Check if user can give final approval =========
async function canGiveFinalApproval(userId: string, userPosition: string | null, userRole: string): Promise<boolean> {
  // Director (ผู้อำนวยการ) can always give final approval
  if (userPosition === "ผู้อำนวยการ") return true;
  // Admin can always give final approval
  if (userRole === "ADMIN" || userPosition === "แอดมิน") return true;
  // Check if user is in the configurable final approver list
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { finalApproverUserIds: true }
  });
  if (settings?.finalApproverUserIds) {
    const allowedIds = settings.finalApproverUserIds.split(",").map(s => s.trim()).filter(Boolean);
    if (allowedIds.includes(userId)) return true;
  }
  return false;
}

// ========= Get Dashboard Stats (Role-based) =========
export async function getDashboardStats(
  cycleFilter: "current" | "cycle1" | "cycle2" | "year" | "all" = "current",
  lang: "th" | "en" = "th",
  targetYear?: number | null,
  viewMode: "school" | "personal" = "school"
) {
  const session = await getSession();
  const user = session.user as any;
  
  // Check if user is a configured final approver
  const isFinalApprover = await canGiveFinalApproval(session.user.id, user.position, user.role);
  
  // Whitelist of positions allowed to view the school overview
  const allowedOverviewPositions = [
    "ผู้อำนวยการ",
    "รองผู้อำนวยการ",
    "หัวหน้างานบุคคล",
    "เจ้าหน้าที่บุคคล",
    "ผู้ตรวจสอบ",
    "แอดมิน"
  ];
  const canViewOverview = user.role === "ADMIN" || allowedOverviewPositions.includes(user.position) || isFinalApprover;

  // We only show school overview if they are allowed AND they chose "school" mode
  const showSchoolOverview = canViewOverview && viewMode === "school";

  // Fetch Leave Configs dynamically
  const { getLeaveConfigs } = await import("./settings");
  const leaveConfigs = await getLeaveConfigs();

  const refDate = targetYear ? new Date(targetYear - 543, 5, 1) : new Date();
  const filter = getLeaveCycleFilter(refDate, cycleFilter, lang);
  const cycle = filter || getCurrentLeaveCycle(refDate, lang); // fallback if all

  let requests;
  if (showSchoolOverview) {
    requests = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
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
    const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
    if (usedDaysMap[r.type] !== undefined) {
      usedDaysMap[r.type] += days;
    } else {
      usedDaysMap[r.type] = days;
    }
  }

  // Get pending count
  const isDirector = user.position === "ผู้อำนวยการ";

  let pendingWhere: any = { status: { in: ["PENDING_HEAD", "PENDING_EXEC"] } };
  if (!canViewOverview) {
    pendingWhere = { userId: session.user.id, status: { in: ["PENDING_HEAD", "PENDING_EXEC"] } };
  } else if (user.position === "หัวหน้างานบุคคล") {
    pendingWhere = { status: "PENDING_HEAD" };
  } else if (isDirector || isFinalApprover) {
    pendingWhere = { status: "PENDING_EXEC" };
  } else {
    // Other overview roles (รองผู้อำนวยการ, เจ้าหน้าที่บุคคล, ผู้ตรวจสอบ)
    pendingWhere = { status: { in: ["PENDING_HEAD", "PENDING_EXEC"] } };
  }

  const pendingCount = await prisma.leaveRequest.count({ where: pendingWhere });

  // Calculate total staff (for Admin/HR/Management KPI)
  const totalStaff = await prisma.user.count({
    where: {
      role: { not: "ADMIN" }
    }
  });

  // Get total requests for approval rate
  const allRequestsCount = await prisma.leaveRequest.count({
    where: showSchoolOverview
      ? {}
      : { userId: session.user.id }
  });
  const approvedRequestsCount = await prisma.leaveRequest.count({
    where: showSchoolOverview
      ? { status: "APPROVED" }
      : { userId: session.user.id, status: "APPROVED" }
  });
  const approvalRate = allRequestsCount === 0 ? 100 : Math.round((approvedRequestsCount / allRequestsCount) * 100);

  // Generate monthly distribution
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = months.map(name => ({ name, value: 0 }));
  for (const r of requests) {
    const mIndex = r.startDate.getMonth();
    const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
    monthlyData[mIndex].value += days;
  }

  // Generate department stats for overview
  const deptStats = [
    { name: "Science", value: 35, fill: "#38BDF8" },
    { name: "Math", value: 25, fill: "#8B5CF6" },
    { name: "Language", value: 20, fill: "#34D399" },
    { name: "PE", value: 10, fill: "#FBBF24" },
    { name: "Arts", value: 10, fill: "#FB7185" },
  ];

  // Get recent requests (all statuses, last 5)
  const recentWhere = showSchoolOverview
    ? {}
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

  // Always calculate personal watchlist stats
  const ownRequests = showSchoolOverview
    ? await prisma.leaveRequest.findMany({
        where: {
          userId: session.user.id,
          status: "APPROVED",
          ...(filter ? { startDate: { gte: filter.start, lte: filter.end } } : {})
        }
      })
    : requests;

  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { memoThresholdTimes: true, memoThresholdDays: true }
  });
  const limitTimes = settings?.memoThresholdTimes ?? 6;
  const limitDays = settings?.memoThresholdDays ?? 15;

  for (const r of ownRequests) {
    if (r.type === "SICK" || r.type === "PERSONAL") {
      const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
      userWatchlistStats.totalDays += days;
      userWatchlistStats.totalTimes += 1;
    }
  }
  userWatchlistStats.isWarning = userWatchlistStats.totalTimes >= limitTimes || userWatchlistStats.totalDays >= limitDays;

  if (showSchoolOverview) {
    const userStatsMap: Record<string, any> = {};
    for (const r of requests) {
      if (!r.user) continue;
      const uid = r.userId;
      if (!userStatsMap[uid]) {
        userStatsMap[uid] = { userId: uid, name: r.user.name, totalDays: 0, totalTimes: 0, position: (r.user as any).position || "-" };
      }
      if (r.type === "SICK" || r.type === "PERSONAL") {
        const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
        userStatsMap[uid].totalDays += days;
        userStatsMap[uid].totalTimes += 1;
      }
    }
    leaveLeaderboard = Object.values(userStatsMap)
      .map((stat: any) => ({ ...stat, isWarning: stat.totalTimes >= limitTimes || stat.totalDays >= limitDays }))
      .filter((stat: any) => stat.totalTimes > 0)
      .sort((a: any, b: any) => b.totalTimes - a.totalTimes || b.totalDays - a.totalDays)
      .slice(0, 50);
  }

  return {
    isOverview: showSchoolOverview,
    canViewOverview,
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
  await ensureSequencesPopulated();
  const session = await getSession();
  const user = session.user as any;

  let whereClause: any = {};

  const isDirector = user.position === "ผู้อำนวยการ";
  const isFinalApprover = await canGiveFinalApproval(session.user.id, user.position, user.role);

  if (user.position === "หัวหน้างานบุคคล") {
    // HR Head sees all PENDING_HEAD requests
    whereClause = {
      status: "PENDING_HEAD",
    };
  } else if (isDirector || isFinalApprover) {
    // Director or configured final approver sees PENDING_EXEC requests
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
        select: { id: true, name: true, email: true, position: true, subjectGroup: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
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
export async function approveLeaveRequest(id: string, pdfBase64?: string, skipDriveUpload: boolean = false) {
  const session = await getSession();
  const user = session.user as any;

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });

  if (!request) throw new Error("Request not found");

  let newStatus = "";
  let updateData: any = {};

  const isFinalApprover = await canGiveFinalApproval(session.user.id, user.position, user.role);

  if (user.position === "หัวหน้างานบุคคล" && request.status === "PENDING_HEAD") {
    // Head approves -> move to Executive
    newStatus = "PENDING_EXEC";
    updateData = { status: newStatus, headApproverId: session.user.id };
  } else if (
    isFinalApprover &&
    (request.status === "PENDING_EXEC" || request.status === "PENDING_HEAD")
  ) {
    // Director / configured final approver gives final approval
    newStatus = "APPROVED";
    
    const fy = request.fiscalYear || getFiscalYear(request.startDate);
    const maxApproved = await prisma.leaveRequest.aggregate({
      where: { fiscalYear: fy, status: "APPROVED" },
      _max: { approvedSeq: true }
    });
    const nextApprovedSeq = (maxApproved._max.approvedSeq || 0) + 1;

    updateData = { 
      status: newStatus, 
      execApproverId: session.user.id,
      approvedSeq: nextApprovedSeq,
      fiscalYear: fy
    };
  } else {
    throw new Error("Cannot approve this request with your role");
  }

  await prisma.leaveRequest.update({ where: { id }, data: updateData });

  if (newStatus === "APPROVED" && !skipDriveUpload) {
    // Auto upload to Google Drive if configured
    const uploadUrl = process.env.GOOGLE_DRIVE_UPLOAD_URL;
    const secret = process.env.GOOGLE_DRIVE_SECRET;
    if (uploadUrl && secret) {
      const fy = updateData.fiscalYear;
      const seq = updateData.approvedSeq;
      const formattedSeq = String(seq).padStart(3, "0");
      const cleanName = (request.user?.name || "user").replace(/\s+/g, "_");
      
      const leaveLabels: Record<string, string> = {
        SICK: "ลาป่วย",
        MATERNITY: "ลาคลอดบุตร",
        PATERNITY: "ลาช่วยเหลือภริยาคลอดบุตร",
        PERSONAL: "ลากิจส่วนตัว",
        VACATION: "ลาพักผ่อน",
        MILITARY: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล",
        STUDY: "ลาศึกษาต่อ_ฝึกอบรม_หรือดูงาน",
        INTERNATIONAL: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
        SPOUSE: "ลาติดตามคู่สมรส",
        REHABILITATION: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ",
        ORDINATION: "ลาอุปสมบท_ประกอบพิธีฮัจญ์"
      };
      const leaveLabel = leaveLabels[request.type] || request.type;
      const filename = `${fy}-${formattedSeq}-${cleanName}-${leaveLabel}`;
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
      const cleanAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
      const printUrl = `${cleanAppUrl}/api/print-legacy/${id}?token=${secret}`;

      const payload: any = {
        secret: secret,
        filename: filename
      };

      if (pdfBase64) {
        payload.action = "upload_base64";
        payload.fileBase64 = pdfBase64;
      } else {
        payload.action = "upload";
        payload.printUrl = printUrl;
      }

      fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log(`Successfully uploaded leave request ${id} to Google Drive: ${data.url}`);
          writeLog("SYSTEM", `อัปโหลดใบลา ${filename} ลง Google Drive สำเร็จ (${data.url})`, "system").catch(() => {});
        } else {
          console.error("Google Drive upload failed:", data.error);
          writeLog("SYSTEM", `อัปโหลดใบลาลง Google Drive ล้มเหลว: ${data.error}`, "system").catch(() => {});
        }
      })
      .catch(err => {
        console.error("Google Drive upload fetch error:", err);
        writeLog("SYSTEM", `อัปโหลดใบลาลง Google Drive เกิดข้อผิดพลาด: ${err.message}`, "system").catch(() => {});
      });
    }
  }

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

export async function rejectLeaveRequest(id: string, rejectReason?: string, pdfBase64?: string, skipDriveUpload: boolean = false) {
  const session = await getSession();
  const user = session.user as any;

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });

  if (!request) throw new Error("Request not found");

  if (!rejectReason || !rejectReason.trim()) {
    throw new Error("จำเป็นต้องระบุเหตุผลในการปฏิเสธการอนุมัติ");
  }

  const isFinalApprover = await canGiveFinalApproval(session.user.id, user.position, user.role);

  let canReject = false;
  if (user.position === "หัวหน้างานบุคคล" && request.status === "PENDING_HEAD") {
    canReject = true;
  } else if (
    isFinalApprover &&
    (request.status === "PENDING_EXEC" || request.status === "PENDING_HEAD")
  ) {
    canReject = true;
  }

  if (!canReject) {
    throw new Error("ไม่มีสิทธิ์ปฏิเสธคำขอลาในสถานะนี้");
  }

  let updateData: any = { status: "REJECTED", rejectReason: rejectReason.trim() };
  if (user.position === "หัวหน้างานบุคคล" && !isFinalApprover) {
    // HR Head rejecting at PENDING_HEAD stage
    updateData.headApproverId = session.user.id;
  } else if (isFinalApprover) {
    // Director / configured final approver rejecting
    updateData.execApproverId = session.user.id;
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: updateData,
  });

  // Auto upload to Google Drive if configured
  const uploadUrl = process.env.GOOGLE_DRIVE_UPLOAD_URL;
  const secret = process.env.GOOGLE_DRIVE_SECRET;
  if (uploadUrl && secret && !skipDriveUpload) {
    const fy = request.fiscalYear || getFiscalYear(request.startDate);
    const seq = request.pendingSeq || 0;
    const formattedSeq = String(seq).padStart(3, "0");
    const cleanName = (request.user?.name || "user").replace(/\s+/g, "_");
    
    const leaveLabels: Record<string, string> = {
      SICK: "ลาป่วย",
      MATERNITY: "ลาคลอดบุตร",
      PATERNITY: "ลาช่วยเหลือภริยาคลอดบุตร",
      PERSONAL: "ลากิจส่วนตัว",
      VACATION: "ลาพักผ่อน",
      MILITARY: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล",
      STUDY: "ลาศึกษาต่อ_ฝึกอบรม_หรือดูงาน",
      INTERNATIONAL: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
      SPOUSE: "ลาติดตามคู่สมรส",
      REHABILITATION: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ",
      ORDINATION: "ลาอุปสมบท_ประกอบพิธีฮัจญ์"
    };
    const leaveLabel = leaveLabels[request.type] || request.type;
    const filename = `${fy}-REJ-${formattedSeq}-${cleanName}-${leaveLabel}`;
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const cleanAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    const printUrl = `${cleanAppUrl}/api/print-legacy/${id}?token=${secret}`;

    const payload: any = {
      secret: secret,
      filename: filename
    };

    if (pdfBase64) {
      payload.action = "upload_base64";
      payload.fileBase64 = pdfBase64;
    } else {
      payload.action = "upload";
      payload.printUrl = printUrl;
    }

    fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log(`Successfully uploaded rejected leave request ${id} to Google Drive: ${data.url}`);
        writeLog("SYSTEM", `อัปโหลดใบลาที่ปฏิเสธ ${filename} ลง Google Drive สำเร็จ (${data.url})`, "system").catch(() => {});
      } else {
        console.error("Google Drive upload failed:", data.error);
        writeLog("SYSTEM", `อัปโหลดใบลาที่ปฏิเสธลง Google Drive ล้มเหลว: ${data.error}`, "system").catch(() => {});
      }
    })
    .catch(err => {
      console.error("Google Drive upload fetch error:", err);
      writeLog("SYSTEM", `อัปโหลดใบลาที่ปฏิเสธลง Google Drive เกิดข้อผิดพลาด: ${err.message}`, "system").catch(() => {});
    });
  }

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
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isHR = user.position === "หัวหน้างานบุคคล";
  if (!isAdmin && !isHR) {
    throw new Error("Unauthorized: Admins or HR Head only");
  }

  const request = await prisma.leaveRequest.findUnique({ where: { id }, include: { user: true } });
  if (!request) throw new Error("Request not found");

  await prisma.leaveRequest.delete({ where: { id } });

  await writeLog(
    "DELETE_LEAVE",
    `${user.name} ลบข้อมูลการลาของ ${request.user?.name}`,
    session.user.id
  );

  if (request.status === "APPROVED") {
    const msg = formatLeaveMessage(
      "DELETE",
      request.user?.name || "ไม่ทราบชื่อ",
      request.type,
      request.startDate.toISOString().split("T")[0],
      request.endDate.toISOString().split("T")[0],
      request.reason || undefined,
      {
        actorName: user.name,
      }
    );
    sendLineNotify(msg).catch(() => {});
  }

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
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  if (!isAdmin) {
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

  let totalTimes = 0;
  let totalDays = 0;

  // Per-type usage breakdown
  const typeUsage: Record<string, number> = {};

  for (const r of requests) {
    const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
    typeUsage[r.type] = (typeUsage[r.type] || 0) + days;

    if (r.type === "SICK" || r.type === "PERSONAL") {
      totalTimes += 1;
      totalDays += days;
    }
  }

  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { memoThresholdTimes: true, memoThresholdDays: true }
  });
  const limitTimes = settings?.memoThresholdTimes ?? 6;
  const limitDays = settings?.memoThresholdDays ?? 15;

  // Fetch leave configs for quota info
  const configs = await prisma.leaveConfig.findMany({
    select: { type: true, maxDaysPerYear: true }
  });
  const typeQuotas: Record<string, number> = {};
  for (const c of configs) {
    if (c.maxDaysPerYear > 0) {
      typeQuotas[c.type] = c.maxDaysPerYear;
    }
  }

  return {
    cycleLabel: cycle.label,
    totalTimes,
    totalDays,
    limitTimes,
    limitDays,
    isWarning: totalTimes >= limitTimes || totalDays >= limitDays,
    typeUsage,
    typeQuotas,
  };
}

// ========= Get Leave Request Details for Print =========
export async function getLeaveRequestForPrint(id: string) {
  await ensureSequencesPopulated();
  const session = await getSession();
  const currentUser = session.user as any;

  // 1. Fetch request with user details
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          subjectGroup: true,
          signatureUrl: true,
          level: true,
          address: true,
          phoneNumber: true,
        }
      }
    }
  });

  if (!request) throw new Error("Request not found");

  // Check permissions: Owner or Admin/HR/Exec/Verifier
  const isOwner = request.userId === session.user.id;
  const isFinalApprover = await canGiveFinalApproval(session.user.id, currentUser.position, currentUser.role);
  const isPrivileged = currentUser.role === "ADMIN" || 
    ["แอดมิน", "ผู้อำนวยการ", "รองผู้อำนวยการ", "หัวหน้างานบุคคล", "เจ้าหน้าที่บุคคล", "ผู้ตรวจสอบ"].includes(currentUser.position) ||
    isFinalApprover;
  if (!isOwner && !isPrivileged) {
    throw new Error("Unauthorized");
  }

  // 2. Fetch inspector and approver signatures
  let headApprover = null;
  let execApprover = null;
  let inspector = null;

  // Load default inspector settings
  const sysSettings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { defaultInspectorId: true }
  });

  if (sysSettings?.defaultInspectorId) {
    inspector = await prisma.user.findUnique({
      where: { id: sysSettings.defaultInspectorId },
      select: { id: true, name: true, signatureUrl: true, position: true }
    });
  }

  // Fallback to inspector first, then HR Head user
  if (!inspector) {
    inspector = await prisma.user.findFirst({
      where: { position: "ผู้ตรวจสอบ", isApproved: true },
      select: { id: true, name: true, signatureUrl: true, position: true }
    });
  }

  if (!inspector) {
    inspector = await prisma.user.findFirst({
      where: { position: "หัวหน้างานบุคคล", isApproved: true },
      select: { id: true, name: true, signatureUrl: true, position: true }
    });
  }

  if (request.headApproverId) {
    headApprover = await prisma.user.findUnique({
      where: { id: request.headApproverId },
      select: { name: true, signatureUrl: true, position: true }
    });
  }

  // Fallback to default HR Head if headApprover is null
  if (!headApprover) {
    headApprover = await prisma.user.findFirst({
      where: { position: "หัวหน้างานบุคคล", isApproved: true },
      select: { name: true, signatureUrl: true, position: true }
    });
  }

  // Hide head approver signature if request is still pending head approval
  if (headApprover) {
    const isPendingHead = request.status === "PENDING_HEAD";
    headApprover = {
      ...headApprover,
      signatureUrl: isPendingHead ? null : headApprover.signatureUrl
    };
  }

  if (request.execApproverId) {
    execApprover = await prisma.user.findUnique({
      where: { id: request.execApproverId },
      select: { name: true, signatureUrl: true, position: true }
    });
  }

  // Hide inspector signature if pending approval by head (PENDING_HEAD)
  if (inspector) {
    const isPendingHead = request.status === "PENDING_HEAD";
    inspector = {
      ...inspector,
      signatureUrl: isPendingHead ? null : inspector.signatureUrl
    };
  }

  // 3. Calculate Fiscal Year range for this request
  const startDate = request.startDate;
  const year = startDate.getFullYear();
  const month = startDate.getMonth(); // 0-indexed, 9 = Oct
  let fyStartYear = year;
  if (month < 9) {
    fyStartYear = year - 1;
  }
  const fyStart = new Date(fyStartYear, 9, 1);
  const fyEnd = new Date(fyStartYear + 1, 8, 30, 23, 59, 59, 999);

  // 4. Fetch approved requests in same fiscal year for stats
  const approvedInYear = await prisma.leaveRequest.findMany({
    where: {
      userId: request.userId,
      status: "APPROVED",
      startDate: { gte: fyStart, lte: fyEnd }
    }
  });

  // Fetch active leave configurations dynamically
  const activeConfigs = await prisma.leaveConfig.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });

  // Calculate statistics for all active leave types
  const stats: Record<string, { name: string, prev: number, current: number, total: number }> = {};
  for (const config of activeConfigs) {
    stats[config.type] = {
      name: config.name,
      prev: 0,
      current: 0,
      total: 0,
    };
  }

  // Ensure current request type is initialized
  if (!stats[request.type]) {
    const reqConfig = await prisma.leaveConfig.findUnique({
      where: { type: request.type }
    });
    stats[request.type] = {
      name: reqConfig?.name || request.type,
      prev: 0,
      current: 0,
      total: 0,
    };
  }

  // Set current request days
  const currentDays = calculateLeaveDays(request.startDate, request.endDate, request.type);
  stats[request.type].current = currentDays;

  // Calculate previously taken days in the fiscal year
  for (const r of approvedInYear) {
    if (r.id === request.id) continue; // skip current
    const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
    
    // If approved request started BEFORE current request
    if (r.startDate < request.startDate) {
      if (stats[r.type]) {
        stats[r.type].prev += days;
      }
    }
  }

  // Sum up totals
  for (const type of Object.keys(stats)) {
    stats[type].total = stats[type].prev + stats[type].current;
  }

  // 5. Find the last approved request of the SAME type
  const lastRequest = await prisma.leaveRequest.findFirst({
    where: {
      userId: request.userId,
      type: request.type,
      status: "APPROVED",
      startDate: { lt: request.startDate }
    },
    orderBy: { startDate: "desc" }
  });

  let lastLeaveInfo = null;
  if (lastRequest) {
    lastLeaveInfo = {
      startDate: lastRequest.startDate.toISOString(),
      endDate: lastRequest.endDate.toISOString(),
      days: calculateLeaveDays(lastRequest.startDate, lastRequest.endDate, lastRequest.type),
      type: lastRequest.type,
    };
  }

  // 6. Return all needed data
  return {
    request: {
      ...request,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      days: currentDays,
    },
    stats,
    lastLeaveInfo,
    headApprover,
    execApprover,
    inspector,
    fiscalYearLabel: `ปีงบประมาณ ${fyStartYear + 1 + 543}`,
  };
}

// ========= Get Batch Leave Requests for Print =========
export async function getBatchLeaveRequestsForPrint(
  year: number,
  start?: number | null,
  end?: number | null,
  filterType?: "sequence" | "year" | "cycle1" | "cycle2" | "month" | null,
  monthVal?: number | null
) {
  await ensureSequencesPopulated();
  const session = await getSession();
  const currentUser = session.user as any;

  // Check permissions: Admin/HR/Exec
  const isPrivileged = currentUser.role === "ADMIN" || ["แอดมิน", "ผู้อำนวยการ", "หัวหน้างานบุคคล"].includes(currentUser.position);
  if (!isPrivileged) {
    throw new Error("Unauthorized");
  }

  const whereClause: any = {
    status: "APPROVED",
  };

  if (filterType === "year" || filterType === "cycle1" || filterType === "cycle2") {
    const calYear = year - 543;
    const fyStart = new Date(calYear - 1, 9, 1); // Oct 1 of previous year
    const fyEnd = new Date(calYear, 8, 30, 23, 59, 59, 999); // Sep 30 of current year

    if (filterType === "year") {
      whereClause.startDate = { gte: fyStart, lte: fyEnd };
    } else if (filterType === "cycle1") {
      const cycle1End = new Date(calYear, 2, 31, 23, 59, 59, 999); // Mar 31 of current year
      whereClause.startDate = { gte: fyStart, lte: cycle1End };
    } else if (filterType === "cycle2") {
      const cycle2Start = new Date(calYear, 3, 1); // Apr 1 of current year
      whereClause.startDate = { gte: cycle2Start, lte: fyEnd };
    }
  } else if (filterType === "month" && monthVal) {
    const calYear = monthVal >= 10 ? (year - 543 - 1) : (year - 543);
    const startDate = new Date(calYear, monthVal - 1, 1);
    const endDate = new Date(calYear, monthVal, 0, 23, 59, 59, 999);
    whereClause.startDate = { gte: startDate, lte: endDate };
  } else {
    // Default sequence mode
    whereClause.fiscalYear = year;
    if (start !== undefined && start !== null) {
      whereClause.approvedSeq = {
        ...whereClause.approvedSeq,
        gte: start,
      };
    }
    if (end !== undefined && end !== null) {
      whereClause.approvedSeq = {
        ...whereClause.approvedSeq,
        lte: end,
      };
    }
  }

  const requests = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          subjectGroup: true,
          signatureUrl: true,
          level: true,
          address: true,
          phoneNumber: true,
        }
      }
    },
    orderBy: {
      approvedSeq: "asc"
    }
  });

  const results = [];
  
  const sysSettings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { defaultInspectorId: true }
  });

  let defaultInspector = null;
  if (sysSettings?.defaultInspectorId) {
    defaultInspector = await prisma.user.findUnique({
      where: { id: sysSettings.defaultInspectorId },
      select: { id: true, name: true, signatureUrl: true, position: true }
    });
  }
  if (!defaultInspector) {
    defaultInspector = await prisma.user.findFirst({
      where: { position: "ผู้ตรวจสอบ", isApproved: true },
      select: { id: true, name: true, signatureUrl: true, position: true }
    });
  }
  if (!defaultInspector) {
    defaultInspector = await prisma.user.findFirst({
      where: { position: "หัวหน้างานบุคคล", isApproved: true },
      select: { id: true, name: true, signatureUrl: true, position: true }
    });
  }

  const activeConfigs = await prisma.leaveConfig.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });

  for (const request of requests) {
    let headApprover = null;
    let execApprover = null;
    let inspector = defaultInspector;

    if (request.headApproverId) {
      headApprover = await prisma.user.findUnique({
        where: { id: request.headApproverId },
        select: { name: true, signatureUrl: true, position: true }
      });
    }

    // Fallback to default HR Head if headApprover is null
    if (!headApprover) {
      headApprover = await prisma.user.findFirst({
        where: { position: "หัวหน้างานบุคคล", isApproved: true },
        select: { name: true, signatureUrl: true, position: true }
      });
    }

    // Hide head approver signature if request is still pending head approval
    if (headApprover) {
      const isPendingHead = request.status === "PENDING_HEAD";
      headApprover = {
        ...headApprover,
        signatureUrl: isPendingHead ? null : headApprover.signatureUrl
      };
    }

    if (request.execApproverId) {
      execApprover = await prisma.user.findUnique({
        where: { id: request.execApproverId },
        select: { name: true, signatureUrl: true, position: true }
      });
    }

    if (inspector) {
      const isPendingHead = request.status === "PENDING_HEAD";
      inspector = {
        ...inspector,
        signatureUrl: isPendingHead ? null : inspector.signatureUrl
      };
    }

    const startDate = request.startDate;
    const yearVal = startDate.getFullYear();
    const month = startDate.getMonth();
    let fyStartYear = yearVal;
    if (month < 9) {
      fyStartYear = yearVal - 1;
    }
    const fyStart = new Date(fyStartYear, 9, 1);
    const fyEnd = new Date(fyStartYear + 1, 8, 30, 23, 59, 59, 999);

    const approvedInYear = await prisma.leaveRequest.findMany({
      where: {
        userId: request.userId,
        status: "APPROVED",
        startDate: { gte: fyStart, lte: fyEnd }
      }
    });

    const stats: Record<string, { name: string, prev: number, current: number, total: number }> = {};
    for (const config of activeConfigs) {
      stats[config.type] = {
        name: config.name,
        prev: 0,
        current: 0,
        total: 0,
      };
    }

    if (!stats[request.type]) {
      const reqConfig = await prisma.leaveConfig.findUnique({
        where: { type: request.type }
      });
      stats[request.type] = {
        name: reqConfig?.name || request.type,
        prev: 0,
        current: 0,
        total: 0,
      };
    }

    const currentDays = calculateLeaveDays(request.startDate, request.endDate, request.type);
    stats[request.type].current = currentDays;

    for (const r of approvedInYear) {
      if (r.id === request.id) continue;
      const days = calculateLeaveDays(r.startDate, r.endDate, r.type);
      if (r.startDate < request.startDate) {
        if (stats[r.type]) {
          stats[r.type].prev += days;
        }
      }
    }

    for (const type of Object.keys(stats)) {
      stats[type].total = stats[type].prev + stats[type].current;
    }

    const lastRequest = await prisma.leaveRequest.findFirst({
      where: {
        userId: request.userId,
        type: request.type,
        status: "APPROVED",
        startDate: { lt: request.startDate }
      },
      orderBy: { startDate: "desc" }
    });

    let lastLeaveInfo = null;
    if (lastRequest) {
      lastLeaveInfo = {
        startDate: lastRequest.startDate.toISOString(),
        endDate: lastRequest.endDate.toISOString(),
        days: calculateLeaveDays(lastRequest.startDate, lastRequest.endDate, lastRequest.type),
        type: lastRequest.type,
      };
    }

    results.push({
      request: {
        ...request,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        days: currentDays,
      },
      stats,
      lastLeaveInfo,
      headApprover,
      execApprover,
      inspector,
      fiscalYearLabel: `ปีงบประมาณ ${fyStartYear + 1 + 543}`,
    });
  }

  return results;
}

export async function uploadLeavePdf(id: string, pdfBase64: string, isRejected: boolean, mimeType?: string) {
  const session = await getSession();
  
  const uploadUrl = process.env.GOOGLE_DRIVE_UPLOAD_URL;
  const secret = process.env.GOOGLE_DRIVE_SECRET;
  if (!uploadUrl || !secret) {
    return { success: false, error: "Google Drive upload not configured" };
  }

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true } } }
  });
  if (!request) return { success: false, error: "Request not found" };

  const fy = request.fiscalYear || getFiscalYear(request.startDate);
  const seq = isRejected ? (request.pendingSeq || 0) : (request.approvedSeq || 0);
  const formattedSeq = String(seq).padStart(3, "0");
  const cleanName = (request.user?.name || "user").replace(/\s+/g, "_");
  
  const leaveLabels: Record<string, string> = {
    SICK: "ลาป่วย",
    MATERNITY: "ลาคลอดบุตร",
    PATERNITY: "ลาช่วยเหลือภริยาคลอดบุตร",
    PERSONAL: "ลากิจส่วนตัว",
    VACATION: "ลาพักผ่อน",
    MILITARY: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล",
    STUDY: "ลาศึกษาต่อ_ฝึกอบรม_หรือดูงาน",
    INTERNATIONAL: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
    SPOUSE: "ลาติดตามคู่สมรส",
    REHABILITATION: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ",
    ORDINATION: "ลาอุปสมบท_ประกอบพิธีฮัจญ์"
  };
  const leaveLabel = leaveLabels[request.type] || request.type;
  
  const filename = isRejected 
    ? `${fy}-REJ-${formattedSeq}-${cleanName}-${leaveLabel}`
    : `${fy}-${formattedSeq}-${cleanName}-${leaveLabel}`;

  const actualMimeType = mimeType || "application/pdf";
  const fileExtension = actualMimeType === "image/jpeg" ? ".jpg" : ".pdf";

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upload_base64",
        secret: secret,
        filename: filename + fileExtension,
        fileBase64: pdfBase64,
        mimeType: actualMimeType
      })
    });
    
    const data = await res.json();
    if (data.success) {
      console.log(`Successfully uploaded leave request PDF ${id} to Google Drive: ${data.url}`);
      await writeLog("SYSTEM", `อัปโหลดใบลา ${filename} ลง Google Drive สำเร็จ (${data.url})`, "system");
      return { success: true, url: data.url };
    } else {
      console.error("Google Drive upload failed:", data.error);
      await writeLog("SYSTEM", `อัปโหลดใบลาลง Google Drive ล้มเหลว: ${data.error}`, "system");
      return { success: false, error: data.error };
    }
  } catch (err: any) {
    console.error("Google Drive upload fetch error:", err);
    await writeLog("SYSTEM", `อัปโหลดใบลาลง Google Drive เกิดข้อผิดพลาด: ${err.message}`, "system");
    return { success: false, error: err.message };
  }
}


