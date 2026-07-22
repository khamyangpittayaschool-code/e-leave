"use client";

import { useState } from "react";
import { X, Sparkles, RefreshCw, UploadCloud, Clipboard, ExternalLink, Check } from "lucide-react";
import { syncAMSSDocumentsFromHtml } from "@/app/actions/incoming";

export default function AmssImportModal({
  isOpen,
  onClose,
  onRefresh,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [pastedMsg, setPastedMsg] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!htmlContent.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await syncAMSSDocumentsFromHtml(htmlContent.trim());
      setResult({ imported: res.importedCount, duplicates: res.duplicatesCount });
      setHtmlContent("");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการประมวลผลข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setHtmlContent(event.target?.result as string || "");
    };
    reader.readAsText(file);
  };

  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setHtmlContent(text);
        setPastedMsg(true);
        setTimeout(() => setPastedMsg(false), 2000);
      }
    } catch (err) {
      setError("ไม่สามารถเข้าถึงคลิปบอร์ดได้ กรุณากด Ctrl+V เพื่อวางในกล่องข้อความ");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-950 rounded-3xl max-w-xl w-full border border-slate-100 dark:border-slate-800/80 shadow-2xl p-6 space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ซิงค์หนังสือรับผ่านเบราว์เซอร์ (Browser Client Sync)
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white">ดำเนินการนำเข้าข้อมูลเสร็จสิ้น</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                นำเข้าสำเร็จ <strong className="text-emerald-600 dark:text-emerald-400">{result.imported}</strong> รายการ | 
                ข้ามเนื่องจากซ้ำแล้ว <strong className="text-amber-600 dark:text-amber-400">{result.duplicates}</strong> รายการ
              </p>
            </div>
            <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer">
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  วิธีซิงค์แบบ 1-Click ผ่านเบราว์เซอร์:
                </label>
                <a
                  href="https://amss.sesaud.go.th/index.php?option=book&task=main/receive"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <span>🌐 เปิดหน้าหนังสือรับ AMSS++</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="text-xs text-slate-600 dark:text-slate-400 list-decimal list-inside space-y-1 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                <li>เปิดหน้าเว็บ AMSS++ บนเบราว์เซอร์ของคุณครู</li>
                <li>กด <code className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 px-1 py-0.5 rounded font-mono font-bold">Ctrl + A</code> เพื่อเลือกทั้งหมด แล้วกด <code className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 px-1 py-0.5 rounded font-mono font-bold">Ctrl + C</code> (คัดลอก)</li>
                <li>กดปุ่ม <strong>"📋 วางข้อความจากคลิปบอร์ด"</strong> ด้านล่าง แล้วกดบันทึก</li>
              </ol>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClipboardPaste}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                {pastedMsg ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                {pastedMsg ? "วางข้อความแล้ว!" : "📋 วางข้อความจากคลิปบอร์ด (1-Click)"}
              </button>

              <label className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer">
                <UploadCloud className="w-4 h-4" />
                <span>อัปโหลด HTML</span>
                <input type="file" accept=".html,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div>
              <textarea
                placeholder="กล่องแสดงเนื้อหาซอร์สโค้ด HTML หรือข้อความที่คัดลอกจาก AMSS++..."
                rows={5}
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 font-semibold">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !htmlContent.trim()}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition cursor-pointer shadow-sm"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                นำเข้าและประมวลผลข้อมูล
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
