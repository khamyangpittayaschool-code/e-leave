"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { formatDocNumber } from "@/lib/document-utils";
import { ActionResponse } from "@/lib/utils";

// Helper to check user session
async function getSessionUser() {
  if (process.env.BYPASS_AUTH === "true") {
    const user = await prisma.user.findFirst();
    if (user) {
      return user;
    }
    return prisma.user.create({
      data: {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
        role: "ADMIN",
        isApproved: true
      }
    });
  }

  const { headers } = await import("next/headers");
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({
    headers: await headers()
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (e) {
    // Ignore error when running in CLI test environment
  }
}

// Global error handler helper for actions
function handleActionError(err: any, context: string): ActionResponse {
  console.error(`🔒 [Error Log in ${context}]:`, err);
  
  if (err.message === "Unauthorized") {
    return {
      success: false,
      code: "UNAUTHORIZED",
      error: "กรุณาเข้าสู่ระบบก่อนทำรายการนี้"
    };
  }
  
  if (err.message === "Document not found") {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: "ไม่พบเอกสารดังกล่าวในระบบ"
    };
  }

  if (err.message === "Document already issued") {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: "เอกสารนี้ได้รับการออกเลขทะเบียนเรียบร้อยแล้ว"
    };
  }

  if (err.message.includes("ไม่สามารถออกเลขย้อนหลัง")) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: err.message
    };
  }

  if (err.message.includes("วันที")) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: "กรุณากรอกวันที่ของเอกสารให้ถูกต้อง"
    };
  }

  return {
    success: false,
    code: "DATABASE_ERROR",
    error: "ระบบฐานข้อมูลหรือหลังบ้านขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
    technicalDetails: process.env.NODE_ENV === "development" ? err.message : undefined
  };
}

export async function saveDocDraft(data: {
  id?: string;
  docType: string;
  memoSectionId?: string;
  title: string;
  to: string;
  origin: string;
  date: string;
  content: string;
  signeeName: string;
  signeePosition: string;
  enclosures?: string;
  references?: string;
  requester?: string;
  department?: string;
}): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    const docDate = new Date(data.date);
    if (isNaN(docDate.getTime())) {
      throw new Error("วันที่ของเอกสารไม่ถูกต้อง");
    }
    
    if (data.id) {
      const updated = await prisma.documentRecord.update({
        where: { id: data.id },
        data: {
          title: data.title,
          to: data.to,
          origin: data.origin,
          date: docDate,
          content: data.content,
          signeeName: data.signeeName,
          signeePosition: data.signeePosition,
          enclosures: data.enclosures || null,
          references: data.references || null,
          memoSectionId: data.memoSectionId || null,
          status: "DRAFT",
          requester: data.requester || null,
          department: data.department || null,
          year: docDate.getFullYear()
        }
      });
      safeRevalidatePath("/document");
      return { success: true, data: updated };
    } else {
      const created = await prisma.documentRecord.create({
        data: {
          docType: data.docType,
          memoSectionId: data.memoSectionId || null,
          title: data.title,
          to: data.to,
          origin: data.origin,
          date: docDate,
          content: data.content,
          signeeName: data.signeeName,
          signeePosition: data.signeePosition,
          enclosures: data.enclosures || null,
          references: data.references || null,
          status: "DRAFT",
          requester: data.requester || null,
          department: data.department || null,
          createdById: user.id,
          year: docDate.getFullYear()
        }
      });
      safeRevalidatePath("/document");
      return { success: true, data: created };
    }
  } catch (err: any) {
    return handleActionError(err, "saveDocDraft");
  }
}

export async function quickIssueDoc(data: {
  docType: string;
  memoSectionId?: string;
  title: string;
  to: string;
  origin: string;
  date: string;
  requester: string;
  department: string;
}): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    const docDate = new Date(data.date);
    if (isNaN(docDate.getTime())) {
      throw new Error("วันที่ของเอกสารไม่ถูกต้อง");
    }

    const draft = await prisma.documentRecord.create({
      data: {
        docType: data.docType,
        memoSectionId: data.memoSectionId || null,
        title: data.title,
        to: data.to,
        origin: data.origin,
        date: docDate,
        content: "",
        signeeName: "",
        signeePosition: "",
        requester: data.requester,
        department: data.department,
        status: "DRAFT",
        createdById: user.id,
        year: docDate.getFullYear()
      }
    });

    try {
      const issuedRes = await issueDocNumber(draft.id, data.date);
      if (!issuedRes.success) {
        throw new Error(issuedRes.error);
      }
      return issuedRes;
    } catch (error: any) {
      await prisma.documentRecord.delete({ where: { id: draft.id } }).catch(() => {});
      throw error;
    }
  } catch (err: any) {
    return handleActionError(err, "quickIssueDoc");
  }
}

