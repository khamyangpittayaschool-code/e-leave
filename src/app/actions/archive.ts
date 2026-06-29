"use server";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { getCurrentLeaveCycle } from "@/lib/cycle";
import { getDashboardStats } from "./leave"; // Reuse stats calculation for the snapshot

async function requireAdmin() {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }
  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  if (!isAdmin) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requirePrivilegedLeaveBackup() {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }
  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isPrivileged = isAdmin || ["หัวหน้างานบุคคล", "เจ้าหน้าที่บุคคล", "ผู้ตรวจสอบ"].includes(user.position);
  if (!isPrivileged) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Archive the current leave cycle.
 * Takes a snapshot of all user's quotas and used days, saves to LeaveArchive,
 * and clears old LeaveRequests in that cycle to start fresh.
 */
export async function archiveCurrentCycle() {
  const session = await requireAdmin();
  const cycle = getCurrentLeaveCycle();

  // Get current stats using existing logic
  const stats = await getDashboardStats();

  // Fetch all users and calculate their individual usage for the snapshot
  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, position: true, subjectGroup: true }
  });

  const snapshotData = [];
  let totalDaysUsed = 0;

  for (const u of users) {
    const userRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: u.id,
        status: "APPROVED",
        startDate: { gte: cycle.start, lte: cycle.end }
      }
    });

    const userUsedDays: Record<string, number> = {};
    for (const r of userRequests) {
      const days = Math.ceil((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      userUsedDays[r.type] = (userUsedDays[r.type] || 0) + days;
      totalDaysUsed += days;
    }

    snapshotData.push({
      userId: u.id,
      name: u.name,
      position: u.position,
      subjectGroup: u.subjectGroup,
      usedDays: userUsedDays
    });
  }

  // Create Archive record
  const archive = await prisma.leaveArchive.create({
    data: {
      cycleLabel: cycle.label,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      data: JSON.stringify(snapshotData),
      totalStaff: users.length,
      totalDays: totalDaysUsed,
      archivedBy: session.user.id
    }
  });

  // Optional: clear old requests from DB to reset the system for the new cycle
  // Only delete APPROVED or REJECTED leaves in this cycle. Leave PENDING ones?
  // Usually, a cut-off resets everything.
  await prisma.leaveRequest.deleteMany({
    where: {
      startDate: { gte: cycle.start, lte: cycle.end },
      status: { in: ["APPROVED", "REJECTED"] }
    }
  });

  await prisma.systemLog.create({
    data: {
      actionType: "ARCHIVE_CYCLE",
      description: `ตัดรอบการลา ${cycle.label}`,
      userId: session.user.id
    }
  });

  return { success: true, archiveId: archive.id };
}

/**
 * Fetch all archived cycles
 */
export async function getArchives() {
  await requireAdmin();
  const archives = await prisma.leaveArchive.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return archives.map(a => ({
    ...a,
    cycleStart: a.cycleStart.toISOString(),
    cycleEnd: a.cycleEnd.toISOString(),
    createdAt: a.createdAt.toISOString()
  }));
}

/**
 * Backup the System Settings to SystemBackup
 */
export async function backupSettings(label: string) {
  const session = await requireAdmin();
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const configs = await prisma.leaveConfig.findMany();

  const snapshot = {
    settings,
    leaveConfigs: configs
  };

  await prisma.systemBackup.create({
    data: {
      label: label || `Backup ${new Date().toLocaleDateString('th-TH')}`,
      data: JSON.stringify(snapshot),
      createdBy: session.user.id
    }
  });

  await prisma.systemLog.create({
    data: {
      actionType: "BACKUP_SETTINGS",
      description: `สำรองการตั้งค่าระบบ: ${label}`,
      userId: session.user.id
    }
  });

  return { success: true };
}

export async function getBackups() {
  await requireAdmin();
  const backups = await prisma.systemBackup.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, createdAt: true, createdBy: true }
  });
  return backups.map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString()
  }));
}

