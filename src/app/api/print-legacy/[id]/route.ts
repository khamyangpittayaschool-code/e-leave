import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Local helper: Calculate leave days excluding weekends (except maternity)
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

// Helper for Thai Date formatting (e.g. 10 มิถุนายน 2569)
function toThaiDateString(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543; // Buddhist year
  
  return `${d} ${m} พ.ศ. ${y}`;
}

// Short Thai Date (e.g. 10 มิ.ย. 2569)
function toThaiDateStringShort(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543;
  
  return `${d} ${m} ${y}`;
}

function getThaiDay(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  return date.getDate().toString();
}

function getThaiMonth(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  return months[date.getMonth()];
}

function getThaiYear(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  return (date.getFullYear() + 543).toString();
}

function getLeaveLabel(type: string): string {
  const map: Record<string, string> = {
    SICK: "ป่วย",
    MATERNITY: "คลอดบุตร",
    PATERNITY: "ช่วยเหลือภริยาคลอดบุตร",
    PERSONAL: "กิจส่วนตัว",
    VACATION: "พักผ่อน",
    MILITARY: "เข้ารับการตรวจเลือกหรือเตรียมพล",
    STUDY: "ศึกษาต่อ ฝึกอบรม หรือดูงาน",
    INTERNATIONAL: "ไปปฏิบัติงานในองค์การระหว่างประเทศ",
    SPOUSE: "ติดตามคู่สมรส",
    REHABILITATION: "ฟื้นฟูสมรรถภาพด้านอาชีพ",
    ORDINATION: "อุปสมบท/ประกอบพิธีฮัจญ์",
  };
  return map[type] || type;
}

