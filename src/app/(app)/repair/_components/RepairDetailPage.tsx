"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Wrench, MapPin, User, Calendar,
  CheckCircle2, Clock, AlertCircle, XCircle,
  Loader2, ChevronRight, FileText, Banknote, ClipboardList, Printer
} from "lucide-react";
import {
  getRepairDetailAction,
  assignRepairAction,
  startRepairAction,
  completeRepairAction,
  cancelRepairAction,
} from "@/app/actions/repair/update";
import { getAssignableTechniciansAction } from "@/app/actions/repair/user";
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
  const [technicians, setTechnicians] = useState<{ id: string; name: string; position?: string }[]>([]);
  const [completeForm, setCompleteForm] = useState({ resolutionNote: "", cost: "", materialsUsed: "" });
  const [cancelReason, setCancelReason] = useState("");

  const canAssign   = hasRepairPermission(user, "repair:assign");
  const canUpdate   = hasRepairPermission(user, "repair:update");
  const canDelete   = hasRepairPermission(user, "repair:delete");
  const isAssignee  = repair.assigneeId === user.id;
  const isOwner     = repair.requesterId === user.id;
  const isAdmin     = user.role === "ADMIN" || user.position === "แอดมิน";

  useEffect(() => {
    if (canAssign && repair.status === "PENDING") {
      getAssignableTechniciansAction().then(res => {
        if (res.success && res.technicians) {
          setTechnicians(res.technicians);
          if (res.technicians.length > 0) {
            setAssigneeId(res.technicians[0].id);
          }
        }
      });
    }
  }, [canAssign, repair.status]);

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
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer font-medium"
          >
            {technicians.length === 0 ? (
              <option value="">-- ไม่พบรายชื่อช่าง --</option>
            ) : (
              technicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.position ? `(${t.position})` : ""}
                </option>
              ))
            )}
          </select>
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

// ─── Status Lifecycle Stepper Component ─────────────────────────────────────

const WORKFLOW_STEPS = [
  { key: "PENDING font-semibold", status: "PENDING", label: "รอดำเนินการ", icon: Clock },
  { key: "ASSIGNED", status: "ASSIGNED", label: "มอบหมายแล้ว", icon: AlertCircle },
  { key: "IN_PROGRESS", status: "IN_PROGRESS", label: "กำลังซ่อม", icon: Wrench },
  { key: "COMPLETED", status: "COMPLETED", label: "เสร็จสิ้น", icon: CheckCircle2 },
];

function StatusStepper({ currentStatus }: { currentStatus: string }) {
  if (currentStatus === "CANCELLED") {
    return (
      <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-center gap-2 text-slate-500 font-bold text-sm">
        <XCircle className="w-5 h-5 text-red-500" />
        คำขอนี้ถูกยกเลิกแล้ว
      </div>
    );
  }

  const order = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED"];
  const currentIndex = order.indexOf(currentStatus);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isDone = currentIndex >= idx;
          const isCurrent = currentIndex === idx;
          const Icon = step.icon;

          return (
            <div
              key={step.status}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                isCurrent
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 shadow-sm"
                  : isDone
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-400"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isCurrent
                    ? "bg-orange-500 text-white"
                    : isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RepairDetailPage({ repairId }: { repairId?: string }) {
  const params = useParams();
  const router = useRouter();
  const id = repairId || (params?.id as string);

  const { data: session } = useSession();
  const { showToast } = useToast();

  const [repair, setRepair] = useState<any>(null);
  const [photosData, setPhotosData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user as any;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [detailRes, photoRes] = await Promise.all([
        getRepairDetailAction(id),
        getRepairPhotosAction(id).catch(() => null),
      ]);

      if (!detailRes.success || !detailRes.repair) {
        throw new Error(detailRes.error || "ไม่พบข้อมูลการแจ้งซ่อม");
      }

      setRepair(detailRes.repair);
      setPhotosData(photoRes);
    } catch (err: any) {
      setError(err?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-500">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      <p className="text-sm font-medium">กำลังโหลดข้อมูลแจ้งซ่อม...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-3">
      <XCircle className="w-10 h-10 text-red-500" />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{error}</p>
      <button onClick={() => router.back()} className="text-sm font-bold text-orange-500 hover:underline">← ย้อนกลับ</button>
    </div>
  );

  if (!repair) return null;

  const cfg = STATUS_CONFIG[repair.status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = cfg.icon;
  const urg = URGENCY_LABELS[repair.urgency] ?? URGENCY_LABELS.NORMAL;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          ย้อนกลับ
        </button>

        <button
          onClick={() => window.open(`/print/repair/${repair.id}`, "_blank")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          พิมพ์ใบแจ้งซ่อม (A4)
        </button>
      </div>

      {/* Hero Title & Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-500/10 to-amber-500/0 pointer-events-none rounded-tr-2xl" />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full">
              #{repair.repairNo}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ${cfg.color} ${cfg.bg} ${cfg.ring}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {cfg.label}
            </span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${urg.cls}`}>
            ความเร่งด่วน: {urg.label}
          </span>
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
          {repair.title}
        </h1>
      </motion.div>

      {/* Lifecycle Workflow Stepper Bar */}
      <StatusStepper currentStatus={repair.status} />

      {/* Main Grid: Details & Workflow Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6"
        >
          {/* Key Attributes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">สถานที่ / ห้อง</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{repair.location}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">หมวดหมู่งานซ่อม</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{CATEGORY_LABELS[repair.category] ?? repair.category}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ผู้แจ้งซ่อม</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{repair.requester?.name ?? "-"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ช่างผู้รับผิดชอบ</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {repair.assignee?.name ?? <span className="text-amber-500 italic font-normal">ยังไม่ได้มอบหมาย</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Issue Description Block */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-orange-500" />
              รายละเอียดปัญหา / อาการชำรุด
            </h3>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {repair.description || "ไม่ระบุรายละเอียดเพิ่มเติม"}
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              วันที่แจ้ง: {new Date(repair.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            {repair.expectedFinishAt && (
              <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                ต้องการให้เสร็จภายใน: {new Date(repair.expectedFinishAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}
              </span>
            )}
          </div>

          {/* Execution Result Summary (When status is COMPLETED or resolution exists) */}
          {(repair.resolutionNote || repair.cost !== null || repair.materialsUsed) && (
            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4 space-y-3 pt-3">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                สรุปผลการดำเนินงานซ่อมแซม
              </h3>

              {repair.resolutionNote && (
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  {repair.resolutionNote}
                </p>
              )}

              <div className="flex items-center gap-4 flex-wrap text-xs pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                {repair.materialsUsed && (
                  <span className="text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">วัสดุที่ใช้:</span> {repair.materialsUsed}
                  </span>
                )}
                {repair.cost !== null && repair.cost !== undefined && (
                  <span className="text-slate-600 dark:text-slate-300 font-bold">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">ค่าใช้จ่ายรวม:</span> {Number(repair.cost).toLocaleString("th-TH")} บาท
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right Column: Workflow Action Panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">การดำเนินการ</h3>
            {user ? (
              <WorkflowPanel repair={repair} user={user} onRefresh={load} />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
            )}
          </div>
        </motion.div>
      </div>

      {/* Photo Panel (BEFORE / AFTER photos) */}
      {photosData && user && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <RepairPhotosPanel
            repairId={repair.id}
            repairStatus={repair.status}
            requesterId={repair.requesterId}
            assigneeId={repair.assigneeId}
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