export async function restoreBackup(backupId: string) {
  const session = await requireAdmin();
  const backup = await prisma.systemBackup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error("Backup not found");

  const snapshot = JSON.parse(backup.data);

  // Restore settings
  if (snapshot.settings) {
    const { id, updatedAt, ...restSettings } = snapshot.settings;
    await prisma.systemSettings.update({
      where: { id: "default" },
      data: restSettings
    });
  }

  // Restore leave configs
  if (snapshot.leaveConfigs && Array.isArray(snapshot.leaveConfigs)) {
    // Delete existing configs
    await prisma.leaveConfig.deleteMany();
    // Insert configs from backup
    for (const conf of snapshot.leaveConfigs) {
      await prisma.leaveConfig.create({
        data: {
          type: conf.type,
          name: conf.name,
          maxDaysPerYear: conf.maxDaysPerYear,
          warningThreshold: conf.warningThreshold
        }
      });
    }
  }

  await prisma.systemLog.create({
    data: {
      actionType: "RESTORE_SETTINGS",
      description: `กู้คืนการตั้งค่าระบบจาก: ${backup.label}`,
      userId: session.user.id
    }
  });

  return { success: true };
}

export async function importBackupFromJson(jsonString: string) {
  const session = await requireAdmin();
  let snapshot;
  try {
    snapshot = JSON.parse(jsonString);
  } catch(e) {
    throw new Error("Invalid JSON file");
  }

  // Support old full-system backup or new settings-only backup
  const settingsToRestore = snapshot.settings || snapshot;

  if (settingsToRestore && settingsToRestore.schoolName) {
    const { id, updatedAt, ...restSettings } = settingsToRestore;
    await prisma.systemSettings.update({
      where: { id: "default" },
      data: restSettings
    });
  }

  if (snapshot.leaveConfigs && Array.isArray(snapshot.leaveConfigs)) {
    await prisma.leaveConfig.deleteMany();
    for (const conf of snapshot.leaveConfigs) {
      await prisma.leaveConfig.create({
        data: {
          type: conf.type,
          name: conf.name,
          maxDaysPerYear: conf.maxDaysPerYear,
          warningThreshold: conf.warningThreshold
        }
      });
    }
  }

  await prisma.systemLog.create({
    data: {
      actionType: "RESTORE_SETTINGS",
      description: `กู้คืนการตั้งค่าระบบจากไฟล์อิมพอร์ต JSON`,
      userId: session.user.id
    }
  });

  return { success: true };
}

/**
 * Export leave data for the current fiscal year as a JSON backup.
 * Includes: all leave requests (with user name/email), leave configs, and metadata.
 */
export async function exportLeaveBackup() {
  const session = await requirePrivilegedLeaveBackup();
  const { getLeaveCycleFilter } = await import("@/lib/cycle");
  const cycle = getLeaveCycleFilter(new Date(), "year");

  // Fetch leave requests within the fiscal year
  const whereClause: any = {};
  if (cycle) {
    whereClause.startDate = { gte: cycle.start, lte: cycle.end };
  }

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, position: true, subjectGroup: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const leaveConfigs = await prisma.leaveConfig.findMany();

  const backupPayload = {
    _type: "eleave-leave-backup",
    _version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.name || session.user.email,
    fiscalYear: cycle?.label || "All",
    cycleStart: cycle?.start.toISOString() || null,
    cycleEnd: cycle?.end.toISOString() || null,
    leaveConfigs: leaveConfigs.map(c => ({
      type: c.type,
      name: c.name,
      maxDaysPerYear: c.maxDaysPerYear,
      warningThreshold: c.warningThreshold,
    })),
    leaveRequests: leaveRequests.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.user?.name || "ไม่ระบุชื่อ",
      userEmail: r.user?.email || "ไม่ระบุอีเมล",
      userPosition: r.user?.position || "",
      userSubjectGroup: r.user?.subjectGroup || "",
      type: r.type,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      reason: r.reason,
      status: r.status,
      documentUrl: r.documentUrl,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    summary: {
      totalRequests: leaveRequests.length,
      approved: leaveRequests.filter(r => r.status === "APPROVED").length,
      rejected: leaveRequests.filter(r => r.status === "REJECTED").length,
      pending: leaveRequests.filter(r => r.status.startsWith("PENDING")).length,
      cancelled: leaveRequests.filter(r => r.status === "CANCELLED").length,
    }
  };

  await prisma.systemLog.create({
    data: {
      actionType: "EXPORT_LEAVE_BACKUP",
      description: `สำรองข้อมูลการลา ${cycle?.label || "ทั้งหมด"} (${leaveRequests.length} รายการ)`,
      userId: session.user.id
    }
  });

  return JSON.stringify(backupPayload, null, 2);
}