function getLeaveTypeName(type: string, isHajj?: boolean): string {
  if (type === "ORDINATION") {
    return isHajj ? "ลาไปประกอบพิธีฮัจญ์" : "ลาอุปสมบท";
  }
  const map: Record<string, string> = {
    SICK: "ลาป่วย",
    MATERNITY: "ลาคลอดบุตร",
    PATERNITY: "ลาช่วยเหลือภริยาคลอดบุตร",
    PERSONAL: "ลากิจส่วนตัว",
    VACATION: "ลาพักผ่อน",
    MILITARY: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล",
    STUDY: "ลาศึกษาต่อ ฝึกอบรม หรือดูงาน",
    INTERNATIONAL: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
    SPOUSE: "ลาติดตามคู่สมรส",
    REHABILITATION: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ",
  };
  return map[type] || type;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Verify token
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const secret = process.env.GOOGLE_DRIVE_SECRET;
  
  if (!secret || token !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

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

  if (!request) {
    return new NextResponse("Request not found", { status: 404 });
  }

  // Get settings
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" }
  });

  // Helper for absolute URLs
  const getAbsoluteUrl = (url: string | null | undefined) => {
    if (!url) return "";
    if (url.startsWith("data:")) return url; // base64 is fine
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const cleanAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    return `${cleanAppUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Find inspector, headApprover, execApprover signatures
  let headApprover = null;
  let execApprover = null;
  let inspector = null;

  if (settings?.defaultInspectorId) {
    inspector = await prisma.user.findUnique({
      where: { id: settings.defaultInspectorId },
      select: { id: true, name: true, signatureUrl: true, position: true }
    });
  }
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
  if (!headApprover) {
    headApprover = await prisma.user.findFirst({
      where: { position: "หัวหน้างานบุคคล", isApproved: true },
      select: { name: true, signatureUrl: true, position: true }
    });
  }

  if (request.execApproverId) {
    execApprover = await prisma.user.findUnique({
      where: { id: request.execApproverId },
      select: { name: true, signatureUrl: true, position: true }
    });
  }

  // Parse extra fields
  const extra = request.extraFields ? JSON.parse(request.extraFields) : {};

  // Fetch approved requests in same fiscal year for stats
  const startDate = request.startDate;
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  let fyStartYear = year;
  if (month < 9) {
    fyStartYear = year - 1;
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

  const activeConfigs = await prisma.leaveConfig.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });

  // Calculate stats
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

  // Find last request of same type
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
      startDate: lastRequest.startDate,
      endDate: lastRequest.endDate,
      days: calculateLeaveDays(lastRequest.startDate, lastRequest.endDate, lastRequest.type),
    };
  }

  const writtenAt = settings?.schoolName || "โรงเรียน";
  const salutation = settings?.schoolName ? `ผู้อำนวยการโรงเรียน${settings.schoolName}` : "ผู้อำนวยการโรงเรียน";
  
  // Format position title for print
  const getExecPositionText = () => {
    if (!execApprover) return "ผู้อำนวยการโรงเรียน";
    const isDeputy = execApprover.position && (execApprover.position.includes("รองผู้อำนวยการ") || execApprover.position.startsWith("รอง"));
    if (isDeputy) {
      return execApprover.position;
    }
    return settings?.schoolName ? `ผู้อำนวยการโรงเรียน${settings.schoolName}` : "ผู้อำนวยการโรงเรียน";
  };

  const isDeputy = execApprover?.position && (execApprover.position.includes("รองผู้อำนวยการ") || execApprover.position.startsWith("รอง"));

  // Build the legacy HTML response
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ใบลา - ${request.user.name}</title>
  <style>
    @page {
      size: A4;
      margin: 1.5cm 1.5cm 1cm 1.5cm;
    }
    body {
      font-family: "Cordia New", "TH Sarabun New", "TH Sarabun PSK", Arial, sans-serif;
      font-size: 15.5pt;
      line-height: 1.25;
      color: #000;
      margin: 0;
      padding: 0;
    }
    .dotted-line {
      border-bottom: 1px dotted #000;
      display: inline-block;
      padding: 0 4px;
      text-align: center;
    }
    .title {
      font-size: 18pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14pt;
    }
    .border-table th, .border-table td {
      border: 1px solid #000;
      padding: 4px;
      text-align: center;
    }
    .box-container {
      border: 1px solid #000;
      padding: 8px;
      font-size: 13.5pt;
      min-height: 220px;
    }
    .box-title {
      font-weight: bold;
      text-decoration: underline;
      margin-bottom: 6px;
    }
    .signature-area {
      position: relative;
      height: 45px;
      margin-top: 5px;
      text-align: center;
    }
    .signature-img {
      max-height: 40px;
      max-width: 130px;
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
    }
  </style>
</head>
<body>

  <!-- Top Request Number -->
  <div style="text-align: right; font-size: 11pt; font-weight: normal; margin-bottom: 5px;">
    ${request.status === "APPROVED" 
      ? `เลขที่อนุมัติ: ${request.approvedSeq || "-"}/${request.fiscalYear || "-"}`
      : `เลขที่คำขอ: ${request.pendingSeq || "-"}/${request.fiscalYear || "-"}`
    }
  </div>

  <div class="title">แบบใบลาออนไลน์</div>

  <!-- Meta write at & date -->
  <div style="text-align: right; margin-bottom: 10px;">
    เขียนที่ <span class="dotted-line" style="width: 180px;">${writtenAt}</span><br>
    วันที่ <span class="dotted-line" style="width: 30px;">${getThaiDay(request.createdAt)}</span>
    เดือน <span class="dotted-line" style="width: 90px;">${getThaiMonth(request.createdAt)}</span>
    พ.ศ. <span class="dotted-line" style="width: 50px;">${getThaiYear(request.createdAt)}</span>
  </div>

  <!-- Subject & Salutation -->
  <div style="margin-bottom: 10px;">
    เรื่อง <span class="dotted-line" style="width: 530px; text-align: left; font-weight: bold;">ขอลา${getLeaveLabel(request.type)}</span><br>
    เรียน <span class="dotted-line" style="width: 530px; text-align: left;">${salutation}</span>
  </div>

  <!-- Body -->
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ข้าพเจ้า <span class="dotted-line" style="width: 200px; font-weight: bold;">${request.user.name}</span>
    ตำแหน่ง <span class="dotted-line" style="width: 170px;">${request.user.position || "ครู"}</span>
    ระดับ <span class="dotted-line" style="width: 80px;">${request.user.level || "-"}</span>
    สังกัด <span class="dotted-line" style="width: 180px;">${settings?.affiliation || request.user.subjectGroup || "ฝ่ายการสอน"}</span>
  </div>

  ${request.type === "VACATION" ? `
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    มีวันลาพักผ่อนสะสม <span class="dotted-line" style="width: 50px; font-weight: bold;">${extra.vacationAccumulated || 0}</span> วันทำการ
    มีสิทธิลาพักผ่อนประจำปีนี้อีก <span class="dotted-line" style="width: 50px; font-weight: bold;">${extra.vacationThisYear || 0}</span> วันทำการ
    รวมเป็น <span class="dotted-line" style="width: 50px; font-weight: bold;">${(Number(extra.vacationAccumulated || 0) + Number(extra.vacationThisYear || 0))}</span> วันทำการ
  </div>
  ` : ""}

  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ขอลา <span class="dotted-line" style="width: 150px; font-weight: bold;">${getLeaveTypeName(request.type, extra.isHajj)}</span>
    เนื่องจาก <span class="dotted-line" style="width: 440px; text-align: left;">${request.reason || "-"}</span>
  </div>

  <!-- Special extra fields blocks -->
  ${request.type === "PATERNITY" ? `
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ไปช่วยเหลือภริยาโดยชอบด้วยกฎหมายชื่อ <span class="dotted-line" style="width: 250px; font-weight: bold;">${extra.wifeName || "-"}</span>
    ซึ่งคลอดบุตรเมื่อวันที่ <span class="dotted-line" style="width: 150px;">${extra.wifeBirthDate ? toThaiDateString(extra.wifeBirthDate) : "-"}</span>
  </div>
  ` : ""}

  ${request.type === "ORDINATION" ? `
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ${extra.isHajj 
      ? `เดินทางไปประกอบพิธีฮัจญ์ ณ เมือง <span class="dotted-line" style="width: 200px;">${extra.templeLocation || "-"}</span>`
      : `จะอุปสมบท ณ วัด <span class="dotted-line" style="width: 180px; font-weight: bold;">${extra.templeName || "-"}</span> ตั้งอยู่ ณ <span class="dotted-line" style="width: 200px;">${extra.templeLocation || "-"}</span>`
    }
  </div>
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ${extra.isHajj
      ? `ตั้งแต่วันที่ <span class="dotted-line" style="width: 150px;">${extra.ordinationDate ? toThaiDateString(extra.ordinationDate) : "-"}</span>`
      : `จำพรรษา ณ วัด <span class="dotted-line" style="width: 180px;">${extra.resideTempleName || "-"}</span> ตั้งอยู่ ณ <span class="dotted-line" style="width: 200px;">${extra.resideTempleLocation || "-"}</span>
         กำหนดอุปสมบทวันที่ <span class="dotted-line" style="width: 150px;">${extra.ordinationDate ? toThaiDateString(extra.ordinationDate) : "-"}</span>`
    }
  </div>
  ` : ""}

  ${request.type === "MILITARY" ? `
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ได้รับหมายเรียกของ <span class="dotted-line" style="width: 180px;">${extra.militaryOrderSource || "-"}</span>
    ที่ <span class="dotted-line" style="width: 120px;">${extra.militaryOrderNo || "-"}</span>
    ลงวันที่ <span class="dotted-line" style="width: 130px;">${extra.militaryOrderDate ? toThaiDateStringShort(extra.militaryOrderDate) : "-"}</span>
  </div>
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ให้เข้ารับการ <span class="dotted-line" style="width: 150px;">${extra.militaryDutyType || "-"}</span>
    ณ <span class="dotted-line" style="width: 200px;">${extra.militaryLocation || "-"}</span>
  </div>
  ` : ""}

  ${request.type === "STUDY" ? `
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ได้รับเงินเดือนเดือนละ <span class="dotted-line" style="width: 100px;">${extra.userSalary || "0"}</span> บาท 
    ไปศึกษาต่อ/ฝึกอบรม ณ ประเทศ <span class="dotted-line" style="width: 150px;">${extra.studyCountry || "-"}</span>
    ด้วยทุน <span class="dotted-line" style="width: 150px;">${extra.scholarshipName || "-"}</span>
  </div>
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    มีกำหนดเวลา <span class="dotted-line" style="width: 50px;">${extra.studyDurationYears || "0"}</span> ปี 
    <span class="dotted-line" style="width: 50px;">${extra.studyDurationMonths || "0"}</span> เดือน 
    <span class="dotted-line" style="width: 50px;">${extra.studyDurationDays || "0"}</span> วัน
  </div>
  ` : ""}

  <!-- Date period of leave -->
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ตั้งแต่วันที่ <span class="dotted-line" style="width: 30px; font-weight: bold;">${getThaiDay(request.startDate)}</span>
    เดือน <span class="dotted-line" style="width: 90px; font-weight: bold;">${getThaiMonth(request.startDate)}</span>
    พ.ศ. <span class="dotted-line" style="width: 50px; font-weight: bold;">${getThaiYear(request.startDate)}</span>
    ถึงวันที่ <span class="dotted-line" style="width: 30px; font-weight: bold;">${getThaiDay(request.endDate)}</span>
    เดือน <span class="dotted-line" style="width: 90px; font-weight: bold;">${getThaiMonth(request.endDate)}</span>
    พ.ศ. <span class="dotted-line" style="width: 50px; font-weight: bold;">${getThaiYear(request.endDate)}</span>
    มีกำหนด <span class="dotted-line" style="width: 50px; font-weight: bold;">${request.days}</span> วันทำการ
  </div>

  <!-- Last leave stats -->
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 8px;">
    ข้าพเจ้าได้ลา <span class="dotted-line" style="width: 150px;">${lastLeaveInfo ? getLeaveTypeName(request.type, extra.isHajj) : "-"}</span> ครั้งสุดท้าย
    ตั้งแต่วันที่ <span class="dotted-line" style="width: 30px;">${lastLeaveInfo ? getThaiDay(lastLeaveInfo.startDate) : "-"}</span>
    เดือน <span class="dotted-line" style="width: 90px;">${lastLeaveInfo ? getThaiMonth(lastLeaveInfo.startDate) : "-"}</span>
    พ.ศ. <span class="dotted-line" style="width: 50px;">${lastLeaveInfo ? getThaiYear(lastLeaveInfo.startDate) : "-"}</span>
    ถึงวันที่ <span class="dotted-line" style="width: 30px;">${lastLeaveInfo ? getThaiDay(lastLeaveInfo.endDate) : "-"}</span>
    เดือน <span class="dotted-line" style="width: 90px;">${lastLeaveInfo ? getThaiMonth(lastLeaveInfo.endDate) : "-"}</span>
    พ.ศ. <span class="dotted-line" style="width: 50px;">${lastLeaveInfo ? getThaiYear(lastLeaveInfo.endDate) : "-"}</span>
    มีกำหนด <span class="dotted-line" style="width: 50px;">${lastLeaveInfo ? lastLeaveInfo.days : "-"}</span> วันทำการ
  </div>

  <!-- Address & Contact -->
  <div style="text-indent: 2.5em; text-align: justify; margin-bottom: 10px;">
    ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ <span class="dotted-line" style="width: 300px; font-weight: bold;">${extra.contactAddress || request.user.address || "-"}</span>
    เบอร์โทรศัพท์ <span class="dotted-line" style="width: 150px; font-weight: bold;">${extra.phoneNumber || request.user.phoneNumber || "-"}</span>
  </div>

  <!-- Applicant signature -->
  <table style="width: 100%; margin-top: 15px; margin-bottom: 15px; border: none;">
    <tr>
      <td style="width: 55%; border: none;"></td>
      <td style="width: 45%; border: none; text-align: center;">
        ขอแสดงความนับถือ<br>
        <div class="signature-area">
          (ลงชื่อ) ........................................ ผู้ลา
          ${request.user.signatureUrl ? `
            <img class="signature-img" src="${getAbsoluteUrl(request.user.signatureUrl)}" alt="Signature">
          ` : ""}
        </div>
        ( <span style="font-weight: bold;">${request.user.name}</span> )
      </td>
    </tr>
  </table>

  <hr style="border: 0.5px solid #ccc; margin: 10px 0;">

  <!-- Bottom approvals & stats layout -->
  <table style="width: 100%; border: none; margin-top: 5px;">
    <tr>
      <!-- Left Column: Stats Table & Inspector -->
      <td style="width: 50%; vertical-align: top; padding-right: 15px; border: none;">
        
        <div style="font-weight: bold; font-size: 11pt; margin-bottom: 4px; text-align: center;">สถิติการลาในภาคเรียน/ปีงบประมาณนี้</div>
        <table class="border-table" style="margin-bottom: 10px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="width: 40%;">ประเภทการลา</th>
              <th style="width: 20%;">ลามาแล้ว</th>
              <th style="width: 20%;">ลาครั้งนี้</th>
              <th style="width: 20%;">รวม</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(stats).map(key => {
              const val = stats[key];
              return `
                <tr>
                  <td style="text-align: left; font-weight: bold;">${val.name}</td>
                  <td>${val.prev > 0 ? `${val.prev} วัน` : "-"}</td>
                  <td>${val.current > 0 ? `${val.current} วัน` : "-"}</td>
                  <td style="font-weight: bold;">${val.total > 0 ? `${val.total} วัน` : "-"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- Inspector Signature block -->
        <div style="text-align: center; margin-top: 10px; font-size: 13pt;">
          <div class="signature-area">
            (ลงชื่อ) ........................................ ผู้ตรวจสอบ
            ${inspector?.signatureUrl ? `
              <img class="signature-img" src="${getAbsoluteUrl(inspector.signatureUrl)}" alt="Signature">
            ` : ""}
          </div>
          <div>( ${inspector ? inspector.name : "..................................................."} )</div>
          <div style="font-size: 11pt; color: #555;">ตำแหน่ง ${inspector?.position === "ผู้ตรวจสอบ" ? "ครู" : (inspector?.position || "หัวหน้างานบุคคล")}</div>
          <div style="font-size: 11pt; color: #555;">วันที่ ${request.createdAt ? toThaiDateString(request.createdAt) : "........./........../.........."}</div>
        </div>

      </td>

      <!-- Right Column: Opinion & Decision -->
      <td style="width: 50%; vertical-align: top; padding-left: 15px; border-left: 1px solid #ccc;">
        
        <!-- Opinion Box -->
        <div class="box-container" style="margin-bottom: 12px;">
          <div class="box-title">ความเห็นของผู้บังคับบัญชา</div>
          <div style="min-height: 40px; margin-top: 5px;">
            ${request.status === "REJECTED" && !request.execApproverId ? `
              <span style="color: #ef4444; font-weight: bold;">❌ ไม่อนุมัติ เนื่องจาก ${request.rejectReason}</span>
            ` : `
              ${request.status === "PENDING_EXEC" || request.status === "APPROVED" || (request.status === "REJECTED" && request.execApproverId) ? `
                <span style="color: #10b981; font-weight: bold;">✓ เห็นควรเสนอผู้อำนวยการเพื่อพิจารณาอนุญาต</span>
              ` : "..................................................................................."}
            `}
          </div>

          <!-- HR Head Signature -->
          <div style="text-align: center; margin-top: 15px;">
            <div class="signature-area">
              (ลงชื่อ) ........................................
              ${headApprover?.signatureUrl && request.status !== "PENDING_HEAD" ? `
                <img class="signature-img" src="${getAbsoluteUrl(headApprover.signatureUrl)}" alt="Signature">
              ` : ""}
            </div>
            <div>( ${headApprover ? headApprover.name : "..................................................."} )</div>
            <div style="font-size: 11pt; color: #555;">ตำแหน่ง ${headApprover?.position || "หัวหน้างานบุคคล"}</div>
            <div style="font-size: 11pt; color: #555;">วันที่ ${request.headApproverId ? toThaiDateString(request.updatedAt) : "........./........../.........."}</div>
          </div>
        </div>

        <!-- Decision Box -->
        <div class="box-container">
          <div class="box-title">คำสั่ง / การพิจารณาอนุมัติ</div>
          <div style="min-height: 40px; margin-top: 5px;">
            ${request.status === "APPROVED" ? `
              <span style="color: #10b981; font-weight: bold;">✓ อนุญาต</span>
            ` : `
              ${request.status === "REJECTED" && request.execApproverId ? `
                <span style="color: #ef4444; font-weight: bold;">❌ ไม่อนุมัติ เนื่องจาก ${request.rejectReason}</span>
              ` : `
                <div style="margin-bottom: 3px;">[ ] อนุญาต &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ ] ไม่อนุมัติ เนื่องจาก....................</div>
              `}
            `}
          </div>

          <!-- Exec / Director Signature -->
          <div style="text-align: center; margin-top: 15px;">
            <div class="signature-area">
              (ลงชื่อ) ........................................
              ${execApprover?.signatureUrl && request.status === "APPROVED" ? `
                <img class="signature-img" src="${getAbsoluteUrl(execApprover.signatureUrl)}" alt="Signature">
              ` : ""}
            </div>
            <div>( ${execApprover ? execApprover.name : "..................................................."} )</div>
            <div style="font-size: 11pt; color: #555;">
              ตำแหน่ง ${getExecPositionText()}
            </div>
            ${execApprover && isDeputy && settings?.showActingDirectorTitle !== false ? `
              <div style="font-size: 11pt; color: #555;">${settings?.actingDirectorTitle || "รักษาการในตำแหน่งผู้อำนวยการโรงเรียน"}</div>
            ` : ""}
            <div style="font-size: 11pt; color: #555;">วันที่ ${request.execApproverId && request.status === "APPROVED" ? toThaiDateString(request.updatedAt) : "........./........../.........."}</div>
          </div>
        </div>

      </td>
    </tr>
  </table>

</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}
