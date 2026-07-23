"use client";
// trigger vercel build: stable version 1.0.1
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useSearchParams } from "next/navigation";

import { getSystemSettings, updateSystemSettings, updateFooter, generateBackup, getLeaveConfigs, updateLeaveConfig, updateLeaveRules, setImpersonationCookie, clearImpersonation, getEligibleInspectors, updateDefaultInspector, getSimpleUsersList } from "@/app/actions/settings";

import { archiveCurrentCycle, importBackupFromJson, exportLeaveBackup, importLeaveBackup, importLeaveSimple, getImportHistory, undoImportLeave } from "@/app/actions/archive";

import { adminClearAllLeaveData } from "@/app/actions/leave";
import { updateAttendanceSettings } from "@/app/actions/attendance";
import {
  getMemoSections,
  upsertMemoSection,
  deleteMemoSection,
  getSigneePresets,
  upsertSigneePreset,
  deleteSigneePreset,
  getDocumentConfigs,
  saveDocumentConfig,
} from "@/app/actions/document-settings";
import { formatDocNumber } from "@/lib/document-utils";

import { uploadLogo } from "@/app/actions/upload";

import { getHolidays, createHoliday, updateHoliday, deleteHoliday, searchInternetHolidays, importSelectedHolidays } from "@/app/actions/holiday";

import { useSession } from "@/lib/auth-client";

import { Save, Image as ImageIcon, ShieldAlert, DownloadCloud, Lock, Code, Settings2, Archive, UploadCloud, Database, FileJson, AlertTriangle, CheckCircle2, ChevronRight, ArrowLeft, Bell, Type, Users, BookOpen, HardDrive, UserCog, FileSpreadsheet, X, CalendarDays, FileX, Plus, Clock, ClipboardList, MapPin, FolderOpen, Hash, UserCheck, Pencil, Trash2, ToggleLeft, ToggleRight, Sparkles, AlertCircle, Check, Eye, LayoutGrid, Wrench, Loader2, XCircle, MessageSquare } from "lucide-react";

import { useToast } from "@/components/toast-provider";

import { useI18n } from "@/lib/i18n";

import * as XLSX from "xlsx";

type DocTab = "sections" | "patterns" | "signees";

interface DocMemoSection {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

interface DocConfig {
  id: string;
  docType: string;
  prefix: string;
  currentSeq: number;
  paddingDigits: number;
  useThaiNumerals: boolean;
  yearFormat: string;
  memoSectionId?: string | null;
  memoSection?: DocMemoSection | null;
}

interface DocSigneePreset {
  id: string;
  name: string;
  position: string;
  isCommon: boolean;
}

export default function SettingsPage() {

  // Attendance settings states
  const [attendanceGeofenceLat, setAttendanceGeofenceLat] = useState("");
  const [attendanceGeofenceLng, setAttendanceGeofenceLng] = useState("");
  const [attendanceGeofenceRadius, setAttendanceGeofenceRadius] = useState("100");
  const [attendanceGeofenceEnabled, setAttendanceGeofenceEnabled] = useState(false);
  const [requireFaceScan, setRequireFaceScan] = useState(false);
  const [faceMatchThreshold, setFaceMatchThreshold] = useState("0.65");
  const [requireLivenessCheck, setRequireLivenessCheck] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Document settings states
  const [docActiveTab, setDocActiveTab] = useState<DocTab>("sections");
  const [docMemoSections, setDocMemoSections] = useState<DocMemoSection[]>([]);
  const [docConfigs, setDocConfigs] = useState<DocConfig[]>([]);
  const [docSignees, setDocSignees] = useState<DocSigneePreset[]>([]);
  const [loadingDocData, setLoadingDocData] = useState(false);

  const { data: session } = useSession();

  const { t, lang } = useI18n();

  const { showToast } = useToast();

  const searchParams = useSearchParams();

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

  const [actingDirectorTitleType, setActingDirectorTitleType] = useState("• รักษาการในตำแหน่งผู้อำนวยการโรงเรียน:");

  const [customActingDirectorTitle, setCustomActingDirectorTitle] = useState("");

  const [finalApproverUserIds, setFinalApproverUserIds] = useState<string[]>([]);

  const [showActingDirectorTitle, setShowActingDirectorTitle] = useState(true);

  const [pdfFont, setPdfFont] = useState("Prompt");

  const [googleDriveFormat, setGoogleDriveFormat] = useState("PDF");

  const [lastLeaveMode, setLastLeaveMode] = useState("SAME");

  const [quotaExceededAction, setQuotaExceededAction] = useState("ALLOW_WITH_MEMO");

    const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [iappApiKey, setIappApiKey] = useState("");
  const [enableAttendance, setEnableAttendance] = useState(false);
  const [enableDocument, setEnableDocument] = useState(false);
  const [enableRepair, setEnableRepair] = useState(false);


  const [isImpersonating, setIsImpersonating] = useState(false);

  const [leaveConfigs, setLeaveConfigs] = useState<any[]>([]);

  const [defaultInspectorId, setDefaultInspectorId] = useState("");

  const [defaultInspectorIds, setDefaultInspectorIds] = useState<string[]>([]);

  const [eligibleInspectors, setEligibleInspectors] = useState<any[]>([]);

  const [rolePermissions, setRolePermissions] = useState<any>({

    calendar: ["ADMIN", "DIRECTOR", "HR", "INSPECTOR", "TEACHER"],

    reports: ["ADMIN", "DIRECTOR", "HR", "INSPECTOR"],

    approvals: ["ADMIN", "DIRECTOR", "HR", "INSPECTOR"],

    logs: ["ADMIN"],

    backups: ["ADMIN"],

    users: ["ADMIN"],

    settings: ["ADMIN"]

  });

  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  const [isSavingFooter, setIsSavingFooter] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const [isBackingUp, setIsBackingUp] = useState(false);

  const [isSavingLeave, setIsSavingLeave] = useState<string | null>(null);

  const [isSavingRules, setIsSavingRules] = useState(false);

  const [isSavingAllQuotas, setIsSavingAllQuotas] = useState(false);

  const [isArchiving, setIsArchiving] = useState(false);

  const [dataWizardTab, setDataWizardTab] = useState<"import" | "export">("import");

  const [isImporting, setIsImporting] = useState(false);

  const [isClearing, setIsClearing] = useState(false);

  const [isExportingLeave, setIsExportingLeave] = useState(false);

  const [isImportingLeave, setIsImportingLeave] = useState(false);

  const [importLeaveMode, setImportLeaveMode] = useState<"merge" | "replace">("merge");

  const [importLeaveResult, setImportLeaveResult] = useState<any>(null);

  const [backupCycleFilter, setBackupCycleFilter] = useState<string>("year");

  const [backupTargetYear, setBackupTargetYear] = useState<number>(new Date().getFullYear() + 543);

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

  // Holiday states

  const [holidaysList, setHolidaysList] = useState<any[]>([]);

  const [holidaysYear, setHolidaysYear] = useState<number>(new Date().getFullYear() + 543);

  const [isFetchingHolidays, setIsFetchingHolidays] = useState(false);

  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

  const [editingHoliday, setEditingHoliday] = useState<any>(null);

  const [holidayStartDateInput, setHolidayStartDateInput] = useState("");

  const [holidayEndDateInput, setHolidayEndDateInput] = useState("");

  const [holidayNameInput, setHolidayNameInput] = useState("");

  const [holidayIsWorkdayInput, setHolidayIsWorkdayInput] = useState(false);

  // Internet Search & Import Wizard states

  const [isSearchImportModalOpen, setIsSearchImportModalOpen] = useState(false);

  const [searchYearInput, setSearchYearInput] = useState<number>(new Date().getFullYear() + 543);

  const [searchedHolidays, setSearchedHolidays] = useState<any[]>([]);

  const [isSearchingInternetHolidays, setIsSearchingInternetHolidays] = useState(false);

  const [isImportingSelected, setIsImportingSelected] = useState(false);

  // Premium Import Wizard states

  const [importStage, setImportStage] = useState<"idle" | "preview" | "importing" | "summary">("idle");

  const [parsedRecords, setParsedRecords] = useState<any[]>([]);

  const [validRecords, setValidRecords] = useState<any[]>([]);

  const [invalidRecords, setInvalidRecords] = useState<any[]>([]);

  const [lastImportedIds, setLastImportedIds] = useState<string[]>([]);

  const [importHistory, setImportHistory] = useState<any[]>([]);

  const [isDragOver, setIsDragOver] = useState(false);

  // Danger Zone custom modal states

  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);

  const [confirmTextInput, setConfirmTextInput] = useState("");

  // Manual import form states

  const [isManualFillModalOpen, setIsManualFillModalOpen] = useState(false);

  const [manualTeacherSearch, setManualTeacherSearch] = useState("");

  const [showManualTeacherDropdown, setShowManualTeacherDropdown] = useState(false);

  const [manualSelectedTeacher, setManualSelectedTeacher] = useState<any>(null);

  const [manualLeaveType, setManualLeaveType] = useState("SICK");

  const [manualStartDate, setManualStartDate] = useState("");

  const [manualEndDate, setManualEndDate] = useState("");

  const [manualLeaveStatus, setManualLeaveStatus] = useState("APPROVED");

  const [manualFinalApproverId, setManualFinalApproverId] = useState("");

  const [manualHeadApproverId, setManualHeadApproverId] = useState("");

  const [manualReason, setManualReason] = useState("");

  // Repair Settings states

  const [isSavingRepair, setIsSavingRepair] = useState(false);

  const [repairSearchQuery, setRepairSearchQuery] = useState("");

  const [repairLineToken, setRepairLineToken] = useState("");

  const [repairLineGroupId, setRepairLineGroupId] = useState("");

  const [enableRepairLine, setEnableRepairLine] = useState(true);

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

      setRepairLineToken(data.repairLineChannelAccessToken || "");

      setRepairLineGroupId(data.repairLineTargetGroupId || "");

      setEnableRepairLine(data.enableRepairLineNotify !== false);

      setLeaveRules(data.leaveRules || "");

      setRequirePersonalAdvance(data.requirePersonalAdvance !== false);

      setMemoThresholdTimes(data.memoThresholdTimes ?? 6);

      setMemoThresholdDays(data.memoThresholdDays ?? 15);

      setDefaultInspectorId(data.defaultInspectorId || "");

      setDefaultInspectorIds(

        data.defaultInspectorId

          ? data.defaultInspectorId.split(",").map((s: string) => s.trim()).filter(Boolean)

          : []

      );

      const loadedTitle = data.actingDirectorTitle || "• รักษาการในตำแหน่งผู้อำนวยการโรงเรียน:";

      setActingDirectorTitle(loadedTitle);

      if ([

        "ปฏิบัติราชการแทนผู้อำนวยการโรงเรียน",

        "• รักษาราชการแทนผู้อำนวยการโรงเรียน:",

        "• รักษาการในตำแหน่งผู้อำนวยการโรงเรียน:"

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

            setTimezone(data.timezone || "Asia/Bangkok");
      setIappApiKey(data.iappApiKey || "");
      setEnableAttendance(data.enableAttendance === true);
      setEnableDocument(data.enableDocument === true);
      setEnableRepair((data as any).enableRepair === true);
      setAttendanceGeofenceLat(data.attendanceLatitude ? String(data.attendanceLatitude) : "");
      setAttendanceGeofenceLng(data.attendanceLongitude ? String(data.attendanceLongitude) : "");
      setAttendanceGeofenceRadius(data.attendanceRadius ? String(data.attendanceRadius) : "100");
      setAttendanceGeofenceEnabled(data.requireGeofence === true);
      setRequireFaceScan(data.requireFaceScan === true);
      setFaceMatchThreshold(data.faceMatchThreshold !== undefined ? String(data.faceMatchThreshold) : "0.65");
      setRequireLivenessCheck(data.requireLivenessCheck === true);

      if (data.rolePermissions) {

        try {

          setRolePermissions(JSON.parse(data.rolePermissions));

        } catch (e) {

          console.error("Failed to parse loaded permissions map", e);

        }

      }

    });

    getEligibleInspectors().then(setEligibleInspectors);

