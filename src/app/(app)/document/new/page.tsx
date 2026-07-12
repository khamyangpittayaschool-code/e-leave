"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ScrollText,
  Send,
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  Sparkles,
  UserCheck,
  Eye,
  AlertCircle,
  ChevronRight,
  Zap,
} from "lucide-react";
import { getMemoSections, getSigneePresets } from "@/app/actions/document-settings";
import { saveDocDraft, issueDocNumber } from "@/app/actions/document";
import { formatDocNumber } from "@/lib/document-utils";

// ── Types ────────────────────────────────────────────────────────────
type FormData = {
  id?: string;
  docType: string;
  memoSectionId: string;
  title: string;
  to: string;
  origin: string;
  date: string;
  content: string;
  signeeName: string;
  signeePosition: string;
  enclosures: string;
  references: string;
};

type MemoSection = { id: string; name: string; code: string; isActive: boolean };
type SigneePreset = { id: string; name: string; position: string; isCommon: boolean };

const STEPS = [
  { label: "ประเภท", icon: FileText },
  { label: "รายละเอียด", icon: Sparkles },
  { label: "ผู้ลงนาม", icon: UserCheck },
  { label: "ตรวจสอบ & ออกเลข", icon: Check },
];

const DOC_TYPES = [
  {
    key: "MEMO",
    label: "บันทึกข้อความ",
    desc: "เอกสารภายในองค์กร",
    icon: FileText,
    gradient: "from-blue-500 to-blue-600",
    shadow: "shadow-blue-500/20",
  },
  {
    key: "COMMAND",
    label: "คำสั่ง",
    desc: "คำสั่งภายในองค์กร",
    icon: ScrollText,
    gradient: "from-amber-500 to-orange-500",
    shadow: "shadow-amber-500/20",
  },
  {
    key: "OUTGOING",
    label: "หนังสือส่ง",
    desc: "หนังสือส่งภายนอก",
    icon: Send,
    gradient: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/20",
  },
];

