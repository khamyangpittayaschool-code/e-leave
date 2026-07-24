"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseAMSSUrl, loginToAMSS, fetchWithTlsFallback } from "@/lib/amss-parser";
import { parseAMSSListHtml } from "@/lib/amss-list-parser";
import { safeAction } from "@/lib/utils";
import { encrypt, decrypt } from "@/lib/crypto";

// Server-side lock to prevent concurrent sync operations per user
const activeSyncUsers = new Set<string>();

// Helper to check user session
async function getSessionUser() {
  if (process.env.BYPASS_AUTH === "true") {
    const user = await prisma.user.findFirst();
    if (user) return user;
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
    // Ignore error
  }
}

// Scrape AMSS++ URL
export const scrapeAMSSDocument = safeAction(async (urlStr: string) => {
  const user = await getSessionUser();
  
  // Extract amssOriginId from URL query parameters
  let amssOriginId: string | null = null;
  try {
    const parsedUrl = new URL(urlStr);
    amssOriginId = parsedUrl.searchParams.get("id");
  } catch (e) {
    throw new Error("รูปแบบลิงก์ AMSS++ ไม่ถูกต้อง");
  }

  // Pre-check for duplicate documents
  if (amssOriginId) {
    const existing = await prisma.incomingDocument.findUnique({
      where: { amssOriginId }
    });
    if (existing) {
      throw new Error("เอกสารนี้เคยถูกดึงเข้าระบบแล้ว (เลขทะเบียนรับ: " + existing.receiveNo + ")");
    }
  }

  // Check if credentials exist for the user
  const credentials = await prisma.aMSSCredentials.findUnique({
    where: { userId: user.id }
  });

  let cookieHeader = "";
  if (credentials) {
    const decryptedPassword = decrypt(credentials.password);
    const loginCookies = await loginToAMSS(credentials.url, credentials.username, decryptedPassword);
    if (loginCookies) {
      cookieHeader = loginCookies;
    }
  }

  // Scrape page content using parseAMSSUrl with cookieHeader
  const details = await parseAMSSUrl(urlStr, cookieHeader);
  if (!details) {
    throw new Error("ไม่สามารถดึงข้อมูลจากลิงก์ AMSS++ ได้ กรุณาตรวจสอบรหัสผ่านหรือความถูกต้องของลิงก์");
  }

  return {
    ...details,
    amssOriginId,
  };
});

function normalizeAmssUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("โปรโตคอล URL ต้องเป็น HTTP หรือ HTTPS");
  }
  let cleanUrl = parsed.origin + parsed.pathname;
  if (cleanUrl.endsWith("/index.php")) {
    cleanUrl = cleanUrl.substring(0, cleanUrl.lastIndexOf("/index.php"));
  }
  return cleanUrl || parsed.origin;
}

// Save or update AMSS credentials for current user
export const saveAMSSCredentials = safeAction(async (data: {
  url: string;
  username: string;
  password?: string;
}) => {
  const user = await getSessionUser();
  
  let normalizedUrl = "";
  try {
    normalizedUrl = normalizeAmssUrl(data.url);
  } catch (err: any) {
    throw new Error("ลิงก์ URL ไม่ถูกต้อง: " + (err.message || ""));
  }
  
  const existing = await prisma.aMSSCredentials.findUnique({
    where: { userId: user.id }
  });

  if (existing) {
    await prisma.aMSSCredentials.update({
      where: { userId: user.id },
      data: {
        url: normalizedUrl,
        username: data.username.trim(),
        password: data.password ? encrypt(data.password) : existing.password,
        sessionCookie: null,
        sessionExpiresAt: null
      }
    });
    safeRevalidatePath("/document");
    return { success: true, isNew: false };
  }

  if (!data.password) {
    throw new Error("กรุณาระบุรหัสผ่านสำหรับการบันทึกครั้งแรก");
  }

  await prisma.aMSSCredentials.create({
    data: {
      userId: user.id,
      url: normalizedUrl,
      username: data.username.trim(),
      password: encrypt(data.password)
    }
  });
  
  safeRevalidatePath("/document");
  return { success: true, isNew: true };
});

// Check if credentials exist and return settings
export const getAMSSCredentials = safeAction(async () => {
  const user = await getSessionUser();
  const creds = await prisma.aMSSCredentials.findUnique({
    where: { userId: user.id },
    select: { url: true, username: true, updatedAt: true, lastSyncAt: true }
  });
  return creds;
});

