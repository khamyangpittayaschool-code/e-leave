"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench, Plus, Search, Filter, RefreshCw,
  Clock, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, Zap, AlertCircle, Loader2, BarChart3, FileText, ListFilter, ClipboardList
} from "lucide-react";
import Link from "next/link";
import { getRepairsAction } from "@/app/actions/repair/update";
import { hasRepairPermission } from "@/lib/permissions";
import RepairSummaryReportView from "./RepairSummaryReportView";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableSkeleton } from "@/components/ui/skeletons";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING:     { label: "รอดำเนินการ",  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   icon: Clock },
  ASSIGNED:    { label: "มอบหมายแล้ว", color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-500/10",     icon: AlertCircle },
  IN_PROGRESS: { label: "กำลังซ่อม",   color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10", icon: Wrench },
  COMPLETED:   { label: "เสร็จสิ้น",   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: CheckCircle2 },
  CANCELLED:   { label: "ยกเลิก",      color: "text-slate-500 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800",     icon: XCircle },
};

const URGENCY_CONFIG: Record<string, { label: string; dot: string }> = {
  NORMAL:      { label: "ปกติ",    dot: "bg-slate-400" },
  URGENT:      { label: "เร่งด่วน", dot: "bg-orange-500" },
  URGENT_MOST: { label: "เร่งด่วนมาก", dot: "bg-red-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: "ไฟฟ้า",
  PLUMBING:   "ประปา",
  BUILDING:   "อาคาร/โครงสร้าง",
  IT:         "อุปกรณ์ IT",
  EQUIPMENT:  "ครุภัณฑ์/เฟอร์นิเจอร์",
  OTHER:      "อื่น ๆ",
};

const FILTER_STATUSES = ["ทั้งหมด", "PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

// ─── Repair Row ───────────────────────────────────────────────────────────────

function RepairRow({ repair, index }: { repair: any; index: number }) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[repair.status] ?? STATUS_CONFIG.PENDING;
  const urg = URGENCY_CONFIG[repair.urgency] ?? URGENCY_CONFIG.LOW;
  const StatusIcon = cfg.icon;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={() => router.push(`/repair/${repair.id}`)}
      className="group cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
    >
      {/* repairNo */}
      <td className="px-6 py-4">
        <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">{repair.repairNo}</span>
      </td>
      {/* title + urgency */}
      <td className="px-6 py-4">
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${urg.dot}`} />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">{repair.title}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{CATEGORY_LABELS[repair.category] ?? repair.category} · {repair.location}</p>
          </div>
        </div>
      </td>
      {/* status */}
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {cfg.label}
        </span>
      </td>
      {/* assignee */}
      <td className="px-6 py-4">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {repair.assignee?.name ?? <span className="text-slate-400 italic">ยังไม่มอบหมาย</span>}
        </span>
      </td>
      {/* date */}
      <td className="px-6 py-4 text-right">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {new Date(repair.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
        </span>
      </td>
      {/* arrow */}
      <td className="px-4 py-4">
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
      </td>
    </motion.tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RepairListPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");

  const [activeTab, setActiveTab] = useState<"list" | "report">("list");

  const user = session?.user as any;
  const canCreate = user && hasRepairPermission(user, "repair:create");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRepairsAction();
      if (res.success) {
        setRepairs(res.repairs || []);
      } else {
        console.error(res.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Computed stats
  const stats = {
    total:      repairs.length,
    pending:    repairs.filter(r => r.status === "PENDING").length,
    inProgress: repairs.filter(r => r.status === "IN_PROGRESS" || r.status === "ASSIGNED").length,
    completed:  repairs.filter(r => r.status === "COMPLETED").length,
  };

  const filtered = repairs.filter(r => {
    const matchStatus = statusFilter === "ทั้งหมด" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) ||
      r.repairNo.toLowerCase().includes(q) || r.location.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 pb-8">

      {/* Page Header (Hidden during print) */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            ระบบแจ้งซ่อม
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">จัดการคำขอแจ้งซ่อมทั้งหมดในโรงเรียน</p>
        </div>
        <div className="flex items-center gap-2">
          {user && hasRepairPermission(user, "repair:dashboard") && (
            <Link href="/dashboard?system=repair">
              <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                แดชบอร์ดวิเคราะห์
              </button>
            </Link>
          )}
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>
          {canCreate && (
            <Link href="/repair/new">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 transition-all"
              >
                <Plus className="w-4 h-4" />
                แจ้งซ่อมใหม่
              </motion.button>
            </Link>
          )}
        </div>
      </div>

      {/* Main Tab Navigation (Hidden during print) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 print:hidden">
        <button
          onClick={() => setActiveTab("list")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "list"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <ListFilter className="w-4 h-4" />
          รายการแจ้งซ่อม
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === "report"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          สรุปการดำเนินงาน (รายเดือน/รอบประเมิน/รายปี)
        </button>
      </div>

      {activeTab === "report" ? (
        <RepairSummaryReportView canViewCost={user ? hasRepairPermission(user, "repair:view.cost") : false} />
      ) : (
        <>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ทั้งหมด"         value={stats.total}      icon={ClipboardList} gradient="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"      delay={0}    />
        <StatCard label="รอดำเนินการ"     value={stats.pending}    icon={Clock}         gradient="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"       delay={0.05} />
        <StatCard label="กำลังดำเนินการ" value={stats.inProgress} icon={Wrench}        gradient="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"      delay={0.10} />
        <StatCard label="เสร็จสิ้น"       value={stats.completed}  icon={CheckCircle2}  gradient="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"     delay={0.15} />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาหมายเลข, ชื่อ, สถานที่..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all shadow-sm"
          />
        </div>
        {/* Status Dropdown Filter */}
        <div className="relative min-w-[180px]">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all shadow-sm cursor-pointer"
          >
            {FILTER_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              const label = cfg ? cfg.label : s;
              return (
                <option key={s} value={s}>
                  สถานะ: {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Wrench className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">ไม่พบรายการแจ้งซ่อม</p>
            <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนตัวกรองหรือแจ้งซ่อมใหม่</p>
            {canCreate && (
              <Link href="/repair/new">
                <button className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform">
                  <Plus className="w-4 h-4" /> แจ้งซ่อมใหม่
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">หมายเลข</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">รายการ</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">สถานะ</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">ช่างที่รับ</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">วันที่แจ้ง</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
                <AnimatePresence>
                  {filtered.map((repair, i) => (
                    <RepairRow key={repair.id} repair={repair} index={i} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

// tiny icon alias for the stat card
const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
