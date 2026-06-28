"use client";

import { useState, useRef, useEffect } from "react";
import { submitLeaveRequest, getMyLeaveUsageForCurrentCycle } from "@/app/actions/leave";
import { getLeaveConfigs, getSystemSettings } from "@/app/actions/settings";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, FileText, Send, Clock, Briefcase, Plus, AlertCircle, Paperclip, X, Image as ImageIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast-provider";

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

const readAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const compressImage = (dataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const maxDim = 2000;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.85);
      resolve(compressed);
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
};

export default function RequestLeavePage() {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { t, lang, tLeaveType } = useI18n();
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  const [leaveConfigs, setLeaveConfigs] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("SICK");
  const [leaveRules, setLeaveRules] = useState<string[]>([]);
  const [leaveUsage, setLeaveUsage] = useState<any>(null);
  const [requirePersonalAdvance, setRequirePersonalAdvance] = useState(true);
  const [memoConfirmed, setMemoConfirmed] = useState(false);
  const [quotaExceededAction, setQuotaExceededAction] = useState("ALLOW_WITH_MEMO");
  const [reportedToDirector, setReportedToDirector] = useState(false);

  // For special leave fields
  const [extraWifeName, setExtraWifeName] = useState("");
  const [extraWifeBirthDate, setExtraWifeBirthDate] = useState("");
  const [extraHasMarriageCert, setExtraHasMarriageCert] = useState(true);
  const [extraHasBirthCert, setExtraHasBirthCert] = useState(true);

  const [extraVacationAccumulated, setExtraVacationAccumulated] = useState(10);
  const [extraVacationThisYear, setExtraVacationThisYear] = useState(10);

  const [extraIsHajj, setExtraIsHajj] = useState(false);
  const [extraTempleName, setExtraTempleName] = useState("");
  const [extraTempleLocation, setExtraTempleLocation] = useState("");
  const [extraResideTempleName, setExtraResideTempleName] = useState("");
  const [extraResideTempleLocation, setExtraResideTempleLocation] = useState("");
  const [extraOrdinationDate, setExtraOrdinationDate] = useState("");

  const [extraMilitaryOrderSource, setExtraMilitaryOrderSource] = useState("");
  const [extraMilitaryOrderNo, setExtraMilitaryOrderNo] = useState("");
  const [extraMilitaryOrderDate, setExtraMilitaryOrderDate] = useState("");
  const [extraMilitaryDutyType, setExtraMilitaryDutyType] = useState("เข้ารับการตรวจเลือก");
  const [extraMilitaryLocation, setExtraMilitaryLocation] = useState("");

  const [extraUserSalary, setExtraUserSalary] = useState("15,000");
  const [extraScholarshipName, setExtraScholarshipName] = useState("ทุนส่วนตัว");
  const [extraStudyCountry, setExtraStudyCountry] = useState("ประเทศไทย");
  const [extraStudyDurationYears, setExtraStudyDurationYears] = useState("1");
  const [extraStudyDurationMonths, setExtraStudyDurationMonths] = useState("0");
  const [extraStudyDurationDays, setExtraStudyDurationDays] = useState("0");

  useEffect(() => {
    getLeaveConfigs().then((configs) => {
      const activeConfigs = configs.filter(c => c.isActive !== false);
      const sortedConfigs = [...activeConfigs].sort((a, b) => {
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
      setRequirePersonalAdvance(s.requirePersonalAdvance !== false);
      if (s.quotaExceededAction) {
        setQuotaExceededAction(s.quotaExceededAction);
      }
    }).catch(console.error);

    getMyLeaveUsageForCurrentCycle().then(setLeaveUsage).catch(console.error);
  }, []);

  useEffect(() => {
    setReportedToDirector(false);
  }, [selectedType, startDate, endDate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxAllowed = 2 - attachedFiles.length;
    if (maxAllowed <= 0) {
      showToast("warning", "แนบไฟล์ได้สูงสุด 2 ไฟล์");
      return;
    }

    const filesToProcess = files.slice(0, maxAllowed);
    const processed: { name: string; preview: string }[] = [];

    for (const file of filesToProcess) {
      if (file.type === "application/pdf") {
        if (file.size > 5 * 1024 * 1024) {
          showToast("error", t("fileTooLarge"));
          continue;
        }
        try {
          const preview = await readAsDataURL(file);
          processed.push({ name: file.name, preview });
        } catch (err) {
          console.error(err);
        }
      } else if (file.type.startsWith("image/")) {
        try {
          const dataUrl = await readAsDataURL(file);
          const compressed = await compressImage(dataUrl);
          processed.push({ name: file.name, preview: compressed });
        } catch (err) {
          console.error(err);
        }
      } else {
        showToast("warning", "รองรับเฉพาะไฟล์รูปภาพและ PDF เท่านั้น");
      }
    }

    if (processed.length > 0) {
      setAttachedFiles((prev) => [...prev, ...processed].slice(0, 2));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeDocument = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
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

  const isPersonalLeaveInvalid = (() => {
    if (selectedType === "PERSONAL" && requirePersonalAdvance) {
      if (!startDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      return start <= today;
    }
    return false;
  })();

  const limitTimes = leaveUsage?.limitTimes ?? 6;
  const limitDays = leaveUsage?.limitDays ?? 15;
  const exceedsThreshold = leaveUsage ? (leaveUsage.totalTimes >= limitTimes || leaveUsage.totalDays >= limitDays) : false;
  const isAccumulationRuleActive = exceedsThreshold && (selectedType === "SICK" || selectedType === "PERSONAL");

  const isQuotaExceeded = (() => {
    if (!leaveUsage?.typeQuotas || !leaveUsage?.typeUsage || !selectedType) return false;
    const quota = leaveUsage.typeQuotas[selectedType];
    if (!quota || quota <= 0) return false;
    const used = leaveUsage.typeUsage[selectedType] || 0;
    
    // Calculate days being requested
    const start = new Date(startDate);
    const end = new Date(endDate);
    let reqDays = 0;
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      if (selectedType === "MATERNITY") {
        reqDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else {
        const current = new Date(start);
        while (current <= end) {
          const day = current.getDay();
          if (day !== 0 && day !== 6) reqDays++;
          current.setDate(current.getDate() + 1);
        }
      }
    }
    return (used + reqDays) > quota;
  })();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Final validation: endDate must not be before startDate
    if (endDate < startDate) {
      showToast("error", t("endBeforeStart"));
      return;
    }

    if (isPersonalLeaveInvalid) {
      showToast("warning", "การลากิจส่วนตัวต้องยื่นคำขอล่วงหน้าอย่างน้อย 1 วันทำการ (ไม่สามารถลาในวันนี้หรือย้อนหลังได้)");
      return;
    }

    if (isAccumulationRuleActive) {
      if (!memoConfirmed) {
        showToast("warning", "กรุณาติ๊กกล่องยืนยันว่าได้จัดทำบันทึกข้อความเสนอผู้อำนวยการเรียบร้อยแล้ว");
        return;
      }
      if (attachedFiles.length === 0) {
        showToast("warning", "กรุณาแนบไฟล์บันทึกข้อความเสนอผู้อำนวยการในช่องแนบเอกสาร");
        return;
      }
    }

    if (isQuotaExceeded) {
      if (quotaExceededAction === "BLOCK") {
        showToast("error", lang === "th" ? "ขออภัย จำนวนวันลาประเภทนี้เกินโควตาสูงสุดที่กำหนด ระบบไม่อนุญาตให้ยื่นคำขอลาเกินโควตา" : "Sorry, this leave type exceeds the maximum quota. Submission is blocked.");
        return;
      }
      if (quotaExceededAction === "ALLOW_WITH_MEMO" && !reportedToDirector) {
        showToast("warning", lang === "th" ? "กรุณายืนยันว่าได้รายงานผู้อำนวยการแล้วสำหรับการลาที่เกินโควตา" : "Please confirm that you have reported to the Director.");
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const leaveType = selectedType;

      let extraObj: any = {};
      if (leaveType === "PATERNITY") {
        extraObj = {
          wifeName: extraWifeName,
          wifeBirthDate: extraWifeBirthDate,
          hasMarriageCert: extraHasMarriageCert,
          hasBirthCert: extraHasBirthCert,
        };
      } else if (leaveType === "VACATION") {
        extraObj = {
          vacationAccumulated: extraVacationAccumulated,
          vacationThisYear: extraVacationThisYear,
        };
      } else if (leaveType === "ORDINATION") {
        extraObj = {
          isHajj: extraIsHajj,
          templeName: extraTempleName,
          templeLocation: extraTempleLocation,
          resideTempleName: extraResideTempleName,
          resideTempleLocation: extraResideTempleLocation,
          ordinationDate: extraOrdinationDate,
        };
      } else if (leaveType === "MILITARY") {
        extraObj = {
          militaryOrderSource: extraMilitaryOrderSource,
          militaryOrderNo: extraMilitaryOrderNo,
          militaryOrderDate: extraMilitaryOrderDate,
          militaryDutyType: extraMilitaryDutyType,
          militaryLocation: extraMilitaryLocation,
        };
      } else if (leaveType === "STUDY") {
        extraObj = {
          userSalary: extraUserSalary,
          scholarshipName: extraScholarshipName,
          studyCountry: extraStudyCountry,
          studyDurationYears: extraStudyDurationYears,
          studyDurationMonths: extraStudyDurationMonths,
          studyDurationDays: extraStudyDurationDays,
        };
      }

      await submitLeaveRequest({
        type: leaveType,
        startDate,
        endDate,
        reason: formData.get("reason") as string,
        documentUrl: attachedFiles.length > 0 ? JSON.stringify(attachedFiles) : undefined,
        extraFields: Object.keys(extraObj).length > 0 ? JSON.stringify(extraObj) : undefined,
        reportedToDirector: isQuotaExceeded && quotaExceededAction === "ALLOW_WITH_MEMO" ? reportedToDirector : undefined,
      });
      showToast("success", t("submitSuccess"));
      router.push("/history");
    } catch (error: any) {
      showToast("error", error.message || t("submitError"));
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
                         {t("calculatedDays")}
                       </p>
                       <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                         {selectedType === "MATERNITY" 
                           ? t("calcCalendarDaysNote")
                           : t("calcWorkingDaysNote")
                         }
                       </p>
                     </div>
                     <div className="flex items-baseline gap-1 bg-white dark:bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                       <span className="text-3xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                         {calculatedCount}
                       </span>
                       <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t("days")}</span>
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
                         <p className="font-bold">{t("weekendWarningTitle")}</p>
                         <p className="opacity-90 font-medium leading-relaxed">
                           {t("weekendWarningDesc")}
                         </p>
                       </div>
                     </motion.div>
                   )}

                    {isPersonalLeaveInvalid && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/50 rounded-2xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300"
                      >
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-1">
                          <p className="font-bold">{t("personalLeaveAdvanceWarningTitle")}</p>
                          <p className="opacity-90 font-medium leading-relaxed">
                            {t("personalLeaveAdvanceWarningDesc")}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {isAccumulationRuleActive && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-3xl space-y-4 text-amber-800 dark:text-amber-300"
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-bold">{t("excessLeaveWarningTitle")}</p>
                            <p className="opacity-90 font-medium leading-relaxed">
                              {t("excessLeaveWarningDesc")
                                .replace("{limitTimes}", String(limitTimes))
                                .replace("{limitDays}", String(limitDays))
                                .split("\n").map((line, i) => (
                                  <span key={i} className={i === 1 ? "font-bold mt-1 block" : ""}>
                                    {line}
                                  </span>
                                ))
                              }
                            </p>
                          </div>
                        </div>
                        
                        <div className="border-t border-amber-200/50 dark:border-amber-900/30 pt-3">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={memoConfirmed}
                              onChange={(e) => setMemoConfirmed(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span>{t("confirmMemoCheckbox")}</span>
                          </label>
                        </div>
                      </motion.div>
                    )}

                    {/* Over-quota warning per leave type */}
                    {(() => {
                      if (!leaveUsage?.typeQuotas || !leaveUsage?.typeUsage) return null;
                      const quota = leaveUsage.typeQuotas[selectedType];
                      if (!quota || quota <= 0) return null;
                      const used = leaveUsage.typeUsage[selectedType] || 0;
                      const remaining = Math.max(quota - used, 0);
                      
                      // Calculate days being requested
                      const s = new Date(startDate);
                      const e = new Date(endDate);
                      let reqDays = 0;
                      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) {
                        if (selectedType === "MATERNITY") {
                          reqDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        } else {
                          const cur = new Date(s);
                          while (cur <= e) {
                            const day = cur.getDay();
                            if (day !== 0 && day !== 6) reqDays++;
                            cur.setDate(cur.getDate() + 1);
                          }
                        }
                      }

                      const willExceed = (used + reqDays) > quota;

                      if (!willExceed) return null;

                      if (quotaExceededAction === "BLOCK") {
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-3xl flex items-start gap-3.5 text-rose-800 dark:text-rose-300"
                          >
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <div className="text-xs space-y-1.5">
                              <p className="font-bold">{t("quotaExceedBlockedTitle")}</p>
                              <div className="opacity-90 font-medium leading-relaxed">
                                {t("quotaExceedBlockedDesc")
                                  .replace("{quota}", String(quota))
                                  .replace("{used}", String(used))
                                  .replace("{remaining}", String(remaining))
                                  .replace("{reqDays}", String(reqDays))
                                  .split("\n").map((line, i) => (
                                    <span key={i} className="block mt-0.5">
                                      {line}
                                    </span>
                                  ))
                                }
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      return (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-3xl space-y-4 text-amber-800 dark:text-amber-300"
                        >
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-xs space-y-1">
                              <p className="font-bold">{t("quotaExceedWarningTitle")}</p>
                              <div className="opacity-90 font-medium leading-relaxed">
                                {t("quotaExceedWarningDesc")
                                  .replace("{quota}", String(quota))
                                  .replace("{used}", String(used))
                                  .replace("{remaining}", String(remaining))
                                  .replace("{reqDays}", String(reqDays))
                                  .split("\n").map((line, i) => (
                                    <span key={i} className="block mt-0.5">
                                      {line}
                                    </span>
                                  ))
                                }
                              </div>
                              <p className="font-bold text-amber-700 dark:text-amber-200 mt-1.5 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                {t("directorAutoNotify")}
                              </p>
                            </div>
                          </div>
                          
                          <div className="border-t border-amber-200/50 dark:border-amber-900/30 pt-3">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                              <input
                                type="checkbox"
                                checked={reportedToDirector}
                                onChange={(e) => setReportedToDirector(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span>{t("reportedToDirectorCheckbox")}</span>
                            </label>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </div>
                );
              })()}

            {/* Conditional input fields for special leave types */}
            {selectedType === "PATERNITY" && (
              <div className="p-6 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-200/50 dark:border-purple-900/40 rounded-2xl space-y-4">
                <h4 className="font-bold text-sm text-purple-600 dark:text-purple-400">{t("paternityInfoTitle")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("wifeNameLabel")}</label>
                    <input type="text" value={extraWifeName} onChange={(e) => setExtraWifeName(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("wifeBirthDateLabel")}</label>
                    <input type="date" value={extraWifeBirthDate} onChange={(e) => setExtraWifeBirthDate(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={extraHasMarriageCert} onChange={(e) => setExtraHasMarriageCert(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                    <span>{t("attachMarriageCert")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={extraHasBirthCert} onChange={(e) => setExtraHasBirthCert(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                    <span>{t("attachBirthCert")}</span>
                  </label>
                </div>
              </div>
            )}

            {selectedType === "VACATION" && (
              <div className="p-6 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-200/50 dark:border-purple-900/40 rounded-2xl space-y-4">
                <h4 className="font-bold text-sm text-purple-600 dark:text-purple-400">{t("vacationInfoTitle")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("accumulatedVacationLabel")}</label>
                    <input type="number" min={0} value={extraVacationAccumulated} onChange={(e) => setExtraVacationAccumulated(Number(e.target.value))} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("yearlyVacationLabel")}</label>
                    <input type="number" min={0} value={extraVacationThisYear} onChange={(e) => setExtraVacationThisYear(Number(e.target.value))} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>
            )}

            {selectedType === "ORDINATION" && (
              <div className="p-6 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-200/50 dark:border-purple-900/40 rounded-2xl space-y-4">
                <h4 className="font-bold text-sm text-purple-600 dark:text-purple-400">{t("ordinationInfoTitle")}</h4>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={extraIsHajj} onChange={(e) => setExtraIsHajj(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                    <span>{t("isHajjCheckbox")}</span>
                  </label>
                </div>
                
                {!extraIsHajj ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("templeNameLabel")}</label>
                      <input type="text" value={extraTempleName} onChange={(e) => setExtraTempleName(e.target.value)} required={!extraIsHajj} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="ชื่อวัด..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("templeLocationLabel")}</label>
                      <input type="text" value={extraTempleLocation} onChange={(e) => setExtraTempleLocation(e.target.value)} required={!extraIsHajj} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="ตำบล อำเภอ จังหวัด..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("resideTempleNameLabel")}</label>
                      <input type="text" value={extraResideTempleName} onChange={(e) => setExtraResideTempleName(e.target.value)} required={!extraIsHajj} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="ชื่อวัดจำพรรษา..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("resideTempleLocationLabel")}</label>
                      <input type="text" value={extraResideTempleLocation} onChange={(e) => setExtraResideTempleLocation(e.target.value)} required={!extraIsHajj} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="ตำบล อำเภอ จังหวัด..." />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("ordinationDateLabel")}</label>
                    <input type="date" value={extraOrdinationDate} onChange={(e) => setExtraOrdinationDate(e.target.value)} required={extraIsHajj} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                )}
              </div>
            )}

            {selectedType === "MILITARY" && (
              <div className="p-6 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-200/50 dark:border-purple-900/40 rounded-2xl space-y-4">
                <h4 className="font-bold text-sm text-purple-600 dark:purple-400">{t("militaryInfoTitle")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("militaryOrderSourceLabel")}</label>
                    <input type="text" value={extraMilitaryOrderSource} onChange={(e) => setExtraMilitaryOrderSource(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="เช่น กองทัพบก / นายอำเภอ..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("militaryOrderNoLabel")}</label>
                    <input type="text" value={extraMilitaryOrderNo} onChange={(e) => setExtraMilitaryOrderNo(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="เลขที่หมายเรียก..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("militaryOrderDateLabel")}</label>
                    <input type="date" value={extraMilitaryOrderDate} onChange={(e) => setExtraMilitaryOrderDate(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("militaryDutyTypeLabel")}</label>
                    <input type="text" value={extraMilitaryDutyType} onChange={(e) => setExtraMilitaryDutyType(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="เช่น เข้ารับการตรวจเลือก / เตรียมพล..." />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("militaryLocationLabel")}</label>
                    <input type="text" value={extraMilitaryLocation} onChange={(e) => setExtraMilitaryLocation(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="สถานที่รายงานตัว..." />
                  </div>
                </div>
              </div>
            )}

            {selectedType === "STUDY" && (
              <div className="p-6 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-200/50 dark:border-purple-900/40 rounded-2xl space-y-4">
                <h4 className="font-bold text-sm text-purple-600 dark:text-purple-400">{t("studyInfoTitle")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("userSalaryLabel")}</label>
                    <input type="text" value={extraUserSalary} onChange={(e) => setExtraUserSalary(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("scholarshipNameLabel")}</label>
                    <input type="text" value={extraScholarshipName} onChange={(e) => setExtraScholarshipName(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" placeholder="เช่น ทุนส่วนตัว / ทุนรัฐบาล..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("studyCountryLabel")}</label>
                    <input type="text" value={extraStudyCountry} onChange={(e) => setExtraStudyCountry(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("durationYearsLabel")}</label>
                    <input type="number" min={0} value={extraStudyDurationYears} onChange={(e) => setExtraStudyDurationYears(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("durationMonthsLabel")}</label>
                    <input type="number" min={0} max={11} value={extraStudyDurationMonths} onChange={(e) => setExtraStudyDurationMonths(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("durationDaysLabel")}</label>
                    <input type="number" min={0} max={30} value={extraStudyDurationDays} onChange={(e) => setExtraStudyDurationDays(e.target.value)} required className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>
            )}

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
                {t("attachDocument")} {isAccumulationRuleActive ? <span className="text-rose-500 font-bold">({t("attachDocRequired")})</span> : <span className="text-slate-400 font-normal">{t("optionalLabel")}</span>}
              </label>

              {attachedFiles.length > 0 && (
                <div className="space-y-3 mb-3">
                  {attachedFiles.map((file, index) => (
                    <div key={index} className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                      <button type="button" onClick={() => removeDocument(index)} className="absolute top-2 right-2 w-8 h-8 bg-slate-100 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-full flex items-center justify-center transition-colors group z-10">
                        <X className="w-4 h-4 text-slate-500 group-hover:text-rose-500" />
                      </button>
                      <div className="flex items-center gap-4">
                        {file.preview.startsWith("data:image") ? (
                          <img src={file.preview} alt="เอกสารแนบ" className="w-20 h-20 object-cover rounded-xl border border-slate-100 dark:border-slate-700" />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-rose-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
                          <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> {t("fileAttached")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {attachedFiles.length < 2 && (
                <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-all cursor-pointer group">
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} className="hidden" />
                  <Paperclip className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:text-purple-400 transition-colors mb-2" />
                  <span className="text-sm text-slate-400 group-hover:text-purple-500 transition-colors">
                    {attachedFiles.length === 1 ? t("attachFile2") : t("clickToAttach")}
                  </span>
                  <span className="text-xs text-slate-300 dark:text-slate-600 mt-1">{t("maxFileSize")}</span>
                </label>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={
                  loading ||
                  isPersonalLeaveInvalid ||
                  (isAccumulationRuleActive && (!memoConfirmed || attachedFiles.length === 0)) ||
                  (isQuotaExceeded && quotaExceededAction === "BLOCK") ||
                  (isQuotaExceeded && quotaExceededAction === "ALLOW_WITH_MEMO" && !reportedToDirector)
                }
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-slate-800 dark:hover:bg-slate-100 focus:ring-4 focus:ring-slate-900/20 transition-all disabled:opacity-50"
              >
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
                      <span className="text-slate-700 dark:text-slate-300">{t("usedQuotaTimes")}</span>
                      <span className="text-slate-900 dark:text-white">{leaveUsage.totalTimes} / {limitTimes} {t("timesUnit")}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((leaveUsage.totalTimes / limitTimes) * 100, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${leaveUsage.totalTimes >= limitTimes ? 'bg-rose-500' : 'bg-purple-500'}`}
                      />
                    </div>
                  </div>

                  {/* Global Days Progress */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300">จำนวนวันที่ใช้สิทธิ์ไปแล้ว</span>
                      <span className="text-slate-900 dark:text-white">{leaveUsage.totalDays} / {limitDays} วัน</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((leaveUsage.totalDays / limitDays) * 100, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className={`h-full rounded-full ${leaveUsage.totalDays >= limitDays ? 'bg-rose-500' : 'bg-blue-500'}`}
                      />
                    </div>
                  </div>

                  {leaveUsage.isWarning && (
                    <div className="flex items-center gap-2 mt-4 p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-800 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                        คุณใช้สิทธิ์ลารวมถึงเกณฑ์ ({limitTimes} ครั้ง หรือ {limitDays} วัน) แล้ว ต้องแนบบันทึกข้อความเสนอ ผอ.
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