// Test AMSS Connection
export const testAMSSConnection = safeAction(async (data: {
  url: string;
  username: string;
  password?: string;
}) => {
  const user = await getSessionUser();
  let passwordToUse = "";

  let normalizedUrl = "";
  try {
    normalizedUrl = normalizeAmssUrl(data.url);
  } catch (err: any) {
    throw new Error("ลิงก์ URL ไม่ถูกต้อง: " + (err.message || ""));
  }

  if (data.password) {
    passwordToUse = data.password;
  } else {
    const existing = await prisma.aMSSCredentials.findUnique({
      where: { userId: user.id }
    });
    if (!existing) {
      throw new Error("ไม่มีข้อมูลรหัสผ่านเดิม กรุณากรอกรหัสผ่านใหม่");
    }
    passwordToUse = decrypt(existing.password);
  }

  try {
    const loginCookies = await loginToAMSS(normalizedUrl, data.username, passwordToUse);
    if (!loginCookies) {
      return { success: false, error: "เข้าสู่ระบบล้มเหลว ตรวจสอบชื่อผู้ใช้งานหรือรหัสผ่าน" };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "การเชื่อมต่อล้มเหลว ตรวจสอบความถูกต้องของลิงก์ URL" };
  }
});

// Sync AMSS Documents Automatically
export const syncAMSSDocumentsAutomatically = safeAction(async (
  dateRange: "this_week" | "this_month" | "this_year" | "all" = "all"
) => {
  const user = await getSessionUser();

  // Server-side lock to prevent concurrent sync operations per user
  if (activeSyncUsers.has(user.id)) {
    throw new Error("ระบบกำลังดำเนินการดึงข้อมูลอยู่แล้ว กรุณารอจนกว่าการซิงค์จะเสร็จสิ้น");
  }
  activeSyncUsers.add(user.id);

  // Setup safety timeout to release the lock in case of network hanging
  const lockTimeout = setTimeout(() => {
    activeSyncUsers.delete(user.id);
  }, 5 * 60 * 1000); // 5 minutes timeout

  const startTime = Date.now();

  try {
    const credentials = await prisma.aMSSCredentials.findUnique({
      where: { userId: user.id }
    });

    if (!credentials || !credentials.url) {
      throw new Error("ยังไม่ได้ตั้งค่าข้อมูลการเชื่อมต่อหรือลิงก์ AMSS++");
    }

    let loginCookies = "";
    const now = new Date();
    if (credentials.sessionCookie && credentials.sessionExpiresAt && credentials.sessionExpiresAt > now) {
      try {
        loginCookies = decrypt(credentials.sessionCookie);
      } catch (e) {
        loginCookies = "";
      }
    }

    if (!loginCookies) {
      const decryptedPassword = decrypt(credentials.password);
      const freshCookies = await loginToAMSS(credentials.url, credentials.username, decryptedPassword);
      if (!freshCookies) {
        throw new Error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ AMSS++ ฝั่งสพท. ได้ (403 Forbidden/Firewall บล็อกคลาวด์ หรือ รหัสผ่านไม่ถูกต้อง) แนะนำใช้ระบบซิงค์ผ่านเบราว์เซอร์");
      }
      loginCookies = freshCookies;

      // Cache session cookie for 2 hours
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await prisma.aMSSCredentials.update({
        where: { userId: user.id },
        data: {
          sessionCookie: encrypt(freshCookies),
          sessionExpiresAt: expiresAt
        }
      });
    }

    // Fetch list of documents (document list page)
    const parsedUrl = new URL(credentials.url);
    const origin = parsedUrl.origin;

    // Determine how many pages to fetch based on dateRange
    let maxPages = 5;
    if (dateRange === "this_week") maxPages = 2;
    else if (dateRange === "this_month") maxPages = 3;
    else if (dateRange === "this_year") maxPages = 5;
    else if (dateRange === "all") maxPages = 10;

    let totalImported = 0;
    let totalUpdated = 0;
    let totalDuplicates = 0;
    let successFetch = false;
    let lastHttpStatus = 0;

    const currentBEYear = new Date().getFullYear() + 543;

    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = `${origin}/index.php?option=book&task=main/receive&select_year=${currentBEYear}&page=${page}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetchWithTlsFallback(pageUrl, {
          signal: controller.signal,
          headers: {
            "Cookie": loginCookies,
          }
        });
        clearTimeout(timeoutId);
        lastHttpStatus = res.status;

        if (res.ok) {
          const buffer = await res.arrayBuffer();
          let text = new TextDecoder("utf-8").decode(buffer);
          if (text.includes("เธ") || text.includes("เธช")) {
            text = new TextDecoder("windows-874").decode(buffer);
          }

          if (
            text.includes("bookdetail") ||
            text.includes("onclick=\"check") ||
            text.includes("saraban_index") ||
            text.includes("หนังสือรับ")
          ) {
            successFetch = true;

            // CAPTCHA and Cloudflare Blocking Detection (only trigger on actual block pages, not analytics scripts)
            const lowerHtml = text.toLowerCase();
            if (
              lowerHtml.includes("g-recaptcha-response") ||
              lowerHtml.includes("cf-browser-verification") ||
              lowerHtml.includes("<title>just a moment...</title>")
            ) {
              throw new Error("ระบบ AMSS++ มีมาตรการความปลอดภัยขั้นสูง (CAPTCHA หรือ Cloudflare) บล็อกการดึงข้อมูลอัตโนมัติ กรุณาใช้วิธีนำเข้าแบบวางโค้ดแทน");
            }

            const syncRes = await syncAMSSDocumentsFromHtml(text, dateRange);
            totalImported += syncRes.importedCount;
            totalUpdated += syncRes.updatedCount || 0;
            totalDuplicates += syncRes.duplicatesCount;

            // If page returns no new items and no duplicates, we reached the end of list
            if (syncRes.importedCount === 0 && syncRes.duplicatesCount === 0) {
              break;
            }
          }
        }
      } catch (e: any) {
        if (e.message && e.message.includes("CAPTCHA")) {
          throw e;
        }
        // silent retry for network timeout on individual page
      }
    }

    if (!successFetch) {
      if (lastHttpStatus === 403) {
        throw new Error("AMSS++ มีระบบป้องกันบอทภายนอก (403 Forbidden) ระบบจะสลับไปใช้วิธีซิงค์ผ่านเบราว์เซอร์แทน");
      }
      throw new Error("ไม่สามารถดึงรายการเอกสารรับจากระบบ AMSS++ ได้ (ตรวจสอบความถูกต้องของลิงก์)");
    }

    const syncResult = {
      importedCount: totalImported,
      updatedCount: totalUpdated,
      duplicatesCount: totalDuplicates
    };

    // Save successful sync timestamp
    const durationMs = Date.now() - startTime;
    await prisma.aMSSCredentials.update({
      where: { userId: user.id },
      data: { lastSyncAt: new Date() }
    });

    // Save auto-sync session system log
    await prisma.systemLog.create({
      data: {
        actionType: "INCOMING_SYNC_AUTO",
        description: `ดึงข้อมูลจาก AMSS++ อัตโนมัติ: นำเข้าใหม่ ${syncResult.importedCount} รายการ, ข้าม ${syncResult.duplicatesCount} รายการ (ใช้เวลา ${durationMs}ms)`,
        userId: user.id
      }
    });

    return syncResult;
  } finally {
    clearTimeout(lockTimeout);
    activeSyncUsers.delete(user.id);
  }
});

// Delete AMSS credentials
export const deleteAMSSCredentials = safeAction(async () => {
  const user = await getSessionUser();
  await prisma.aMSSCredentials.delete({
    where: { userId: user.id }
  });
  safeRevalidatePath("/document");
  return { success: true };
});

// Create/Register Incoming Document
export const createIncomingDoc = safeAction(async (data: {
  senderOrg: string;
  docRefNo?: string;
  title: string;
  urgencyLevel: string; // URGENT_MOST, URGENT_MORE, URGENT, NORMAL
  amssLink?: string;
  attachmentUrl?: string;
  memoSectionId?: string;
  note?: string;
  firstAssigneeId?: string; // If provided, start routing to this person immediately
  amssOriginId?: string | null; // Add this!
}) => {
  const user = await getSessionUser();
  const receiveDate = new Date();
  const year = parseInt(new Date().toLocaleDateString("en-US", { year: "numeric", timeZone: "Asia/Bangkok" }), 10);
  const thYear = year + 543;

  return prisma.$transaction(async (tx) => {
    // Auto-generate receiveNo "รับที่ XXX/2569"
    // Find highest seq for current year by fetching all docs of the year and parsing in memory
    const yearDocuments = await tx.incomingDocument.findMany({
      where: {
        receiveDate: {
          gte: new Date(`${year}-01-01T00:00:00+07:00`),
          lt: new Date(`${year + 1}-01-01T00:00:00+07:00`)
        }
      },
      select: { receiveNo: true }
    });

    let nextSeq = 1;
    for (const doc of yearDocuments) {
      if (doc.receiveNo) {
        const match = doc.receiveNo.match(/รับที่\s*(\d+)/);
        if (match) {
          const seq = parseInt(match[1]);
          if (seq >= nextSeq) {
            nextSeq = seq + 1;
          }
        }
      }
    }

    const receiveNo = `รับที่ ${nextSeq}/${thYear}`;

    const doc = await tx.incomingDocument.create({
      data: {
        receiveNo,
        receiveDate,
        amssOriginId: data.amssOriginId || null,
        senderOrg: data.senderOrg,
        docRefNo: data.docRefNo || null,
        title: data.title,
        urgencyLevel: data.urgencyLevel,
        amssLink: data.amssLink || null,
        attachmentUrl: data.attachmentUrl || null,
        memoSectionId: data.memoSectionId || null,
        note: data.note || null,
        status: data.firstAssigneeId ? "ROUTING" : "PENDING",
        createdById: user.id
      }
    });

    // If first assignee is provided, add the first routing step
    if (data.firstAssigneeId) {
      await tx.documentRouting.create({
        data: {
          incomingDocId: doc.id,
          stepOrder: 1,
          assigneeId: data.firstAssigneeId,
          assignedById: user.id,
          status: "PENDING"
        }
      });

      // Send LINE notification if enabled
      await sendLineNotifyForRouting(doc.title, data.firstAssigneeId);
    }

    // Write system log
    await tx.systemLog.create({
      data: {
        actionType: "INCOMING_CREATE",
        description: `ลงทะเบียนรับหนังสือราชการ: ${receiveNo} - ${data.title} โดยผู้ใช้ ${user.name || "Unknown"}`,
        userId: user.id
      }
    });

    safeRevalidatePath("/document");
    return doc;
  });
});

// Add next step manually (if the manager wants to add a step to the chain)
export async function addRoutingStep(data: {
  incomingDocId: string;
  assigneeId: string;
  deadline?: string;
}) {
  const user = await getSessionUser();

  const result = await prisma.$transaction(async (tx) => {
    const doc = await tx.incomingDocument.findUnique({
      where: { id: data.incomingDocId },
      include: { routingSteps: true }
    });
    if (!doc) throw new Error("Document not found");

    const maxStep = doc.routingSteps.reduce((max, s) => Math.max(max, s.stepOrder), 0);
    const nextStepOrder = maxStep + 1;

    const newStep = await tx.documentRouting.create({
      data: {
        incomingDocId: data.incomingDocId,
        stepOrder: nextStepOrder,
        assigneeId: data.assigneeId,
        assignedById: user.id,
        status: "PENDING",
        deadline: data.deadline ? new Date(data.deadline) : null
      }
    });

    // If document was in PENDING status, mark it as ROUTING
    if (doc.status === "PENDING") {
      await tx.incomingDocument.update({
        where: { id: doc.id },
        data: { status: "ROUTING" }
      });
    }

    // Notify assignee
    await sendLineNotifyForRouting(doc.title, data.assigneeId);

    return newStep;
  });

  safeRevalidatePath(`/document/incoming/${data.incomingDocId}`);
  return result;
}

// Resolve/Sign/Annotate a routing step
export async function resolveRoutingStep(data: {
  routingId: string;
  resolution: string; // "รับทราบ", "ทราบและดำเนินการ", or custom text
  note?: string;
  nextAssigneeId?: string; // Chain to next person
  deadline?: string; // Deadline for the next person
}) {
  const user = await getSessionUser();

  const result = await prisma.$transaction(async (tx) => {
    const currentStep = await tx.documentRouting.findUnique({
      where: { id: data.routingId },
      include: { incomingDoc: true }
    });
    if (!currentStep) throw new Error("Routing step not found");
    if (currentStep.assigneeId !== user.id && user.role !== "ADMIN") {
      throw new Error("You are not authorized to sign this step");
    }

    // 1. Update current step
    const updatedStep = await tx.documentRouting.update({
      where: { id: data.routingId },
      data: {
        status: "COMPLETED",
        resolution: data.resolution,
        note: data.note || null,
        completedAt: new Date()
      }
    });

    // 2. Handle next step or complete routing
    if (data.nextAssigneeId) {
      // Create next step
      await tx.documentRouting.create({
        data: {
          incomingDocId: currentStep.incomingDocId,
          stepOrder: currentStep.stepOrder + 1,
          assigneeId: data.nextAssigneeId,
          assignedById: user.id,
          status: "PENDING",
          deadline: data.deadline ? new Date(data.deadline) : null
        }
      });

      // Send LINE notification
      await sendLineNotifyForRouting(currentStep.incomingDoc.title, data.nextAssigneeId);
    } else {
      // If no next assignee, it means the flow ends here. 
      // Check if all routing steps are resolved
      const pendingSteps = await tx.documentRouting.findMany({
        where: {
          incomingDocId: currentStep.incomingDocId,
          status: "PENDING"
        }
      });

      if (pendingSteps.length === 0) {
        // Complete the document status
        await tx.incomingDocument.update({
          where: { id: currentStep.incomingDocId },
          data: { status: "COMPLETED" }
        });
      }
    }

    // Write system log
    await tx.systemLog.create({
      data: {
        actionType: "INCOMING_RESOLVE",
        description: `เกษียนหนังสือรับ: ${currentStep.incomingDoc.receiveNo} - ขั้นตอนที่ ${currentStep.stepOrder} (${data.resolution}) โดย ${user.name || "Unknown"}`,
        userId: user.id
      }
    });

    return updatedStep;
  });

  safeRevalidatePath(`/document/incoming/${result.incomingDocId}`);
  safeRevalidatePath("/document");
  return result;
}

// Cancel / Skip routing step
export async function skipRoutingStep(routingId: string) {
  const user = await getSessionUser();
  if (user.role !== "ADMIN" && user.role !== "DIRECTOR") {
    throw new Error("Unauthorized to skip routing step");
  }

  const result = await prisma.$transaction(async (tx) => {
    const step = await tx.documentRouting.findUnique({
      where: { id: routingId }
    });
    if (!step) throw new Error("Step not found");

    const updated = await tx.documentRouting.update({
      where: { id: routingId },
      data: {
        status: "SKIPPED",
        completedAt: new Date()
      }
    });

    safeRevalidatePath(`/document/incoming/${step.incomingDocId}`);
    return updated;
  });

  return result;
}

// Get count of pending routing tasks for user
export async function getMyPendingRoutingCount() {
  try {
    const user = await getSessionUser();
    return prisma.documentRouting.count({
      where: {
        assigneeId: user.id,
        status: "PENDING"
      }
    });
  } catch {
    return 0;
  }
}

// Get user's pending routing list
export async function getMyPendingRouting() {
  const user = await getSessionUser();
  return prisma.documentRouting.findMany({
    where: {
      assigneeId: user.id,
      status: "PENDING"
    },
    include: {
      incomingDoc: {
        include: {
          memoSection: true
        }
      },
      assignedBy: {
        select: { name: true, position: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

// Get incoming document list
export async function getIncomingDocsList(filters: {
  search?: string;
  memoSectionId?: string;
  urgencyLevel?: string;
  status?: string; // PENDING, ROUTING, COMPLETED, CANCELLED
}) {
  const where: any = {};
  if (filters.memoSectionId) where.memoSectionId = filters.memoSectionId;
  if (filters.urgencyLevel) where.urgencyLevel = filters.urgencyLevel;
  if (filters.status) where.status = filters.status;

  if (filters.search) {
    where.OR = [
      { receiveNo: { contains: filters.search, mode: "insensitive" } },
      { docRefNo: { contains: filters.search, mode: "insensitive" } },
      { title: { contains: filters.search, mode: "insensitive" } },
      { senderOrg: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  return prisma.incomingDocument.findMany({
    where,
    include: {
      memoSection: true,
      createdBy: { select: { name: true } },
      routingSteps: {
        orderBy: { stepOrder: "asc" },
        include: {
          assignee: { select: { name: true, position: true } }
        }
      }
    },
    orderBy: {
      receiveDate: "desc"
    }
  });
}

// Get details of single incoming document along with routing timeline
export async function getIncomingDocDetails(id: string) {
  return prisma.incomingDocument.findUnique({
    where: { id },
    include: {
      memoSection: true,
      createdBy: { select: { name: true, position: true } },
      routingSteps: {
        orderBy: { stepOrder: "asc" },
        include: {
          assignee: { select: { name: true, position: true, signatureUrl: true } },
          assignedBy: { select: { name: true, position: true } }
        }
      }
    }
  });
}

// Helper: send LINE notification to the assignee of a routing step
async function sendLineNotifyForRouting(docTitle: string, assigneeId: string) {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" }
    });

    if (!settings?.enableLineNotify || !settings?.lineChannelAccessToken) return;

    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId }
    });

    if (!assignee?.lineUserId) return; // User hasn't linked LINE account

    // Build message
    const message = `🔔 หนังสือราชการถึงคิวเกษียนของท่าน\n\nเรื่อง: ${docTitle}\nกรุณาเข้าสู่ระบบเพื่อลงความเห็น/เกษียนสั่งการ`;

    // Trigger notification via the custom API (often implemented via LINE Bot or generic fetch)
    // We send to assignee's LINE userId
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.lineChannelAccessToken}`
      },
      body: JSON.stringify({
        to: assignee.lineUserId,
        messages: [
          {
            type: "text",
            text: message
          }
        ]
      })
    });
  } catch (e) {
    console.error("Failed to send LINE notification for routing", e);
  }
}