/**
 * Import leave data from a JSON backup.
 * Restores leave requests and optionally updates leave configs.
 */
export async function importLeaveBackup(jsonString: string, mode: "merge" | "replace" = "merge") {
  const session = await requirePrivilegedLeaveBackup();
  let backup;
  try {
    backup = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON format");
  }

  if (backup._type !== "eleave-leave-backup") {
    throw new Error("Invalid backup file: not a leave backup (missing _type: eleave-leave-backup)");
  }

  if (!Array.isArray(backup.leaveRequests)) {
    throw new Error("Invalid backup file: leaveRequests array not found");
  }

  // Build a map of userEmail -> userId from the current database
  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true }
  });
  const emailToUserId = new Map<string, string>();
  for (const u of existingUsers) {
    emailToUserId.set(u.email, u.id);
  }

  // If replace mode, delete existing leave requests in the same fiscal year range
  if (mode === "replace" && backup.cycleStart && backup.cycleEnd) {
    await prisma.leaveRequest.deleteMany({
      where: {
        startDate: { gte: new Date(backup.cycleStart), lte: new Date(backup.cycleEnd) }
      }
    });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const record of backup.leaveRequests) {
    // Find matching user by email
    const matchedUserId = emailToUserId.get(record.userEmail);
    if (!matchedUserId) {
      skipped++;
      errors.push(`User not found: ${record.userEmail} (${record.userName})`);
      continue;
    }

    // Check for duplicate (same user, same type, same start date)
    if (mode === "merge") {
      const existing = await prisma.leaveRequest.findFirst({
        where: {
          userId: matchedUserId,
          type: record.type,
          startDate: new Date(record.startDate),
          endDate: new Date(record.endDate),
        }
      });
      if (existing) {
        skipped++;
        continue; // Skip duplicate
      }
    }

    try {
      await prisma.leaveRequest.create({
        data: {
          userId: matchedUserId,
          type: record.type,
          startDate: new Date(record.startDate),
          endDate: new Date(record.endDate),
          reason: record.reason || "",
          status: record.status || "APPROVED",
          documentUrl: record.documentUrl || null,
        }
      });
      imported++;
    } catch (err: any) {
      skipped++;
      errors.push(`Failed to import: ${record.userName} ${record.type} (${err.message})`);
    }
  }

  // Restore leave configs if present
  if (Array.isArray(backup.leaveConfigs) && backup.leaveConfigs.length > 0) {
    for (const conf of backup.leaveConfigs) {
      const existing = await prisma.leaveConfig.findFirst({ where: { type: conf.type } });
      if (existing) {
        await prisma.leaveConfig.update({
          where: { id: existing.id },
          data: {
            name: conf.name,
            maxDaysPerYear: conf.maxDaysPerYear,
            warningThreshold: conf.warningThreshold,
          }
        });
      }
    }
  }

  await prisma.systemLog.create({
    data: {
      actionType: "IMPORT_LEAVE_BACKUP",
      description: `นำเข้าข้อมูลการลา: ${imported} รายการสำเร็จ, ${skipped} ข้าม` + (errors.length > 0 ? ` (${errors.length} ข้อผิดพลาด)` : ""),
      userId: session.user.id
    }
  });

  return {
    success: true,
    imported,
    skipped,
    errors: errors.slice(0, 10), // Return first 10 errors
    total: backup.leaveRequests.length
  };
}

function getFiscalYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 9 = Oct
  return (month >= 9 ? year + 1 : year) + 543;
}

