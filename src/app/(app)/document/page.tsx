"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  quickIssueDoc,
  getDocumentTrendStats
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
import AmssAutoBrowserSync from "./_components/amss-auto-browser-sync";
import CertGenerator from "./_components/cert-generator";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import DocumentSettingsModal from "./_components/document-settings-modal";

// Import atomic components
import DocumentStats from "./_components/document-stats";
import OutboundForm from "./_components/forms/outbound-form";
import DocumentTable from "./_components/document-table";
import DocumentTrendChart from "./_components/document-trend-chart";
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

function DocumentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { showToast: originalShowToast } = useToast();
  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    originalShowToast(type, msg);
  }, [originalShowToast]);

  const [activeTab, setActiveTab] = useState<"outbound" | "inbound">("outbound");
  const [view, setView] = useState<"issue" | "inbound" | "outbound_history" | "cert">("issue");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() + 543);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("");
  const [selectedYearTable, setSelectedYearTable] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // URL searchParams sync
  const paramView = searchParams.get("view");
  const paramTab = searchParams.get("tab");
  const paramDocType = searchParams.get("docType");
  const paramStatus = searchParams.get("status");

  useEffect(() => {
    if (paramView === "inbound" || paramView === "outbound_history" || paramView === "issue" || paramView === "cert") {
      setView(paramView as any);
      if (paramView === "inbound") setActiveTab("inbound");
      if (paramView === "outbound_history") setActiveTab("outbound");
    } else if (paramView === "history") {
      if (paramTab === "inbound") {
        setView("inbound");
        setActiveTab("inbound");
      } else {
        setView("outbound_history");
        setActiveTab("outbound");
      }
    } else if (paramTab === "inbound") {
      setView("inbound");
      setActiveTab("inbound");
    }
    if (paramDocType !== null) {
      setSelectedDocType(paramDocType);
    }
    if (paramStatus !== null) {
      setSelectedStatus(paramStatus);
    }
  }, [paramView, paramTab, paramDocType, paramStatus]);
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
  const [trendData, setTrendData] = useState<any[]>([]);

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

  // AMSS Sync & Doc Settings states
  const [showAmssCredentialsModal, setShowAmssCredentialsModal] = useState(false);
  const [showDocSettingsModal, setShowDocSettingsModal] = useState(false);
  const [amssSyncing, setAmssSyncing] = useState(false);
  const [amssCredsExist, setAmssCredsExist] = useState<boolean | null>(null); // null = checking
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [autoBrowserTrigger, setAutoBrowserTrigger] = useState(false);
  const autoSyncedRef = useRef(false);

  const [issuing, setIssuing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [savingReceive, setSavingReceive] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [secs, outStatsRes, outListRes, inList, staff, amssCreds, trendRes] = await Promise.all([
        getMemoSections(),
        getDashboardStats(),
        getDocumentsList({}),
        getIncomingDocsList({}),
        getSimpleUsersList(),
        getAMSSCredentials(),
        getDocumentTrendStats()
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
      if (trendRes.success && trendRes.data) {
        setTrendData(trendRes.data);
      }

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

  // Auto-sync when user opens Inbound Books view
  useEffect(() => {
    if (view === "inbound" && !autoSyncedRef.current && amssCredsExist) {
      autoSyncedRef.current = true;
      handleAmssAutoSync();
    }
  }, [view, amssCredsExist]);

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
        if (
          errMsg.includes("CAPTCHA") ||
          errMsg.includes("Cloudflare") ||
          errMsg.includes("403") ||
          errMsg.includes("Firewall") ||
          errMsg.includes("ล้มเหลว") ||
          errMsg.includes("ไม่สามารถเชื่อมต่อ")
        ) {
          // Trigger browser client background sync automatically without popup error toast
          setAutoBrowserTrigger(true);
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
      // Fallback to browser client auto sync
      setAutoBrowserTrigger(true);
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
      <PageHeader
        title="ระบบงานสารบรรณ (Sarabun System)"
        description="ขอออกเลขทะเบียนหนังสือส่ง บันทึกข้อความ คำสั่ง และตรวจสอบประวัติทะเบียนคุมหนังสือรับ-ส่ง"
        icon={ClipboardList}
        gradient="from-orange-600 to-amber-600"
        action={
          <div className="flex items-center gap-2">
            <GuardedAction requiredPermission="sarabun:settings:edit">
              <button
                onClick={() => setShowDocSettingsModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200/60 dark:border-indigo-800/60 transition cursor-pointer shadow-sm"
              >
                ⚙️ ตั้งค่าขอเลข & บันทึกข้อความ
              </button>
            </GuardedAction>

            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
              title="กลับหน้าหลัก"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </Link>
          </div>
        }
      />

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 p-1 rounded-2xl gap-1 shadow-sm max-w-2xl overflow-x-auto">
        <button
          onClick={() => {
            setView("issue");
            setActiveTab("outbound");
          }}
          className={`px-4 py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            view === "issue"
              ? "bg-slate-900 text-white dark:bg-slate-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-100/60 dark:hover:bg-slate-800"
          }`}
        >
          📝 ขอเลขเอกสาร
        </button>

        <button
          onClick={() => {
            setView("inbound");
            setActiveTab("inbound");
            setSelectedStatus("");
            setSelectedDocType("");
          }}
          className={`px-4 py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            view === "inbound"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100/60 dark:hover:bg-slate-800"
          }`}
        >
          <span>📥</span>
          หนังสือรับ (AMSS++)
          {filteredInboundDocs.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              view === "inbound" ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
            }`}>
              {filteredInboundDocs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setView("outbound_history");
            setActiveTab("outbound");
            setSelectedStatus("");
            setSelectedDocType("");
          }}
          className={`px-4 py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            view === "outbound_history"
              ? "bg-slate-900 text-white dark:bg-slate-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-100/60 dark:hover:bg-slate-800"
          }`}
        >
          📋 ทะเบียนหนังสือส่ง/คำสั่ง
        </button>

        <button
          onClick={() => {
            setView("cert");
          }}
          className={`px-4 py-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            view === "cert"
              ? "bg-slate-900 text-white dark:bg-slate-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-100/60 dark:hover:bg-slate-800"
          }`}
        >
          🏅 ออกเกียรติบัตร
        </button>
      </div>

      {/* ── View switcher ── */}
      {view === "cert" ? (
        <CertGenerator onBack={() => setView("inbound")} />
      ) : view === "issue" ? (
        /* ───────────────── REQUEST DOCUMENT NUMBER VIEW ───────────────── */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              ขอเลขทะเบียนเอกสารใหม่
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              กรอกข้อมูลเพื่อขอออกเลขทะเบียนหนังสือส่ง บันทึกข้อความ หรือคำสั่งโรงเรียน
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <OutboundForm
              sections={sections}
              issuing={issuing}
              onSubmit={handleFormIssue}
              username={session?.user?.name || ""}
              department={(session?.user as any)?.subjectGroup || ""}
            />
          </div>
        </div>
      ) : view === "inbound" ? (
        /* ───────────────── INBOUND AMSS++ VIEW (SEPARATE PAGE) ───────────────── */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner & AMSS Settings Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-lg">📥</span>
                  ระบบรับหนังสือราชการ (AMSS++)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  รับหนังสือราชการจากเขตพื้นที่การศึกษา อัปเดตอัตโนมัติ พร้อมระบบเกษียนหนังสือ
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <GuardedAction requiredPermission="sarabun:amss:sync">
                  <AmssAutoBrowserSync onSuccess={loadData} showToast={showToast} autoTrigger={autoBrowserTrigger} />
                </GuardedAction>

                <GuardedAction requiredPermission="sarabun:amss:sync">
                  <button
                    onClick={() => setShowAmssCredentialsModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    ⚙️ ตั้งค่าเชื่อมต่อ
                  </button>
                </GuardedAction>

                <GuardedAction requiredPermission="sarabun:amss:sync">
                  <button
                    onClick={() => setShowAmssImportModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200/60 dark:border-indigo-800/60 transition cursor-pointer"
                    title="นำเข้าหนังสือรับโดยคัดลอกซอร์สโค้ด HTML หรือวางข้อความ"
                  >
                    📋 วางข้อความ / HTML
                  </button>
                </GuardedAction>
              </div>
            </div>

            {/* Quick Stats Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-500">หนังสือรับทั้งหมด</span>
                  <p className="text-lg font-black text-indigo-900 dark:text-indigo-200">{filteredInboundDocs.length} เล่ม</p>
                </div>
                <span className="text-2xl">📚</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-500">รอดำเนินการ / เกษียน</span>
                  <p className="text-lg font-black text-amber-900 dark:text-amber-200">
                    {filteredInboundDocs.filter(d => d.status === "ROUTING" || d.status === "PENDING").length} เล่ม
                  </p>
                </div>
                <span className="text-2xl">⏳</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-500">สถานะการเชื่อมต่อ AMSS++</span>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {amssCredsExist ? "● เชื่อมต่อระบบแล้ว" : "○ ยังไม่ตั้งค่ารหัสผ่าน"}
                  </p>
                </div>
                <span className="text-2xl">🔌</span>
              </div>
            </div>
          </div>

          {/* Inbound Document History Table */}
          <DocumentTable
            activeTab="inbound"
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
      ) : view === "outbound_history" ? (
        /* ───────────────── OUTBOUND HISTORY VIEW (SEPARATE PAGE) ───────────────── */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              ทะเบียนคุมหนังสือส่งและคำสั่งโรงเรียน
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ตรวจสอบประวัติการขอออกเลขทะเบียนส่ง บันทึกข้อความ และคำสั่งโรงเรียน
            </p>
          </div>

          <DocumentTable
            activeTab="outbound"
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

      {/* Document Settings & Starting Number Modal */}
      <DocumentSettingsModal
        isOpen={showDocSettingsModal}
        onClose={() => setShowDocSettingsModal(false)}
        onSuccess={loadData}
        showToast={showToast}
      />
    </motion.div>
  );
}

export default function DocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      }
    >
      <DocumentPageContent />
    </Suspense>
  );
}
