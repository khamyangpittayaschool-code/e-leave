"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  RefreshCw,
  Plus,
  Calendar,
  ArrowRight,
  ArrowLeft,
  X,
  AlertTriangle,
  Zap
} from "lucide-react";

import {
  getDashboardStats,
  getDocumentsList,
  cancelDoc,
  quickIssueDoc
} from "@/app/actions/document";
import { getMemoSections } from "@/app/actions/document-settings";
import { 
  createIncomingDoc, 
  getIncomingDocsList, 
  scrapeAMSSDocument,
  getAMSSCredentials,
  syncAMSSDocumentsAutomatically
} from "@/app/actions/incoming";
import { getSimpleUsersList } from "@/app/actions/settings";
import { useSession } from "@/lib/auth-client";
import { useToast } from "@/components/toast-provider";
import AmssImportModal from "@/components/AmssImportModal";
import AmssCredentialsModal from "./_components/amss-credentials-modal";
import CertGenerator from "./_components/cert-generator";

// Import atomic components
import DocumentStats from "./_components/document-stats";
import OutboundForm from "./_components/forms/outbound-form";
import InboundForm from "./_components/forms/inbound-form";
import DocumentTable from "./_components/document-table";
import { WidgetContainer } from "./_components/widget-container";
import { GuardedAction } from "./_components/guarded-action";
import RecentActivityTimeline from "./_components/recent-activity";

// ── Animation variants ──────────────────────────────────────────────
const containerVariants: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants: any = {
  hidden: { y: 12, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 350, damping: 26 },
  },
};

type MemoSection = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  color: string;
  icon: string;
  sortOrder: number;
};

type DocumentRecord = {
  id: string;
  docType: string;
  docNo: string | null;
  seqNo: number | null;
  year: number;
  title: string;
  to: string;
  origin: string;
  date: Date;
  status: string;
  requester?: string | null;
  department?: string | null;
  memoSectionId?: string | null;
  memoSection?: MemoSection | null;
};

type IncomingDoc = {
  id: string;
  receiveNo: string;
  receiveDate: Date;
  senderOrg: string;
  docRefNo: string | null;
  title: string;
  urgencyLevel: string;
  amssLink: string | null;
  attachmentUrl: string | null;
  status: string;
  memoSection?: MemoSection | null;
};

