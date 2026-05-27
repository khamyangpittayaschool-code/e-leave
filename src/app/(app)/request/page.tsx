"use client";

import { useState, useRef, useEffect } from "react";
import { submitLeaveRequest, getMyLeaveUsageForCurrentCycle } from "@/app/actions/leave";
import { getLeaveConfigs, getSystemSettings } from "@/app/actions/settings";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, FileText, Send, Clock, Briefcase, Plus, AlertCircle, Paperclip, X, Image as ImageIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekdayName(dateStr: string, lang: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { weekday: 'long' });
}

export default function RequestLeavePage() {
  const [loading, setLoading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { t, lang, tLeaveType } = useI18n();
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  const [leaveConfigs, setLeaveConfigs] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("SICK");
  const [leaveRules, setLeaveRules] = useState<string[]>([]);
  const [leaveUsage, setLeaveUsage] = useState<any>(null);

  useEffect(() => {
    getLeaveConfigs().then((configs) => {
      const sortedConfigs = [...configs].sort((a, b) => {
        if (a.type === "SICK") return -1;
        if (b.type === "SICK") return 1;
        if (a.type === "PERSONAL") return -1;
        if (b.type === "PERSONAL") return 1;
        return 0;
      });
      setLeaveConfigs(sortedConfigs);
      if (sortedConfigs.length > 0) setSelectedType(sortedConfigs[0].type);
    }).catch(console.error);

    getSystemSettings().then((s: any) => {
      if (s.leaveRules) {
        setLeaveRules(s.leaveRules.split("\n").filter((r: string) => r.trim()));
      }
    }).catch(console.error);

    getMyLeaveUsageForCurrentCycle().then(setLeaveUsage).catch(console.error);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(t("fileTooLarge"));
      return;
    }

    setDocumentName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDocumentPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeDocument = () => {
    setDocumentPreview(null);
    setDocumentName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    // If endDate is before the new startDate, auto-correct it
    if (endDate < val) {
      setEndDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    // Prevent endDate from being before startDate
    if (val < startDate) {
      setEndDate(startDate);
    } else {
      setEndDate(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Final validation: endDate must not be before startDate
    if (endDate < startDate) {
      alert(t("endBeforeStart"));
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      await submitLeaveRequest({
        type: formData.get("type") as string,
        startDate,
        endDate,
        reason: formData.get("reason") as string,
        documentUrl: documentPreview || undefined,
      });
      alert(t("submitSuccess"));
      router.push("/history");
    } catch (error) {
      alert(t("submitError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t("requestLeaveTitle")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("requestLeaveSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Section */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />

            <input type="hidden" name="type" value={selectedType} />

            {/* Leave Type Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t("leaveType")}</label>
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer"
                  disabled={leaveConfigs.length === 0}
                >
                  {leaveConfigs.length === 0 ? (
                    <option value="">{t("loadingLeaveTypes")}</option>
                  ) : (
                    leaveConfigs.map((type) => (
                      <option key={type.id} value={type.type}>
                        {tLeaveType(type.type, type.name)}
                      </option>
                    ))
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t("startDate")}</label>
                  {startDate && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      ["เสาร์", "อาทิตย์", "Saturday", "Sunday"].some(w => getWeekdayName(startDate, lang).includes(w))
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50"
                        : "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200/50"
                    }`}>
                      {getWeekdayName(startDate, lang)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-slate-400" />
                  </div>
                  <input name="startDate" type="date" required value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t("endDate")}</label>
                  {endDate && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      ["เสาร์", "อาทิตย์", "Saturday", "Sunday"].some(w => getWeekdayName(endDate, lang).includes(w))
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50"
                        : "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200/50"
                    }`}>
                      {getWeekdayName(endDate, lang)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-slate-400" />
                  </div>
                  <input name="endDate" type="date" required value={endDate} min={startDate} onChange={(e) => handleEndDateChange(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" />
                </div>
              </div>
            </div>

            {/* Live Day Count Preview */}
             {startDate && endDate && (() => {
               const start = new Date(startDate);
               const end = new Date(endDate);
               let isWeekendOnly = false;
               let calculatedCount = 0;

               if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
                 if (selectedType === "MATERNITY") {
                   calculatedCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                 } else {
                   let count = 0;
                   const current = new Date(start);
                   while (current <= end) {
                     const day = current.getDay();
                     if (day !== 0 && day !== 6) count++;
                     current.setDate(current.getDate() + 1);
                   }
                   calculatedCount = count;
                   isWeekendOnly = (count === 0);
                 }
               }

               return (
                 <div className="flex flex-col gap-3">
                   <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-2 border-purple-200/50 dark:border-purple-900/50 rounded-3xl flex items-center justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                     <div className="space-y-1">
                       <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                         <Calendar className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                         จำนวนวันลาที่คำนวณในคำขอนี้
                       </p>
                       <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                         {selectedType === "MATERNITY" 
                           ? "✓ คำนวณเป็นวันปฏิทิน (รวมวันหยุดเสาร์-อาทิตย์)" 
                           : "✓ ไม่รวมวันหยุดเสาร์-อาทิตย์ (นับเฉพาะวันทำการปกติ)"
                         }
                       </p>
                     </div>
                     <div className="flex items-baseline gap-1 bg-white dark:bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                       <span className="text-3xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                         {calculatedCount}
                       </span>
                       <span className="text-xs font-bold text-slate-600 dark:text-slate-400">วัน</span>
                     </div>
                   </div>

                   {isWeekendOnly && (
                     <motion.div 
                       initial={{ opacity: 0, y: -10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/50 rounded-2xl flex items-start gap-2.5 text-amber-800 dark:text-amber-300"
                     >
                       <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                       <div className="text-xs space-y-1">
                         <p className="font-bold">⚠️ แจ้งเตือน: วันที่เลือกตรงกับวันหยุดเสาร์-อาทิตย์</p>
                         <p className="opacity-90 font-medium leading-relaxed">
                           เนื่องจากระบบไม่นับวันหยุดราชการปกติเข้ารวมกับจำนวนวันลาสะสมสำหรับประเภทการลานี้ ({tLeaveType(selectedType, selectedType)}) จึงทำให้ยอดวันลาที่คำนวณได้มีค่าเป็น <span className="font-bold">0 วัน</span>
                         </p>
                       </div>
                     </motion.div>
                   )}
                 </div>
               );
             })()}

            {/* Reason */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("leaveReason")}</label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <textarea name="reason" required rows={4} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none" placeholder={t("reasonPlaceholder")} />
              </div>
            </div>

            {/* Document Attachment */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t("attachDocument")} <span className="text-slate-400 font-normal">{t("optionalLabel")}</span>
              </label>

              {!documentPreview ? (
                <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-all cursor-pointer group">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                  <Paperclip className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:text-purple-400 transition-colors mb-2" />
                  <span className="text-sm text-slate-400 group-hover:text-purple-500 transition-colors">{t("clickToAttach")}</span>
                  <span className="text-xs text-slate-300 dark:text-slate-600 mt-1">{t("maxFileSize")}</span>
                </label>
              ) : (
                <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <button type="button" onClick={removeDocument} className="absolute top-2 right-2 w-8 h-8 bg-slate-100 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-full flex items-center justify-center transition-colors group z-10">
                    <X className="w-4 h-4 text-slate-500 group-hover:text-rose-500" />
                  </button>
                  <div className="flex items-center gap-4">
                    {documentPreview.startsWith("data:image") ? (
                      <img src={documentPreview} alt="เอกสารแนบ" className="w-20 h-20 object-cover rounded-xl border border-slate-100 dark:border-slate-700" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-rose-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{documentName}</p>
                      <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> {t("fileAttached")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-slate-800 dark:hover:bg-slate-100 focus:ring-4 focus:ring-slate-900/20 transition-all disabled:opacity-50">
                {loading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full" />
                    {t("submitting")}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("submitRequest")}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Guidelines & Leave Usage */}
        <div className="space-y-6">
          {/* Leave Rules from Settings */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              {t("leaveRules")}
            </h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              {leaveRules.length > 0 ? leaveRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                  <span>{rule}</span>
                </li>
              )) : (
                <>
                  <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" /><span>{t("defaultRule1")}</span></li>
                  <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" /><span>{t("defaultRule2")}</span></li>
                  <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" /><span>{t("defaultRule3")}</span></li>
                </>
              )}
            </ul>
          </div>

          {/* Leave Usage Warning Card */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Briefcase className="w-5 h-5 text-indigo-500" />
              {t("currentCycleStatus")}
            </h3>
            {leaveUsage ? (
              <>
                <p className="text-[11px] text-slate-400 mb-4">{leaveUsage.cycleLabel}</p>
                <div className="space-y-4">
                  
                  {/* Global Times Progress */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300">จำนวนครั้งที่ใช้สิทธิ์ไปแล้ว</span>
                      <span className="text-slate-900 dark:text-white">{leaveUsage.totalTimes} / 6 ครั้ง</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((leaveUsage.totalTimes / 6) * 100, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${leaveUsage.totalTimes >= 4 ? 'bg-orange-500' : 'bg-purple-500'}`}
                      />
                    </div>
                  </div>

                  {/* Global Days Progress */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300">จำนวนวันที่ใช้สิทธิ์ไปแล้ว</span>
                      <span className="text-slate-900 dark:text-white">{leaveUsage.totalDays} / 15 วัน</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((leaveUsage.totalDays / 15) * 100, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className={`h-full rounded-full ${leaveUsage.totalDays >= 12 ? 'bg-rose-500' : 'bg-blue-500'}`}
                      />
                    </div>
                  </div>

                  {leaveUsage.isWarning && (
                    <div className="flex items-center gap-2 mt-4 p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-800 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                        คุณใช้สิทธิ์การลาใกล้ถึงกำหนด (4 ครั้ง หรือ 12 วัน) 
                      </p>
                    </div>
                  )}

                </div>
                <p className="text-[10px] text-slate-400 mt-4 text-center leading-relaxed">
                  * โควตาการลาเป็นเพียงการบอกสิทธิ์เบื้องต้น<br/>การลาเกินโควตายังสามารถยื่นคำขอได้ตามปกติ
                </p>
              </>
            ) : (
              <div className="animate-pulse space-y-2 mt-4">
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
