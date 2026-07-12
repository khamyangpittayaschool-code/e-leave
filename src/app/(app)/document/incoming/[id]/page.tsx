"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ArrowLeft,
  Check,
  Globe,
  Link2,
  Calendar,
  Building,
  User,
  Clock,
  Send,
  AlertCircle,
  Plus,
  Trash2,
  Settings2,
  Sparkles,
  ClipboardList,
  X
} from "lucide-react";
import { 
  getIncomingDocDetails, 
  resolveRoutingStep, 
  addRoutingStep, 
  skipRoutingStep 
} from "@/app/actions/incoming";
import { getSimpleUsersList } from "@/app/actions/settings";
import { useSession } from "@/lib/auth-client";
import { useToast } from "@/components/toast-provider";

type RoutingStep = {
  id: string;
  stepOrder: number;
  assigneeId: string;
  assignedById: string;
  status: string; // PENDING, COMPLETED, SKIPPED
  resolution: string | null;
  note: string | null;
  deadline: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  assignee: { name: string | null; position: string | null; signatureUrl: string | null };
  assignedBy: { name: string | null; position: string | null };
};

type IncomingDoc = {
  id: string;
  receiveNo: string;
  receiveDate: Date;
  senderOrg: string;
  docRefNo: string | null;
  title: string;
  urgencyLevel: string;
  amssLink: string | null;
  attachmentUrl: string | null;
  status: string;
  note: string | null;
  createdBy: { name: string | null; position: string | null };
  memoSection?: { name: string; code: string } | null;
  routingSteps: RoutingStep[];
};