export default function DocumentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast: originalShowToast } = useToast();
  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    originalShowToast(type, msg);
  }, [originalShowToast]);

  const [activeTab, setActiveTab] = useState<"outbound" | "inbound">("outbound");
  const [view, setView] = useState<"menu" | "outbound" | "inbound" | "cert">("menu");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() + 543);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("");
  const [selectedYearTable, setSelectedYearTable] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  // Quick Request Form states
  const [quickDocType, setQuickDocType] = useState("MEMO");
  const [quickMemoSectionId, setQuickMemoSectionId] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTo, setQuickTo] = useState("ผู้อำนวยการโรงเรียน");
  const [quickOrigin, setQuickOrigin] = useState("");
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split("T")[0]);
  const [isQuickIssuing, setIsQuickIssuing] = useState(false);
  const [quickIssuedResult, setQuickIssuedResult] = useState<any | null>(null);
  const [copiedQuickNo, setCopiedQuickNo] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<MemoSection[]>([]);
  const [outboundDocs, setOutboundDocs] = useState<DocumentRecord[]>([]);
  const [inboundDocs, setInboundDocs] = useState<IncomingDoc[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [outboundStats, setOutboundStats] = useState({ DRAFT: 0, ISSUED: 0, PRINTED: 0, CANCELLED: 0 });

  const filteredOutboundDocs = useMemo(() => {
    return outboundDocs.filter((d) => (new Date(d.date).getFullYear() + 543) === selectedYear);
  }, [outboundDocs, selectedYear]);

  const filteredInboundDocs = useMemo(() => {
    return inboundDocs.filter((d) => (new Date(d.receiveDate).getFullYear() + 543) === selectedYear);
  }, [inboundDocs, selectedYear]);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAmssImportModal, setShowAmssImportModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [docToCancel, setDocToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // AMSS Sync states
  const [showAmssCredentialsModal, setShowAmssCredentialsModal] = useState(false);
  const [amssSyncing, setAmssSyncing] = useState(false);
  const [amssCredsExist, setAmssCredsExist] = useState<boolean | null>(null); // null = checking
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const [issuing, setIssuing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [savingReceive, setSavingReceive] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [secs, outStatsRes, outListRes, inList, staff, amssCreds] = await Promise.all([
        getMemoSections(),
        getDashboardStats(),
        getDocumentsList({}),
        getIncomingDocsList({}),
        getSimpleUsersList(),
        getAMSSCredentials()
      ]);
      setSections(secs as MemoSection[]);
      if (outStatsRes.success) {
        setOutboundStats(outStatsRes.data);
      }
      if (outListRes.success) {
        setOutboundDocs(outListRes.data as any[]);
      }
      setInboundDocs(inList as any[]);
      setUsers(staff);

      if (amssCreds.success && amssCreds.data) {
        setAmssCredsExist(true);
        setLastSyncAt(amssCreds.data.lastSyncAt ? new Date(amssCreds.data.lastSyncAt) : null);
      } else {
        setAmssCredsExist(false);
        setLastSyncAt(null);
      }
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Scrape AMSS++ link
  const handleFormScrape = async (url: string) => {
    setScraping(true);
    try {
      const res = await scrapeAMSSDocument(url);
      if (res.success) {
        showToast("ดึงข้อมูลหนังสือจาก AMSS++ สำเร็จ!", "success");
        return res.data;
      } else {
        showToast(res.error || "ดึงข้อมูลล้มเหลว กรุณากรอกเอง", "error");
        return null;
      }
    } catch (err: any) {
      showToast(err.message || "ดึงข้อมูลล้มเหลว กรุณากรอกเอง", "error");
      return null;
    } finally {
      setScraping(false);
    }
  };

  // Quick Issue Submit
  const handleFormIssue = async (data: {
    docType: string;
    memoSectionId?: string;
    origin: string;
    to: string;
    title: string;
    requester: string;
    date: string;
    department?: string;
  }) => {
    setIssuing(true);
    try {
      const res = await quickIssueDoc({
        docType: data.docType,
        memoSectionId: data.memoSectionId,
        title: data.title,
        to: data.to,
        origin: data.origin,
        requester: data.requester,
        department: data.department || "",
        date: data.date
      });
      if (res.success) {
        showToast("ออกเลขเอกสารสำเร็จ: " + res.data.docNo, "success");
        setShowIssueModal(false);
        await loadData();
      } else {
        showToast(res.error || "ออกเลขเอกสารล้มเหลว", "error");
      }
    } catch (err: any) {
      showToast(err.message || "ออกเลขเอกสารล้มเหลว", "error");
    } finally {
      setIssuing(false);
    }
  };

  // Register Receive Submit
  const handleFormRegisterReceive = async (data: {
    senderOrg: string;
    docRefNo?: string;
    title: string;
    urgencyLevel: string;
    amssLink?: string;
    attachmentUrl?: string;
    memoSectionId?: string;
    note?: string;
    firstAssigneeId?: string;
    amssOriginId?: string | null;
  }) => {
    setSavingReceive(true);
    try {
      const res = await createIncomingDoc(data);
      if (res.success) {
        const doc = res.data;
        showToast("ลงทะเบียนรับหนังสือสำเร็จ: " + doc.receiveNo, "success");
        setShowReceiveModal(false);
        await loadData();
      } else {
        showToast(res.error || "ลงทะเบียนไม่สำเร็จ", "error");
      }
    } catch (err: any) {
      showToast(err.message || "ลงทะเบียนไม่สำเร็จ", "error");
    } finally {
      setSavingReceive(false);
    }
  };

  // AMSS++ 1-Click Sync: ดึงข้อมูลอัตโนมัติ
  const handleAmssAutoSync = async () => {
    if (!amssCredsExist) {
      setShowAmssCredentialsModal(true);
      return;
    }

    setAmssSyncing(true);
    try {
      const res = await syncAMSSDocumentsAutomatically();
      if (!res.success) {
        const errMsg = res.error || "เกิดข้อผิดพลาดในการดึงข้อมูลจาก AMSS++";
        if (errMsg.includes("CAPTCHA") || errMsg.includes("Cloudflare")) {
          showToast(errMsg + " — กรุณาใช้วิธี 'นำเข้าแบบวางโค้ด' แทน", "error");
        } else {
          showToast(errMsg, "error");
        }
      } else {
        const { importedCount, duplicatesCount } = res.data;
        if (importedCount === 0 && duplicatesCount > 0) {
          showToast(`ข้อมูลเป็นปัจจุบันแล้ว (ไม่มีหนังสือใหม่ ข้ามข้อมูลซ้ำ ${duplicatesCount} เรื่อง)`, "success");
        } else {
          showToast(
            `ดึงข้อมูลสำเร็จ! นำเข้าหนังสือใหม่ ${importedCount} เรื่อง` +
            (duplicatesCount > 0 ? ` (ข้ามข้อมูลซ้ำ ${duplicatesCount} เรื่อง)` : ""),
            "success"
          );
        }
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || "การเชื่อมโยงกับระบบ AMSS++ ล้มเหลว", "error");
    } finally {
      setAmssSyncing(false);
    }
  };

  // Cancel doc logic
  const handleCancelDoc = async () => {
    if (!docToCancel || !cancelReason.trim()) return;
    try {
      const res = await cancelDoc(docToCancel, cancelReason.trim());
      if (res.success) {
        showToast("ยกเลิกเลขทะเบียนส่งสำเร็จ", "success");
        setShowCancelModal(false);
        setDocToCancel(null);
        setCancelReason("");
        await loadData();
      } else {
        showToast(res.error || "ยกเลิกเลขล้มเหลว", "error");
      }
    } catch (err: any) {
      showToast(err.message || "ยกเลิกเลขล้มเหลว", "error");
    }
  };

  // Quick Request presets
  useEffect(() => {
    if (sections.length > 0 && !quickMemoSectionId) {
      setQuickMemoSectionId(sections[0].id);
    }
  }, [sections, quickMemoSectionId]);

  useEffect(() => {
    if (session?.user) {
      setQuickOrigin((session.user as any).subjectGroup || "งานสารบรรณ");
    }
  }, [session]);

  // Click Telemetry Tracking
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const trackId = target.closest("[data-track-id]")?.getAttribute("data-track-id");
      if (trackId) {
        console.log(`📈 [Telemetry Click]: ${trackId}`, {
          timestamp: new Date().toISOString(),
          pathname: window.location.pathname,
          element: target.tagName.toLowerCase()
        });
      }
    };
    
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  const handleQuickIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isQuickIssuing) return;

    if (!quickTitle.trim()) {
      showToast("กรุณากรอกชื่อเรื่องของเอกสาร", "error");
      return;
    }

    setIsQuickIssuing(true);
    try {
      const res = await quickIssueDoc({
        docType: quickDocType,
        memoSectionId: quickDocType === "MEMO" ? quickMemoSectionId : undefined,
        title: quickTitle.trim(),
        to: quickTo.trim(),
        origin: quickOrigin.trim(),
        date: quickDate,
        requester: session?.user?.name || "ไม่ระบุชื่อ",
        department: (session?.user as any)?.subjectGroup || "งานสารบรรณ",
      });

      if (res.success) {
        setQuickIssuedResult(res.data);
        setQuickTitle(""); // Clear title
        showToast("ออกเลขทะเบียนเอกสารสำเร็จ!", "success");
        loadData(); // Refresh list & stats
      } else {
        showToast(res.error || "ออกเลขทะเบียนล้มเหลว", "error");
      }
    } catch (err: any) {
      showToast(err.message || "ออกเลขทะเบียนล้มเหลว", "error");
    } finally {
      setIsQuickIssuing(false);
    }
  };

  if (loading && outboundDocs.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 overflow-hidden">
        <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 p-1 shadow-sm border border-slate-100 dark:border-slate-850 flex items-center justify-center overflow-hidden animate-pulse">
            <ClipboardList className="w-6 h-6 text-orange-500" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">กำลังโหลดระบบงานสารบรรณ...</p>
          <div className="w-32 pt-2 mx-auto">
            <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
              <motion.div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full absolute top-0 bottom-0"
                animate={{ 
                  left: ["-100%", "100%"],
                  width: ["30%", "60%", "30%"]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl mx-auto px-1"
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {view !== "menu" ? (
            <button
              onClick={() => {
                setView("menu");
                setSelectedDocType("");
                setSearchQuery("");
                setSelectedStatus("");
              }}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shrink-0 shadow-sm cursor-pointer animate-in fade-in zoom-in duration-200"
              title="กลับไปหน้าเมนู"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shrink-0 shadow-sm"
              title="กลับบอร์ดหน้าแรก"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </Link>
          )}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <ClipboardList className="w-7 h-7 text-orange-500" />
              ระบบงานสารบรรณ
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              รับ-ส่งหนังสือราชการ บันทึกข้อความ คำสั่ง ประกาศ เกียรติบัตร
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30 text-xs font-bold shadow-sm">
            <Calendar className="w-3.5 h-3.5 ml-1.5" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent border-none text-orange-700 dark:text-orange-400 font-bold outline-none cursor-pointer pr-3 py-1 text-xs"
            >
              <option value={2569}>ปีปฏิทิน พ.ศ. 2569</option>
              <option value={2568}>ปีปฏิทิน พ.ศ. 2568</option>
              <option value={2567}>ปีปฏิทิน พ.ศ. 2567</option>
              <option value={2566}>ปีปฏิทิน พ.ศ. 2566</option>
            </select>
          </div>
          <button
            onClick={loadData}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-655 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* ── AMSS Sync Toolbar (Inbound Only) ────────────────────── */}
      {view === "inbound" && (
        <div className="flex justify-end items-center gap-3 flex-wrap">
          {/* ── Credential Health Badge & Last Sync Time ── */}
          <div className="flex flex-col items-end sm:items-start">
            {amssCredsExist !== null && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                amssCredsExist
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                  : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
              }`}>
                {amssCredsExist ? "🟢 เชื่อมต่อแล้ว" : "🟡 ยังไม่ได้ตั้งค่า"}
              </span>
            )}
            {lastSyncAt && (
              <span className="text-[9px] text-slate-400 dark:text-slate-550 font-bold mt-0.5">
                ซิงค์ล่าสุด: {lastSyncAt.toLocaleDateString("th-TH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })} น.
              </span>
            )}
          </div>

          {/* ── Auto Sync Button ── */}
          <button
            onClick={handleAmssAutoSync}
            disabled={amssSyncing}
            className="text-xs bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold px-4.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
          >
            {amssSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            )}
            {amssSyncing ? "กำลังซิงค์..." : "ดึงข้อมูลจาก AMSS++ อัตโนมัติ"}
          </button>

          {/* ── Settings Link ── */}
          <button
            onClick={() => setShowAmssCredentialsModal(true)}
            className="text-xs text-indigo-650 dark:text-indigo-400 hover:underline font-bold cursor-pointer shrink-0"
          >
            ตั้งค่าเชื่อมต่อ
          </button>

          {/* ── Fallback manual import link ── */}
          <button
            onClick={() => setShowAmssImportModal(true)}
            className="text-xs text-slate-500 hover:underline font-medium cursor-pointer shrink-0"
          >
            นำเข้าแบบวางโค้ด
          </button>
        </div>
      )}

      {/* ── Dashboard Menu Modules (Simplified Layout: 4 Cards Full-Width) ── */}
      {view === "menu" && (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-250">
          
          {/* Stats Summary Grid (Wrapped in Widget Engine) */}
          <WidgetContainer widget={{ id: "document-stats", type: "summary", componentName: "DocumentStats" }}>
            <DocumentStats
              inboundTotal={filteredInboundDocs.length}
              outboundTotal={filteredOutboundDocs.filter(d => d.docType !== "COMMAND").length}
              inboundPending={filteredInboundDocs.filter(d => d.status === "ROUTING" || d.status === "PENDING").length}
              commandTotal={filteredOutboundDocs.filter(d => d.docType === "COMMAND").length}
              activeTab={activeTab}
              onCardClick={(key) => {
                if (key === "inbound") {
                  setActiveTab("inbound");
                  setView("inbound");
                  setSelectedDocType("");
                  setSelectedStatus("");
                } else if (key === "outbound") {
                  setActiveTab("outbound");
                  setView("outbound");
                  setSelectedDocType("OUTGOING");
                  setSelectedStatus("");
                } else if (key === "pending") {
                  setActiveTab("inbound");
                  setView("inbound");
                  setSelectedDocType("");
                  setSelectedStatus("PENDING");
                } else if (key === "command") {
                  setActiveTab("outbound");
                  setView("outbound");
                  setSelectedDocType("COMMAND");
                  setSelectedStatus("");
                }
              }}
            />
          </WidgetContainer>

          {/* Menu Cards: Consolidated 4 cards grid (Wrapped in Widget Engine) */}
          <WidgetContainer widget={{ id: "document-menu-grid", type: "custom", componentName: "MenuGrid" }}>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2"
            >
              {/* Card 1: ออกเลขทะเบียนเอกสาร (Outbound/Memo/Command) */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6 }}
                data-track-id="menu-card-outbound-issue"
                onClick={() => {
                  setActiveTab("outbound");
                  setView("outbound");
                  setSelectedDocType("");
                  setSelectedStatus("");
                }}
                className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm">
                  <span className="text-3xl font-black">📝</span>
                </div>
                <h4 className="text-base font-extrabold text-slate-850 dark:text-white">ออกเลขทะเบียนเอกสาร</h4>
                <p className="text-xs text-slate-400 dark:text-slate-550 mt-2 font-medium">ขอเลขทะเบียน บันทึกข้อความ / หนังสือส่ง / คำสั่ง</p>
              </motion.div>

              {/* Card 2: หนังสือรับ (AMSS++) */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6 }}
                data-track-id="menu-card-inbound-registry"
                onClick={() => {
                  setActiveTab("inbound");
                  setView("inbound");
                  setSelectedDocType("");
                  setSelectedStatus("");
                }}
                className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm">
                  <span className="text-3xl font-black">📥</span>
                </div>
                <h4 className="text-base font-extrabold text-slate-850 dark:text-white">หนังสือรับ (AMSS++)</h4>
                <p className="text-xs text-slate-400 dark:text-slate-550 mt-2 font-medium">ทะเบียนหนังสือรับเข้าล่าสุดจากระบบ AMSS++</p>
              </motion.div>

              {/* Card 3: รอดำเนินการ (AMSS++ Pending Docs) */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6 }}
                data-track-id="menu-card-pending-registry"
                onClick={() => {
                  setActiveTab("inbound");
                  setView("inbound");
                  setSelectedDocType("");
                  setSelectedStatus("PENDING");
                }}
                className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 group font-bold relative"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm relative">
                  <span className="text-3xl font-black">⏳</span>
                  {filteredInboundDocs.filter(d => d.status === "ROUTING" || d.status === "PENDING").length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5.5 h-5.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-slate-900 animate-pulse">
                      {filteredInboundDocs.filter(d => d.status === "ROUTING" || d.status === "PENDING").length}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-extrabold text-slate-850 dark:text-white">รอดำเนินการ</h4>
                <p className="text-xs text-slate-400 dark:text-slate-550 mt-2 font-medium">หนังสือรับจาก AMSS++ ที่รอดำเนินการ</p>
              </motion.div>

              {/* Card 4: ออกเกียรติบัตร */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6 }}
                data-track-id="menu-card-cert"
                onClick={() => {
                  setView("cert");
                }}
                className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm">
                  <span className="text-3xl font-black">🏅</span>
                </div>
                <h4 className="text-base font-extrabold text-slate-850 dark:text-white">ออกเกียรติบัตร</h4>
                <p className="text-xs text-slate-400 dark:text-slate-550 mt-2 font-medium">สร้างใบเกียรติบัตรพร้อม QR Code</p>
              </motion.div>
            </motion.div>
          </WidgetContainer>

          {/* Recent Activities Timeline (Wrapped in Widget Engine) */}
          <WidgetContainer widget={{ id: "document-recent-activities", type: "recent_activity", componentName: "RecentActivityTimeline" }}>
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <RecentActivityTimeline />
            </div>
          </WidgetContainer>
        </div>
      )}

      {/* ── Sub Views Rendering (Form at Top, Table at Bottom) ── */}
      {view === "cert" ? (
        <CertGenerator onBack={() => setView("menu")} />
      ) : view !== "menu" ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-250">
          
          {/* Header Action Row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("menu")}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-350" />
            </button>
            <h2 className="text-base font-extrabold text-slate-850 dark:text-white">
              {activeTab === "outbound" 
                ? "ออกเลขทะเบียนเอกสาร (หนังสือออก)" 
                : selectedStatus === "PENDING"
                  ? "หนังสือรับรอดำเนินการ (AMSS++)"
                  : "ทะเบียนหนังสือรับเข้า (AMSS++)"}
            </h2>
          </div>

          {/* Top Panel: Form Card */}
          {!(activeTab === "inbound" && selectedStatus === "PENDING") && (
            <div className="w-full">
              {activeTab === "outbound" ? (
                <OutboundForm
                  sections={sections}
                  issuing={issuing}
                  onSubmit={handleFormIssue}
                  username={session?.user?.name || ""}
                  department={(session?.user as any)?.subjectGroup || ""}
                />
              ) : (
                <InboundForm
                  sections={sections}
                  users={users}
                  savingReceive={savingReceive}
                  scraping={scraping}
                  onScrape={handleFormScrape}
                  onSubmit={handleFormRegisterReceive}
                />
              )}
            </div>
          )}

          {/* Bottom Panel: Logs Table */}
          <div className="w-full">
            <DocumentTable
              activeTab={activeTab}
              outboundDocs={filteredOutboundDocs}
              inboundDocs={filteredInboundDocs}
              sections={sections}
              onRefresh={loadData}
              onCancelDocClick={(id) => {
                setDocToCancel(id);
                setShowCancelModal(true);
              }}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedDocType={selectedDocType}
              setSelectedDocType={setSelectedDocType}
              selectedYear={selectedYearTable}
              setSelectedYear={setSelectedYearTable}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
            />
          </div>
        </div>
      ) : null}

      {/* ── Mobile Form Modals ───────────────────────────────── */}
      <AnimatePresence>
        {showIssueModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ขอเลขเอกสาร (หนังสือออก)
                </h3>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <OutboundForm
                sections={sections}
                issuing={issuing}
                onSubmit={handleFormIssue}
                username={session?.user?.name || ""}
                department={(session?.user as any)?.subjectGroup || ""}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReceiveModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ลงทะเบียนรับหนังสือราชการ
                </h3>
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <InboundForm
                sections={sections}
                users={users}
                savingReceive={savingReceive}
                scraping={scraping}
                onScrape={handleFormScrape}
                onSubmit={handleFormRegisterReceive}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CANCEL DOCUMENT MODAL (OUTBOUND) ─────────────────────── */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 space-y-6"
            >
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-red-105 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">ยกเลิกเลขเอกสารทะเบียนส่ง</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  หมายเลขนี้จะไม่ถูกลดค่าลำดับ แต่สถานะจะแสดงเป็น &quot;ยกเลิก&quot; เพื่อป้องกันการแก้ไขเอกสารนี้อีก
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    เหตุผลในการยกเลิกเลขนี้ *
                  </label>
                  <textarea
                    required
                    placeholder="กรอกเหตุผลเพื่อบันทึกใน Log..."
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-550 dark:bg-slate-850 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancelDoc}
                    disabled={!cancelReason.trim()}
                    className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-650 text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    ยืนยันการยกเลิกเลข
                  </button>
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setDocToCancel(null);
                      setCancelReason("");
                    }}
                    className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCertModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-purple-50 dark:bg-purple-950/20 text-purple-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                🏅
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">ระบบสร้างเกียรติบัตรอัตโนมัติ</h3>
                <p className="text-xs text-slate-550 leading-relaxed">
                  ระบบออกแบบใบเกียรติบัตรอัตโนมัติพร้อมระบบตรวจสอบความถูกต้องด้วยรหัส QR Code (Certificate Verification System) กำลังอยู่ในขั้นตอนการทดสอบขั้นสุดท้ายและจัดเตรียมโครงสร้างข้อมูลเพื่อเชื่อมกับรายชื่อนักเรียนเร็วๆ นี้!
                </p>
              </div>
              <button
                onClick={() => setShowCertModal(false)}
                className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition cursor-pointer"
              >
                ตกลง
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AmssCredentialsModal
        isOpen={showAmssCredentialsModal}
        onClose={() => setShowAmssCredentialsModal(false)}
        onSaved={loadData}
        showToast={showToast}
      />

      <AmssImportModal
        isOpen={showAmssImportModal}
        onClose={() => setShowAmssImportModal(false)}
        onRefresh={loadData}
      />

      {/* ── Quick Issue Success Modal ── */}
      <AnimatePresence>
        {quickIssuedResult && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden"
            >
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
                  🎉
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">ออกเลขทะเบียนสำเร็จ!</h3>
                <p className="text-xs text-slate-400 dark:text-slate-550">หมายเลขทะเบียนนี้ได้รับการผูกมัดและป้องกันการออกเลขซ้ำแล้ว</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-5 border border-slate-100/50 dark:border-slate-850 flex flex-col items-center justify-center text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">เลขทะเบียนที่ได้รับ</span>
                <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 selection:bg-indigo-100 dark:selection:bg-indigo-900/40">
                  {quickIssuedResult.docNo}
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl p-3.5 border border-slate-100/30">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-450">เรื่อง:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[200px]">{quickIssuedResult.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-450">เรียน/เสนอ:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{quickIssuedResult.to}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-450">วันที่:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {new Date(quickIssuedResult.date).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(quickIssuedResult.docNo);
                    setCopiedQuickNo(true);
                    showToast("คัดลอกเลขทะเบียนแล้ว!", "success");
                    setTimeout(() => setCopiedQuickNo(false), 2000);
                  }}
                  className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedQuickNo ? "คัดลอกสำเร็จ! ✓" : "คัดลอกเลขทะเบียน 📋"}
                </button>
                <button
                  onClick={() => setQuickIssuedResult(null)}
                  className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
