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

// Import atomic components
import DocumentStats from "./_components/document-stats";
import OutboundForm from "./_components/forms/outbound-form";
import InboundForm from "./_components/forms/inbound-form";
import DocumentTable from "./_components/document-table";

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
  const [view, setView] = useState<"menu" | "outbound" | "inbound">("menu");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() + 543);
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

  if (loading && outboundDocs.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-orange-105 border-t-orange-500 rounded-full"
        />
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
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-orange-500" />
            ระบบงานสารบรรณ
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            รับ-ส่งหนังสือราชการ บันทึกข้อความ คำสั่ง ประกาศ เกียรติบัตร
          </p>
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

      {/* ── Stats Grid ────────────────────────────────────────── */}
      <DocumentStats
        inboundTotal={filteredInboundDocs.length}
        outboundTotal={filteredOutboundDocs.filter(d => d.docType !== "COMMAND").length}
        inboundPending={filteredInboundDocs.filter(d => d.status === "ROUTING" || d.status === "PENDING").length}
        commandTotal={filteredOutboundDocs.filter(d => d.docType === "COMMAND").length}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setView(tab);
        }}
      />

      {/* ── Sub Action Links ──────────────────────────────────── */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        {view !== "menu" ? (
          <button
            onClick={() => setView("menu")}
            className="text-xs text-slate-500 hover:text-slate-850 dark:hover:text-white transition flex items-center gap-1 font-bold cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            กลับไปหน้าเมนูระบบเอกสาร
          </button>
        ) : (
          <Link href="/dashboard" className="text-xs text-slate-505 hover:text-slate-850 dark:hover:text-white transition flex items-center gap-1 font-semibold">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            กลับบอร์ดหน้าแรก
          </Link>
        )}
        {view === "inbound" && (
          <div className="flex items-center gap-3 flex-wrap">
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
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
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
      </div>

      {/* ── Dashboard Menu Modules ── */}
      {view === "menu" && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2"
        >
          {/* Card 1: ขอเลขเอกสาร */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6 }}
            onClick={() => {
              setActiveTab("outbound");
              setView("outbound");
            }}
            className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm">
              <span className="text-3xl font-black font-sans">#</span>
            </div>
            <h4 className="text-base font-extrabold text-slate-850 dark:text-white">ขอเลขเอกสาร</h4>
            <p className="text-xs text-slate-400 dark:text-slate-550 mt-2 font-medium">ขอเลขหนังสือออกและดูประวัติ</p>
          </motion.div>

          {/* Card 2: ทะเบียนหนังสือรับ */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6 }}
            onClick={() => {
              setActiveTab("inbound");
              setView("inbound");
            }}
            className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm relative">
              <ClipboardList className="w-7 h-7" />
              {filteredInboundDocs.filter(d => d.status === "ROUTING" || d.status === "PENDING").length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5.5 h-5.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-slate-900 animate-pulse">
                  {filteredInboundDocs.filter(d => d.status === "ROUTING" || d.status === "PENDING").length}
                </span>
              )}
            </div>
            <h4 className="text-base font-extrabold text-slate-850 dark:text-white">ทะเบียนหนังสือรับ</h4>
            <p className="text-xs text-slate-400 dark:text-slate-550 mt-2 font-medium">รับหนังสือ AMSS++ และทะเบียนงาน</p>
          </motion.div>

          {/* Card 3: ออกเกียรติบัตร */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6 }}
            onClick={() => {
              setShowCertModal(true);
            }}
            className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm">
              <span className="text-3xl font-black">🏅</span>
            </div>
            <h4 className="text-base font-extrabold text-slate-850 dark:text-white">ออกเกียรติบัตร</h4>
            <p className="text-xs text-slate-400 dark:text-slate-550 mt-2 font-medium">สร้างใบเกียรติบัตรพร้อม QR Code</p>
          </motion.div>
        </motion.div>
      )}

      {/* ── Main Two-Column Layout ────────────────────────────── */}
      {view !== "menu" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form Panel (Desktop Only) */}
        <div className="hidden lg:block lg:col-span-1">
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

        {/* Right Column: Table Logs */}
        <div className="col-span-1 lg:col-span-2 space-y-4">
          
          {/* Mobile-only Trigger Button */}
          <div className="block lg:hidden">
            {activeTab === "outbound" ? (
              <button
                onClick={() => setShowIssueModal(true)}
                className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
                ขอเลขเอกสาร (หนังสือออก)
              </button>
            ) : (
              <button
                onClick={() => setShowReceiveModal(true)}
                className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
                ลงทะเบียนรับหนังสือราชการ
              </button>
            )}
          </div>

          {/* Logs Table */}
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
          />
        </div>
      </div>
      )}

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
                  className="p-2 rounded-full hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
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
                  className="p-2 rounded-full hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
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
    </motion.div>
  );
}
