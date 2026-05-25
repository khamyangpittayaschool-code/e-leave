import { prisma } from "@/lib/db";

/**
 * Send a LINE message using LINE Messaging API (LINE OA).
 * Requires lineChannelAccessToken and lineTargetGroupId from SystemSettings.
 */
export async function sendLineNotify(message: string) {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { lineChannelAccessToken: true, lineTargetGroupId: true },
    });

    const token = settings?.lineChannelAccessToken;
    const targetId = settings?.lineTargetGroupId;
    
    if (!token || !targetId || token.trim() === "" || targetId.trim() === "") {
      // No token or target configured — skip silently
      return;
    }

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: [
          {
            type: "text",
            text: message
          }
        ]
      }),
    });

    if (!res.ok) {
      console.error("[LINE OA] Failed:", res.status, await res.text());
    }
  } catch (error) {
    console.error("[LINE OA] Error:", error);
  }
}

/**
 * Helper to format a leave notification message in Thai.
 */
export function formatLeaveMessage(
  action: "CREATE" | "APPROVE" | "REJECT" | "CANCEL",
  userName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason?: string,
  options?: {
    subjectGroup?: string;
    actorName?: string;
    statusText?: string;
  }
): string {
  const typeMap: Record<string, string> = {
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
  const typeName = typeMap[leaveType] || leaveType;

  const formatThaiDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const fStart = formatThaiDate(startDate);
  const fEnd = formatThaiDate(endDate);
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://your-domain.com");

  if (action === "CREATE") {
    let header = `🔔 มีคำขอลาใหม่!`;
    if (options?.subjectGroup) {
      header += ` (รอหัวหน้างานบุคคลอนุมัติ)`;
    } else {
      header += ` (รอผู้อำนวยการอนุมัติ)`;
    }
    
    return `${header}
------------------
ชื่อ: ${userName}
${options?.subjectGroup ? `กลุ่มสาระฯ: ${options.subjectGroup}\n` : ''}ประเภท: ${typeName}
วันที่ลา: ${fStart} ถึง ${fEnd}
เหตุผล: ${reason || "-"}
------------------
โปรดตรวจสอบในระบบ: ${appUrl}/approvals`;
  } else {
    return `📋 อัปเดตสถานะการลา
------------------
ชื่อ: ${userName}
ประเภท: ${typeName}
วันที่ลา: ${fStart} ถึง ${fEnd}
สถานะ: ${options?.statusText || (action === "APPROVE" ? "✅ อนุมัติเรียบร้อยแล้ว" : action === "REJECT" ? "❌ ปฏิเสธการลา" : "🚫 ยกเลิกการลา")}
ผู้ทำรายการ: ${options?.actorName || "-"}
------------------`;
  }
}