export async function issueDocNumber(docId: string, customDateStr?: string): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    
    // Transaction to secure auto-increment
    const updatedRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.documentRecord.findUnique({
        where: { id: docId }
      });
      if (!record) throw new Error("Document not found");
      if (record.status !== "DRAFT" && record.status !== "RESERVED") throw new Error("Document already issued");

      const activeDate = customDateStr ? new Date(customDateStr) : record.date;
      const year = activeDate.getFullYear();
      const thYear = year + 543;

      // 1. Validate date constraint: Not earlier than the latest document in this sequence
      const latestDoc = await tx.documentRecord.findFirst({
        where: {
          docType: record.docType,
          memoSectionId: record.memoSectionId,
          year: year,
          status: { in: ["ISSUED", "PRINTED"] }
        },
        orderBy: { seqNo: "desc" }
      });

      if (latestDoc) {
        const activeDateStart = new Date(activeDate);
        activeDateStart.setHours(0, 0, 0, 0);
        const latestDocDateStart = new Date(latestDoc.date);
        latestDocDateStart.setHours(0, 0, 0, 0);

        if (activeDateStart < latestDocDateStart) {
          const formattedDate = latestDoc.date.toLocaleDateString("th-TH");
          throw new Error(`ไม่สามารถออกเลขย้อนหลังข้ามลำดับเวลาได้ วันที่ของเอกสารนี้ต้องเท่ากับหรือหลังวันที่ของเอกสารฉบับล่าสุด (${formattedDate})`);
        }
      }

      // 2. Fetch or create config for prefix and sequence
      let config = await tx.documentConfig.findFirst({
        where: {
          docType: record.docType,
          memoSectionId: record.memoSectionId
        }
      });

      if (!config) {
        config = await tx.documentConfig.create({
          data: {
            docType: record.docType,
            memoSectionId: record.memoSectionId,
            prefix: record.docType === "COMMAND" ? "คำสั่งที่" : record.docType === "ANNOUNCEMENT" ? "ประกาศที่" : record.docType.startsWith("OUTGOING") ? "ที่ ศทก" : "ศทก",
            useThaiNumerals: true,
            paddingDigits: 1,
            yearFormat: "TH_BE",
            currentSeq: 0
          }
        });
      }

      // Atomic increment on database level to prevent race condition / sequence duplication
      const updatedConfig = await tx.documentConfig.update({
        where: { id: config.id },
        data: { currentSeq: { increment: 1 } }
      });
      const nextSeq = updatedConfig.currentSeq;

      // Formulate running number
      const finalYear = config.yearFormat === "TH_BE" ? thYear : year;
      const pattern = "[PREFIX] [SEQ]/[YEAR]";

      const formattedNo = formatDocNumber(
        pattern,
        config.prefix,
        nextSeq,
        finalYear,
        config.paddingDigits,
        config.useThaiNumerals
      );

      // Save and update document record
      const updated = await tx.documentRecord.update({
        where: { id: docId },
        data: {
          docNo: formattedNo,
          seqNo: nextSeq,
          year: year,
          date: activeDate,
          status: "ISSUED"
        }
      });

      // Write system log
      await tx.systemLog.create({
        data: {
          actionType: "DOC_ISSUE",
          description: `ออกเลขเอกสารประเภท ${record.docType}: ${formattedNo} โดยผู้ใช้งาน ${user.name || "Unknown"}`,
          userId: user.id
        }
      });

      return updated;
    });

    safeRevalidatePath("/document");
    return { success: true, data: updatedRecord };

  } catch (err: any) {
    return handleActionError(err, "issueDocNumber");
  }
}

export async function cancelDoc(id: string, reason: string): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    const updated = await prisma.documentRecord.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: reason
      }
    });

    await prisma.systemLog.create({
      data: {
        actionType: "DOC_CANCEL",
        description: `ยกเลิกเลขเอกสาร ${updated.docNo || "ยังไม่ได้ออกเลข"} เนื่องจาก: ${reason}`,
        userId: user.id
      }
    });

    safeRevalidatePath("/document");
    return { success: true, data: updated };
  } catch (err: any) {
    return handleActionError(err, "cancelDoc");
  }
}

export async function getDocPreviewNumber(docType: string, sectionId?: string): Promise<ActionResponse> {
  try {
    const config = await prisma.documentConfig.findFirst({
      where: {
        docType,
        memoSectionId: sectionId || null
      }
    });

    const nextSeq = config ? config.currentSeq + 1 : 1;
    const prefix = config ? config.prefix : (docType === "COMMAND" ? "คำสั่งที่" : docType === "ANNOUNCEMENT" ? "ประกาศที่" : docType.startsWith("OUTGOING") ? "ที่ ศทก" : "ศทก");
    const useThaiNumerals = config ? config.useThaiNumerals : true;
    const paddingDigits = config ? config.paddingDigits : 1;
    const yearFormat = config ? config.yearFormat : "TH_BE";

    const year = new Date().getFullYear();
    const thYear = year + 543;
    const finalYear = yearFormat === "TH_BE" ? thYear : year;
    const pattern = "[PREFIX] [SEQ]/[YEAR]";

    const preview = formatDocNumber(
      pattern,
      prefix,
      nextSeq,
      finalYear,
      paddingDigits,
      useThaiNumerals
    );

    return { success: true, data: preview };
  } catch (err: any) {
    return handleActionError(err, "getDocPreviewNumber");
  }
}

