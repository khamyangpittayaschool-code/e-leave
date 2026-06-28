"use client";
import { useState, useEffect } from "react";
import { getSystemSettings, updateSystemSettings, updateFooter, generateBackup, getLeaveConfigs, updateLeaveConfig, updateLeaveRules, setImpersonationCookie, clearImpersonation, getEligibleInspectors, updateDefaultInspector, getSimpleUsersList } from "@/app/actions/settings";
import { archiveCurrentCycle, importBackupFromJson, exportLeaveBackup, importLeaveBackup, importLeaveSimple, getImportHistory, undoImportLeave } from "@/app/actions/archive";
import { adminClearAllLeaveData } from "@/app/actions/leave";
import { uploadLogo } from "@/app/actions/upload";
import { useSession } from "@/lib/auth-client";
import { Save, Image as ImageIcon, ShieldAlert, DownloadCloud, Code, Settings2, Archive, UploadCloud, Database, FileJson, AlertTriangle, CheckCircle2, ChevronRight, ArrowLeft, Bell, Type, Users, BookOpen, HardDrive, UserCog, FileSpreadsheet, X, CalendarDays, FileX } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { useI18n } from "@/lib/i18n";
import * as XLSX from "xlsx";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t, lang } = useI18n();
  const { showToast } = useToast();
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
  const [actingDirectorTitleType, setActingDirectorTitleType] = useState("犧｣犧ｱ犧≒ｸｩ犧ｲ犧≒ｸｲ犧｣犹�ｸ吭ｸ歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�ｸ憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�");
  const [customActingDirectorTitle, setCustomActingDirectorTitle] = useState("");
  const [finalApproverUserIds, setFinalApproverUserIds] = useState<string[]>([]);
  const [showActingDirectorTitle, setShowActingDirectorTitle] = useState(true);
  const [pdfFont, setPdfFont] = useState("Prompt");
  const [googleDriveFormat, setGoogleDriveFormat] = useState("PDF");
  const [lastLeaveMode, setLastLeaveMode] = useState("SAME");
  const [quotaExceededAction, setQuotaExceededAction] = useState("ALLOW_WITH_MEMO");
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
  const [isRefModalOpen, setIsRefModalOpen] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [refModalTab, setRefModalTab] = useState<"users" | "types" | "statuses">("users");

  // Tag Input states
  const [inspectorSearch, setInspectorSearch] = useState("");
  const [showInspectorDropdown, setShowInspectorDropdown] = useState(false);
  const [approverSearch, setApproverSearch] = useState("");
  const [showApproverDropdown, setShowApproverDropdown] = useState(false);

  // Logo Action Sheet
  const [logoActionSheetOpen, setLogoActionSheetOpen] = useState(false);

  // Premium Import Wizard states
  const [importStage, setImportStage] = useState<"idle" | "preview" | "importing" | "summary">("idle");
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [validRecords, setValidRecords] = useState<any[]>([]);
  const [invalidRecords, setInvalidRecords] = useState<any[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<string[]>([]);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Drill-down navigation state
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    getSystemSettings().then((data) => {
      setSettings(data);
      setSchoolName(data.schoolName);
      setSubheader(data.subheader);
      setAffiliation(data.affiliation || "犧ｪ犧ｳ犧吭ｸｱ犧≒ｸ�ｸｲ犧吭ｹ犧もｸ歩ｸ樅ｸｷ犹霞ｸ吭ｸ伶ｸｵ犹謂ｸ≒ｸｲ犧｣犧ｨ犧ｶ犧≒ｸｩ犧ｲ犧｡犧ｱ犧倨ｸ｢犧｡犧ｨ犧ｶ犧≒ｸｩ犧ｲ犧ｭ犧ｸ犧扉ｸ｣犧倨ｸｲ犧吭ｸｵ");
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
      const loadedTitle = data.actingDirectorTitle || "犧｣犧ｱ犧≒ｸｩ犧ｲ犧≒ｸｲ犧｣犹�ｸ吭ｸ歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�ｸ憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�";
      setActingDirectorTitle(loadedTitle);
      if ([
        "犧巵ｸ鐘ｸｴ犧壟ｸｱ犧歩ｸｴ犧｣犧ｲ犧癌ｸ≒ｸｲ犧｣犹≒ｸ伶ｸ吭ｸ憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�",
        "犧｣犧ｱ犧≒ｸｩ犧ｲ犧｣犧ｲ犧癌ｸ≒ｸｲ犧｣犹≒ｸ伶ｸ吭ｸ憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�",
        "犧｣犧ｱ犧≒ｸｩ犧ｲ犧≒ｸｲ犧｣犹�ｸ吭ｸ歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�ｸ憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�"
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
      setLastLeaveMode(data.lastLeaveMode || "SAME");
      setQuotaExceededAction(data.quotaExceededAction || "ALLOW_WITH_MEMO");
    });

    getEligibleInspectors().then(setEligibleInspectors);
    getLeaveConfigs().then(setLeaveConfigs);
  }, []);
  useEffect(() => {
    if (activeSection === "backup") {
      getImportHistory().then(setImportHistory);
    }
  }, [activeSection]);

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
        googleDriveFormat,
        lastLeaveMode,
        quotaExceededAction
      });
      alert("犧壟ｸｱ犧吭ｸ伶ｸｶ犧≒ｸ≒ｸｲ犧｣犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犧伶ｸｱ犹謂ｸｧ犹�ｸ巵ｸｪ犧ｳ犹犧｣犹�ｸ�");
    } catch (error: any) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧扉ｹ�ｸ吭ｸ≒ｸｲ犧｣犧壟ｸｱ犧吭ｸ伶ｸｶ犧�: " + (error?.message || error));
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleImpersonate = async (position: string | null, role: string | null) => {
    setIsImpersonating(true);
    try {
      await setImpersonationCookie(position, role);
      alert("犧謂ｸｳ犧･犧ｭ犧�ｸ壟ｸ伶ｸ壟ｸｲ犧伶ｸｪ犧ｳ犹犧｣犹�ｸ� 犧≒ｸｳ犧･犧ｱ犧�ｸ｣犧ｵ犹もｸｫ犧･犧扉ｸｫ犧吭ｹ霞ｸｲ犹犧ｧ犹�ｸ�...");
      window.location.href = "/";
    } catch (error: any) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧�: " + (error?.message || error));
      setIsImpersonating(false);
    }
  };

  const handleClearImpersonation = async () => {
    setIsImpersonating(true);
    try {
      await clearImpersonation();
      alert("犧�ｸｷ犧吭ｸｪ犧籾ｸｲ犧吭ｸｰ犹≒ｸｭ犧扉ｸ｡犧ｴ犧吭ｸｪ犧ｳ犹犧｣犹�ｸ� 犧≒ｸｳ犧･犧ｱ犧�ｸ｣犧ｵ犹もｸｫ犧･犧�...");
      window.location.reload();
    } catch (error: any) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧�: " + (error?.message || error));
      setIsImpersonating(false);
    }
  };

  const handleFooterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingFooter(true);
    try {
      await updateFooter({ footerText, developerSecret });
      alert("犧ｭ犧ｱ犧巵ｹ犧扉ｸ� Footer 犧ｪ犧ｳ犹犧｣犹�ｸ�");
      setDeveloperSecret(""); // Clear secret after success
    } catch (error: any) {
      alert(error.message === "Invalid Developer Secret" ? "犧｣犧ｫ犧ｱ犧ｪ犧･犧ｱ犧壟ｸ吭ｸｱ犧≒ｸ樅ｸｱ犧亭ｸ吭ｸｲ犹�ｸ｡犹謂ｸ籾ｸｹ犧≒ｸ歩ｹ霞ｸｭ犧�!" : "犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧�");
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
      alert("犧ｭ犧ｱ犧巵ｹもｸｫ犧･犧扉ｹもｸ･犹もｸ≒ｹ霞ｹ�ｸ｡犹謂ｸｪ犧ｳ犹犧｣犹�ｸ�");
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
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧扉ｹ�ｸ吭ｸ≒ｸｲ犧｣犧ｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleLeaveSubmit = async (configId: string, maxDaysPerYear: number, warningThreshold: number) => {
    setIsSavingLeave(configId);
    try {
      await updateLeaveConfig(configId, { maxDaysPerYear, warningThreshold });
      alert("犧壟ｸｱ犧吭ｸ伶ｸｶ犧≒ｸもｹ霞ｸｭ犧≒ｸｳ犧ｫ犧吭ｸ扉ｸ≒ｸｲ犧｣犧･犧ｲ犧ｪ犧ｳ犹犧｣犹�ｸ�");
    } catch (error) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧扉ｹ�ｸ吭ｸ≒ｸｲ犧｣犧壟ｸｱ犧吭ｸ伶ｸｶ犧≒ｸもｹ霞ｸｭ犧≒ｸｳ犧ｫ犧吭ｸ扉ｸ≒ｸｲ犧｣犧･犧ｲ");
    } finally {
      setIsSavingLeave(null);
    }
  };

  const handleSaveLeaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRules(true);
    try {
      const isHRHead = (session?.user as any)?.position === "犧ｫ犧ｱ犧ｧ犧ｫ犧吭ｹ霞ｸｲ犧�ｸｲ犧吭ｸ壟ｸｸ犧�ｸ�ｸ･" || (session?.user as any)?.position === "犹犧謂ｹ霞ｸｲ犧ｫ犧吭ｹ霞ｸｲ犧伶ｸｵ犹謂ｸ壟ｸｸ犧�ｸ�ｸ･";
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
      alert("犧壟ｸｱ犧吭ｸ伶ｸｶ犧≒ｸもｹ霞ｸｭ犧�ｸｧ犧ｲ犧｡犹≒ｸｪ犧扉ｸ�ｸ憫ｸ･犧もｹ霞ｸｭ犧≒ｸｳ犧ｫ犧吭ｸ扉ｸ≒ｸｲ犧｣犧･犧ｲ犧ｪ犧ｳ犹犧｣犹�ｸ�");
    } catch (error: any) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧扉ｹ�ｸ吭ｸ≒ｸｲ犧｣犧壟ｸｱ犧吭ｸ伶ｸｶ犧�: " + (error?.message || error));
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
      alert("犧壟ｸｱ犧吭ｸ伶ｸｶ犧≒ｹもｸ�ｸｧ犧歩ｸｲ犧≒ｸｲ犧｣犧･犧ｲ犧伶ｸｱ犹霞ｸ�ｸｫ犧｡犧扉ｸｪ犧ｳ犹犧｣犹�ｸ�");
    } catch (error) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧扉ｹ�ｸ吭ｸ≒ｸｲ犧｣犧壟ｸｱ犧吭ｸ伶ｸｶ犧≒ｹもｸ�ｸｧ犧歩ｸｲ犧≒ｸｲ犧｣犧･犧ｲ");
    } finally {
      setIsSavingAllQuotas(false);
    }
  };


  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("犧�ｸｳ犹犧歩ｸｷ犧ｭ犧�: 犧≒ｸｲ犧｣犧吭ｸｳ犹犧もｹ霞ｸｲ犧もｹ霞ｸｭ犧｡犧ｹ犧･犧ｪ犧ｳ犧｣犧ｭ犧�ｸ謂ｸｰ犧･犧壟ｸ≒ｸｲ犧｣犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犧巵ｸｱ犧謂ｸ謂ｸｸ犧壟ｸｱ犧吭ｹ≒ｸ･犧ｰ犹犧もｸｵ犧｢犧吭ｸ伶ｸｱ犧壟ｹ�ｸｫ犧｡犹謂ｸ伶ｸｱ犹霞ｸ�ｸｫ犧｡犧� 犧歩ｹ霞ｸｭ犧�ｸ≒ｸｲ犧｣犧扉ｸｳ犹犧吭ｸｴ犧吭ｸ≒ｸｲ犧｣犧歩ｹ謂ｸｭ犧ｫ犧｣犧ｷ犧ｭ犹�ｸ｡犹�?")) {
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
          alert("犧吭ｸｳ犹犧もｹ霞ｸｲ犧もｹ霞ｸｭ犧｡犧ｹ犧･犹≒ｸ･犧ｰ犧≒ｸｹ犹霞ｸ�ｸｷ犧吭ｸ｣犧ｰ犧壟ｸ壟ｸｪ犧ｳ犹犧｣犹�ｸ� 犧≒ｸ｣犧ｸ犧内ｸｲ犧｣犧ｵ犹犧游ｸ｣犧癌ｸｫ犧吭ｹ霞ｸｲ犹犧ｧ犹�ｸ�");
          window.location.reload();
        } catch (err: any) {
          alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧扉ｹ�ｸ吭ｸ≒ｸｲ犧｣犧吭ｸｳ犹犧もｹ霞ｸｲ: " + err.message);
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧扉ｹ�ｸ吭ｸ≒ｸｲ犧｣犧ｭ犹謂ｸｲ犧吭ｹ�ｸ游ｸ･犹�");
      setIsImporting(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm("笞��� 犧�ｸｳ犹犧歩ｸｷ犧ｭ犧吭ｸ｣犹霞ｸｲ犧｢犹≒ｸ｣犧�: 犧�ｸｸ犧内ｸ≒ｸｳ犧･犧ｱ犧�ｸ謂ｸｰ犧･犧� '犧もｹ霞ｸｭ犧｡犧ｹ犧･犧巵ｸ｣犧ｰ犧ｧ犧ｱ犧歩ｸｴ犧≒ｸｲ犧｣犧･犧ｲ犧伶ｸｱ犹霞ｸ�ｸｫ犧｡犧�' 犧ｭ犧ｭ犧≒ｸ謂ｸｲ犧≒ｸ｣犧ｰ犧壟ｸ�!\n犧もｹ霞ｸｭ犧｡犧ｹ犧･犧伶ｸｵ犹謂ｸ籾ｸｹ犧≒ｸ･犧壟ｸ謂ｸｰ犹�ｸ｡犹謂ｸｪ犧ｲ犧｡犧ｲ犧｣犧籾ｸ≒ｸｹ犹霞ｸ�ｸｷ犧吭ｹ�ｸ扉ｹ� (犧｢犧≒ｹ犧ｧ犹霞ｸ吭ｸ謂ｸｰ犧｡犧ｵ Backup)\n\n犧�ｸｸ犧内ｹ≒ｸ吭ｹ謂ｹ�ｸ謂ｸｫ犧｣犧ｷ犧ｭ犹�ｸ｡犹謂ｸｧ犹謂ｸｲ犧歩ｹ霞ｸｭ犧�ｸ≒ｸｲ犧｣犧扉ｸｳ犹犧吭ｸｴ犧吭ｸ≒ｸｲ犧｣犧歩ｹ謂ｸｭ?")) {
      return;
    }
    const confirmText = prompt("犧樅ｸｴ犧｡犧樅ｹ呉ｸ�ｸｳ犧ｧ犹謂ｸｲ 'CONFIRM' 犹犧樅ｸｷ犹謂ｸｭ犧｢犧ｷ犧吭ｸ｢犧ｱ犧吭ｸ≒ｸｲ犧｣犧･犧壟ｸもｹ霞ｸｭ犧｡犧ｹ犧･犧≒ｸｲ犧｣犧･犧ｲ犧伶ｸｱ犹霞ｸ�ｸｫ犧｡犧�:");
    if (confirmText !== 'CONFIRM') {
      alert("犧｢犧≒ｹ犧･犧ｴ犧≒ｸ≒ｸｲ犧｣犧･犧壟ｸもｹ霞ｸｭ犧｡犧ｹ犧･ (犧樅ｸｴ犧｡犧樅ｹ呉ｹ�ｸ｡犹謂ｸ籾ｸｹ犧≒ｸ歩ｹ霞ｸｭ犧�)");
      return;
    }

    setIsClearing(true);
    try {
      await adminClearAllLeaveData();
      alert("犧･犹霞ｸｲ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･犧≒ｸｲ犧｣犧･犧ｲ犧伶ｸｱ犹霞ｸ�ｸｫ犧｡犧扉ｹ犧｣犧ｵ犧｢犧壟ｸ｣犹霞ｸｭ犧｢犹≒ｸ･犹霞ｸｧ");
      window.location.reload();
    } catch (error: any) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧�: " + (error.message || "犹�ｸ｡犹謂ｸｪ犧ｲ犧｡犧ｲ犧｣犧籾ｸ･犧壟ｸもｹ霞ｸｭ犧｡犧ｹ犧･犹�ｸ扉ｹ�"));
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
      alert(`犧ｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･犧≒ｸｲ犧｣犧･犧ｲ犧ｪ犧ｳ犹犧｣犹�ｸ�!\n\n犧巵ｸｵ犧�ｸ壟ｸ巵ｸ｣犧ｰ犧｡犧ｲ犧�: ${parsed.fiscalYear}\n犧謂ｸｳ犧吭ｸｧ犧吭ｸ伶ｸｱ犹霞ｸ�ｸｫ犧｡犧�: ${parsed.summary.totalRequests} 犧｣犧ｲ犧｢犧≒ｸｲ犧｣\n犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ: ${parsed.summary.approved} | 犧巵ｸ鐘ｸｴ犹犧ｪ犧�: ${parsed.summary.rejected} | 犧｣犧ｭ犧扉ｸｳ犹犧吭ｸｴ犧吭ｸ≒ｸｲ犧｣: ${parsed.summary.pending}`);
    } catch (error: any) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧�: " + (error.message || "犹�ｸ｡犹謂ｸｪ犧ｲ犧｡犧ｲ犧｣犧籾ｸｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･犹�ｸ扉ｹ�"));
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

      showToast("success", lang === "en" ? "Leave data exported as Excel successfully!" : `สำรองข้อมูลการลาแบบ Excel สำเร็จ!\n\nปีงบประมาณ: ${parsed.fiscalYear}\nจำนวนทั้งหมด: ${parsed.summary.totalRequests} รายการ`);
    } catch (error: any) {
      showToast("error", lang === "en" ? "Failed to export Excel" : "เกิดข้อผิดพลาด: " + (error.message || "ไม่สามารถสำรองข้อมูลได้"));
    } finally {
      setIsExportingLeave(false);
    }
  };

  const handleExportLeaveCSV = async () => {
    setIsExportingLeave(true);
    try {
      const backupString = await exportLeaveBackup();
      const parsed = JSON.parse(backupString);
      const leaveRequests = parsed.leaveRequests || [];
      const configs = parsed.leaveConfigs || [];

      const typeMap: Record<string, string> = {};
      configs.forEach((c: any) => {
        typeMap[c.type] = c.name;
      });

      const rows = leaveRequests.map((r: any) => ({
        "Email (犧ｭ犧ｵ犹犧｡犧･)": r.userEmail,
        "User Name (犧癌ｸｷ犹謂ｸｭ-犧吭ｸｲ犧｡犧ｪ犧≒ｸｸ犧･)": r.userName,
        "Position (犧歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�)": r.userPosition || "",
        "Subject Group (犧≒ｸ･犧ｸ犹謂ｸ｡犧ｪ犧ｲ犧｣犧ｰ犧ｯ/犧杳ｹ謂ｸｲ犧｢)": r.userSubjectGroup || "",
        "Leave Type (犧巵ｸ｣犧ｰ犹犧�犧伶ｸ≒ｸｲ犧｣犧･犧ｲ)": typeMap[r.type] || r.type,
        "Start Date (犧ｧ犧ｱ犧吭ｸ伶ｸｵ犹謂ｹ犧｣犧ｴ犹謂ｸ｡ YYYY-MM-DD)": r.startDate ? r.startDate.split("T")[0] : "",
        "End Date (犧ｧ犧ｱ犧吭ｸ伶ｸｵ犹謂ｸｪ犧ｴ犹霞ｸ吭ｸｪ犧ｸ犧� YYYY-MM-DD)": r.endDate ? r.endDate.split("T")[0] : "",
        "Reason (犹犧ｫ犧歩ｸｸ犧憫ｸ･)": r.reason || "",
        "Status (犧ｪ犧籾ｸｲ犧吭ｸｰ)": r.status || "",
        "Attachment URL (犹犧ｭ犧≒ｸｪ犧ｲ犧｣犹≒ｸ吭ｸ�)": r.documentUrl || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvOutput], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `eleave-leave-data-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`犧ｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･犧≒ｸｲ犧｣犧･犧ｲ犹≒ｸ壟ｸ� CSV 犧ｪ犧ｳ犹犧｣犹�ｸ�!\n\n犧巵ｸｵ犧�ｸ壟ｸ巵ｸ｣犧ｰ犧｡犧ｲ犧�: ${parsed.fiscalYear}\n犧謂ｸｳ犧吭ｸｧ犧吭ｸ伶ｸｱ犹霞ｸ�ｸｫ犧｡犧�: ${parsed.summary.totalRequests} 犧｣犧ｲ犧｢犧≒ｸｲ犧｣`);
    } catch (error: any) {
      alert("犹犧≒ｸｴ犧扉ｸもｹ霞ｸｭ犧憫ｸｴ犧扉ｸ樅ｸ･犧ｲ犧�: " + (error.message || "犹�ｸ｡犹謂ｸｪ犧ｲ犧｡犧ｲ犧｣犧籾ｸｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･犹�ｸ扉ｹ�"));
    } finally {
      setIsExportingLeave(false);
    }
  };

  const handleDownloadCSVTemplate = () => {
    const headers = "Username,StartDate,EndDate,LeaveType,LeaveStatus,FinalApproverUsername,HeadApproverUsername,Reason";
    const sampleRow1 = "\n1002,2026-07-01,2026-07-03,SICK,APPROVED,1001,,犧･犧ｲ犧｣犧ｱ犧≒ｸｩ犧ｲ犧ｭ犧ｲ犧≒ｸｲ犧｣犹�ｸもｹ霞ｸｫ犧ｧ犧ｱ犧扉ｹ�ｸｫ犧財ｹ�";
    const sampleRow2 = "\n1003,2026-07-10,2026-07-10,PERSONAL,APPROVED,1001,1005,犧伶ｸｳ犧倨ｸｸ犧｣犧ｰ犧歩ｸｴ犧扉ｸ歩ｹ謂ｸｭ犧｣犧ｲ犧癌ｸ≒ｸｲ犧｣犹犧｣犧ｷ犹謂ｸｭ犧�ｸ壟ｹ霞ｸｲ犧�";
    const csvContent = "\uFEFF" + headers + sampleRow1 + sampleRow2;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eleave_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenRefModal = async () => {
    setIsRefModalOpen(true);
    if (userList.length === 0) {
      try {
        const users = await getSimpleUsersList();
        setUserList(users);
      } catch (err: any) {
        console.error("Failed to load users list for reference:", err);
      }
    }
  };

  const handleImportLeave = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingLeave(true);
    setImportLeaveResult(null);
    
    // Fetch users list for validation if not loaded
    let currentUsers = userList;
    if (currentUsers.length === 0) {
      try {
        currentUsers = await getSimpleUsersList();
        setUserList(currentUsers);
      } catch (err) {
        console.error("Failed to load users for validation:", err);
      }
    }

    // Load leave configurations for type matching
    let localLeaveConfigs = leaveConfigs;
    if (localLeaveConfigs.length === 0) {
      try {
        localLeaveConfigs = await getLeaveConfigs();
        setLeaveConfigs(localLeaveConfigs);
      } catch (err) {
        console.error("Failed to load leave configs:", err);
      }
    }

    const typeMap: Record<string, string> = {};
    localLeaveConfigs.forEach((c) => {
      typeMap[c.name.trim()] = c.type;
    });

    const isJson = file.name.endsWith(".json");
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let rawRows: any[] = [];
          if (isJson) {
            const jsonPayloadString = event.target?.result as string;
            let parsed: any;
            try {
              parsed = JSON.parse(jsonPayloadString);
            } catch (err) {
              throw new Error("โครงสร้างไฟล์ JSON ไม่ถูกต้อง");
            }

            if (parsed && parsed._type === "eleave-leave-backup") {
              rawRows = parsed.records || [];
            } else {
              rawRows = Array.isArray(parsed) ? parsed : (parsed.records || []);
            }
          } else {
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            rawRows = XLSX.utils.sheet_to_json(worksheet);
          }

          const parseExcelDate = (val: any) => {
            if (!val) return new Date();
            if (val instanceof Date) return val;
            if (typeof val === 'number') {
              return new Date(Math.round((val - 25569) * 86400 * 1000));
            }
            const str = String(val).trim();
            const dmy = str.split(/[\\/\\-\\.]/);
            if (dmy.length === 3) {
              let d = parseInt(dmy[0]);
              let m = parseInt(dmy[1]) - 1;
              let y = parseInt(dmy[2]);
              if (y > 2500) y -= 543;
              return new Date(y, m, d);
            }
            const parsedDate = new Date(str);
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate;
            }
            return new Date();
          };

          const mappedRequests = rawRows.map((row: any, idx: number) => {
            let username = "";
            let startDate = "";
            let endDate = "";
            let type = "";
            let status = "";
            let finalApproverUsername = "";
            let headApproverUsername = "";
            let reason = "";

            Object.entries(row).forEach(([key, val]) => {
              const k = key.trim().toLowerCase();
              const v = val !== undefined && val !== null ? String(val).trim() : "";
              if (!v) return;

              if (k === "username" || k === "userid" || k === "user_id" || k.includes("ยูสเซอร์") || k.includes("ผู้ยื่นคำขอ") || k === "email" || k.includes("อีเมล")) {
                username = v;
              } else if (k.includes("start") || k.includes("เริ่ม") || k.includes("วันที่เริ่ม")) {
                startDate = parseExcelDate(val).toISOString();
              } else if (k.includes("end") || k.includes("สิ้นสุด") || k.includes("ถึง") || k.includes("วันที่สิ้นสุด")) {
                endDate = parseExcelDate(val).toISOString();
              } else if (k.includes("type") || k.includes("ประเภท") || k.includes("ประเภทการลา")) {
                type = v;
              } else if (k.includes("status") || k.includes("สถานะ") || k.includes("สถานะการลา")) {
                status = v;
              } else if (k.includes("final") || k.includes("director") || k.includes("ผู้อนุมัติ") || k.includes("ผอ") || k.includes("ผู้อนุมัติขั้นสุดท้าย")) {
                finalApproverUsername = v;
              } else if (k.includes("head") || k.includes("inspector") || k.includes("ผู้ตรวจสอบ") || k.includes("หัวหน้า")) {
                headApproverUsername = v;
              } else if (k.includes("reason") || k.includes("เหตุผล")) {
                reason = v;
              }
            });

            return {
              rowNum: idx + 2,
              username,
              startDate,
              endDate,
              type,
              status,
              finalApproverUsername,
              headApproverUsername,
              reason
            };
          });

          // Client-side Validation
          const valList: any[] = [];
          const invalList: any[] = [];

          mappedRequests.forEach((req: any) => {
            const errorList: string[] = [];
            if (!req.username) {
              errorList.push("ไม่ระบุ Username");
            }
            if (!req.startDate || !req.endDate) {
              errorList.push("ไม่ระบุวันที่เริ่มหรือวันที่สิ้นสุด");
            }
            if (!req.type) {
              errorList.push("ไม่ระบุประเภทการลา");
            }

            // Validate matched user
            let matchedUser = null;
            if (req.username) {
              matchedUser = currentUsers.find(u => 
                u.username?.toLowerCase() === String(req.username).trim().toLowerCase() ||
                u.email.toLowerCase() === String(req.username).trim().toLowerCase() ||
                u.id === String(req.username).trim()
              );
              if (!matchedUser) {
                errorList.push(`ไม่พบผู้ใช้งาน: ${req.username}`);
              }
            }

            // Type validation/mapping
            let mappedType = String(req.type).trim();
            if (typeMap[mappedType]) {
              mappedType = typeMap[mappedType];
            } else {
              const typeUpper = mappedType.toUpperCase();
              if (["SICK", "PERSONAL", "VACATION", "MATERNITY", "ORDINATION", "MILITARY", "STUDY"].includes(typeUpper)) {
                mappedType = typeUpper;
              } else if (mappedType.includes("ป่วย") || typeUpper.includes("SICK")) {
                mappedType = "SICK";
              } else if (mappedType.includes("กิจ") || typeUpper.includes("PERSONAL")) {
                mappedType = "PERSONAL";
              } else if (mappedType.includes("พัก") || typeUpper.includes("VACATION") || mappedType.includes("ร้อน")) {
                mappedType = "VACATION";
              } else {
                errorList.push(`ประเภทการลาไม่ถูกต้อง: ${req.type}`);
              }
            }

            if (errorList.length > 0) {
              invalList.push({ ...req, errors: errorList, matchedUserName: matchedUser?.name || "ไม่ทราบชื่อ" });
            } else {
              valList.push({ ...req, mappedType, matchedUserName: matchedUser?.name || "ไม่ทราบชื่อ", userId: matchedUser?.id });
            }
          });

          setParsedRecords(mappedRequests);
          setValidRecords(valList);
          setInvalidRecords(invalList);
          setImportStage("preview");
        } catch (err: any) {
          showToast("error", "เกิดข้อผิดพลาดในการประมวลผลไฟล์: " + err.message);
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
      showToast("error", "ไม่สามารถอ่านไฟล์ได้: " + err.message);
      setIsImportingLeave(false);
    }
    e.target.value = "";
  };

  if (!settings) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-40 bg-gray-200 rounded"></div></div>;

  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN" || user?.position === "犹≒ｸｭ犧扉ｸ｡犧ｴ犧�";
  const isHRHead = user?.position === "犧ｫ犧ｱ犧ｧ犧ｫ犧吭ｹ霞ｸｲ犧�ｸｲ犧吭ｸ壟ｸｸ犧�ｸ�ｸ･" || user?.position === "犹犧謂ｹ霞ｸｲ犧ｫ犧吭ｹ霞ｸｲ犧伶ｸｵ犹謂ｸ壟ｸｸ犧�ｸ�ｸ･";
  const isInspector = user?.position === "犧憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧�";

  if (!isAdmin && !isHRHead && !isInspector) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-red-100 dark:border-red-900/30 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">犹犧もｹ霞ｸｲ犧籾ｸｶ犧�ｹ�ｸ｡犹謂ｹ�ｸ扉ｹ�</h2>
        <p className="text-sm text-gray-500">犧�ｸｸ犧内ｹ�ｸ｡犹謂ｸ｡犧ｵ犧ｪ犧ｴ犧伶ｸ倨ｸｴ犹呉ｹ�ｸ吭ｸ≒ｸｲ犧｣犹犧もｹ霞ｸｲ犧籾ｸｶ犧�ｸ≒ｸｲ犧｣犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犧｣犧ｰ犧壟ｸ�</p>
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
    { id: "school", icon: <BookOpen className="w-5 h-5 text-blue-500" />, title: lang === "en" ? "School Info" : "犧もｹ霞ｸｭ犧｡犧ｹ犧･犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�", description: lang === "en" ? "School name, affiliation, logo" : "犧癌ｸｷ犹謂ｸｭ犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�, 犧ｪ犧ｱ犧�ｸ≒ｸｱ犧�, 犹もｸ･犹もｸ≒ｹ�" },
    { id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "Approval Chain" : "犧ｪ犧ｲ犧｢犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ", description: lang === "en" ? "Inspector, approver, acting director" : "犧憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧�, 犧憫ｸｹ犹霞ｸｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ, 犧歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�ｸ｣犧ｱ犧≒ｸｩ犧ｲ犧≒ｸｲ犧｣" },
    { id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "犧｣犧ｰ犹犧壟ｸｵ犧｢犧壟ｸ≒ｸｲ犧｣犧･犧ｲ & 犹もｸ�ｸｧ犧歩ｸｲ", description: lang === "en" ? "Rules, quotas, restrictions" : "犧≒ｸ錫ｸ｣犧ｰ犹犧壟ｸｵ犧｢犧�, 犹もｸ�ｸｧ犧歩ｸｲ犧ｧ犧ｱ犧吭ｸ･犧ｲ, 犧もｹ霞ｸｭ犧謂ｸｳ犧≒ｸｱ犧�" },
    { id: "line", icon: <Bell className="w-5 h-5 text-green-500" />, title: lang === "en" ? "LINE Notification" : "犹≒ｸ謂ｹ霞ｸ�ｹ犧歩ｸｷ犧ｭ犧� LINE", description: lang === "en" ? "Enable/disable, Token, Group ID" : "犹犧巵ｸｴ犧�/犧巵ｸｴ犧扉ｸ≒ｸｲ犧｣犹≒ｸ謂ｹ霞ｸ�ｹ犧歩ｸｷ犧ｭ犧�, Token, Group ID" },
    { id: "font", icon: <Type className="w-5 h-5 text-indigo-500" />, title: lang === "en" ? "Font & File Format" : "犧游ｸｭ犧吭ｸ歩ｹ� & 犧｣犧ｹ犧巵ｹ≒ｸ壟ｸ壟ｹ�ｸ游ｸ･犹�", description: lang === "en" ? "Leave form font, Google Drive format" : "犧游ｸｭ犧吭ｸ歩ｹ呉ｹ�ｸ壟ｸ･犧ｲ, 犧｣犧ｹ犧巵ｹ≒ｸ壟ｸ壟ｸｭ犧ｱ犧巵ｹもｸｫ犧･犧� Google Drive" },
  ];

  const dataManagementItems: MenuItem[] = [
    { id: "backup", icon: <HardDrive className="w-5 h-5 text-teal-500" />, title: lang === "en" ? "Backup & Data" : "犧ｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･", description: lang === "en" ? "Export/Import, clear data" : "Export/Import, 犧巵ｸｴ犧扉ｸ｣犧ｭ犧�, 犧･犹霞ｸｲ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･" },
    ...((session?.user as any)?.isActualAdmin === true ? [
      { id: "impersonate", icon: <UserCog className="w-5 h-5 text-indigo-500" />, title: lang === "en" ? "Role Impersonation" : "犧謂ｸｳ犧･犧ｭ犧�ｸ壟ｸ伶ｸ壟ｸｲ犧�", description: lang === "en" ? "Simulate roles for testing" : "犧謂ｸｳ犧･犧ｭ犧�ｸ歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�ｹ犧樅ｸｷ犹謂ｸｭ犧伶ｸ扉ｸｪ犧ｭ犧壟ｸ｣犧ｰ犧壟ｸ�" },
    ] : []),
    { id: "footer", icon: <Settings2 className="w-5 h-5 text-rose-500" />, title: lang === "en" ? "Footer Settings" : "犧伶ｹ霞ｸｲ犧｢犧≒ｸ｣犧ｰ犧扉ｸｲ犧ｩ", description: lang === "en" ? "Website footer text" : "犧もｹ霞ｸｭ犧�ｸｧ犧ｲ犧｡犧伶ｹ霞ｸｲ犧｢犧ｫ犧吭ｹ霞ｸｲ犹犧ｧ犹�ｸ�" },
  ];

  // HR Head sees only approval + leave-rules
  const hrHeadItems: MenuItem[] = [
    { id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "System & Approver Settings" : "犧ｪ犧ｲ犧｢犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ", description: lang === "en" ? "Inspector, approver, acting director" : "犧憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧�, 犧憫ｸｹ犹霞ｸｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ, 犧歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�ｸ｣犧ｱ犧≒ｸｩ犧ｲ犧≒ｸｲ犧｣" },
    { id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "犧｣犧ｰ犹犧壟ｸｵ犧｢犧壟ｸ≒ｸｲ犧｣犧･犧ｲ & 犹もｸ�ｸｧ犧歩ｸｲ", description: lang === "en" ? "Rules, quotas, restrictions" : "犧≒ｸ錫ｸ｣犧ｰ犹犧壟ｸｵ犧｢犧�, 犹もｸ�ｸｧ犧歩ｸｲ犧ｧ犧ｱ犧吭ｸ･犧ｲ, 犧もｹ霞ｸｭ犧謂ｸｳ犧≒ｸｱ犧�" },
  ];

  // Inspector sees approval + leave-rules + backup
  const inspectorItems: MenuItem[] = [
    { id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "System & Approver Settings" : "犧ｪ犧ｲ犧｢犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ", description: lang === "en" ? "Inspector, approver, acting director" : "犧憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧�, 犧憫ｸｹ犹霞ｸｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ, 犧歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�ｸ｣犧ｱ犧≒ｸｩ犧ｲ犧≒ｸｲ犧｣" },
    { id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "犧｣犧ｰ犹犧壟ｸｵ犧｢犧壟ｸ≒ｸｲ犧｣犧･犧ｲ & 犹もｸ�ｸｧ犧歩ｸｲ", description: lang === "en" ? "Rules, quotas, restrictions" : "犧≒ｸ錫ｸ｣犧ｰ犹犧壟ｸｵ犧｢犧�, 犹もｸ�ｸｧ犧歩ｸｲ犧ｧ犧ｱ犧吭ｸ･犧ｲ, 犧もｹ霞ｸｭ犧謂ｸｳ犧≒ｸｱ犧�" },
    { id: "backup", icon: <HardDrive className="w-5 h-5 text-teal-500" />, title: lang === "en" ? "Backup & Data" : "犧ｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･", description: lang === "en" ? "Export/Import, clear data" : "Export/Import, 犧巵ｸｴ犧扉ｸ｣犧ｭ犧�, 犧･犹霞ｸｲ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･" },
  ];

  // --- Section title lookup ---
  const sectionTitles: Record<string, string> = {
    school: lang === "en" ? "School Info" : "犧もｹ霞ｸｭ犧｡犧ｹ犧･犹もｸ｣犧�ｹ犧｣犧ｵ犧｢犧�",
    approval: lang === "en" ? ((isHRHead || isInspector) ? "System & Approver Settings" : "Approval Chain") : ((isHRHead || isInspector) ? "犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犧憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧壟ｹ≒ｸ･犧ｰ犧憫ｸｹ犹霞ｸｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ犧｣犧ｰ犧壟ｸ�" : "犧ｪ犧ｲ犧｢犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ"),
    "leave-rules": lang === "en" ? "Leave Rules & Quotas" : "犧｣犧ｰ犹犧壟ｸｵ犧｢犧壟ｸ≒ｸｲ犧｣犧･犧ｲ & 犹もｸ�ｸｧ犧歩ｸｲ",
    line: lang === "en" ? "LINE Notification" : "犹≒ｸ謂ｹ霞ｸ�ｹ犧歩ｸｷ犧ｭ犧� LINE",
    font: lang === "en" ? "Font & File Format" : "犧游ｸｭ犧吭ｸ歩ｹ� & 犧｣犧ｹ犧巵ｹ≒ｸ壟ｸ壟ｹ�ｸ游ｸ･犹�",
    backup: lang === "en" ? "Backup & Data" : "犧ｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･",
    impersonate: lang === "en" ? "Role Impersonation" : "犧謂ｸｳ犧･犧ｭ犧�ｸ壟ｸ伶ｸ壟ｸｲ犧�",
    footer: lang === "en" ? "Footer Settings" : "犧伶ｹ霞ｸｲ犧｢犧≒ｸ｣犧ｰ犧扉ｸｲ犧ｩ",
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
              <input 
                type="file" 
                id="logo-upload" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  handleFileChange(e);
                  setLogoActionSheetOpen(false);
                }} 
                disabled={isUploading} 
              />
              <button
                type="button"
                onClick={() => setLogoActionSheetOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
              >
                {isUploading ? t("uploading") : (lang === "en" ? "Manage Logo" : "จัดการโลโก้")}
              </button>
              <p className="text-xs text-gray-500 mt-2">{lang === "en" ? "Supports PNG, JPG max 2MB" : "รองรับ PNG, JPG ขนาดไม่เกิน 2MB"}</p>
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">犧ｪ犧ｱ犧�ｸ≒ｸｱ犧�</label>
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
        {/* Default Inspector - Tag Input style */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {lang === "en" ? "Default Inspector" : "ผู้ตรวจสอบใบลาสะสม (ค่าเริ่มต้น)"}
          </label>
          {defaultInspectorId ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-sm font-semibold max-w-max">
              <span>
                {eligibleInspectors.find(u => u.id === defaultInspectorId)?.name || defaultInspectorId}
                {eligibleInspectors.find(u => u.id === defaultInspectorId)?.position ? ` (${eligibleInspectors.find(u => u.id === defaultInspectorId)?.position})` : ""}
              </span>
              <button
                type="button"
                onClick={() => setDefaultInspectorId("")}
                className="p-0.5 hover:bg-indigo-150 dark:hover:bg-indigo-900 rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={inspectorSearch}
                onChange={(e) => {
                  setInspectorSearch(e.target.value);
                  setShowInspectorDropdown(true);
                }}
                onFocus={() => setShowInspectorDropdown(true)}
                placeholder={lang === "en" ? "Search to select inspector..." : "พิมพ์ค้นหาผู้ตรวจสอบใบลา..."}
                className="w-full h-11 px-4 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
              {showInspectorDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowInspectorDropdown(false)} />
                  <div className="absolute z-20 w-full mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1.5 divide-y divide-gray-50 dark:divide-gray-800">
                    {(() => {
                      const filtered = eligibleInspectors.filter(u => 
                        u.name.toLowerCase().includes(inspectorSearch.toLowerCase()) ||
                        (u.position && u.position.toLowerCase().includes(inspectorSearch.toLowerCase()))
                      );
                      if (filtered.length === 0) {
                        return (
                          <p className="text-xs text-gray-400 text-center py-3">
                            {lang === "en" ? "No users found" : "ไม่พบผู้ใช้ที่ค้นหา"}
                          </p>
                        );
                      }
                      return filtered.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setDefaultInspectorId(u.id);
                            setInspectorSearch("");
                            setShowInspectorDropdown(false);
                          }}
                          className="p-2.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg cursor-pointer transition-colors flex justify-between items-center"
                        >
                          <span className="font-semibold">{u.name}</span>
                          {u.position && <span className="text-[10px] text-gray-400 font-medium bg-gray-100 dark:bg-gray-850 px-1.5 py-0.5 rounded">{u.position}</span>}
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
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
          {/* Final Approvers - Tag Input style */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {lang === "en" ? "Additional Final Approvers" : "ผู้มีสิทธิ์อนุมัติขั้นสุดท้ายเพิ่มเติม"}
            </label>
            {/* Tag list */}
            <div className="flex flex-wrap gap-2 mb-2">
              {finalApproverUserIds.map((userId) => {
                const u = eligibleInspectors.find(x => x.id === userId);
                return (
                  <div key={userId} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-105 dark:border-emerald-900/50 text-xs font-semibold">
                    <span>{u ? u.name : userId} {u?.position ? `(${u.position})` : ""}</span>
                    <button
                      type="button"
                      onClick={() => setFinalApproverUserIds(prev => prev.filter(id => id !== userId))}
                      className="p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {finalApproverUserIds.length === 0 && (
                <span className="text-xs text-gray-400 italic py-1">{lang === "en" ? "No additional approvers selected" : "ไม่มีผู้อนุมัติเพิ่มเติม (มีเพียง ผอ. และแอดมิน)"}</span>
              )}
            </div>
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={approverSearch}
                onChange={(e) => {
                  setApproverSearch(e.target.value);
                  setShowApproverDropdown(true);
                }}
                onFocus={() => setShowApproverDropdown(true)}
                placeholder={lang === "en" ? "Search to add final approver..." : "พิมพ์ค้นหาเพื่อเพิ่มสิทธิ์อนุมัติ..."}
                className="w-full h-11 px-4 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
              {showApproverDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowApproverDropdown(false)} />
                  <div className="absolute z-20 w-full mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1.5 divide-y divide-gray-50 dark:divide-gray-800">
                    {(() => {
                      const filtered = eligibleInspectors.filter(u => 
                        u.position !== "ผู้อำนวยการ" &&
                        !finalApproverUserIds.includes(u.id) &&
                        (u.name.toLowerCase().includes(approverSearch.toLowerCase()) ||
                        (u.position && u.position.toLowerCase().includes(approverSearch.toLowerCase())))
                      );
                      if (filtered.length === 0) {
                        return (
                          <p className="text-xs text-gray-400 text-center py-3">
                            {lang === "en" ? "No eligible users found" : "ไม่พบผู้ใช้เพิ่มเติม (หรือมีชื่ออยู่แล้ว)"}
                          </p>
                        );
                      }
                      return filtered.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setFinalApproverUserIds(prev => [...prev, u.id]);
                            setApproverSearch("");
                            setShowApproverDropdown(false);
                          }}
                          className="p-2.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg cursor-pointer transition-colors flex justify-between items-center"
                        >
                          <span className="font-semibold">{u.name}</span>
                          {u.position && <span className="text-[10px] text-gray-400 font-medium bg-gray-100 dark:bg-gray-850 px-1.5 py-0.5 rounded">{u.position}</span>}
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>
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
              <span>{lang === "en" ? "Show 'Acting Director' title on printed leave forms" : "แสดงแถว \\\"รักษาการในตำแหน่ง ผอ.\\\" ในใบลา (กรณีไม่ใช่ ผอ. ลงนาม)"}</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 pl-6">{lang === "en" ? "When enabled, an additional title line will appear below the approver's signature on printed forms when the final approver is not the Director." : "เมื่อเปิดใช้งาน จะแสดงข้อความระบุตำแหน่งรักษาการฯ ใต้ลายเซ็นต์ผู้อนุมัติในใบลาที่พิมพ์ กรณีผู้อนุมัติไม่ใช่ ผอ."}</p>
          </div>
          {showActingDirectorTitle && (
            <div className="mt-4 pl-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {lang === "en" ? "Acting Director Title Type" : "คำระบุตำแหน่งรักษาการในใบลา"}
                </label>
                <select
                  value={actingDirectorTitleType}
                  onChange={(e) => setActingDirectorTitleType(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none outline-none"
                >
                  <option value="รักษาราชการแทนผู้อำนวยการโรงเรียน">รักษาราชการแทนผู้อำนวยการโรงเรียน</option>
                  <option value="รักษาการแทนผู้อำนวยการโรงเรียน">รักษาการแทนผู้อำนวยการโรงเรียน</option>
                  <option value="รักษาการในตำแหน่งผู้อำนวยการโรงเรียน">รักษาการในตำแหน่งผู้อำนวยการโรงเรียน</option>
                  <option value="custom">{lang === "en" ? "Custom Title..." : "กำหนดเอง (ระบุรายละเอียดเอง)"}</option>
                </select>
              </div>
              {actingDirectorTitleType === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {lang === "en" ? "Custom Acting Title" : "ระบุตำแหน่งรักษาการด้วยตนเอง"}
                  </label>
                  <input
                    type="text"
                    value={customActingDirectorTitle}
                    onChange={(e) => setCustomActingDirectorTitle(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm outline-none"
                    placeholder="เช่น รองผู้อำนวยการ รักษาราชการแทน..."
                  />
                </div>
              )}
              {/* Explanation box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">💡 ข้อมูลอ้างอิงการระบุตำแหน่งสำหรับการลงนาม:</div>
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
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y outline-none"
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

      {/* Leave Quota Config - Table layout style */}
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

          <fieldset disabled={isInspector} className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-850">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-850">
                  <th className="px-4 py-3 text-center w-20">{lang === "en" ? "Active" : "เปิดใช้งาน"}</th>
                  <th className="px-4 py-3">{lang === "en" ? "Leave Type" : "ประเภทการลา"}</th>
                  <th className="px-4 py-3 w-36">{lang === "en" ? "Max Days/Year" : "โควตาสูงสุด (วัน)"}</th>
                  <th className="px-4 py-3 w-36">{lang === "en" ? "Warning Threshold" : "เตือนเมื่อเหลือ (วัน)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {leaveConfigs.map((config) => (
                  <tr key={config.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3.5 text-center">
                      <label className="relative inline-flex items-center cursor-pointer justify-center">
                        <input 
                          type="checkbox" 
                          checked={config.isActive !== false} 
                          onChange={(e) => handleQuotaChange(config.id, "isActive", e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-255 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-850 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                      </label>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm font-semibold text-gray-950 dark:text-white">{config.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">{config.type}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <input 
                        type="number" 
                        value={config.maxDaysPerYear || 0} 
                        onChange={(e) => handleQuotaChange(config.id, "maxDaysPerYear", Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-bold text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input 
                        type="number" 
                        value={config.warningThreshold || 0} 
                        onChange={(e) => handleQuotaChange(config.id, "warningThreshold", Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-bold text-gray-950 dark:text-white"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <span>{lang === "en" ? "Require Personal Leave 1-Day in Advance" : "ลากิจส่วนตัวต้องยื่นคำขอล่วงหน้าอย่างน้อย 1 วันทำการ"}</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 pl-6">หากเปิดใช้งาน บุคลากรจะไม่สามารถยื่นคำขอลากิจส่วนตัวสำหรับวันนี้หรือย้อนหลังได้</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-6">
              <div>
                <label className="block text-xs font-semibold text-gray-650 dark:text-gray-400 mb-1.5">
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
                <label className="block text-xs font-semibold text-gray-650 dark:text-gray-400 mb-1.5">
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

            {/* Exceeded Quota Policy - Radio Button Style */}
            <div className="mt-4 pl-6 space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {lang === "en" ? "Quota Exceeded Policy" : "นโยบายกรณีวันลาเกินโควตา"}
              </label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    value: "ALLOW_WITH_MEMO",
                    titleTh: "อนุญาตให้ยื่นลาโดยต้องรายงาน ผอ. (Allow with Memo)",
                    descTh: "ผู้ยื่นคำขอที่วันลาเกินโควตาต้องยอมรับข้อตกลงและติ๊กช่องยืนยันการรายงาน ผอ. จึงจะสามารถส่งใบลาได้",
                    titleEn: "Allow request with Director report confirmation",
                    descEn: "User can submit if they check the confirmation box acknowledging they reported to the Director."
                  },
                  {
                    value: "BLOCK",
                    titleTh: "บล็อกการยื่นคำขอลาโดยสิ้นเชิง (Block Entirely)",
                    descTh: "ไม่อนุญาตให้ผู้ยื่นคำขอส่งใบลาที่มีจำนวนวันลาสะสมเกินโควตาประจำปีโดยเด็ดขาด",
                    titleEn: "Block request submission entirely",
                    descEn: "Completely prevents submitting leave requests once the quota limit is reached."
                  }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                      quotaExceededAction === option.value
                        ? "border-indigo-650 bg-indigo-50/30 dark:border-indigo-500 dark:bg-indigo-950/20"
                        : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quotaExceededAction"
                      value={option.value}
                      checked={quotaExceededAction === option.value}
                      onChange={() => setQuotaExceededAction(option.value)}
                      className="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <div className="-mt-0.5">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                        {lang === "en" ? option.titleEn : option.titleTh}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {lang === "en" ? option.descEn : option.descTh}
                      </span>
                    </div>
                  </label>
                ))}
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
      <fieldset disabled={isInspector} className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
          <div>
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
              {lang === "en" ? "Enable LINE Notifications" : "เปิดใช้งานการแจ้งเตือนผ่าน LINE"}
            </span>
            <span className="block text-xs text-gray-500 mt-1">
              {lang === "en" 
                ? "Send notifications for leave requests, approvals, and cancellations."
                : "ส่งข้อความแจ้งเตือนอัตโนมัติ (ส่งใบลาใหม่, ผลอนุมัติ, การยกเลิกใบลา)"}
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableLineNotify}
              onChange={(e) => setEnableLineNotify(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-250 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {enableLineNotify && (
          <div className="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LINE Channel Access Token
              </label>
              <input
                type="password"
                value={lineChannelAccessToken}
                onChange={(e) => setLineChannelAccessToken(e.target.value)}
                placeholder="LINE Channel Access Token"
                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LINE Target Group ID (Chat ID)
              </label>
              <input
                type="text"
                value={lineTargetGroupId}
                onChange={(e) => setLineTargetGroupId(e.target.value)}
                placeholder="LINE Target Group ID"
                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>
        )}
      </fieldset>
      {!isInspector && (
        <StickySaveBar isSaving={isSavingGeneral} label={isSavingGeneral ? t("saving") : t("saveSettings")} color="indigo" />
      )}
    </form>
  );

  const downloadErrorCSV = () => {
    if (invalidRecords.length === 0) return;
    const header = "แถวในไฟล์,Username,วันที่เริ่ม,วันที่สิ้นสุด,ประเภท,เหตุผล,ข้อผิดพลาด\\n";
    const rows = invalidRecords.map(r => 
      `"${r.rowNum}","${r.username || ""}","${r.startDate || ""}","${r.endDate || ""}","${r.type || ""}","${r.reason || ""}","${r.errors.join("; ")}"`
    ).join("\\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `eleave_import_errors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeFinalImport = async () => {
    setIsImportingLeave(true);
    try {
      const result = await importLeaveSimple(validRecords, importLeaveMode);
      if (result.success) {
        setImportLeaveResult(result);
        setLastImportedIds(result.createdIds || []);
        setImportStage("summary");
        showToast("success", lang === "en" ? `Imported ${result.imported} records successfully` : `นำเข้าข้อมูลการลาสำเร็จ ${result.imported} รายการ`);
        getImportHistory().then(setImportHistory);
      } else {
        showToast("error", "เกิดข้อผิดพลาดในการนำเข้า");
      }
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setIsImportingLeave(false);
    }
  };

  const handleUndoLastImport = async () => {
    if (lastImportedIds.length === 0) return;
    if (!confirm(lang === "en" ? "Are you sure you want to undo the last import? All imported records will be deleted." : "คุณแน่ใจหรือไม่ว่าต้องการย้อนกลับการนำเข้าครั้งล่าสุด? รายการลาทั้งหมดที่นำเข้ามาจะถูกลบออก")) return;
    
    try {
      const res = await undoImportLeave(lastImportedIds);
      if (res.success) {
        showToast("success", lang === "en" ? `Undo success. Deleted ${res.count} records.` : `ย้อนกลับสำเร็จ ลบรายการที่นำเข้าแล้ว ${res.count} รายการ`);
        setLastImportedIds([]);
        getImportHistory().then(setImportHistory);
      } else {
        showToast("error", res.error || "ไม่สามารถย้อนกลับได้");
      }
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const renderBackupSection = () => (
    <div className="space-y-6">
      <SectionHeader title={sectionTitles.backup} />

      {/* Floating Undo Import Banner */}
      {lastImportedIds.length > 0 && (
        <div className="p-4 bg-indigo-600 dark:bg-indigo-700 text-white rounded-2xl shadow-lg border border-indigo-500 flex items-center justify-between animate-fade-in print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">
              {lang === "en" ? `Imported successfully. Selected ${lastImportedIds.length} records.` : `นำเข้าข้อมูลเรียบร้อยแล้ว จำนวน ${lastImportedIds.length} รายการ`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleUndoLastImport}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            {lang === "en" ? "↩️ Undo Import" : "↩️ ย้อนกลับการนำเข้า"}
          </button>
        </div>
      )}

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

      {/* Leave Data Backup / Premium Wizard */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-start gap-2 mb-2">
          <Database className="w-5 h-5 text-purple-500 mt-1 shrink-0" />
          <div>
            <span className="block">{lang === "th" ? "จัดการนำเข้าและสำรองข้อมูลวันลา" : "Leave Data Import & Export"}</span>
            <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
              (Leave Data Management Wizard)
            </span>
          </div>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
          {lang === "en"
            ? "Export leave data as JSON/Excel/CSV or use the drag & drop area to upload and preview data before importing."
            : "นำออกข้อมูลการลาเป็นไฟล์รูปแบบต่างๆ หรือลากไฟล์มาวางเพื่อจำลองตรวจสอบข้อมูล (Preview) ก่อนยืนยันนำเข้าเข้าระบบจริง"}
        </p>
        
        <div className="space-y-4">
          {/* Export Buttons */}
          {importStage === "idle" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={handleExportLeave}
                disabled={isExportingLeave}
                className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 font-bold text-sm transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 justify-center">
                  <FileJson className="w-4 h-4 shrink-0" />
                  <span>{isExportingLeave ? (lang === "en" ? "Exporting JSON..." : "กำลังส่งออก JSON...") : (lang === "en" ? "Export (JSON)" : "ส่งออกข้อมูล (JSON)")}</span>
                </div>
              </button>
              <button
                onClick={handleExportLeaveExcel}
                disabled={isExportingLeave}
                className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 font-bold text-sm transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 justify-center">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>{isExportingLeave ? (lang === "en" ? "Exporting Excel..." : "กำลังส่งออก Excel...") : (lang === "en" ? "Export (Excel)" : "ส่งออกข้อมูล (Excel)")}</span>
                </div>
              </button>
              <button
                onClick={handleExportLeaveCSV}
                disabled={isExportingLeave}
                className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 font-bold text-sm transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 justify-center">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>{isExportingLeave ? (lang === "en" ? "Exporting CSV..." : "กำลังส่งออก CSV...") : (lang === "en" ? "Export (CSV)" : "ส่งออกข้อมูล (CSV)")}</span>
                </div>
              </button>
            </div>
          )}

          {/* Premium Wizard Stages */}
          {importStage === "idle" && (
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-purple-500" /> {t("importModeLabel") || "เลือกโหมดการนำเข้าข้อมูลการลา"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCSVTemplate}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100/50 text-[10px] font-bold rounded-lg transition-all"
                  >
                    <DownloadCloud className="w-3 h-3" />
                    {lang === "en" ? "CSV Template" : "ดาวน์โหลดเทมเพลต CSV"}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenRefModal}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 text-[10px] font-bold rounded-lg transition-all"
                  >
                    <BookOpen className="w-3 h-3" />
                    {lang === "en" ? "Reference Codes" : "รหัสอ้างอิงข้อมูล"}
                  </button>
                </div>
              </div>
              
              {/* Segmented Control for Mode */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => setImportLeaveMode("merge")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    importLeaveMode === "merge"
                      ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                  }`}
                >
                  ผสาน (Merge)
                </button>
                <button
                  type="button"
                  onClick={() => setImportLeaveMode("replace")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    importLeaveMode === "replace"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "text-slate-500 hover:text-rose-550"
                  }`}
                >
                  แทนที่ (Replace)
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center leading-normal">
                {importLeaveMode === "merge"
                  ? "ผสาน: จะนำเข้ารายการใหม่โดยละเว้นรายการที่มีผู้ใช้ ประเภท และวันเดียวกันในระบบอยู่แล้ว (ข้อมูลเดิมไม่หาย)"
                  : "แทนที่: ลบข้อมูลการลาปีงบประมาณปัจจุบันทั้งหมด และนำเข้าข้อมูลใหม่นี้แทนที่ทันที (โปรดระมัดระวัง)"}
              </p>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    const inputEl = document.getElementById("wizard-file-upload") as HTMLInputElement;
                    if (inputEl) {
                      inputEl.files = dt.files;
                      const event = new Event("change", { bubbles: true });
                      inputEl.dispatchEvent(event);
                    }
                  }
                }}
                onClick={() => document.getElementById("wizard-file-upload")?.click()}
                className={`w-full py-8 px-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  isDragOver 
                    ? "border-indigo-500 bg-indigo-50/20 dark:border-indigo-400 dark:bg-indigo-950/20 scale-[0.99]"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-850/30"
                }`}
              >
                <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-bounce" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-350">
                  {lang === "en" ? "Drag & drop files here or click to choose" : "📁 ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์"}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {lang === "en" ? "Supports JSON, CSV, XLS, XLSX" : "รองรับไฟล์รูปแบบ JSON, CSV, XLS, XLSX"}
                </span>
                <input 
                  type="file" 
                  id="wizard-file-upload" 
                  accept=".json,.csv,.xlsx,.xls" 
                  className="hidden" 
                  onChange={handleImportLeave} 
                  disabled={isImportingLeave} 
                />
              </div>
            </div>
          )}

          {/* Preview Panel */}
          {importStage === "preview" && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">
                    {lang === "en" ? "Data Import Verification" : "🔍 ผลการตรวจสอบข้อมูลการนำเข้า"}
                  </span>
                  <span className="block text-xs text-slate-500 mt-1">
                    {lang === "en" 
                      ? `Total parsed: ${parsedRecords.length} records. Valid: ${validRecords.length}, Invalid: ${invalidRecords.length}` 
                      : `พบข้อมูลทั้งหมด ${parsedRecords.length} รายการ | สมบูรณ์พร้อมนำเข้า: ${validRecords.length} รายการ | มีข้อผิดพลาด: ${invalidRecords.length} รายการ`}
                  </span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  {invalidRecords.length > 0 && (
                    <button
                      type="button"
                      onClick={downloadErrorCSV}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-55 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-200/50 text-xs font-bold transition-all flex-1 md:flex-none"
                    >
                      ⚠️ {lang === "en" ? "Download Error Report" : "ดาวน์โหลดรายงานข้อผิดพลาด"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImportStage("idle");
                      setParsedRecords([]);
                      setValidRecords([]);
                      setInvalidRecords([]);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-300 text-xs font-bold transition-all flex-1 md:flex-none"
                  >
                    {lang === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                </div>
              </div>

              {/* Valid preview (first 5 records) */}
              {validRecords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">ตัวอย่างรายการที่ถูกต้อง (แสดง 5 แถวแรก)</h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                          <th className="px-4 py-2.5">แถว</th>
                          <th className="px-4 py-2.5">ผู้ยื่นคำขอ</th>
                          <th className="px-4 py-2.5">ประเภทการลา</th>
                          <th className="px-4 py-2.5">วันที่</th>
                          <th className="px-4 py-2.5">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {validRecords.slice(0, 5).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/30">
                            <td className="px-4 py-3 font-semibold text-slate-400">{r.rowNum}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-800 dark:text-white">{r.matchedUserName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">@{r.username}</div>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{r.type} ({r.mappedType})</td>
                            <td className="px-4 py-3 text-slate-500">
                              {r.startDate.split("T")[0]} ถึง {r.endDate.split("T")[0]}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 font-semibold text-[10px] border border-emerald-100">
                                {r.status || "APPROVED"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors list */}
              {invalidRecords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider pl-1">รายการที่ไม่ถูกต้องและต้องแก้ไข (แสดงสูงสุด 5 แถว)</h4>
                  <div className="p-3 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/40 rounded-2xl divide-y divide-rose-100 dark:divide-rose-900/30">
                    {invalidRecords.slice(0, 5).map((r, i) => (
                      <div key={i} className="py-2 flex items-start justify-between text-xs gap-3">
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-350">แถวที่ {r.rowNum} (@{r.username || "ไม่ระบุ"})</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">ประเภท: {r.type || "-"} | วันที่: {r.startDate?.split("T")?.[0] || "-"} ถึง {r.endDate?.split("T")?.[0] || "-"}</span>
                        </div>
                        <div className="text-right text-red-650 dark:text-red-400 font-semibold">
                          {r.errors.join(", ")}
                        </div>
                      </div>
                    ))}
                    {invalidRecords.length > 5 && (
                      <div className="pt-2 text-center text-[10px] text-slate-400 font-semibold">
                        ยังมีแถวที่ผิดพลาดเพิ่มเติมอีก {invalidRecords.length - 5} รายการ โปรดกดดาวน์โหลดรายงานด้านบนเพื่อตรวจสอบทั้งหมด
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                {validRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={executeFinalImport}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    {lang === "en" ? `Confirm Import (${validRecords.length} records)` : `✅ ยืนยันการนำเข้าข้อมูล (${validRecords.length} รายการ)`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Post Import Summary */}
          {importStage === "summary" && importLeaveResult && (
            <div className="p-6 bg-emerald-50/15 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl text-center space-y-4 animate-fade-in">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div>
                <span className="block font-bold text-slate-900 dark:text-white text-base">
                  {lang === "en" ? "Import Complete" : "นำเข้าข้อมูลการลาเสร็จสมบูรณ์"}
                </span>
                <span className="block text-xs text-slate-500 mt-1">
                  {lang === "en" ? "The leave requests have been successfully stored in the database." : "ประวัติการลาที่ถูกต้องได้รับการบันทึกเข้าระบบเรียบร้อยแล้ว"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-lg font-bold text-emerald-600">{importLeaveResult.imported}</span>
                  <span className="block text-[10px] text-slate-400 font-semibold">{t("importedSuccess")}</span>
                </div>
                <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-lg font-bold text-slate-400">{importLeaveResult.skipped}</span>
                  <span className="block text-[10px] text-slate-400 font-semibold">{t("skipped")}</span>
                </div>
                <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-lg font-bold text-purple-600">{importLeaveResult.total}</span>
                  <span className="block text-[10px] text-slate-400 font-semibold">{t("total")}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setImportStage("idle");
                  setImportLeaveResult(null);
                  setParsedRecords([]);
                  setValidRecords([]);
                  setInvalidRecords([]);
                }}
                className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs shadow-sm transition-all"
              >
                {lang === "en" ? "Close" : "ปิดหน้าต่างสรุป"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Import/Action History Logs */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-indigo-500" />
          {lang === "en" ? "Data Management Action Logs" : "ประวัติการจัดการและนำเข้าข้อมูล"}
        </h3>
        <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 p-2 divide-y divide-gray-50 dark:divide-gray-800">
          {importHistory.map((log) => (
            <div key={log.id} className="p-3 text-xs flex justify-between items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">{log.description}</span>
                <span className="block text-[10px] text-slate-400 mt-1">
                  {lang === "en" ? "Performed by: " : "ดำเนินการโดย: "}{log.user?.name || "System"} | Action: {log.actionType}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                {new Date(log.createdAt).toLocaleString(lang === "en" ? "en-US" : "th-TH")}
              </span>
            </div>
          ))}
          {importHistory.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">{lang === "en" ? "No action history found" : "ไม่พบประวัติการจัดการข้อมูล"}</p>
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
        犧ｪ犧ｳ犧ｫ犧｣犧ｱ犧壟ｹ≒ｸｭ犧扉ｸ｡犧ｴ犧吭ｹ犧伶ｹ謂ｸｲ犧吭ｸｱ犹霞ｸ�: 犧ｪ犧･犧ｱ犧壟ｹ�ｸ巵ｸ扉ｸｹ犧｣犧ｰ犧壟ｸ壟ｹ�ｸ吭ｸ｡犧ｸ犧｡犧｡犧ｭ犧�ｸもｸｭ犧�ｸ壟ｸ伶ｸ壟ｸｲ犧伶ｸ歩ｹ謂ｸｲ犧� 犹� 犹犧樅ｸｷ犹謂ｸｭ犧≒ｸｲ犧｣犧巵ｸ｣犧ｱ犧壟ｸ巵ｸ｣犧ｸ犧�ｸ｣犧ｰ犧壟ｸ壟ｹ≒ｸ･犧ｰ犧癌ｹ謂ｸｧ犧｢犹犧ｫ犧･犧ｷ犧ｭ犧憫ｸｹ犹霞ｹ�ｸ癌ｹ�
      </p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleImpersonate(null, "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all border border-slate-100 dark:border-slate-800"
        >
          <span>犧�ｸ｣犧ｹ (TEACHER)</span>
          <span className="text-xs font-normal text-slate-400">犧ｪ犧ｴ犧伶ｸ倨ｸｴ犹呉ｸ伶ｸｱ犹謂ｸｧ犹�ｸ�</span>
        </button>

        <button
          type="button"
          onClick={() => handleImpersonate("犧ｫ犧ｱ犧ｧ犧ｫ犧吭ｹ霞ｸｲ犧�ｸｲ犧吭ｸ壟ｸｸ犧�ｸ�ｸ･", "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold text-sm transition-all border border-purple-100/55 dark:border-purple-900/30"
        >
          <span>犧ｫ犧ｱ犧ｧ犧ｫ犧吭ｹ霞ｸｲ犧�ｸｲ犧吭ｸ壟ｸｸ犧�ｸ�ｸ･ (HR Head)</span>
          <span className="text-xs font-normal text-purple-400">犧≒ｸｳ犧ｫ犧吭ｸ扉ｹもｸ�ｸｧ犧歩ｸｲ/犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ犹�ｸ壟ｸ･犧ｲ</span>
        </button>

        <button
          type="button"
          onClick={() => handleImpersonate("犹犧謂ｹ霞ｸｲ犧ｫ犧吭ｹ霞ｸｲ犧伶ｸｵ犹謂ｸ壟ｸｸ犧�ｸ�ｸ･", "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold text-sm transition-all border border-purple-100/55 dark:border-purple-900/30"
        >
          <span>犹犧謂ｹ霞ｸｲ犧ｫ犧吭ｹ霞ｸｲ犧伶ｸｵ犹謂ｸ壟ｸｸ犧�ｸ�ｸ･ (HR Officer)</span>
          <span className="text-xs font-normal text-purple-400">犧≒ｸｳ犧ｫ犧吭ｸ扉ｹもｸ�ｸｧ犧歩ｸｲ/犧樅ｸｴ犧｡犧樅ｹ呉ｸ｣犧ｲ犧｢犧�ｸｲ犧�</span>
        </button>

        <button
          type="button"
          onClick={() => handleImpersonate("犧憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣", "TEACHER")}
          disabled={isImpersonating}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-all border border-indigo-100/55 dark:border-indigo-900/30"
        >
          <span>犧憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣ (EXEC)</span>
          <span className="text-xs font-normal text-indigo-400">犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ犧もｸｱ犹霞ｸ吭ｸｪ犧ｸ犧扉ｸ伶ｹ霞ｸｲ犧｢</span>
        </button>

        {/* Show Cancel Impersonation button if they are currently impersonating */}
        {((session?.user as any)?.role !== "ADMIN" && (session?.user as any)?.position !== "犹≒ｸｭ犧扉ｸ｡犧ｴ犧�") && (
          <button
            type="button"
            onClick={handleClearImpersonation}
            disabled={isImpersonating}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 mt-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-all shadow-md shadow-rose-500/10"
          >
            <span>犧｢犧≒ｹ犧･犧ｴ犧≒ｸ≒ｸｲ犧｣犧謂ｸｳ犧･犧ｭ犧�ｸｪ犧ｴ犧伶ｸ倨ｸｴ犹� (犧≒ｸ･犧ｱ犧壟ｹ犧巵ｹ�ｸ吭ｹ≒ｸｭ犧扉ｸ｡犧ｴ犧�)</span>
          </button>
        )}
      </div>
    </div>
  );

  const renderFontSection = () => (
    <form onSubmit={handleGeneralSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
      <SectionHeader title={sectionTitles.font} />
      <div className="space-y-6">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {lang === "en" 
            ? "Configure the font used on printed leave forms and the file format for Google Drive uploads." 
            : "กำหนดฟอนต์ที่ใช้ในแบบฟอร์มใบลา และรูปแบบไฟล์ที่อัปโหลดไปยัง Google Drive"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Font Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              {lang === "en" ? "Leave Form Font (Google Fonts)" : "ฟอนต์ใบลา (Google Fonts)"}
            </label>
            <div className="relative">
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
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1.5">
              <span>{lang === "en" ? "Preview: " : "ตัวอย่าง: "}</span>
              <span className="font-semibold px-2 py-0.5 bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-lg" style={{ fontFamily: `'${pdfFont}', sans-serif`, fontSize: '14px' }}>
                กขค ใบลา สวัสดีครับ ABC 123
              </span>
            </p>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              {lang === "en" ? "Google Drive Upload Format" : "รูปแบบไฟล์ใน Google Drive"}
            </label>
            <div className="relative">
              <select
                value={googleDriveFormat}
                onChange={(e) => setGoogleDriveFormat(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
              >
                <option value="PDF">PDF (.pdf)</option>
                <option value="JPG">JPG (.jpg)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {lang === "en" 
                ? "JPG may display Thai text better in some cases" 
                : "JPG อาจแสดงตัวอักษรไทยได้ดีกว่าในบางกรณี"}
            </p>
          </div>
        </div>
      </div>
      {!isInspector && (
        <StickySaveBar isSaving={isSavingGeneral} label={isSavingGeneral ? t("saving") : t("saveSettings")} color="indigo" />
      )}
    </form>
  );

  const renderFooterSection = () => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-rose-100 dark:border-rose-900/30 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-[100px] -z-10" />
      <SectionHeader title={sectionTitles.footer} />
      <p className="text-xs text-gray-500 mb-4">
        犧ｪ犹謂ｸｧ犧吭ｸ吭ｸｵ犹霞ｸ歩ｹ霞ｸｭ犧�ｸ≒ｸｲ犧｣ <span className="font-semibold text-rose-600">犧｣犧ｫ犧ｱ犧ｪ犧･犧ｱ犧壟ｸ吭ｸｱ犧≒ｸ樅ｸｱ犧亭ｸ吭ｸｲ</span> 犹�ｸ吭ｸ≒ｸｲ犧｣犹≒ｸ≒ｹ霞ｹ�ｸ�
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
            placeholder="犹�ｸｪ犹謂ｸ｣犧ｫ犧ｱ犧ｪ犧･犧ｱ犧壟ｸ伶ｸｵ犹謂ｸ吭ｸｵ犹�"
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
            {lang === "en" ? "System Settings" : "犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犧｣犧ｰ犧壟ｸ�"}
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
            {lang === "en" ? "Data Management" : "犧謂ｸｱ犧扉ｸ≒ｸｲ犧｣犧もｹ霞ｸｭ犧｡犧ｹ犧･"}
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
            <p className="font-bold">{lang === "en" ? "Restricted Access Mode" : "犹もｸｫ犧｡犧扉ｸｪ犧ｴ犧伶ｸ倨ｸｴ犹呉ｸ≒ｸｲ犧｣犹犧もｹ霞ｸｲ犧籾ｸｶ犧�ｹ≒ｸ壟ｸ壟ｸ謂ｸｳ犧≒ｸｱ犧�"}</p>
            <p className="text-xs text-blue-600/90 dark:text-blue-400 mt-1">
              {lang === "en" 
                ? "As HR role, you have access to view/edit leave quotas, leave rules, final approver settings, and general restrictions. Basic school details, LINE notify settings, developer configurations, backups, and system clear actions are restricted."
                : "犹犧吭ｸｷ犹謂ｸｭ犧�ｸ謂ｸｲ犧≒ｸ壟ｸ伶ｸ壟ｸｲ犧伶ｸもｸｭ犧�ｸ�ｸｸ犧内ｹ犧巵ｹ�ｸ吭ｹ犧謂ｹ霞ｸｲ犧ｫ犧吭ｹ霞ｸｲ犧伶ｸｵ犹謂ｸ�ｸｲ犧吭ｸ壟ｸｸ犧�ｸ�ｸ･ 犧�ｸｸ犧内ｸ謂ｸｰ犧｡犧ｵ犧ｪ犧ｴ犧伶ｸ倨ｸｴ犹呉ｹ犧もｹ霞ｸｲ犧籾ｸｶ犧�ｹ犧霞ｸ樅ｸｲ犧ｰ犧≒ｸｲ犧｣犧巵ｸ｣犧ｱ犧壟ｹ≒ｸ歩ｹ謂ｸ�ｹもｸ�ｸｧ犧歩ｸｲ犧≒ｸｲ犧｣犧･犧ｲ 犹≒ｸ≒ｹ霞ｹ�ｸもｸ≒ｸ錫ｹ犧≒ｸ内ｸ隊ｹ呉ｸ≒ｸｲ犧｣犧･犧ｲ 犧≒ｸｲ犧｣犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犧憫ｸｹ犹霞ｸｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ犧もｸｱ犹霞ｸ吭ｸｪ犧ｸ犧扉ｸ伶ｹ霞ｸｲ犧｢ 犹≒ｸ･犧ｰ犧もｹ霞ｸｭ犧謂ｸｳ犧≒ｸｱ犧扉ｸ伶ｸｱ犹謂ｸｧ犹�ｸ� 犧ｪ犹謂ｸｧ犧吭ｸもｹ霞ｸｭ犧｡犧ｹ犧･犧樅ｸｷ犹霞ｸ吭ｸ説ｸｲ犧吭ｹもｸ｣犧�ｹ犧｣犧ｵ犧｢犧� 犧≒ｸｲ犧｣犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犹≒ｸ謂ｹ霞ｸ�ｹ犧歩ｸｷ犧ｭ犧� LINE 犧もｹ霞ｸｭ犧｡犧ｹ犧･犧吭ｸｱ犧≒ｸ樅ｸｱ犧亭ｸ吭ｸｲ 犧≒ｸｲ犧｣犧ｪ犧ｳ犧｣犧ｭ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･ 犹≒ｸ･犧ｰ犧≒ｸｲ犧｣犧･犹霞ｸｲ犧�ｸもｹ霞ｸｭ犧｡犧ｹ犧･犧謂ｸｰ犧籾ｸｹ犧≒ｸ謂ｸｳ犧≒ｸｱ犧扉ｸｪ犧ｴ犧伶ｸ倨ｸｴ犹�"}
            </p>
          </div>
        </div>
      )}

      {/* Restricted access banner for Inspector */}
      {isInspector && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/40 rounded-2xl text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{lang === "en" ? "Inspector View Mode" : "犹もｸｫ犧｡犧扉ｸ扉ｸｹ犧もｹ霞ｸｭ犧｡犧ｹ犧･犧憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧�"}</p>
            <p className="text-xs text-amber-600/90 dark:text-amber-400 mt-1">
              {lang === "en" 
                ? "As an Inspector, you have read-only access to view leave configs, leave rules, final approvers, and settings. You can export leave data backups, but modifications, settings saving, data imports, and system clear actions are restricted."
                : "犹犧吭ｸｷ犹謂ｸｭ犧�ｸ謂ｸｲ犧≒ｸ壟ｸ伶ｸ壟ｸｲ犧伶ｸもｸｭ犧�ｸ�ｸｸ犧内ｹ犧巵ｹ�ｸ吭ｸ憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧� 犧�ｸｸ犧内ｸｪ犧ｲ犧｡犧ｲ犧｣犧籾ｹ犧もｹ霞ｸｲ犧扉ｸｹ犧≒ｸｲ犧｣犧歩ｸｱ犹霞ｸ�ｸ�ｹ謂ｸｲ犧ｪ犧ｲ犧｢犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ 犧≒ｸ錫ｸ｣犧ｰ犹犧壟ｸｵ犧｢犧壟ｸｧ犧ｱ犧吭ｸ･犧ｲ 犹≒ｸ･犧ｰ犹もｸ�ｸｧ犧歩ｸｲ犧ｧ犧ｱ犧吭ｸ･犧ｲ犧ｪ犧ｰ犧ｪ犧｡犧もｸｭ犧�ｸ壟ｸｸ犧�ｸ･犧ｲ犧≒ｸ｣犧伶ｸｸ犧≒ｸ�ｸ吭ｹ�ｸ扉ｹ霞ｹ≒ｸ壟ｸ壟ｸｭ犹謂ｸｲ犧吭ｸｭ犧｢犹謂ｸｲ犧�ｹ犧扉ｸｵ犧｢犧ｧ (Read-only) 犹もｸ扉ｸ｢犧謂ｸｰ犹�ｸ｡犹謂ｸ｡犧ｵ犧ｪ犧ｴ犧伶ｸ倨ｸｴ犹呉ｸ壟ｸｱ犧吭ｸ伶ｸｶ犧≒ｹ≒ｸ≒ｹ霞ｹ�ｸもｸもｹ霞ｸｭ犧｡犧ｹ犧･ 犧吭ｸｳ犹犧もｹ霞ｸｲ犧もｹ霞ｸｭ犧｡犧ｹ犧･ 犧ｫ犧｣犧ｷ犧ｭ犧･犹霞ｸｲ犧�ｸ｣犧ｰ犧壟ｸ壟ｹ犧樅ｸｷ犹謂ｸｭ犧�ｸｧ犧ｲ犧｡犧巵ｸ･犧ｭ犧扉ｸ�犧ｱ犧｢"}
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

      {/* Searchable Reference overlay modal */}
      {isRefModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-800 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {lang === "en" ? "Import Reference Codes" : "犧｣犧ｫ犧ｱ犧ｪ犧ｭ犹霞ｸｲ犧�ｸｭ犧ｴ犧�ｸｪ犧ｳ犧ｫ犧｣犧ｱ犧壟ｸ≒ｸｲ犧｣犧吭ｸｳ犹犧もｹ霞ｸｲ犧もｹ霞ｸｭ犧｡犧ｹ犧･"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {lang === "en"
                    ? "Use these exact codes in your CSV/Excel template columns."
                    : "犹�ｸ癌ｹ霞ｸ｣犧ｫ犧ｱ犧ｪ犹犧ｫ犧･犹謂ｸｲ犧吭ｸｵ犹霞ｹ�ｸ吭ｸｫ犧ｱ犧ｧ犧歩ｸｲ犧｣犧ｲ犧�ｸｫ犧｣犧ｷ犧ｭ犧もｹ霞ｸｭ犧｡犧ｹ犧･犹�ｸ吭ｹ犧伶ｸ｡犹犧樅ｸ･犧� CSV/Excel 犹犧樅ｸｷ犹謂ｸｭ犧≒ｸｲ犧｣犧吭ｸｳ犹犧もｹ霞ｸｲ犧伶ｸｵ犹謂ｸ籾ｸｹ犧≒ｸ歩ｹ霞ｸｭ犧�"}
                </p>
              </div>
              <button
                onClick={() => setIsRefModalOpen(false)}
                className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Bar */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 p-2 gap-1 bg-gray-50/50 dark:bg-gray-950/20">
              <button
                onClick={() => setRefModalTab("users")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  refModalTab === "users"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {lang === "en" ? "Users (IDs)" : "犧｣犧ｲ犧｢犧癌ｸｷ犹謂ｸｭ犧壟ｸｸ犧�ｸ･犧ｲ犧≒ｸ｣ (ID)"}
              </button>
              <button
                onClick={() => setRefModalTab("types")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  refModalTab === "types"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {lang === "en" ? "Leave Types" : "犧巵ｸ｣犧ｰ犹犧�犧伶ｸ≒ｸｲ犧｣犧･犧ｲ"}
              </button>
              <button
                onClick={() => setRefModalTab("statuses")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  refModalTab === "statuses"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {lang === "en" ? "Leave Statuses" : "犧ｪ犧籾ｸｲ犧吭ｸｰ犧≒ｸｲ犧｣犧･犧ｲ"}
              </button>
            </div>

            {/* Search Bar (Only for Users tab) */}
            {refModalTab === "users" && (
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <input
                  type="text"
                  placeholder={lang === "en" ? "Search by Name, Username or Position..." : "犧�ｹ霞ｸ吭ｸｫ犧ｲ犧癌ｸｷ犹謂ｸｭ, 犹�ｸｭ犧扉ｸｵ犧憫ｸｹ犹霞ｹ�ｸ癌ｹ� (Username) 犧ｫ犧｣犧ｷ犧ｭ犧歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�..."}
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
              {refModalTab === "users" && (
                <div className="space-y-3">
                  {userList.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-400 animate-pulse">
                      {lang === "en" ? "Loading users..." : "犧≒ｸｳ犧･犧ｱ犧�ｹもｸｫ犧･犧扉ｸ｣犧ｲ犧｢犧癌ｸｷ犹謂ｸｭ..."}
                    </div>
                  ) : (
                    (() => {
                      const filtered = userList.filter((u: any) =>
                        String(u.name || "").toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        String(u.username || "").toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        String(u.position || "").toLowerCase().includes(userSearchQuery.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-8 text-xs text-gray-400">
                            {lang === "en" ? "No users match your search." : "犹�ｸ｡犹謂ｸ樅ｸ壟ｸ憫ｸｹ犹霞ｹ�ｸ癌ｹ霞ｸ伶ｸｵ犹謂ｸ�ｹ霞ｸ吭ｸｫ犧ｲ"}
                          </div>
                        );
                      }
                      return (
                        <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                          {filtered.map((u: any, idx: number) => (
                            <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all">
                              <div>
                                <span className="font-bold text-gray-900 dark:text-white">{u.name}</span>
                                <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{u.position || "犹�ｸ｡犹謂ｸ｣犧ｰ犧壟ｸｸ犧歩ｸｳ犹≒ｸｫ犧吭ｹ謂ｸ�"}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">ID:</span>
                                <span 
                                  onClick={(e) => {
                                    navigator.clipboard.writeText(u.username);
                                    const target = e.target as HTMLElement;
                                    const origText = target.innerText;
                                    target.innerText = lang === "en" ? "Copied!" : "犧�ｸｱ犧扉ｸ･犧ｭ犧≒ｹ≒ｸ･犹霞ｸｧ!";
                                    setTimeout(() => { target.innerText = origText; }, 1000);
                                  }}
                                  className="font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30 cursor-pointer select-all select-none active:scale-95 transition-all"
                                  title="犧�ｸ･犧ｴ犧≒ｹ犧樅ｸｷ犹謂ｸｭ犧�ｸｱ犧扉ｸ･犧ｭ犧�"
                                >
                                  {u.username}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {refModalTab === "types" && (
                <div className="space-y-4">
                  <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                    {leaveConfigs.map((c: any, idx: number) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">{c.name}</span>
                          <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">犹もｸ�ｸｧ犧歩ｸｲ: {c.maxDaysPerYear} 犧ｧ犧ｱ犧�/犧巵ｸｵ</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">Code:</span>
                          <span 
                            onClick={(e) => {
                              navigator.clipboard.writeText(c.type);
                              const target = e.target as HTMLElement;
                              const origText = target.innerText;
                              target.innerText = lang === "en" ? "Copied!" : "犧�ｸｱ犧扉ｸ･犧ｭ犧≒ｹ≒ｸ･犹霞ｸｧ!";
                              setTimeout(() => { target.innerText = origText; }, 1000);
                            }}
                            className="font-mono bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 px-2 py-1 rounded-lg border border-purple-100/50 dark:border-purple-900/30 cursor-pointer select-none active:scale-95 transition-all"
                            title="犧�ｸ･犧ｴ犧≒ｹ犧樅ｸｷ犹謂ｸｭ犧�ｸｱ犧扉ｸ･犧ｭ犧�"
                          >
                            {c.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {refModalTab === "statuses" && (
                <div className="space-y-4">
                  <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                    {[
                      { code: "APPROVED", labelTh: "犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ犹犧｣犧ｵ犧｢犧壟ｸ｣犹霞ｸｭ犧｢", labelEn: "Approved (Completed)" },
                      { code: "PENDING_HEAD", labelTh: "犧｣犧ｭ犧ｫ犧ｱ犧ｧ犧ｫ犧吭ｹ霞ｸｲ犧≒ｸ･犧ｸ犹謂ｸ｡犧ｪ犧ｲ犧｣犧ｰ/犧憫ｸｹ犹霞ｸ歩ｸ｣犧ｧ犧謂ｸｪ犧ｭ犧�", labelEn: "Pending Inspector Approval" },
                      { code: "PENDING_EXEC", labelTh: "犧｣犧ｭ犧憫ｸｹ犹霞ｸｭ犧ｳ犧吭ｸｧ犧｢犧≒ｸｲ犧｣/犧憫ｸｹ犹霞ｸ壟ｸ｣犧ｴ犧ｫ犧ｲ犧｣犧ｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ", labelEn: "Pending Final Executive Approval" },
                      { code: "REJECTED", labelTh: "犹�ｸ｡犹謂ｸｭ犧吭ｸｸ犧｡犧ｱ犧歩ｸｴ/犧巵ｸ鐘ｸｴ犹犧ｪ犧�", labelEn: "Rejected" },
                      { code: "CANCELLED", labelTh: "犧｢犧≒ｹ犧･犧ｴ犧≒ｹ�ｸ壟ｸ･犧ｲ", labelEn: "Cancelled" },
                    ].map((item: any, idx: number) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {lang === "en" ? item.labelEn : item.labelTh}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">Code:</span>
                          <span 
                            onClick={(e) => {
                              navigator.clipboard.writeText(item.code);
                              const target = e.target as HTMLElement;
                              const origText = target.innerText;
                              target.innerText = lang === "en" ? "Copied!" : "犧�ｸｱ犧扉ｸ･犧ｭ犧≒ｹ≒ｸ･犹霞ｸｧ!";
                              setTimeout(() => { target.innerText = origText; }, 1000);
                            }}
                            className="font-mono bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-1 rounded-lg border border-blue-100/50 dark:border-blue-900/30 cursor-pointer select-none active:scale-95 transition-all"
                            title="犧�ｸ･犧ｴ犧≒ｹ犧樅ｸｷ犹謂ｸｭ犧�ｸｱ犧扉ｸ･犧ｭ犧�"
                          >
                            {item.code}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-950/40 border-t border-gray-100 dark:border-gray-800 text-center">
              <button
                onClick={() => setIsRefModalOpen(false)}
                className="px-6 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white dark:text-white font-bold text-xs transition-all shadow-md"
              >
                {lang === "en" ? "Close" : "犧巵ｸｴ犧扉ｸｫ犧吭ｹ霞ｸｲ犧歩ｹ謂ｸｲ犧�"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Sheet for Logo */}
      {logoActionSheetOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden animate-slide-up sm:animate-fade-in border border-gray-150 dark:border-gray-800">
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 text-center">
              <span className="text-sm font-bold text-gray-950 dark:text-white">
                {lang === "en" ? "Manage School Logo" : "จัดการตราสัญลักษณ์โรงเรียน"}
              </span>
            </div>
            <div className="p-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  document.getElementById("logo-upload")?.click();
                  setLogoActionSheetOpen(false);
                }}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-gray-950 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-850 text-center transition-colors"
              >
                {lang === "en" ? "🖼️ Choose from Gallery" : "🖼️ เลือกจากคลังรูปภาพ"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.capture = "environment";
                  input.onchange = (e: any) => {
                    handleFileChange(e);
                    setLogoActionSheetOpen(false);
                  };
                  input.click();
                }}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-gray-950 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-850 text-center transition-colors"
              >
                {lang === "en" ? "📷 Take Photo" : "📷 ถ่ายรูปด้วยกล้อง"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoUrl("");
                    setLogoActionSheetOpen(false);
                    showToast("success", lang === "en" ? "Logo removed successfully. Click save to apply changes." : "ลบโลโก้สำเร็จ กรุณากดบันทึกเพื่อบันทึกการตั้งค่า");
                  }}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-center transition-colors"
                >
                  {lang === "en" ? "🗑️ Remove Current Logo" : "🗑️ ลบรูปภาพปัจจุบัน"}
                </button>
              )}
            </div>
            <div className="p-2 border-t border-gray-100 dark:border-gray-850">
              <button
                type="button"
                onClick={() => setLogoActionSheetOpen(false)}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-850 text-center transition-colors"
              >
                {lang === "en" ? "Cancel" : "ยกเลิก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