export async function syncAMSSDocumentsFromHtml(
  html: string,
  dateRange: "this_week" | "this_month" | "this_year" | "all" = "all"
) {
  const user = await getSessionUser();
  const parsedDocs = parseAMSSListHtml(html);
  
  if (parsedDocs.length === 0) {
    throw new Error("ไม่พบรายการหนังสือรับที่ถูกต้องในรหัส HTML หรือข้อความที่ส่งมา");
  }

  // Normalize amssLink to be absolute URLs using credentials.url
  const credentials = await prisma.aMSSCredentials.findUnique({
    where: { userId: user.id }
  });
  if (credentials && credentials.url) {
    const base = credentials.url.endsWith("/") ? credentials.url : credentials.url + "/";
    parsedDocs.forEach(d => {
      if (d.amssLink && !d.amssLink.startsWith("http://") && !d.amssLink.startsWith("https://")) {
        d.amssLink = new URL(d.amssLink, base).toString();
      }
    });
  }

  // Parse represented years from parsedDocs to query baseline sequence numbers
  const years = Array.from(new Set(parsedDocs.map(d => {
    const parts = d.dateText.trim().split(/\s+/);
    if (parts.length >= 3) {
      let year = parseInt(parts[2], 10);
      if (!isNaN(year)) {
        if (year > 2400) {
          year = year - 543;
        } else if (year < 100) {
          year = year + 2500 - 543;
        }
        return year;
      }
    }
    return new Date().getFullYear();
  })));

  const result = await prisma.$transaction(async (tx) => {
    let importedCount = 0;
    let updatedCount = 0;
    let duplicatesCount = 0;

    const amssLinks = parsedDocs.map(d => d.amssLink).filter(Boolean);
    const refCombos = parsedDocs
      .filter(d => d.docRefNo && d.docRefNo.trim() !== "")
      .map(d => ({ docRefNo: d.docRefNo, senderOrg: d.senderOrg }));

    const existingDocs = await tx.incomingDocument.findMany({
      where: {
        OR: [
          { amssLink: { in: amssLinks } },
          ...refCombos
        ]
      },
      select: { id: true, amssLink: true, docRefNo: true, senderOrg: true }
    });

    // Fetch baseline sequence numbers for each represented year
    const yearDocsMap = new Map<number, number>();
    for (const yr of years) {
      const docs = await tx.incomingDocument.findMany({
        where: {
          receiveDate: {
            gte: new Date(`${yr}-01-01T00:00:00+07:00`),
            lt: new Date(`${yr + 1}-01-01T00:00:00+07:00`)
          }
        },
        select: { receiveNo: true }
      });
      
      let nextSeq = 1;
      for (const doc of docs) {
        if (doc.receiveNo) {
          const match = doc.receiveNo.match(/รับที่\s*(\d+)/);
          if (match) {
            const seq = parseInt(match[1]);
            if (seq >= nextSeq) {
              nextSeq = seq + 1;
            }
          }
        }
      }
      yearDocsMap.set(yr, nextSeq);
    }

    const now = new Date();

    for (const d of parsedDocs) {
      // Convert dateText to Date object
      let parsedDate = new Date();
      const parts = d.dateText.trim().split(/\s+/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const thaiShortMonthMap: Record<string, number> = {
          "มค": 0, "กพ": 1, "มีค": 2, "เมย": 3, "พค": 4, "มิย": 5,
          "กค": 6, "สค": 7, "กย": 8, "ตค": 9, "พย": 10, "ธค": 11
        };
        const mClean = parts[1].replace(/\./g, "").trim();
        const monthIdx = thaiShortMonthMap[mClean] !== undefined ? thaiShortMonthMap[mClean] : 0;
        
        let year = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(day)) {
          if (year > 2400) {
            year = year - 543;
          } else if (year < 100) {
            year = year + 2500 - 543;
          }
          parsedDate = new Date(Date.UTC(year, monthIdx, day, 0, 0, 0, 0));
        }
      }

      const yearVal = parsedDate.getUTCFullYear();
      const thYear = yearVal + 543;

      let nextSeq = yearDocsMap.get(yearVal) || 1;
      const generatedReceiveNo = `รับที่ ${nextSeq}/${thYear}`;
      yearDocsMap.set(yearVal, nextSeq + 1);

      const createdDoc = await tx.incomingDocument.create({
        data: {
          receiveNo: generatedReceiveNo,
          receiveDate: parsedDate,
          senderOrg: d.senderOrg,
          docRefNo: d.docRefNo || null,
          title: d.title,
          urgencyLevel: "NORMAL",
          amssLink: d.amssLink,
          status: "PENDING",
          createdById: user.id
        }
      });

      existingDocs.push({
        id: createdDoc.id,
        amssLink: d.amssLink || null,
        docRefNo: d.docRefNo || null,
        senderOrg: d.senderOrg
      });

      importedCount++;
    }

    // Write system log
    await tx.systemLog.create({
      data: {
        actionType: "INCOMING_SYNC_HTML",
        description: `ซิงค์รายการหนังสือ AMSS++ (${dateRange}): นำเข้าใหม่ ${importedCount} รายการ, อัปเดต ${updatedCount} รายการ`,
        userId: user.id
      }
    });

    return { importedCount, updatedCount, duplicatesCount };
  });

  safeRevalidatePath("/document");
  return result;
}

