"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Wrench, MapPin, User, Calendar,
  CheckCircle2, Clock, AlertCircle, XCircle,
  Loader2, ChevronRight, FileText, Banknote, ClipboardList
} from "lucide-react";
import {
  getRepairDetailAction,
  assignRepairAction,
  startRepairAction,
  completeRepairAction,
  cancelRepairAction,
} from "@/app/actions/repair/update";
import { getRepairPhotosAction } from "@/app/actions/repair/photo";
import RepairPhotosPanel from "./RepairPhotosPanel";
import { hasRepairPermission } from "@/lib/permissions";
import { useToast } from "@/components/toast-provider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string; icon: React.ElementType }> = {
  PENDING:     { label: "รอดำเนินการ",  color: "text-amber-700 dark:text-amber-300",   bg: "bg-amber-50 dark:bg-amber-500/10",   ring: "ring-amber-200 dark:ring-amber-500/30",   icon: Clock },
  ASSIGNED:    { label: "มอบหมายแล้ว", color: "text-blue-700 dark:text-blue-300",     bg: "bg-blue-50 dark:bg-blue-500/10",     ring: "ring-blue-200 dark:ring-blue-500/30",     icon: AlertCircle },
  IN_PROGRESS: { label: "กำลังซ่อม",   color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-500/10", ring: "ring-violet-200 dark:ring-violet-500/30", icon: Wrench },
  COMPLETED:   { label: "เสร็จสิ้น",   color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-200 dark:ring-emerald-500/30", icon: CheckCircle2 },
  CANCELLED:   { label: "ยกเลิก",      color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-100 dark:bg-slate-800",     ring: "ring-slate-200 dark:ring-slate-700",     icon: XCircle },
};

const URGENCY_LABELS: Record<string, { label: string; cls: string }> = {
  NORMAL:      { label: "ปกติ",    cls: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  URGENT:      { label: "เร่งด่วน", cls: "text-orange-600 bg-orange-50 dark:bg-orange-500/10" },
  URGENT_MOST: { label: "เร่งด่วนมาก", cls: "text-red-600 bg-red-50 dark:bg-red-500/10 font-extrabold" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: "ไฟฟ้า",
  PLUMBING:   "ประปา",
  BUILDING:   "อาคาร/โครงสร้าง",
  IT:         "อุปกรณ์ IT",
  EQUIPMENT:  "ครุภัณฑ์/เฟอร์นิเจอร์",
  OTHER:      "อื่น ๆ",
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 dark:border-slate-800/80 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
        <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ─── Workflow Action Panel ────────────────────────────────────────────────────

function WorkflowPanel({ repair, user, onRefresh }: { repair: any; user: any; onRefresh: () => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [completeForm, setCompleteForm] = useState({ resolutionNote: "", cost: "", materialsUsed: "" });
  const [cancelReason, setCancelReason] = useState("");

  const canAssign   = hasRepairPermission(user, "repair:assign");
  const canUpdate   = hasRepairPermission(user, "repair:update");
  const canDelete   = hasRepairPermission(user, "repair:delete");
  const isAssignee  = repair.assigneeId === user.id;
  const isOwner     = repair.requesterId === user.id;
  const isAdmin     = user.role === "ADMIN" || user.position === "แอดมิน";

  const wrap = async (fn: () => Promise<any>) => {
    try {
      setBusy(true);
      const res = await fn();
      if (res && res.success === false) {
        throw new Error(res.error || "เกิดข้อผิดพลาด");
      }
      onRefresh();
    } catch (e: any) {
      showToast("error", e?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  if (repair.status === "COMPLETED" || repair.status === "CANCELLED") {
    const cfg = STATUS_CONFIG[repair.status];
    const Icon = cfg.icon;
    return (
      <div className={`rounded-2xl p-5 ring-1 ${cfg.bg} ${cfg.ring} flex items-center gap-3`}>
        <Icon className={`w-6 h-6 ${cfg.color} shrink-0`} />
        <div>
          <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
          {repair.status === "CANCELLED" && repair.cancelReason && (
            <p className="text-xs text-slate-500 mt-0.5">เหตุผล: {repair.cancelReason}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ASSIGN: HEAD/ADMIN + status=PENDING */}
      {canAssign && repair.status === "PENDING" && (
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-2xl p-4 space-y-3 ring-1 ring-blue-200 dark:ring-blue-500/30">
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> มอบหมายให้ช่าง
          </p>
          <input
            type="text"
            placeholder="User ID ของช่าง (ชั่วคราว — Sprint 2 จะเป็น dropdown)"
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          />
          <button
            disabled={busy || !assigneeId.trim()}
            onClick={() => wrap(async () => { await assignRepairAction(repair.id, assigneeId.trim(), repair.version); })}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            มอบหมาย
          </button>
        </div>
      )}

      {/* START: assignee or admin + status=ASSIGNED */}
      {(isAssignee || isAdmin) && canUpdate && repair.status === "ASSIGNED" && (
        <button
          disabled={busy}
          onClick={() => wrap(async () => { await startRepairAction(repair.id, repair.version); })}
          className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          เริ่มดำเนินการซ่อม
        </button>
      )}

      {/* COMPLETE: assignee or admin + status=IN_PROGRESS */}
      {(isAssignee || isAdmin) && canUpdate && repair.status === "IN_PROGRESS" && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4 space-y-3 ring-1 ring-emerald-200 dark:ring-emerald-500/30">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> บันทึกผลการซ่อม
          </p>
          <textarea
            placeholder="สรุปผลการซ่อม เช่น เปลี่ยนสวิตช์ไฟแล้ว..."
            rows={3}
            value={completeForm.resolutionNote}
            onChange={e => setCompleteForm(f => ({ ...f, resolutionNote: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              placeholder="ค่าใช้จ่าย (บาท)"
              value={completeForm.cost}
              onChange={e => setCompleteForm(f => ({ ...f, cost: e.target.value }))}
              className="px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            />
            <input
              type="text"
              placeholder="วัสดุที่ใช้"
              value={completeForm.materialsUsed}
              onChange={e => setCompleteForm(f => ({ ...f, materialsUsed: e.target.value }))}
              className="px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            />
          </div>
          <button
            disabled={busy || !completeForm.resolutionNote.trim()}
            onClick={() => wrap(async () => { await completeRepairAction(repair.id, repair.version, {
              resolutionNote: completeForm.resolutionNote,
              cost: completeForm.cost ? Number(completeForm.cost) : null,
              materialsUsed: completeForm.materialsUsed || null,
            }); })}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            ยืนยันงานเสร็จสิ้น
          </button>
        </div>
      )}

      {/* CANCEL: owner or admin + status PENDING/ASSIGNED */}
      {(isOwner || isAdmin || canDelete) && ["PENDING", "ASSIGNED"].includes(repair.status) && (
        <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl p-4 space-y-3 ring-1 ring-red-200 dark:ring-red-500/30">
          <p className="text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> ยกเลิกคำขอ
          </p>
          <input
            type="text"
            placeholder="ระบุเหตุผลการยกเลิก..."
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all"
          />
          <button
            disabled={busy || !cancelReason.trim()}
            onClick={() => wrap(async () => { await cancelRepairAction(repair.id, repair.version, cancelReason); })}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:opacity-50 shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            ยืนยันการยกเลิก
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RepairDetailPage({ repairId }: { repairId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [repair, setRepair] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photosData, setPhotosData] = useState<any>(null);

  const user = session?.user as any;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [res, photos] = await Promise.all([
        getRepairDetailAction(repairId),
        getRepairPhotosAction(repairId).catch(() => ({ BEFORE: [], AFTER: [], limits: { BEFORE: 2, AFTER: 2 } })),
      ]);
      if (!res.success) {
        throw new Error(res.error || "ไม่สามารถโหลดข้อมูลได้");
      }
      setRepair(res.repair);
      setPhotosData(photos);
    } catch (e: any) {
      setError(e?.message ?? "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [repairId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-3">
      <XCircle className="w-10 h-10 text-red-400" />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{error}</p>
      <button onClick={() => router.back()} className="text-sm text-purple-600 hover:underline">← กลับ</button>
    </div>
  );

  if (!repair) return null;

  const cfg = STATUS_CONFIG[repair.status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = cfg.icon;
  const urg = URGENCY_LABELS[repair.urgency] ?? URGENCY_LABELS.LOW;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{repair.repairNo}</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${cfg.color} ${cfg.bg} ${cfg.ring}`}>
              <StatusIcon className="w-3.5 h-3.5" /> {cfg.label}
            </span>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${urg.cls}`}>{urg.label}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1 line-clamp-2">{repair.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Info Panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 space-y-1"
        >
          <InfoRow icon={FileText}      label="รายละเอียด"  value={<p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{repair.description}</p>} />
          <InfoRow icon={MapPin}        label="สถานที่"     value={repair.location} />
          <InfoRow icon={ClipboardList} label="ประเภท"      value={CATEGORY_LABELS[repair.category] ?? repair.category} />
          <InfoRow icon={User}          label="ผู้แจ้ง"     value={repair.requester?.name ?? "—"} />
          <InfoRow icon={User}          label="ช่างที่รับ"  value={repair.assignee?.name ?? <span className="text-slate-400 italic">ยังไม่มอบหมาย</span>} />
          <InfoRow icon={Calendar}      label="วันที่แจ้ง"  value={new Date(repair.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} />
          {repair.expectedFinishAt && (
            <InfoRow icon={Calendar} label="กำหนดเสร็จ" value={new Date(repair.expectedFinishAt).toLocaleDateString("th-TH", { dateStyle: "medium" })} />
          )}
          {repair.resolutionNote && (
            <InfoRow icon={CheckCircle2} label="ผลการซ่อม" value={<p className="text-sm leading-relaxed text-emerald-700 dark:text-emerald-300">{repair.resolutionNote}</p>} />
          )}
          {repair.cost !== null && repair.cost !== undefined && (
            <InfoRow icon={Banknote} label="ค่าใช้จ่าย" value={<span className="text-emerald-700 dark:text-emerald-300 font-semibold">{Number(repair.cost).toLocaleString("th-TH")} บาท</span>} />
          )}
          {repair.materialsUsed && (
            <InfoRow icon={ClipboardList} label="วัสดุที่ใช้" value={repair.materialsUsed} />
          )}
        </motion.div>

        {/* Workflow Panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">การดำเนินการ</p>
            {user ? (
              <WorkflowPanel repair={repair} user={user} onRefresh={load} />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
            )}
          </div>
        </motion.div>
      </div>

      {/* Photo Panel */}
      {photosData && user && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <RepairPhotosPanel
            repairId={repair.id}
            repairStatus={repair.status}
            photosData={photosData}
            userId={user.id}
            userRole={user.role ?? "TEACHER"}
            userPosition={user.position ?? null}
            onRefresh={load}
          />
        </motion.div>
      )}
    </div>
  );
}
