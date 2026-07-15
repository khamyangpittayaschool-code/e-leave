"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, RefreshCw, X, FolderOpen, Eye, Ban, ShieldAlert, AlertTriangle } from "lucide-react";

type MemoSection = { id: string; name: string; code: string; color?: string };

type DocumentTableProps = {
  activeTab: "outbound" | "inbound";
  outboundDocs: any[];
  inboundDocs: any[];
  sections: MemoSection[];
  onRefresh: () => void;
  onCancelDocClick: (id: string) => void;
};

export default function DocumentTable({
  activeTab,
  outboundDocs,
  inboundDocs,
  sections,
  onRefresh,
  onCancelDocClick,
}: DocumentTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);

  // Filters logic
  const filteredData = useMemo(() => {
    if (activeTab === "outbound") {
      return outboundDocs.filter((d) => {
        const matchesSearch =
          d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.docNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.requester?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesType =
          !selectedDocType ||
          (selectedDocType === "MEMO" && d.docType === "MEMO") ||
          (selectedDocType === "COMMAND" && d.docType === "COMMAND") ||
          (selectedDocType === "OUTGOING_NORMAL" && (d.docType === "OUTGOING_NORMAL" || d.docType === "OUTGOING")) ||
          (selectedDocType === "OUTGOING_CIRCULAR" && d.docType === "OUTGOING_CIRCULAR") ||
          (selectedDocType === "ANNOUNCEMENT" && d.docType === "ANNOUNCEMENT") ||
          d.memoSectionId === selectedDocType;

        const docYear = new Date(d.date).getFullYear() + 543;
        const matchesYear = !selectedYear || docYear.toString() === selectedYear;

        return matchesSearch && matchesType && matchesYear;
      });
    } else {
      return inboundDocs.filter((d) => {
        const matchesSearch =
          d.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.receiveNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.senderOrg?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.docRefNo?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType =
          !selectedDocType ||
          (selectedDocType === "AMSS" && d.amssOriginId) ||
          (selectedDocType === "MANUAL" && !d.amssOriginId) ||
          d.memoSectionId === selectedDocType;

        const docYear = new Date(d.receiveDate).getFullYear() + 543;
        const matchesYear = !selectedYear || docYear.toString() === selectedYear;

        return matchesSearch && matchesType && matchesYear;
      });
    }
  }, [activeTab, outboundDocs, inboundDocs, searchQuery, selectedDocType, selectedYear]);

  // Paginated/shown rows
  const visibleRows = useMemo(() => {
    if (showAllRows) return filteredData;
    return filteredData.slice(0, 10);
  }, [filteredData, showAllRows]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedDocType("");
    setSelectedYear("");
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
      {/* Table Title and Toolbar */}
      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-3 flex-wrap gap-2">
        <h3 className="text-sm font-extrabold text-slate-850 dark:text-white flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-purple-650" />
          ประวัติและทะเบียน{activeTab === "outbound" ? "ออกเลข" : "รับหนังสือ"}
        </h3>
        
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          รีเฟรช
        </button>
      </div>

      {/* Toolbar filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === "outbound" ? "ค้นหาเลขเดิม/เรื่อง/ผู้ขอ..." : "ค้นหาเลขรับ/อ้างอิง/เรื่อง/ผู้ส่ง..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none"
          />
        </div>

        <select
          value={selectedDocType}
          onChange={(e) => setSelectedDocType(e.target.value)}
          className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 text-xs cursor-pointer focus:ring-2 focus:ring-purple-500/20 outline-none"
        >
          <option value="">ประเภททั้งหมด</option>
          {activeTab === "outbound" ? (
            <>
              <option value="MEMO">บันทึกข้อความ</option>
              <option value="COMMAND">คำสั่ง</option>
              <option value="OUTGOING_NORMAL">หนังสือส่ง (ปกติ)</option>
              <option value="OUTGOING_CIRCULAR">หนังสือส่ง (จดหมายเวียน)</option>
              <option value="ANNOUNCEMENT">ประกาศ</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </>
          ) : (
            <>
              <option value="AMSS">ดึงจาก AMSS++</option>
              <option value="MANUAL">กรอกข้อมูลเอง</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </>
          )}
        </select>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 text-xs cursor-pointer focus:ring-2 focus:ring-purple-500/20 outline-none"
        >
          <option value="">ทุกปีการศึกษา</option>
          <option value="2569">ปีการศึกษา 2569</option>
          <option value="2568">ปีการศึกษา 2568</option>
          <option value="2567">ปีการศึกษา 2567</option>
        </select>

        {(searchQuery || selectedDocType || selectedYear) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 h-10 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50/80 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
            {activeTab === "outbound" ? (
              <tr>
                <th className="py-3.5 px-4 font-semibold">เลขที่</th>
                <th className="py-3.5 px-4 font-semibold">ประเภท</th>
                <th className="py-3.5 px-4 font-semibold">เรื่อง</th>
                <th className="py-3.5 px-4 font-semibold">ผู้ขอ</th>
                <th className="py-3.5 px-4 font-semibold">เวลาออกเลข</th>
                <th className="py-3.5 px-4 text-right">จัดการ</th>
              </tr>
            ) : (
              <tr>
                <th className="py-3.5 px-4 font-semibold">เลขทะเบียนรับ</th>
                <th className="py-3.5 px-4 font-semibold">อ้างอิงหนังสือ (ที่)</th>
                <th className="py-3.5 px-4 font-semibold">เรื่อง</th>
                <th className="py-3.5 px-4 font-semibold">จากหน่วยงาน</th>
                <th className="py-3.5 px-4 font-semibold">วันที่ลงรับ</th>
                <th className="py-3.5 px-4 text-right">จัดการ</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-450 dark:text-slate-500 font-semibold">
                  <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                  ไม่พบรายการเอกสารในหน้านี้
                </td>
              </tr>
            ) : (
              visibleRows.map((d) => {
                if (activeTab === "outbound") {
                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold font-mono text-purple-650 dark:text-purple-400">
                        {d.docNo ? (
                          <Link href={`/document/${d.id}`} className="hover:underline">
                            {d.docNo}
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic">DRAFT</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {d.docType === "MEMO" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-450 dark:border-transparent">
                            บันทึกข้อความ {d.memoSection ? `(${d.memoSection.code})` : ""}
                          </span>
                        ) : d.docType === "COMMAND" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-transparent">
                            คำสั่ง
                          </span>
                        ) : d.docType === "ANNOUNCEMENT" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-transparent">
                            ประกาศ
                          </span>
                        ) : d.docType.startsWith("OUTGOING") || d.docType === "OUTGOING" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-transparent">
                            {d.docType === "OUTGOING_CIRCULAR" ? "หนังสือส่ง (จดหมายเวียน)" : "หนังสือส่ง (ปกติ)"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-transparent">
                            {d.docType}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 max-w-xs truncate" title={d.title}>
                        {d.title}
                      </td>
                      <td className="py-3 px-4 text-slate-650 dark:text-slate-400">
                        {d.requester || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(d.date).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <Link
                            href={`/document/${d.id}`}
                            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          
                          {d.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => onCancelDocClick(d.id)}
                              className="w-7 h-7 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition flex items-center justify-center cursor-pointer"
                              title="ยกเลิกเลข"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                } else {
                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        <Link href={`/document/incoming/${d.id}`} className="hover:underline">
                          {d.receiveNo}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        {d.docRefNo || <span className="text-slate-400 italic">ไม่มีเลข</span>}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 max-w-xs truncate" title={d.title}>
                        {d.title}
                      </td>
                      <td className="py-3 px-4 text-slate-650 dark:text-slate-400">
                        {d.senderOrg}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(d.receiveDate).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <Link
                            href={`/document/incoming/${d.id}`}
                            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                }
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination "แสดงทั้งหมด" */}
      {filteredData.length > 10 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setShowAllRows(!showAllRows)}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {showAllRows ? "แสดงย่อ (10 รายการ)" : `แสดงผลทั้งหมด (${filteredData.length} รายการ)`}
          </button>
        </div>
      )}
    </div>
  );
}
