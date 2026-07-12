"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { getDocumentDetails, cancelDoc } from "@/app/actions/document";

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

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      .then((d) => {
        if (!d) {
          showToast("ไม่พบเอกสาร", "err");
          router.push("/document");
          return;
        }
        setDoc(d);
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
      await cancelDoc(docId, cancelReason.trim());
      showToast("ยกเลิกเอกสารสำเร็จ");
      setCancelModal(false);
      setCancelReason("");
      // Reload
      const d = await getDocumentDetails(docId);
      setDoc(d);
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
          {doc.status !== "CANCELLED" && (
            <Link
              href={`/document/${docId}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-sm font-semibold transition-colors"
            >
              <Pencil className="w-4 h-4" />
              แก้ไข
            </Link>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-sm font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            พิมพ์
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handleClone}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors"
          >
            <Copy className="w-4 h-4" />
            คัดลอก
          </button>
          {(doc.status === "ISSUED" || doc.status === "PRINTED") && (
            <button
              onClick={() => setCancelModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 text-sm font-semibold transition-colors"
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

      {/* ── A4 Document View ──────────────────────────────────────── */}
      <div className="overflow-x-auto w-full pb-6 flex justify-center">
        <div
          ref={printRef}
          className="print-container w-full max-w-[210mm] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-200 dark:border-slate-700 text-slate-900"
          style={{ padding: "2cm", minHeight: "29.7cm" }}
        >
          {/* Document Header */}
          <div className="text-center mb-8">
            <p className="text-xl font-bold">
              {DOC_TYPE_LABEL[doc.docType] || doc.docType}
            </p>
          </div>

          {/* Document Fields */}
          <div className="space-y-3 mb-8 text-[15px]">
            <div className="flex">
              <span className="font-semibold w-24 shrink-0">ส่วนราชการ</span>
              <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                {doc.origin}
              </span>
            </div>
            <div className="flex">
              <span className="font-semibold w-24 shrink-0">ที่</span>
              <span className="border-b border-dotted border-slate-300 flex-1 pb-1 font-mono">
                {doc.docNo || (
                  <span className="text-slate-400 italic">(ยังไม่ออกเลข)</span>
                )}
              </span>
            </div>
            <div className="flex">
              <span className="font-semibold w-24 shrink-0">วันที่</span>
              <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                {fmtThaiDate(doc.date)}
              </span>
            </div>
            <div className="flex">
              <span className="font-semibold w-24 shrink-0">เรื่อง</span>
              <span className="border-b border-dotted border-slate-300 flex-1 pb-1 font-semibold">
                {doc.title}
              </span>
            </div>
            {doc.enclosures && (
              <div className="flex">
                <span className="font-semibold w-24 shrink-0 text-sm">
                  สิ่งที่ส่งมาด้วย
                </span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1 text-sm">
                  {doc.enclosures}
                </span>
              </div>
            )}
            {doc.references && (
              <div className="flex">
                <span className="font-semibold w-24 shrink-0 text-sm">อ้างถึง</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1 text-sm">
                  {doc.references}
                </span>
              </div>
            )}
          </div>

          {/* To */}
          <div className="mb-6 text-[15px]">
            <span className="font-semibold">เรียน</span> {doc.to}
          </div>

          {/* Content */}
          <div className="mb-10 whitespace-pre-wrap text-[15px] leading-8 indent-16">
            {doc.content}
          </div>

          {/* Signee */}
          <div className="text-center mt-16 pt-8">
            <p className="mb-16">&nbsp;</p>
            <p className="font-semibold text-[15px]">({doc.signeeName})</p>
            <p className="text-sm text-slate-600">{doc.signeePosition}</p>
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
