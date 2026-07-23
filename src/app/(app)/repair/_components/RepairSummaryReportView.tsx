"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Calendar, Filter, Printer, Download,
  CheckCircle2, Clock, Wrench, AlertTriangle, XCircle,
  Loader2, RefreshCw, BarChart2, DollarSign
} from "lucide-react";
import { getRepairSummaryReportAction } from "@/app/actions/repair/report";
import { useToast } from "@/components/toast-provider";

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: "ระบบไฟฟ้า",
  PLUMBING: "ระบบประปา",
  BUILDING: "อาคาร/สถานที่",
  IT: "อุปกรณ์ IT/คอมพิวเตอร์",
  EQUIPMENT: "ครุภัณฑ์/เฟอร์นิเจอร์",
  OTHER: "งานซ่อมทั่วไป/อื่น ๆ",
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "รอดำเนินการ", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  ASSIGNED: { label: "มอบหมายแล้ว", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  IN_PROGRESS: { label: "กำลังซ่อม", cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
  COMPLETED: { label: "เสร็จสิ้น", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  CANCELLED: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export default function RepairSummaryReportView({ canViewCost = true }: { canViewCost?: boolean }) {
  const { showToast } = useToast();
  const currentBuddhistYear = new Date().getFullYear() + 543;

  const [fiscalYear, setFiscalYear] = useState<number>(currentBuddhistYear);
  const [period, setPeriod] = useState<"ALL" | "ROUND_1" | "ROUND_2" | "MONTH">("ALL");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRepairSummaryReportAction({
        fiscalYear,
        period,
        month: period === "MONTH" ? month : undefined,
      });
      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        showToast("error", res.error || "ดึงรายงานไม่สำเร็จ");
      }
    } catch (e: any) {
      showToast("error", e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, period, month, showToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Global CSS for Clean Print Output */}
      <style jsx global>{`
        @media print {
          /* Hide app navbar, sidebar, page title header, and tabs */
          header, nav, .print\:hidden {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5 shadow-sm space-y-4 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">รายงานสรุปผลการดำเนินงานแจ้งซ่อม</h2>
              <p className="text-xs text-slate-500">เลือกปีงบประมาณและรอบประเมินที่ต้องการสรุป</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              รีเฟรช
            </button>
            <button
              onClick={handlePrint}
              disabled={!reportData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              พิมพ์รายงานสรุป
            </button>
          </div>
        </div>

        {/* Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">ปีงบประมาณ</label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
            >
              {[0, -1, -2, -3].map((offset) => {
                const y = currentBuddhistYear + offset;
                return (
                  <option key={y} value={y}>
                    ปีงบประมาณ {y}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">ช่วงเวลาสรุป</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
            >
              <option value="ALL">ทั้งปีงบประมาณ (1 ต.ค. - 30 ก.ย.)</option>
              <option value="ROUND_1">รอบที่ 1 (1 ต.ค. - 31 มี.ค.)</option>
              <option value="ROUND_2">รอบที่ 2 (1 เม.ย. - 30 ก.ย.)</option>
              <option value="MONTH">รายเดือน</option>
            </select>
          </div>

          {period === "MONTH" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">เลือกเดือน</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      )}

      {/* Report View */}
      {!loading && reportData && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-6 md:p-8 space-y-6 shadow-sm print:p-0 print:border-none print:shadow-none">
          {/* Printable Header */}
          <div className="text-center space-y-1 pb-4 border-b border-slate-200 dark:border-slate-800">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              แบบสรุปผลการดำเนินงานระบบแจ้งซ่อมแซมวัสดุ/ครุภัณฑ์/อาคารสถานที่
            </h1>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {reportData.period === "ALL" && `ประจำปีงบประมาณ พ.ศ. ${reportData.fiscalYear}`}
              {reportData.period === "ROUND_1" && `รอบที่ 1 (1 ตุลาคม - 31 มีนาคม) ประจำปีงบประมาณ พ.ศ. ${reportData.fiscalYear}`}
              {reportData.period === "ROUND_2" && `รอบที่ 2 (1 เมษายน - 30 กันยายน) ประจำปีงบประมาณ พ.ศ. ${reportData.fiscalYear}`}
              {reportData.period === "MONTH" && `ประจำเดือน ${MONTH_NAMES[(reportData.month || 1) - 1]} ปีงบประมาณ พ.ศ. ${reportData.fiscalYear}`}
            </p>
          </div>

          {/* Stats Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">คำขอแจ้งซ่อมทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{reportData.totalRequests} รายการ</p>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">เสร็จสิ้นแล้ว</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{reportData.statusCounts.COMPLETED} รายการ</p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-xl border border-orange-200/50 dark:border-orange-900/30">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">อัตราความสำเร็จ</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">{reportData.completionRate}%</p>
            </div>

            {canViewCost && (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200/50 dark:border-blue-900/30">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">รวมค่าใช้จ่ายทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                  {reportData.totalCost.toLocaleString("th-TH")} บาท
                </p>
              </div>
            )}
          </div>

          {/* Category Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-orange-500" />
              สรุปแยกตามประเภทการแจ้งซ่อม
            </h3>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    <th className="px-4 py-2.5 text-left font-bold">หมวดหมู่งานซ่อม</th>
                    <th className="px-4 py-2.5 text-center font-bold">จำนวนคำขอ</th>
                    <th className="px-4 py-2.5 text-center font-bold">สัดส่วน (%)</th>
                    {canViewCost && <th className="px-4 py-2.5 text-right font-bold">รวมค่าใช้จ่าย (บาท)</th>}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => {
                    const item = reportData.categoryBreakdown[catKey] || { count: 0, cost: 0 };
                    const percent = reportData.totalRequests > 0 ? Math.round((item.count / reportData.totalRequests) * 100) : 0;
                    return (
                      <tr key={catKey} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{label}</td>
                        <td className="px-4 py-2.5 text-center font-semibold">{item.count}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{percent}%</td>
                        {canViewCost && (
                          <td className="px-4 py-2.5 text-right font-mono font-medium">{item.cost.toLocaleString("th-TH")}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Request List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              รายการคำขอซ่อมในงวดประเมิน ({reportData.requestsList.length} รายการ)
            </h3>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    <th className="px-3 py-2.5 text-left font-bold">เลขที่</th>
                    <th className="px-3 py-2.5 text-left font-bold">หัวข้อการแจ้งซ่อม</th>
                    <th className="px-3 py-2.5 text-left font-bold">ผู้แจ้ง</th>
                    <th className="px-3 py-2.5 text-left font-bold">ช่างผู้ซ่อม</th>
                    <th className="px-3 py-2.5 text-center font-bold">สถานะ</th>
                    {canViewCost && <th className="px-3 py-2.5 text-right font-bold">ค่าซ่อม (บาท)</th>}
                  </tr>
                </thead>
                <tbody>
                  {reportData.requestsList.length === 0 ? (
                    <tr>
                      <td colSpan={canViewCost ? 6 : 5} className="py-8 text-center text-slate-400">
                        ไม่พบรายการแจ้งซ่อมในช่วงเวลานี้
                      </td>
                    </tr>
                  ) : (
                    reportData.requestsList.map((r: any) => {
                      const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                      return (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <td className="px-3 py-2.5 font-mono font-semibold text-slate-500">{r.repairNo}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{r.title}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.requesterName}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.assigneeName}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}`}>
                              {cfg.label}
                            </span>
                          </td>
                          {canViewCost && (
                            <td className="px-3 py-2.5 text-right font-mono font-medium">
                              {r.cost > 0 ? r.cost.toLocaleString("th-TH") : "-"}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
