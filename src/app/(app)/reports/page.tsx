"use client";

import { useState, useEffect } from "react";
import { getCycleReport } from "@/app/actions/admin";
import { getLeaveConfigs } from "@/app/actions/settings";
import { motion } from "framer-motion";
import { Printer, Download, FileSpreadsheet, CalendarDays, CheckCircle2, XCircle, Clock } from "lucide-react";
import * as XLSX from "xlsx";
import { useI18n } from "@/lib/i18n";

export default function ReportsPage() {
  const [cycle, setCycle] = useState<"current" | "cycle1" | "cycle2" | "year">("current");
  const [viewMode, setViewMode] = useState<"overview" | "individual">("overview");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const { t, tLeaveType } = useI18n();

  // Helper to dynamically get current BE Fiscal Year
  const getCurrentFiscalYear = () => {
    const now = new Date();
    const month = now.getMonth();
    const calendarYear = now.getFullYear();
    // October (9) starts the next Fiscal Year
    return (month >= 9 ? calendarYear + 1 : calendarYear) + 543;
  };

  const currentFY = getCurrentFiscalYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentFY - i);
  const [fiscalYear, setFiscalYear] = useState<number>(currentFY);

  // States for batch printing
  const [batchYear, setBatchYear] = useState<number>(currentFY);
  const [batchStart, setBatchStart] = useState<number>(1);
  const [batchEnd, setBatchEnd] = useState<number>(50);
  const [batchFilterType, setBatchFilterType] = useState<"sequence" | "year" | "cycle1" | "cycle2" | "month">("sequence");
  const [batchMonth, setBatchMonth] = useState<number>(new Date().getMonth() + 1);

  const handleBatchPdfDownload = () => {
    if (batchFilterType === "sequence") {
      if (batchStart > batchEnd) {
        alert("ลำดับเริ่มต้นต้องไม่เกินลำดับสิ้นสุด");
        return;
      }
      window.open(`/print/leave/batch?year=${batchYear}&start=${batchStart}&end=${batchEnd}&filterType=sequence`, "_blank");
    } else if (batchFilterType === "month") {
      window.open(`/print/leave/batch?year=${batchYear}&filterType=month&monthVal=${batchMonth}`, "_blank");
    } else {
      window.open(`/print/leave/batch?year=${batchYear}&filterType=${batchFilterType}`, "_blank");
    }
  };

  const getCycleLabel = () => {
    switch (cycle) {
      case "cycle1": return `รอบที่ 1 (ต.ค. - มี.ค.) ปีงบประมาณ ${fiscalYear}`;
      case "cycle2": return `รอบที่ 2 (เม.ย. - ก.ย.) ปีงบประมาณ ${fiscalYear}`;
      case "year": return `ทั้งปีงบประมาณ ${fiscalYear}`;
      default: return `รอบปัจจุบัน ปีงบประมาณ ${fiscalYear}`;
    }
  };

  const [leaveConfigs, setLeaveConfigs] = useState<any[]>([]);

  const leaveTypeMap = leaveConfigs.reduce((acc: any, curr: any) => {
    acc[curr.type] = curr.name;
    return acc;
  }, {} as Record<string, string>);

  const statusMap: Record<string, string> = { APPROVED: t("approvedStatus"), REJECTED: t("rejectedStatus"), CANCELLED: t("cancelledStatus"), PENDING_HEAD: t("pendingHead"), PENDING_EXEC: t("pendingExec") };

  useEffect(() => {
    getLeaveConfigs().then(setLeaveConfigs).catch(console.error);
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setFetched(false);
    try {
      const result = await getCycleReport(cycle, fiscalYear);
      setData(result);
      setFetched(true);
    } catch {
      alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const individualData = Object.values(data.reduce((acc: any, curr: any) => {
    if (curr.status !== "APPROVED") return acc;
    if (!acc[curr.userName]) {
      acc[curr.userName] = { userName: curr.userName, position: curr.position, totalTimes: 0, totalDays: 0, leaves: {} };
    }
    acc[curr.userName].totalTimes++;
    const days = Math.ceil((new Date(curr.endDate).getTime() - new Date(curr.startDate).getTime()) / (1000*60*60*24)) + 1;
    acc[curr.userName].totalDays += days;
    const tName = leaveTypeMap[curr.type] || curr.type;
    if (!acc[curr.userName].leaves[tName]) acc[curr.userName].leaves[tName] = 0;
    acc[curr.userName].leaves[tName] += days;
    return acc;
  }, {}));

  const handleExportExcel = () => {
    if (viewMode === "overview") {
      const formatted = data.map(item => ({
        "เลขที่ใบลา": item.status === "APPROVED" 
          ? `อนุมัติที่ ${item.approvedSeq || "-"}/${item.fiscalYear || "-"}` 
          : `คำขอที่ ${item.pendingSeq || "-"}/${item.fiscalYear || "-"}`,
        "ชื่อ-นามสกุล": item.userName,
        "ตำแหน่ง": item.position,
        "กลุ่มสาระ": item.subjectGroup,
        "ประเภท": leaveTypeMap[item.type] || item.type,
        "วันที่เริ่ม": new Date(item.startDate).toLocaleDateString("th-TH"),
        "ถึงวันที่": new Date(item.endDate).toLocaleDateString("th-TH"),
        "จำนวนวัน": Math.ceil((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000*60*60*24)) + 1,
        "เหตุผล": item.reason,
        "สถานะ": statusMap[item.status] || item.status,
        "วันที่ยื่น": new Date(item.createdAt).toLocaleDateString("th-TH"),
      }));

      const ws = XLSX.utils.json_to_sheet(formatted);
      ws["!cols"] = [{ wch: 18 },{ wch: 25 },{ wch: 15 },{ wch: 20 },{ wch: 12 },{ wch: 14 },{ wch: 14 },{ wch: 10 },{ wch: 40 },{ wch: 15 },{ wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "รายงานการลา_ภาพรวม");
      XLSX.writeFile(wb, `รายงานการลา_${cycle}.xlsx`);
    } else {
      const formatted = individualData.map((item: any) => {
        const row: any = {
          "ชื่อ-นามสกุล": item.userName,
          "ตำแหน่ง": item.position,
          "ลาทั้งหมด (ครั้ง)": item.totalTimes,
          "ลาทั้งหมด (วัน)": item.totalDays,
        };
        leaveConfigs.forEach(c => {
          row[c.name] = item.leaves[c.name] || 0;
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(formatted);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "รายงานการลา_รายบุคคล");
      XLSX.writeFile(wb, `รายงานการลา_รายบุคคล_${cycle}.xlsx`);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("กรุณาอนุญาต Pop-up เพื่อพิมพ์เอกสาร");
      return;
    }

    const titleText = viewMode === "overview" ? "รายงานสรุปการลา (ภาพรวม)" : "รายงานสรุปการลา (รายบุคคล)";
    const dateText = `พิมพ์เมื่อ ${new Date().toLocaleDateString("th-TH")} ${new Date().toLocaleTimeString("th-TH")} น.`;

    let contentHtml = "";

    if (viewMode === "overview") {
      const statsHtml = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 8px; background: #fafafa;">
            <div style="font-size: 11px; color: #666; font-weight: bold;">คำขอทั้งหมด</div>
            <div style="font-size: 18px; font-weight: bold; margin-top: 4px;">${totalRequests} รายการ</div>
          </div>
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 8px; background: #fafafa;">
            <div style="font-size: 11px; color: #666; font-weight: bold;">อนุมัติแล้ว</div>
            <div style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #10b981;">${approvedCount} รายการ</div>
          </div>
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 8px; background: #fafafa;">
            <div style="font-size: 11px; color: #666; font-weight: bold;">ถูกปฏิเสธ</div>
            <div style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #ef4444;">${rejectedCount} รายการ</div>
          </div>
          <div style="border: 1px solid #ddd; padding: 12px; border-radius: 8px; background: #fafafa;">
            <div style="font-size: 11px; color: #666; font-weight: bold;">วันลารวม (อนุมัติ)</div>
            <div style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #3b82f6;">${totalDays} วัน</div>
          </div>
        </div>
      `;

      const rows = data.map((item, i) => {
        const days = Math.ceil((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000*60*60*24)) + 1;
        return `
          <tr>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;">${i + 1}</td>
            <td style="border:1px solid #ddd;padding:8px;font-size:11px;">
              ${item.status === "APPROVED" 
                ? `<span style="color:#059669;font-weight:bold;">อนุมัติที่ ${item.approvedSeq}/${item.fiscalYear}</span>` 
                : `<span style="color:#64748b;">คำขอที่ ${item.pendingSeq}/${item.fiscalYear}</span>`}
            </td>
            <td style="border:1px solid #ddd;padding:8px;font-weight:bold;">${item.userName}</td>
            <td style="border:1px solid #ddd;padding:8px;">${item.position}</td>
            <td style="border:1px solid #ddd;padding:8px;">${leaveTypeMap[item.type] || item.type}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;font-size:11px;">
              ${new Date(item.startDate).toLocaleDateString("th-TH")} - ${new Date(item.endDate).toLocaleDateString("th-TH")}
            </td>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;font-weight:bold;">${days}</td>
            <td style="border:1px solid #ddd;padding:8px;font-size:11px;word-break:break-all;">${item.reason || "-"}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;">${statusMap[item.status] || item.status}</td>
          </tr>
        `;
      }).join("");

      contentHtml = `
        ${statsHtml}
        <table>
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th style="width:15%;">เลขที่ใบลา</th>
              <th style="width:18%;">ชื่อ-นามสกุล</th>
              <th style="width:12%;">ตำแหน่ง</th>
              <th style="width:12%;">ประเภท</th>
              <th style="width:18%;">วันที่ลา</th>
              <th style="width:8%;text-align:center;">จำนวนวัน</th>
              <th style="width:22%;">เหตุผล</th>
              <th style="width:10%;text-align:center;">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:20px;color:#999;">ไม่พบข้อมูลการลา</td></tr>' : rows}
          </tbody>
        </table>
        <div style="margin-top: 20px; text-align: right; font-size: 12px; color: #666;">
          คำขอลาทั้งหมดในรอบนี้: ${data.length} รายการ
        </div>
      `;
    } else {
      // Individual mode
      const headers = leaveConfigs.map(c => `
        <th style="text-align:center;font-size:10px;padding:6px 4px;">
          ${c.name}
        </th>
      `).join("");

      const rows = individualData.map((item: any, i) => {
        const leaveCols = leaveConfigs.map(c => `
          <td style="border:1px solid #ddd;padding:6px 4px;text-align:center;">
            ${item.leaves[c.name] || "-"}
          </td>
        `).join("");

        return `
          <tr>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;">${i + 1}</td>
            <td style="border:1px solid #ddd;padding:8px;font-weight:bold;">${item.userName}</td>
            <td style="border:1px solid #ddd;padding:8px;">${item.position}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;font-weight:bold;">${item.totalTimes}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;font-weight:bold;color:#2563eb;">${item.totalDays}</td>
            ${leaveCols}
          </tr>
        `;
      }).join("");

      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th style="width:20%;">ชื่อ-นามสกุล</th>
              <th style="width:12%;">ตำแหน่ง</th>
              <th style="width:8%;text-align:center;font-size:10px;">ลาทั้งหมด<br/>(ครั้ง)</th>
              <th style="width:8%;text-align:center;font-size:10px;">รวม<br/>(วัน)</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="' + (5 + leaveConfigs.length) + '" style="text-align:center;padding:20px;color:#999;">ไม่พบข้อมูลการลาที่อนุมัติแล้ว</td></tr>' : rows}
          </tbody>
        </table>
        <div style="margin-top: 20px; text-align: right; font-size: 12px; color: #666;">
          จำนวนบุคลากรทั้งหมดที่ลา: ${individualData.length} คน
        </div>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${titleText}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Sarabun', sans-serif; padding: 40px; color: #333; line-height: 1.4; }
          h1 { text-align: center; font-size: 20px; margin-bottom: 4px; }
          .subtitle { text-align: center; font-size: 12px; color: #666; margin-bottom: 25px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
          th { background: #f5f5f5; border: 1px solid #ddd; padding: 10px 8px; font-weight: 700; text-align: center; color: #444; }
          td { border: 1px solid #ddd; padding: 8px; vertical-align: middle; word-wrap: break-word; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          @media print { 
            body { padding: 20px; } 
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <h1>${titleText}</h1>
        <p class="subtitle">ประจำ${getCycleLabel()} | ${dateText}</p>
        ${contentHtml}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED": return <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{statusMap[status]}</span>;
      case "REJECTED": return <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><XCircle className="w-3.5 h-3.5" />{statusMap[status]}</span>;
      default: return <span className="inline-flex items-center gap-1 text-orange-500"><Clock className="w-3.5 h-3.5" />{statusMap[status] || status}</span>;
    }
  };

  const totalRequests = data.length;
  const approvedCount = data.filter(d => d.status === "APPROVED").length;
  const rejectedCount = data.filter(d => d.status === "REJECTED").length;
  const totalDays = data.filter(d => d.status === "APPROVED").reduce((sum, d) => sum + Math.ceil((new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / (1000*60*60*24)) + 1, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white print:text-black">{t("reportsTitle")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 print:hidden">{t("reportsSubtitle")}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 print:hidden">
        <div className="grid grid-cols-2 md:flex md:flex-row gap-3 flex-1">
          <select value={cycle} onChange={(e: any) => setCycle(e.target.value)} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full">
            <option value="current">{t("currentCycle")}</option>
            <option value="cycle1">{t("cycle1Label")}</option>
            <option value="cycle2">{t("cycle2Label")}</option>
            <option value="year">{t("fullYear")}</option>
          </select>
          <select value={fiscalYear} onChange={(e: any) => setFiscalYear(Number(e.target.value))} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full">
            {availableYears.map(yr => (
              <option key={yr} value={yr}>{t("fiscalYearLabel")} {yr}</option>
            ))}
          </select>
          <select value={viewMode} onChange={(e: any) => setViewMode(e.target.value)} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full">
            <option value="overview">{t("overviewMode")}</option>
            <option value="individual">{t("individualMode")}</option>
          </select>
          <button onClick={fetchReport} disabled={loading} className="h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 w-full md:w-auto">
            <CalendarDays className="w-4 h-4" />
            {loading ? t("fetching") : t("fetchReport")}
          </button>
        </div>

        {fetched && (data.length > 0 || individualData.length > 0) && (
          <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:flex-row">
            <button onClick={handleExportExcel} className="h-11 px-4 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 font-medium text-sm border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center justify-center gap-2 w-full md:w-auto">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={handlePrint} className="h-11 px-4 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 font-medium text-sm border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center gap-2 w-full md:w-auto">
              <Printer className="w-4 h-4" /> {t("printBtn")}
            </button>
          </div>
        )}
      </div>

      {fetched && viewMode === "overview" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
          {[
            { label: t("totalRequests"), value: `${totalRequests} ${t("items")}`, color: "text-slate-900 dark:text-white" },
            { label: t("approvedStatus"), value: `${approvedCount} ${t("items")}`, color: "text-emerald-600 dark:text-emerald-400" },
            { label: t("rejectedStatus"), value: `${rejectedCount} ${t("items")}`, color: "text-rose-600 dark:text-rose-400" },
            { label: t("totalLeaveDays"), value: `${totalDays} ${t("daysUnit")}`, color: "text-blue-600 dark:text-blue-400" },
          ].map((stat, i) => (
            <div key={i} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-2xl p-4 shadow-[0_4px_15px_rgb(0,0,0,0.03)] print:border-slate-300 print:shadow-none">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-gray-500">{stat.label}</p>
              <p className={`text-xl font-bold mt-1 ${stat.color} print:text-black`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="hidden print:block text-center mb-4">
        <h2 className="text-lg font-bold">รายงานสรุปการลา ({viewMode === "overview" ? "ภาพรวม" : "รายบุคคล"})</h2>
        <p className="text-sm text-gray-600 mt-1">ประจำ{getCycleLabel()}</p>
      </div>

      {fetched && viewMode === "overview" && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden print:rounded-none print:shadow-none print:border-none print:overflow-visible">
          {data.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400"><CalendarDays className="w-10 h-10 mb-3 text-slate-300 dark:text-slate-600" /><p className="text-sm">{t("noLeaveData")}</p></div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal print:break-inside-auto">
                <thead className="print:table-header-group">
                  <tr className="border-b border-slate-100 dark:border-slate-800 print:border-slate-400">
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700">#</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700">เลขที่ใบลา</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700">{t("fullName")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700">{t("position")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700">{t("type")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700">{t("leaveDate")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 print:border print:border-gray-300 print:bg-gray-50 text-center">{t("days")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 print:border print:border-gray-300 print:bg-gray-50">{t("reason")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 print:border print:border-gray-300 print:bg-gray-50">{t("status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-none">
                  {data.map((item, i) => {
                    const days = Math.ceil((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000*60*60*24)) + 1;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors print:hover:bg-transparent print:break-inside-avoid">
                        <td className="px-4 py-3 text-slate-400 print:text-black print:border print:border-gray-300">{i + 1}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 print:text-black print:border print:border-gray-300 text-xs">
                          {item.status === "APPROVED" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              อนุมัติที่ {item.approvedSeq}/{item.fiscalYear}
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">
                              คำขอที่ {item.pendingSeq}/{item.fiscalYear}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white print:text-black print:border print:border-gray-300">{item.userName}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs print:text-black print:border print:border-gray-300">{item.position}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 print:text-black print:border print:border-gray-300">{tLeaveType(item.type, leaveTypeMap[item.type])}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs print:text-black print:border print:border-gray-300">{new Date(item.startDate).toLocaleDateString("th-TH")} - {new Date(item.endDate).toLocaleDateString("th-TH")}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white print:text-black text-center print:border print:border-gray-300">{days}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate text-xs print:max-w-none print:whitespace-normal print:text-black print:border print:border-gray-300">{item.reason}</td>
                        <td className="px-4 py-3 text-xs font-medium print:border print:border-gray-300 print:text-black">{statusMap[item.status] || item.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {fetched && viewMode === "individual" && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden print:rounded-none print:shadow-none print:border-none print:overflow-visible">
          {individualData.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400"><CalendarDays className="w-10 h-10 mb-3 text-slate-300 dark:text-slate-600" /><p className="text-sm">{t("noApprovedLeaveData")}</p></div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal print:break-inside-auto print:table-fixed">
                <thead className="print:table-header-group">
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 print:border print:border-gray-300 print:bg-gray-50 print:w-8">#</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 print:border print:border-gray-300 print:bg-gray-50 print:w-40">{t("fullName")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 print:border print:border-gray-300 print:bg-gray-50 print:w-24">{t("position")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 text-center print:border print:border-gray-300 print:bg-gray-50 print:w-16 text-xs">{t("totalTimes")}</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 text-center print:border print:border-gray-300 print:bg-gray-50 print:w-16 text-xs">{t("totalDaysCol")}</th>
                    {leaveConfigs.map(c => {
                      const name = tLeaveType(c.type, c.name);
                      return (
                      <th key={c.type} className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 print:text-gray-700 text-center print:border print:border-gray-300 print:bg-gray-50 text-xs">
                        {name.length > 10 ? name.substring(0, 10) + '..' : name}
                      </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-none">
                  {individualData.map((item: any, i) => (
                    <tr key={item.userName} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors print:hover:bg-transparent print:break-inside-avoid">
                      <td className="px-4 py-3 text-slate-400 print:text-black print:border print:border-gray-300 print:text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white print:text-black print:border print:border-gray-300 print:text-xs print:whitespace-nowrap overflow-hidden text-ellipsis">{item.userName}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs print:text-black print:border print:border-gray-300 print:text-[10px] print:whitespace-nowrap overflow-hidden text-ellipsis">{item.position}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white print:text-black text-center print:border print:border-gray-300 print:text-xs">{item.totalTimes}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 text-center print:text-black print:border print:border-gray-300 print:text-xs">{item.totalDays}</td>
                      {leaveConfigs.map(c => (
                        <td key={c.type} className="px-4 py-3 text-slate-500 dark:text-slate-400 text-center print:text-black print:border print:border-gray-300 print:text-[11px]">{item.leaves[c.name] || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Batch PDF Download Section */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] print:hidden mt-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
          <Download className="w-5 h-5 text-purple-500" />
          ดาวน์โหลดใบลาแบบกลุ่ม (PDF)
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          ระบุเงื่อนไข ปีงบประมาณ หรือช่วงเวลาที่ต้องการดึงข้อมูลใบลาที่ได้รับการอนุมัติแล้วเพื่อพิมพ์ออกเป็น PDF ทั้งหมดพร้อมกัน
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">ปีงบประมาณ</label>
            <select 
              value={batchYear} 
              onChange={(e) => setBatchYear(Number(e.target.value))}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>ปีงบประมาณ {yr}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">เงื่อนไขการดึงข้อมูล</label>
            <select 
              value={batchFilterType} 
              onChange={(e) => setBatchFilterType(e.target.value as any)}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full cursor-pointer"
            >
              <option value="sequence">ตามช่วงลำดับเลขอ้างอิง</option>
              <option value="year">ทั้งหมดของปีงบประมาณ</option>
              <option value="cycle1">รอบที่ 1 (ต.ค. - มี.ค.)</option>
              <option value="cycle2">รอบที่ 2 (เม.ย. - ก.ย.)</option>
              <option value="month">รอบเดือน (ระบุเดือน)</option>
            </select>
          </div>

          {batchFilterType === "sequence" && (
            <>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">จากลำดับอนุมัติที่</label>
                <input 
                  type="number" 
                  min={1}
                  value={batchStart} 
                  onChange={(e) => setBatchStart(Math.max(1, Number(e.target.value)))}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">ถึงลำดับอนุมัติที่</label>
                <input 
                  type="number" 
                  min={1}
                  value={batchEnd} 
                  onChange={(e) => setBatchEnd(Math.max(1, Number(e.target.value)))}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full" 
                />
              </div>
            </>
          )}

          {batchFilterType === "month" && (
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">เลือกเดือน</label>
              <select 
                value={batchMonth} 
                onChange={(e) => setBatchMonth(Number(e.target.value))}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-full cursor-pointer"
              >
                <option value={10}>ตุลาคม</option>
                <option value={11}>พฤศจิกายน</option>
                <option value={12}>ธันวาคม</option>
                <option value={1}>มกราคม</option>
                <option value={2}>กุมภาพันธ์</option>
                <option value={3}>มีนาคม</option>
                <option value={4}>เมษายน</option>
                <option value={5}>พฤษภาคม</option>
                <option value={6}>มิถุนายน</option>
                <option value={7}>กรกฎาคม</option>
                <option value={8}>สิงหาคม</option>
                <option value={9}>กันยายน</option>
              </select>
            </div>
          )}

          <div className={batchFilterType === "sequence" ? "md:col-span-2" : (batchFilterType === "month" ? "md:col-span-2" : "md:col-span-6")}>
            <button 
              onClick={handleBatchPdfDownload}
              className="h-10 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer w-full"
            >
              <Printer className="w-4.5 h-4.5" />
              ดาวน์โหลด PDF
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