    getLeaveConfigs().then(setLeaveConfigs);

  }, []);

  const loadDocData = useCallback(async () => {
    setLoadingDocData(true);
    try {
      const [secs, confs, sigs] = await Promise.all([
        getMemoSections(),
        getDocumentConfigs(),
        getSigneePresets()
      ]);
      setDocMemoSections(secs);
      setDocConfigs(confs);
      setDocSignees(sigs);
    } catch (err) {
      console.error("Failed to load document configuration data", err);
    } finally {
      setLoadingDocData(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "document-settings") {
      loadDocData();
    }
  }, [activeSection, loadDocData]);

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAttendance(true);
    try {
      await updateAttendanceSettings({
        enableAttendance,
        attendanceLatitude: attendanceGeofenceLat ? parseFloat(attendanceGeofenceLat) : null,
        attendanceLongitude: attendanceGeofenceLng ? parseFloat(attendanceGeofenceLng) : null,
        attendanceRadius: attendanceGeofenceRadius ? parseFloat(attendanceGeofenceRadius) : null,
        requireGeofence: attendanceGeofenceEnabled,
        requireFaceScan,
        faceMatchThreshold: parseFloat(faceMatchThreshold) || 0.65,
        requireLivenessCheck
      });
      showToast("success", lang === "en" ? "Attendance settings saved successfully" : "บันทึกการตั้งค่าระบบลงเวลาปฏิบัติงานสำเร็จ");
    } catch (error: any) {
      showToast("error", error?.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast("error", lang === "en" ? "Geolocation is not supported by your browser" : "เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด GPS");
      return;
    }
    showToast("info", lang === "en" ? "Fetching current location..." : "กำลังดึงพิกัดปัจจุบัน...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAttendanceGeofenceLat(position.coords.latitude.toFixed(7));
        setAttendanceGeofenceLng(position.coords.longitude.toFixed(7));
        showToast("success", lang === "en" ? "Location retrieved successfully" : "ดึงพิกัดปัจจุบันสำเร็จ");
      },
      (error) => {
        console.error("Geolocation error:", error);
        showToast("error", lang === "en" ? `Error: ${error.message}` : `ดึงพิกัดไม่สำเร็จ: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {

    if (activeSection === "manual-import") {

      // Default final approver: always prefer ผู้อำนวยการ first

      const director = eligibleInspectors.find(u => u.position === "ผู้อำนวยการ");

      if (director) {

        setManualFinalApproverId(director.id);

      } else {

        const eligibleFinals = eligibleInspectors.filter(u => finalApproverUserIds.includes(u.id));

        if (eligibleFinals.length > 0) {

          setManualFinalApproverId(eligibleFinals[0].id);

        } else if (eligibleInspectors.length > 0) {

          setManualFinalApproverId(eligibleInspectors[0].id);

        }

      }

      // Default head approver: prefer หัวหน้างานบุคคล position

      const hrHead = eligibleInspectors.find(u => u.position === "หัวหน้างานบุคคล");

      if (hrHead) {

        setManualHeadApproverId(hrHead.id);

      } else {

        setManualHeadApproverId(defaultInspectorId || "");

      }

    }

  }, [activeSection, eligibleInspectors, finalApproverUserIds, defaultInspectorId]);

  useEffect(() => {

    const section = searchParams.get("section");

    if (section !== null) {

      setActiveSection(section);

    }

  }, [searchParams]);

  useEffect(() => {

    if (activeSection === "backup") {

      getImportHistory().then(setImportHistory);

    }

    if (activeSection === "holidays") {

      getHolidays(holidaysYear).then(setHolidaysList).catch(console.error);

    }

    if (activeSection === "repair-settings" && userList.length === 0) {

      getSimpleUsersList().then(setUserList).catch(console.error);

    }

  }, [activeSection, holidaysYear, userList.length]);

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

        defaultInspectorId: defaultInspectorIds.join(",") || null,

        actingDirectorTitle: actingDirectorTitleType === "custom" ? customActingDirectorTitle : actingDirectorTitleType,

        finalApproverUserIds: finalApproverUserIds.join(","),

        showActingDirectorTitle,

        pdfFont,

        googleDriveFormat,

        lastLeaveMode,

        quotaExceededAction,

                timezone,
        iappApiKey,
        enableAttendance,
        enableDocument
      });

      alert("บันทึกการตั้งค่าทั่วไปสำเร็จ");

    } catch (error: any) {

      alert("เกิดข้อผิดพลาดในการบันทึก:" + (error?.message || error));

    } finally {

      setIsSavingGeneral(false);

    }

  };

  // Inline-save a single subsystem toggle
  const saveSubsystem = async (
    key: "enableAttendance" | "enableDocument" | "enableRepair",
    val: boolean
  ) => {
    if (key === "enableAttendance") setEnableAttendance(val);
    if (key === "enableDocument") setEnableDocument(val);
    if (key === "enableRepair") setEnableRepair(val);
    try {
      await updateSystemSettings({
        schoolName,
        subheader,
        enableAttendance: key === "enableAttendance" ? val : enableAttendance,
        enableDocument:   key === "enableDocument"   ? val : enableDocument,
        enableRepair:     key === "enableRepair"     ? val : enableRepair,
      });
      localStorage.setItem(`eleave_${key}`, String(val));
      window.dispatchEvent(new Event("storage"));
      showToast("success", lang === "en" ? "Saved" : "บันทึกสำเร็จ");
    } catch (e: any) {
      showToast("error", e?.message ?? "เกิดข้อผิดพลาด");
    }
  };

  const handleImpersonate = async (position: string | null, role: string | null) => {

    setIsImpersonating(true);

    try {

      await setImpersonationCookie(position, role);

      alert("จำลองบทบาทสำเร็จ กำลังรีโหลดหน้าเว็บ...");

      window.location.href = "/";

    } catch (error: any) {

      alert("เกิดข้อผิดพลาด" + (error?.message || error));

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

      alert("เกิดข้อผิดพลาด" + (error?.message || error));

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

      alert("เกิดข้อผิดพลาดในการบันทึก:" + (error?.message || error));

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

          alert("เกิดข้อผิดพลาดในการนำเข้า:" + err.message);

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

  const handleClearData = () => {

    setConfirmTextInput("");

    setIsClearDataModalOpen(true);

  };

  const handleExecuteClearData = async () => {

    if (confirmTextInput !== 'CONFIRM') return;

    setIsClearDataModalOpen(false);

    setIsClearing(true);

    try {

      await adminClearAllLeaveData();

      showToast("success", lang === "en" ? "Cleared all leave data successfully" : "ล้างข้อมูลการลาทั้งหมดเรียบร้อยแล้ว");

      window.location.reload();

    } catch (error: any) {

      showToast("error", (lang === "en" ? "Error: " : "เกิดข้อผิดพลาด: ") + (error.message || "ไม่สามารถลบข้อมูลได้"));

    } finally {

      setIsClearing(false);

    }

  };

  const handleExportLeave = async () => {

    setIsExportingLeave(true);

    try {

      const backupString = await exportLeaveBackup(backupCycleFilter as any, backupTargetYear);

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

      alert("เกิดข้อผิดพลาด" + (error.message || "ไม่สามารถสำรองข้อมูลได้"));

    } finally {

      setIsExportingLeave(false);

    }

  };

  const handleExportLeaveExcel = async () => {

    setIsExportingLeave(true);

    try {

      const backupString = await exportLeaveBackup(backupCycleFilter as any, backupTargetYear);

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

      const backupString = await exportLeaveBackup(backupCycleFilter as any, backupTargetYear);

      const parsed = JSON.parse(backupString);

      const leaveRequests = parsed.leaveRequests || [];

      const configs = parsed.leaveConfigs || [];

      const typeMap: Record<string, string> = {};

      configs.forEach((c: any) => {

        typeMap[c.type] = c.name;

      });

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

      alert(`สำรองข้อมูลการลาแบบ CSV สำเร็จ!\n\nปีงบประมาณ: ${parsed.fiscalYear}\nจำนวนทั้งหมด: ${parsed.summary.totalRequests} รายการ`);

    } catch (error: any) {

      alert("เกิดข้อผิดพลาด" + (error.message || "ไม่สามารถสำรองข้อมูลได้"));

    } finally {

      setIsExportingLeave(false);

    }

  };

  const handleDownloadCSVTemplate = () => {

    const headers = "Username,StartDate,EndDate,LeaveType,LeaveStatus,FinalApproverUsername,HeadApproverUsername,Reason";

  const sampleRow1 = "\n1002,2026-07-01,2026-07-03,SICK,APPROVED,1001,,ลารักษาอาการไข้หวัดใหญ่";

  const sampleRow2 = "\n1003,2026-07-10,2026-07-10,PERSONAL,APPROVED,1001,1005,ทำธุระติดต่อราชการเรื่องบ้าน";

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

  const handleAddManualLeave = (closeModal: boolean = true) => {

    if (!manualSelectedTeacher) {

      showToast("error", lang === "en" ? "Please select a teacher" : "กรุณาเลือกครู/บุคลากร");

      return;

    }

    if (!manualStartDate || !manualEndDate) {

      showToast("error", lang === "en" ? "Please select start and end dates" : "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");

      return;

    }

    const typeMap: Record<string, string> = {};

    leaveConfigs.forEach((c: any) => {

      typeMap[c.name.trim()] = c.type;

    });

    const finalApprover = eligibleInspectors.find(u => u.id === manualFinalApproverId);

    const headApprover = eligibleInspectors.find(u => u.id === manualHeadApproverId);

    // Parse dates to local midnight to ensure timezone alignment

    const startParts = manualStartDate.split("-");

    const localStart = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));

    const endParts = manualEndDate.split("-");

    const localEnd = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));

    const newRecord: any = {

      rowNum: 2,

      username: manualSelectedTeacher.username || manualSelectedTeacher.email || manualSelectedTeacher.id,

      startDate: localStart.toISOString(),

      endDate: localEnd.toISOString(),

      type: manualLeaveType,

      status: manualLeaveStatus,

      finalApproverUsername: finalApprover?.username || finalApprover?.email || finalApprover?.id || "",

      headApproverUsername: headApprover?.username || headApprover?.email || headApprover?.id || "",

      reason: manualReason

    };

    const errorList: string[] = [];

    if (localStart > localEnd) {

      errorList.push("วันที่เริ่มต้นมากกว่าวันที่สิ้นสุด");

    }

    if (errorList.length > 0) {

      showToast("error", errorList.join(", "));

      return;

    }

    importLeaveSimple([newRecord], "merge")

      .then((res) => {

        if (res.success) {

          showToast("success", lang === "en" ? "Saved leave record successfully" : "บันทึกข้อมูลการลาเข้าระบบสำเร็จแล้ว");

          // Clear form inputs

          setManualTeacherSearch("");

          setManualSelectedTeacher(null);

          setManualStartDate("");

          setManualEndDate("");

          setManualReason("");

          if (closeModal) {

            setActiveSection(null);

          }

        } else {

          showToast("error", res.errors?.[0] || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");

        }

      })

      .catch((err) => {

        showToast("error", err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");

      });

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

              let y = 0;

              let m = 0;

              let d = 0;

              if (dmy[0].length === 4) {

                // YYYY-MM-DD

                y = parseInt(dmy[0]);

                m = parseInt(dmy[1]) - 1;

                d = parseInt(dmy[2]);

              } else {

                // DD-MM-YYYY

                d = parseInt(dmy[0]);

                m = parseInt(dmy[1]) - 1;

                y = parseInt(dmy[2]);

              }

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

              const k = key.replace(/\uFEFF/g, "").trim().toLowerCase();

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

                u.email?.toLowerCase() === String(req.username).trim().toLowerCase() ||

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

  const getUserRoleKeyLocal = (u: any) => {

    if (!u) return "TEACHER";

    if (u.role === "ADMIN" || u.position === "แอดมิน") return "ADMIN";

    if (u.position === "ผู้อำนวยการ" || finalApproverUserIds.includes(u.id)) return "DIRECTOR";

    if (u.position === "หัวหน้างานบุคคล") return "HR";

    if (u.position === "เจ้าหน้าที่บุคคล") return "HR_STAFF";

    if (u.position === "ผู้ตรวจสอบ") return "INSPECTOR";

    if (u.position === "หัวหน้าหมวด" || u.position === "หัวหน้ากลุ่มสาระ") return "DEPT_HEAD";

    return "TEACHER";

  };

  const userRole = getUserRoleKeyLocal(user);

  const DEFAULT_PERMISSIONS = {

    calendar: ["ADMIN", "DIRECTOR", "HR", "HR_STAFF", "INSPECTOR", "DEPT_HEAD", "TEACHER"],

    reports: ["ADMIN", "DIRECTOR", "HR", "HR_STAFF", "INSPECTOR", "DEPT_HEAD"],

    approvals: ["ADMIN", "DIRECTOR", "HR", "INSPECTOR", "DEPT_HEAD"],

    logs: ["ADMIN"],

    backups: ["ADMIN"],

    users: ["ADMIN", "HR"],

    settings: ["ADMIN"],

    manual_import: ["ADMIN", "HR", "HR_STAFF"]

  };

  const activePerms = rolePermissions || DEFAULT_PERMISSIONS;

  const canManualImport = activePerms.manual_import?.includes(userRole);

  const isAdmin = user?.role === "ADMIN" || user?.position === "แอดมิน";

  const isHRHead = user?.position === "หัวหน้างานบุคคล" || user?.position === "เจ้าหน้าที่บุคคล";

  const isInspector = user?.position === "ผู้ตรวจสอบ";

// ──────────────────────────────────────────────────────────────────────
// SECTIONS: ATTENDANCE & DOCUMENT RENDERERS
// ──────────────────────────────────────────────────────────────────────
  const renderAttendanceSettingsSection = () => (
    <form onSubmit={handleAttendanceSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
      <SectionHeader title={sectionTitles["attendance-settings"]} />

      <div className="space-y-6">

        <div className="space-y-6">
          {/* Shift hours card */}

          {/* Geofence Check-in card */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-2">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                {lang === "en" ? "GPS Geofence Location Verification" : "ตั้งค่าการตรวจสอบพิกัด (GPS/Geofence)"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAttendanceGeofenceEnabled(!attendanceGeofenceEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    attendanceGeofenceEnabled ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      attendanceGeofenceEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-550 text-gray-500 dark:text-gray-400">
                  {attendanceGeofenceEnabled ? (lang === "en" ? "Verified" : "เปิดตรวจสอบพิกัด") : (lang === "en" ? "Disabled" : "ปิดตรวจสอบพิกัด")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {lang === "en" ? "Latitude" : "ละติจูด (Latitude)"}
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="เช่น 17.412345"
                  value={attendanceGeofenceLat}
                  onChange={(e) => setAttendanceGeofenceLat(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {lang === "en" ? "Longitude" : "ลองจิจูด (Longitude)"}
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="เช่น 102.789123"
                  value={attendanceGeofenceLng}
                  onChange={(e) => setAttendanceGeofenceLng(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {lang === "en" ? "Geofence Radius (meters)" : "รัศมีขอบเขตการลงเวลา (เมตร)"}
                </label>
                <input
                  type="number"
                  value={attendanceGeofenceRadius}
                  onChange={(e) => setAttendanceGeofenceRadius(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 text-sm"
                />
              </div>
            </div>

            {/* Get current coords button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-105 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm"
              >
                <MapPin className="w-4 h-4" />
                {lang === "en" ? "Get Current GPS Coordinates" : "📍 ดึงพิกัดปัจจุบัน"}
              </button>
            </div>
          </div>

          {/* Face Scan settings card */}
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-2">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                {lang === "en" ? "Face Recognition Verification" : "ระบบตรวจสอบใบหน้า (Face Recognition)"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRequireFaceScan(!requireFaceScan)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    requireFaceScan ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      requireFaceScan ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-550 text-gray-500 dark:text-gray-400 font-semibold">
                  {requireFaceScan ? (lang === "en" ? "Required" : "เปิดสแกนใบหน้า") : (lang === "en" ? "Optional" : "ปิดสแกนใบหน้า")}
                </span>
              </div>
            </div>

            {requireFaceScan && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 animate-fadeIn">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    {lang === "en" ? "Face Match Confidence Threshold" : "เกณฑ์ความถูกต้องในการเปรียบเทียบใบหน้า (Match Threshold)"}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0.40"
                      max="0.90"
                      step="0.05"
                      value={faceMatchThreshold}
                      onChange={(e) => setFaceMatchThreshold(e.target.value)}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:bg-gray-750"
                    />
                    <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 w-12 text-right">
                      {parseFloat(faceMatchThreshold).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {lang === "en" 
                      ? "Higher value requires more strict facial resemblance (recommended: 0.60 - 0.70)." 
                      : "ค่าที่สูงขึ้นต้องการความคล้ายคลึงของใบหน้าที่เข้มงวดมากขึ้น (แนะนำ: 0.60 - 0.70)"}
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800/80">
                  <div>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {lang === "en" ? "Liveness Detection" : "ตรวจสอบบุคคลจริง (Liveness Detection)"}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {lang === "en" 
                        ? "Verify blink/motion to prevent check-in using printed photos." 
                        : "ตรวจจับความเคลื่อนไหวเพื่อป้องกันการใช้รูปภาพถ่ายลงเวลา"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequireLivenessCheck(!requireLivenessCheck)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      requireLivenessCheck ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        requireLivenessCheck ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <StickySaveBar isSaving={isSavingAttendance} label={isSavingAttendance ? t("saving") : t("saveSettings")} color="indigo" />
    </form>
  );

  const renderDocumentSettingsSection = () => {
    const handleShowToast = (msg: string, type?: "success" | "error") => {
      showToast(type === "error" ? "error" : "success", msg);
    };

    return (
      <div className="space-y-6">
        {/* Toggle system active */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
          <SectionHeader title={sectionTitles["document-settings"]} />

          <div className="space-y-6">

            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              {/* Tabs list */}
              <div className="flex gap-2 flex-wrap bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-gray-100 dark:border-gray-800">
                {[
                  { key: "sections", label: "งานย่อยบันทึกข้อความ", icon: FolderOpen },
                  { key: "patterns", label: "ตั้งค่ารูปแบบเลข", icon: Hash },
                  { key: "signees", label: "ผู้ลงนามใช้บ่อย", icon: UserCheck }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = docActiveTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setDocActiveTab(tab.key as DocTab)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        active
                          ? "text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab contents */}
              {loadingDocData ? (
                <div className="py-12 flex justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-4 border-orange-100 border-t-orange-500 rounded-full"
                  />
                </div>
              ) : (
                <div className="mt-2">
                  <AnimatePresence mode="wait">
                    {docActiveTab === "sections" && (
                      <DocMemoSectionsTab
                        key="sections"
                        sections={docMemoSections}
                        onRefresh={loadDocData}
                        showToast={handleShowToast}
                        lang={lang}
                      />
                    )}
                    {docActiveTab === "patterns" && (
                      <DocPatternBuilderTab
                        key="patterns"
                        configs={docConfigs}
                        onRefresh={loadDocData}
                        showToast={handleShowToast}
                        lang={lang}
                      />
                    )}
                    {docActiveTab === "signees" && (
                      <DocSigneesTab
                        key="signees"
                        signees={docSignees}
                        onRefresh={loadDocData}
                        showToast={handleShowToast}
                        lang={lang}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };


  if (!isAdmin && !isHRHead && !isInspector && !canManualImport) {

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

  const systemSettingsItems: MenuItem[] = [];

  if (isAdmin) {

    systemSettingsItems.push({ id: "school", icon: <BookOpen className="w-5 h-5 text-blue-500" />, title: lang === "en" ? "School Info" : "ข้อมูลโรงเรียน", description: lang === "en" ? "School name, affiliation, logo" : "ชื่อโรงเรียน, สังกัด, โลโก้" });

  }

  if (isAdmin || isHRHead || isInspector) {

    systemSettingsItems.push({ id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "Approval Chain" : "สายอนุมัติ", description: lang === "en" ? "Inspector, approver, acting director" : "ผู้ตรวจสอบ, ผู้อนุมัติ, ตำแหน่งรักษาการ" });

    systemSettingsItems.push({ id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา", description: lang === "en" ? "Rules, quotas, restrictions" : "กฎระเบียบ, โควตาวันลา, ข้อจำกัด" });

  }

  if (isAdmin) {

    systemSettingsItems.push({ id: "line", icon: <Bell className="w-5 h-5 text-green-500" />, title: lang === "en" ? "LINE Notification" : "แจ้งเตือน LINE", description: lang === "en" ? "Enable/disable, Token, Group ID" : "เปิด/ปิดการแจ้งเตือน, Token, Group ID" });

    systemSettingsItems.push({ id: "font", icon: <Type className="w-5 h-5 text-indigo-500" />, title: lang === "en" ? "Font & File Format" : "ฟอนต์ & รูปแบบไฟล์", description: lang === "en" ? "Leave form font, Google Drive format" : "ฟอนต์ใบลา, รูปแบบอัปโหลด Google Drive" });

    systemSettingsItems.push({ id: "permissions", icon: <Lock className="w-5 h-5 text-rose-500" />, title: lang === "en" ? "Access Permissions" : "กำหนดสิทธิ์ผู้เข้าใช้งาน", description: lang === "en" ? "Access rights per role" : "กำหนดสิทธิ์เข้าใช้งานตาม Role บุคลากร" });

    systemSettingsItems.push({ id: "subsystems", icon: <LayoutGrid className="w-5 h-5 text-purple-600" />, title: lang === "en" ? "Subsystems" : "ระบบย่อย", description: lang === "en" ? "Enable/disable subsystem features" : "เปิด/ปิดการใช้งานระบบย่อยต่าง ๆ" });

  }

  const dataManagementItems: MenuItem[] = [];

  if (canManualImport) {

    dataManagementItems.push({ id: "manual-import", icon: <Plus className="w-5 h-5 text-purple-500" />, title: lang === "en" ? "Manual Leave Entry" : "กรอกข้อมูลใบลาด้วยตนเอง", description: lang === "en" ? "Manually record leave history" : "บันทึกประวัติการลาของบุคลากรย้อนหลังด้วยตนเอง" });

  }

  if (isAdmin || isHRHead || isInspector) {

    dataManagementItems.push({

      id: "holidays",

      icon: <CalendarDays className="w-5 h-5 text-indigo-500" />,

      title: lang === "en" ? "Public Holidays" : "วันหยุดราชการ",

      description: lang === "en" ? "Manage and fetch public holidays" : "จัดการและดึงวันหยุดราชการ/วันชดเชย"

    });

  }

  if (isAdmin || isInspector) {

    dataManagementItems.push({ id: "backup", icon: <HardDrive className="w-5 h-5 text-teal-500" />, title: lang === "en" ? "Backup & Data" : "สำรองข้อมูล", description: lang === "en" ? "Export/Import, clear data" : "Export/Import, ปิดรอบ, ล้างข้อมูล" });

  }

  if ((session?.user as any)?.isActualAdmin === true) {

    dataManagementItems.push({ id: "impersonate", icon: <UserCog className="w-5 h-5 text-indigo-500" />, title: lang === "en" ? "Role Impersonation" : "จำลองบทบาท", description: lang === "en" ? "Simulate roles for testing" : "จำลองตำแหน่งเพื่อทดสอบระบบ" });

  }

  if (isAdmin) {

    dataManagementItems.push({ id: "footer", icon: <Settings2 className="w-5 h-5 text-rose-500" />, title: lang === "en" ? "Footer Settings" : "ท้ายกระดาษ", description: lang === "en" ? "Website footer text" : "ข้อความท้ายหน้าเว็บ" });

  }

  // HR Head sees only approval + leave-rules + manual-import (if permitted)

  const hrHeadItems: MenuItem[] = [];

  if (isAdmin || isHRHead) {

    hrHeadItems.push({ id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "System & Approver Settings" : "สายอนุมัติ", description: lang === "en" ? "Inspector, approver, acting director" : "ผู้ตรวจสอบ, ผู้อนุมัติ, ตำแหน่งรักษาการ" });

    hrHeadItems.push({ id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา", description: lang === "en" ? "Rules, quotas, restrictions" : "กฎระเบียบ, โควตาวันลา, ข้อจำกัด" });

    hrHeadItems.push({

      id: "holidays",

      icon: <CalendarDays className="w-5 h-5 text-indigo-500" />,

      title: lang === "en" ? "Public Holidays" : "วันหยุดราชการ",

      description: lang === "en" ? "Manage and fetch public holidays" : "จัดการและดึงวันหยุดราชการ/วันชดเชย"

    });

    if (canManualImport) {

      hrHeadItems.push({ id: "manual-import", icon: <Plus className="w-5 h-5 text-purple-500" />, title: lang === "en" ? "Manual Leave Entry" : "กรอกข้อมูลใบลาด้วยตนเอง", description: lang === "en" ? "Manually record leave history" : "บันทึกประวัติการลาของบุคลากรย้อนหลังด้วยตนเอง" });

    }

  }

  // Inspector sees approval + leave-rules + backup + manual-import (if permitted)

  const inspectorItems: MenuItem[] = [];

  if (isInspector) {

    inspectorItems.push({ id: "approval", icon: <Users className="w-5 h-5 text-emerald-500" />, title: lang === "en" ? "System & Approver Settings" : "สายอนุมัติ", description: lang === "en" ? "Inspector, approver, acting director" : "ผู้ตรวจสอบ, ผู้อนุมัติ, ตำแหน่งรักษาการ" });

    inspectorItems.push({ id: "leave-rules", icon: <ShieldAlert className="w-5 h-5 text-amber-500" />, title: lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา", description: lang === "en" ? "Rules, quotas, restrictions" : "กฎระเบียบ, โควตาวันลา, ข้อจำกัด" });

    inspectorItems.push({ id: "backup", icon: <HardDrive className="w-5 h-5 text-teal-500" />, title: lang === "en" ? "Backup & Data" : "สำรองข้อมูล", description: lang === "en" ? "Export/Import, clear data" : "Export/Import, ปิดรอบ, ล้างข้อมูล" });

    inspectorItems.push({

      id: "holidays",

      icon: <CalendarDays className="w-5 h-5 text-indigo-500" />,

      title: lang === "en" ? "Public Holidays" : "วันหยุดราชการ",

      description: lang === "en" ? "Manage and fetch public holidays" : "จัดการและดึงวันหยุดราชการ/วันชดเชย"

    });

    if (canManualImport) {

      inspectorItems.push({ id: "manual-import", icon: <Plus className="w-5 h-5 text-purple-500" />, title: lang === "en" ? "Manual Leave Entry" : "กรอกข้อมูลใบลาด้วยตนเอง", description: lang === "en" ? "Manually record leave history" : "บันทึกประวัติการลาของบุคลากรย้อนหลังด้วยตนเอง" });

    }

  }

  // --- Section title lookup ---

  const sectionTitles: Record<string, string> = {

    school: lang === "en" ? "School Info" : "ข้อมูลโรงเรียน",

    "attendance-settings": lang === "en" ? "Attendance Settings" : "ตั้งค่าระบบลงเวลาปฏิบัติงาน",

    "document-settings": lang === "en" ? "Document Settings" : "ตั้งค่าระบบเอกสารรับ-ส่ง",

    approval: lang === "en" ? ((isHRHead || isInspector) ? "System & Approver Settings" : "Approval Chain") : ((isHRHead || isInspector) ? "ตั้งค่าผู้ตรวจสอบและผู้อนุมัติระบบ" : "สายอนุมัติ"),

    "leave-rules": lang === "en" ? "Leave Rules & Quotas" : "ระเบียบการลา & โควตา",

    line: lang === "en" ? "LINE Notification" : "แจ้งเตือน LINE",

    font: lang === "en" ? "Font & File Format" : "ฟอนต์ & รูปแบบไฟล์",

    permissions: lang === "en" ? "Access Permissions" : "กำหนดสิทธิ์ผู้เข้าใช้งาน",

    backup: lang === "en" ? "Backup & Data" : "สำรองข้อมูล",

    "manual-import": lang === "en" ? "Manual Leave Entry" : "กรอกข้อมูลใบลาด้วยตนเอง",

    impersonate: lang === "en" ? "Role Impersonation" : "จำลองบทบาท",

    footer: lang === "en" ? "Footer Settings" : "ท้ายกระดาษ",

    holidays: lang === "en" ? "Public Holidays" : "วันหยุดราชการ",

    subsystems: lang === "en" ? "Subsystems" : "ระบบย่อย",

    "repair-settings": lang === "en" ? "Repair System Settings" : "ตั้งค่าระบบแจ้งซ่อม",

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

        {/* Default Inspectors - Tag Input style */}

        <div className="space-y-2">

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">

            {lang === "en" ? "Default Inspectors (First Level)" : "ผู้ตรวจสอบใบลาขั้นแรก (ค่าเริ่มต้น)"}

          </label>

          {/* Tag list */}

          <div className="flex flex-wrap gap-2 mb-2">

            {defaultInspectorIds.map((userId) => {

              const u = eligibleInspectors.find(x => x.id === userId);

              return (

                <div key={userId} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-xs font-semibold">

                  <span>{u ? u.name : userId} {u?.position ? `(${u.position})` : ""}</span>

                  <button

                    type="button"

                    onClick={() => setDefaultInspectorIds(prev => prev.filter(id => id !== userId))}

                    className="p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-full transition-colors"

                  >

                    <X className="w-3.5 h-3.5" />

                  </button>

                </div>

              );

            })}

            {defaultInspectorIds.length === 0 && (

              <span className="text-xs text-gray-400 italic py-1">{lang === "en" ? "No inspectors selected" : "ไม่มีผู้ตรวจสอบ (ข้ามไปยังขั้นสุดท้ายทันที)"}</span>

            )}

          </div>

          {/* Search Input */}

          <div className="relative">

            <input

              type="text"

              value={inspectorSearch}

              onChange={(e) => {

                setInspectorSearch(e.target.value);

                setShowInspectorDropdown(true);

              }}

              onFocus={() => setShowInspectorDropdown(true)}

              placeholder={lang === "en" ? "Search to add inspector..." : "พิมพ์ค้นหาเพื่อเพิ่มผู้ตรวจสอบ..."}

              className="w-full h-11 px-4 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"

            />

            {showInspectorDropdown && (

              <>

                <div className="fixed inset-0 z-10" onClick={() => setShowInspectorDropdown(false)} />

                <div className="absolute z-20 w-full mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1.5 divide-y divide-gray-50 dark:divide-gray-800">

                  {(() => {

                    const filtered = eligibleInspectors.filter(u => 

                      !defaultInspectorIds.includes(u.id) &&

                      (u.name.toLowerCase().includes(inspectorSearch.toLowerCase()) ||

                      (u.position && u.position.toLowerCase().includes(inspectorSearch.toLowerCase())))

                    );

                    if (filtered.length === 0) {

                      return (

                        <p className="text-xs text-gray-400 text-center py-3">

                          {lang === "en" ? "No users found" : "ไม่พบรายชื่อผู้ใช้"}

                        </p>

                      );

                    }

                    return filtered.map((u) => (

                      <div

                        key={u.id}

                        onClick={() => {

                          setDefaultInspectorIds(prev => [...prev, u.id]);

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

          <fieldset disabled={isInspector} className="w-full">

            <div className="w-full overflow-x-auto rounded-2xl border border-gray-150 dark:border-gray-850">

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

                        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>

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

            {/* Timezone Selector */}

            <div className="space-y-2 mt-6">

              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">

                {lang === "en" ? "System Timezone" : "เขตเวลาของระบบ (Timezone)"}

              </label>

              <div className="relative">

                <select

                  value={timezone}

                  onChange={(e) => setTimezone(e.target.value)}

                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"

                >

                  <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>

                  <option value="UTC">UTC (UTC+0)</option>

                  <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>

                  <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>

                </select>

                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">

                  <ChevronRight className="w-4 h-4 rotate-90" />

                </div>

              </div>

              <p className="text-xs text-gray-505 mt-1">

                {lang === "en" 

                  ? "Configures local timezone offset for leave calendar and attendance records."

                  : "ระบุเขตเวลาเพื่อใช้คำนวณวันหยุดและบันทึกเวลาปฏิบัติงานให้ถูกต้องตามโซนเวลาของคุณ"}

              </p>

            </div>

            {/* iApp API Key Selector */}

            <div className="space-y-2 mt-6">

              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">

                {lang === "en" ? "iApp Technology API Key" : "iApp Technology API Key (สำหรับดึงวันหยุดราชการ)"}

              </label>

              <input

                type="text"

                value={iappApiKey}

                onChange={(e) => setIappApiKey(e.target.value)}

                placeholder="YOUR_IAPP_API_KEY"

                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm outline-none"

              />

              <p className="text-xs text-gray-500 mt-1">

                {lang === "en" 

                  ? "Required to search and import Thai public holidays from iApp Technology API."

                  : "จำเป็นต้องระบุเพื่อดึงข้อมูลวันหยุดราชการไทยโดยตรงจาก iApp Technology API (สามารถลงทะเบียนรับ API Key ฟรีได้ที่ iapp.co.th)"}

              </p>

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

            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>

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

      const result = await importLeaveSimple(validRecords, importLeaveMode, backupCycleFilter as any, backupTargetYear);

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

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

        {/* Time range and Fiscal Year selection */}

        {importStage === "idle" && (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800/80">

            <div>

              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">

                {lang === "en" ? "Time Range / Cycle Filter" : "กำหนดช่วงเวลาการจัดการข้อมูล"}

              </label>

              <select

                value={backupCycleFilter}

                onChange={(e) => setBackupCycleFilter(e.target.value)}

                className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer text-gray-900 dark:text-white"

              >

                <option value="current">{lang === "en" ? "Current Cycle" : "รอบปัจจุบัน"}</option>

                <option value="cycle1">{lang === "en" ? "Cycle 1 (Oct - Mar)" : "รอบที่ 1 (ต.ค. - มี.ค.)"}</option>

                <option value="cycle2">{lang === "en" ? "Cycle 2 (Apr - Sep)" : "รอบที่ 2 (เม.ย. - ก.ย.)"}</option>

                <option value="year">{lang === "en" ? "Fiscal Year" : "ปีงบประมาณ"}</option>

                <option value="all">{lang === "en" ? "All History" : "ทั้งหมด (ไม่จำกัดช่วงเวลา)"}</option>

              </select>

            </div>

            {backupCycleFilter !== "all" && backupCycleFilter !== "current" && (

              <div>

                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">

                  {lang === "en" ? "Select Fiscal Year" : "ระบุปีงบประมาณ"}

                </label>

                <select

                  value={backupTargetYear}

                  onChange={(e) => setBackupTargetYear(parseInt(e.target.value))}

                  className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer text-gray-900 dark:text-white"

                >

                  {(() => {

                    const currentBE = new Date().getFullYear() + 543;

                    const years = [currentBE - 3, currentBE - 2, currentBE - 1, currentBE, currentBE + 1];

                    return years.map(y => (

                      <option key={y} value={y}>{lang === "en" ? `FY ${y}` : `ปีงบประมาณ ${y}`}</option>

                    ));

                  })()}

                </select>

              </div>

            )}

          </div>

        )}

        {/* Segmented Control for Wizard Tabs (Export vs Import) */}

        {importStage === "idle" && (

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-[280px] mb-6 shadow-sm">

            <button

              type="button"

              onClick={() => setDataWizardTab("import")}

              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${

                dataWizardTab === "import"

                  ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"

                  : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"

              }`}

            >

              {lang === "en" ? "Import Data" : "นำเข้าข้อมูล"}

            </button>

            <button

              type="button"

              onClick={() => setDataWizardTab("export")}

              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${

                dataWizardTab === "export"

                  ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"

                  : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"

              }`}

            >

              {lang === "en" ? "Export Data" : "ส่งออกข้อมูล"}

            </button>

          </div>

        )}

        <div className="space-y-4">

          {/* Export Buttons */}

          {importStage === "idle" && dataWizardTab === "export" && (

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

          {importStage === "idle" && dataWizardTab === "import" && (

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

        <p className="text-xs text-slate-500 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">สำหรับแอดมินเท่านั้น: สลับไปยังมุมมองของตำแหน่งต่าง ๆ เพื่อรับการช่วยเหลือและทดสอบระบบ</p>

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

        <p className="text-sm text-gray-500 mb-6">ส่วนนี้ต้องการ <span className="font-semibold text-rose-600">รหัสลับนักพัฒนา</span> ในการแก้ไข</p>

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

  const renderPermissionsSection = () => {

    const modules = [

      { id: "calendar", nameTh: "ปฏิทินการลาของครู/บุคลากร", nameEn: "Staff Calendar" },

      { id: "reports", nameTh: "รายงานผลและสถิติการลา", nameEn: "Reports & Statistics" },

      { id: "approvals", nameTh: "สิทธิ์การพิจารณา/อนุมัติใบลา", nameEn: "Approve Leaves" },

      { id: "logs", nameTh: "ประวัติกิจกรรมระบบ (Activity Logs)", nameEn: "System Logs" },

      { id: "backups", nameTh: "สำรองข้อมูลและล้างระบบ", nameEn: "Backups & Data" },

      { id: "users", nameTh: "จัดการบัญชีผู้ใช้งาน", nameEn: "User Management" },

      { id: "manual_import", nameTh: "ระบบงานกรอกข้อมูลด้วยตนเอง (Manual Entry)", nameEn: "Manual Leave Entry" },

      { id: "settings", nameTh: "ตั้งค่าระบบทั่วไป", nameEn: "General Settings" },

      { id: "repair_management", nameTh: "จัดการระบบแจ้งซ่อม", nameEn: "Repair Management" },

    ];

    const roles = [

      { id: "ADMIN", nameTh: "แอดมิน", nameEn: "Admin" },

      { id: "DIRECTOR", nameTh: "ผู้อำนวยการ", nameEn: "Director" },

      { id: "HR", nameTh: "หัวหน้างานบุคคล", nameEn: "HR Head" },

      { id: "HR_STAFF", nameTh: "เจ้าหน้าที่บุคคล", nameEn: "HR Staff" },

      { id: "INSPECTOR", nameTh: "ผู้ตรวจสอบ", nameEn: "Inspector" },

      { id: "DEPT_HEAD", nameTh: "หัวหน้าหมวด/กลุ่มสาระ", nameEn: "Department Head" },

      { id: "REPAIR_MANAGER", nameTh: "ผู้จัดการเรื่องระบบซ่อม", nameEn: "Repair Manager" },

      { id: "TEACHER", nameTh: "ครู/บุคลากรทั่วไป", nameEn: "Teacher" },

    ];

    const handleCheckboxChange = (moduleId: string, roleId: string, checked: boolean) => {

      setRolePermissions((prev: any) => {

        const currentList = prev[moduleId] || [];

        let newList = [];

        if (checked) {

          newList = [...currentList, roleId];

        } else {

          newList = currentList.filter((r: string) => r !== roleId);

        }

        return {

          ...prev,

          [moduleId]: newList

        };

      });

    };

    const handleSavePermissions = async (e: React.FormEvent) => {

      e.preventDefault();

      setIsSavingPermissions(true);

      try {

        const res = await updateSystemSettings({

          schoolName,

          subheader,

          rolePermissions: JSON.stringify(rolePermissions)

        });

        if (res.success) {

          showToast("success", lang === "en" ? "Permissions updated successfully" : "บันทึกสิทธิ์การเข้าใช้งานเรียบร้อยแล้ว");

        } else {

          showToast("error", "บันทึกไม่สำเร็จ");

        }

      } catch (err: any) {

        showToast("error", err.message || "เกิดข้อผิดพลาด");

      } finally {

        setIsSavingPermissions(false);

      }

    };

    return (

      <form onSubmit={handleSavePermissions} className="space-y-6">

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-150 dark:border-gray-800 relative overflow-hidden">

          <SectionHeader title={sectionTitles.permissions} />

          <p className="text-xs text-gray-500 mb-6 leading-relaxed">

            {lang === "en" 

              ? "Configure which user levels can view or modify specific modules/features of the system." 

              : "กำหนดสิทธิ์ให้แต่ละระดับบทบาทของบุคลากรในการเข้าใช้งาน แสดงผล หรือจัดการในส่วนต่างๆ ของระบบ"}

          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">

            <table className="w-full text-left text-xs border-collapse">

              <thead>

                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-gray-100 dark:border-gray-800">

                  <th className="px-4 py-3 font-bold min-w-[200px]">{lang === "en" ? "Module / Feature" : "ฟังก์ชัน / ระบบงาน"}</th>

                  {roles.map((role) => (

                    <th key={role.id} className="px-3 py-3 font-bold text-center">

                      {lang === "en" ? role.nameEn : role.nameTh}

                    </th>

                  ))}

                </tr>

              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">

                {modules.map((mod) => (

                  <tr key={mod.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10">

                    <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">

                      {lang === "en" ? mod.nameEn : mod.nameTh}

                    </td>

                    {roles.map((role) => {

                      const isChecked = (rolePermissions[mod.id] || []).includes(role.id);

                      return (

                        <td key={role.id} className="px-3 py-3.5 text-center">

                          <input

                            type="checkbox"

                            checked={isChecked}

                            onChange={(e) => handleCheckboxChange(mod.id, role.id, e.target.checked)}

                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"

                          />

                        </td>

                      );

                    })}

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

        <StickySaveBar isSaving={isSavingPermissions} label={isSavingPermissions ? t("saving") : t("saveSettings")} color="indigo" />

      </form>

    );

  };

  const renderHolidaysSection = () => {

    const handleOpenCreateModal = () => {

      setEditingHoliday(null);

      setHolidayStartDateInput("");

      setHolidayEndDateInput("");

      setHolidayNameInput("");

      setHolidayIsWorkdayInput(false);

      setIsHolidayModalOpen(true);

    };

    const handleOpenEditModal = (h: any) => {

      setEditingHoliday(h);

      const dStart = new Date(h.startDate);

      const yStart = dStart.getUTCFullYear();

      const mStart = String(dStart.getUTCMonth() + 1).padStart(2, "0");

      const dStartStr = String(dStart.getUTCDate()).padStart(2, "0");

      setHolidayStartDateInput(`${yStart}-${mStart}-${dStartStr}`);

      const dEnd = new Date(h.endDate);

      const yEnd = dEnd.getUTCFullYear();

      const mEnd = String(dEnd.getUTCMonth() + 1).padStart(2, "0");

      const dEndStr = String(dEnd.getUTCDate()).padStart(2, "0");

      setHolidayEndDateInput(`${yEnd}-${mEnd}-${dEndStr}`);

      setHolidayNameInput(h.name);

      setHolidayIsWorkdayInput(h.isWorkday);

      setIsHolidayModalOpen(true);

    };

    const handleSaveHoliday = async (e: React.FormEvent) => {

      e.preventDefault();

      if (!holidayStartDateInput || !holidayNameInput.trim()) {

        showToast("error", lang === "en" ? "Please fill all required fields" : "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");

        return;

      }

      const endInput = holidayEndDateInput || holidayStartDateInput;

      if (new Date(holidayStartDateInput) > new Date(endInput)) {

        showToast("error", lang === "en" ? "End date must be after or equal to start date" : "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");

        return;

      }

      setIsSavingHoliday(true);

      try {

        if (editingHoliday) {

          await updateHoliday(editingHoliday.id, holidayStartDateInput, endInput, holidayNameInput.trim(), holidayIsWorkdayInput, true);

          showToast("success", lang === "en" ? "Holiday updated" : "แก้ไขวันหยุดสำเร็จ");

        } else {

          await createHoliday(holidayStartDateInput, endInput, holidayNameInput.trim(), holidayIsWorkdayInput);

          showToast("success", lang === "en" ? "Holiday created" : "เพิ่มวันหยุดสำเร็จ");

        }

        setIsHolidayModalOpen(false);

        const list = await getHolidays(holidaysYear);

        setHolidaysList(list);

      } catch (e: any) {

        showToast("error", e.message || "Failed to save holiday");

      } finally {

        setIsSavingHoliday(false);

      }

    };

    const handleDeleteHoliday = async (id: string) => {

      if (!confirm(lang === "en" ? "Are you sure you want to delete this holiday?" : "คุณแน่ใจหรือไม่ว่าต้องการลบวันหยุดนี้?")) return;

      try {

        await deleteHoliday(id);

        showToast("success", lang === "en" ? "Holiday deleted" : "ลบวันหยุดสำเร็จ");

        const list = await getHolidays(holidaysYear);

        setHolidaysList(list);

      } catch (e: any) {

        showToast("error", e.message || "Failed to delete holiday");

      }

    };

    return (

      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-150 dark:border-gray-800">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">

          <div>

            <SectionHeader title={sectionTitles.holidays} />

            <p className="text-xs text-gray-505 dark:text-gray-400 mt-1 leading-relaxed">

              {lang === "en"

                ? "Manage school holidays and special workdays. Holidays are excluded from leave calculations, while special workdays count as leave days."

                : "จัดการวันหยุดและวันทำงานกรณีพิเศษ (วันชดเชย) วันหยุดจะไม่ถูกนับเป็นวันลา ส่วนวันทำงานพิเศษจะนับเป็นวันลาปกติ"}

            </p>

          </div>

          <button

            type="button"

            onClick={handleOpenCreateModal}

            className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-md shadow-purple-500/10 flex items-center gap-1.5"

          >

            <Plus className="w-4 h-4" />

            {lang === "en" ? "Add Custom Holiday" : "เพิ่มวันหยุดด้วยตนเอง"}

          </button>

        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mb-6">

          <div className="flex items-center gap-3">

            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">

              {lang === "en" ? "Select Year (BE):" : "เลือกปี พ.ศ.:"}

            </label>

            <select

              value={holidaysYear}

              onChange={(e) => setHolidaysYear(Number(e.target.value))}

              className="h-9 px-3 rounded-lg border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold outline-none text-gray-850 dark:text-white"

            >

              {Array.from({ length: 5 }).map((_, i) => {

                const year = new Date().getFullYear() + 543 - 2 + i;

                return (

                  <option key={year} value={year}>

                    {year}

                  </option>

                );

              })}

            </select>

          </div>

          <button

            type="button"

            onClick={() => {

              setSearchYearInput(holidaysYear);

              setSearchedHolidays([]);

              setIsSearchImportModalOpen(true);

            }}

            className="h-9 px-4 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40"

          >

            <DownloadCloud className="w-4 h-4" />

            {lang === "en" ? "Search & Import Holidays" : "ค้นหาและนำเข้าวันหยุด"}

          </button>

        </div>

        <div className="overflow-x-auto">

          {holidaysList.length === 0 ? (

            <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-850 rounded-2xl">

              <CalendarDays className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />

              <p className="text-xs text-gray-500 font-medium">

                {lang === "en" ? "No holidays found for this year." : "ไม่พบข้อมูลวันหยุดสำหรับปีนี้"}

              </p>

            </div>

          ) : (

            <table className="w-full text-left border-collapse min-w-[600px]">

              <thead>

                <tr className="border-b border-gray-100 dark:border-gray-800">

                  <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{lang === "en" ? "Date" : "วันที่"}</th>

                  <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{lang === "en" ? "Holiday Name" : "ชื่อวันหยุด"}</th>

                  <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{lang === "en" ? "Type" : "ประเภท"}</th>

                  <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{lang === "en" ? "Actions" : "จัดการ"}</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-gray-50 dark:divide-gray-850">

                {holidaysList.map((h) => {

                  const dStart = new Date(h.startDate);

                  const formattedStartDate = dStart.toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {

                    weekday: "long",

                    day: "numeric",

                    month: "long",

                    year: "numeric"

                  });

                  let formattedDate = formattedStartDate;

                  const startStr = new Date(h.startDate).toISOString().split('T')[0];

                  const endStr = new Date(h.endDate).toISOString().split('T')[0];

                  if (startStr !== endStr) {

                    const dEnd = new Date(h.endDate);

                    const formattedEndDate = dEnd.toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {

                      day: "numeric",

                      month: "long",

                      year: "numeric"

                    });

                    formattedDate = `${formattedStartDate} - ${formattedEndDate}`;

                  }

                  return (

                    <tr key={h.id} className="hover:bg-slate-55 dark:hover:bg-slate-800/10 transition-colors">

                      <td className="py-3.5 text-xs text-gray-900 dark:text-white font-medium">{formattedDate}</td>

                      <td className="py-3.5 text-xs text-gray-900 dark:text-white font-semibold">{h.name}</td>

                      <td className="py-3.5 text-xs">

                        {h.isWorkday ? (

                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">

                            {lang === "en" ? "Special Workday" : "วันทำงานกรณีพิเศษ"}

                          </span>

                        ) : (

                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">

                            {lang === "en" ? "Public Holiday" : "วันหยุดราชการ"}

                          </span>

                        )}

                        {h.isCustom && (

                          <span className="ml-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">

                            {lang === "en" ? "Custom" : "กำหนดเอง"}

                          </span>

                        )}

                      </td>

                      <td className="py-3.5 text-right space-x-2">

                        <button

                          type="button"

                          onClick={() => handleOpenEditModal(h)}

                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"

                        >

                          {lang === "en" ? "Edit" : "แก้ไข"}

                        </button>

                        <button

                          type="button"

                          onClick={() => handleDeleteHoliday(h.id)}

                          className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg transition-colors border border-rose-100 dark:border-rose-900/30"

                        >

                          {lang === "en" ? "Delete" : "ลบ"}

                        </button>

                      </td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

          )}

        </div>

        {isHolidayModalOpen && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">

            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-150 dark:border-gray-800 overflow-hidden">

              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-855 flex items-center justify-between">

                <h3 className="font-bold text-gray-950 dark:text-white">

                  {editingHoliday

                    ? (lang === "en" ? "Edit Holiday" : "แก้ไขวันหยุด/วันทำงานชดเชย")

                    : (lang === "en" ? "Add Custom Holiday" : "เพิ่มวันหยุดด้วยตนเอง")}

                </h3>

                <button

                  type="button"

                  onClick={() => setIsHolidayModalOpen(false)}

                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"

                >

                  <X className="w-5 h-5 text-gray-400" />

                </button>

              </div>

              <form onSubmit={handleSaveHoliday} className="p-6 space-y-4">

                <div className="grid grid-cols-2 gap-4">

                  <div>

                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                      {lang === "en" ? "Start Date *" : "วันที่เริ่มต้น *"}

                    </label>

                    <input

                      type="date"

                      required

                      value={holidayStartDateInput}

                      onChange={(e) => setHolidayStartDateInput(e.target.value)}

                      className="w-full h-10 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-gray-900 dark:text-white"

                    />

                  </div>

                  <div>

                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                      {lang === "en" ? "End Date" : "วันที่สิ้นสุด"}

                    </label>

                    <input

                      type="date"

                      value={holidayEndDateInput}

                      onChange={(e) => setHolidayEndDateInput(e.target.value)}

                      className="w-full h-10 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-gray-900 dark:text-white"

                    />

                  </div>

                </div>

                <div>

                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                    {lang === "en" ? "Holiday Name *" : "ชื่อเรียกวันหยุด *"}

                  </label>

                  <input

                    type="text"

                    required

                    placeholder={lang === "en" ? "e.g. Songkran Festival" : "เช่น วันสงกรานต์"}

                    value={holidayNameInput}

                    onChange={(e) => setHolidayNameInput(e.target.value)}

                    className="w-full h-10 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-gray-900 dark:text-white"

                  />

                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">

                  <div>

                    <label className="block text-xs font-bold text-gray-850 dark:text-white">

                      {lang === "en" ? "Set as Special Workday" : "ตั้งค่าเป็นวันทำงานชดเชย/กรณีพิเศษ"}

                    </label>

                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-tight">

                      {lang === "en"

                        ? "If enabled, this day acts as a normal working day (even if on a weekend)."

                        : "หากเปิดใช้งาน วันนี้จะถือเป็นวันทำการปกติ (แม้ว่าจะเป็นวันเสาร์-อาทิตย์ก็ตาม) และถ้าลาจะหักโควตา"}

                    </span>

                  </div>

                  <input

                    type="checkbox"

                    checked={holidayIsWorkdayInput}

                    onChange={(e) => setHolidayIsWorkdayInput(e.target.checked)}

                    className="w-4 h-4 rounded text-purple-600 border-gray-305 focus:ring-purple-500 accent-purple-600 cursor-pointer"

                  />

                </div>

                <div className="pt-2 flex justify-end gap-3">

                  <button

                    type="button"

                    onClick={() => setIsHolidayModalOpen(false)}

                    className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"

                  >

                    {lang === "en" ? "Cancel" : "ยกเลิก"}

                  </button>

                  <button

                    type="submit"

                    disabled={isSavingHoliday}

                    className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-md shadow-purple-500/10 flex items-center gap-1.5"

                  >

                    {isSavingHoliday && <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}

                    {lang === "en" ? "Save Changes" : "บันทึกข้อมูล"}

                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

        {/* Search & Import Holidays Modal */}

        {isSearchImportModalOpen && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">

            <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-150 dark:border-gray-800 overflow-hidden flex flex-col max-h-[85vh]">

              {/* Modal Header */}

              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-855 flex items-center justify-between shrink-0">

                <h3 className="font-bold text-gray-955 dark:text-white flex items-center gap-2">

                  <DownloadCloud className="w-5 h-5 text-indigo-500" />

                  {lang === "en" ? "Search & Import Public Holidays" : "ค้นหาและนำเข้าวันหยุดราชการ"}

                </h3>

                <button

                  type="button"

                  onClick={() => setIsSearchImportModalOpen(false)}

                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"

                >

                  <X className="w-5 h-5 text-gray-400" />

                </button>

              </div>

              {/* Modal Body */}

              <div className="p-6 space-y-4 overflow-y-auto flex-1">

                {/* Year Search Input */}

                <div className="flex gap-3 items-end">

                  <div className="flex-1 space-y-2">

                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">

                      {lang === "en" ? "Enter Year (BE)" : "ป้อนปี พ.ศ. ที่ต้องการค้นหา"}

                    </label>

                    <input

                      type="number"

                      value={searchYearInput}

                      onChange={(e) => setSearchYearInput(Number(e.target.value))}

                      className="w-full h-10 px-3 rounded-xl border border-gray-255 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white"

                    />

                  </div>

                  <button

                    type="button"

                    disabled={isSearchingInternetHolidays}

                    onClick={async () => {

                      setIsSearchingInternetHolidays(true);

                      try {

                        const results = await searchInternetHolidays(searchYearInput);

                        setSearchedHolidays(results.map((r: any) => ({ ...r, selected: true })));

                        if (results.length === 0) {

                          showToast("info", lang === "en" ? "No holidays found for this year" : "ไม่พบข้อมูลวันหยุดราชการของปีนี้");

                        }

                      } catch (e: any) {

                        showToast("error", e.message || "Failed to search holidays");

                      } finally {

                        setIsSearchingInternetHolidays(false);

                      }

                    }}

                    className="h-10 px-5 rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-500/10 flex items-center gap-1.5 disabled:opacity-50"

                  >

                    {isSearchingInternetHolidays && <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}

                    {lang === "en" ? "Search" : "ค้นหาวันหยุด"}

                  </button>

                </div>

                {/* Searched Results List */}

                {searchedHolidays.length > 0 ? (

                  <div className="space-y-3">

                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">

                      <span className="text-xs font-bold text-gray-500">

                        {lang === "en" 

                          ? `Found ${searchedHolidays.length} holidays` 

                          : `พบวันหยุดราชการทั้งหมด ${searchedHolidays.length} รายการ`}

                      </span>

                      <label className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer">

                        <input

                          type="checkbox"

                          checked={searchedHolidays.every((h: any) => h.selected)}

                          onChange={(e) => setSearchedHolidays(prev => prev.map((h: any) => ({ ...h, selected: e.target.checked })))}

                          className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 accent-indigo-600"

                        />

                        {lang === "en" ? "Select All" : "เลือกทั้งหมด"}

                      </label>

                    </div>

                    <div className="border border-gray-150 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-50 dark:divide-gray-850">

                      {searchedHolidays.map((item, idx) => {

                        const d = new Date(item.dateStr);

                        const formattedDate = d.toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {

                          weekday: "short",

                          day: "numeric",

                          month: "short",

                          year: "numeric"

                        });

                        return (

                          <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-slate-55 dark:hover:bg-slate-800/10 transition-colors">

                            <div className="space-y-1">

                              <span className="text-sm font-semibold text-gray-900 dark:text-white block">{item.name}</span>

                              <span className="text-xs text-gray-400 block">{formattedDate}</span>

                            </div>

                            <input

                              type="checkbox"

                              checked={item.selected}

                              onChange={() => setSearchedHolidays(prev => prev.map((h: any, i: number) => i === idx ? { ...h, selected: !h.selected } : h))}

                              className="w-4.5 h-4.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"

                            />

                          </div>

                        );

                      })}

                    </div>

                  </div>

                ) : searchedHolidays.length === 0 && !isSearchingInternetHolidays ? (

                  <div className="text-center py-8 text-gray-400 text-xs font-medium">

                    {lang === "en" ? "Enter year and click search to view holidays list." : "กรุณาป้อนปี พ.ศ. และกดค้นหาข้อมูลเพื่อเลือกวันหยุดที่ต้องการนำเข้า"}

                  </div>

                ) : null}

              </div>

              {/* Modal Footer */}

              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-855 flex justify-end gap-3 shrink-0">

                <button

                  type="button"

                  onClick={() => setIsSearchImportModalOpen(false)}

                  className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"

                >

                  {lang === "en" ? "Close" : "ปิด"}

                </button>

                {searchedHolidays.length > 0 && (

                  <button

                    type="button"

                    disabled={isImportingSelected}

                    onClick={async () => {

                      const selected = searchedHolidays.filter((h: any) => h.selected);

                      if (selected.length === 0) {

                        showToast("error", lang === "en" ? "Please select at least one holiday to import" : "กรุณาเลือกอย่างน้อยหนึ่งวันหยุดเพื่อนำเข้า");

                        return;

                      }

                      setIsImportingSelected(true);

                      try {

                        const res = await importSelectedHolidays(selected.map((h: any) => ({ dateStr: h.dateStr, name: h.name })));

                        if (res.success) {

                          showToast("success", lang === "en" ? `Successfully imported ${res.count} holidays` : `นำเข้าข้อมูลสำเร็จแล้ว ${res.count} วันหยุด`);

                          setIsSearchImportModalOpen(false);

                          const list = await getHolidays(holidaysYear);

                          setHolidaysList(list);

                        }

                      } catch (e: any) {

                        showToast("error", e.message || "Failed to import holidays");

                      } finally {

                        setIsImportingSelected(false);

                      }

                    }}

                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-500/10 flex items-center gap-1.5"

                  >

                    {isImportingSelected && <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}

                    {lang === "en" ? "Import Selected" : "นำเข้าวันหยุดที่เลือก"}

                  </button>

                )}

              </div>

            </div>

          </div>

        )}

      </div>

    );

  };

  const renderManualImportSection = () => {

    return (

      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-150 dark:border-gray-800">

        <SectionHeader title={sectionTitles["manual-import"]} />

        <p className="text-xs text-gray-500 mb-6 leading-relaxed">

          {lang === "en" 

            ? "Record a leave history entry for a staff member manually."

            : "บันทึกประวัติการลาของครูและบุคลากรย้อนหลังด้วยตนเองลงในระบบ"}

        </p>

        <div className="space-y-5">

          {/* Teacher Search select */}

          <div className="relative">

            <label className="block text-xs font-bold text-gray-750 dark:text-gray-300 mb-1.5 font-sans">

              {lang === "en" ? "Select Teacher / Staff *" : "เลือกครู / บุคลากร *"}

            </label>

            {manualSelectedTeacher ? (

              <div className="flex items-center justify-between p-3.5 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-100 dark:border-purple-900/50">

                <div className="text-sm font-semibold">

                  {manualSelectedTeacher.name} {manualSelectedTeacher.position ? `(${manualSelectedTeacher.position})` : ""}

                </div>

                <button 

                  type="button" 

                  onClick={() => setManualSelectedTeacher(null)}

                  className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-full"

                >

                  <X className="w-4 h-4" />

                </button>

              </div>

            ) : (

              <div>

                <input

                  type="text"

                  value={manualTeacherSearch}

                  onChange={(e) => {

                    setManualTeacherSearch(e.target.value);

                    setShowManualTeacherDropdown(true);

                  }}

                  onFocus={() => setShowManualTeacherDropdown(true)}

                  placeholder={lang === "en" ? "Type to search teacher name..." : "พิมพ์ค้นหาชื่อหรือตำแหน่งครู..."}

                  className="w-full h-11 px-4 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-900 dark:text-white"

                />

                {showManualTeacherDropdown && (

                  <>

                    <div className="fixed inset-0 z-10" onClick={() => setShowManualTeacherDropdown(false)} />

                    <div className="absolute z-20 w-full mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-1.5 divide-y divide-gray-50 dark:divide-gray-800">

                      {(() => {

                        const filtered = eligibleInspectors.filter(u => 

                          u.name.toLowerCase().includes(manualTeacherSearch.toLowerCase()) ||

                          (u.position && u.position.toLowerCase().includes(manualTeacherSearch.toLowerCase()))

                        );

                        if (filtered.length === 0) {

                          return (

                            <p className="text-xs text-gray-400 text-center py-3">

                              {lang === "en" ? "No matches found" : "ไม่พบรายชื่อผู้ใช้"}

                            </p>

                          );

                        }

                        return filtered.map((u) => (

                          <div

                            key={u.id}

                            onClick={() => {

                              setManualSelectedTeacher(u);

                              setManualTeacherSearch("");

                              setShowManualTeacherDropdown(false);

                            }}

                            className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-lg text-xs cursor-pointer flex items-center justify-between text-gray-900 dark:text-gray-200"

                          >

                            <span className="font-semibold">{u.name}</span>

                            <span className="text-[10px] text-gray-450">{u.position || "-"}</span>

                          </div>

                        ));

                      })()}

                    </div>

                  </>

                )}

              </div>

            )}

          </div>

          {/* Leave Type and Status Row */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">

            <div>

              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 font-sans">

                {lang === "en" ? "Leave Type *" : "ประเภทการลา *"}

              </label>

              <select

                value={manualLeaveType}

                onChange={(e) => setManualLeaveType(e.target.value)}

                className="w-full h-11 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-gray-900 dark:text-white"

              >

                {leaveConfigs.map((c) => (

                  <option key={c.type} value={c.name}>{c.name}</option>

                ))}

              </select>

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 font-sans">

                {lang === "en" ? "Leave Status *" : "สถานะการลา *"}

              </label>

              <select

                value={manualLeaveStatus}

                onChange={(e) => setManualLeaveStatus(e.target.value)}

                className="w-full h-11 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-gray-900 dark:text-white"

              >

                <option value="APPROVED">{lang === "en" ? "Approved" : "อนุมัติแล้ว"}</option>

                <option value="PENDING_HEAD">{lang === "en" ? "Pending Head" : "รอหัวหน้างาน/ผู้ตรวจสอบ"}</option>

                <option value="PENDING_EXEC">{lang === "en" ? "Pending Exec" : "รอผู้อนุมัติ"}</option>

                <option value="REJECTED">{lang === "en" ? "Rejected" : "ปฏิเสธแล้ว"}</option>

                <option value="CANCELLED">{lang === "en" ? "Cancelled" : "ยกเลิกแล้ว"}</option>

              </select>

            </div>

          </div>

          {/* Start Date and End Date Row */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>

              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                {lang === "en" ? "Start Date *" : "วันที่เริ่มลา *"}

              </label>

              <input

                type="date"

                value={manualStartDate}

                onChange={(e) => setManualStartDate(e.target.value)}

                className="w-full h-11 px-4 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white"

              />

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                {lang === "en" ? "End Date *" : "วันที่สิ้นสุด *"}

              </label>

              <input

                type="date"

                value={manualEndDate}

                onChange={(e) => setManualEndDate(e.target.value)}

                className="w-full h-11 px-4 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white"

              />

            </div>

          </div>

          {/* Head Approver and Final Approver Row (หัวหน้าบุคคลก่อน แล้วค่อยผู้อนุมัติขั้นสุดท้าย) */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>

              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                {lang === "en" ? "HR Head (Inspector)" : "หัวหน้าบุคคล (ผู้ตรวจสอบ)"}

              </label>

              <select

                value={manualHeadApproverId}

                onChange={(e) => setManualHeadApproverId(e.target.value)}

                className="w-full h-11 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-gray-900 dark:text-white"

              >

                <option value="">{lang === "en" ? "None (Direct to Exec)" : "ไม่มี (ข้ามไปผู้อนุมัติ)"}</option>

                {eligibleInspectors.map((u) => (

                  <option key={u.id} value={u.id}>{u.name} {u.position ? `(${u.position})` : ""}</option>

                ))}

              </select>

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                {lang === "en" ? "Final Approver" : "ผู้อนุมัติขั้นสุดท้าย"}

              </label>

              <select

                value={manualFinalApproverId}

                onChange={(e) => setManualFinalApproverId(e.target.value)}

                className="w-full h-11 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-gray-900 dark:text-white"

              >

                {(() => {

                  // Always list ผู้อำนวยการ first, then other eligible approvers

                  const director = eligibleInspectors.find(u => u.position === "ผู้อำนวยการ");

                  const otherFinals = eligibleInspectors.filter(u => 

                    u.position !== "ผู้อำนวยการ" && finalApproverUserIds.includes(u.id)

                  );

                  const combinedList = [

                    ...(director ? [director] : []),

                    ...otherFinals

                  ];

                  if (combinedList.length === 0) {

                    return eligibleInspectors.map((u) => (

                      <option key={u.id} value={u.id}>{u.name} {u.position ? `(${u.position})` : ""}</option>

                    ));

                  }

                  return combinedList.map((u) => (

                    <option key={u.id} value={u.id}>{u.name} {u.position ? `(${u.position})` : ""}</option>

                  ));

                })()}

              </select>

            </div>

          </div>

          {/* Reason */}

          <div>

            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

              {lang === "en" ? "Reason (Optional)" : "เหตุผลการลา (ไม่บังคับ)"}

            </label>

            <textarea

              value={manualReason}

              onChange={(e) => setManualReason(e.target.value)}

              placeholder={lang === "en" ? "Details or reasons..." : "ใส่เหตุผลการลา..."}

              className="w-full p-3.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none h-24 text-gray-900 dark:text-white"

            />

          </div>

        </div>

        {/* Action buttons */}

        <div className="flex flex-wrap gap-3 justify-end mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">

          <button

            type="button"

            onClick={() => handleAddManualLeave(false)}

            className="h-11 px-5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/50 font-bold text-sm transition-all"

          >

            {lang === "en" ? "Add & Continue" : "เพิ่มและกรอกต่อ"}

          </button>

          <button

            type="button"

            onClick={() => {

              handleAddManualLeave(true);

              setActiveSection(null);

            }}

            className="h-11 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-all shadow-md shadow-teal-500/10"

          >

            {lang === "en" ? "Add & Back" : "เพิ่มและบันทึกย้อนกลับ"}

          </button>

        </div>

      </div>

    );

  };

  // ─── Repair Settings Section ──────────────────────────────────────────────────
  const renderRepairSettingsSection = () => {
    const saving = isSavingRepair;
    const setSaving = setIsSavingRepair;
    const searchQuery = repairSearchQuery;
    const setSearchQuery = setRepairSearchQuery;

     const managers = rolePermissions.repairManagers || rolePermissions.repairCaregivers || [];
    const headAdmin = rolePermissions.headGeneralAdminId || "";
    const approvalMode = rolePermissions.repairApprovalMode || "AUTO_ON_COMPLETE";
    const limitBefore = rolePermissions.repairPhotoLimitBefore !== undefined ? rolePermissions.repairPhotoLimitBefore : 2;
    const limitAfter = rolePermissions.repairPhotoLimitAfter !== undefined ? rolePermissions.repairPhotoLimitAfter : 2;
    const maxFileSize = rolePermissions.repairMaxFileSizeMb !== undefined ? rolePermissions.repairMaxFileSizeMb : 10;
    const slaHours = rolePermissions.repairSlaWarningHours !== undefined ? rolePermissions.repairSlaWarningHours : 24;

    const notifyOnCreate = rolePermissions.repairNotifyOnCreate !== false;
    const notifyOnAssign = rolePermissions.repairNotifyOnAssign !== false;
    const notifyOnStart = rolePermissions.repairNotifyOnStart !== false;
    const notifyOnComplete = rolePermissions.repairNotifyOnComplete !== false;
    const notifyOnCancel = rolePermissions.repairNotifyOnCancel !== false;

    const filteredUsers = userList.filter((u: any) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.position?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        const updatedPermissions = {
          ...rolePermissions,
          repairManagers: managers,
          repairCaregivers: managers,
          headGeneralAdminId: headAdmin,
          repairApprovalMode: approvalMode,
          repairPhotoLimitBefore: Number(limitBefore),
          repairPhotoLimitAfter: Number(limitAfter),
          repairMaxFileSizeMb: Number(maxFileSize),
          repairSlaWarningHours: Number(slaHours),
          repairNotifyOnCreate: notifyOnCreate,
          repairNotifyOnAssign: notifyOnAssign,
          repairNotifyOnStart: notifyOnStart,
          repairNotifyOnComplete: notifyOnComplete,
          repairNotifyOnCancel: notifyOnCancel,
        };
        const res = await updateSystemSettings({
          schoolName,
          subheader,
          rolePermissions: JSON.stringify(updatedPermissions),
          repairLineChannelAccessToken: repairLineToken,
          repairLineTargetGroupId: repairLineGroupId,
          enableRepairLineNotify: enableRepairLine,
        });
        if (res.success) {
          showToast("success", lang === "en" ? "Repair settings saved successfully" : "บันทึกการตั้งค่าระบบแจ้งซ่อมสำเร็จ");
          setRolePermissions(updatedPermissions);
        } else {
          showToast("error", "ไม่สามารถบันทึกการตั้งค่าได้");
        }
      } catch (err: any) {
        showToast("error", err.message || "เกิดข้อผิดพลาด");
      } finally {
        setSaving(false);
      }
    };

    const handleManagerToggle = (userId: string, checked: boolean) => {
      const newList = checked
        ? [...managers, userId]
        : managers.filter((id: string) => id !== userId);
      setRolePermissions((prev: any) => ({ ...prev, repairManagers: newList, repairCaregivers: newList }));
    };

    return (
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title={sectionTitles["repair-settings"]} />
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {lang === "en" ? "Save Settings" : "บันทึกตั้งค่า"}
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-[-10px]">
          {lang === "en"
            ? "Configure repair limits, SLA parameters, and assign responsible staff."
            : "ปรับแต่งขีดจำกัดระบบงานแจ้งซ่อม, เกณฑ์การแจ้งเตือน SLA และมอบหมายบุคลากรผู้ดูแลรับผิดชอบ"}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Personnel assignment */}
          <div className="space-y-6">
            {/* Repair Managers (Multiple) */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <label className="text-sm font-bold text-slate-805 text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-500" />
                {lang === "en" ? "Repair Caregivers / Staff" : "ผู้ดูแลและช่างดูแลระบบซ่อม (เลือกได้หลายคน)"}
              </label>
              <p className="text-[11px] text-slate-450 text-slate-400 leading-normal">
                {lang === "en"
                  ? "Select staff members responsible for inspecting, assigning, and resolving repair requests."
                  : "เลือกบุคลากร/ช่างที่จะทำหน้าที่ตรวจรับใบงาน, มอบหมายงาน และปฏิบัติงานซ่อมในระบบ"}
              </p>

              {/* Search bar */}
              <input
                type="text"
                placeholder={lang === "en" ? "Search staff name..." : "ค้นหาชื่อครู/บุคลากร..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />

              {/* User List Scrollable Area */}
              <div className="h-[220px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40 p-2 space-y-1">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">{lang === "en" ? "No users found" : "ไม่พบชื่อบุคลากร"}</p>
                ) : (
                  filteredUsers.map((u: any) => {
                    const isChecked = managers.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => handleManagerToggle(u.id, e.target.checked)}
                          className="rounded text-orange-555 text-orange-500 focus:ring-orange-500/20 w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{u.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{u.position || (lang === "en" ? "No position" : "ไม่ได้ระบุตำแหน่ง")}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* General Administration Head (Single) */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <label className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-orange-500" />
                {lang === "en" ? "Head of General Administration" : "หัวหน้าบริหารงานทั่วไป (1 คน)"}
              </label>
              <p className="text-[11px] text-slate-400 leading-normal">
                {lang === "en"
                  ? "Select the head officer in charge of general school administration."
                  : "เลือกหัวหน้าผู้รับผิดชอบงานฝ่ายบริหารทั่วไปของโรงเรียน"}
              </p>
              <select
                value={headAdmin}
                onChange={e => setRolePermissions((prev: any) => ({ ...prev, headGeneralAdminId: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">-- {lang === "en" ? "Select Head of General Admin" : "เลือกหัวหน้าฝ่ายบริหารทั่วไป"} --</option>
                {userList.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.position || (lang === "en" ? "No position" : "ไม่ได้ระบุตำแหน่ง")})
                  </option>
                ))}
              </select>

              {/* Approval & Signature Option */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {lang === "en" ? "Approval Signature Mode for Head" : "รูปแบบการลงลายเซ็นอนุมัติของหัวหน้า"}
                </label>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60">
                    <input
                      type="radio"
                      name="repairApprovalMode"
                      value="AUTO_ON_COMPLETE"
                      checked={approvalMode === "AUTO_ON_COMPLETE"}
                      onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairApprovalMode: e.target.value }))}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">ลงลายเซ็นอัตโนมัติเมื่อซ่อมเสร็จสิ้น (แนะนำ)</span>
                      <p className="text-[10px] text-slate-400">แสดงลายเซ็นหัวหน้าฝ่ายบนแบบพิมพ์ใบซ่อมทันทีเมื่อช่างซ่อมเสร็จ</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60">
                    <input
                      type="radio"
                      name="repairApprovalMode"
                      value="MANUAL"
                      checked={approvalMode === "MANUAL"}
                      onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairApprovalMode: e.target.value }))}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">ให้หัวหน้าตรวจสอบและกดอนุมัติก่อน (เหมือนแบบการลา)</span>
                      <p className="text-[10px] text-slate-400">หัวหน้าฝ่ายต้องกดอนุมัติใบงานซ่อมในระบบ ลายเซ็นจึงจะปรากฏบนแบบพิมพ์</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Parameters, Limits, and Notification Toggles */}
          <div className="space-y-4">
            {/* LINE Notification Event Toggles */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Bell className="w-4 h-4 text-orange-500" />
                {lang === "en" ? "LINE Notification Events" : "หัวข้อการแจ้งเตือน LINE Notify (เลือกเปิด/ปิดตามต้องการ)"}
              </h4>
              <p className="text-[11px] text-slate-400">
                {lang === "en"
                  ? "Select which repair status events trigger LINE notifications."
                  : "เลือกเปิด/ปิดการส่งการแจ้งเตือนไปยัง LINE เฉพาะหัวข้อเหตุการณ์ที่ต้องการ"}
              </p>

              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800/80 transition">
                  <input
                    type="checkbox"
                    checked={notifyOnCreate}
                    onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairNotifyOnCreate: e.target.checked }))}
                    className="rounded text-orange-500 focus:ring-orange-500/20 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">1. เมื่อมีผู้แจ้งซ่อมส่งคำขอใหม่</span>
                    <p className="text-[10px] text-slate-400">แจ้งเตือนทันทีเมื่อบุคลากรส่งคำขอแจ้งซ่อมวัสดุ/ครุภัณฑ์เข้ามาในระบบ</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800/80 transition">
                  <input
                    type="checkbox"
                    checked={notifyOnAssign}
                    onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairNotifyOnAssign: e.target.checked }))}
                    className="rounded text-orange-500 focus:ring-orange-500/20 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">2. เมื่อมีการมอบหมายช่างผู้รับผิดชอบ</span>
                    <p className="text-[10px] text-slate-400">แจ้งเตือนเมื่อแอดมินหรือหัวหน้าฝ่ายมอบหมายช่างให้รับผิดชอบคำขอ</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800/80 transition">
                  <input
                    type="checkbox"
                    checked={notifyOnStart}
                    onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairNotifyOnStart: e.target.checked }))}
                    className="rounded text-orange-500 focus:ring-orange-500/20 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">3. เมื่อช่างกดเริ่มปฏิบัติงานซ่อม</span>
                    <p className="text-[10px] text-slate-400">แจ้งเตือนเมื่อช่างเปลี่ยนสถานะเป็นกำลังดำเนินการซ่อมแซม</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800/80 transition">
                  <input
                    type="checkbox"
                    checked={notifyOnComplete}
                    onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairNotifyOnComplete: e.target.checked }))}
                    className="rounded text-orange-500 focus:ring-orange-500/20 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">4. เมื่อดำเนินการซ่อมแซมเสร็จสิ้น</span>
                    <p className="text-[10px] text-slate-400">แจ้งเตือนสรุปผลการซ่อมแซมและค่าใช้จ่ายเมื่อช่างปฏิบัติงานเสร็จสิ้น</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800/80 transition">
                  <input
                    type="checkbox"
                    checked={notifyOnCancel}
                    onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairNotifyOnCancel: e.target.checked }))}
                    className="rounded text-orange-500 focus:ring-orange-500/20 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">5. เมื่อมีการยกเลิกคำขอแจ้งซ่อม</span>
                    <p className="text-[10px] text-slate-400">แจ้งเตือนเมื่อผู้แจ้งซ่อมหรือแอดมินยกเลิกคำขอ</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Repair LINE OA Configuration */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <MessageSquare className="w-4 h-4 text-orange-500" />
                {lang === "en" ? "Repair LINE OA Configuration" : "ตั้งค่า LINE OA สำหรับระบบแจ้งซ่อม (แยกจากระบบลา)"}
              </h4>
              <p className="text-[11px] text-slate-400">
                {lang === "en"
                  ? "Configure a separate LINE OA channel for repair notifications. If left blank, the system will fall back to the shared leave LINE OA."
                  : "ตั้งค่า LINE OA แยกตัวสำหรับแจ้งซ่อมโดยเฉพาะ หากไม่กรอก ระบบจะใช้ LINE OA ตัวเดียวกับระบบลา"}
              </p>

              <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800/80 transition text-xs">
                <input
                  type="checkbox"
                  checked={enableRepairLine}
                  onChange={e => setEnableRepairLine(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-500/20 w-4 h-4"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">เปิดใช้งานการแจ้งเตือน LINE สำหรับระบบซ่อม</span>
              </label>

              <div className="space-y-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === "en" ? "LINE Channel Access Token (Repair)" : "LINE Channel Access Token (ระบบซ่อม)"}
                  </label>
                  <input
                    type="password"
                    value={repairLineToken}
                    onChange={e => setRepairLineToken(e.target.value)}
                    placeholder={lang === "en" ? "Paste repair LINE OA token here..." : "วาง Token ของ LINE OA ระบบซ่อมที่นี่..."}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-xs text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === "en" ? "LINE Target Group/User ID (Repair)" : "LINE Group/User ID เป้าหมาย (ระบบซ่อม)"}
                  </label>
                  <input
                    type="text"
                    value={repairLineGroupId}
                    onChange={e => setRepairLineGroupId(e.target.value)}
                    placeholder={lang === "en" ? "Paste repair LINE group/user ID here..." : "วาง Group ID หรือ User ID เป้าหมายสำหรับระบบซ่อม..."}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-xs text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  💡 {lang === "en"
                    ? "If both fields are left blank, repair notifications will be sent through the shared Leave LINE OA."
                    : "หากไม่กรอกทั้งสองช่อง ระบบจะส่งแจ้งเตือนการซ่อมผ่าน LINE OA ตัวเดียวกับระบบการลาแทนอัตโนมัติ"}
                </p>
              </div>
            </div>

            {/* Photo Limits */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <ImageIcon className="w-4 h-4 text-orange-500" />
                {lang === "en" ? "Photo Upload Limits" : "ขีดจำกัดจำนวนรูปภาพและไฟล์"}
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-555 text-slate-500 dark:text-slate-400">{lang === "en" ? "BEFORE Photos Limit" : "รูปก่อนซ่อมสูงสุด (รูป)"}</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={limitBefore}
                    onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairPhotoLimitBefore: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-205 border-slate-200 bg-white dark:bg-slate-950 text-xs text-slate-950 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lang === "en" ? "AFTER Photos Limit" : "รูปหลังซ่อมสูงสุด (รูป)"}</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={limitAfter}
                    onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairPhotoLimitAfter: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-xs text-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lang === "en" ? "Max File Size (MB)" : "ขนาดไฟล์สูงสุดต่อรูป (MB)"}</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxFileSize}
                  onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairMaxFileSizeMb: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-xs text-slate-950 dark:text-white"
                />
              </div>
            </div>

            {/* SLA Warning */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Clock className="w-4 h-4 text-orange-500" />
                {lang === "en" ? "SLA Parameters" : "เกณฑ์ความเร็วในการซ่อม (SLA)"}
              </h4>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === "en" ? "SLA Warning Threshold (Hours)" : "ชั่วโมงเตือนก่อนล่วงหน้า (ชั่วโมง)"}
                </label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={slaHours}
                  onChange={e => setRolePermissions((prev: any) => ({ ...prev, repairSlaWarningHours: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-950 text-xs text-slate-950 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                  {lang === "en"
                    ? "Calculates warning status when the expected finish time is within this many hours."
                    : "ระบบจะแจ้งสถานะเตือนใกล้ล่าช้าหากเหลือเวลาน้อยกว่าค่าที่ระบุนี้"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    );
  };

  const renderSubsystemsSection = () => {
    // Each subsystem: auto-save toggle + optional "ตั้งค่า" navigation
    type SubDef = {
      id: string;
      icon: React.ReactNode;
      activeColor: string;
      activeBg: string;
      activeBorder: string;
      toggleColor: string;
      title: string;
      desc: string;
      core?: boolean;
      enabled: boolean;
      saveKey?: "enableAttendance" | "enableDocument" | "enableRepair";
      settingsId?: string;
    };

    const SUBS: SubDef[] = [
      {
        id: "leave",
        icon: <CalendarDays className="w-5 h-5" />,
        activeColor: "text-emerald-600 dark:text-emerald-400",
        activeBg: "bg-emerald-100 dark:bg-emerald-950/30",
        activeBorder: "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800",
        toggleColor: "",
        title: lang === "en" ? "Leave System" : "ระบบการลา",
        desc: lang === "en" ? "Core leave management module" : "ระบบบริหารจัดการการลาหลัก",
        core: true,
        enabled: true,
      },
      {
        id: "attendance",
        icon: <Clock className="w-5 h-5" />,
        activeColor: "text-indigo-600 dark:text-indigo-400",
        activeBg: "bg-indigo-100 dark:bg-indigo-950/40",
        activeBorder: "bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-800",
        toggleColor: "bg-indigo-600",
        title: lang === "en" ? "Attendance System" : "ระบบลงชื่อเข้างาน",
        desc: lang === "en" ? "Shift times, geofence, face scan" : "บันทึกเวลาปฏิบัติงานด้วย GPS, Geofence, Face Scan",
        enabled: enableAttendance,
        saveKey: "enableAttendance",
        settingsId: "attendance-settings",
      },
      {
        id: "document",
        icon: <ClipboardList className="w-5 h-5" />,
        activeColor: "text-orange-600 dark:text-orange-400",
        activeBg: "bg-orange-100 dark:bg-orange-950/40",
        activeBorder: "bg-orange-50/40 dark:bg-orange-950/10 border-orange-200 dark:border-orange-800",
        toggleColor: "bg-orange-500",
        title: lang === "en" ? "Document System" : "ระบบจัดการเอกสาร",
        desc: lang === "en" ? "Incoming/outgoing documents tracking" : "บันทึกและส่งต่อหนังสือราชการรับ-ส่ง",
        enabled: enableDocument,
        saveKey: "enableDocument",
        settingsId: "document-settings",
      },
      {
        id: "repair",
        icon: <Wrench className="w-5 h-5" />,
        activeColor: "text-amber-600 dark:text-amber-400",
        activeBg: "bg-amber-100 dark:bg-amber-950/40",
        activeBorder: "bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800",
        toggleColor: "bg-amber-500",
        title: lang === "en" ? "Repair System" : "ระบบแจ้งซ่อม",
        desc: lang === "en" ? "Equipment/building repair requests" : "แจ้งปัญหาวัสดุครุภัณฑ์และติดตามสถานะงานซ่อม",
        enabled: enableRepair,
        saveKey: "enableRepair",
        settingsId: "repair-settings",
      },
    ];

    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-800">
        <SectionHeader title={sectionTitles.subsystems} />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {lang === "en"
            ? "Toggle subsystems on or off. Click 'Settings ›' to configure each module."
            : "เปิด/ปิดการใช้งานระบบย่อย กดปุ่ม 'ตั้งค่า ›' เพื่อเข้าตั้งค่าของแต่ละระบบ"}
        </p>

        <div className="space-y-3">
          {SUBS.map((sys) => (
            <div
              key={sys.id}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                sys.enabled
                  ? sys.activeBorder
                  : "bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800"
              }`}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  sys.enabled
                    ? `${sys.activeBg} ${sys.activeColor}`
                    : "bg-gray-50 dark:bg-gray-800 text-gray-400"
                }`}
              >
                {sys.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{sys.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sys.desc}</p>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2 shrink-0">
                {sys.core ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-xs font-bold">
                    {lang === "en" ? "Core" : "ระบบหลัก"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => saveSubsystem(sys.saveKey!, !sys.enabled)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                      sys.enabled ? sys.toggleColor : "bg-gray-200 dark:bg-gray-700"
                    }`}
                    title={sys.enabled ? (lang === "en" ? "Disable" : "ปิดใช้งาน") : (lang === "en" ? "Enable" : "เปิดใช้งาน")}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        sys.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                )}

                {sys.settingsId && (
                  <button
                    type="button"
                    onClick={() => setActiveSection(sys.settingsId!)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {lang === "en" ? "Settings" : "ตั้งค่า"}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };


  // --- Section renderer map ---

  const renderActiveSection = () => {

    switch (activeSection) {

      case "attendance-settings": return renderAttendanceSettingsSection();

      case "document-settings": return renderDocumentSettingsSection();

      case "school": return renderSchoolSection();

      case "approval": return renderApprovalSection();

      case "leave-rules": return renderLeaveRulesSection();

      case "line": return renderLineSection();

      case "font": return renderFontSection();

      case "permissions": return renderPermissionsSection();

      case "backup": return renderBackupSection();

      case "holidays": return renderHolidaysSection();

      case "manual-import": return renderManualImportSection();

      case "impersonate": return renderImpersonateSection();

      case "footer": return renderFooterSection();

      case "subsystems": return renderSubsystemsSection();

      case "repair-settings": return renderRepairSettingsSection();

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

      {/* Searchable Reference overlay modal */}

      {isRefModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">

          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-800 overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Modal Header */}

            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">

              <div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white">

                  {lang === "en" ? "Import Reference Codes" : "รหัสอ้างอิงสำหรับนำเข้าข้อมูล"}

                </h3>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">

                  {lang === "en"

                    ? "Use these exact codes in your CSV/Excel template columns."

                  : "ใช้รหัสเหล่านี้เป็นหัวตารางในไฟล์ CSV/Excel เพื่อให้นำเข้าข้อมูลได้ถูกต้อง"}

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

                {lang === "en" ? "Users (IDs)" : "รายชื่อบุคลากร (ID)"}

              </button>

              <button

                onClick={() => setRefModalTab("types")}

                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${

                  refModalTab === "types"

                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"

                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"

                }`}

              >

                {lang === "en" ? "Leave Types" : "ประเภทการลา"}

              </button>

              <button

                onClick={() => setRefModalTab("statuses")}

                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${

                  refModalTab === "statuses"

                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"

                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"

                }`}

              >

                {lang === "en" ? "Leave Statuses" : "สถานะการลา"}

              </button>

            </div>

            {/* Search Bar (Only for Users tab) */}

            {refModalTab === "users" && (

              <div className="p-4 border-b border-gray-100 dark:border-gray-800">

                <input

                  type="text"

                  placeholder={lang === "en" ? "Search by Name, Username or Position..." : "ค้นหาชื่อ, Username หรือตำแหน่ง..."}

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

                      {lang === "en" ? "Loading users..." : "กำลังโหลดรายชื่อ..."}

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

                            {lang === "en" ? "No users match your search." : "ไม่พบผู้ใช้งานที่คุณค้นหา"}

                          </div>

                        );

                      }

                      return (

                        <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">

                          {filtered.map((u: any, idx: number) => (

                            <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all">

                              <div>

                                <span className="font-bold text-gray-900 dark:text-white">{u.name}</span>

                                <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Position (ตำแหน่ง)</span>

                              </div>

                              <div className="flex items-center gap-1.5">

                                <span className="text-[10px] text-gray-400 dark:text-gray-500">ID:</span>

                                <span 

                                  onClick={(e) => {

                                    navigator.clipboard.writeText(u.username);

                                    const target = e.target as HTMLElement;

                                    const origText = target.innerText;

                                    target.innerText = lang === "en" ? "Copied!" : "คัดลอกแล้ว!";

                                    setTimeout(() => { target.innerText = origText; }, 1000);

                                  }}

                                  className="font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30 cursor-pointer select-all select-none active:scale-95 transition-all"

                                  title="คลิกเพื่อคัดลอก"

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

                          <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">โควตา: {c.maxDaysPerYear} วัน/ปี</span>

                        </div>

                        <div className="flex items-center gap-1.5">

                          <span className="text-[10px] text-gray-400 dark:text-gray-500">Code:</span>

                          <span 

                            onClick={(e) => {

                              navigator.clipboard.writeText(c.type);

                              const target = e.target as HTMLElement;

                              const origText = target.innerText;

                              target.innerText = lang === "en" ? "Copied!" : "คัดลอกแล้ว!";

                              setTimeout(() => { target.innerText = origText; }, 1000);

                            }}

                            className="font-mono bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 px-2 py-1 rounded-lg border border-purple-100/50 dark:border-purple-900/30 cursor-pointer select-none active:scale-95 transition-all"

                            title="คลิกเพื่อคัดลอก"

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

                      { code: "APPROVED", labelTh: "อนุมัติเรียบร้อย", labelEn: "Approved (Completed)" },

                      { code: "PENDING_HEAD", labelTh: "รอหัวหน้ากลุ่มสาระ/ผู้ตรวจสอบ", labelEn: "Pending Inspector Approval" },

                      { code: "PENDING_EXEC", labelTh: "รอผู้อนุมัติ", labelEn: "Pending Final Executive Approval" },

                      { code: "REJECTED", labelTh: "ไม่อนุมัติ/ปฏิเสธ", labelEn: "Rejected" },

                      { code: "CANCELLED", labelTh: "ยกลิกใบลา", labelEn: "Cancelled" },

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

                              target.innerText = lang === "en" ? "Copied!" : "คัดลอกแล้ว!";

                              setTimeout(() => { target.innerText = origText; }, 1000);

                            }}

                            className="font-mono bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-1 rounded-lg border border-blue-100/50 dark:border-blue-900/30 cursor-pointer select-none active:scale-95 transition-all"

                            title="คลิกเพื่อคัดลอก"

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

                {lang === "en" ? "Close" : "ปิดหน้าต่าง"}

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

      {/* Clear Data Modal */}

      {isClearDataModalOpen && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">

          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-red-100 dark:border-red-950/40">

            <div className="p-6 text-center">

              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">

                <ShieldAlert className="w-6 h-6" />

              </div>

              <h3 className="text-lg font-bold text-gray-950 dark:text-white mb-2">

                {lang === "en" ? "Clear All Leave Data" : "ยืนยันการล้างข้อมูลการลาทั้งหมด"}

              </h3>

              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-6">

                {lang === "en"

                  ? "Warning: This action will permanently delete all leave history records from the database. This cannot be undone."

                  : "คำเตือนร้ายแรง: ข้อมูลประวัติการลาทั้งหมดในฐานข้อมูลจะถูกลบถาวรและไม่สามารถกู้คืนกลับมาได้"}

              </p>

              <div className="space-y-4">

                <div className="text-left">

                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">

                    {lang === "en" ? "Type CONFIRM to proceed" : "กรุณาพิมพ์ CONFIRM เพื่อยืนยันการลบ"}

                  </label>

                  <input

                    type="text"

                    value={confirmTextInput}

                    onChange={(e) => setConfirmTextInput(e.target.value)}

                    placeholder="CONFIRM"

                    className="w-full h-11 px-4 rounded-xl border border-red-200 focus:border-red-500 focus:ring-red-500/20 dark:border-red-900/50 bg-white dark:bg-gray-800 text-sm font-mono tracking-widest text-center transition-all outline-none"

                  />

                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">

                  <button

                    type="button"

                    onClick={() => setIsClearDataModalOpen(false)}

                    className="h-11 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-gray-600 dark:text-gray-300 font-semibold text-sm transition-all border border-gray-100 dark:border-gray-800"

                  >

                    {lang === "en" ? "Cancel" : "ยกเลิก"}

                  </button>

                  <button

                    type="button"

                    onClick={handleExecuteClearData}

                    disabled={confirmTextInput !== "CONFIRM" || isClearing}

                    className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-md shadow-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"

                  >

                    {isClearing ? (lang === "en" ? "Clearing..." : "กำลังลบ...") : (lang === "en" ? "Delete Permanently" : "ลบข้อมูลถาวร")}

                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

// ──────────────────────────────────────────────────────────────────────
// Helper component for pattern preview
// ──────────────────────────────────────────────────────────────────────
function renderPatternPreview(
  prefix: string,
  padding: number,
  useThai: boolean,
  yearFormat: string
) {
  const dummySeq = 124;
  const dummyYear = yearFormat === "TH_BE" ? 2569 : 2026;
  return formatDocNumber(
    "[PREFIX] [SEQ]/[YEAR]",
    prefix,
    dummySeq,
    dummyYear,
    padding,
    useThai
  );
}

// ──────────────────────────────────────────────────────────────────────
// TAB 1: MEMO SECTIONS
// ──────────────────────────────────────────────────────────────────────
function DocMemoSectionsTab({
  sections,
  onRefresh,
  showToast,
  lang,
}: {
  sections: DocMemoSection[];
  onRefresh: () => Promise<void>;
  showToast: (m: string, t?: "success" | "error") => void;
  lang: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    code: "", 
    isActive: true, 
    color: "#6366f1", 
    icon: "Folder", 
    sortOrder: 0 
  });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setForm({ 
      name: "", 
      code: "", 
      isActive: true, 
      color: "#6366f1", 
      icon: "Folder", 
      sortOrder: 0 
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (s: DocMemoSection) => {
    setEditId(s.id);
    setForm({ 
      name: s.name, 
      code: s.code, 
      isActive: s.isActive,
      color: s.color || "#6366f1",
      icon: s.icon || "Folder",
      sortOrder: s.sortOrder || 0
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      showToast("กรุณากรอกชื่อและรหัส", "error");
      return;
    }
    setSaving(true);
    try {
      await upsertMemoSection(
        editId, 
        form.name.trim(), 
        form.code.trim(), 
        form.isActive,
        form.color,
        form.icon,
        Number(form.sortOrder)
      );
      showToast(editId ? "แก้ไขสำเร็จ" : "เพิ่มสำเร็จ", "success");
      resetForm();
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ต้องการลบงานย่อยนี้หรือไม่? (DocumentConfig ที่เชื่อมอยู่จะถูกลบด้วย)")) return;
    try {
      await deleteMemoSection(id);
      showToast("ลบสำเร็จ", "success");
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "ลบไม่สำเร็จ", "error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 pt-2"
    >
      {/* Add Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-650 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          เพิ่มงานย่อย
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editId ? "แก้ไขงานย่อย" : "เพิ่มงานย่อยใหม่"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    ชื่องานย่อย
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="เช่น ฝ่ายวิชาการ"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    รหัส (Code)
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                    placeholder="เช่น ACAD"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono uppercase focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    ลำดับความสำคัญ (Sort Order)
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })
                    }
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Color & Icon Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                    สีประจำหมวดเอกสาร
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "#6366f1", // Indigo
                      "#3b82f6", // Blue
                      "#06b6d4", // Cyan
                      "#10b981", // Emerald
                      "#f59e0b", // Amber
                      "#ef4444", // Red
                      "#ec4899", // Pink
                      "#8b5cf6", // Violet
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        style={{ backgroundColor: c }}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          form.color === c ? "border-slate-900 dark:border-white scale-110 shadow-md" : "border-transparent hover:scale-105"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                    ไอคอน
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Folder", "GraduationCap", "Banknote", "Users", "Briefcase", "FileText", "BookOpen", "Settings"
                    ].map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setForm({ ...form, icon: iconName })}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          form.icon === iconName 
                            ? "bg-purple-600 border-purple-650 text-white shadow-sm" 
                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {iconName === "Folder" && "📁 แฟ้ม"}
                        {iconName === "GraduationCap" && "🎓 วิชาการ"}
                        {iconName === "Banknote" && "💰 งบประมาณ"}
                        {iconName === "Users" && "👥 บุคคล"}
                        {iconName === "Briefcase" && "💼 ทั่วไป"}
                        {iconName === "FileText" && "📄 สารบรรณ"}
                        {iconName === "BookOpen" && "📖 ห้องสมุด"}
                        {iconName === "Settings" && "⚙️ แผนงาน"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-305"
                >
                  {form.isActive ? (
                    <ToggleRight className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                  <span
                    className={
                      form.isActive
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-slate-400 font-medium"
                    }
                  >
                    {form.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  ยกเลิก
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-705 overflow-hidden shadow-sm">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">ยังไม่มีงานย่อย</p>
            <p className="text-xs mt-1">กดปุ่ม &quot;เพิ่มงานย่อย&quot; เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    รหัส
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    ชื่องานย่อย
                  </th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/55 transition-colors ${
                      !s.isActive ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-6 py-3.5">
                      <span 
                        style={{ backgroundColor: `${s.color || "#6366f1"}15`, color: s.color || "#6366f1" }}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono"
                      >
                        {s.code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span 
                          style={{ color: s.color || "#6366f1" }} 
                          className="text-xs"
                        >
                          {s.icon === "GraduationCap" && "🎓"}
                          {s.icon === "Banknote" && "💰"}
                          {s.icon === "Users" && "👥"}
                          {s.icon === "Briefcase" && "💼"}
                          {s.icon === "FileText" && "📄"}
                          {s.icon === "BookOpen" && "📖"}
                          {s.icon === "Settings" && "⚙️"}
                          {(s.icon === "Folder" || !s.icon) && "📁"}
                        </span>
                        <span>{s.name}</span>
                        {s.sortOrder !== undefined && s.sortOrder > 0 && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            (ลำดับ: {s.sortOrder})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          s.isActive
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.isActive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {s.isActive ? "เปิดใช้งาน" : "ปิด"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(s)}
                          className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// TAB 2: PATTERN BUILDER
// ──────────────────────────────────────────────────────────────────────
function DocPatternBuilderTab({
  configs,
  onRefresh,
  showToast,
  lang,
}: {
  configs: DocConfig[];
  onRefresh: () => Promise<void>;
  showToast: (m: string, t?: "success" | "error") => void;
  lang: string;
}) {
  const [editingConfig, setEditingConfig] = useState<DocConfig | null>(null);
  const [localPrefix, setLocalPrefix] = useState("");
  const [localPadding, setLocalPadding] = useState(1);
  const [localUseThai, setLocalUseThai] = useState(true);
  const [localYearFormat, setLocalYearFormat] = useState("TH_BE");
  const [saving, setSaving] = useState(false);

  const startEdit = (c: DocConfig) => {
    setEditingConfig(c);
    setLocalPrefix(c.prefix);
    setLocalPadding(c.paddingDigits);
    setLocalUseThai(c.useThaiNumerals);
    setLocalYearFormat(c.yearFormat);
  };

  const cancelEdit = () => setEditingConfig(null);

  const handleSave = async () => {
    if (!editingConfig) return;
    setSaving(true);
    try {
      await saveDocumentConfig(
        editingConfig.id,
        localPrefix,
        localUseThai,
        localPadding,
        localYearFormat
      );
      showToast("บันทึกรูปแบบเลขสำเร็จ", "success");
      cancelEdit();
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "บันทึกไม่สำเร็จ", "error");
    } finally {
      setSaving(false);
    }
  };

  const livePreview = editingConfig
    ? renderPatternPreview(localPrefix, localPadding, localUseThai, localYearFormat)
    : "";

  const docTypeLabel = (dt: string) => {
    switch (dt) {
      case "MEMO":
        return "บันทึกข้อความ";
      case "COMMAND":
        return "คำสั่ง";
      case "OUTGOING":
        return "หนังสือส่ง";
      default:
        return dt;
    }
  };

  const docTypeColor = (dt: string) => {
    switch (dt) {
      case "MEMO":
        return "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20";
      case "COMMAND":
        return "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20";
      case "OUTGOING":
        return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
      default:
        return "bg-slate-50 dark:bg-slate-700 text-slate-655 dark:text-slate-450 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 font-sans"
    >
      {configs.length === 0 ? (
        <div className="col-span-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-16 flex flex-col items-center justify-center text-slate-400 shadow-sm">
          <Hash className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">ยังไม่มีรูปแบบเลขเอกสาร</p>
          <p className="text-xs mt-1">
            เพิ่มงานย่อยในแท็บแรกเพื่อสร้างรูปแบบเลขอัตโนมัติ
          </p>
        </div>
      ) : (
        configs.map((c) => {
          const isEditing = editingConfig?.id === c.id;
          const preview = renderPatternPreview(
            c.prefix,
            c.paddingDigits,
            c.useThaiNumerals,
            c.yearFormat
          );

          return (
            <motion.div
              key={c.id}
              layout
              className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm transition-all duration-200 ${
                isEditing
                  ? "border-purple-300 dark:border-purple-500/50 ring-2 ring-purple-500/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${docTypeColor(
                      c.docType
                    )}`}
                  >
                    {docTypeLabel(c.docType)}
                  </span>
                  {c.memoSection && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-305" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {c.memoSection.name}
                      </span>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    title="แก้ไข"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Card Body */}
              <div className="p-5">
                {isEditing ? (
                  <div className="space-y-4">
                    {/* Live Preview */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/5 dark:to-indigo-500/5 rounded-xl p-4 border border-purple-100 dark:border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                          ตัวอย่างเลขเอกสาร
                        </span>
                      </div>
                      <p className="text-xl font-bold text-purple-700 dark:text-purple-300 font-mono tracking-wide">
                        {livePreview}
                      </p>
                      <p className="text-[11px] text-purple-400 mt-1">
                        ลำดับตัวอย่าง: 124
                      </p>
                    </div>

                    {/* Fields */}
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        คำนำหน้า (Prefix)
                      </label>
                      <input
                        type="text"
                        value={localPrefix}
                        onChange={(e) => setLocalPrefix(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-555 text-slate-500 dark:text-slate-400 mb-1 block">
                          หลักเลข (Padding)
                        </label>
                        <select
                          value={localPadding}
                          onChange={(e) =>
                            setLocalPadding(Number(e.target.value))
                          }
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 cursor-pointer text-gray-900 dark:text-white"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} หลัก (เช่น {String(1).padStart(n, "0")})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-555 text-slate-500 dark:text-slate-400 mb-1 block">
                          รูปแบบปี
                        </label>
                        <select
                          value={localYearFormat}
                          onChange={(e) => setLocalYearFormat(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 cursor-pointer text-gray-900 dark:text-white"
                        >
                          <option value="TH_BE">พ.ศ. (2569)</option>
                          <option value="AD">ค.ศ. (2026)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setLocalUseThai(!localUseThai)}
                        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-305"
                      >
                        {localUseThai ? (
                          <ToggleRight className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                        )}
                        <span
                          className={
                            localUseThai
                              ? "text-emerald-600 dark:text-emerald-400 font-medium"
                              : "text-slate-400 font-medium"
                          }
                        >
                          {localUseThai
                            ? "ใช้เลขไทย (๑, ๒, ๓...)"
                            : "ใช้เลขอารบิก (1, 2, 3...)"}
                        </span>
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-650 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Preview */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          ตัวอย่าง
                        </span>
                      </div>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-200 font-mono tracking-wide">
                        {preview}
                      </p>
                    </div>

                    {/* Config Details */}
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        Prefix: <strong className="ml-1">{c.prefix}</strong>
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        Padding: <strong className="ml-1">{c.paddingDigits}</strong>
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        {c.useThaiNumerals ? "เลขไทย" : "เลขอารบิก"}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        {c.yearFormat === "TH_BE" ? "พ.ศ." : "ค.ศ."}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-xs text-purple-600 dark:text-purple-400 font-semibold">
                        ลำดับปัจจุบัน: {c.currentSeq}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })
      )}
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// TAB 3: SIGNEE PRESETS
// ──────────────────────────────────────────────────────────────────────
function DocSigneesTab({
  signees,
  onRefresh,
  showToast,
  lang,
}: {
  signees: DocSigneePreset[];
  onRefresh: () => Promise<void>;
  showToast: (m: string, t?: "success" | "error") => void;
  lang: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", position: "", isCommon: true });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setForm({ name: "", position: "", isCommon: true });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (s: DocSigneePreset) => {
    setEditId(s.id);
    setForm({ name: s.name, position: s.position, isCommon: s.isCommon });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.position.trim()) {
      showToast("กรุณากรอกชื่อและตำแหน่ง", "error");
      return;
    }
    setSaving(true);
    try {
      await upsertSigneePreset(
        editId,
        form.name.trim(),
        form.position.trim(),
        form.isCommon
      );
      showToast(editId ? "แก้ไขสำเร็จ" : "เพิ่มสำเร็จ", "success");
      resetForm();
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ต้องการลบผู้ลงนามนี้หรือไม่?")) return;
    try {
      await deleteSigneePreset(id);
      showToast("ลบสำเร็จ", "success");
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "ลบไม่สำเร็จ", "error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 pt-2 font-sans col-span-full"
    >
      {/* Add Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-650 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้ลงนาม
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editId ? "แก้ไขผู้ลงนาม" : "เพิ่มผู้ลงนามใหม่"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    ชื่อ - นามสกุล
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="เช่น นายประธาน สมเกียรติ"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    ตำแหน่ง
                  </label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) =>
                      setForm({ ...form, position: e.target.value })
                    }
                    placeholder="เช่น ผู้อำนวยการโรงเรียน"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isCommon: !form.isCommon })}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-305"
                >
                  {form.isCommon ? (
                    <ToggleRight className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                  <span
                    className={
                      form.isCommon
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-slate-400 font-medium"
                    }
                  >
                    {form.isCommon ? "ใช้บ่อย (แสดงทุกครั้ง)" : "ไม่ใช้บ่อย"}
                  </span>
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer font-bold"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-655 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors cursor-pointer font-bold"
                >
                  <X className="w-4 h-4" />
                  ยกเลิก
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards Grid */}
      {signees.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-16 flex flex-col items-center justify-center text-slate-400 shadow-sm col-span-full">
          <UserCheck className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">ยังไม่มีรายชื่อผู้ลงนาม</p>
          <p className="text-xs mt-1">
            กดปุ่ม &quot;เพิ่มผู้ลงนาม&quot; เพื่อเริ่มต้น
          </p>
        </div>
      ) : (
        signees.map((s) => (
          <div
            key={s.id}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-650 transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {s.name.charAt(0)}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleEdit(s)}
                  className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  title="แก้ไข"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="ลบ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {s.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {s.position}
            </p>
            {s.isCommon && (
              <span className="inline-flex items-center gap-1 mt-3 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                <Check className="w-3 h-3" />
                ใช้บ่อย
              </span>
            )}
          </div>
        ))
      )}
    </motion.div>
  );
}