export async function importLeaveSimple(records: any[], mode: "merge" | "replace" = "merge") {
  const session = await requirePrivilegedLeaveBackup();
  
  // Load all active users to create lookups
  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true, username: true }
  });

  const { getCurrentLeaveCycle } = await import("@/lib/cycle");
  const cycle = getCurrentLeaveCycle();

  // If replace mode, delete existing requests in this cycle
  if (mode === "replace") {
    await prisma.leaveRequest.deleteMany({
      where: {
        startDate: { gte: cycle.start, lte: cycle.end }
      }
    });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const createdIds: string[] = [];

  // Load leave configurations for type matching
  const leaveConfigs = await prisma.leaveConfig.findMany();
  const typeMap: Record<string, string> = {};
  leaveConfigs.forEach((c) => {
    typeMap[c.name.trim()] = c.type;
  });

  for (const record of records) {
    if (!record.username || !record.startDate || !record.endDate || !record.type) {
      skipped++;
      errors.push("ข้อมูลไม่ครบถ้วน (ต้องระบุ Username, วันที่เริ่ม, วันที่สิ้นสุด, ประเภทการลา)");
      continue;
    }

    // Find applicant
    const matchedUser = existingUsers.find(u => 
      u.username?.toLowerCase() === String(record.username).trim().toLowerCase() ||
      u.email?.toLowerCase() === String(record.username).trim().toLowerCase() ||
      u.id === String(record.username).trim()
    );

    if (!matchedUser) {
      skipped++;
      errors.push(`ไม่พบผู้ใช้งานไอดี: ${record.username}`);
      continue;
    }

    // Map leave type
    let mappedType = String(record.type).trim();
    if (typeMap[mappedType]) {
      mappedType = typeMap[mappedType];
    } else {
      const typeUpper = mappedType.toUpperCase();
      if (["SICK", "PERSONAL", "VACATION", "MATERNITY", "ORDINATION", "MILITARY", "STUDY"].includes(typeUpper)) {
        mappedType = typeUpper;
      } else if (mappedType.includes("ป่วย") || typeUpper.includes("SICK")) {
        mappedType = "SICK";
      } else if (mappedType.includes("กิจ") || typeUpper.includes("PERSONAL")) {
        mappedType = "PERSONAL";
      } else if (mappedType.includes("พัก") || typeUpper.includes("VACATION") || mappedType.includes("ร้อน")) {
        mappedType = "VACATION";
      } else {
        skipped++;
        errors.push(`ประเภทการลาไม่ถูกต้อง: ${record.type} (ผู้ใช้: ${matchedUser.name || record.username})`);
        continue;
      }
    }

    // Map status
    let mappedStatus = "APPROVED";
    const s = String(record.status || "APPROVED").trim().toUpperCase();
    if (["APPROVED", "REJECTED", "CANCELLED", "PENDING_HEAD", "PENDING_EXEC"].includes(s)) {
      mappedStatus = s;
    } else {
      if (s.includes("อนุมัติ") && !s.includes("รอ") && !s.includes("ไม่")) {
        mappedStatus = "APPROVED";
      } else if (s.includes("ปฏิเสธ") || s.includes("ไม่อนุมัติ") || s.includes("REJECT")) {
        mappedStatus = "REJECTED";
      } else if (s.includes("ยกเลิก") || s.includes("CANCEL")) {
        mappedStatus = "CANCELLED";
      } else if (s.includes("รอหัวหน้า") || s.includes("PENDING_HEAD")) {
        mappedStatus = "PENDING_HEAD";
      } else if (s.includes("รอผู้บริหาร") || s.includes("PENDING_EXEC")) {
        mappedStatus = "PENDING_EXEC";
      }
    }

    // Resolve final executive approver (e.g. Director)
    let execApproverId = null;
    if (record.finalApproverUsername) {
      const approver = existingUsers.find(u => 
        u.username?.toLowerCase() === String(record.finalApproverUsername).trim().toLowerCase() ||
        u.email?.toLowerCase() === String(record.finalApproverUsername).trim().toLowerCase() ||
        u.id === String(record.finalApproverUsername).trim()
      );
      if (approver) {
        execApproverId = approver.id;
      }
    }

    // Resolve department head/inspector approver
    let headApproverId = null;
    if (record.headApproverUsername) {
      const approver = existingUsers.find(u => 
        u.username?.toLowerCase() === String(record.headApproverUsername).trim().toLowerCase() ||
        u.email?.toLowerCase() === String(record.headApproverUsername).trim().toLowerCase() ||
        u.id === String(record.headApproverUsername).trim()
      );
      if (approver) {
        headApproverId = approver.id;
      }
    }

    // Check duplicate in merge mode
    if (mode === "merge") {
      const existing = await prisma.leaveRequest.findFirst({
        where: {
          userId: matchedUser.id,
          type: mappedType,
          startDate: new Date(record.startDate),
          endDate: new Date(record.endDate),
        }
      });
      if (existing) {
        skipped++;
        errors.push(`พบข้อมูลการลาซ้ำซ้อนในระบบอยู่แล้ว (ผู้ใช้: ${matchedUser.name}, วันที่: ${record.startDate.split('T')[0]}, ประเภท: ${mappedType})`);
        continue;
      }
    }

    try {
      const startD = new Date(record.startDate);
      const endD = new Date(record.endDate);
      const fy = getFiscalYear(startD);

      const created = await prisma.leaveRequest.create({
        data: {
          userId: matchedUser.id,
          type: mappedType,
          startDate: startD,
          endDate: endD,
          reason: record.reason || "นำเข้าข้อมูลเข้าระบบ",
          status: mappedStatus,
          execApproverId,
          headApproverId,
          fiscalYear: fy,
        }
      });
      createdIds.push(created.id);
      imported++;
    } catch (err: any) {
      skipped++;
      errors.push(`เกิดข้อผิดพลาดในการนำเข้ารายการ (ผู้ใช้: ${matchedUser.name || record.username}): ${err.message}`);
    }
  }

  // Backfill sequence counters
  const { ensureSequencesPopulated } = await import("./leave");
  await ensureSequencesPopulated();

  await prisma.systemLog.create({
    data: {
      actionType: "IMPORT_LEAVE_SIMPLE",
      description: `นำเข้าข้อมูลการลาอย่างง่าย: สำเร็จ ${imported} รายการ, ข้าม ${skipped} รายการ`,
      userId: session.user.id
    }
  });

  return {
    success: true,
    imported,
    skipped,
    errors: errors.slice(0, 10),
    total: records.length,
    createdIds
  };
}

