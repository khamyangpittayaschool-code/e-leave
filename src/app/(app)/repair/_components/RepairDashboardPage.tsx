"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Wrench, ArrowLeft, RefreshCw, BarChart3, Clock,
  CheckCircle2, AlertTriangle, AlertCircle, TrendingUp,
  Award, ShieldAlert, Coins, HelpCircle, Archive, Loader2, Download
} from "lucide-react";
import { getRepairDashboardStatsAction } from "@/app/actions/repair/report";
import { archiveRepairsAction } from "@/app/actions/repair/archive";
import { useToast } from "@/components/toast-provider";
import { hasRepairPermission } from "@/lib/permissions";

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: "ไฟฟ้า", PLUMBING: "ประปา", HVAC: "แอร์/พัดลม",
  STRUCTURAL: "โครงสร้าง", FURNITURE: "เฟอร์นิเจอร์", IT_EQUIPMENT: "อุปกรณ์ IT",
  GROUNDS: "พื้นที่/สนาม", OTHER: "อื่น ๆ",
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function DashboardStat({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center justify-between">
      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">{label}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bgClass}`}>
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RepairDashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { showToast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [archiveMonths, setArchiveMonths] = useState(12);

  const user = session?.user as any;
  const isAdmin = user && (user.role === "ADMIN" || user.position === "แอดมิน");
  const canArchive = user && hasRepairPermission(user, "repair:archive");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRepairDashboardStatsAction();
      setData(res);
    } catch (e: any) {
      showToast("error", e?.message ?? "โหลดแดชบอร์ดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && !hasRepairPermission(user, "repair:view.cost")) {
      showToast("error", "คุณไม่มีสิทธิ์เข้าถึงหน้าแดชบอร์ดวิเคราะห์");
      router.push("/repair");
    } else {
      load();
    }
  }, [user, load, router, showToast]);

  const handleArchive = async () => {
    if (!confirm(`ยืนยันการเคลียร์ข้อมูลงานซ่อมที่ปิดแล้ว ย้อนหลัง ${archiveMonths} เดือน?`)) return;
    try {
      setArchiving(true);
      const res = await archiveRepairsAction(archiveMonths);
      showToast("success", res.message);
      load();
    } catch (e: any) {
      showToast("error", e?.message ?? "ย้ายประวัติล้มเหลว");
    } finally {
      setArchiving(false);
    }
  };

  // CSV Export utility
  const exportToCSV = () => {
    if (!data) return;
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Category,Total Tickets,Total Cost (THB)\n";
    data.categories.forEach((cat: any) => {
      csvContent += `"${CATEGORY_LABELS[cat.category] ?? cat.category}",${cat.count},${cat.totalCost}\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `repair_category_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-orange-500" />
              แดชบอร์ดและการวิเคราะห์
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">วิเคราะห์ความล่าช้า (SLA) และประสิทธิภาพของทีมช่าง</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
          >
            <Download className="w-4 h-4" /> ส่งออกรายงาน
          </button>
          <button
            onClick={load}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStat
          label="ค่าซ่อมบำรุงรวมทั้งหมด"
          value={`${data.totalCostOverall.toLocaleString()} บาท`}
          icon={Coins}
          colorClass="text-emerald-600 dark:text-emerald-400"
          bgClass="bg-emerald-50 dark:bg-emerald-500/10"
        />
        <DashboardStat
          label="งานรอดำเนินการ (Active)"
          value={data.sla.totalActive}
          icon={Wrench}
          colorClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-50 dark:bg-blue-500/10"
        />
        <DashboardStat
          label="แจ้งเตือนใกล้ช้ากว่าแผน (Warning)"
          value={data.sla.warningCount}
          icon={AlertCircle}
          colorClass="text-amber-600 dark:text-amber-400"
          bgClass="bg-amber-50 dark:bg-amber-500/10"
        />
        <DashboardStat
          label="ล่าช้ากว่ากำหนด (Overdue)"
          value={`${data.sla.overdueCount} งาน (${data.sla.overduePercentage}%)`}
          icon={ShieldAlert}
          colorClass="text-red-600 dark:text-red-400"
          bgClass="bg-red-50 dark:bg-red-500/10"
        />
      </div>

      {/* Main Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Columns (SLA & Category Breakdown) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Category costs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">สถิติค่าใช้จ่ายแยกตามประเภท</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                    <th className="pb-3">ประเภทงานซ่อม</th>
                    <th className="pb-3 text-center">จำนวนครั้ง</th>
                    <th className="pb-3 text-right">งบประมาณรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80 text-sm">
                  {data.categories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400 italic">ไม่มีข้อมูล</td>
                    </tr>
                  ) : (
                    data.categories.map((cat: any) => (
                      <tr key={cat.category} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">
                          {CATEGORY_LABELS[cat.category] ?? cat.category}
                        </td>
                        <td className="py-3 text-center font-semibold">{cat.count}</td>
                        <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                          {cat.totalCost.toLocaleString()} บาท
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">สถิติสรุปงานซ่อมรายเดือน</h3>
            <div className="space-y-3">
              {data.monthlyTrend.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-6">ไม่มีข้อมูล</p>
              ) : (
                data.monthlyTrend.map((trend: any) => {
                  const pct = trend.count > 0 ? Math.round((trend.completed / trend.count) * 100) : 0;
                  return (
                    <div key={trend.month} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>{trend.month}</span>
                        <span>สำเร็จ {trend.completed} จาก {trend.count} งาน ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Technicians & Archiving) */}
        <div className="space-y-5">
          
          {/* Technicians Leaderboard */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-orange-500" /> ประสิทธิภาพของทีมช่าง
            </h3>
            <div className="space-y-4">
              {data.technicians.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-6">ยังไม่มีช่างได้รับมอบหมายงาน</p>
              ) : (
                data.technicians.map((tech: any) => (
                  <div key={tech.id} className="flex items-start justify-between border-b border-slate-50 dark:border-slate-800/80 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tech.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        รับ {tech.assignedCount} งาน | เสร็จ {tech.completedCount} งาน
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-400">เวลาซ่อมเฉลี่ย</p>
                      <p className="text-sm font-black text-orange-500">{tech.avgResolutionHours} ชม.</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Admin Archiving Control */}
          {canArchive && (
            <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
              <h3 className="text-sm font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                <Archive className="w-4 h-4" /> จัดการพื้นที่เก็บข้อมูล (Archive)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                ย้ายงานซ่อมที่สิ้นสุดการดำเนินการแล้ว (COMPLETED/CANCELLED) และไม่มีการเคลื่อนไหวในช่วงระยะเวลาที่กำหนด เข้าตารางเก็บสำรองเพื่อความรวดเร็วของระบบ
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">เงื่อนไขอายุมิเคลื่อนไหว:</label>
                  <select
                    value={archiveMonths}
                    onChange={e => setArchiveMonths(Number(e.target.value))}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    <option value={3}>3 เดือนขึ้นไป</option>
                    <option value={6}>6 เดือนขึ้นไป</option>
                    <option value={12}>12 เดือนขึ้นไป (แนะนำ)</option>
                    <option value={24}>24 เดือนขึ้นไป</option>
                  </select>
                </div>
                <button
                  disabled={archiving}
                  onClick={handleArchive}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/25 flex items-center justify-center gap-2"
                >
                  {archiving ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังจัดเก็บ...</>
                  ) : (
                    <><Archive className="w-3.5 h-3.5" /> ดำเนินการย้ายประวัติข้อมูล</>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
