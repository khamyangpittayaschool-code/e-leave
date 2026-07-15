"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Lock, Globe, KeyRound, Check, AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { 
  saveAMSSCredentials, 
  testAMSSConnection, 
  deleteAMSSCredentials,
  getAMSSCredentials
} from "@/app/actions/incoming";

type AmssCredentialsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
};

export default function AmssCredentialsModal({
  isOpen,
  onClose,
  onSaved,
  showToast
}: AmssCredentialsModalProps) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasExistingCreds, setHasExistingCreds] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [hasTested, setHasTested] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen]);

  const loadCredentials = async () => {
    setLoading(true);
    setTestResult(null);
    setHasTested(false);
    try {
      const res = await getAMSSCredentials();
      if (res.success && res.data) {
        setUrl(res.data.url || "");
        setUsername(res.data.username || "");
        setPassword(""); // ไม่ดึงรหัสผ่านลงมาแสดงที่ Client เพื่อความปลอดภัย
        setHasExistingCreds(true);
      } else {
        setUrl("");
        setUsername("");
        setPassword("");
        setHasExistingCreds(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!url.trim() || !username.trim()) {
      showToast("กรุณากรอก URL และชื่อผู้ใช้งานเพื่อทดสอบ", "error");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAMSSConnection({
        url: url.trim(),
        username: username.trim(),
        password: password.trim() || undefined
      });
      
      if (!res.success) {
        setTestResult({ success: false, msg: res.error || "เชื่อมต่อล้มเหลว กรุณาตรวจสอบข้อมูล" });
      } else {
        if (res.data.success) {
          setTestResult({ success: true, msg: "เชื่อมต่อระบบ AMSS++ สำเร็จ!" });
          setHasTested(true);
        } else {
          setTestResult({ success: false, msg: res.data.error || "เข้าสู่ระบบล้มเหลว ตรวจสอบชื่อผู้ใช้งานหรือรหัสผ่าน" });
        }
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !username.trim()) {
      showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
      return;
    }
    if (!hasExistingCreds && !password.trim()) {
      showToast("กรุณากรอกรหัสผ่านสำหรับการตั้งค่าครั้งแรก", "error");
      return;
    }

    // แจ้งเตือนหากยังไม่กดทดสอบระบบ เพื่อลดข้อผิดพลาดในการกรอก URL ผิด
    if (!hasTested && !confirm("ท่านยังไม่ได้ทดสอบการเชื่อมโยงระบบเชื่อมต่อ AMSS++ หรือทดสอบไม่ผ่าน ต้องการข้ามและบันทึกต่อไปหรือไม่?")) {
      return;
    }

    setSaving(true);
    try {
      const res = await saveAMSSCredentials({
        url: url.trim(),
        username: username.trim(),
        password: password.trim() || undefined
      });
      if (res.success) {
        showToast("บันทึกการตั้งค่า AMSS++ สำเร็จ", "success");
        onSaved();
        onClose();
      } else {
        showToast(res.error || "บันทึกการตั้งค่าล้มเหลว", "error");
      }
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("คุณต้องการลบข้อมูลการเชื่อมต่อ AMSS++ หรือไม่?")) return;
    setDeleting(true);
    try {
      const res = await deleteAMSSCredentials();
      if (res.success) {
        showToast("ลบข้อมูลการตั้งค่าเชื่อมต่อแล้ว", "success");
        setUrl("");
        setUsername("");
        setPassword("");
        setHasExistingCreds(false);
        setTestResult(null);
        setHasTested(false);
        onSaved();
      } else {
        showToast(res.error || "ลบข้อมูลล้มเหลว", "error");
      }
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาดในการลบข้อมูล", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-950 rounded-3xl max-w-md w-full border border-slate-100 dark:border-slate-800/85 shadow-2xl p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              ตั้งค่าเชื่อมโยง AMSS++
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* URL Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block ml-0.5">
                ลิงก์หน้าแรกระบบ AMSS++ (URL) *
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  required
                  placeholder="เช่น https://amss.school.go.th"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setHasTested(false);
                  }}
                  className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">
                ใช้สำหรับล็อกอินและเข้าถึงกล่องจดหมายรับของโรงเรียน
              </p>
            </div>

            {/* Username Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block ml-0.5">
                ชื่อผู้ใช้งาน (AMSS++ Username) *
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="กรอกชื่อผู้ใช้งานระบบ AMSS++"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setHasTested(false);
                  }}
                  className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block ml-0.5">
                รหัสผ่าน {hasExistingCreds ? "(กรอกเฉพาะเมื่อต้องการเปลี่ยน)" : "*"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required={!hasExistingCreds}
                  placeholder={hasExistingCreds ? "••••••••" : "กรอกรหัสผ่านระบบ AMSS++"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setHasTested(false);
                  }}
                  className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">
                🔒 รหัสผ่านจะถูกเข้ารหัสด้วย AES-256-GCM ก่อนบันทึก
              </p>
            </div>

            {/* Connection Test Result */}
            {testResult && (
              <div className={`p-3 rounded-2xl border flex items-start gap-2 text-xs font-bold leading-normal ${
                testResult.success 
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400" 
                  : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-500"
              }`}>
                {testResult.success ? (
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.msg}</span>
              </div>
            )}

            {/* Test + Delete Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || saving || deleting}
                className="flex-1 h-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                ทดสอบการเชื่อมต่อ
              </button>
              
              {hasExistingCreds && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving || testing}
                  className="w-10 h-10 rounded-2xl border border-red-200 dark:border-red-950/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0"
                  title="ลบข้อมูลการเชื่อมต่อ"
                >
                  {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Save + Cancel */}
            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={saving || testing || deleting}
                className="flex-1 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 h-11 rounded-2xl bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 text-xs font-bold transition hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