// ══════════════════════════════════════════════════════════════════════
// INNER COMPONENT (uses useSearchParams)
// ══════════════════════════════════════════════════════════════════════
function DocumentNewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "MEMO";

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    docType: initialType,
    memoSectionId: "",
    title: "",
    to: "",
    origin: "",
    date: new Date().toISOString().split("T")[0],
    content: "",
    signeeName: "",
    signeePosition: "",
    enclosures: "",
    references: "",
  });

  const [sections, setSections] = useState<MemoSection[]>([]);
  const [signees, setSignees] = useState<SigneePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [issuedDocNo, setIssuedDocNo] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Auto-save timer ref
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getMemoSections(), getSigneePresets()])
      .then(([s, p]) => {
        setSections((s as MemoSection[]).filter((x) => x.isActive));
        setSignees(p as SigneePreset[]);
      })
      .catch((err) => showToast("โหลดข้อมูลไม่สำเร็จ", "err"))
      .finally(() => setLoading(false));
  }, [showToast]);

  // ── Auto-save draft every 30s ─────────────────────────────────────
  useEffect(() => {
    autoSaveRef.current = setInterval(async () => {
      if (!formData.title || !formData.content) return;
      try {
        const res = await saveDocDraft({ ...formData });
        setFormData((prev) => ({ ...prev, id: res.id }));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
      } catch {
        // silent fail
      }
    }, 30000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [formData]);

  // ── Helpers ───────────────────────────────────────────────────────
  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!formData.docType;
      case 1:
        return !!formData.title.trim() && !!formData.to.trim() && !!formData.origin.trim() && !!formData.content.trim();
      case 2:
        return !!formData.signeeName.trim() && !!formData.signeePosition.trim();
      case 3:
        return true;
      default:
        return false;
    }
  };

  // ── Save Draft manually ───────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!formData.title.trim()) {
      showToast("กรุณาระบุเรื่อง", "err");
      return;
    }
    setSaving(true);
    try {
      const res = await saveDocDraft({ ...formData });
      updateField("id", res.id);
      showToast("บันทึกฉบับร่างสำเร็จ");
    } catch (err: any) {
      showToast(err.message || "บันทึกไม่สำเร็จ", "err");
    } finally {
      setSaving(false);
    }
  };

  // ── Issue number ──────────────────────────────────────────────────
  const handleIssue = async () => {
    setIssuing(true);
    try {
      // Save draft first
      const draft = await saveDocDraft({ ...formData });
      updateField("id", draft.id);

      // Issue number
      const issued = await issueDocNumber(draft.id, formData.date);
      setIssuedDocNo(issued.docNo);
      showToast("ออกเลขเอกสารสำเร็จ!");
    } catch (err: any) {
      showToast(err.message || "ออกเลขไม่สำเร็จ", "err");
    } finally {
      setIssuing(false);
    }
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

  const docTypeInfo = DOC_TYPES.find((d) => d.key === formData.docType) || DOC_TYPES[0];

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
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/document")}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              สร้างเอกสารใหม่
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {docTypeInfo.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {draftSaved && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="text-xs text-emerald-500 font-medium flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> บันทึกร่างแล้ว
            </motion.span>
          )}
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "กำลังบันทึก..." : "บันทึกร่าง"}
          </button>
        </div>
      </div>

      {/* ── Step Indicator ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all w-full ${
                  isActive
                    ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : isDone
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                    : "text-slate-400"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? "bg-purple-500 text-white"
                      : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                  }`}
                >
                  {isDone ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Split View ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[calc(100vh-280px)]">
        {/* Left: Form Wizard */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-y-auto">
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Step 0: Choose Type */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    เลือกประเภทเอกสาร
                  </h3>
                  <div className="grid gap-3">
                    {DOC_TYPES.map((dt) => {
                      const Icon = dt.icon;
                      const active = formData.docType === dt.key;
                      return (
                        <button
                          key={dt.key}
                          onClick={() => updateField("docType", dt.key)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                            active
                              ? "border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-500/10 ring-2 ring-purple-500/20"
                              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${dt.gradient} flex items-center justify-center shadow-lg ${dt.shadow}`}
                          >
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {dt.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {dt.desc}
                            </p>
                          </div>
                          {active && (
                            <div className="ml-auto w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Memo Section selector */}
                  {formData.docType === "MEMO" && sections.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                        งานย่อย (ถ้ามี)
                      </label>
                      <div className="grid gap-2">
                        <button
                          onClick={() => updateField("memoSectionId", "")}
                          className={`px-4 py-2.5 rounded-xl border text-sm text-left transition-all ${
                            !formData.memoSectionId
                              ? "border-purple-400 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                          }`}
                        >
                          ไม่ระบุงานย่อย
                        </button>
                        {sections.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => updateField("memoSectionId", s.id)}
                            className={`px-4 py-2.5 rounded-xl border text-sm text-left transition-all ${
                              formData.memoSectionId === s.id
                                ? "border-purple-400 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                            }`}
                          >
                            <span className="font-mono text-xs mr-2 opacity-60">
                              [{s.code}]
                            </span>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 1: Details */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    รายละเอียดเอกสาร
                  </h3>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      เรื่อง *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="ระบุเรื่องของเอกสาร"
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        เรียน (To) *
                      </label>
                      <input
                        type="text"
                        value={formData.to}
                        onChange={(e) => updateField("to", e.target.value)}
                        placeholder="เช่น ผู้อำนวยการโรงเรียน"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        ต้นเรื่อง / ส่วนราชการ *
                      </label>
                      <input
                        type="text"
                        value={formData.origin}
                        onChange={(e) => updateField("origin", e.target.value)}
                        placeholder="เช่น ฝ่ายวิชาการ"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      วันที่
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateField("date", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      เนื้อหา / ข้อความ *
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => updateField("content", e.target.value)}
                      placeholder="พิมพ์เนื้อหาของเอกสาร..."
                      rows={6}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all resize-y"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        สิ่งที่ส่งมาด้วย
                      </label>
                      <input
                        type="text"
                        value={formData.enclosures}
                        onChange={(e) => updateField("enclosures", e.target.value)}
                        placeholder="เช่น สำเนาคำสั่ง 1 ฉบับ"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        อ้างถึง
                      </label>
                      <input
                        type="text"
                        value={formData.references}
                        onChange={(e) => updateField("references", e.target.value)}
                        placeholder="เช่น หนังสือที่ ศทก 001/2569"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Signee */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    เลือกผู้ลงนาม
                  </h3>

                  {/* Quick Preset Buttons */}
                  {signees.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                        เลือกจากรายชื่อที่บันทึกไว้
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {signees.map((s) => {
                          const selected =
                            formData.signeeName === s.name &&
                            formData.signeePosition === s.position;
                          return (
                            <button
                              key={s.id}
                              onClick={() => {
                                updateField("signeeName", s.name);
                                updateField("signeePosition", s.position);
                              }}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                selected
                                  ? "border-purple-400 bg-purple-50 dark:bg-purple-500/10 ring-2 ring-purple-500/20"
                                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                {s.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {s.name}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {s.position}
                                </p>
                              </div>
                              {selected && (
                                <Check className="w-4 h-4 text-purple-500 ml-auto shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manual input */}
                  <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      หรือกรอกเอง
                    </p>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        ชื่อ - นามสกุล ผู้ลงนาม *
                      </label>
                      <input
                        type="text"
                        value={formData.signeeName}
                        onChange={(e) => updateField("signeeName", e.target.value)}
                        placeholder="เช่น นายประธาน สมเกียรติ"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        ตำแหน่ง *
                      </label>
                      <input
                        type="text"
                        value={formData.signeePosition}
                        onChange={(e) => updateField("signeePosition", e.target.value)}
                        placeholder="เช่น ผู้อำนวยการโรงเรียน"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review & Issue */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ตรวจสอบข้อมูลและออกเลข
                  </h3>

                  {issuedDocNo ? (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 p-6 text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                        <Check className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        ออกเลขสำเร็จ!
                      </p>
                      <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 font-mono tracking-wide">
                        {issuedDocNo}
                      </p>
                      <button
                        onClick={() => router.push("/document")}
                        className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                      >
                        กลับไปหน้ารายการ
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Summary Table */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-2 text-sm">
                        <SummaryRow label="ประเภท" value={docTypeInfo.label} />
                        {formData.memoSectionId && (
                          <SummaryRow
                            label="งานย่อย"
                            value={
                              sections.find((s) => s.id === formData.memoSectionId)?.name ||
                              "-"
                            }
                          />
                        )}
                        <SummaryRow label="เรื่อง" value={formData.title} />
                        <SummaryRow label="เรียน" value={formData.to} />
                        <SummaryRow label="ต้นเรื่อง" value={formData.origin} />
                        <SummaryRow label="วันที่" value={fmtThaiDate(formData.date)} />
                        <SummaryRow label="ผู้ลงนาม" value={`${formData.signeeName} (${formData.signeePosition})`} />
                        {formData.enclosures && (
                          <SummaryRow label="สิ่งที่ส่งมาด้วย" value={formData.enclosures} />
                        )}
                        {formData.references && (
                          <SummaryRow label="อ้างถึง" value={formData.references} />
                        )}
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          <p className="font-semibold mb-1">หมายเหตุ</p>
                          <p>
                            เมื่อกด &quot;ออกเลขเอกสาร&quot; ระบบจะออกเลขลำดับถัดไปโดยอัตโนมัติ
                            ไม่สามารถเปลี่ยนแปลงลำดับได้ภายหลัง
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleIssue}
                        disabled={issuing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50"
                      >
                        <Zap className="w-5 h-5" />
                        {issuing ? "กำลังออกเลข..." : "ออกเลขเอกสาร"}
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Step Navigation */}
          {!issuedDocNo && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors disabled:opacity-30"
              >
                <ArrowLeft className="w-4 h-4" />
                ก่อนหน้า
              </button>
              {step < 3 && (
                <button
                  onClick={() => setStep(Math.min(3, step + 1))}
                  disabled={!canProceed()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-30"
                >
                  ถัดไป
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Live A4 Preview */}
        <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 lg:sticky lg:top-24 lg:h-[calc(100vh-150px)] overflow-y-auto flex justify-center p-6">
          <div className="w-full max-w-[595px] bg-white rounded-lg shadow-lg p-8 text-slate-900 text-sm leading-relaxed h-fit min-h-[842px]">
            {/* A4 Header */}
            <div className="text-center mb-6">
              <p className="text-lg font-bold">
                {formData.docType === "MEMO"
                  ? "บันทึกข้อความ"
                  : formData.docType === "COMMAND"
                  ? "คำสั่ง"
                  : "หนังสือส่ง"}
              </p>
            </div>

            {/* Document Fields */}
            <div className="space-y-2 mb-6">
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">ส่วนราชการ</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                  {formData.origin || (
                    <span className="text-slate-300 italic">---</span>
                  )}
                </span>
              </div>
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">ที่</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                  <span className="text-slate-400 italic text-xs">
                    (รอออกเลข)
                  </span>
                </span>
              </div>
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">วันที่</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1">
                  {formData.date ? fmtThaiDate(formData.date) : (
                    <span className="text-slate-300 italic">---</span>
                  )}
                </span>
              </div>
              <div className="flex">
                <span className="font-semibold w-20 shrink-0">เรื่อง</span>
                <span className="border-b border-dotted border-slate-300 flex-1 pb-1 font-semibold">
                  {formData.title || (
                    <span className="text-slate-300 italic font-normal">---</span>
                  )}
                </span>
              </div>
              {formData.enclosures && (
                <div className="flex">
                  <span className="font-semibold w-20 shrink-0 text-xs">สิ่งที่ส่งมาด้วย</span>
                  <span className="border-b border-dotted border-slate-300 flex-1 pb-1 text-xs">
                    {formData.enclosures}
                  </span>
                </div>
              )}
              {formData.references && (
                <div className="flex">
                  <span className="font-semibold w-20 shrink-0 text-xs">อ้างถึง</span>
                  <span className="border-b border-dotted border-slate-300 flex-1 pb-1 text-xs">
                    {formData.references}
                  </span>
                </div>
              )}
            </div>

            {/* To */}
            <div className="mb-4">
              <span className="font-semibold">เรียน</span>{" "}
              {formData.to || (
                <span className="text-slate-300 italic">---</span>
              )}
            </div>

            {/* Content */}
            <div className="mb-8 whitespace-pre-wrap text-sm leading-7 indent-16">
              {formData.content || (
                <span className="text-slate-300 italic">
                  (เนื้อหาเอกสารจะแสดงที่นี่)
                </span>
              )}
            </div>

            {/* Signee */}
            <div className="text-center mt-12 pt-8">
              {formData.signeeName ? (
                <>
                  <p className="mb-12">&nbsp;</p>
                  <p className="font-semibold">
                    ({formData.signeeName})
                  </p>
                  <p className="text-xs text-slate-600">
                    {formData.signeePosition}
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

// ── Summary Row helper ──────────────────────────────────────────────
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">
        {label}
      </span>
      <span className="text-right font-medium text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// WRAPPER WITH SUSPENSE (required for useSearchParams)
// ══════════════════════════════════════════════════════════════════════
export default function DocumentNewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full"
          />
        </div>
      }
    >
      <DocumentNewPageInner />
    </Suspense>
  );
}
