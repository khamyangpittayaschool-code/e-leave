"use client";

import { useState } from "react";
import { Save, Sparkles, Settings, ChevronDown } from "lucide-react";

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

const DEPARTMENT_OPTIONS = [
  "กลุ่มบริหารงานวิชาการ",
  "กลุ่มบริหารงานงบประมาณ",
  "กลุ่มบริหารงานบุคคล",
  "กลุ่มบริหารงานทั่วไป",
  "กลุ่มกิจการนักเรียน",
];

export default function OutboundForm({
  sections,
  issuing,
  onSubmit,
  username = "",
  department = ""
}: OutboundFormProps) {
  // Default "จากหน่วยงาน" to requester's name
  const [formData, setFormData] = useState({
    docType: "MEMO",
    memoSectionId: sections[0]?.id || "",
    origin: username || department || "งานสารบรรณ",
    to: "ผู้อำนวยการโรงเรียน",
    title: "",
    requester: username || "",
    date: new Date().toISOString().split("T")[0],
    department: department || "",
    connectBudget: false,
  });

  const [showTitlePresets, setShowTitlePresets] = useState(false);
  const [showToPresets, setShowToPresets] = useState(false);
  const [customDepartment, setCustomDepartment] = useState(false);

  // Determine if the current department is a custom value (not in the preset list)
  const isCustomDepartment = formData.department !== "" && !DEPARTMENT_OPTIONS.includes(formData.department);

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

  // Get the selected memo section for color display
  const selectedSection = sections.find(s => s.id === formData.memoSectionId);

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              วันที่ออกเลข
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              ประเภทเอกสาร
            </label>
            <div className="relative">
              <select
                value={formData.docType}
                onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all appearance-none cursor-pointer"
              >
                <option value="MEMO">บันทึกข้อความ</option>
                <option value="COMMAND">คำสั่ง</option>
                <option value="OUTGOING_NORMAL">หนังสือส่ง (ปกติ)</option>
                <option value="OUTGOING_CIRCULAR">หนังสือส่ง (จดหมายเวียน)</option>
                <option value="ANNOUNCEMENT">ประกาศ</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {formData.docType === "MEMO" && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              หมวดหมู่เอกสาร *
            </label>
            <div className="relative">
              <select
                value={formData.memoSectionId}
                onChange={(e) => setFormData({ ...formData, memoSectionId: e.target.value })}
                className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all appearance-none cursor-pointer"
                style={selectedSection?.color ? { borderLeftWidth: '4px', borderLeftColor: selectedSection.color } : {}}
              >
                <option value="" disabled>-- เลือกหมวดหมู่บันทึกข้อความ --</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            {/* Color preview of selected section */}
            {selectedSection && (
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="w-3 h-3 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: selectedSection.color || '#6366f1' }}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  สี: {selectedSection.name}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              จากหน่วยงาน *
            </label>
            <input
              type="text"
              required
              placeholder="ชื่อผู้ขอ / หน่วยงาน"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                เรียน/ถึง *
              </label>
              <button
                type="button"
                onClick={() => setShowToPresets(!showToPresets)}
                className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold hover:underline flex items-center gap-0.5"
              >
                <Settings className="w-3 h-3" />
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
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            {showToPresets && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 space-y-1">
                <div className="flex justify-between items-center text-[11px] text-slate-400 px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
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
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              เรื่อง (ชื่อเอกสาร) *
            </label>
            <button
              type="button"
              onClick={() => setShowTitlePresets(!showTitlePresets)}
              className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              <Settings className="w-3 h-3" />
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
            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
          {showTitlePresets && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 space-y-1">
              <div className="flex justify-between items-center text-[11px] text-slate-400 px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
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
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-orange-50 dark:hover:bg-orange-950/20 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              ผู้ปฏิบัติ/ผู้ขอออกเลข
            </label>
            <input
              type="text"
              required
              value={formData.requester}
              onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              กลุ่มงาน/ฝ่ายที่เกี่ยวข้อง
            </label>
            {customDepartment || isCustomDepartment ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ระบุกลุ่มงาน/ฝ่าย..."
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="flex-1 h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setCustomDepartment(false); setFormData({ ...formData, department: "" }); }}
                  className="h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  เลือกจากรายการ
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={formData.department}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomDepartment(true);
                      setFormData({ ...formData, department: "" });
                    } else {
                      setFormData({ ...formData, department: e.target.value });
                    }
                  }}
                  className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- เลือกกลุ่มงาน --</option>
                  {DEPARTMENT_OPTIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__custom__">อื่นๆ (ระบุเอง)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Budget Link Toggle */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
          <input
            type="checkbox"
            id="connectBudget"
            checked={formData.connectBudget}
            onChange={(e) => setFormData({ ...formData, connectBudget: e.target.checked })}
            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
          />
          <label htmlFor="connectBudget" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            🔗 เชื่อมโยงกับระบบงบประมาณโครงการโรงเรียน
          </label>
        </div>

        <button
          type="submit"
          disabled={issuing}
          className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {issuing ? "กำลังขอเลขเอกสาร..." : "ยืนยันขอเลขเอกสาร (หนังสือออก)"}
        </button>
      </form>
    </div>
  );
}
