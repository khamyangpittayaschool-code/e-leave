"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalAppErrorBoundary({ error, reset }: ErrorProps) {
  const { lang } = useI18n();
  const isTh = lang === "th";

  useEffect(() => {
    console.error("Global App Layout Error Boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-6 w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
          {isTh ? "ระบบขัดข้องชั่วคราว" : "System Interruption"}
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 max-w-sm mx-auto">
          {isTh
            ? "เกิดข้อผิดพลาดในการโหลดองค์ประกอบหลักของแอปพลิเคชัน กรุณาคลิกปุ่มด้านล่างเพื่อประมวลผลระบบใหม่ หรือรีเฟรชหน้าเว็บ"
            : "An unexpected error occurred while loading the main layout. Please click the button below to retry or refresh the page."}
        </p>

        {error.message && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 text-left max-h-36 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Error Log:
            </p>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all leading-normal">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                Digest Code: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm shadow-md transition-all cursor-pointer border-none"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isTh ? "ประมวลผลใหม่" : "Retry System"}</span>
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all cursor-pointer border-none"
          >
            <span>{isTh ? "รีเฟรชหน้าเว็บ" : "Refresh Page"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