export type AMSSPreviewItem = {
  amssLink: string;
  receiveNo: string;
  docRefNo: string;
  title: string;
  senderOrg: string;
  dateText: string;
  isExisting: boolean;
};

export async function fetchAmssPreviewDocs(options: {
  yearFilter?: number; // e.g. 2569 or 2568 (Buddhist year)
  monthFilter?: number; // 1 to 12 (0 = all months)
  maxPages?: number; // default 5
}) {
  const user = await getSessionUser();
  const credentials = await prisma.aMSSCredentials.findUnique({
    where: { userId: user.id }
  });

  if (!credentials || !credentials.url || !credentials.username || !credentials.password) {
    throw new Error("ยังไม่ได้ตั้งค่าข้อมูลบัญชี AMSS++");
  }

  const decryptedPassword = decrypt(credentials.password);
  const parsedUrl = new URL(credentials.url);
  const origin = parsedUrl.origin;

  const cookies = await loginToAMSS(origin, credentials.username, decryptedPassword);
  if (!cookies) {
    throw new Error("เข้าสู่ระบบ AMSS++ ไม่สำเร็จ (อาจถูก Cloudflare/Firewall บล็อก หรือรหัสผ่านไม่ถูกต้อง)");
  }

  const maxPages = options.maxPages || 5;
  const targetYear = options.yearFilter || (new Date().getFullYear() + 543);
  const allParsedDocs: any[] = [];
  const seenAmssLinks = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = `${origin}/index.php?option=book&task=main/receive&select_year=${targetYear}&page=${page}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetchWithTlsFallback(pageUrl, {
        signal: controller.signal,
        headers: { "Cookie": cookies }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        let text = new TextDecoder("utf-8").decode(buffer);
        if (text.includes("เธ") || text.includes("เธช")) {
          text = new TextDecoder("windows-874").decode(buffer);
        }

        const docs = parseAMSSListHtml(text, origin);
        if (docs.length === 0) break;

        for (const doc of docs) {
          if (!seenAmssLinks.has(doc.amssLink)) {
            seenAmssLinks.add(doc.amssLink);

            let include = true;
            let docYearBE: number | null = null;
            let docMonth: number | null = null;

            const parts = doc.dateText.trim().split(/\s+/);
            if (parts.length >= 3) {
              const thaiShortMonthMap: Record<string, number> = {
                "มค": 1, "กพ": 2, "มีค": 3, "เมย": 4, "พค": 5, "มิย": 6,
                "กค": 7, "สค": 8, "กย": 9, "ตค": 10, "พย": 11, "ธค": 12,
                "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
                "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
                "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12
              };
              const mClean = parts[1].replace(/\./g, "").trim();
              docMonth = thaiShortMonthMap[mClean] || null;

              let year = parseInt(parts[2], 10);
              if (!isNaN(year)) {
                if (year < 100) year = year + 2500;
                else if (year < 2400) year = year + 543;
                docYearBE = year;
              }
            }

            if (options.yearFilter && docYearBE && docYearBE !== options.yearFilter) {
              include = false;
            }
            if (options.monthFilter && options.monthFilter > 0 && docMonth && docMonth !== options.monthFilter) {
              include = false;
            }

            if (include) {
              allParsedDocs.push(doc);
            }
          }
        }
      }
    } catch (e) {
      // Continue next page
    }
  }

  // Query DB to mark existing documents
  const amssLinks = allParsedDocs.map(d => d.amssLink).filter(Boolean);
  const refCombos = allParsedDocs
    .filter(d => d.docRefNo && d.docRefNo.trim() !== "")
    .map(d => ({ docRefNo: d.docRefNo, senderOrg: d.senderOrg }));

  const existingDocs = await prisma.incomingDocument.findMany({
    where: {
      OR: [
        { amssLink: { in: amssLinks } },
        ...refCombos
      ]
    },
    select: { amssLink: true, docRefNo: true, senderOrg: true }
  });

  const previewItems: AMSSPreviewItem[] = allParsedDocs.map(d => {
    const isExisting = existingDocs.some(ex => 
      (d.amssLink && ex.amssLink === d.amssLink) ||
      (d.docRefNo && ex.docRefNo === d.docRefNo && ex.senderOrg === d.senderOrg)
    );
    return {
      amssLink: d.amssLink,
      receiveNo: d.receiveNo,
      docRefNo: d.docRefNo,
      title: d.title,
      senderOrg: d.senderOrg,
      dateText: d.dateText,
      isExisting
    };
  });

  return {
    success: true,
    totalFound: previewItems.length,
    newCount: previewItems.filter(i => !i.isExisting).length,
    existingCount: previewItems.filter(i => i.isExisting).length,
    items: previewItems
  };
}

export async function importSelectedAMSSDocuments(selectedItems: AMSSPreviewItem[]) {
  const user = await getSessionUser();
  if (!selectedItems || selectedItems.length === 0) {
    return { importedCount: 0, duplicatesCount: 0 };
  }

  // Filter out existing ones
  const itemsToImport = selectedItems.filter(i => !i.isExisting);
  if (itemsToImport.length === 0) {
    return { importedCount: 0, duplicatesCount: selectedItems.length };
  }

  const result = await prisma.$transaction(async (tx) => {
    let importedCount = 0;

    // Fetch baseline sequence numbers for each represented year
    const yearDocsMap = new Map<number, number>();

    for (const d of itemsToImport) {
      let parsedDate = new Date();
      const parts = d.dateText.trim().split(/\s+/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const thaiShortMonthMap: Record<string, number> = {
          "มค": 0, "กพ": 1, "มีค": 2, "เมย": 3, "พค": 4, "มิย": 5,
          "กค": 6, "สค": 7, "กย": 8, "ตค": 9, "พย": 10, "ธค": 11,
          "มกราคม": 0, "กุมภาพันธ์": 1, "มีนาคม": 2, "เมษายน": 3,
          "พฤษภาคม": 4, "มิถุนายน": 5, "กรกฎาคม": 6, "สิงหาคม": 7,
          "กันยายน": 8, "ตุลาคม": 9, "พฤศจิกายน": 10, "ธันวาคม": 11
        };
        const mClean = parts[1].replace(/\./g, "").trim();
        const monthIdx = thaiShortMonthMap[mClean] !== undefined ? thaiShortMonthMap[mClean] : 0;
        
        let year = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(day)) {
          if (year > 2400) {
            year = year - 543;
          } else if (year < 100) {
            year = year + 2500 - 543;
          }
          parsedDate = new Date(Date.UTC(year, monthIdx, day, 0, 0, 0, 0));
        }
      }

      const yearVal = parsedDate.getUTCFullYear();
      const thYear = yearVal + 543;

      if (!yearDocsMap.has(yearVal)) {
        const startDate = new Date(Date.UTC(yearVal, 0, 1));
        const endDate = new Date(Date.UTC(yearVal + 1, 0, 1));
        const highestDoc = await tx.incomingDocument.findFirst({
          where: {
            receiveDate: {
              gte: startDate,
              lt: endDate,
            },
          },
          orderBy: { createdAt: "desc" },
          select: { receiveNo: true }
        });

        let lastSeq = 0;
        if (highestDoc && highestDoc.receiveNo) {
          const matchSeq = highestDoc.receiveNo.match(/รับที่\s*(\d+)/);
          if (matchSeq) {
            lastSeq = parseInt(matchSeq[1], 10);
          }
        }
        yearDocsMap.set(yearVal, lastSeq + 1);
      }

      let nextSeq = yearDocsMap.get(yearVal) || 1;
      const generatedReceiveNo = `รับที่ ${nextSeq}/${thYear}`;
      yearDocsMap.set(yearVal, nextSeq + 1);

      await tx.incomingDocument.create({
        data: {
          receiveNo: generatedReceiveNo,
          receiveDate: parsedDate,
          senderOrg: d.senderOrg,
          docRefNo: d.docRefNo || null,
          title: d.title,
          urgencyLevel: "NORMAL",
          amssLink: d.amssLink,
          status: "PENDING",
          createdById: user.id
        }
      });

      importedCount++;
    }

    // System Log
    await tx.systemLog.create({
      data: {
        actionType: "INCOMING_IMPORT_SELECTED",
        description: `นำเข้าหนังสือ AMSS++ จากรายการเลือก: ${importedCount} รายการ`,
        userId: user.id
      }
    });

    return { importedCount, duplicatesCount: selectedItems.length - importedCount };
  });

  safeRevalidatePath("/document");
  return result;
}
