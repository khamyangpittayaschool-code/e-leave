"use client";

import { useState, useEffect } from "react";
import { getSystemSettings, updateSystemSettings, updateFooter, generateBackup, getLeaveConfigs, updateLeaveConfig } from "@/app/actions/settings";
import { archiveCurrentCycle, importBackupFromJson, exportLeaveBackup, importLeaveBackup } from "@/app/actions/archive";
import { adminClearAllLeaveData } from "@/app/actions/leave";
import { uploadLogo } from "@/app/actions/upload";
import { useSession } from "@/lib/auth-client";
import { Save, Image as ImageIcon, ShieldAlert, DownloadCloud, Code, Settings2, Archive, UploadCloud, Database, FileJson, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState<any>(null);
  const [schoolName, setSchoolName] = useState("");
  const [subheader, setSubheader] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [footerText, setFooterText] = useState("");
  const [developerSecret, setDeveloperSecret] = useState("");
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState("");
  const [lineTargetGroupId, setLineTargetGroupId] = useState("");
  const [leaveRules, setLeaveRules] = useState("");
  
  const [leaveConfigs, setLeaveConfigs] = useState<any[]>([]);
  
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingFooter, setIsSavingFooter] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSavingLeave, setIsSavingLeave] = useState<string | null>(null);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [isSavingAllQuotas, setIsSavingAllQuotas] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isExportingLeave, setIsExportingLeave] = useState(false);
  const [isImportingLeave, setIsImportingLeave] = useState(false);
  const [importLeaveMode, setImportLeaveMode] = useState<"merge" | "replace">("merge");
  const [importLeaveResult, setImportLeaveResult] = useState<any>(null);

  useEffect(() => {
    getSystemSettings().then((data) => {
      setSettings(data);
      setSchoolName(data.schoolName);
      setSubheader(data.subheader);
      setLogoUrl(data.logoUrl || "");
      setFooterText(data.footerText);
      setLineChannelAccessToken(data.lineChannelAccessToken || "");
      setLineTargetGroupId(data.lineTargetGroupId || "");
      setLeaveRules(data.leaveRules || "");
    });

    getLeaveConfigs().then(setLeaveConfigs);
  }, []);

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    try {
      await updateSystemSettings({ schoolName, subheader, logoUrl, lineChannelAccessToken, lineTargetGroupId, leaveRules });
      alert("บันทึกการตั้งค่าทั่วไปสำเร็จ");
    } catch (error: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (error?.message || error));
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleFooterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingFooter(true);
    try {
      await updateFooter({ footerText, developerSecret });
      alert("อัปเดต Footer สำเร็จ");
      setDeveloperSecret(""); // Clear secret after success
    } catch (error: any) {
      alert(error.message === "Invalid Developer Secret" ? "รหัสลับนักพัฒนาไม่ถูกต้อง!" : "เกิดข้อผิดพลาด");
    } finally {
      setIsSavingFooter(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("logo", e.target.files[0]);

    try {
      const res = await uploadLogo(formData);
      if (res.success) {
        setLogoUrl(res.url);
      }
    } catch (error) {
      alert("อัปโหลดโลโก้ไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const backupString = await generateBackup();
      const blob = new Blob([backupString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sura-leave-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการสำรองข้อมูล");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleLeaveSubmit = async (configId: string, maxDaysPerYear: number, warningThreshold: number) => {
    setIsSavingLeave(configId);
    try {
      await updateLeaveConfig(configId, { maxDaysPerYear, warningThreshold });
      alert("บันทึกข้อกำหนดการลาสำเร็จ");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อกำหนดการลา");
    } finally {
      setIsSavingLeave(null);
    }
  };

  const handleSaveLeaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRules(true);
    try {
      await updateSystemSettings({ 
        schoolName, 
        subheader, 
        logoUrl, 
        lineChannelAccessToken, 
        lineTargetGroupId, 
        leaveRules 
      });
      alert("บันทึกข้อความแสดงผลข้อกำหนดการลาสำเร็จ");
    } catch (error: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (error?.message || error));
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleQuotaChange = (id: string, field: "maxDaysPerYear" | "warningThreshold", value: number) => {
    setLeaveConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSaveAllQuotas = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAllQuotas(true);
    try {
      await Promise.all(
        leaveConfigs.map(c => 
          updateLeaveConfig(c.id, { 
            maxDaysPerYear: Number(c.maxDaysPerYear), 
            warningThreshold: Number(c.warningThreshold) 
          })
         )
      );
      alert("บันทึกโควตาการลาทั้งหมดสำเร็จ");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกโควตาการลา");
    } finally {
      setIsSavingAllQuotas(false);
    }
  };


  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("คำเตือน: การนำเข้าข้อมูลสำรองจะลบการตั้งค่าปัจจุบันและเขียนทับใหม่ทั้งหมด ต้องการดำเนินการต่อหรือไม่?")) {
      e.target.value = "";
      return;
    }

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          await importBackupFromJson(jsonString);
          alert("นำเข้าข้อมูลและกู้คืนระบบสำเร็จ กรุณารีเฟรชหน้าเว็บ");
          window.location.reload();
        } catch (err: any) {
          alert("เกิดข้อผิดพลาดในการนำเข้า: " + err.message);
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์");
      setIsImporting(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm("⚠️ คำเตือนร้ายแรง: คุณกำลังจะลบ 'ข้อมูลประวัติการลาทั้งหมด' ออกจากระบบ!\nข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้ (ยกเว้นจะมี Backup)\n\nคุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?")) {
      return;
    }
    const confirmText = prompt("พิมพ์คำว่า 'CONFIRM' เพื่อยืนยันการลบข้อมูลการลาทั้งหมด:");
    if (confirmText !== 'CONFIRM') {
      alert("ยกเลิกการลบข้อมูล (พิมพ์ไม่ถูกต้อง)");
      return;
    }

    setIsClearing(true);
    try {
      await adminClearAllLeaveData();
      alert("ล้างข้อมูลการลาทั้งหมดเรียบร้อยแล้ว");
      window.location.reload();
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + (error.message || "ไม่สามารถลบข้อมูลได้"));
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportLeave = async () => {
    setIsExportingLeave(true);
    try {
      const backupString = await exportLeaveBackup();
      const blob = new Blob([backupString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `eleave-leave-data-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Parse and show summary
      const parsed = JSON.parse(backupString);
      alert(`สำรองข้อมูลการลาสำเร็จ!\n\nปีงบประมาณ: ${parsed.fiscalYear}\nจำนวนทั้งหมด: ${parsed.summary.totalRequests} รายการ\nอนุมัติ: ${parsed.summary.approved} | ปฏิเสธ: ${parsed.summary.rejected} | รอดำเนินการ: ${parsed.summary.pending}`);
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + (error.message || "ไม่สามารถสำรองข้อมูลได้"));
    } finally {
      setIsExportingLeave(false);
    }
  };

  const handleImportLeave = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const modeText = importLeaveMode === "merge" 
      ? "โหมดผสาน (Merge): จะเพิ่มเฉพาะรายการใหม่ ไม่ลบของเดิม" 
      : "แทนที่ (Replace): จะลบข้อมูลเดิมในปีงบประมาณเดียวกัน แล้วเขียนทับด้วยข้อมูลจากไฟล์";

    if (!confirm(`คำเตือน: กำลังจะนำเข้าข้อมูลการลาในโหมด "${modeText}"\n\nต้องการดำเนินการต่อหรือไม่?`)) {
      e.target.value = "";
      return;
    }

    setIsImportingLeave(true);
    setImportLeaveResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonString = event.target?.result as string;
          const result = await importLeaveBackup(jsonString, importLeaveMode);
          setImportLeaveResult(result);
        } catch (err: any) {
          alert("เกิดข้อผิดพลาด: " + err.message);
        } finally {
          setIsImportingLeave(false);
        }
      };
      reader.readAsText(file);
    } catch {
      alert("ไม่สามารถอ่านไฟล์ได้");
      setIsImportingLeave(false);
    }
    e.target.value = "";
  };

  if (!settings) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-40 bg-gray-200 rounded"></div></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t("settingsTitle")}</h1>
        <p className="text-muted-foreground text-gray-500">{t("settingsSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (General Settings & Leave Config) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-4">
              {t("generalSettings")}
            </h3>
            
            <form onSubmit={handleGeneralSubmit} className="space-y-5">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("schoolLogo")}</label>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                    <label 
                      htmlFor="logo-upload" 
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {isUploading ? t("uploading") : t("uploadNewImage")}
                    </label>
                    <p className="text-xs text-gray-500 mt-2">รองรับไฟล์ PNG, JPG ขนาดไม่เกิน 2MB (ไฟล์จะบันทึกในเซิร์ฟเวอร์)</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("schoolName")}</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("subheaderLabel")}</label>
                <input
                  type="text"
                  required
                  value={subheader}
                  onChange={(e) => setSubheader(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">{t("lineSettings")}</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Access Token</label>
                    <input
                      type="text"
                      value={lineChannelAccessToken}
                      onChange={(e) => setLineChannelAccessToken(e.target.value)}
                      placeholder="ใส่ Channel Access Token (Long-lived) จาก LINE Developers"
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Group ID (หรือ User ID)</label>
                    <input
                      type="text"
                      value={lineTargetGroupId}
                      onChange={(e) => setLineTargetGroupId(e.target.value)}
                      placeholder="ใส่ Group ID หรือ User ID ที่ต้องการให้บอทส่งข้อความไป"
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      ใช้สำหรับการส่งแจ้งเตือนแบบ Push Message ผ่าน LINE Messaging API บอทต้องอยู่ในกลุ่มนั้นแล้ว หรือส่งเข้าหาผู้ใช้โดยตรงด้วย User ID
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingGeneral}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingGeneral ? t("saving") : t("saveSettings")}
                </button>
              </div>
            </form>
          </div>

           {/* Leave Configuration */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-500" />
              {t("leaveQuotaConfig")}
            </h3>
            
            <form onSubmit={handleSaveAllQuotas} className="space-y-4">
              {/* Quota Guideline Banner */}
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200/40 dark:border-purple-900/40 rounded-xl text-xs text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-purple-500 shrink-0" />
                <span>💡 {lang === "en" ? "Tip: Setting max quota to 0 makes that leave type unlimited (e.g. sick leave)." : "คำแนะนำ: หากกำหนดค่าโควตาสูงสุดเป็น 0 จะหมายถึง 'ไม่จำกัดจำนวนวันทำการ' (เช่น ลาป่วย)"}</span>
              </div>

              <div className="space-y-4">
                {leaveConfigs.map((config) => (
                  <div 
                    key={config.id} 
                    className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50"
                  >
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">{config.name}</label>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{config.type}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("maxQuota")}</label>
                      <input 
                        type="number" 
                        value={config.maxDaysPerYear || 0} 
                        onChange={(e) => handleQuotaChange(config.id, "maxDaysPerYear", Number(e.target.value))}
                        className="w-full sm:w-28 h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("warnWhenLeft")}</label>
                      <input 
                        type="number" 
                        value={config.warningThreshold || 0} 
                        onChange={(e) => handleQuotaChange(config.id, "warningThreshold", Number(e.target.value))}
                        className="w-full sm:w-28 h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500/20" 
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingAllQuotas}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/10 focus:ring-4 focus:ring-purple-500/20 transition-all text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingAllQuotas ? t("saving") : (lang === "en" ? "Save All Quotas" : "บันทึกโควตาการลาทั้งหมด")}
                </button>
              </div>
            </form>
          </div>

          {/* Leave Rules Editor */}
          <form onSubmit={handleSaveLeaveRules} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-amber-100 dark:border-amber-900/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-[100px] -z-10" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              {t("leaveRulesDisplay")}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {t("leaveRulesDesc")}
            </p>
            <textarea
              rows={5}
              value={leaveRules}
              onChange={(e) => setLeaveRules(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
              placeholder="การลากิจต้องยื่นคำขอล่วงหน้าอย่างน้อย 3 วันทำการ&#10;การลาป่วยติดต่อกันเกิน 3 วัน ต้องแนบใบรับรองแพทย์"
            />
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">* {lang === "en" ? "This text will be shown on the leave request form" : "ข้อความนี้จะแสดงผลบนหน้าต่างยื่นใบคำขอลาของบุคลากร"}</p>
              <button
                type="submit"
                disabled={isSavingRules}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md shadow-amber-500/10 focus:ring-4 focus:ring-amber-500/20 transition-all text-sm disabled:opacity-50 shrink-0 self-end"
              >
                <Save className="w-4 h-4" />
                {isSavingRules ? t("saving") : (lang === "en" ? "Save Rules Text" : "บันทึกข้อความแสดงผล")}
              </button>
            </div>
          </form>


        </div>

        {/* Right Column (Advanced Settings) */}
        <div className="space-y-6">
          
          {/* Footer Settings */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-rose-100 dark:border-rose-900/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-[100px] -z-10" />
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              {t("footerSettings")}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              ส่วนนี้ต้องการ <span className="font-semibold text-rose-600">รหัสลับนักพัฒนา</span> ในการแก้ไข
            </p>

            <form onSubmit={handleFooterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("footerText")}</label>
                <input
                  type="text"
                  required
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Code className="w-3.5 h-3.5" /> Developer Secret
                </label>
                <input
                  type="password"
                  required
                  value={developerSecret}
                  onChange={(e) => setDeveloperSecret(e.target.value)}
                  placeholder="ใส่รหัสลับที่นี่"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingFooter}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 focus:ring-4 focus:ring-rose-500/20 transition-all text-sm disabled:opacity-50"
              >
                {isSavingFooter ? t("checking") : t("confirmFooter")}
              </button>
            </form>
          </div>

          {/* Leave Data Backup */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-start gap-2 mb-2">
              <Database className="w-5 h-5 text-purple-500 mt-1 shrink-0" />
              <div>
                <span className="block">{lang === "th" ? "สำรองข้อมูลการลา" : "Leave Backup"}</span>
                <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  (Leave Backup)
                </span>
              </div>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              {t("leaveBackupDesc") || "นำออกข้อมูลการลาปีงบประมาณปัจจุบันเป็นไฟล์ JSON หรือนำเข้าไฟล์ JSON เพื่อกู้คืนข้อมูลการลา"}
            </p>
            
            <div className="space-y-4">
              {/* Export */}
              <button
                onClick={handleExportLeave}
                disabled={isExportingLeave}
                className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 font-bold text-sm transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 justify-center">
                  <FileJson className="w-4 h-4 shrink-0" />
                  <span>{isExportingLeave ? (lang === "en" ? "Backing up..." : "กำลังส่งออกข้อมูล...") : "ส่งออกข้อมูลการลา"}</span>
                </div>
                {!isExportingLeave && (
                  <span className="text-[10px] font-semibold text-purple-500/70 dark:text-purple-400/70">
                    (Export Leave Data)
                  </span>
                )}
              </button>

              {/* Import Mode Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 space-y-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 justify-center">
                  <UploadCloud className="w-4 h-4 text-purple-500" /> {t("importModeLabel") || "เลือกโหมดการนำเข้า"}
                </p>
                
                {/* Segmented Control */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setImportLeaveMode("merge")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      importLeaveMode === "merge"
                        ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    ผสาน
                    <span className="block text-[10px] font-semibold opacity-80">(Merge)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportLeaveMode("replace")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      importLeaveMode === "replace"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-rose-500"
                    }`}
                  >
                    แทนที่
                    <span className="block text-[10px] font-semibold opacity-80">(Replace)</span>
                  </button>
                </div>

                {/* Inline Helper Description */}
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal text-center min-h-[32px] flex items-center justify-center px-1">
                  {importLeaveMode === "merge"
                    ? (lang === "en" ? "Only new records will be added without deleting existing data" : "เพิ่มเฉพาะรายการใหม่โดยไม่ลบหรือส่งผลต่อข้อมูลเดิม")
                    : (lang === "en" ? "Warning: All current leave records will be completely replaced" : "⚠️ ระวัง: ข้อมูลการลาปัจจุบันทั้งหมดจะถูกลบและเขียนทับด้วยข้อมูลใหม่")}
                </p>

                <label className={`w-full flex flex-col items-center justify-center gap-0.5 py-3 px-4 rounded-xl border-2 border-dashed font-semibold cursor-pointer transition-all disabled:opacity-50 text-xs ${
                  importLeaveMode === "replace"
                    ? "border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
                    : "border-purple-200 dark:border-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
                }`}>
                  <div className="flex items-center gap-1.5 justify-center">
                    <UploadCloud className="w-4 h-4 shrink-0" />
                    <span>{isImportingLeave ? (lang === "en" ? "Importing..." : "กำลังนำเข้าข้อมูล...") : "นำเข้าไฟล์ JSON"}</span>
                  </div>
                  {!isImportingLeave && (
                    <span className="text-[10px] font-semibold opacity-70">
                      (Import Leave Data)
                    </span>
                  )}
                  <input type="file" accept=".json" className="hidden" onChange={handleImportLeave} disabled={isImportingLeave} />
                </label>
              </div>

              {/* Import Result */}
              {importLeaveResult && (
                <div className={`rounded-2xl p-4 border text-xs ${
                  importLeaveResult.errors?.length > 0
                    ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-900/50"
                    : "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/50"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {importLeaveResult.errors?.length > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{t("importResult")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-1">
                    <div className="bg-white/80 dark:bg-slate-800 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                      <div className="font-bold text-sm text-emerald-600">{importLeaveResult.imported}</div>
                      <div className="text-[10px] text-slate-400">{t("importedSuccess")}</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                      <div className="font-bold text-sm text-slate-400">{importLeaveResult.skipped}</div>
                      <div className="text-[10px] text-slate-400">{t("skipped")}</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-800 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                      <div className="font-bold text-sm text-purple-600">{importLeaveResult.total}</div>
                      <div className="text-[10px] text-slate-400">{t("total")}</div>
                    </div>
                  </div>
                  {importLeaveResult.errors?.length > 0 && (
                    <div className="mt-2 text-slate-600 dark:text-slate-400 space-y-1">
                      <p className="font-bold">{t("errorDetails")}</p>
                      {importLeaveResult.errors.map((err: string, i: number) => (
                        <p key={i} className="pl-2">• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Backup Data */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <DownloadCloud className="w-5 h-5 text-teal-500" />
              {t("systemBackup") || "ระบบสำรองข้อมูล"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              {t("systemBackupDesc") || "สำรองข้อมูลการตั้งค่าและประวัติทั้งหมด"}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/50 font-semibold text-sm transition-all disabled:opacity-50"
              >
                <DownloadCloud className="w-4 h-4" />
                {isBackingUp ? t("creatingBackup") : t("exportBackup")}
              </button>

              <label className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-teal-200 dark:border-teal-900/50 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-50/50 dark:hover:bg-teal-950/20 cursor-pointer transition-all disabled:opacity-50 text-xs">
                <UploadCloud className="w-4 h-4" />
                {isImporting ? t("importingData") : t("importBackup")}
                <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} disabled={isImporting} />
              </label>
            </div>
          </div>

          {/* Danger Zone */}
          {(session?.user as any)?.role === "ADMIN" || (session?.user as any)?.position === "แอดมิน" ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-rose-200 dark:border-rose-900/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-[100px] -z-10" />
              <h3 className="text-lg font-semibold mb-2 text-rose-600 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                {t("dangerZone")}
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                {t("dangerZoneDesc")}
              </p>
              <button
                onClick={handleClearData}
                disabled={isClearing}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 focus:ring-4 focus:ring-rose-500/20 transition-all disabled:opacity-50"
              >
                {isClearing ? t("clearing") : t("clearAllLeave")}
              </button>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