export async function undoImportLeave(ids: string[]) {
  const session = await requirePrivilegedLeaveBackup();
  
  if (!ids || ids.length === 0) {
    return { success: false, error: "ไม่มีรหัสข้อมูลการลาย้อนกลับ" };
  }

  try {
    const res = await prisma.leaveRequest.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    await prisma.systemLog.create({
      data: {
        actionType: "UNDO_IMPORT_LEAVE",
        description: `ย้อนกลับการนำเข้าข้อมูลการลา: ลบสำเร็จ ${res.count} รายการ`,
        userId: session.user.id
      }
    });

    return { success: true, count: res.count };
  } catch (err: any) {
    console.error("Failed to undo import:", err);
    return { success: false, error: err.message };
  }
}

export async function getImportHistory() {
  await requirePrivilegedLeaveBackup();

  try {
    const logs = await prisma.systemLog.findMany({
      where: {
        actionType: {
          in: ["IMPORT_LEAVE_SIMPLE", "IMPORT_LEAVE_BACKUP", "UNDO_IMPORT_LEAVE"]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    });

    const userIds = Array.from(new Set(logs.map(l => l.userId).filter(Boolean)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });

    const userMap: Record<string, string> = {};
    users.forEach(u => {
      userMap[u.id] = u.name || "";
    });

    const logsWithUser = logs.map(l => ({
      ...l,
      user: {
        name: userMap[l.userId] || l.userId || "System"
      }
    }));

    return logsWithUser;
  } catch (err: any) {
    console.error("Failed to get import history:", err);
    return [];
  }
}

