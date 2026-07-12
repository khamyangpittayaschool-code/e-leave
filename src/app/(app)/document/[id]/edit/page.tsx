"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ArrowLeft,
  Check,
  Save,
  Sparkles,
  UserCheck,
  Eye,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import { getSigneePresets, getMemoSections } from "@/app/actions/document-settings";
import { saveDocDraft, getDocumentDetails } from "@/app/actions/document";
import { formatDocNumber } from "@/lib/document-utils";

type SigneePreset = { id: string; name: string; position: string; isCommon: boolean };
type MemoSection = { id: string; name: string; code: string; isActive: boolean };

function fmtThaiDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function DocumentEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<SigneePreset[]>([]);
  const [sections, setSections] = useState<MemoSection[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [form, setForm] = useState({
    docType: "MEMO",
    memoSectionId: "",
    title: "",
    to: "",
    origin: "",
    date: "",
    content: "",
    signeeName: "",
    signeePosition: "",
    enclosures: "",
    references: "",
    docNo: ""
  });

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [doc, signeesList, secs] = await Promise.all([
        getDocumentDetails(id),
        getSigneePresets(),
        getMemoSections()
      ]);

      if (!doc) {
        showToast("ไม่พบเอกสารที่ระบุ", "err");
        router.push("/document");
        return;
      }

      setPresets(signeesList as SigneePreset[]);
      setSections(secs as MemoSection[]);

      setForm({
        docType: doc.docType,
        memoSectionId: doc.memoSectionId || "",
        title: doc.title,
        to: doc.to,
        origin: doc.origin,
        date: doc.date ? new Date(doc.date).toISOString().split("T")[0] : "",
        content: doc.content || "",
        signeeName: doc.signeeName || "",
        signeePosition: doc.signeePosition || "",
        enclosures: doc.enclosures || "",
        references: doc.references || "",
        docNo: doc.docNo || ""
      });
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล", "err");
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveDocDraft({
        id,
        docType: form.docType,
        memoSectionId: form.docType === "MEMO" ? form.memoSectionId : undefined,
        title: form.title.trim(),
        to: form.to.trim(),
        origin: form.origin.trim(),
        date: form.date,
        content: form.content.trim(),
        signeeName: form.signeeName.trim(),
        signeePosition: form.signeePosition.trim(),
        enclosures: form.enclosures.trim() || undefined,
        references: form.references.trim() || undefined
      });
      showToast("บันทึกการแก้ไขสำเร็จ!");
      router.push(`/document/${id}`);
    } catch (err: any) {
      showToast(err.message || "บันทึกข้อมูลล้มเหลว", "err");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/document/${id}`}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-500" />
              แก้ไขรายละเอียดเอกสาร
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {form.docNo ? `หมายเลขเอกสาร: ${form.docNo}` : "ฉบับร่าง"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Edit Form */}
        <form onSubmit={handleSave} className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">
              ส่วนหัวข้อและรายละเอียด
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  เรื่อง *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  วันที่เอกสาร *
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  ส่วนราชการ / ฝ่าย / จาก *
                </label>
                <input
                  type="text"
                  required
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  เรียน / ถึง *
                </label>
                <input
                  type="text"
                  required
                  value={form.to}
                  onChange={(e) => setForm({ ...form, to: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  สิ่งที่ส่งมาด้วย (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={form.enclosures}
                  onChange={(e) => setForm({ ...form, enclosures: e.target.value })}
                  placeholder="เช่น กำหนดการจัดงาน จำนวน 1 ฉบับ"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  อ้างถึง (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={form.references}
                  onChange={(e) => setForm({ ...form, references: e.target.value })}
                  placeholder="เช่น หนังสือเลขที่ ศธ 04002/..."
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                เนื้อหาหนังสือ *
              </label>
              <textarea
                required
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="ระบุเนื้อหาเอกสารราชการโดยละเอียด..."
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm leading-relaxed"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-500" />
              ข้อมูลผู้ลงนาม
            </h3>

            {/* Presets Grid */}
            {presets.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  เลือกจากรายชื่อที่ใช้บ่อย
                </span>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, signeeName: p.name, signeePosition: p.position })}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300 font-semibold transition"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  ชื่อผู้ลงนาม *
                </label>
                <input
                  type="text"
                  required
                  value={form.signeeName}
                  onChange={(e) => setForm({ ...form, signeeName: e.target.value })}
                  placeholder="เช่น นายประหยัด จันทร์สว่าง"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                  ตำแหน่งผู้ลงนาม *
                </label>
                <input
                  type="text"
                  required
                  value={form.signeePosition}
                  onChange={(e) => setForm({ ...form, signeePosition: e.target.value })}
                  placeholder="เช่น ผู้อำนวยการโรงเรียน"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50 transition shadow-lg shadow-purple-500/20"
            >
              <Save className="w-4 h-4" />
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
            <Link
              href={`/document/${id}`}
              className="px-6 h-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-350 font-bold transition"
            >
              ยกเลิก
            </Link>
          </div>
        </form>

        {/* Right: Live A4 Preview */}
        <div className="lg:col-span-5 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 lg:sticky lg:top-24 lg:h-[calc(100vh-150px)] overflow-y-auto flex justify-center p-6">
          <div className="w-full max-w-[595px] bg-white rounded-lg shadow-lg p-8 text-slate-900 text-sm leading-relaxed h-fit min-h-[842px]">
            {/* A4 Header */}
            <div className="text-center mb-6">
              <p className="text-lg font-bold">
                {form.docType === "MEMO"
                  ? "บันทึกข้อความ"
                  : form.docType === "COMMAND"
                  ? "คำสั่ง"
                  : "หนังสือส่ง"}
              </p>
            </div>

            {/* Document Fields */}
            <div className="space-y-2 mb-6">
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">ส่วนราชการ</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                  {form.origin || (
                    <span className="text-slate-300 italic">---</span>
                  )}
                </span>
              </div>
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">ที่</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                  {form.docNo ? (
                    <span className="font-bold">{form.docNo}</span>
                  ) : (
                    <span className="text-slate-400 italic text-xs">
                      (รอออกเลข)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">วันที่</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                  {form.date ? fmtThaiDate(form.date) : (
                    <span className="text-slate-300 italic">---</span>
                  )}
                </span>
              </div>
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">เรื่อง</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1 font-semibold">
                  {form.title || (
                    <span className="text-slate-300 italic font-normal">---</span>
                  )}
                </span>
              </div>
              {form.enclosures && (
                <div className="flex">
                  <span className="font-semibold w-20 shrink-0 text-xs">สิ่งที่ส่งมาด้วย</span>
                  <span className="border-b border-dotted border-slate-300 flex-1 pb-1 text-xs">
                    {form.enclosures}
                  </span>
                </div>
              )}
              {form.references && (
                <div className="flex">
                  <span className="font-semibold w-20 shrink-0 text-xs">อ้างถึง</span>
                  <span className="border-b border-dotted border-slate-300 flex-1 pb-1 text-xs">
                    {form.references}
                  </span>
                </div>
              )}
            </div>

            {/* To */}
            <div className="mb-4">
              <span className="font-semibold">เรียน</span>{" "}
              {form.to || (
                <span className="text-slate-300 italic">---</span>
              )}
            </div>

            {/* Content */}
            <div className="mb-8 whitespace-pre-wrap text-sm leading-7 indent-16">
              {form.content || (
                <span className="text-slate-300 italic">
                  (เนื้อหาเอกสารจะแสดงที่นี่)
                </span>
              )}
            </div>

            {/* Signee */}
            <div className="text-center mt-12 pt-8">
              {form.signeeName ? (
                <>
                  <p className="mb-12">&nbsp;</p>
                  <p className="font-semibold">
                    ({form.signeeName})
                  </p>
                  <p className="text-xs text-slate-600">
                    {form.signeePosition}
                  </p>
                </>
              ) : (
                <p className="text-slate-300 italic text-xs">
                  (ผู้ลงนาม)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
