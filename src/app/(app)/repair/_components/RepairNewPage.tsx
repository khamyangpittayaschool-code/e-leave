"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wrench, ArrowLeft, Send, Loader2, MapPin, AlertTriangle, Tag, Camera, ImagePlus, X } from "lucide-react";
import { createRepairAction } from "@/app/actions/repair/create";
import { RepairCategory, RepairUrgency } from "@prisma/client";
import { useToast } from "@/components/toast-provider";
import { compressImageInBrowser } from "@/lib/client-image-compression";
import { uploadPhotoWithProgress } from "@/lib/upload-with-progress";
import { useRef } from "react";

const URGENCY_OPTIONS: { value: RepairUrgency; label: string; desc: string; color: string }[] = [
  { value: "NORMAL",      label: "ปกติ",       desc: "ไม่เร่งด่วน สามารถรอได้",        color: "border-slate-300 hover:border-slate-400" },
  { value: "URGENT",      label: "เร่งด่วน",   desc: "กระทบการเรียนการสอน",            color: "border-orange-400 hover:border-orange-500" },
  { value: "URGENT_MOST", label: "เร่งด่วนมาก", desc: "อันตราย ต้องแก้ไขทันที",        color: "border-red-500 hover:border-red-600" },
];

const CATEGORY_OPTIONS: { value: RepairCategory; label: string; emoji: string }[] = [
  { value: "ELECTRICAL", label: "ไฟฟ้า",        emoji: "⚡" },
  { value: "PLUMBING",   label: "ประปา",        emoji: "🚿" },
  { value: "BUILDING",   label: "อาคาร/โครงสร้าง", emoji: "🏗️" },
  { value: "IT",         label: "อุปกรณ์ IT",   emoji: "💻" },
  { value: "EQUIPMENT",  label: "ครุภัณฑ์/เฟอร์นิเจอร์", emoji: "🪑" },
  { value: "OTHER",      label: "อื่น ๆ",        emoji: "🔧" },
];

export default function RepairNewPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    urgency: "NORMAL" as RepairUrgency,
    category: "OTHER" as RepairCategory,
    expectedFinishAt: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  const activeCancelRef = useRef<(() => void) | null>(null);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (selectedFiles.length + files.length > 2) {
        showToast("error", "สามารถอัปโหลดรูปภาพก่อนซ่อมได้สูงสุด 2 รูป");
        return;
      }
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleCancel = () => {
    if (activeCancelRef.current) {
      activeCancelRef.current();
      activeCancelRef.current = null;
    }
    setSubmitting(false);
    setUploadProgress("");
    setProgressPercent(0);
    showToast("warning", "ยกเลิกการส่งคำขอแล้ว");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting) return;

    if (!form.title.trim() || !form.location.trim() || !form.description.trim()) {
      showToast("error", "กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อรายการ, สถานที่, รายละเอียด)");
      return;
    }

    try {
      setSubmitting(true);
      setProgressPercent(5);
      setUploadProgress("กำลังเตรียมบันทึกข้อมูล...");

      // 1. Client-side Image Compression (Reduces any size photo to ~200-400KB)
      const preparedFiles: File[] = [];
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          setUploadProgress(`กำลังปรับประมวลผลรูปภาพที่ ${i + 1}/${selectedFiles.length}...`);
          setProgressPercent(5 + Math.round(((i + 1) / selectedFiles.length) * 15));
          const compressed = await compressImageInBrowser(selectedFiles[i]);
          preparedFiles.push(compressed);
        }
      }

      // 2. Create the repair request record in DB
      setUploadProgress("กำลังสร้างคำขอแจ้งซ่อม...");
      setProgressPercent(25);

      const createRes = await createRepairAction({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        urgency: form.urgency,
        category: form.category,
        expectedFinishAt: form.expectedFinishAt || null,
      });

      if (!createRes.success) {
        throw new Error(createRes.error || "สร้างคำขอแจ้งซ่อมไม่สำเร็จ");
      }
      const repair = createRes.repair!;

      // 3. Upload BEFORE photos via XHR with progress bar & cancel
      if (preparedFiles.length > 0) {
        let uploadError = "";
        for (let i = 0; i < preparedFiles.length; i++) {
          const fd = new FormData();
          fd.append("repairId", repair.id);
          fd.append("photoType", "BEFORE");
          fd.append("file", preparedFiles[i]);
          fd.append("currentCount", String(i));

          const { promise, cancel } = uploadPhotoWithProgress(fd, (info) => {
            const basePct = 30 + Math.round((i / preparedFiles.length) * 65);
            const photoStepPct = Math.round((info.percent / 100) * (65 / preparedFiles.length));
            setProgressPercent(basePct + photoStepPct);
            setUploadProgress(`กำลังอัปโหลดรูปภาพที่ ${i + 1}/${preparedFiles.length} (${info.percent}%)...`);
          });

          activeCancelRef.current = cancel;

          try {
            const res = await promise;
            if (!res.success) {
              uploadError = res.error || `อัปโหลดรูปภาพที่ ${i + 1} ไม่สำเร็จ`;
              break;
            }
          } catch (err: any) {
            uploadError = err?.message || "ยกเลิกหรือเกิดข้อผิดพลาดในการอัปโหลด";
            break;
          } finally {
            activeCancelRef.current = null;
          }
        }

        if (uploadError) {
          showToast("warning", `สร้างคำขอแล้ว แต่อัปโหลดรูปภาพไม่สำเร็จ: ${uploadError}`);
          router.push("/repair");
          return;
        }
      }

      setProgressPercent(100);
      setUploadProgress("ส่งคำขอเรียบร้อย!");
      showToast("success", "ส่งคำขอแจ้งซ่อมเรียบร้อยแล้ว");
      router.push("/repair");
    } catch (err: any) {
      showToast("error", err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
      setProgressPercent(0);
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

        {/* Upload BEFORE Photos during creation */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-orange-500" /> อัปโหลดรูปภาพก่อนซ่อม <span className="font-normal text-slate-400">(ถ้ามี, สูงสุด 2 รูป)</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {/* Selected files preview */}
            {selectedFiles.map((file, idx) => {
              const url = URL.createObjectURL(file);
              return (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-55 bg-slate-50 dark:bg-slate-800">
                  <img src={url} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-650 flex items-center justify-center text-white transition-colors shadow-md shadow-black/10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            
            {/* Upload slot */}
            {selectedFiles.length < 2 && (
              <label className="relative aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                <ImagePlus className="w-6 h-6 text-slate-400" />
                <span className="text-[10px] text-slate-400 text-center px-1">เพิ่มรูปภาพ</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>
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

        {/* Progress Bar UI during Submission */}
        {submitting && (
          <div className="bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-orange-900 dark:text-orange-300">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                {uploadProgress || "กำลังบันทึก..."}
              </span>
              <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{progressPercent}%</span>
            </div>
            
            {/* Visual Progress Bar */}
            <div className="w-full h-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:underline flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                หยุด / ยกเลิกการอัปโหลด
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          {!submitting ? (
            <>
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
                type="button"
                onClick={() => handleSubmit()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" /> ส่งคำขอแจ้งซ่อม
              </motion.button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <X className="w-4 h-4" /> หยุด / ยกเลิกการส่งคำขอ
            </button>
          )}
        </div>
      </motion.form>
    </div>
  );
}
