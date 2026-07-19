"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wrench, ArrowLeft, Send, Loader2, MapPin, AlertTriangle, Tag } from "lucide-react";
import { createRepairAction } from "@/app/actions/repair/create";
import { RepairCategory, RepairUrgency } from "@prisma/client";
import { useToast } from "@/components/toast-provider";

const URGENCY_OPTIONS: { value: RepairUrgency; label: string; desc: string; color: string }[] = [
  { value: "LOW",      label: "ปกติ",     desc: "ไม่เร่งด่วน สามารถรอได้",         color: "border-slate-300 hover:border-slate-400" },
  { value: "MEDIUM",   label: "ปานกลาง",  desc: "ควรแก้ไขภายใน 1-3 วัน",           color: "border-amber-300 hover:border-amber-400" },
  { value: "HIGH",     label: "เร่งด่วน", desc: "กระทบการเรียนการสอน",             color: "border-orange-400 hover:border-orange-500" },
  { value: "CRITICAL", label: "วิกฤต",    desc: "อันตราย ต้องแก้ไขทันที",          color: "border-red-500 hover:border-red-600" },
];

const CATEGORY_OPTIONS: { value: RepairCategory; label: string; emoji: string }[] = [
  { value: "ELECTRICAL",   label: "ไฟฟ้า",           emoji: "⚡" },
  { value: "PLUMBING",     label: "ประปา",           emoji: "🚿" },
  { value: "HVAC",         label: "แอร์/พัดลม",     emoji: "❄️" },
  { value: "STRUCTURAL",   label: "โครงสร้าง",      emoji: "🏗️" },
  { value: "FURNITURE",    label: "เฟอร์นิเจอร์",   emoji: "🪑" },
  { value: "IT_EQUIPMENT", label: "อุปกรณ์ IT",     emoji: "💻" },
  { value: "GROUNDS",      label: "พื้นที่/สนาม",   emoji: "🌳" },
  { value: "OTHER",        label: "อื่น ๆ",          emoji: "🔧" },
];

export default function RepairNewPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    urgency: "MEDIUM" as RepairUrgency,
    category: "OTHER" as RepairCategory,
    expectedFinishAt: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.location.trim() || !form.description.trim()) {
      showToast("error", "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    try {
      setSubmitting(true);
      await createRepairAction({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        urgency: form.urgency,
        category: form.category,
        expectedFinishAt: form.expectedFinishAt || null,
      });
      showToast("success", "ส่งคำขอแจ้งซ่อมเรียบร้อยแล้ว");
      router.push("/repair");
    } catch (err: any) {
      showToast("error", err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            แจ้งซ่อมใหม่
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">กรอกรายละเอียดเพื่อส่งคำขอซ่อม</p>
        </div>
      </div>

      {/* Form Card */}
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 space-y-6"
      >

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">ชื่อรายการซ่อม *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="เช่น ไฟฟ้าดับในห้อง 301, ก๊อกน้ำรั่ว..."
            maxLength={150}
            required
            className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Tag className="w-4 h-4" /> ประเภท *
          </label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("category", opt.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                  form.category === opt.value
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-500/5"
                }`}
              >
                <span className="text-lg">{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Urgency */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> ระดับความเร่งด่วน *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {URGENCY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("urgency", opt.value)}
                className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                  form.urgency === opt.value
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10"
                    : `border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 ${opt.color}`
                }`}
              >
                <span className={`text-sm font-bold ${form.urgency === opt.value ? "text-orange-600 dark:text-orange-400" : "text-slate-700 dark:text-slate-200"}`}>
                  {opt.label}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> สถานที่ *
          </label>
          <input
            type="text"
            value={form.location}
            onChange={e => set("location", e.target.value)}
            placeholder="เช่น อาคาร 3 ชั้น 2 ห้อง 301"
            required
            className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">รายละเอียด *</label>
          <textarea
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="อธิบายปัญหาที่พบ เช่น ไฟฟ้าดับเฉพาะส่วนไหน เกิดขึ้นเมื่อไหร่..."
            rows={4}
            required
            className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all resize-none"
          />
        </div>

        {/* Expected finish date (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            ต้องการให้เสร็จภายใน <span className="font-normal text-slate-400">(ถ้ามี)</span>
          </label>
          <input
            type="date"
            value={form.expectedFinishAt}
            onChange={e => set("expectedFinishAt", e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            ยกเลิก
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 transition-all"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> กำลังส่ง...</>
            ) : (
              <><Send className="w-4 h-4" /> ส่งคำขอแจ้งซ่อม</>
            )}
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}
