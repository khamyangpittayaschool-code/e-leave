"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRepairDetailAction } from "@/app/actions/repair/update";
import { getRepairPhotosAction } from "@/app/actions/repair/photo";
import { getSystemSettings } from "@/app/actions/settings";
import { Printer, ArrowLeft, Loader2, XCircle } from "lucide-react";
import Image from "next/image";

// Helper for Thai Date formatting (e.g. 22 กรกฎาคม พ.ศ. 2569)
function toThaiDateString(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543;

  return `${d} ${m} พ.ศ. ${y}`;
}

function toThaiDateTimeString(dateInput: string | Date | null | undefined) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";
  const dateStr = toThaiDateString(dateInput);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dateStr} เวลา ${hours}:${minutes} น.`;
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: "ระบบไฟฟ้า",
  PLUMBING: "ระบบประปา",
  BUILDING: "อาคาร/โครงสร้าง",
  IT: "อุปกรณ์ IT/คอมพิวเตอร์",
  EQUIPMENT: "ครุภัณฑ์/เฟอร์นิเจอร์",
  OTHER: "อื่น ๆ",
};

const URGENCY_LABELS: Record<string, string> = {
  NORMAL: "ปกติ",
  URGENT: "เร่งด่วน",
  URGENT_MOST: "เร่งด่วนมาก",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอดำเนินการ",
  ASSIGNED: "มอบหมายช่างแล้ว",
  IN_PROGRESS: "กำลังดำเนินการซ่อม",
  COMPLETED: "ซ่อมเสร็จสิ้น",
  CANCELLED: "ยกเลิกคำขอ",
};

import { getAssignableTechniciansAction } from "@/app/actions/repair/user";

export default function PrintRepairPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repair, setRepair] = useState<any>(null);
  const [photos, setPhotos] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [headUser, setHeadUser] = useState<any>(null);
  const [approvalMode, setApprovalMode] = useState<string>("AUTO_ON_COMPLETE");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [repairRes, photoRes, systemSettings, techRes] = await Promise.all([
          getRepairDetailAction(id),
          getRepairPhotosAction(id).catch(() => null),
          getSystemSettings().catch(() => null),
          getAssignableTechniciansAction().catch(() => null),
        ]);

        if (!repairRes.success || !repairRes.repair) {
          throw new Error(repairRes.error || "ไม่พบข้อมูลรายการแจ้งซ่อม");
        }

        setRepair(repairRes.repair);
        setPhotos(photoRes);
        setSettings(systemSettings);

        if (systemSettings?.rolePermissions) {
          try {
            const parsed = JSON.parse(systemSettings.rolePermissions);
            if (parsed.repairApprovalMode) setApprovalMode(parsed.repairApprovalMode);
            if (parsed.headGeneralAdminId && techRes?.technicians) {
              const head = techRes.technicians.find((t: any) => t.id === parsed.headGeneralAdminId);
              if (head) setHeadUser(head);
            }
          } catch (e) {
            console.error("Failed to parse settings rolePermissions", e);
          }
        }
      } catch (err: any) {
        setError(err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");
      } finally {
        setLoading(false);
      }
    }

    if (id) loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-sm font-medium">กำลังเตรียมแบบพิมพ์ใบแจ้งซ่อม...</p>
      </div>
    );
  }

  if (error || !repair) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-700 p-4 gap-3">
        <XCircle className="w-10 h-10 text-red-500" />
        <p className="text-base font-bold">{error || "ไม่พบข้อมูล"}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-bold transition-colors"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const schoolName = settings?.schoolName || "โรงเรียนกุฉินารายณ์";
  const logoUrl = settings?.logoUrl;

  const beforePhotos = photos?.BEFORE || [];
  const afterPhotos = photos?.AFTER || [];
  const hasPhotos = beforePhotos.length > 0 || afterPhotos.length > 0;

  // Determine if Head signature should be displayed
  const isCompleted = repair.status === "COMPLETED";
  const showHeadSignature = (approvalMode === "AUTO_ON_COMPLETE" && isCompleted) || Boolean(repair.approvedAt);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 font-sans print:p-0 print:bg-white text-slate-900">
      {/* CSS Print Styles for strict 1-page A4 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          html, body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          .print:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Action Toolbar (Hidden during print) */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          ย้อนกลับ
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          พิมพ์เอกสาร (1 หน้า A4)
        </button>
      </div>

      {/* A4 Document Printable Sheet */}
      <div className="print-container max-w-[210mm] mx-auto bg-white p-[10mm] shadow-xl border border-slate-200 text-[11pt] leading-tight text-black font-sans">
        {/* Header */}
        <div className="flex flex-col items-center text-center pb-2 border-b-2 border-black space-y-0.5">
          {logoUrl && (
            <div className="relative w-12 h-12 mb-0.5">
              <Image src={logoUrl} alt="Logo" fill className="object-contain" />
            </div>
          )}
          <h1 className="text-[14pt] font-bold tracking-wide">{schoolName}</h1>
          <h2 className="text-[12pt] font-bold">แบบบันทึกคำขอแจ้งซ่อมแซมวัสดุ / ครุภัณฑ์ / อาคารสถานที่</h2>
          <p className="text-[10pt] font-semibold text-slate-700">
            เลขที่คำขอ: <span className="font-mono">{repair.repairNo}</span>
          </p>
        </div>

        {/* Section 1: Request Metadata */}
        <div className="mt-3 space-y-2 text-[10pt]">
          <div className="flex justify-between items-center border-b border-slate-200 pb-1 font-semibold">
            <div><span>วันที่แจ้งคำขอ:</span> {toThaiDateTimeString(repair.createdAt)}</div>
            <div><span>ความเร่งด่วน:</span> {URGENCY_LABELS[repair.urgency] || repair.urgency}</div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span className="font-bold">ผู้แจ้งคำขอ:</span> {repair.requester?.name || "-"}</div>
            <div><span className="font-bold">ตำแหน่ง:</span> {repair.requester?.position || "บุคลากร"}</div>
            <div><span className="font-bold">หมวดหมู่งานซ่อม:</span> {CATEGORY_LABELS[repair.category] || repair.category}</div>
            <div><span className="font-bold">สถานที่ / ห้องที่แจ้ง:</span> {repair.location}</div>
          </div>

          <div>
            <span className="font-bold">หัวข้อการแจ้งซ่อม: </span>
            <span className="font-semibold text-slate-900">{repair.title}</span>
          </div>

          <div>
            <span className="font-bold">รายละเอียดปัญหา / อาการชำรุด: </span>
            <span className="text-slate-800">{repair.description || "ไม่ระบุรายละเอียดเพิ่มเติม"}</span>
          </div>
        </div>

        {/* Section 2: Repair Execution Status */}
        <div className="mt-3 pt-2 border-t-2 border-dashed border-slate-300 space-y-2 text-[10pt]">
          <h3 className="font-bold text-[10.5pt] text-slate-900 uppercase">บันทึกผลการดำเนินงานซ่อมแซม</h3>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div><span className="font-bold">สถานะการซ่อม:</span> {STATUS_LABELS[repair.status] || repair.status}</div>
            <div><span className="font-bold">ช่างผู้รับผิดชอบ:</span> {repair.assignee?.name || "ยังไม่ได้มอบหมาย"}</div>
            <div><span className="font-bold">วันที่มอบหมาย:</span> {toThaiDateString(repair.assignedAt)}</div>
            <div><span className="font-bold">วันที่ซ่อมเสร็จ:</span> {toThaiDateString(repair.finishedAt)}</div>
          </div>

          <div>
            <span className="font-bold">สรุปผลการซ่อม / บันทึกการแก้ไข: </span>
            <span className="text-slate-800">{repair.resolutionNote || (repair.status === "COMPLETED" ? "ดำเนินการซ่อมแซมเรียบร้อยแล้ว" : "อยู่ระหว่างดำเนินการ")}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><span className="font-bold">วัสดุ/อุปกรณ์ที่ใช้:</span> {repair.materialsUsed || "-"}</div>
            <div><span className="font-bold">ค่าใช้จ่ายรวม:</span> {repair.cost != null ? `${Number(repair.cost).toLocaleString("th-TH")} บาท` : "-"}</div>
          </div>
        </div>

        {/* Section 3: BEFORE & AFTER Photos (Compact fit) */}
        {hasPhotos && (
          <div className="mt-3 pt-2 border-t border-slate-200 space-y-1.5">
            <h3 className="font-bold text-[10pt] text-slate-800 uppercase">รูปภาพประกอบงานซ่อม</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[9pt] font-bold text-slate-700 mb-0.5">รูปตอนแจ้งซ่อม / ก่อนซ่อม (BEFORE)</p>
                {beforePhotos.length > 0 ? (
                  <div className="relative w-full h-28 border border-slate-300 rounded overflow-hidden bg-slate-50">
                    <Image src={beforePhotos[0].url} alt="Before Photo" fill className="object-contain" />
                  </div>
                ) : (
                  <div className="h-28 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9pt] text-slate-400">
                    ไม่มีรูปก่อนซ่อม
                  </div>
                )}
              </div>

              <div>
                <p className="text-[9pt] font-bold text-slate-700 mb-0.5">รูปหลังซ่อม (AFTER)</p>
                {afterPhotos.length > 0 ? (
                  <div className="relative w-full h-28 border border-slate-300 rounded overflow-hidden bg-slate-50">
                    <Image src={afterPhotos[0].url} alt="After Photo" fill className="object-contain" />
                  </div>
                ) : (
                  <div className="h-28 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9pt] text-slate-400">
                    ไม่มีรูปหลังซ่อม
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 4: 3-Column Signatures with Scanned Signatures */}
        <div className="mt-6 pt-4 border-t-2 border-black text-[9.5pt]">
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Signature 1: Requester */}
            <div className="space-y-2 flex flex-col justify-between items-center">
              <div>
                <p className="font-bold mb-1">ลงชื่อ...................................................ผู้แจ้ง</p>
                {repair.requester?.signatureUrl ? (
                  <div className="h-10 my-1 flex items-center justify-center">
                    <img src={repair.requester.signatureUrl} alt="ลายเซ็นผู้แจ้ง" className="max-h-10 max-w-[140px] object-contain" />
                  </div>
                ) : (
                  <div className="h-10 my-1" />
                )}
                <p>({repair.requester?.name || "................................................."})</p>
                <p className="text-[8.5pt] text-slate-600 mt-0.5">ตำแหน่ง {repair.requester?.position || "บุคลากร"}</p>
              </div>
              <p className="text-[9pt]">วันที่ {toThaiDateString(repair.createdAt)}</p>
            </div>

            {/* Signature 2: Repairer / Technician */}
            <div className="space-y-2 flex flex-col justify-between items-center">
              <div>
                <p className="font-bold mb-1">ลงชื่อ...................................................ผู้ซ่อม</p>
                {repair.assignee?.signatureUrl ? (
                  <div className="h-10 my-1 flex items-center justify-center">
                    <img src={repair.assignee.signatureUrl} alt="ลายเซ็นผู้ซ่อม" className="max-h-10 max-w-[140px] object-contain" />
                  </div>
                ) : (
                  <div className="h-10 my-1" />
                )}
                <p>({repair.assignee?.name || "................................................."})</p>
                <p className="text-[8.5pt] text-slate-600 mt-0.5">ตำแหน่ง {repair.assignee?.position || "เจ้าหน้าที่ช่าง/ผู้รับผิดชอบ"}</p>
              </div>
              <p className="text-[9pt]">วันที่ {toThaiDateString(repair.finishedAt || repair.assignedAt)}</p>
            </div>

            {/* Signature 3: Head of Admin / Director */}
            <div className="space-y-2 flex flex-col justify-between items-center">
              <div>
                <p className="font-bold mb-1">ลงชื่อ...................................................ผู้อนุมัติ</p>
                {showHeadSignature && headUser?.signatureUrl ? (
                  <div className="h-10 my-1 flex items-center justify-center">
                    <img src={headUser.signatureUrl} alt="ลายเซ็นผู้อนุมัติ" className="max-h-10 max-w-[140px] object-contain" />
                  </div>
                ) : (
                  <div className="h-10 my-1" />
                )}
                <p>({showHeadSignature ? (headUser?.name || ".................................................") : "................................................."})</p>
                <p className="text-[8.5pt] text-slate-600 mt-0.5">ตำแหน่ง {headUser?.position || "หัวหน้าฝ่ายบริหารทั่วไป / ผู้อำนวยการ"}</p>
              </div>
              <p className="text-[9pt]">วันที่ {showHeadSignature ? toThaiDateString(repair.finishedAt || repair.updatedAt) : "......... / ......... / ........."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
