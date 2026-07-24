"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Zap, Filter, Search, Check, ListChecks, X } from "lucide-react";
import { 
  syncAMSSDocumentsFromHtml, 
  syncAMSSDocumentsAutomatically, 
  getAMSSCredentials,
  fetchAmssPreviewDocs,
  importSelectedAMSSDocuments,
  AMSSPreviewItem 
} from "@/app/actions/incoming";

type AmssAutoBrowserSyncProps = {
  onSuccess?: (count: number) => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
  autoTrigger?: boolean;
};

const THAI_MONTHS = [
  { value: 0, label: "ทุกเดือน (ทั้งปี)" },
  { value: 1, label: "มกราคม" },
  { value: 2, label: "กุมภาพันธ์" },
  { value: 3, label: "มีนาคม" },
  { value: 4, label: "เมษายน" },
  { value: 5, label: "พฤษภาคม" },
  { value: 6, label: "มิถุนายน" },
  { value: 7, label: "กรกฎาคม" },
  { value: 8, label: "สิงหาคม" },
  { value: 9, label: "กันยายน" },
  { value: 10, label: "ตุลาคม" },
  { value: 11, label: "พฤศจิกายน" },
  { value: 12, label: "ธันวาคม" },
];

export default function AmssAutoBrowserSync({ onSuccess, showToast, autoTrigger }: AmssAutoBrowserSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Filters State
  const [selectedYear, setSelectedYear] = useState<number>(2569);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [maxPages, setMaxPages] = useState<number>(5);
  const [customYear, setCustomYear] = useState<string>("");

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState<AMSSPreviewItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");
  const [importing, setImporting] = useState(false);

  const lastProcessedTextRef = useState<{ current: string }>({ current: "" })[0];

  // Auto Clipboard Listener on Window Focus
  useEffect(() => {
    const handleFocus = async () => {
      try {
        if (!navigator.clipboard || syncing || importing) return;
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

          const res = await syncAMSSDocumentsFromHtml(text, "all");
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
  }, [onSuccess, showToast, syncing, importing]);

  useEffect(() => {
    if (autoTrigger) {
      handleDirectOneClickSync();
    }
  }, [autoTrigger]);

  const getEffectiveYear = () => {
    if (customYear.trim() && !isNaN(parseInt(customYear.trim(), 10))) {
      return parseInt(customYear.trim(), 10);
    }
    return selectedYear;
  };

  const handleFetchPreview = async () => {
    setSearching(true);
    setStatusMsg("กำลังค้นหาและดึงรายการหนังสือจาก AMSS++ ตามเงื่อนไข...");

    const effectiveYear = getEffectiveYear();

    try {
      const res = await fetchAmssPreviewDocs({
        yearFilter: effectiveYear,
        monthFilter: selectedMonth,
        maxPages: maxPages
      });

      if (res.success) {
        setPreviewItems(res.items);
        // Select all new items by default
        const newKeys = new Set<string>();
        res.items.forEach(i => {
          if (!i.isExisting) {
            newKeys.add(i.amssLink || `${i.receiveNo}-${i.docRefNo}`);
          }
        });
        setSelectedKeys(newKeys);
        setShowPreviewModal(true);
        setStatusMsg(null);
      }
    } catch (err: any) {
      if (showToast) showToast(err.message || "ไม่สามารถดึงรายการตัวอย่างได้", "error");
      setStatusMsg(null);
    } finally {
      setSearching(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedKeys.size === 0) {
      if (showToast) showToast("กรุณาเลือกอย่างน้อย 1 รายการเพื่อนำเข้า", "error");
      return;
    }

    setImporting(true);
    try {
      const selectedDocs = previewItems.filter(i => 
        selectedKeys.has(i.amssLink || `${i.receiveNo}-${i.docRefNo}`)
      );

      const res = await importSelectedAMSSDocuments(selectedDocs);
      if (showToast) {
        showToast(`📥 นำเข้าหนังสือรับสำเร็จเรียบร้อย! เพิ่มรายการใหม่ ${res.importedCount} เรื่อง`, "success");
      }
      setShowPreviewModal(false);
      if (onSuccess) onSuccess(res.importedCount);
    } catch (err: any) {
      if (showToast) showToast(err.message || "เกิดข้อผิดพลาดในการนำเข้า", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleAutoBrowserSync = async () => {
    setSyncing(true);
    setStatusMsg("กำลังเปิดช่องทางเชื่อมต่อ AMSS++ ผ่านเบราว์เซอร์...");

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

      let attempts = 0;
      const maxAttempts = 30;

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
    await handleFetchPreview();
  };

  const filteredPreviewItems = previewItems.filter(item => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.docRefNo.toLowerCase().includes(q) ||
      item.senderOrg.toLowerCase().includes(q) ||
      item.receiveNo.toLowerCase().includes(q)
    );
  });

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredPreviewItems.length) {
      setSelectedKeys(new Set());
    } else {
      const allKeys = new Set<string>();
      filteredPreviewItems.forEach(i => {
        allKeys.add(i.amssLink || `${i.receiveNo}-${i.docRefNo}`);
      });
      setSelectedKeys(allKeys);
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Filters & Import Action Bar ───────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
          <Filter className="w-3.5 h-3.5 text-indigo-500" />
          <span>ตัวกรองดึงข้อมูล:</span>
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-1">
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setCustomYear("");
            }}
            disabled={syncing || searching}
            className="h-8 px-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value={2569}>ปี 2569 (2026)</option>
            <option value={2568}>ปี 2568 (2025)</option>
            <option value={2567}>ปี 2567 (2024)</option>
            <option value={2566}>ปี 2566 (2023)</option>
            <option value={2565}>ปี 2565 (2022)</option>
          </select>
          <input
            type="number"
            placeholder="พ.ศ."
            value={customYear}
            onChange={(e) => setCustomYear(e.target.value)}
            disabled={syncing || searching}
            className="h-8 w-16 px-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 text-xs font-bold focus:outline-none text-center"
            title="หรือพิมพ์ระบุปี พ.ศ. เอง"
          />
        </div>

        {/* Month Filter */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          disabled={syncing || searching}
          className="h-8 px-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 text-xs font-bold focus:outline-none cursor-pointer"
        >
          {THAI_MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {/* Page Range Filter */}
        <select
          value={maxPages}
          onChange={(e) => setMaxPages(Number(e.target.value))}
          disabled={syncing || searching}
          className="h-8 px-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 text-xs font-bold focus:outline-none cursor-pointer"
        >
          <option value={5}>🔍 ค้น 5 หน้าแรก (~50 รายการ)</option>
          <option value={10}>🔍 ค้น 10 หน้าแรก (~100 รายการ)</option>
          <option value={20}>🔍 ค้น 20 หน้าแรก (~200 รายการ)</option>
          <option value={50}>🌐 ค้น 50 หน้าแรก (~500 รายการ)</option>
        </select>

        {/* Preview Button */}
        <button
          onClick={handleFetchPreview}
          disabled={syncing || searching}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
        >
          <ListChecks className={`w-3.5 h-3.5 ${searching ? "animate-spin" : ""}`} />
          <span>{searching ? "กำลังค้นหา..." : "🔍 ดูรายการที่จะนำเข้า (Preview)"}</span>
        </button>

        {/* 1-Click Direct Button */}
        <button
          onClick={handleDirectOneClickSync}
          disabled={syncing || searching}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 ml-auto"
        >
          <Zap className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-amber-300" : "text-yellow-300"}`} />
          <span>{syncing ? "กำลังเชื่อมต่อ..." : "⚡ ดึงด่วน (1-Click)"}</span>
        </button>
      </div>

      {statusMsg && (
        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold animate-pulse block px-1">
          {statusMsg}
        </span>
      )}

      {/* ── Preview & Selection Modal ─────────────────────────────────── */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-indigo-600" />
                  รายการหนังสือรับจาก AMSS++ (ตรวจสอบก่อนนำเข้า)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  เงื่อนไข: ปี พ.ศ. {getEffectiveYear()} | {selectedMonth === 0 ? "ทุกเดือน" : `เดือน ${THAI_MONTHS.find(m=>m.value===selectedMonth)?.label}`} | ขอบเขต {maxPages} หน้า
                </p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar Stats + Search */}
            <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200">
                  พบทั้งหมด: {previewItems.length} รายการ
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                  ✨ รายการใหม่: {previewItems.filter(i => !i.isExisting).length} เรื่อง
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  ✓ มีในระบบแล้ว: {previewItems.filter(i => i.isExisting).length} เรื่อง
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="ค้นหาเรื่อง / เลขที่..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none w-48"
                  />
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
                >
                  {selectedKeys.size === filteredPreviewItems.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                </button>
              </div>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredPreviewItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm italic">
                  ไม่พบรายการหนังสือตามเงื่อนไขที่ระบุ
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">เลือก</th>
                      <th className="py-2.5 px-3 w-24">สถานะ</th>
                      <th className="py-2.5 px-3 w-36">เลขอ้างอิง</th>
                      <th className="py-2.5 px-3">เรื่องหนังสือ</th>
                      <th className="py-2.5 px-3 w-44">หน่วยงานผู้ส่ง</th>
                      <th className="py-2.5 px-3 w-28">ลงวันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPreviewItems.map((item, idx) => {
                      const key = item.amssLink || `${item.receiveNo}-${item.docRefNo}`;
                      const isSelected = selectedKeys.has(key);

                      return (
                        <tr
                          key={idx}
                          onClick={() => {
                            const next = new Set(selectedKeys);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            setSelectedKeys(next);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-50/70 dark:bg-indigo-950/40"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedKeys);
                                if (e.target.checked) next.add(key);
                                else next.delete(key);
                                setSelectedKeys(next);
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            {item.isExisting ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                                ✓ มีในระบบ
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                ✨ ใหม่
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {item.docRefNo || item.receiveNo}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white max-w-xs truncate" title={item.title}>
                            {item.title}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[170px]" title={item.senderOrg}>
                            {item.senderOrg}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {item.dateText}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-bold">
                เลือกแล้ว {selectedKeys.size} รายการ (จะเพิ่มเฉพาะรายการใหม่ที่ยังไม่มีในระบบ)
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleImportSelected}
                  disabled={importing || selectedKeys.size === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${importing ? "animate-spin" : ""}`} />
                  <span>{importing ? "กำลังนำเข้า..." : `📥 ยืนยันนำเข้า ${selectedKeys.size} รายการ`}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
