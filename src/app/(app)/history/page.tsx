"use client";

import { useState, useEffect, useRef } from "react";
import { getMyLeaveHistory, cancelLeaveRequest, getStaffList, adminDeleteLeaveRequest } from "@/app/actions/leave";
import { getLeaveConfigs } from "@/app/actions/settings";
import { useSession } from "@/lib/auth-client";
import { format } from "date-fns";
import { CalendarDays, Clock, FileX, CheckCircle2, XCircle, Download, Printer, FileSpreadsheet, Paperclip } from "lucide-react";
import * as XLSX from "xlsx";
import { CycleSelect } from "@/components/cycle-select";
import { useSearchParams } from "next/navigation";
import { getLeaveCycleFilter } from "@/lib/cycle";
import { useI18n } from "@/lib/i18n";

const handleViewAttachment = (preview: string, fileName?: string) => {
  if (preview.startsWith("data:")) {
    try {
      const parts = preview.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.error("Failed to open data URL", e);
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(
          `<iframe src="${preview}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
      }
    }
  } else {
    window.open(preview, '_blank');
  }
};

export default function HistoryPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.position === "แอดมิน";
  const isHR = (session?.user as any)?.position === "หัวหน้างานบุคคล";
  
  const searchParams = useSearchParams();
  const cycleParam = searchParams.get("cycle") || "all";
  const { t, lang, tLeaveType, tPosition } = useI18n();

  const calculateDays = (startDateStr: string, endDateStr: string, type: string): number => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    
    if (type === "MATERNITY") {
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const [history, setHistory] = useState<any[]>([]);
  const [leaveConfigs, setLeaveConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("me");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const printRef = useRef<HTMLDivElement>(null);

  const filteredHistory = history.filter((item) => {
    if (selectedStatus === "all") return true;
    if (selectedStatus === "pending") {
      return item.status === "PENDING_HEAD" || item.status === "PENDING_EXEC";
    }
    if (selectedStatus === "approved") {
      return item.status === "APPROVED";
    }
    if (selectedStatus === "rejected") {
      return item.status === "REJECTED" || item.status === "CANCELLED";
    }
    return true;
  });

  const getCycleLabel = () => {
    if (cycleParam === "all") {
      return t("allFiscalYears");
    }
    const filter = getLeaveCycleFilter(new Date(), cycleParam as any, lang);
    return filter ? filter.label : t("currentCycle");
  };

  const getCycleLabelTh = () => {
    if (cycleParam === "all") {
      return "ทั้งหมดทุกปีงบประมาณ";
    }
    const filter = getLeaveCycleFilter(new Date(), cycleParam as any, "th");
    return filter ? filter.label : "รอบปัจจุบัน";
  };

  useEffect(() => {
    getStaffList().then(setStaffList).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    setCurrentPage(1);
    Promise.all([
      getMyLeaveHistory(cycleParam as any, selectedUserId),
      getLeaveConfigs()
    ]).then(([h, c]) => {
      setHistory(h);
      setLeaveConfigs(c);
    }).catch(console.error).finally(() => setLoading(false));
  }, [cycleParam, selectedUserId]);

  const getLeaveTypeName = (type: string) => {
    const config = leaveConfigs.find((c) => c.type === type);
    return tLeaveType(type, config?.name);
  };

  const getLeaveTypeNameTh = (type: string, dbName?: string) => {
    const thMap: Record<string, string> = {
      SICK: "ลาป่วย",
      PERSONAL: "ลากิจส่วนตัว",
      VACATION: "ลาพักผ่อน",
      ORDINATION: "ลาอุปสมบท/ฮัจญ์",
      MATERNITY: "ลาคลอดบุตร",
      PATERNITY: "ลาช่วยเหลือภริยาคลอดบุตร",
      INTERNATIONAL: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
      SPOUSE: "ลาติดตามคู่สมรส",
      REHABILITATION: "ลาฟื้นฟูสมรรถภาพด้านอาชีพ",
      MILITARY: "ลาเข้ารับการตรวจเลือกหรือเตรียมพล",
      STUDY: "ลาศึกษาต่อ/ฝึกอบรม",
    };
    return thMap[type] || dbName || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="w-3.5 h-3.5" /> {t("approved")}</span>;
      case "REJECTED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-800"><XCircle className="w-3.5 h-3.5" /> {t("rejected")}</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700"><FileX className="w-3.5 h-3.5" /> {t("cancelled")}</span>;
      case "PENDING_HEAD":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium border border-orange-200 dark:border-orange-800"><Clock className="w-3.5 h-3.5" /> {t("pendingHrHead")}</span>;
      case "PENDING_EXEC":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium border border-orange-200 dark:border-orange-800"><Clock className="w-3.5 h-3.5" /> {t("pendingDirector")}</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium border border-orange-200 dark:border-orange-800"><Clock className="w-3.5 h-3.5" /> {t("pending")}</span>;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "APPROVED": return t("approved");
      case "REJECTED": return t("rejected");
      case "CANCELLED": return t("cancelled");
      case "PENDING_HEAD": return t("pendingHrHead");
      case "PENDING_EXEC": return t("pendingDirector");
      default: return t("pending");
    }
  };

  const getStatusTextTh = (status: string) => {
    switch (status) {
      case "APPROVED": return "อนุมัติแล้ว";
      case "REJECTED": return "ปฏิเสธ";
      case "CANCELLED": return "ยกเลิก";
      case "PENDING_HEAD": return "รอหัวหน้างานบุคคล";
      case "PENDING_EXEC": return "รอผู้อำนวยการ";
      default: return "รอดำเนินการ";
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t("confirmCancelLeave"))) return;
    try {
      await cancelLeaveRequest(id);
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, status: "CANCELLED" } : h));
    } catch (err) {
      alert(t("cancelLeaveError"));
    }
  };

  const handleDelete = async (id: string, typeName: string, userName: string) => {
    const confirmKeyword = "CONFIRM";
    const title = t("confirmDeleteTitle");
    const labelType = lang === "en" ? "Leave Type" : "ประเภทการลา";
    const labelUser = lang === "en" ? "Staff Name" : "ชื่อผู้ลา";
    const confirmMsg = `${title}\n${labelType}: ${typeName}\n${labelUser}: ${userName}\n\n${t("confirmDeleteInput")}`;
    
    const input = prompt(confirmMsg);
    if (input !== confirmKeyword) {
      if (input !== null) {
        alert(t("deleteCancelledAlert"));
      }
      return;
    }
    try {
      await adminDeleteLeaveRequest(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      alert(t("deleteSuccessAlert"));
    } catch (err: any) {
      alert(t("deleteErrorAlert") + (err.message || ""));
    }
  };

  // ========= Print as PDF (browser print dialog) =========
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(t("popupBlockedAlert"));
      return;
    }

    const showUserColumn = selectedUserId === "all";
    const headerHtml = `
      <tr>
        <th style="width:40px;">#</th>
        <th style="width:18%;">เลขที่ใบลา</th>
        ${showUserColumn ? '<th style="width:18%;">ผู้ขอลา</th>' : ''}
        <th style="width:15%;">ประเภท</th>
        <th style="width:12%;">วันเริ่มต้น</th>
        <th style="width:12%;">วันสิ้นสุด</th>
        <th style="width:10%;">จำนวนวัน</th>
        <th style="width:30%;">เหตุผล</th>
        <th style="width:15%;">สถานะ</th>
      </tr>
    `;

    const rows = filteredHistory.map((item, i) => {
      const config = leaveConfigs.find((c) => c.type === item.type);
      const leaveTh = getLeaveTypeNameTh(item.type, config?.name);
      return `
        <tr>
          <td style="border:1px solid #ddd;padding:8px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid #ddd;padding:8px;">
            ${item.status === "APPROVED" 
              ? `<span style="color:#059669;font-weight:bold;">อนุมัติที่ ${item.approvedSeq}/${item.fiscalYear}</span>` 
              : `<span style="color:#64748b;">คำขอที่ ${item.pendingSeq}/${item.fiscalYear}</span>`}
          </td>
          ${showUserColumn ? `<td style="border:1px solid #ddd;padding:8px;font-weight:bold;">${item.userName}</td>` : ''}
          <td style="border:1px solid #ddd;padding:8px;">${leaveTh}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center;">${format(new Date(item.startDate), "dd/MM/yyyy")}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center;">${format(new Date(item.endDate), "dd/MM/yyyy")}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center;">${Math.ceil((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000*60*60*24)) + 1}</td>
          <td style="border:1px solid #ddd;padding:8px;">${item.reason}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center;">${getStatusTextTh(item.status)}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>ประวัติการลา</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Sarabun', sans-serif; padding: 40px; color: #333; }
          h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
          .subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
          th { background: #f5f5f5; border: 1px solid #ddd; padding: 10px 8px; font-weight: 700; text-align: center; }
          td { border: 1px solid #ddd; padding: 8px; vertical-align: top; word-wrap: break-word; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          .footer { margin-top: 30px; text-align: right; font-size: 12px; color: #999; }
          @media print { 
            body { padding: 20px; } 
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <h1>ประวัติการลา</h1>
        <p class="subtitle">ชื่อ-นามสกุล: ${selectedUserId === "me" ? (history[0]?.userName || "ผู้ยื่นคำขอ") : selectedUserId === "all" ? "บุคลากรทุกคน (ประวัติรวม)" : (staffList.find(s => s.id === selectedUserId)?.name || "ผู้ยื่นคำขอ")} | ประจำ${getCycleLabelTh()} | พิมพ์เมื่อ ${format(new Date(), "dd/MM/yyyy HH:mm")} น.</p>
        <table>
          <thead>
            ${headerHtml}
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">ทั้งหมด ${filteredHistory.length} รายการ</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  // ========= Export XLSX =========
  const handleExportXlsx = () => {
    const leaveTypeMap: Record<string, string> = {};
    leaveConfigs.forEach(c => { leaveTypeMap[c.type] = c.name; });

    const formattedData = filteredHistory.map((item) => {
      const row: any = {
        "เลขที่ใบลา": item.status === "APPROVED" 
          ? `อนุมัติที่ ${item.approvedSeq || "-"}/${item.fiscalYear || "-"}` 
          : `คำขอที่ ${item.pendingSeq || "-"}/${item.fiscalYear || "-"}`,
      };
      if (selectedUserId === "all") {
        row["ผู้ขอลา"] = item.userName;
      }
      row["รหัสการลา"] = item.id.substring(0, 8);
      row["ประเภท"] = leaveTypeMap[item.type] || item.type;
      row["วันที่เริ่ม"] = new Date(item.startDate).toLocaleDateString("th-TH");
      row["ถึงวันที่"] = new Date(item.endDate).toLocaleDateString("th-TH");
      row["จำนวนวัน"] = Math.ceil((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      row["เหตุผล"] = item.reason;
      row["สถานะ"] = getStatusText(item.status);
      row["วันที่ยื่นใบลา"] = new Date(item.createdAt).toLocaleDateString("th-TH");
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(formattedData);
    ws["!cols"] = selectedUserId === "all" 
      ? [{ wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 15 }]
      : [{ wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leave_History");
    XLSX.writeFile(wb, `ประวัติการลา_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const renderDocumentLinks = (documentUrl: string) => {
    if (!documentUrl) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-200/10 dark:border-slate-800/10">
          {t("noAttachment")}
        </span>
      );
    }

    let files: { name?: string; preview: string }[] = [];

    if (documentUrl.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(documentUrl);
        if (Array.isArray(parsed)) {
          files = parsed.map((file: any) => {
            if (typeof file === "string") {
              return { preview: file };
            }
            return { name: file.name, preview: file.preview };
          });
        }
      } catch (e) {
        console.error("Failed to parse documentUrl JSON", e);
      }
    }

    if (files.length > 0) {
      return (
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
          {files.map((file, idx) => (
            <button
              key={idx}
              onClick={() => handleViewAttachment(file.preview, file.name)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 px-2 py-0.5 rounded border border-purple-200/40 dark:border-purple-800/40 transition-colors cursor-pointer"
            >
              <Paperclip className="w-3 h-3" />
              {t("attachmentIndex")} {idx + 1}
            </button>
          ))}
        </div>
      );
    }

    // Fallback for single/comma-separated strings
    const urls = documentUrl.split(",");
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
        {urls.map((url, idx) => (
          <button
            key={idx}
            onClick={() => handleViewAttachment(url.trim())}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 px-2 py-0.5 rounded border border-purple-200/40 dark:border-purple-800/40 transition-colors cursor-pointer"
          >
            <Paperclip className="w-3 h-3" />
            {urls.length > 1 ? `${t("attachmentIndex")} ${idx + 1}` : t("viewAttachment")}
          </button>
        ))}
      </div>
    );
  };

  // Stats calculation
  const stats = {
    total: filteredHistory.length,
    approved: filteredHistory.filter(h => h.status === "APPROVED").length,
    pending: filteredHistory.filter(h => h.status === "PENDING_HEAD" || h.status === "PENDING_EXEC").length,
    rejected: filteredHistory.filter(h => h.status === "REJECTED" || h.status === "CANCELLED").length
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" ref={printRef}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t("leaveHistory")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {selectedUserId === "me" 
              ? t("leaveHistorySubtitle") 
              : selectedUserId === "all"
                ? t("allStaffHistory")
                : `${t("leaveHistory")}: ${staffList.find(s => s.id === selectedUserId)?.name || ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden w-full md:w-auto">
          {staffList.length > 0 && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer flex-1 md:flex-none"
            >
              <option value="me">{t("myHistory")}</option>
              <option value="all">{t("allStaffOption")}</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({tPosition(staff.position) || t("staffMember")})
                </option>
              ))}
            </select>
          )}
          <CycleSelect defaultValue="all" showAll={true} />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer flex-1 md:flex-none"
          >
            <option value="all">{t("status")}: {t("allOptions")}</option>
            <option value="pending">{t("status")}: {t("pending")}</option>
            <option value="approved">{t("status")}: {t("approved")}</option>
            <option value="rejected">{t("status")}: {lang === "en" ? "Rejected/Cancelled" : "ไม่อนุมัติ/ยกเลิก"}</option>
          </select>
          {filteredHistory.length > 0 && (
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 text-sm font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors shadow-sm flex-1 md:flex-none"
                title="พิมพ์ / บันทึกเป็น PDF"
              >
                <Printer className="w-4 h-4" />
                {t("printPdf")}
              </button>
              <button
                onClick={handleExportXlsx}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 text-sm font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors shadow-sm flex-1 md:flex-none"
                title="ส่งออกเป็น Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{lang === "en" ? "Total Records" : "รายการลาทั้งหมด"}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-2xl font-bold text-slate-900 dark:text-white">{stats.approved}</span>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t("approved")}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="block text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</span>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t("pending")}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
            <FileX className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-2xl font-bold text-slate-900 dark:text-white">{stats.rejected}</span>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{lang === "en" ? "Rejected/Cancelled" : "ไม่อนุมัติ/ยกเลิก"}</span>
          </div>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-2 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {loading ? (
          <div className="animate-pulse space-y-3 p-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
        ) : (() => {
          const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
          const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
          
          return (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto max-h-[600px] custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">เลขที่ใบลา</th>
                      {selectedUserId === "all" && (
                        <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">ผู้ขอลา</th>
                      )}
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">{t("type")}</th>
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">{t("date")}</th>
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">จำนวนวัน</th>
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">{t("reason")}</th>
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">เอกสารแนบ</th>
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">{t("status")}</th>
                      <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 text-right print:hidden">{t("manage")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <p>
                              {history.length === 0
                                ? t("noLeaveHistory")
                                : lang === "en"
                                  ? "No leave records match the filter"
                                  : "ไม่พบข้อมูลการลาที่ตรงกับตัวกรอง"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          {item.status === "APPROVED" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200/40 dark:border-emerald-800/40">
                              {lang === "en" ? `Approved No. ${item.approvedSeq}/${item.fiscalYear}` : `อนุมัติที่ ${item.approvedSeq}/${item.fiscalYear}`}
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400 text-xs bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/40 dark:border-slate-700/40">
                              {lang === "en" ? `Request No. ${item.pendingSeq}/${item.fiscalYear}` : `คำขอที่ ${item.pendingSeq}/${item.fiscalYear}`}
                            </span>
                          )}
                        </td>
                        {selectedUserId === "all" && (
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                            {item.userName}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {getLeaveTypeName(item.type)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {format(new Date(item.startDate), "dd MMM yyyy")} - {format(new Date(item.endDate), "dd MMM yyyy")}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-semibold">
                          {calculateDays(item.startDate, item.endDate, item.type) === 0 && item.type !== "MATERNITY" ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs" title="วันที่เลือกตรงกับวันเสาร์-อาทิตย์ทั้งหมด">
                              {t("weekendZeroDays")}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs">
                              {calculateDays(item.startDate, item.endDate, item.type)} {t("days")}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                          {item.reason}
                        </td>
                        <td className="px-6 py-4">
                          {renderDocumentLinks(item.documentUrl)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="px-6 py-4 text-right print:hidden">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/print/leave/${item.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 text-xs font-semibold rounded-lg border border-indigo-200/40 dark:border-indigo-800/40 transition-colors shadow-sm"
                              title="พิมพ์ใบลาทางการ / บันทึก PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{t("print")}</span>
                            </a>
                            {selectedUserId === "me" && (item.status === "PENDING_HEAD" || item.status === "PENDING_EXEC") && (
                              <button
                                onClick={() => handleCancel(item.id)}
                                className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              >
                                {t("cancelLeave")}
                              </button>
                            )}
                            {(isAdmin || isHR) && (
                              <button
                                onClick={() => handleDelete(item.id, getLeaveTypeName(item.type), item.userName || (selectedUserId === "me" ? (session?.user as any)?.name : staffList.find(s => s.id === selectedUserId)?.name) || "ผู้ยื่นคำขอ")}
                                className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
                                title="ลบข้อมูลนี้ออกจากระบบ (Admin Only)"
                              >
                                {t("deleteRecord")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Grid View */}
              <div className="md:hidden space-y-4">
                {filteredHistory.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <span>{t("noLeaveHistory")}</span>
                  </div>
                ) : paginatedHistory.map((item) => (
                  <div key={item.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        {item.status === "APPROVED" ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-200/40">
                            {lang === "en" ? `Approved No. ${item.approvedSeq}/${item.fiscalYear}` : `อนุมัติที่ ${item.approvedSeq}/${item.fiscalYear}`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/40">
                            {lang === "en" ? `Request No. ${item.pendingSeq}/${item.fiscalYear}` : `คำขอที่ ${item.pendingSeq}/${item.fiscalYear}`}
                          </span>
                        )}
                        {selectedUserId === "all" && (
                          <span className="block mt-1.5 font-bold text-slate-900 dark:text-white text-xs">{item.userName}</span>
                        )}
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">{t("type")}:</span>
                        <span className="font-semibold text-slate-950 dark:text-white">{getLeaveTypeName(item.type)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">จำนวนวัน:</span>
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {calculateDays(item.startDate, item.endDate, item.type) === 0 && item.type !== "MATERNITY" ? t("weekendZeroDays") : `${calculateDays(item.startDate, item.endDate, item.type)} ${t("days")}`}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs">
                      <span className="text-slate-400 dark:text-slate-500 block">{t("date")}:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {format(new Date(item.startDate), "dd MMM yyyy")} - {format(new Date(item.endDate), "dd MMM yyyy")}
                      </span>
                    </div>

                    {item.reason && (
                      <div className="text-xs bg-slate-50 dark:bg-slate-850 p-2 rounded-xl border border-slate-100/50 dark:border-slate-800/40">
                        <span className="text-slate-400 dark:text-slate-500 block mb-0.5">{t("reason")}:</span>
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{item.reason}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      <div>{renderDocumentLinks(item.documentUrl)}</div>
                      
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/print/leave/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-650 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 text-xs font-semibold rounded-lg border border-indigo-200/40"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{t("print")}</span>
                        </a>
                        {selectedUserId === "me" && (item.status === "PENDING_HEAD" || item.status === "PENDING_EXEC") && (
                          <button
                            onClick={() => handleCancel(item.id)}
                            className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850"
                          >
                            {t("cancelLeave")}
                          </button>
                        )}
                        {(isAdmin || isHR) && (
                          <button
                            onClick={() => handleDelete(item.id, getLeaveTypeName(item.type), item.userName || "ผู้ยื่นคำขอ")}
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
                          >
                            {t("deleteRecord")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Bar */}
              {filteredHistory.length > itemsPerPage && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 border-t border-slate-100 dark:border-slate-800/80 mt-4 print:hidden">
                  <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {t("showingText")} {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredHistory.length)} {t("ofText")} {filteredHistory.length} {t("recordsText")}
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                    >
                      {t("previousText")}
                    </button>
                    
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNum = index + 1;
                      if (totalPages > 5 && Math.abs(currentPage - pageNum) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                        if (pageNum === 2 || pageNum === totalPages - 1) {
                          return <span key={pageNum} className="px-1 text-xs text-slate-400 dark:text-slate-600">...</span>;
                        }
                        return null;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                            currentPage === pageNum
                              ? "bg-purple-650 text-white shadow-md shadow-purple-500/20"
                              : "border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 shadow-sm"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                    >
                      {t("nextText")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
