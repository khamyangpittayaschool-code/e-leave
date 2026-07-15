"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, RefreshCw, AlertTriangle, Fingerprint, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AttendanceErrorBoundary({ error, reset }: ErrorProps) {
  const { lang } = useI18n();
  const isTh = lang === "th";

  useEffect(() => {
    console.error("Attendance Error Boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center relative overflow-hidden"
      >
        {/* Visual Background Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Attendance Context Visual Icons */}
        <div className="flex justify-center items-center gap-2 mb-6">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-2xl flex items-center justify-center shadow-inner relative">
            <Clock className="w-6 h-6 animate-pulse" />
            <AlertTriangle className="absolute -bottom-1 -right-1 w-4 h-4 text-amber-500 bg-white dark:bg-slate-900 rounded-full" />
          </div>
          <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800/50 text-slate-400 rounded-xl flex items-center justify-center opacity-60">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800/50 text-slate-400 rounded-xl flex items-center justify-center opacity-60">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
          {isTh ? "เกิดข้อผิดพลาดในระบบลงเวลา" : "Attendance System Error"}
        </h2>
        
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 max-w-xs mx-auto">
          {isTh
            ? "ไม่สามารถโหลดข้อมูลพิกัด หรือประมวลผลการบันทึกเวลาเข้า/ออกงานได้สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือการอนุญาตสิทธิ์ตำแหน่ง (GPS) แล้วลองใหม่อีกครั้ง"
            : "We couldn't load your attendance options or clock-in records. Please check your network connection or location permissions and try again."}
        </p>

        {error.message && (
          <div className="mb-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/50 text-left">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Error Details:
            </p>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all leading-normal select-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer border-none"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isTh ? "ลองใหม่อีกครั้ง" : "Try Again"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
