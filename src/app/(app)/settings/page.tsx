"use client";

import { useState, useEffect } from "react";
import { getSystemSettings, updateSystemSettings, updateFooter, generateBackup, getLeaveConfigs, updateLeaveConfig, updateLeaveRules, setImpersonationCookie, clearImpersonation, getEligibleInspectors, updateDefaultInspector } from "@/app/actions/settings";
import { archiveCurrentCycle, importBackupFromJson, exportLeaveBackup, importLeaveBackup } from "@/app/actions/archive";
import { adminClearAllLeaveData } from "@/app/actions/leave";
import { uploadLogo } from "@/app/actions/upload";
import { useSession } from "@/lib/auth-client";
import { Save, Image as ImageIcon, ShieldAlert, DownloadCloud, Code, Settings2, Archive, UploadCloud, Database, FileJson, AlertTriangle, CheckCircle2, ChevronRight, ArrowLeft, Bell, Type, Users, BookOpen, HardDrive, UserCog, FileSpreadsheet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import * as XLSX from "xlsx";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState<any>(null);
  const [schoolName, setSchoolName] = useState("");
  const [subheader, setSubheader] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [footerText, setFooterText] = useState("");
  const [developerSecret, setDeveloperSecret] = useState("");
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState("");
  const [lineTargetGroupId, setLineTargetGroupId] = useState("");
  const [enableLineNotify, setEnableLineNotify] = useState(true);
  const [leaveRules, setLeaveRules] = useState("");
  const [requirePersonalAdvance, setRequirePersonalAdvance] = useState(true);
  const [memoThresholdTimes, setMemoThresholdTimes] = useState(6);
  const [memoThresholdDays, setMemoThresholdDays] = useState(15);
  const [actingDirectorTitle, setActingDirectorTitle] = useState("");
  const [actingDirectorTitleType, setActingDirectorTitleType] = useState("รักษาการในตำแหน่งผู้อำนวยการโรงเรียน");
  const [customActingDirectorTitle, setCustomActingDirectorTitle] = useState("");
  const [finalApproverUserIds, setFinalApproverUserIds] = useState<string[]>([]);
  const [showActingDirectorTitle, setShowActingDirectorTitle] = useState(true);
  const [pdfFont, setPdfFont] = useState("Prompt");
  const [googleDriveFormat, setGoogleDriveFormat] = useState("PDF");
  const [isImpersonating, setIsImpersonating] = useState(false);
  
  const [leaveConfigs, setLeaveConfigs] = useState<any[]>([]);
  const [defaultInspectorId, setDefaultInspectorId] = useState("");
  const [eligibleInspectors, setEligibleInspectors] = useState<any[]>([]);
  
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

  // Drill-down navigation state
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    getSystemSettings().then((data) => {
      setSettings(data);
      setSchoolName(data.schoolName);
      setSubheader(data.subheader);
      setAffiliation(data.affiliation || "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาอุดรธานี");
      setLogoUrl(data.logoUrl || "");
      setFooterText(data.footerText);
      setLineChannelAccessToken(data.lineChannelAccessToken || "");
      setLineTargetGroupId(data.lineTargetGroupId || "");
      setEnableLineNotify(data.enableLineNotify !== false);
      setLeaveRules(data.leaveRules || "");
      setRequirePersonalAdvance(data.requirePersonalAdvance !== false);
      setMemoThresholdTimes(data.memoThresholdTimes ?? 6);
      setMemoThresholdDays(data.memoThresholdDays ?? 15);
      setDefaultInspectorId(data.defaultInspectorId || "");
      const loadedTitle = data.actingDirectorTitle || "รักษาการในตำแหน่งผู้อำนวยการโรงเรียน";
      setActingDirectorTitle(loadedTitle);
      if ([
        "ปฏิบัติราชการแทนผู้อำนวยการโรงเรียน",
        "รักษาราชการแทนผู้อำนวยการโรงเรียน",
        "รักษาการในตำแหน่งผู้อำนวยการโรงเรียน"
      ].includes(loadedTitle)) {
        setActingDirectorTitleType(loadedTitle);
      } else {
        setActingDirectorTitleType("custom");
        setCustomActingDirectorTitle(loadedTitle);
      }
      setFinalApproverUserIds(
        data.finalApproverUserIds
          ? data.finalApproverUserIds.split(",").map((s: string) => s.trim()).filter(Boolean)
          : []
      );
      setShowActingDirectorTitle(data.showActingDirectorTitle !== false);
      setPdfFont(data.pdfFont || "Prompt");
      setGoogleDriveFormat(data.googleDriveFormat || "PDF");
    });

    getEligibleInspectors().then(setEligibleInspectors);
    getLeaveConfigs().then(setLeaveConfigs);
  }, []);

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    try {
      await updateSystemSettings({ 
        schoolName, 
        subheader, 
        affiliation,
        logoUrl, 
        lineChannelAccessToken, 
        lineTargetGroupId, 
        enableLineNotify,
        leaveRules, 
        requirePersonalAdvance,
        memoThresholdTimes,
        memoThresholdDays,
        defaultInspectorId: defaultInspectorId || null,
        actingDirectorTitle: actingDirectorTitleType === "custom" ? customActingDirectorTitle : actingDirectorTitleType,
        finalApproverUserIds: finalApproverUserIds.join(","),
        showActingDirectorTitle,
        pdfFont,
        googleDriveFormat
      });
      alert("บันทึกการตั้งค่าทั่วไปสำเร็จ");
    } catch (error: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (error?.message || error));
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleImpersonate = async (position: string | null, role: string | null) => {
    setIsImpersonating(true);
    try {
      await setImpersonationCookie(position, role);
      alert("จำลองบทบาทสำเร็จ กำลังรีโหลดหน้าเว็บ...");
      window.location.href = "/";
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + (error?.message || error));
      setIsImpersonating(false);
    }
  };

  const handleClearImpersonation = async () => {
    setIsImpersonating(true);
    try {
      await clearImpersonation();
      alert("คืนสถานะแอดมินสำเร็จ กำลังรีโหลด...");
      window.location.reload();
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + (error?.message || error));
      setIsImpersonating(false);
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
      const isHRHead = (session?.user as any)?.position === "หัวหน้างานบุคคล" || (session?.user as any)?.position === "เจ้าหน้าที่บุคคล";
      if (isHRHead) {
        await updateLeaveRules(leaveRules);
      } else {
        await updateSystemSettings({ 
          schoolName, 
          subheader, 
          logoUrl, 
          lineChannelAccessToken, 
          lineTargetGroupId, 
          enableLineNotify,
          leaveRules 
        });
      }
      alert("บันทึกข้อความแสดงผลข้อกำหนดการลาสำเร็จ");
    } catch (error: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (error?.message || error));
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleQuotaChange = (id: string, field: string, value: any) => {
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
            warningThreshold: Number(c.warningThreshold),
            isActive: c.isActive !== false
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

  const handleExportLeaveExcel = async () => {
    setIsExportingLeave(true);
    try {
      const backupString = await exportLeaveBackup();
      const parsed = JSON.parse(backupString);
      const leaveRequests = parsed.leaveRequests || [];
      const configs = parsed.leaveConfigs || [];

      // Create a map of Leave Type EN -> TH name for better human editing
      const typeMap: Record<string, string> = {};
      configs.forEach((c: any) => {
        typeMap[c.type] = c.name; // e.g. SICK -> "ลาป่วย"
      });

      // Prepare Excel rows
      const rows = leaveRequests.map((r: any) => ({
        "Email (อีเมล)": r.userEmail,
        "User Name (ชื่อ-นามสกุล)": r.userName,
        "Position (ตำแหน่ง)": r.userPosition || "",
        "Subject Group (กลุ่มสาระฯ/ฝ่าย)": r.userSubjectGroup || "",
        "Leave Type (ประเภทการลา)": typeMap[r.type] || r.type,
        "Start Date (วันที่เริ่ม YYYY-MM-DD)": r.startDate ? r.startDate.split("T")[0] : "",
        "End Date (วันที่สิ้นสุด YYYY-MM-DD)": r.endDate ? r.endDate.split("T")[0] : "",
        "Reason (เหตุผล)": r.reason || "",
        "Status (สถานะ)": r.status || "",
        "Attachment URL (เอกสารแนบ)": r.documentUrl || "",
      }));

      // Create sheet
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Data");

      // We can also create a second sheet containing Leave Configs/Quotas for reference!
      const configRows = configs.map((c: any) => ({
        "Type (ประเภทการลา - ภาษาอังกฤษ)": c.type,
        "Name (ชื่อประเภทการลา - ภาษาไทย)": c.name,
        "Max Days (จำนวนวันลาสูงสุด)": c.maxDaysPerYear,
        "Warning Threshold (เตือนเมื่อวันเหลือต่ำกว่า)": c.warningThreshold,
      }));
      const configSheet = XLSX.utils.json_to_sheet(configRows);
      XLSX.utils.book_append_sheet(workbook, configSheet, "Leave Configs");

      // Generate buffer and download
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `eleave-leave-data-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`สำรองข้อมูลการลาแบบ Excel สำเร็จ!\n\nปีงบประมาณ: ${parsed.fiscalYear}\nจำนวนทั้งหมด: ${parsed.summary.totalRequests} รายการ`);
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

    const isJson = file.name.endsWith(".json");
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let jsonPayloadString = "";

          if (isJson) {
            jsonPayloadString = event.target?.result as string;
          } else {
            // Excel (.xlsx, .xls) or CSV
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawRows = XLSX.utils.sheet_to_json(worksheet);

            // Read leave configs to construct type mapping if available
            const typeMap: Record<string, string> = {};
            leaveConfigs.forEach((c: any) => {
              typeMap[c.name.trim()] = c.type; // e.g. "ลาป่วย" -> "SICK"
            });

            // Date parsing helper
            const parseExcelDate = (val: any) => {
              if (!val) return new Date();
              if (val instanceof Date) return val;
              // If it's a number (Excel serial date)
              if (typeof val === 'number') {
                const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                return date;
              }
              // Try string parsing
              const str = String(val).trim();

              // Handle Thai/Slash date formats if any, like 24/06/2569 or 24-06-2026
              const dmy = str.split(/[\/\-\.]/);
              if (dmy.length === 3) {
                let d = parseInt(dmy[0]);
                let m = parseInt(dmy[1]) - 1; // 0-indexed month
                let y = parseInt(dmy[2]);
                if (y > 2500) y -= 543; // convert Buddhist era to Gregorian
                return new Date(y, m, d);
              }

              const parsedDate = new Date(str);
              if (!isNaN(parsedDate.getTime())) {
                return parsedDate;
              }
              return new Date();
            };

            const mappedRequests = rawRows.map((row: any) => {
              let userEmail = "";
              let userName = "";
              let userPosition = "";
              let userSubjectGroup = "";
              let typeRaw = "";
              let startDateRaw: any = "";
              let endDateRaw: any = "";
              let reason = "";
              let statusRaw = "";
              let documentUrl = "";

              Object.entries(row).forEach(([key, val]) => {
                const k = key.trim();
                const v = val !== undefined && val !== null ? String(val).trim() : "";
                if (!v) return;

                if (/email|อีเมล|mail/i.test(k)) {
                  userEmail = v;
                } else if (/username|ชื่อ/i.test(k)) {
                  userName = v;
                } else if (/position|ตำแหน่ง/i.test(k)) {
                  userPosition = v;
                } else if (/subject|กลุ่มสาระ|ฝ่าย|group/i.test(k)) {
                  userSubjectGroup = v;
                } else if (/type|ประเภท/i.test(k)) {
                  typeRaw = v;
                } else if (/start|เริ่ม|วันที่เริ่ม/i.test(k)) {
                  startDateRaw = val;
                } else if (/end|สิ้นสุด|ถึงวันที่|หมดวันที่/i.test(k)) {
                  endDateRaw = val;
                } else if (/reason|เหตุผล/i.test(k)) {
                  reason = v;
                } else if (/status|สถานะ/i.test(k)) {
                  statusRaw = v;
                } else if (/document|attachment|เอกสาร|แนบ|url/i.test(k)) {
                  documentUrl = v;
                }
              });

              // Map leave type using config names first
              let mappedType = typeRaw.trim();
              if (typeMap[mappedType]) {
                mappedType = typeMap[mappedType];
              } else {
                // Fallbacks
                if (mappedType.includes("ป่วย") || mappedType.toLowerCase().includes("sick")) {
                  mappedType = "SICK";
                } else if (mappedType.includes("กิจ") || mappedType.toLowerCase().includes("personal")) {
                  mappedType = "PERSONAL";
                } else if (mappedType.includes("พัก") || mappedType.toLowerCase().includes("vacation") || mappedType.includes("พักร้อน")) {
                  mappedType = "VACATION";
                }
              }

              // Map status
              let mappedStatus = "APPROVED";
              const s = statusRaw.trim();
              if (s.includes("อนุมัติ") && !s.includes("รอ") && !s.includes("ไม่")) {
                mappedStatus = "APPROVED";
              } else if (s.includes("ปฏิเสธ") || s.includes("ไม่อนุมัติ") || s.toLowerCase().includes("reject")) {
                mappedStatus = "REJECTED";
              } else if (s.includes("ยกเลิก") || s.toLowerCase().includes("cancel")) {
                mappedStatus = "CANCELLED";
              } else if (s.includes("รอ") || s.toLowerCase().includes("pending")) {
                mappedStatus = "PENDING_HEAD";
              }

              const startDate = parseExcelDate(startDateRaw);
              const endDate = parseExcelDate(endDateRaw);

              return {
                userName,
                userEmail,
                userPosition,
                userSubjectGroup,
                type: mappedType,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                reason,
                status: mappedStatus,
                documentUrl
              };
            });

            // Filter out invalid rows (must have email)
            const validRequests = mappedRequests.filter((r: any) => r.userEmail && r.startDate);

            const backupPayload = {
              _type: "eleave-leave-backup",
              _version: 1,
              exportedAt: new Date().toISOString(),
              exportedBy: (session?.user as any)?.name || (session?.user as any)?.email || "System",
              fiscalYear: "All",
              cycleStart: null,
              cycleEnd: null,
              leaveRequests: validRequests
            };

            jsonPayloadString = JSON.stringify(backupPayload);
          }

          const result = await importLeaveBackup(jsonPayloadString, importLeaveMode);
          setImportLeaveResult(result);
        } catch (err: any) {
          alert("เกิดข้อผิดพลาดในการประมวลผลไฟล์: " + err.message);
        } finally {
          setIsImportingLeave(false);
        }
      };

      if (isJson) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    } catch (err: any) {
      alert("ไม่สามารถอ่านไฟล์ได้: " + err.message);
      setIsImportingLeave(false);
    }
    e.target.value = "";
  };

  if (!settings) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-40 bg-gray-200 rounded"></div></div>;

  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN" || user?.position === "แอดมิน";
  const isHRHead = user?.position === "หัวหน้างานบุคคล" || user?.position === "เจ้าหน้าที่บุคคล";
  const isInspector = user?.position === "ผู้ตรวจสอบ";

  if (!isAdmin && !isHRHead && !isInspector) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-red-100 dark:border-red-900/30 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">เข้าถึงไม่ได้</h2>
        <p className="text-sm text-gray-500">คุณไม่มีสิทธิ์ในการเข้าถึงการตั้งค่าระบบ</p>
      </div>
    );
  }

  // --- Menu item definitions ---
  type MenuItem = {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
  };

  const systemSettingsItems: MenuItem[] = [
    { id: "school", icon: <BookOpen className="w-5 h-5 text-blue-500" />, title: lang === "en" ? "School Info" : "ข้อมูลโรงเรียน", description: lang === "en" ? "School name, affiliation, logo" : "ชื่อโรงเรียน, สังกัด, โลโก้" },
    { id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "Approval Chain" : "สายอนุมัติ", description: lang === "en" ? "Inspector, approver, acting director" : "ผู้ตรวจสอบ, ผู้อนุมัติ, ตำแหน่งรักษาการ" },
    { id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา", description: lang === "en" ? "Rules, quotas, restrictions" : "กฎระเบียบ, โควตาวันลา, ข้อจำกัด" },
    { id: "line", icon: <Bell className="w-5 h-5 text-green-500" />, title: lang === "en" ? "LINE Notification" : "แจ้งเตือน LINE", description: lang === "en" ? "Enable/disable, Token, Group ID" : "เปิด/ปิดการแจ้งเตือน, Token, Group ID" },
    { id: "font", icon: <Type className="w-5 h-5 text-indigo-500" />, title: lang === "en" ? "Font & File Format" : "ฟอนต์ & รูปแบบไฟล์", description: lang === "en" ? "Leave form font, Google Drive format" : "ฟอนต์ใบลา, รูปแบบอัปโหลด Google Drive" },
  ];

  const dataManagementItems: MenuItem[] = [
    { id: "backup", icon: <HardDrive className="w-5 h-5 text-teal-500" />, title: lang === "en" ? "Backup & Data" : "สำรองข้อมูล", description: lang === "en" ? "Export/Import, clear data" : "Export/Import, ปิดรอบ, ล้างข้อมูล" },
    ...((session?.user as any)?.isActualAdmin === true ? [
      { id: "impersonate", icon: <UserCog className="w-5 h-5 text-indigo-500" />, title: lang === "en" ? "Role Impersonation" : "จำลองบทบาท", description: lang === "en" ? "Simulate roles for testing" : "จำลองตำแหน่งเพื่อทดสอบระบบ" },
    ] : []),
    { id: "footer", icon: <Settings2 className="w-5 h-5 text-rose-500" />, title: lang === "en" ? "Footer Settings" : "ท้ายกระดาษ", description: lang === "en" ? "Website footer text" : "ข้อความท้ายหน้าเว็บ" },
  ];

  // HR Head sees only approval + leave-rules
  const hrHeadItems: MenuItem[] = [
    { id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "System & Approver Settings" : "สายอนุมัติ", description: lang === "en" ? "Inspector, approver, acting director" : "ผู้ตรวจสอบ, ผู้อนุมัติ, ตำแหน่งรักษาการ" },
    { id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา", description: lang === "en" ? "Rules, quotas, restrictions" : "กฎระเบียบ, โควตาวันลา, ข้อจำกัด" },
  ];

  // Inspector sees approval + leave-rules + backup
  const inspectorItems: MenuItem[] = [
    { id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "System & Approver Settings" : "สายอนุมัติ", description: lang === "en" ? "Inspector, approver, acting director" : "ผู้ตรวจสอบ, ผู้อนุมัติ, ตำแหน่งรักษาการ" },
    { id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา", description: lang === "en" ? "Rules, quotas, restrictions" : "กฎระเบียบ, โควตาวันลา, ข้อจำกัด" },
    { id: "backup", icon: <HardDrive className="w-5 h-5 text-teal-500" />, title: lang === "en" ? "Backup & Data" : "สำรองข้อมูล", description: lang === "en" ? "Export/Import, clear data" : "Export/Import, ปิดรอบ, ล้างข้อมูล" },
  ];

  // --- Section title lookup ---
  const sectionTitles: Record<string, string> = {
    school: lang === "en" ? "School Info" : "ข้อมูลโรงเรียน",
    approval: lang === "en" ? ((isHRHead || isInspector) ? "System & Approver Settings" : "Approval Chain") : ((isHRHead || isInspector) ? "ตั้งค่าผู้ตรวจสอบและผู้อนุมัติระบบ" : "สายอนุมัติ"),
    "leave-rules": lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา",
    line: lang === "en" ? "LINE Notification" : "แจ้งเตือน LINE",
    font: lang === "en" ? "Font & File Format" : "ฟอนต์ & รูปแบบไฟล์",
    backup: lang === "en" ? "Backup & Data" : "สำรองข้อมูล",
    impersonate: lang === "en" ? "Role Impersonation" : "จำลองบทบาท",
    footer: lang === "en" ? "Footer Settings" : "ท้ายกระดาษ",
  };

  // --- Menu Item Component ---
  const MenuItemRow = ({ item, onClick }: { item: MenuItem; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-gray-50 dark:hover:bg-gray-800/70 hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200 group text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{item.description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );

  // --- Detail Section Header ---
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={() => setActiveSection(null)}
        className="w-9 h-9 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shrink-0 shadow-sm"
      >
        <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
    </div>
  );

  // --- Sticky Save Bar ---
  const StickySaveBar = ({ onSubmit, isSaving, label, color = "indigo" }: { onSubmit?: () => void; isSaving: boolean; label: string; color?: string }) => {
    const colorMap: Record<string, string> = {
      indigo: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/20 shadow-indigo-500/10",
      purple: "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500/20 shadow-purple-500/10",
      amber: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20 shadow-amber-500/10",
      rose: "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/20 shadow-rose-500/10",
    };
    return (
      <div className="sticky bottom-0 left-0 right-0 py-4 -mx-6 px-6 md:-mx-8 md:px-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 mt-6">
        <button
          type="submit"
          onClick={onSubmit}
          disabled={isSaving}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold shadow-md focus:ring-4 transition-all text-sm disabled:opacity-50 ${colorMap[color] || colorMap.indigo}`}
        >
          <Save className="w-4 h-4" />
          {label}
        </button>
      </div>
    );
  };

  // --- Section Content Renderers ---

  const renderSchoolSection = () => (
    <form onSubmit={handleGeneralSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
      <SectionHeader title={sectionTitles.school} />
      <div className="space-y-5">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สังกัด</label>
          <input
            type="text"
            required
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>
      <StickySaveBar isSaving={isSavingGeneral} label={isSavingGeneral ? t("saving") : t("saveSettings")} color="indigo" />
    </form>
  );

  const renderApprovalSection = () => (
    <form onSubmit={handleGeneralSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
      <SectionHeader title={sectionTitles.approval} />
      <fieldset disabled={isInspector} className="space-y-6">
        {/* Default Inspector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {lang === "en" ? "Default Inspector" : "ผู้ตรวจสอบใบลาสะสม (ค่าเริ่มต้น)"}
          </label>
          <select
            value={defaultInspectorId}
            onChange={(e) => setDefaultInspectorId(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm animate-none"
          >
            <option value="">-- {lang === "en" ? "Select Default Inspector" : "เลือกผู้ตรวจสอบ (หรือระบบเลือก หัวหน้างานบุคคล อัตโนมัติ)"} --</option>
            {eligibleInspectors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.position ? `(${u.position})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Final Approver Configuration Section */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-6 space-y-4">
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-500" />
            {lang === "en" ? "Final Approval Configuration" : "การตั้งค่าผู้อนุมัติขั้นสุดท้าย"}
          </h4>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{lang === "en"
              ? "The Director (position: ผู้อำนวยการ) and Admin can always give final approval. Use the list below to allow additional users."
              : "ผู้อำนวยการโรงเรียน (ตำแหน่ง: ผู้อำนวยการ) และแอดมิน สามารถอนุมัติขั้นสุดท้ายได้เสมอ ใช้รายการด้านล่างเพื่อเพิ่มผู้มีสิทธิ์อนุมัติ"
            }</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {lang === "en" ? "Additional Final Approvers" : "ผู้มีสิทธิ์อนุมัติขั้นสุดท้ายเพิ่มเติม"}
            </label>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 space-y-1">
              {eligibleInspectors
                .filter((u) => u.position !== "ผู้อำนวยการ")
                .map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={finalApproverUserIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFinalApproverUserIds(prev => [...prev, u.id]);
                      } else {
                        setFinalApproverUserIds(prev => prev.filter(id => id !== u.id));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">{u.name}</span>
                  {u.position && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">({u.position})</span>
                  )}
                </label>
              ))}
              {eligibleInspectors.filter((u) => u.position !== "ผู้อำนวยการ").length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">{lang === "en" ? "No eligible users found" : "ไม่พบผู้ใช้ที่มีสิทธิ์"}</p>
              )}
            </div>
            {finalApproverUserIds.length > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-semibold">
                ✓ {lang === "en" ? `${finalApproverUserIds.length} additional approver(s) selected` : `เลือกแล้ว ${finalApproverUserIds.length} คน`}
              </p>
            )}
          </div>

          {/* Acting Director Title Toggle */}
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showActingDirectorTitle}
                onChange={(e) => setShowActingDirectorTitle(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>{lang === "en" ? "Show 'Acting Director' title on printed leave forms" : "แสดงแถว \"รักษาการในตำแหน่ง ผอ.\" ในใบลา (กรณีไม่ใช่ ผอ. ลงนาม)"}</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 pl-6">{lang === "en" ? "When enabled, an additional title line will appear below the approver's signature on printed forms when the final approver is not the Director." : "เมื่อเปิดใช้งาน จะแสดงข้อความระบุตำแหน่งรักษาการฯ ใต้ลายเซ็นต์ผู้อนุมัติในใบลาที่พิมพ์ กรณีผู้อนุมัติไม่ใช่ ผอ."}</p>
          </div>

          {showActingDirectorTitle && (
            <div className="mt-4 pl-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {lang === "en" ? "Acting Director Title Type" : "ข้อความระบุตำแหน่งรักษาการฯ"}
                </label>
                <select
                  value={actingDirectorTitleType}
                  onChange={(e) => setActingDirectorTitleType(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
                >
                  <option value="ปฏิบัติราชการแทนผู้อำนวยการโรงเรียน">ปฏิบัติราชการแทนผู้อำนวยการโรงเรียน</option>
                  <option value="รักษาราชการแทนผู้อำนวยการโรงเรียน">รักษาราชการแทนผู้อำนวยการโรงเรียน</option>
                  <option value="รักษาการในตำแหน่งผู้อำนวยการโรงเรียน">รักษาการในตำแหน่งผู้อำนวยการโรงเรียน</option>
                  <option value="custom">อื่น ๆ (ระบุเอง)</option>
                </select>
              </div>

              {actingDirectorTitleType === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {lang === "en" ? "Custom Acting Title" : "ระบุข้อความตำแหน่งอื่น ๆ"}
                  </label>
                  <input
                    type="text"
                    value={customActingDirectorTitle}
                    onChange={(e) => setCustomActingDirectorTitle(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    placeholder="ระบุตำแหน่งรักษาการ เช่น รักษาราชการแทน..."
                  />
                </div>
              )}

              {/* Explanation box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">💡 คำชี้แจงการใช้ข้อความตำแหน่งรักษาการ:</div>
                <p><strong>• ปฏิบัติราชการแทนผู้อำนวยการโรงเรียน:</strong> ใช้กรณี ผอ.โรงเรียน ดำรงตำแหน่งอยู่ แต่ไม่ได้อยู่ปฏิบัติหน้าที่ชั่วคราว หรือมอบหมายให้รองผู้อำนวยการมีอำนาจลงนามแทนเฉพาะคราวหรือเป็นลายลักษณ์อักษร</p>
                <p><strong>• รักษาราชการแทนผู้อำนวยการโรงเรียน:</strong> ใช้กรณีไม่มีผู้ดำรงตำแหน่ง ผอ. หรือมีแต่ไม่สามารถปฏิบัติหน้าที่ได้ชั่วคราว</p>
                <p><strong>• รักษาการในตำแหน่งผู้อำนวยการโรงเรียน:</strong> ใช้กรณีตำแหน่ง ผอ.โรงเรียน ว่างลงอย่างเป็นทางการ (เช่น ย้าย เกษียณ หรือเสียชีวิต) และหน่วยงานต้นสังกัด (สพม./สพป.) มีคำสั่งแต่งตั้งบุคคลใดบุคคลหนึ่งมาปฏิบัติหน้าที่แทนชั่วคราว จนกว่าจะมี ผอ. คนใหม่เข้ามาดำรงตำแหน่ง</p>
              </div>
            </div>
          )}
        </div>
      </fieldset>
      {!isInspector && (
        <StickySaveBar isSaving={isSavingGeneral} label={isSavingGeneral ? t("saving") : t("saveSettings")} color="indigo" />
      )}
    </form>
  );

  const renderLeaveRulesSection = () => (
    <div className="space-y-6">
      <SectionHeader title={sectionTitles["leave-rules"]} />

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
        <fieldset disabled={isInspector} className="w-full">
          <textarea
            rows={5}
            value={leaveRules}
            onChange={(e) => setLeaveRules(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
            placeholder={"การลากิจต้องยื่นคำขอล่วงหน้าอย่างน้อย 3 วันทำการ\nการลาป่วยติดต่อกันเกิน 3 วัน ต้องแนบใบรับรองแพทย์"}
          />
        </fieldset>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">* {lang === "en" ? "This text will be shown on the leave request form" : "ข้อความนี้จะแสดงผลบนหน้าต่างยื่นใบคำขอลาของบุคลากร"}</p>
          {!isInspector && (
            <button
              type="submit"
              disabled={isSavingRules}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md shadow-amber-500/10 focus:ring-4 focus:ring-amber-500/20 transition-all text-sm disabled:opacity-50 shrink-0 self-end"
            >
              <Save className="w-4 h-4" />
              {isSavingRules ? t("saving") : (lang === "en" ? "Save Rules Text" : "บันทึกข้อความแสดงผล")}
            </button>
          )}
        </div>
      </form>

      {/* Leave Quota Config */}
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

          <fieldset disabled={isInspector} className="space-y-4">
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
                  <div className="flex items-center gap-2 pb-1.5 sm:pb-0">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <input 
                        type="checkbox" 
                        checked={config.isActive !== false} 
                        onChange={(e) => handleQuotaChange(config.id, "isActive", e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{lang === "en" ? "Active" : "เปิดใช้งาน"}</span>
                    </label>
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
          </fieldset>

          {!isInspector && (
            <StickySaveBar isSaving={isSavingAllQuotas} label={isSavingAllQuotas ? t("saving") : (lang === "en" ? "Save All Quotas" : "บันทึกโควตาการลาทั้งหมด")} color="purple" />
          )}
        </form>
      </div>

      {/* General Restrictions */}
      <form onSubmit={handleGeneralSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">{lang === "en" ? "General Restrictions" : "ข้อจำกัดทั่วไป"}</h4>
        <fieldset disabled={isInspector} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={requirePersonalAdvance}
                  onChange={(e) => setRequirePersonalAdvance(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{lang === "en" ? "Require Personal Leave 1-Day in Advance" : "ลากิจส่วนตัวต้องล่วงหน้าอย่างน้อย 1 วันทำการ"}</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 pl-6">หากเปิดใช้งาน บุคลากรจะไม่สามารถยื่นคำขอลากิจส่วนตัวสำหรับวันนี้หรือย้อนหลังได้</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  เกณฑ์สะสมลารวมลากิจ+ลาป่วย (จำนวนครั้ง) เพื่อส่งข้อความถึง ผอ.
                </label>
                <input
                  type="number"
                  min={0}
                  value={memoThresholdTimes}
                  onChange={(e) => setMemoThresholdTimes(Number(e.target.value))}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  เกณฑ์สะสมลารวมลากิจ+ลาป่วย (จำนวนวัน) เพื่อส่งข้อความถึง ผอ.
                </label>
                <input
                  type="number"
                  min={0}
                  value={memoThresholdDays}
                  onChange={(e) => setMemoThresholdDays(Number(e.target.value))}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold"
                />
              </div>
            </div>
          </div>
        </fieldset>
        {!isInspector && (
          <StickySaveBar isSaving={isSavingGeneral} label={isSavingGeneral ? t("saving") : t("saveSettings")} color="indigo" />
        )}
      </form>
    </div>
  );

  const renderLineSection = () => (
    <form onSubmit={handleGeneralSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
      <SectionHeader title={sectionTitles.line} />
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <input
              type="checkbox"
              checked={enableLineNotify}
              onChange={(e) => setEnableLineNotify(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>{lang === "en" ? "Enable LINE Notifications" : "เปิดใช้งานการแจ้งเตือนผ่าน LINE"}</span>
          </label>
          <p className="text-xs text-gray-500 pl-6 mb-4">
            {lang === "en" 
              ? "Turn on/off all automatic LINE messages for leave requests, approvals, and cancellations."
              : "เปิด-ปิดการส่งข้อความแจ้งเตือนอัตโนมัติไปยัง LINE (ส่งใบลาใหม่, อนุมัติ, ยกเลิกใบลา ฯลฯ)"}
          </p>
        </div>

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
      <StickySaveBar isSaving={isSavingGeneral} label={isSavingGeneral ? t("saving") : t("saveSettings")} color="indigo" />
    </form>
  );

  const renderFontSection = () => (
    <form onSubmit={handleGeneralSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
      <SectionHeader title={sectionTitles.font} />
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          {lang === "en" ? "Leave Form Font & Upload Format" : "ฟอนต์ใบลา & รูปแบบไฟล์อัปโหลด"}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {lang === "en" 
            ? "Configure the font used on printed leave forms and the file format for Google Drive uploads." 
            : "กำหนดฟอนต์ที่ใช้ในแบบฟอร์มใบลา และรูปแบบไฟล์ที่อัปโหลดไปยัง Google Drive"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Font Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {lang === "en" ? "Leave Form Font (Google Fonts)" : "ฟอนต์ใบลา (Google Fonts)"}
            </label>
            <select
              value={pdfFont}
              onChange={(e) => setPdfFont(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
              style={{ fontFamily: `'${pdfFont}', sans-serif` }}
            >
              <option value="Prompt" style={{ fontFamily: "'Prompt', sans-serif" }}>Prompt</option>
              <option value="Sarabun" style={{ fontFamily: "'Sarabun', sans-serif" }}>Sarabun</option>
              <option value="Taviraj" style={{ fontFamily: "'Taviraj', sans-serif" }}>Taviraj (Serif)</option>
              <option value="Noto Sans Thai" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>Noto Sans Thai</option>
              <option value="Kanit" style={{ fontFamily: "'Kanit', sans-serif" }}>Kanit</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {lang === "en" ? "Preview: " : "ตัวอย่าง: "}
              <span style={{ fontFamily: `'${pdfFont}', sans-serif`, fontSize: '14px' }}>
                กขค ใบลา สวัสดีครับ ABC 123
              </span>
            </p>
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {lang === "en" ? "Google Drive Upload Format" : "รูปแบบไฟล์ใน Google Drive"}
            </label>
            <select
              value={googleDriveFormat}
              onChange={(e) => setGoogleDriveFormat(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
            >
              <option value="PDF">PDF (.pdf)</option>
              <option value="JPG">JPG (.jpg)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {lang === "en" 
                ? "JPG may display Thai text better in some cases" 
                : "JPG อาจแสดงตัวอักษรไทยได้ดีกว่าในบางกรณี"}
            </p>
          </div>
        </div>
      </div>
      <StickySaveBar isSaving={isSavingGeneral} label={isSavingGeneral ? t("saving") : t("saveSettings")} color="indigo" />
    </form>
  );

  const renderBackupSection = () => (
    <div className="space-y-6">
      <SectionHeader title={sectionTitles.backup} />

      {/* System Backup - Admin Only */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
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
      )}

      {/* Leave Data Backup */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
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
          {lang === "en"
            ? "Export leave data as JSON/Excel or import JSON/Excel/CSV files to recover leave requests."
            : "นำออกข้อมูลการลาปีงบประมาณปัจจุบันเป็นไฟล์ JSON/Excel หรือนำเข้าไฟล์ JSON/Excel/CSV เพื่อกู้คืนข้อมูลการลา"}
        </p>
        
        <div className="space-y-4">
          {/* Export Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Export JSON */}
            <button
              onClick={handleExportLeave}
              disabled={isExportingLeave}
              className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 font-bold text-sm transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 justify-center">
                <FileJson className="w-4 h-4 shrink-0" />
                <span>{isExportingLeave ? (lang === "en" ? "Exporting JSON..." : "กำลังส่งออก JSON...") : (lang === "en" ? "Export (JSON)" : "ส่งออกข้อมูล (JSON)")}</span>
              </div>
              {!isExportingLeave && (
                <span className="text-[10px] font-semibold text-purple-500/70 dark:text-purple-400/70">
                  (Export Leave Data - JSON)
                </span>
              )}
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportLeaveExcel}
              disabled={isExportingLeave}
              className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 font-bold text-sm transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 justify-center">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>{isExportingLeave ? (lang === "en" ? "Exporting Excel..." : "กำลังส่งออก Excel...") : (lang === "en" ? "Export (Excel)" : "ส่งออกข้อมูล (Excel)")}</span>
              </div>
              {!isExportingLeave && (
                <span className="text-[10px] font-semibold text-indigo-500/70 dark:text-indigo-400/70">
                  (Export Leave Data - Excel)
                </span>
              )}
            </button>
          </div>

          {/* Import Section */}
          {!isInspector ? (
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
                  <span>{isImportingLeave ? (lang === "en" ? "Importing..." : "กำลังนำเข้าข้อมูล...") : (lang === "en" ? "Import JSON / Excel / CSV" : "นำเข้าไฟล์ JSON / Excel / CSV")}</span>
                </div>
                {!isImportingLeave && (
                  <span className="text-[10px] font-semibold opacity-70">
                    (Import Leave Data)
                  </span>
                )}
                <input type="file" accept=".json,.xlsx,.xls,.csv" className="hidden" onChange={handleImportLeave} disabled={isImportingLeave} />
              </label>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
              <ShieldAlert className="w-5 h-5 text-amber-500 mx-auto mb-2" />
              <span>{lang === "en" ? "Import is disabled in Inspector view mode." : "การนำเข้าข้อมูลถูกปิดใช้งานในโหมดผู้ตรวจสอบ"}</span>
            </div>
          )}

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

      {/* Danger Zone */}
      {isAdmin ? (
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
  );

  const renderImpersonateSection = () => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-[100px] -z-10" />
      <SectionHeader title={sectionTitles.impersonate} />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
        สำหรับแอดมินเท่านั้น: สลับไปดูระบบในมุมมองของบทบาทต่าง ๆ เพื่อการปรับปรุงระบบและช่วยเหลือผู้ใช้
      </p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleImpersonate(null, "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all border border-slate-100 dark:border-slate-800"
        >
          <span>ครู (TEACHER)</span>
          <span className="text-xs font-normal text-slate-400">สิทธิ์ทั่วไป</span>
        </button>

        <button
          type="button"
          onClick={() => handleImpersonate("หัวหน้างานบุคคล", "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold text-sm transition-all border border-purple-100/55 dark:border-purple-900/30"
        >
          <span>หัวหน้างานบุคคล (HR Head)</span>
          <span className="text-xs font-normal text-purple-400">กำหนดโควตา/อนุมัติใบลา</span>
        </button>

        <button
          type="button"
          onClick={() => handleImpersonate("เจ้าหน้าที่บุคคล", "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold text-sm transition-all border border-purple-100/55 dark:border-purple-900/30"
        >
          <span>เจ้าหน้าที่บุคคล (HR Officer)</span>
          <span className="text-xs font-normal text-purple-400">กำหนดโควตา/พิมพ์รายงาน</span>
        </button>

        <button
          type="button"
          onClick={() => handleImpersonate("ผู้อำนวยการ", "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-all border border-indigo-100/55 dark:border-indigo-900/30"
        >
          <span>ผู้อำนวยการ (EXEC)</span>
          <span className="text-xs font-normal text-indigo-400">อนุมัติขั้นสุดท้าย</span>
        </button>

        {/* Show Cancel Impersonation button if they are currently impersonating */}
        {((session?.user as any)?.role !== "ADMIN" && (session?.user as any)?.position !== "แอดมิน") && (
          <button
            type="button"
            onClick={handleClearImpersonation}
            disabled={isImpersonating}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 mt-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-all shadow-md shadow-rose-500/10"
          >
            <span>ยกเลิกการจำลองสิทธิ์ (กลับเป็นแอดมิน)</span>
          </button>
        )}
      </div>
    </div>
  );

  const renderFooterSection = () => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-rose-100 dark:border-rose-900/30 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-[100px] -z-10" />
      <SectionHeader title={sectionTitles.footer} />
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
  );

  // --- Section renderer map ---
  const renderActiveSection = () => {
    switch (activeSection) {
      case "school": return renderSchoolSection();
      case "approval": return renderApprovalSection();
      case "leave-rules": return renderLeaveRulesSection();
      case "line": return renderLineSection();
      case "font": return renderFontSection();
      case "backup": return renderBackupSection();
      case "impersonate": return renderImpersonateSection();
      case "footer": return renderFooterSection();
      default: return null;
    }
  };

  // --- Menu List View ---
  const renderMenuList = () => {
    if (isInspector) {
      return (
        <div className="space-y-2">
          {inspectorItems.map((item) => (
            <MenuItemRow key={item.id} item={item} onClick={() => setActiveSection(item.id)} />
          ))}
        </div>
      );
    }

    if (isHRHead) {
      return (
        <div className="space-y-2">
          {hrHeadItems.map((item) => (
            <MenuItemRow key={item.id} item={item} onClick={() => setActiveSection(item.id)} />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Group: System Settings */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 pl-2 mb-3">
            {lang === "en" ? "System Settings" : "ตั้งค่าระบบ"}
          </p>
          <div className="space-y-2">
            {systemSettingsItems.map((item) => (
              <MenuItemRow key={item.id} item={item} onClick={() => setActiveSection(item.id)} />
            ))}
          </div>
        </div>

        {/* Group: Data Management */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 pl-2 mb-3">
            {lang === "en" ? "Data Management" : "จัดการข้อมูล"}
          </p>
          <div className="space-y-2">
            {dataManagementItems.map((item) => (
              <MenuItemRow key={item.id} item={item} onClick={() => setActiveSection(item.id)} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t("settingsTitle")}</h1>
        <p className="text-muted-foreground text-gray-500">{t("settingsSubtitle")}</p>
      </div>

      {/* Restricted access banner for HR Head */}
      {isHRHead && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/40 dark:border-blue-900/40 rounded-2xl text-sm text-blue-700 dark:text-blue-300 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{lang === "en" ? "Restricted Access Mode" : "โหมดสิทธิ์การเข้าถึงแบบจำกัด"}</p>
            <p className="text-xs text-blue-600/90 dark:text-blue-400 mt-1">
              {lang === "en" 
                ? "As HR role, you have access to view/edit leave quotas, leave rules, final approver settings, and general restrictions. Basic school details, LINE notify settings, developer configurations, backups, and system clear actions are restricted."
                : "เนื่องจากบทบาทของคุณเป็นเจ้าหน้าที่งานบุคคล คุณจะมีสิทธิ์เข้าถึงเฉพาะการปรับแต่งโควตาการลา แก้ไขกฎเกณฑ์การลา การตั้งค่าผู้อนุมัติขั้นสุดท้าย และข้อจำกัดทั่วไป ส่วนข้อมูลพื้นฐานโรงเรียน การตั้งค่าแจ้งเตือน LINE ข้อมูลนักพัฒนา การสำรองข้อมูล และการล้างข้อมูลจะถูกจำกัดสิทธิ์"}
            </p>
          </div>
        </div>
      )}

      {/* Restricted access banner for Inspector */}
      {isInspector && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/40 rounded-2xl text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{lang === "en" ? "Inspector View Mode" : "โหมดดูข้อมูลผู้ตรวจสอบ"}</p>
            <p className="text-xs text-amber-600/90 dark:text-amber-400 mt-1">
              {lang === "en" 
                ? "As an Inspector, you have read-only access to view leave configs, leave rules, final approvers, and settings. You can export leave data backups, but modifications, settings saving, data imports, and system clear actions are restricted."
                : "เนื่องจากบทบาทของคุณเป็นผู้ตรวจสอบ คุณสามารถเข้าดูการตั้งค่าสายอนุมัติ กฎระเบียบวันลา และโควตาวันลาสะสมของบุคลากรทุกคนได้แบบอ่านอย่างเดียว (Read-only) โดยจะไม่มีสิทธิ์บันทึกแก้ไขข้อมูล นำเข้าข้อมูล หรือล้างระบบเพื่อความปลอดภัย"}
            </p>
          </div>
        </div>
      )}

      {/* Slide container */}
      <div className="relative overflow-hidden">
        {/* Menu list view */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            activeSection !== null
              ? "-translate-x-full opacity-0 absolute inset-0 pointer-events-none"
              : "translate-x-0 opacity-100"
          }`}
        >
          {renderMenuList()}
        </div>

        {/* Detail section view */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            activeSection !== null
              ? "translate-x-0 opacity-100"
              : "translate-x-full opacity-0 absolute inset-0 pointer-events-none"
          }`}
        >
          {activeSection !== null && renderActiveSection()}
        </div>
      </div>
    </div>
  );
}
