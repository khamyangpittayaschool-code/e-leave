"use client";

import { useState, useEffect } from "react";
import { getPendingApprovals, approveLeaveRequest, rejectLeaveRequest } from "@/app/actions/leave";
import { format } from "date-fns";
import { UserCircle, Calendar, FileText, Check, X, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function calculateDays(startDateStr: string, endDateStr: string, type: string): number {
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
}

export default function ApprovalsPage() {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  const loadData = () => {
    setLoading(true);
    getPendingApprovals()
      .then(setPendingRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const getLeaveTypeName = (type: string) => {
    const map: Record<string, string> = { SICK: t("sickLeave"), PERSONAL: t("personalLeave"), VACATION: t("vacationLeave") };
    return map[type] || type;
  };

  const handleApprove = async (id: string) => {
    await approveLeaveRequest(id);
    window.dispatchEvent(new Event("noti-refresh"));
    loadData();
  };

  const handleReject = async (id: string) => {
    await rejectLeaveRequest(id, "ไม่อนุมัติโดยหัวหน้า/ผู้บริหาร");
    window.dispatchEvent(new Event("noti-refresh"));
    loadData();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t("pendingApprovalsTitle")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("pendingApprovalsSubtitle")}</p>
      </div>

      <div className="grid gap-6">
        {pendingRequests.length === 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("noPendingApprovals")}</h3>
            <p className="text-slate-500 mt-1">{t("allDone")}</p>
          </div>
        ) : (
          pendingRequests.map((item) => (
            <div key={item.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col md:flex-row gap-6 items-start md:items-center">
              
              {/* User Info */}
              <div className="flex items-center gap-4 min-w-[240px]">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                  {item.user?.name?.charAt(0) || "U"}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{item.user?.name}</p>
                  <p className="text-xs text-slate-500">{item.user?.position || t("staffMember")} • {item.user?.subjectGroup}</p>
                </div>
              </div>

              {/* Leave Info */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 border-y md:border-y-0 md:border-x border-slate-100 dark:border-slate-800 py-4 md:py-0 md:px-6">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t("typeAndDate")}</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    {getLeaveTypeName(item.type)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{format(new Date(item.startDate), "dd MMM")} - {format(new Date(item.endDate), "dd MMM")}</span>
                    {calculateDays(item.startDate, item.endDate, item.type) === 0 && item.type !== "MATERNITY" ? (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]" title="วันที่เลือกตรงกับวันเสาร์-อาทิตย์ทั้งหมด">
                        (0 วัน - ตรงกับวันหยุดราชการ)
                      </span>
                    ) : (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                        ({calculateDays(item.startDate, item.endDate, item.type)} วัน)
                      </span>
                    )}
                  </p>
                  
                  {/* Attached Document Section */}
                  <div className="mt-2">
                    {item.documentUrl ? (
                      <a
                        href={item.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 px-2 py-0.5 rounded border border-purple-200/40 dark:border-purple-800/40 transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        เปิดดูเอกสารแนบ
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-200/10 dark:border-slate-800/10">
                        ไม่มีเอกสารแนบ
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t("reason")}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                    {item.reason}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full md:w-auto md:min-w-[200px] justify-end">
                <button
                  onClick={() => handleReject(item.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-rose-600 font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                >
                  <X className="w-4 h-4" />
                  {t("reject")}
                </button>
                <button
                  onClick={() => handleApprove(item.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  {t("approve")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
