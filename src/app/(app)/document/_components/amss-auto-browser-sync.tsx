"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Zap } from "lucide-react";
import { syncAMSSDocumentsFromHtml, syncAMSSDocumentsAutomatically, getAMSSCredentials } from "@/app/actions/incoming";

type AmssAutoBrowserSyncProps = {
  onSuccess?: (count: number) => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
  autoTrigger?: boolean;
};

export default function AmssAutoBrowserSync({ onSuccess, showToast, autoTrigger }: AmssAutoBrowserSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"this_week" | "this_month" | "this_year" | "all">("this_year");
  const lastProcessedTextRef = useState<{ current: string }>({ current: "" })[0];

  // Auto Clipboard Listener on Window Focus
  useEffect(() => {
    const handleFocus = async () => {
      try {
        if (!navigator.clipboard || syncing) return;
        const text = await navigator.clipboard.readText();
        if (
          text &&
          text.trim().length > 50 &&
          (text.includes("bookdetail") ||
            text.includes("onclick=\"check") ||
            text.includes("หนังสือรับ") ||
            text.includes("ศธ") ||
            text.includes("สารบรรณ"))
        ) {
          if (lastProcessedTextRef.current === text.trim()) return;
          lastProcessedTextRef.current = text.trim();

          setSyncing(true);
          setStatusMsg("พบข้อมูล AMSS++ จากเบราว์เซอร์! กำลังซิงค์เข้าตารางทะเบียนรับ...");

          const res = await syncAMSSDocumentsFromHtml(text, dateRange);
          setSyncing(false);
          setStatusMsg(null);

          if (showToast) {
            showToast(
              `⚡ ซิงค์หนังสือรับสำเร็จ! นำเข้าใหม่ ${res.importedCount} รายการ, อัปเดต ${res.updatedCount || 0} รายการ`,
              "success"
            );
          }
          if (onSuccess) onSuccess(res.importedCount);
        }
      } catch (err) {
        // Clipboard read permission might require focus or user interaction
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [dateRange, onSuccess, showToast, syncing]);

  useEffect(() => {
    if (autoTrigger) {
      handleDirectOneClickSync();
    }
  }, [autoTrigger]);

  const handleAutoBrowserSync = async () => {
    setSyncing(true);
    setStatusMsg("กำลังดึงรหัสผ่านและเปิดช่องทาง AMSS++...");

    try {
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

      // Open background popup window
      const width = 550;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        targetListUrl,
        "AMSSAutoSyncPopup",
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        if (showToast) showToast("เบราว์เซอร์บล็อก Popup กรุณากดอนุญาต Pop-up Window", "error");
        setSyncing(false);
        return;
      }

      setStatusMsg("💡 หน้าต่าง AMSS++ เปิดแล้ว! กด Ctrl+A -> Ctrl+C ในหน้าต่างนั้นแล้วกลับมาหน้านี้ ข้อมูลจะซิงค์ให้อัตโนมัติทันที");

      // Check if user copied or popup reloaded
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds

      const interval = setInterval(async () => {
        attempts++;
        if (popup.closed || attempts >= maxAttempts) {
          clearInterval(interval);
          setSyncing(false);
          setStatusMsg(null);
        }
      }, 1000);
    } catch (err: any) {
      setSyncing(false);
      setStatusMsg(null);
      if (showToast) showToast(err.message || "เกิดข้อผิดพลาดในการเปิด AMSS++", "error");
    }
  };

  const handleDirectOneClickSync = async () => {
    setSyncing(true);
    setStatusMsg("กำลังเชื่อมต่อเซิร์ฟเวอร์ AMSS++ และดึงหนังสือรับ...");

    try {
      const res = await syncAMSSDocumentsAutomatically(dateRange);
      if (!res.success) {
        const errorMsg = res.error || "เกิดข้อผิดพลาดในการดึงข้อมูลจาก AMSS++";
        if (
          errorMsg.includes("Cloudflare") ||
          errorMsg.includes("CAPTCHA") ||
          errorMsg.includes("403") ||
          errorMsg.includes("Firewall") ||
          errorMsg.includes("ล้มเหลว") ||
          errorMsg.includes("ไม่สามารถเชื่อมต่อ")
        ) {
          setStatusMsg("ระบบ AMSS++ ฝั่งสพท. บล็อกการยิงตรง กำลังเปิด Popup ช่วยดึงข้อมูล...");
          await handleAutoBrowserSync();
        } else {
          if (showToast) showToast(errorMsg, "error");
          setSyncing(false);
          setStatusMsg(null);
        }
        return;
      }

      const { importedCount, duplicatesCount } = res.data;
      if (importedCount === 0 && duplicatesCount > 0) {
        if (showToast) {
          showToast(`ข้อมูลเป็นปัจจุบันแล้ว (ไม่มีหนังสือใหม่ ข้ามข้อมูลซ้ำ ${duplicatesCount} เรื่อง)`, "success");
        }
      } else {
        if (showToast) {
          showToast(
            `⚡ ดึงข้อมูลจาก AMSS++ สำเร็จ! นำเข้าหนังสือใหม่ ${importedCount} เรื่อง` +
              (duplicatesCount > 0 ? ` (ข้ามข้อมูลซ้ำ ${duplicatesCount} เรื่อง)` : ""),
            "success"
          );
        }
      }
      if (onSuccess) onSuccess(importedCount);
      setSyncing(false);
      setStatusMsg(null);
    } catch (err: any) {
      if (showToast) showToast(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูล", "error");
      setSyncing(false);
      setStatusMsg(null);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
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
        onClick={handleDirectOneClickSync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
      >
        <Zap className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-amber-300" : "text-yellow-300"}`} />
        <span>{syncing ? "กำลังเชื่อมต่อ..." : "⚡ ดึงหนังสือรับจาก AMSS++ ทันที (1-Click)"}</span>
      </button>

      {statusMsg && (
        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold animate-pulse w-full">
          {statusMsg}
        </span>
      )}
    </div>
  );
}