export async function getDocumentDetails(id: string): Promise<ActionResponse> {
  try {
    const doc = await prisma.documentRecord.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, position: true } },
        memoSection: true
      }
    });
    if (!doc) throw new Error("Document not found");
    return { success: true, data: doc };
  } catch (err: any) {
    return handleActionError(err, "getDocumentDetails");
  }
}

export async function getDocumentsList(filters: {
  search?: string;
  docType?: string;
  memoSectionId?: string;
  status?: string;
  year?: number;
}): Promise<ActionResponse> {
  try {
    const where: any = {};
    if (filters.docType) where.docType = filters.docType;
    if (filters.memoSectionId) where.memoSectionId = filters.memoSectionId;
    if (filters.status) where.status = filters.status;
    if (filters.year) where.year = filters.year;
    
    if (filters.search) {
      where.OR = [
        { docNo: { contains: filters.search, mode: "insensitive" } },
        { title: { contains: filters.search, mode: "insensitive" } },
        { signeeName: { contains: filters.search, mode: "insensitive" } }
      ];
    }

    const list = await prisma.documentRecord.findMany({
      where,
      include: {
        user: { select: { name: true } },
        memoSection: true
      },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" }
      ]
    });

    return { success: true, data: list };
  } catch (err: any) {
    return handleActionError(err, "getDocumentsList");
  }
}

export async function getDashboardStats(): Promise<ActionResponse> {
  try {
    const currentYear = new Date().getFullYear();
    const counts = await prisma.documentRecord.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { year: currentYear }
    });

    const stats = { DRAFT: 0, ISSUED: 0, PRINTED: 0, CANCELLED: 0 };
    counts.forEach((c) => {
      if (c.status in stats) {
        stats[c.status as keyof typeof stats] = c._count.id;
      }
    });
    return { success: true, data: stats };
  } catch (err: any) {
    return handleActionError(err, "getDashboardStats");
  }
}

export async function saveDocumentAttachment(id: string, url: string | null, name: string | null): Promise<ActionResponse> {
  try {
    const updated = await prisma.documentRecord.update({
      where: { id },
      data: {
        attachmentUrl: url,
        attachmentName: name
      }
    });
    safeRevalidatePath(`/document/${id}`);
    safeRevalidatePath("/document");
    return { success: true, data: updated };
  } catch (err: any) {
    return handleActionError(err, "saveDocumentAttachment");
  }
}

export async function getDocumentActivities(): Promise<ActionResponse> {
  try {
    const user = await getSessionUser();
    
    const logs = await prisma.systemLog.findMany({
      where: {
        actionType: {
          in: [
            "DOC_ISSUE",
            "DOC_CANCEL",
            "INCOMING_SYNC_AUTO",
            "INCOMING_SYNC_HTML",
            "INCOMING_CREATE",
            "INCOMING_RESOLVE"
          ]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 6
    });

    const userIds = Array.from(new Set(logs.map(l => l.userId)));
    const usersList = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });

    const userMap = new Map(usersList.map(u => [u.id, u.name]));

    const events = logs.map(l => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      actorName: userMap.get(l.userId) || "ไม่ระบุชื่อ",
      actionType: l.actionType,
      description: l.description
    }));

    return { success: true, data: events };
  } catch (err: any) {
    return handleActionError(err, "getDocumentActivities");
  }
}

export async function getDocumentTrendStats(): Promise<ActionResponse> {
  try {
    const currentYear = new Date().getFullYear();
    const docs = await prisma.documentRecord.findMany({
      where: {
        createdAt: {
          gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
        }
      },
      select: {
        docType: true,
        createdAt: true
      }
    });

    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    
    const monthlyStats = thaiMonths.map((m) => ({
      month: m,
      memo: 0,
      outgoing: 0,
      command: 0
    }));

    docs.forEach((doc) => {
      const monthIndex = doc.createdAt.getMonth();
      if (monthIndex >= 0 && monthIndex < 12) {
        const type = doc.docType;
        if (type === "MEMO") {
          monthlyStats[monthIndex].memo++;
        } else if (type === "OUTGOING" || type === "OUTGOING_NORMAL" || type === "OUTGOING_CIRCULAR") {
          monthlyStats[monthIndex].outgoing++;
        } else if (type === "COMMAND" || type === "ANNOUNCEMENT") {
          monthlyStats[monthIndex].command++;
        }
      }
    });

    return { success: true, data: monthlyStats };
  } catch (err: any) {
    return handleActionError(err, "getDocumentTrendStats");
  }
}
