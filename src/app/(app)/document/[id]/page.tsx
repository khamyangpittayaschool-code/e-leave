"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Printer,
  Download,
  Ban,
  Copy,
  FileText,
  ScrollText,
  Send,
  Check,
  AlertCircle,
  Clock,
  X,
  Pencil,
} from "lucide-react";
import { getDocumentDetails, cancelDoc, saveDocumentAttachment } from "@/app/actions/document";
import { uploadDocumentFile } from "@/app/actions/upload";

// ── Status & DocType maps ───────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: {
    label: "ฉบับร่าง",
    color: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  },
  ISSUED: {
    label: "ออกเลขแล้ว",
    color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  PRINTED: {
    label: "พิมพ์แล้ว",
    color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  CANCELLED: {
    label: "ยกเลิก",
    color: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

const DOC_TYPE_LABEL: Record<string, string> = {
  MEMO: "บันทึกข้อความ",
  COMMAND: "คำสั่ง",
  OUTGOING: "หนังสือส่ง",
};

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════
export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;
  const printRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const isOwner = doc?.createdById === session?.user?.id;
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const canEdit = isOwner || isAdmin;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadDocumentFile(formData);
      if (res.success && res.url) {
        const saveRes = await saveDocumentAttachment(docId, res.url, res.name || file.name);
        if (saveRes.success) {
          showToast("อัปโหลดไฟล์เอกสารแนบสำเร็จแล้ว");
          setDoc((prev: any) => ({
            ...prev,
            attachmentUrl: res.url,
            attachmentName: res.name || file.name,
          }));
        } else {
          showToast(saveRes.error || "เกิดข้อผิดพลาดในการบันทึกเอกสารแนบ", "err");
        }
      } else {
        showToast("อัปโหลดไฟล์ล้มเหลว", "err");
      }
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาดในการอัปโหลด", "err");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async () => {
    if (!confirm("คุณต้องการลบเอกสารแนบจริงนี้หรือไม่?")) return;
    try {
      const saveRes = await saveDocumentAttachment(docId, null, null);
      if (saveRes.success) {
        showToast("ลบเอกสารแนบสำเร็จแล้ว");
        setDoc((prev: any) => ({
          ...prev,
          attachmentUrl: null,
          attachmentName: null,
        }));
      } else {
        showToast(saveRes.error || "ลบไม่สำเร็จ", "err");
      }
    } catch (err: any) {
      showToast(err.message || "ลบไม่สำเร็จ", "err");
    }
  };

  // Cancel modal
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Load document ─────────────────────────────────────────────────
  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    getDocumentDetails(docId)
      .then((res) => {
        if (!res.success) {
          showToast(res.error || "ไม่พบเอกสาร", "err");
          router.push("/document");
          return;
        }
        if (!res.data) {
          showToast("ไม่พบข้อมูลเอกสาร", "err");
          router.push("/document");
          return;
        }
        setDoc(res.data);
      })
      .catch((err) => {
        showToast(err.message || "โหลดไม่สำเร็จ", "err");
      })
      .finally(() => setLoading(false));
  }, [docId, router, showToast]);

  // ── Cancel handler ────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      showToast("กรุณาระบุเหตุผลการยกเลิก", "err");
      return;
    }
    setCancelling(true);
    try {
      const cancelRes = await cancelDoc(docId, cancelReason.trim());
      if (cancelRes.success) {
        showToast("ยกเลิกเอกสารสำเร็จ");
        setCancelModal(false);
        setCancelReason("");
        // Reload
        const dRes = await getDocumentDetails(docId);
        if (dRes.success) {
          setDoc(dRes.data);
        }
      } else {
        showToast(cancelRes.error || "ยกเลิกไม่สำเร็จ", "err");
      }
    } catch (err: any) {
      showToast(err.message || "ยกเลิกไม่สำเร็จ", "err");
    } finally {
      setCancelling(false);
    }
  };

  // ── Print handler ─────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── PDF Download (html2pdf.js loaded dynamically) ─────────────────
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;
      html2pdf()
        .set({
          margin: 0,
          filename: `${doc.docNo || "document"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(printRef.current)
        .save();
    } catch {
      // Fallback: print
      showToast("ไม่สามารถสร้าง PDF ได้ กรุณาใช้ปุ่มพิมพ์แทน", "err");
    }
  };

  // ── Clone handler ─────────────────────────────────────────────────
  const handleClone = () => {
    if (!doc) return;
    const q = new URLSearchParams({
      type: doc.docType,
      clone: docId,
    });
    router.push(`/document/new?${q.toString()}`);
  };

  const fmtThaiDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (loading || !doc) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full"
        />
      </div>
    );
  }

  const st = STATUS_MAP[doc.status] || STATUS_MAP.DRAFT;

  return (
    <div className="space-y-4">
      {/* ── Top Bar (no-print) ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/document")}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              {doc.docNo ? (
                <span className="font-mono">{doc.docNo}</span>
              ) : (
                <span className="text-slate-400 italic text-base">
                  (ยังไม่ออกเลข)
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                {st.label}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {DOC_TYPE_LABEL[doc.docType] || doc.docType}
              {doc.memoSection && ` — ${doc.memoSection.name}`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && doc.status !== "CANCELLED" && (
            <Link
              href={`/document/${docId}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              แก้ไข
            </Link>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-sm font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            พิมพ์
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-sm font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handleClone}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-655 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-all duration-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            คัดลอกเอกสาร
          </button>
          {canEdit && (doc.status === "ISSUED" || doc.status === "PRINTED") && (
            <button
              onClick={() => setCancelModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              ยกเลิกเลข
            </button>
          )}
        </div>
      </div>

      {/* ── Cancelled Banner ──────────────────────────────────────── */}
      {doc.status === "CANCELLED" && doc.cancelReason && (
        <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/20 p-4 flex items-start gap-3 no-print">
          <Ban className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              เอกสารนี้ถูกยกเลิก
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              เหตุผล: {doc.cancelReason}
            </p>
          </div>
        </div>
      )}

      {/* ── Document CSS Styles & Print Overrides ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
        @font-face {
          font-family: 'TH SarabunPSK';
          src: url('https://cdn.jsdelivr.net/npm/thaifonts-sarabun-psk@1.0.0/THSarabun.woff2') format('woff2');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'TH SarabunPSK';
          src: url('https://cdn.jsdelivr.net/npm/thaifonts-sarabun-psk@1.0.0/THSarabun-Bold.woff2') format('woff2');
          font-weight: bold;
          font-style: normal;
        }
        .thai-gov-doc {
          font-family: 'TH SarabunPSK', sans-serif !important;
          line-height: 1.25 !important;
        }
        .text-header-main { font-size: 26pt; font-weight: bold; line-height: 0.6; }
        .text-header-sub { font-size: 17pt; font-weight: bold; line-height: 1.5; } 
        .text-content { font-size: 16pt; line-height: 1.25; }
        .text-header-data { font-size: 16pt !important; font-weight: normal !important; line-height: 1.0 !important; }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; color: black !important; }
          .no-print, header, nav, footer, button, .no-print-section { display: none !important; }
          .print-container {
            width: 210mm !important;
            height: auto !important;
            min-height: 297mm !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 1.5cm 2cm 1.5cm 3cm !important;
            background: white !important;
            color: black !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 9999 !important;
          }
        }
      `}} />

      {/* ── A4 Document View ──────────────────────────────────────── */}
      <div className="overflow-x-auto w-full pb-6 flex flex-col items-center gap-6">
        
        {/* Upload Attachment Card (no-print) */}
        <div className="w-full max-w-[210mm] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm no-print space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-purple-600" />
                เอกสารจริง / ไฟล์แนบเก็บสถิติ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                อัปโหลดเอกสารจริงที่เซ็นอนุมัติแล้วเก็บไว้เป็นประวัติ ค้นหาดูย้อนหลังได้ตลอดเวลา
              </p>
            </div>
            {canEdit && doc.attachmentUrl ? (
              <button
                onClick={handleRemoveAttachment}
                className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 border border-red-200 dark:border-red-900 px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
              >
                ลบเอกสารแนบ
              </button>
            ) : null}
          </div>

          {doc.attachmentUrl ? (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {doc.attachmentName || "ไฟล์เอกสารแนบ.pdf"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    อัปโหลดเก็บในระบบแล้ว
                  </p>
                </div>
              </div>
              <a
                href={doc.attachmentUrl}
                download={doc.attachmentName || "attachment.pdf"}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลดไฟล์
              </a>
            </div>
          ) : canEdit ? (
            <label className="border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-purple-300 dark:hover:border-purple-900 transition bg-slate-50/50 dark:bg-slate-950/20">
              <input
                type="file"
                className="hidden"
                accept="application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-6 h-6 rotate-180" />
                )}
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {uploading ? "กำลังอัปโหลดไฟล์..." : "กดที่นี่เพื่อเลือกไฟล์อัปโหลด"}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                รองรับ PDF, DOCX, และรูปภาพ (ขนาดไม่เกิน 10MB)
              </p>
            </label>
          ) : (
            <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-950/10 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-semibold">
              ไม่มีไฟล์แนบที่อัปโหลดไว้สำหรับเอกสารนี้
            </div>
          )}
        </div>

        {/* Live A4 Sheet Preview */}
        <div
          ref={printRef}
          className="print-container thai-gov-doc w-full max-w-[210mm] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-200 text-black box-border flex flex-col justify-between"
          style={{ 
            padding: "1.5cm 2cm 1.5cm 3cm", 
            minHeight: "297mm",
            width: "210mm"
          }}
        >
          <div>
            {/* Header: Garuda Emblem and 'บันทึกข้อความ' Title */}
            <div className="flex items-center justify-center mb-6 relative">
              <div className="absolute left-0 top-0">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/0/06/Garuda_Emb_of_Thailand.svg" 
                  alt="Garuda Emblem" 
                  className="w-[1.5cm] h-auto object-contain"
                />
              </div>
              <div className="text-center h-[1.5cm] flex items-end justify-center w-full">
                <h1 className="text-header-main tracking-wide font-bold">บันทึกข้อความ</h1>
              </div>
            </div>

            {/* Header Document Fields */}
            <div className="w-full text-header-sub mb-2 space-y-1">
              <div className="grid grid-cols-[max-content_1fr] gap-x-2 items-end">
                <span className="font-bold">ส่วนราชการ</span>
                <span className="border-b border-dotted border-gray-400 text-header-data w-full block pb-1">
                  {doc.origin} {doc.memoSection && ` (${doc.memoSection.name})`}
                </span>
              </div>
              <div className="grid grid-cols-[max-content_1fr_max-content_1fr] gap-x-2 items-end">
                <span className="font-bold">ที่</span>
                <span className="border-b border-dotted border-gray-400 text-header-data w-full block pb-1 font-mono">
                  {doc.docNo || <span className="text-gray-400 italic text-sm">(ยังไม่ออกเลข)</span>}
                </span>
                <span className="font-bold pl-4">วันที่</span>
                <span className="border-b border-dotted border-gray-400 text-header-data w-full block pb-1">
                  {fmtThaiDate(doc.date)}
                </span>
              </div>
              <div className="grid grid-cols-[max-content_1fr] gap-x-2 items-end">
                <span className="font-bold">เรื่อง</span>
                <span className="border-b border-dotted border-gray-400 text-header-data w-full block pb-1 font-bold">
                  {doc.title}
                </span>
              </div>
            </div>

            <div className="border-b border-black mb-4 w-full opacity-50"></div>

            {/* Document Content */}
            <div className="text-content text-justify space-y-4">
              <div className="grid grid-cols-[max-content_1fr] gap-x-2 mb-2 items-end">
                <span className="font-bold">เรียน</span>
                <span>{doc.to}</span>
              </div>
              
              {/* Document Text Body */}
              <div className="indent-[2.5cm] leading-loose break-words whitespace-pre-wrap">
                {doc.content || <span className="text-slate-400 italic text-sm">(ไม่มีเนื้อหาเอกสาร สามารถเพิ่มเนื้อหาโดยการกดปุ่มแก้ไขด้านบน)</span>}
              </div>

              {doc.enclosures && (
                <div className="pl-8">
                  <span className="font-bold">สิ่งที่ส่งมาด้วย: </span> {doc.enclosures}
                </div>
              )}

              {doc.references && (
                <div className="pl-8">
                  <span className="font-bold">อ้างถึง: </span> {doc.references}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Area: Signatures & Verification Comments */}
          <div className="space-y-8 mt-12">
            
            {/* Primary Signee */}
            <div className="flex flex-col items-center ml-auto w-[8cm] text-content" style={{ lineHeight: 0.9 }}>
              <div className="mb-2 w-full text-center">ลงชื่อ............................................................</div>
              <div className="mb-1 font-bold text-center">({doc.signeeName || doc.user?.name || "................................................."})</div>
              <div className="text-slate-600 text-center text-sm">{doc.signeePosition || "ผู้รับผิดชอบกิจกรรม"}</div>
            </div>

            {/* Multi-tier Approval / Comments (Matching mockups) */}
            <div className="flex gap-4 items-start break-inside-avoid mt-8 border-t border-slate-100 pt-6">
              {/* Left Column: Finance Officer Comments */}
              <div className="w-[45%] border border-black p-3 text-sm relative flex flex-col justify-between" style={{ minHeight: "180px" }}>
                <div>
                  <div className="font-bold mb-1 border-b border-black pb-1 text-xs">ความเห็นของเจ้าหน้าที่การเงิน</div>
                  <div className="mb-1 text-xs">ตรวจสอบแล้ว ( &nbsp; ) มี ( &nbsp; ) ไม่มีงบประมาณ</div>
                  <div className="mb-2 text-xs leading-normal">
                    ยอดเงินคงเหลือสะสม ................................... บาท
                  </div>
                </div>
                <div className="flex flex-col items-center w-full mt-4" style={{ lineHeight: 0.9 }}>
                  <div className="mb-2 text-[10px]">ลงชื่อ............................................................</div>
                  <div className="text-xs font-bold">(............................................................)</div>
                  <div className="text-[10px] text-slate-500 mt-1">เจ้าหน้าที่การเงิน</div>
                </div>
              </div>

              {/* Right Column: Executives comments */}
              <div className="w-[55%] flex flex-col gap-6 text-sm pl-4 items-center">
                <div className="flex flex-col items-center w-full" style={{ lineHeight: 0.9 }}>
                  <div className="text-left w-full pl-2 mb-1 font-bold text-xs">ความคิดเห็นของรองผู้อำนวยการ</div>
                  <div className="text-left w-full pl-2 mb-2 text-xs">( &nbsp; ) เห็นควรอนุมัติ &nbsp;&nbsp;&nbsp; ( &nbsp; ) เห็นควรไม่อนุมัติ</div>
                  <div className="mb-2 text-[10px] w-full pl-2">ลงชื่อ............................................................ รองผู้อำนวยการ</div>
                </div>
                
                <div className="flex flex-col items-center w-full border-t border-slate-100 pt-4" style={{ lineHeight: 0.9 }}>
                  <div className="text-left w-full pl-2 mb-1 font-bold text-xs">ความคิดเห็นของผู้อำนวยการ</div>
                  <div className="text-left w-full pl-2 mb-2 text-xs">( &nbsp; ) อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ( &nbsp; ) ไม่อนุมัติ</div>
                  <div className="mb-2 text-[10px] w-full pl-2">ลงชื่อ............................................................ ผู้อำนวยการ</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ── Meta info (no-print) ──────────────────────────────────── */}
      <div className="max-w-[210mm] mx-auto no-print">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>
            สร้างโดย:{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {doc.user?.name || "-"}
            </strong>
          </span>
          <span>
            สร้างเมื่อ:{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {fmtThaiDate(doc.createdAt)}
            </strong>
          </span>
          <span>
            แก้ไขล่าสุด:{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {fmtThaiDate(doc.updatedAt)}
            </strong>
          </span>
          {doc.seqNo && (
            <span>
              ลำดับ:{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {doc.seqNo}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* ── Cancel Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {cancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 no-print"
            onClick={() => setCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ยกเลิกเอกสาร
                  </h3>
                  {doc.docNo && (
                    <p className="text-xs text-slate-500 font-mono">{doc.docNo}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  เหตุผลการยกเลิก
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="เช่น พิมพ์เลขผิด, เอกสารซ้ำ..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {cancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
                </button>
                <button
                  onClick={() => {
                    setCancelModal(false);
                    setCancelReason("");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors"
                >
                  ปิด
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium ${
              toast.type === "ok"
                ? "bg-emerald-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {toast.type === "ok" ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Print Styles ─────────────────────────────────────────── */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 21cm !important;
            min-height: 29.7cm !important;
            padding: 2cm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: none !important;
          }
          nav,
          aside,
          header,
          footer {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
