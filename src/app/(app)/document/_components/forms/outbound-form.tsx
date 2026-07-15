"use client";

import { useState } from "react";
import { Save, Sparkles, AlertCircle, Settings } from "lucide-react";

type MemoSection = { id: string; name: string; code: string; color?: string };

type OutboundFormProps = {
  sections: MemoSection[];
  issuing: boolean;
  onSubmit: (data: {
    docType: string;
    memoSectionId?: string;
    origin: string;
    to: string;
    title: string;
    requester: string;
    date: string;
    department?: string;
  }) => Promise<void>;
  username?: string;
  department?: string;
};

const COMMON_TITLES = [
  "ขออนุมัติจัดซื้อวัสดุสำนักงาน",
  "รายงานผลการปฏิบัติงานตามโครงการ",
  "ขออนุมัติเบิกจ่ายงบประมาณโครงการพัฒนาผู้เรียน",
  "ขออนุญาตจัดส่งบุคลากรเข้าร่วมการอบรมเชิงปฏิบัติการ",
  "ขออนุมัติจัดจ้างทำความสะอาดอาคารเรียน"
];

const COMMON_RECIPIENTS = [
  "ผู้อำนวยการโรงเรียน",
  "รองผู้อำนวยการโรงเรียนฝ่ายบริหารงานบุคคล",
  "รองผู้อำนวยการโรงเรียนฝ่ายวิชาการ",
  "หัวหน้างานพัสดุและโรงเรียน",
  "ทุกคนในสถานศึกษา"
];

export default function OutboundForm({
  sections,
  issuing,
  onSubmit,
  username = "",
  department = ""
}: OutboundFormProps) {
  const [formData, setFormData] = useState({
    docType: "MEMO",
    memoSectionId: sections[0]?.id || "",
    origin: department || "งานสารบรรณ",
    to: "ผู้อำนวยการโรงเรียน",
    title: "",
    requester: username || "",
    date: new Date().toISOString().split("T")[0],
    department: department || "",
    connectBudget: false,
  });

  const [showTitlePresets, setShowTitlePresets] = useState(false);
  const [showToPresets, setShowToPresets] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (issuing) return;
    
    onSubmit({
      docType: formData.docType,
      memoSectionId: formData.docType === "MEMO" ? formData.memoSectionId : undefined,
      origin: formData.origin.trim(),
      to: formData.to.trim(),
      title: formData.title.trim(),
      requester: formData.requester.trim(),
      date: formData.date,
      department: formData.department.trim() || undefined,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-3">
        <h3 className="text-sm font-extrabold text-slate-850 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          ขอเลขเอกสาร (หนังสือออก)
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-0.5 block">
              วันที่ออกเลข
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-0.5 block">
              ประเภทเอกสาร
            </label>
            <select
              value={formData.docType}
              onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            >
              <option value="MEMO">บันทึกข้อความ</option>
              <option value="COMMAND">คำสั่ง</option>
              <option value="OUTGOING_NORMAL">หนังสือส่ง (ปกติ)</option>
              <option value="OUTGOING_CIRCULAR">หนังสือส่ง (จดหมายเวียน)</option>
              <option value="ANNOUNCEMENT">ประกาศ</option>
            </select>
          </div>
        </div>

        {formData.docType === "MEMO" && (
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-0.5 block">
              หมวดหมู่เอกสาร *
            </label>
            <select
              value={formData.memoSectionId}
              onChange={(e) => setFormData({ ...formData, memoSectionId: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            >
              <option value="" disabled>-- เลือกหมวดหมู่บันทึกข้อความ --</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-0.5 block">
              จากหน่วยงาน *
            </label>
            <input
              type="text"
              required
              placeholder="เช่น ฝ่ายบริหารงานบุคคล"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-0.5 block">
                เรียน/ถึง *
              </label>
              <button
                type="button"
                onClick={() => setShowToPresets(!showToPresets)}
                className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-0.5"
              >
                <Settings className="w-2.5 h-2.5" />
                ผู้รับบ่อย
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="เช่น ผู้อำนวยการโรงเรียน"
              value={formData.to}
              onFocus={() => setShowToPresets(true)}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
            {showToPresets && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg p-2 space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 px-2 pb-1 border-b border-slate-50 dark:border-slate-800">
                  <span>เลือกคำลงท้าย/ผู้รับใช้บ่อย</span>
                  <button type="button" onClick={() => setShowToPresets(false)} className="text-rose-500 hover:underline">ปิด</button>
                </div>
                {COMMON_RECIPIENTS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, to: r }));
                      setShowToPresets(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-700 dark:text-slate-350 transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-0.5 block">
              เรื่อง (ชื่อเอกสาร) *
            </label>
            <button
              type="button"
              onClick={() => setShowTitlePresets(!showTitlePresets)}
              className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-0.5"
            >
              <Settings className="w-2.5 h-2.5" />
              เรื่องที่ใช้บ่อย
            </button>
          </div>
          <input
            type="text"
            required
            placeholder="เช่น ขออนุมัติจัดซื้อวัสดุคอมพิวเตอร์..."
            value={formData.title}
            onFocus={() => setShowTitlePresets(true)}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full h-10 px-3.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
          />
          {showTitlePresets && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg p-2 space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400 px-2 pb-1 border-b border-slate-50 dark:border-slate-800">
                <span>เลือกหัวข้อเรื่องที่ใช้บ่อย</span>
                <button type="button" onClick={() => setShowTitlePresets(false)} className="text-rose-500 hover:underline">ปิด</button>
              </div>
              {COMMON_TITLES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, title: t }));
                    setShowTitlePresets(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-700 dark:text-slate-350 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-0.5 block">
              ผู้ปฏิบัติ/ผู้ขอออกเลข
            </label>
            <input
              type="text"
              required
              value={formData.requester}
              onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-0.5 block">
              กลุ่มงาน/ฝ่ายที่เกี่ยวข้อง
            </label>
            <input
              type="text"
              placeholder="เช่น กลุ่มวิชาการ"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
        </div>

        {/* Budget Link Toggle */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
          <input
            type="checkbox"
            id="connectBudget"
            checked={formData.connectBudget}
            onChange={(e) => setFormData({ ...formData, connectBudget: e.target.checked })}
            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
          />
          <label htmlFor="connectBudget" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
            🔗 เชื่อมโยงกับระบบงบประมาณโครงการโรงเรียน
          </label>
        </div>

        <button
          type="submit"
          disabled={issuing}
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {issuing ? "กำลังขอเลขเอกสาร..." : "ยืนยันขอเลขเอกสาร (หนังสือออก)"}
        </button>
      </form>
    </div>
  );
}