export default function IncomingDocDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const { showToast: originalShowToast } = useToast();
  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    originalShowToast(type, msg);
  }, [originalShowToast]);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<IncomingDoc | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  // Resolution Form State (for current assignee)
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState("รับทราบ");
  const [customResolution, setCustomResolution] = useState("");
  const [note, setNote] = useState("");
  const [nextAssigneeId, setNextAssigneeId] = useState("");
  const [deadline, setDeadline] = useState("");

  // Add Step Form State (for Admin/Director)
  const [addingStep, setAddingStep] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepAssigneeId, setNewStepAssigneeId] = useState("");
  const [newStepDeadline, setNewStepDeadline] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [details, staff] = await Promise.all([
        getIncomingDocDetails(id),
        getSimpleUsersList()
      ]);
      if (!details) {
        showToast("ไม่พบเอกสารทะเบียนรับที่ระบุ", "error");
        router.push("/document");
        return;
      }
      setDoc(details as any);
      setUsers(staff);
    } catch (err: any) {
      showToast(err.message || "โหลดข้อมูลล้มเหลว", "error");
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Find active step matching logged in user
  const activeStepForUser = useMemo(() => {
    if (!doc || !session?.user) return null;
    return doc.routingSteps.find(
      s => s.assigneeId === session.user.id && s.status === "PENDING"
    );
  }, [doc, session]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStepForUser) return;
    
    setResolving(true);
    try {
      const finalResolution = resolution === "custom" ? customResolution.trim() : resolution;
      if (!finalResolution) {
        showToast("กรุณาระบุคำเกษียนสั่งการ", "error");
        setResolving(false);
        return;
      }

      await resolveRoutingStep({
        routingId: activeStepForUser.id,
        resolution: finalResolution,
        note: note.trim() || undefined,
        nextAssigneeId: nextAssigneeId || undefined,
        deadline: deadline || undefined
      });

      showToast("เกษียนสั่งการสำเร็จเรียบร้อย!", "success");
      loadData();
      
      // Reset form
      setResolution("รับทราบ");
      setCustomResolution("");
      setNote("");
      setNextAssigneeId("");
      setDeadline("");
    } catch (err: any) {
      showToast(err.message || "เกิดข้อผิดพลาดในการเกษียน", "error");
    } finally {
      setResolving(false);
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepAssigneeId) {
      showToast("กรุณาเลือกผู้รับมอบหมาย", "error");
      return;
    }
    setAddingStep(true);
    try {
      await addRoutingStep({
        incomingDocId: id,
        assigneeId: newStepAssigneeId,
        deadline: newStepDeadline || undefined
      });
      showToast("เพิ่มลำดับขั้นการเกษียนสำเร็จ", "success");
      setShowAddStepModal(false);
      setNewStepAssigneeId("");
      setNewStepDeadline("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "เพิ่มขั้นตอนล้มเหลว", "error");
    } finally {
      setAddingStep(false);
    }
  };

  const handleSkipStep = async (stepId: string) => {
    if (!confirm("คุณต้องการข้าม/ยกเลิกขั้นตอนเกษียนนี้หรือไม่?")) return;
    try {
      await skipRoutingStep(stepId);
      showToast("ข้ามขั้นตอนเรียบร้อย", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "ไม่สามารถข้ามขั้นตอนได้", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full"
        />
      </div>
    );
  }

  if (!doc) return null;

  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isDirector = (session?.user as any)?.position === "ผู้อำนวยการ";

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-1">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/document"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-500" />
              หนังสือรับราชการ: {doc.receiveNo}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ลงทะเบียนรับเมื่อ {new Date(doc.receiveDate).toLocaleDateString("th-TH")} เวลา {new Date(doc.receiveDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {doc.amssLink && (
            <a
              href={doc.amssLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-sm hover:bg-slate-50"
            >
              <Globe className="w-4 h-4 text-indigo-500" />
              เปิดดูใน AMSS++
            </a>
          )}
          {doc.attachmentUrl && (
            <a
              href={doc.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm"
            >
              <Link2 className="w-4 h-4" />
              ไฟล์แนบต้นฉบับ
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Book Metadata + Annotation Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-250/60 dark:border-slate-700 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-750 pb-2">
              รายละเอียดเอกสาร
            </h3>

            <div className="space-y-3 text-sm text-slate-750 dark:text-slate-350">
              <div>
                <span className="font-semibold text-slate-400 block text-xs">เรื่อง</span>
                <span className="font-bold text-slate-900 dark:text-white text-base leading-relaxed">{doc.title}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="font-semibold text-slate-400 block text-xs">หน่วยงานผู้ส่ง</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{doc.senderOrg}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block text-xs">เลขที่หนังสืออ้างอิง</span>
                  <span className="font-mono font-medium text-slate-850 dark:text-slate-200">{doc.docRefNo || "-"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="font-semibold text-slate-400 block text-xs">ความเร่งด่วน</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                    doc.urgencyLevel === "URGENT_MOST" ? "bg-red-50 text-red-650" :
                    doc.urgencyLevel === "URGENT_MORE" ? "bg-orange-50 text-orange-650" :
                    doc.urgencyLevel === "URGENT" ? "bg-yellow-50 text-yellow-650" : "bg-slate-50 text-slate-600"
                  }`}>
                    {doc.urgencyLevel === "URGENT_MOST" ? "ด่วนที่สุด" :
                     doc.urgencyLevel === "URGENT_MORE" ? "ด่วนมาก" :
                     doc.urgencyLevel === "URGENT" ? "ด่วน" : "ปกติ"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block text-xs">หมวดหมู่ภาระงาน</span>
                  <span className="font-medium">{doc.memoSection?.name || "ไม่ได้ระบุ"}</span>
                </div>
              </div>
              {doc.note && (
                <div className="pt-2 border-t border-slate-50 dark:border-slate-750">
                  <span className="font-semibold text-slate-400 block text-xs">บันทึกช่วยจำ</span>
                  <p className="text-xs leading-relaxed italic">{doc.note}</p>
                </div>
              )}
            </div>
          </div>

          {/* Annotation Box (Active Step Assignee Form) */}
          <AnimatePresence>
            {activeStepForUser && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 dark:from-purple-500/10 dark:to-indigo-500/10 border border-purple-200/50 dark:border-purple-800/30 rounded-3xl p-6 shadow-md space-y-6"
              >
                <div className="flex items-center gap-2 border-b border-purple-100 dark:border-purple-900/40 pb-3">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">ลงความเห็น / เกษียนหนังสือราชการ</h3>
                    <p className="text-[11px] text-slate-400">ถึงคิวการประเมินสั่งการของท่านแล้ว</p>
                  </div>
                </div>

                <form onSubmit={handleResolve} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        คำเกษียนสำเร็จรูป
                      </label>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-purple-500/20"
                      >
                        <option value="รับทราบ">รับทราบ</option>
                        <option value="ทราบและดำเนินการ">ทราบและดำเนินการ</option>
                        <option value="มอบงานวิชาการเพื่อโปรดพิจารณา">มอบงานวิชาการเพื่อโปรดพิจารณา</option>
                        <option value="มอบงานงบประมาณเพื่อโปรดพิจารณา">มอบงานงบประมาณเพื่อโปรดพิจารณา</option>
                        <option value="มอบงานบุคคลเพื่อโปรดพิจารณา">มอบงานบุคคลเพื่อโปรดพิจารณา</option>
                        <option value="custom">-- กรอกความเห็นเอง --</option>
                      </select>
                    </div>

                    {resolution === "custom" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                          ระบุความเห็นเกษียน *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น ทราบ มอบจัดประชุมเร่งด่วน..."
                          value={customResolution}
                          onChange={(e) => setCustomResolution(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                      ความคิดเห็น / หมายเหตุเพิ่มเติม
                    </label>
                    <textarea
                      placeholder="กรอกข้อความขยายความคำสั่ง หรือสิ่งที่ประสงค์เพิ่มเติม..."
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-purple-100 dark:border-purple-900/40 pt-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                        ส่งต่อให้บุคคลถัดไป (ถ้ามี)
                      </label>
                      <select
                        value={nextAssigneeId}
                        onChange={(e) => setNextAssigneeId(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-sm"
                      >
                        <option value="">-- สิ้นสุดกระบวนการที่ฉัน (ไม่ส่งต่อ) --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.position || "ไม่มีตำแหน่ง"})</option>
                        ))}
                      </select>
                    </div>

                    {nextAssigneeId && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                          กำหนดเสร็จของขั้นตอนถัดไป
                        </label>
                        <input
                          type="date"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={resolving}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition disabled:opacity-50 shadow-md shadow-purple-500/10 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {resolving ? "กำลังบันทึก..." : "ส่งการเกษียนหนังสือ"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right 1 Column: Routing Timeline */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-250/60 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-750 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                ลำดับขั้นตอนเกษียน
              </h3>
              
              {(isAdmin || isDirector) && (
                <button
                  onClick={() => setShowAddStepModal(true)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 hover:bg-slate-50"
                  title="เพิ่มขั้นเกษียนใหม่"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative border-l-2 border-slate-100 dark:border-slate-700/80 ml-3.5 pl-6 space-y-6">
              {/* Register Step */}
              <div className="relative">
                <span className="absolute -left-[32px] top-1 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-850" />
                <div>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                    ลงทะเบียนรับหนังสือ
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {doc.createdBy?.name || "ธุรการ"}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {new Date(doc.receiveDate).toLocaleDateString("th-TH")}
                  </p>
                </div>
              </div>

              {/* Routing Steps */}
              {doc.routingSteps.map((s, idx) => {
                const isPending = s.status === "PENDING";
                const isCompleted = s.status === "COMPLETED";
                const isSkipped = s.status === "SKIPPED";

                return (
                  <div key={s.id} className="relative">
                    {/* Bullet icon color */}
                    <span className={`absolute -left-[32px] top-1 flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white dark:ring-slate-850 ${
                      isCompleted ? "bg-emerald-500" :
                      isSkipped ? "bg-slate-300 dark:bg-slate-650" : "bg-amber-400 animate-pulse"
                    }`} />

                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isCompleted ? "text-emerald-600" :
                          isSkipped ? "text-slate-400" : "text-amber-600"
                        }`}>
                          ลำดับที่ {s.stepOrder} ({isCompleted ? "เกษียนแล้ว" : isSkipped ? "ข้าม" : "รอความเห็น"})
                        </span>
                        
                        {(isAdmin || isDirector) && isPending && (
                          <button
                            onClick={() => handleSkipStep(s.id)}
                            className="text-[10px] text-red-500 hover:underline font-bold"
                          >
                            ข้ามขั้นนี้
                          </button>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {s.assignee?.name}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {s.assignee?.position}
                      </p>

                      {isCompleted && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-350 space-y-1.5 mt-2">
                          <p className="font-bold text-slate-900 dark:text-white">
                            &quot;{s.resolution}&quot;
                          </p>
                          {s.note && (
                            <p className="text-[11px] text-slate-500 italic">
                              หมายเหตุ: {s.note}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1 border-t border-slate-100/60 dark:border-slate-800/60 pt-1">
                            เกษียนสั่งการเมื่อ: {new Date(s.completedAt!).toLocaleDateString("th-TH")} {new Date(s.completedAt!).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                          </p>
                        </div>
                      )}

                      {isPending && s.deadline && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1">
                          กำหนดเสร็จภายใน: {new Date(s.deadline).toLocaleDateString("th-TH")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── ADD STEP MODAL (ADMIN / DIRECTOR) ──────────────────────── */}
      <AnimatePresence>
        {showAddStepModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">เพิ่มขั้นตอนเกษียนส่งต่อ</h3>
                <button
                  onClick={() => setShowAddStepModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddStep} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    ผู้ดำเนินการ / ผู้เกษียนความเห็น
                  </label>
                  <select
                    required
                    value={newStepAssigneeId}
                    onChange={(e) => setNewStepAssigneeId(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    <option value="">-- เลือกบุคคล --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.position || "ไม่มีตำแหน่ง"})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                    กำหนดเวลาเสร็จ (ถ้ามี)
                  </label>
                  <input
                    type="date"
                    value={newStepDeadline}
                    onChange={(e) => setNewStepDeadline(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900 text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={addingStep}
                    className="flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm disabled:opacity-50"
                  >
                    {addingStep ? "กำลังบันทึก..." : "เพิ่มขั้นตอน"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddStepModal(false)}
                    className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      

    </div>
  );
}
