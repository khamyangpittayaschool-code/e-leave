"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Zap } from "lucide-react";
import { syncAMSSDocumentsFromHtml, getAMSSCredentials } from "@/app/actions/incoming";

type AmssAutoBrowserSyncProps = {
  onSuccess?: (count: number) => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
  autoTrigger?: boolean;
};

export default function AmssAutoBrowserSync({ onSuccess, showToast, autoTrigger }: AmssAutoBrowserSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"this_week" | "this_month" | "this_year" | "all">("this_year");

  useEffect(() => {
    if (autoTrigger) {
      handleAutoBrowserSync();
    }
  }, [autoTrigger]);

  const handleAutoBrowserSync = async () => {
    setSyncing(true);
    setStatusMsg("กำลังดึงรหัสผ่านและสร้างช่องทางเชื่อมต่อ AMSS++...");

    try {
      // Fetch saved credentials
      const credsRes = await getAMSSCredentials();
      if (!credsRes.success || !credsRes.data) {
        if (showToast) showToast("ยังไม่ได้ตั้งค่าบัญชี AMSS++ กรุณาตั้งค่ารหัสผ่านก่อน", "error");
        setSyncing(false);
        return;
      }

      const amssUrl = credsRes.data.url || "https://amss.sesaud.go.th";
      const targetListUrl = amssUrl.endsWith("/")
        ? `${amssUrl}index.php?option=book&task=main/receive`
        : `${amssUrl}/index.php?option=book&task=main/receive`;

      setStatusMsg("เปิดช่องทางเชื่อมต่อ AMSS++ บนเบราว์เซอร์อัตโนมัติ...");

      // Open a small background popup window
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        targetListUrl,
        "AMSSAutoSyncPopup",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        if (showToast) showToast("เบราว์เซอร์บล็อก Popup กรุณากดอนุญาต Pop-up Window สำหรับระบบนี้", "error");
        setSyncing(false);
        return;
      }

      setStatusMsg("กำลังดึงข้อมูลตารางหนังสือรับอัตโนมัติ (กรุณารอ 3-5 วินาที)...");

      let attempts = 0;
      const maxAttempts = 15;

      const interval = setInterval(async () => {
        attempts++;
        try {
          if (popup.closed) {
            clearInterval(interval);
            setSyncing(false);
            setStatusMsg(null);
            return;
          }

          let pageHtml = "";
          try {
            pageHtml = popup.document.body.innerHTML;
          } catch (e) {
            // cross-origin restriction
          }

          if (
            pageHtml &&
            (pageHtml.includes("bookdetail") ||
              pageHtml.includes("onclick=\"check") ||
              pageHtml.includes("หนังสือรับ") ||
              pageHtml.includes("saraban_index"))
          ) {
            clearInterval(interval);
            setStatusMsg("พบบันทึกหนังสือรับแล้ว กำลังซิงค์และอัปเดตลงฐานข้อมูล...");

            const result = await syncAMSSDocumentsFromHtml(pageHtml, dateRange);
            popup.close();

            setSyncing(false);
            setStatusMsg(null);
            if (showToast) {
              showToast(
                `ซิงค์หนังสือรับสำเร็จ! นำเข้าใหม่ ${result.importedCount} รายการ, อัปเดต ${result.updatedCount || 0} รายการ`,
                "success"
              );
            }
            if (onSuccess) onSuccess(result.importedCount);
            return;
          }
        } catch (err) {
          // ignore cross-origin security warnings
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setSyncing(false);
          setStatusMsg(null);
          if (showToast) {
            showToast("หมดเวลาเชื่อมต่ออัตโนมัติ กรุณาล็อกอิน AMSS++ บนเบราว์เซอร์แล้วลองอีกครั้ง", "error");
          }
        }
      }, 1000);
    } catch (err: any) {
      setSyncing(false);
      setStatusMsg(null);
      if (showToast) showToast(err.message || "เกิดข้อผิดพลาดในการซิงค์อัตโนมัติ", "error");
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        value={dateRange}
        onChange={(e) => setDateRange(e.target.value as any)}
        disabled={syncing}
        className="h-9 px-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 text-xs font-bold cursor-pointer focus:outline-none"
        title="เลือกช่วงเวลาของหนังสือรับที่ต้องการดึงหรืออัปเดต"
      >
        <option value="this_week">📅 สัปดาห์นี้</option>
        <option value="this_month">📅 เดือนนี้</option>
        <option value="this_year">📅 ปีนี้ (2569)</option>
        <option value="all">🌐 ข้อมูลทั้งหมด</option>
      </select>

      <button
        onClick={handleAutoBrowserSync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
      >
        <Zap className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-amber-300" : "text-yellow-300"}`} />
        <span>{syncing ? "กำลังซิงค์..." : "⚡ ซิงค์หนังสือรับอัตโนมัติ"}</span>
      </button>

      {statusMsg && (
        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold animate-pulse w-full">
          {statusMsg}
        </span>
      )}
    </div>
  );
}
