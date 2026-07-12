"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  Filter,
  X,
  AlertCircle,
  Check,
  Clock,
  Printer,
  Ban,
  Plus,
  Settings,
  RefreshCw,
  ClipboardList,
  FolderOpen,
  Users,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Globe,
  Share2,
  Calendar,
  Building,
  User,
  ArrowRight,
  Sparkles,
  Link2,
  Eye,
  Trash2,
  Bookmark
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
  scrapeAMSSDocument 
} from "@/app/actions/incoming";
import { getSimpleUsersList } from "@/app/actions/settings";
import { useSession } from "@/lib/auth-client";
import { useToast } from "@/components/toast-provider";
import AmssImportModal from "@/components/AmssImportModal";

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
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<MemoSection[]>([]);
  const [outboundDocs, setOutboundDocs] = useState<DocumentRecord[]>([]);
  const [inboundDocs, setInboundDocs] = useState<IncomingDoc[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [outboundStats, setOutboundStats] = useState({ DRAFT: 0, ISSUED: 0, PRINTED: 0, CANCELLED: 0 });

  // Filters Outbound
  const [outboundSearch, setOutboundSearch] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Filters Inbound
  const [inboundSearch, setInboundSearch] = useState("");
  const [inboundUrgency, setInboundUrgency] = useState<string | null>(null);
  const [inboundStatus, setInboundStatus] = useState<string | null>(null);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAmssImportModal, setShowAmssImportModal] = useState(false);
  const [docToCancel, setDocToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Quick Issue Form State
  const [issueForm, setIssueForm] = useState({
    docType: "MEMO",
    memoSectionId: "",
    title: "",
    to: "",
    origin: "",
    requester: "",
    department: "",
    date: new Date().toISOString().split("T")[0]
  });
  const [issuing, setIssuing] = useState(false);

  // Register Receive Form State
  const [receiveForm, setReceiveForm] = useState({
    senderOrg: "",
    docRefNo: "",
    title: "",
    urgencyLevel: "NORMAL",
    amssLink: "",
    attachmentUrl: "",
    memoSectionId: "",
    note: "",
    firstAssigneeId: ""
  });
  const [scraping, setScraping] = useState(false);
  const [savingReceive, setSavingReceive] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [secs, outStats, outList, inList, staff] = await Promise.all([
        getMemoSections(),
        getDashboardStats(),
        getDocumentsList({}),
        getIncomingDocsList({}),
        getSimpleUsersList()
      ]);
      setSections(secs as MemoSection[]);
      setOutboundStats(outStats);
      setOutboundDocs(outList as any[]);
      setInboundDocs(inList as any[]);
      setUsers(staff);
      
      // Defaults first section
      if (secs.length > 0) {
        setIssueForm(prev => ({ ...prev, memoSectionId: secs[0].id }));
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

  // Set default requester/dept on session load
  useEffect(() => {
    if (session?.user) {
      setIssueForm(prev => ({
        ...prev,
        requester: session.user.name || "",
        department: (session.user as any).subjectGroup || ""
      }));
    }
  }, [session]);

  // Scrape AMSS++ link
  const handleScrapeAMSS = async () => {
    if (!receiveForm.amssLink.trim()) {
      showToast("กรุณากรอกลิงก์ AMSS++ ก่อนดึงข้อมูล", "error");
      return;
    }
    setScraping(true);
    try {
      const details = await scrapeAMSSDocument(receiveForm.amssLink.trim());
      setReceiveForm(prev => ({
        ...prev,
        title: details.subject || prev.title,
        docRefNo: details.bookNo || prev.docRefNo,
        senderOrg: details.from || prev.senderOrg,
      }));
      showToast("ดึงข้อมูลหนังสือจาก AMSS++ สำเร็จ!", "success");
    } catch (err: any) {
      showToast(err.message || "ดึงข้อมูลล้มเหลว กรุณากรอกเอง", "error");
    } finally {
      setScraping(false);
    }
  };

  // Quick Issue Submit
  const handleQuickIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.title.trim() || !issueForm.to.trim() || !issueForm.origin.trim()) {
      showToast("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", "error");
      return;
    }
    setIssuing(true);
    try {
      const issued = await quickIssueDoc({
        docType: issueForm.docType,
        memoSectionId: issueForm.docType === "MEMO" ? issueForm.memoSectionId : undefined,
        title: issueForm.title.trim(),
        to: issueForm.to.trim(),
        origin: issueForm.origin.trim(),
        requester: issueForm.requester.trim(),
        department: issueForm.department.trim(),
        date: issueForm.date
      });
      showToast(`ออกเลขเอกสารสำเร็จ: ${issued.docNo}`, "success");
      setShowIssueModal(false);
      // Reset title and focus
      setIssueForm(prev => ({ ...prev, title: "", to: "", origin: "" }));
      loadData();
      router.push(`/document/${issued.id}`);
    } catch (err: any) {
      showToast(err.message || "ออกเลขเอกสารล้มเหลว", "error");
    } finally {
      setIssuing(false);
    }
  };

  // Register Receive Submit
  const handleRegisterReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm.title.trim() || !receiveForm.senderOrg.trim()) {
      showToast("กรุณากรอกเรื่องและหน่วยงานผู้ส่ง", "error");
      return;
    }
    setSavingReceive(true);
    try {
      const doc = await createIncomingDoc({
        senderOrg: receiveForm.senderOrg.trim(),
        docRefNo: receiveForm.docRefNo.trim() || undefined,
        title: receiveForm.title.trim(),
        urgencyLevel: receiveForm.urgencyLevel,
        amssLink: receiveForm.amssLink.trim() || undefined,
        attachmentUrl: receiveForm.attachmentUrl.trim() || undefined,
        memoSectionId: receiveForm.memoSectionId || undefined,
        note: receiveForm.note.trim() || undefined,
        firstAssigneeId: receiveForm.firstAssigneeId || undefined
      });
      showToast(`ลงทะเบียนรับหนังสือสำเร็จ: ${doc.receiveNo}`, "success");
      setShowReceiveModal(false);
      setReceiveForm({
        senderOrg: "",
        docRefNo: "",
        title: "",
        urgencyLevel: "NORMAL",
        amssLink: "",
        attachmentUrl: "",
        memoSectionId: "",
        note: "",
        firstAssigneeId: ""
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || "ลงทะเบียนไม่สำเร็จ", "error");
    } finally {
      setSavingReceive(false);
    }
  };

  // Cancel doc logic
  const handleCancelDoc = async () => {
    if (!docToCancel || !cancelReason.trim()) return;
    try {
      await cancelDoc(docToCancel, cancelReason.trim());
      showToast("ยกเลิกเลขเอกสารเรียบร้อยแล้ว", "success");
      setShowCancelModal(false);
      setDocToCancel(null);
      setCancelReason("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "ยกเลิกไม่สำเร็จ", "error");
    }
  };

  // Filters Application
  const filteredOutbound = useMemo(() => {
    return outboundDocs.filter(d => {
      const matchSearch = 
        d.title.toLowerCase().includes(outboundSearch.toLowerCase()) ||
        (d.docNo && d.docNo.toLowerCase().includes(outboundSearch.toLowerCase())) ||
        (d.requester && d.requester.toLowerCase().includes(outboundSearch.toLowerCase()));
      const matchSection = !selectedSectionId || d.memoSectionId === selectedSectionId;
      const matchStatus = !selectedStatus || d.status === selectedStatus;
      return matchSearch && matchSection && matchStatus;
    });
  }, [outboundDocs, outboundSearch, selectedSectionId, selectedStatus]);

  const filteredInbound = useMemo(() => {
    return inboundDocs.filter(d => {
      const matchSearch =
        d.title.toLowerCase().includes(inboundSearch.toLowerCase()) ||
        d.receiveNo.toLowerCase().includes(inboundSearch.toLowerCase()) ||
        d.senderOrg.toLowerCase().includes(inboundSearch.toLowerCase()) ||
        (d.docRefNo && d.docRefNo.toLowerCase().includes(inboundSearch.toLowerCase()));
      const matchUrgency = !inboundUrgency || d.urgencyLevel === inboundUrgency;
      const matchStatus = !inboundStatus || d.status === inboundStatus;
      return matchSearch && matchUrgency && matchStatus;
    });
  }, [inboundDocs, inboundSearch, inboundUrgency, inboundStatus]);

  const stats = useMemo(() => {
    const inboundTotal = inboundDocs.length;
    const inboundPending = inboundDocs.filter(d => d.status === "PENDING").length;
    const inboundRouting = inboundDocs.filter(d => d.status === "ROUTING").length;
    const inboundCompleted = inboundDocs.filter(d => d.status === "COMPLETED").length;
    return { inboundTotal, inboundPending, inboundRouting, inboundCompleted };
  }, [inboundDocs]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full"
        />
      </div>
    );
  }

  const isAdmin = (session?.user as any)?.role === "ADMIN";

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
            <ClipboardList className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            ระบบบริหารเอกสารราชการ
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ออกเลขส่งคำสั่งและลงทะเบียนรับเกษียนหนังสือออนไลน์ เชื่อมโยงข้อมูลอย่างมีประสิทธิภาพ
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* ── Tabs Navigation ────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("outbound")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "outbound"
              ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
          }`}
        >
          📤 ทะเบียนส่ง (ออกเลขเอกสาร)
        </button>
        <button
          onClick={() => setActiveTab("inbound")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "inbound"
              ? "border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
          }`}
        >
          📥 ทะเบียนรับ (เกษียนหนังสือออนไลน์)
        </button>
      </motion.div>

      {/* ── OUTBOUND TAB CONTENT ─────────────────────────────────── */}
      {activeTab === "outbound" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Quick Stats / Action Bar */}
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex gap-4">
              <span className="text-xs font-semibold text-slate-500">
                ออกเลขแล้วปีนี้: <strong className="text-purple-600">{outboundStats.ISSUED + outboundStats.PRINTED}</strong> ฉบับ
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ยกเลิกเลข: <strong className="text-red-500">{outboundStats.CANCELLED}</strong>
              </span>
            </div>

            <button
              onClick={() => {
                setShowIssueModal(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              ออกเลขเอกสารด่วน
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sections.map((sec) => {
              const count = outboundDocs.filter(d => d.memoSectionId === sec.id).length;
              const latest = outboundDocs.find(d => d.memoSectionId === sec.id && d.docNo);
              return (
                <div
                  key={sec.id}
                  onClick={() => setSelectedSectionId(selectedSectionId === sec.id ? null : sec.id)}
                  style={{ borderColor: selectedSectionId === sec.id ? sec.color : undefined }}
                  className={`cursor-pointer bg-white dark:bg-slate-900 border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group ${
                    selectedSectionId === sec.id ? "ring-2 ring-offset-2 dark:ring-offset-slate-900" : "border-slate-100 dark:border-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div 
                      style={{ backgroundColor: `${sec.color}15`, color: sec.color }}
                      className="p-3 rounded-2xl"
                    >
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {sec.code}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">{sec.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">ทั้งหมด {count} ฉบับ</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50 flex justify-between items-center text-xs">
                    <span className="text-slate-400">ล่าสุด:</span>
                    <span className="font-bold font-mono" style={{ color: sec.color }}>
                      {latest?.docNo || "ยังไม่มี"}
                    </span>
                  </div>

                  {/* Quick Action inside card */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIssueForm(prev => ({ ...prev, docType: "MEMO", memoSectionId: sec.id }));
                      setShowIssueModal(true);
                    }}
                    style={{ backgroundColor: sec.color }}
                    className="absolute right-4 bottom-14 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl text-white shadow-lg"
                    title="ออกเลขในหมวดนี้ทันที"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาตามเรื่อง เลขที่ หรือผู้ขอ..."
                  value={outboundSearch}
                  onChange={(e) => setOutboundSearch(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <select
                  value={selectedStatus || ""}
                  onChange={(e) => setSelectedStatus(e.target.value || null)}
                  className="h-11 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  <option value="">ทุกสถานะ</option>
                  <option value="DRAFT">ฉบับร่าง</option>
                  <option value="ISSUED">ออกเลขแล้ว</option>
                  <option value="PRINTED">พิมพ์แล้ว</option>
                  <option value="CANCELLED">ยกเลิก</option>
                </select>

                {(selectedSectionId || selectedStatus || outboundSearch) && (
                  <button
                    onClick={() => {
                      setSelectedSectionId(null);
                      setSelectedStatus(null);
                      setOutboundSearch("");
                    }}
                    className="flex items-center gap-1.5 px-4 h-11 rounded-2xl text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                  >
                    <X className="w-4 h-4" />
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </div>

            {/* Outbound Documents Table */}
            <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-50 dark:border-slate-800 text-left">
                    <th className="py-3 px-4 font-semibold">เลขที่เอกสาร</th>
                    <th className="py-3 px-4 font-semibold">เรื่อง</th>
                    <th className="py-3 px-4 font-semibold">หมวดหมู่</th>
                    <th className="py-3 px-4 font-semibold">ผู้ปฏิบัติ</th>
                    <th className="py-3 px-4 font-semibold">ลงวันที่</th>
                    <th className="py-3 px-4 font-semibold text-center">สถานะ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutbound.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold text-sm">ไม่พบเอกสารตามตัวกรอง</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOutbound.map((d) => (
                      <tr key={d.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-4 px-4 font-bold font-mono">
                          {d.docNo ? (
                            <Link href={`/document/${d.id}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                              {d.docNo}
                            </Link>
                          ) : (
                            <span className="text-slate-400 text-xs italic">ไม่มีเลข (ฉบับร่าง)</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {d.title}
                        </td>
                        <td className="py-4 px-4">
                          {d.memoSection ? (
                            <span
                              style={{ backgroundColor: `${d.memoSection.color}15`, color: d.memoSection.color }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold"
                            >
                              {d.memoSection.code}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">คำสั่ง/ส่งออก</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          {d.requester || "-"}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          {new Date(d.date).toLocaleDateString("th-TH")}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            d.status === "ISSUED" ? "bg-emerald-50 text-emerald-600" :
                            d.status === "PRINTED" ? "bg-blue-50 text-blue-600" :
                            d.status === "CANCELLED" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-650"
                          }`}>
                            {d.status === "ISSUED" ? "ออกเลขแล้ว" :
                             d.status === "PRINTED" ? "พิมพ์แล้ว" :
                             d.status === "CANCELLED" ? "ยกเลิก" : "ฉบับร่าง"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex gap-1 justify-end">
                            <Link
                              href={`/document/${d.id}`}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            
                            {d.status === "DRAFT" && (
                              <Link
                                href={`/document/new?id=${d.id}`}
                                className="px-2 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold"
                              >
                                ทำต่อ
                              </Link>
                            )}

                            {d.status !== "CANCELLED" && (
                              <button
                                onClick={() => {
                                  setDocToCancel(d.id);
                                  setShowCancelModal(true);
                                }}
                                className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                                title="ยกเลิกเลข"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── INBOUND TAB CONTENT ──────────────────────────────────── */}
      {activeTab === "inbound" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Action Header */}
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 max-w-2xl">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 font-semibold block">ทะเบียนรับทั้งหมด</span>
                <span className="text-lg font-bold text-slate-950 dark:text-white mt-1 block">{stats.inboundTotal} เรื่อง</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 font-semibold block">รอดำเนินการ</span>
                <span className="text-lg font-bold text-amber-600 mt-1 block">{stats.inboundPending} เรื่อง</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 font-semibold block">กำลังเกษียนส่ง</span>
                <span className="text-lg font-bold text-blue-600 mt-1 block">{stats.inboundRouting} เรื่อง</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <span className="text-xs text-slate-400 font-semibold block">เสร็จสิ้น</span>
                <span className="text-lg font-bold text-emerald-600 mt-1 block">{stats.inboundCompleted} เรื่อง</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap shrink-0">
              <button
                onClick={() => setShowAmssImportModal(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-indigo-200 dark:border-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-800/55 text-indigo-600 dark:text-indigo-400 text-sm font-bold transition-all shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" />
                นำเข้าข้อมูลจาก AMSS++ (วางโค้ด/อัปโหลด)
              </button>
              <button
                onClick={() => setShowReceiveModal(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                ลงทะเบียนรับหนังสือ (AMSS++)
              </button>
            </div>
          </div>

          {/* Filters Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาทะเบียนรับ เรื่อง หรือหน่วยงานผู้ส่ง..."
                  value={inboundSearch}
                  onChange={(e) => setInboundSearch(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <select
                  value={inboundUrgency || ""}
                  onChange={(e) => setInboundUrgency(e.target.value || null)}
                  className="h-11 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  <option value="">ทุกความเร่งด่วน</option>
                  <option value="NORMAL">ปกติ</option>
                  <option value="URGENT">ด่วน</option>
                  <option value="URGENT_MORE">ด่วนมาก</option>
                  <option value="URGENT_MOST">ด่วนที่สุด</option>
                </select>

                <select
                  value={inboundStatus || ""}
                  onChange={(e) => setInboundStatus(e.target.value || null)}
                  className="h-11 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  <option value="">ทุกสถานะ</option>
                  <option value="PENDING">รอดำเนินการ</option>
                  <option value="ROUTING">กำลังเกษียน</option>
                  <option value="COMPLETED">เสร็จสิ้น</option>
                </select>

                {(inboundSearch || inboundUrgency || inboundStatus) && (
                  <button
                    onClick={() => {
                      setInboundSearch("");
                      setInboundUrgency(null);
                      setInboundStatus(null);
                    }}
                    className="flex items-center gap-1.5 px-4 h-11 rounded-2xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-all"
                  >
                    <X className="w-4 h-4" />
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </div>

            {/* Inbound Document Table */}
            <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-50 dark:border-slate-800 text-left">
                    <th className="py-3 px-4 font-semibold">ทะเบียนรับ</th>
                    <th className="py-3 px-4 font-semibold">เลขต้นทาง</th>
                    <th className="py-3 px-4 font-semibold">เรื่อง</th>
                    <th className="py-3 px-4 font-semibold">หน่วยงานผู้ส่ง</th>
                    <th className="py-3 px-4 font-semibold">ความเร่งด่วน</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    <th className="py-3 px-4 text-right">เกษียน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInbound.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold text-sm">ไม่พบหนังสือรับในระบบ</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInbound.map((d) => (
                      <tr key={d.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                          <Link href={`/document/incoming/${d.id}`} className="hover:underline text-purple-600 dark:text-purple-400">
                            {d.receiveNo}
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-xs font-mono">
                          {d.docRefNo || "-"}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {d.title}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          {d.senderOrg}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            d.urgencyLevel === "URGENT_MOST" ? "bg-red-100 text-red-700" :
                            d.urgencyLevel === "URGENT_MORE" ? "bg-orange-100 text-orange-700" :
                            d.urgencyLevel === "URGENT" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-700"
                          }`}>
                            {d.urgencyLevel === "URGENT_MOST" ? "ด่วนที่สุด" :
                             d.urgencyLevel === "URGENT_MORE" ? "ด่วนมาก" :
                             d.urgencyLevel === "URGENT" ? "ด่วน" : "ปกติ"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            d.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" :
                            d.status === "ROUTING" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                          }`}>
                            {d.status === "COMPLETED" ? "เสร็จสิ้น" :
                             d.status === "ROUTING" ? "กำลังเกษียน" : "รอดำเนินการ"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            {d.amssLink && (
                              <a
                                href={d.amssLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg border border-indigo-200 text-indigo-500 hover:bg-indigo-50"
                                title="เปิดดูใน AMSS++"
                              >
                                <Globe className="w-4 h-4" />
                              </a>
                            )}
                            <Link
                              href={`/document/incoming/${d.id}`}
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow-md transition"
                            >
                              เกษียน timeline
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── QUICK ISSUE DOCUMENT MODAL (OUTBOUND) ──────────────────── */}
      <AnimatePresence>
        {showIssueModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    ออกเลขหนังสือส่ง/คำสั่งราชการ
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">กรอกข้อมูลพื้นฐานเพื่อจองและจดหมายเลขทะเบียนส่งได้ทันที</p>
                </div>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleQuickIssue} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      ประเภทเอกสาร
                    </label>
                    <select
                      value={issueForm.docType}
                      onChange={(e) => setIssueForm({ ...issueForm, docType: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="MEMO">บันทึกข้อความ (ศทก)</option>
                      <option value="COMMAND">คำสั่งโรงเรียน</option>
                      <option value="OUTGOING">หนังสือส่งภายนอก (ที่ ศทก)</option>
                    </select>
                  </div>

                  {issueForm.docType === "MEMO" && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        หมวดหมู่เอกสาร *
                      </label>
                      <select
                        value={issueForm.memoSectionId}
                        onChange={(e) => setIssueForm({ ...issueForm, memoSectionId: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm focus:ring-2 focus:ring-purple-500/20"
                      >
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      จาก *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="หน่วยงานผู้ส่ง เช่น ฝ่ายวิชาการ"
                      value={issueForm.origin}
                      onChange={(e) => setIssueForm({ ...issueForm, origin: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      เรียน/ถึง *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ผู้อำนวยการโรงเรียน"
                      value={issueForm.to}
                      onChange={(e) => setIssueForm({ ...issueForm, to: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    เรื่อง (ชื่อเอกสาร) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ขออนุมัติจัดซื้อวัสดุคอมพิวเตอร์..."
                    value={issueForm.title}
                    onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      ผู้ปฏิบัติ/ผู้ขอออกเลข
                    </label>
                    <input
                      type="text"
                      required
                      value={issueForm.requester}
                      onChange={(e) => setIssueForm({ ...issueForm, requester: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      วันที่เอกสาร
                    </label>
                    <input
                      type="date"
                      required
                      value={issueForm.date}
                      onChange={(e) => setIssueForm({ ...issueForm, date: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    ส่วนราชการเจ้าของเรื่อง (กลุ่มงาน/ฝ่าย)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น กลุ่มวิชาการ"
                    value={issueForm.department}
                    onChange={(e) => setIssueForm({ ...issueForm, department: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={issuing}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50 transition"
                  >
                    {issuing ? "กำลังจดทะเบียน..." : "ออกเลขส่งและแสดงเอกสาร"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── REGISTER INCOMING RECEIVE MODAL (INBOUND) ──────────────── */}
      <AnimatePresence>
        {showReceiveModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-indigo-500" />
                    ลงทะเบียนรับหนังสือราชการภายนอก
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">สามารถนำเข้าอัตโนมัติด้วย URL หนังสือจากระบบ AMSS++</p>
                </div>
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* AMSS Link Scraping Input */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 space-y-2">
                  <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400 block">
                    นำเข้าข้อมูลด่วนจากลิงก์ AMSS++
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="วางลิงก์หน้า bookdetail_receive_sch.php..."
                      value={receiveForm.amssLink}
                      onChange={(e) => setReceiveForm({ ...receiveForm, amssLink: e.target.value })}
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleScrapeAMSS}
                      disabled={scraping}
                      className="px-4 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {scraping ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                      ดึงข้อมูลด่วน
                    </button>
                  </div>
                </div>

                <form onSubmit={handleRegisterReceive} className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      เรื่อง (ชื่อเอกสาร) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ระบุชื่อเรื่องของเอกสารราชการ"
                      value={receiveForm.title}
                      onChange={(e) => setReceiveForm({ ...receiveForm, title: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        หน่วยงานผู้ส่ง (จาก) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น สพม.อุดรธานี"
                        value={receiveForm.senderOrg}
                        onChange={(e) => setReceiveForm({ ...receiveForm, senderOrg: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        เลขที่หนังสือราชการต้นทาง (ที่)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น ศธ 04002/ว..."
                        value={receiveForm.docRefNo}
                        onChange={(e) => setReceiveForm({ ...receiveForm, docRefNo: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        ความเร่งด่วน
                      </label>
                      <select
                        value={receiveForm.urgencyLevel}
                        onChange={(e) => setReceiveForm({ ...receiveForm, urgencyLevel: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                      >
                        <option value="NORMAL">ปกติ</option>
                        <option value="URGENT">ด่วน</option>
                        <option value="URGENT_MORE">ด่วนมาก</option>
                        <option value="URGENT_MOST">ด่วนที่สุด</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        ระบุหมวดงานที่จะมอบหมาย
                      </label>
                      <select
                        value={receiveForm.memoSectionId}
                        onChange={(e) => setReceiveForm({ ...receiveForm, memoSectionId: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                      >
                        <option value="">-- ไม่จัดหมวด --</option>
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        ส่งต่อผู้อื่น (ขั้นที่ 1)
                      </label>
                      <select
                        value={receiveForm.firstAssigneeId}
                        onChange={(e) => setReceiveForm({ ...receiveForm, firstAssigneeId: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                      >
                        <option value="">-- เก็บไว้ก่อน ยังไม่ส่งต่อ --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.position || "ไม่มีตำแหน่ง"})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      ลิงก์ไฟล์แนบเพิ่มเติม (เช่น PDF อัปโหลดภายนอก)
                    </label>
                    <input
                      type="url"
                      placeholder="เช่น ลิงก์เก็บเอกสารบน Google Drive"
                      value={receiveForm.attachmentUrl}
                      onChange={(e) => setReceiveForm({ ...receiveForm, attachmentUrl: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      หมายเหตุเพิ่มเติม
                    </label>
                    <textarea
                      placeholder="กรอกหมายเหตุ (ถ้ามี)..."
                      rows={2}
                      value={receiveForm.note}
                      onChange={(e) => setReceiveForm({ ...receiveForm, note: e.target.value })}
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={savingReceive}
                      className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50 transition"
                    >
                      {savingReceive ? "กำลังลงทะเบียน..." : "ลงทะเบียนรับและส่งต่อเกษียน"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReceiveModal(false)}
                      className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </form>
              </div>
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
                <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
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
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancelDoc}
                    disabled={!cancelReason.trim()}
                    className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition disabled:opacity-50"
                  >
                    ยืนยันการยกเลิกเลข
                  </button>
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setDocToCancel(null);
                    }}
                    className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                  >
                    ย้อนกลับ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AmssImportModal
        isOpen={showAmssImportModal}
        onClose={() => setShowAmssImportModal(false)}
        onRefresh={loadData}
      />
    </motion.div>
  );
}
