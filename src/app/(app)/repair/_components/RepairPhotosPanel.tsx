"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Loader2, ImagePlus, Trash2, Eye, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/components/toast-provider";
import {
  uploadRepairPhotoAction,
  deleteRepairPhotoAction,
} from "@/app/actions/repair/photo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Photo {
  id: string;
  photoType: "BEFORE" | "AFTER";
  storageKey: string;
  mimeType: string;
  fileSize: number;
  url: string;
  createdAt: Date;
  uploadedBy?: { id: string; name: string };
}

interface PhotoGroupProps {
  repairId: string;
  photoType: "BEFORE" | "AFTER";
  photos: Photo[];
  limit: number;
  canUpload: boolean;
  canDelete: boolean;
  onRefresh: () => void;
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-4xl h-[80vh]"
        >
          <Image
            src={url}
            alt="ภาพขยาย"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-contain rounded-2xl shadow-2xl"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Photo Card ───────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  canDelete,
  onDelete,
}: {
  photo: Photo;
  canDelete: boolean;
  onDelete: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const { showToast } = useToast();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("ลบรูปภาพนี้?")) return;
    try {
      setDeleting(true);
      await onDelete();
    } catch (err: any) {
      showToast("error", err?.message ?? "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const sizeKb = Math.round(photo.fileSize / 1024);

  return (
    <>
      {lightbox && <Lightbox url={photo.url} onClose={() => setLightbox(false)} />}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-square"
      >
        <Image
          src={photo.url}
          alt={`${photo.photoType} photo`}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => setLightbox(true)}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {canDelete && !deleting && (
            <button
              onClick={handleDelete}
              className="w-9 h-9 rounded-full bg-red-500/80 hover:bg-red-600/90 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {deleting && (
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
        </div>
        {/* Size badge */}
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] font-mono">
          {sizeKb}KB
        </div>
      </motion.div>
    </>
  );
}

// ─── Photo Group ─────────────────────────────────────────────────────────────

import { compressImageInBrowser } from "@/lib/client-image-compression";
import { uploadPhotoWithProgress } from "@/lib/upload-with-progress";

function PhotoGroup({
  repairId,
  photoType,
  photos,
  limit,
  canUpload,
  canDelete,
  onRefresh,
}: PhotoGroupProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const activeCancelRef = useRef<(() => void) | null>(null);

  const isFull = photos.length >= limit;
  const typeLabel = photoType === "BEFORE" ? "ก่อนซ่อม" : "หลังซ่อม";
  const typeColor = photoType === "BEFORE"
    ? "from-amber-500 to-orange-500"
    : "from-emerald-500 to-teal-500";

  const handleCancelUpload = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeCancelRef.current) {
      activeCancelRef.current();
      activeCancelRef.current = null;
    }
    setUploading(false);
    setUploadPct(0);
    setUploadMsg("");
    showToast("warning", "ยกเลิกการอัปโหลดแล้ว");
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const rawFile = files[0];
    if (isFull) {
      showToast("error", `อัปโหลดได้สูงสุด ${limit} รูปต่อประเภท`);
      return;
    }

    try {
      setUploading(true);
      setUploadPct(5);
      setUploadMsg("กำลังปรับขนาดรูป...");

      // 1. Compress image in browser (reduces 10MB-50MB photo to ~200-400KB in milliseconds)
      const compressed = await compressImageInBrowser(rawFile);
      setUploadPct(25);
      setUploadMsg("กำลังส่งไฟล์...");

      // 2. Prepare FormData
      const fd = new FormData();
      fd.append("repairId", repairId);
      fd.append("photoType", photoType);
      fd.append("file", compressed);
      fd.append("currentCount", String(photos.length));

      // 3. Upload via XHR with progress tracking & abort capability
      const { promise, cancel } = uploadPhotoWithProgress(fd, (info) => {
        const pct = 25 + Math.round((info.percent / 100) * 75);
        setUploadPct(pct);
        setUploadMsg(`อัปโหลด ${info.percent}%`);
      });

      activeCancelRef.current = cancel;
      const res = await promise;

      if (!res.success) {
        throw new Error(res.error || "อัปโหลดรูปภาพไม่สำเร็จ");
      }

      setUploadPct(100);
      showToast("success", `อัปโหลดรูป${typeLabel}เรียบร้อย`);
      onRefresh();
    } catch (err: any) {
      if (err?.message !== "ยกเลิกการอัปโหลดเรียบร้อยแล้ว") {
        showToast("error", err?.message ?? "อัปโหลดไม่สำเร็จ");
      }
    } finally {
      setUploading(false);
      setUploadPct(0);
      setUploadMsg("");
      activeCancelRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [repairId, photoType, photos.length, isFull, limit, typeLabel, onRefresh, showToast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (canUpload && !isFull) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${typeColor} flex items-center justify-center`}>
            <Camera className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            รูป{typeLabel}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">{photos.length}/{limit}</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        <AnimatePresence mode="popLayout">
          {photos.map(photo => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              canDelete={canDelete}
              onDelete={async () => {
                await deleteRepairPhotoAction(photo.id, repairId);
                onRefresh();
              }}
            />
          ))}
        </AnimatePresence>

        {/* Upload slot */}
        {canUpload && !isFull && (
          <motion.div
            layout
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
              dragOver
                ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 scale-[1.02]"
                : "border-slate-300 dark:border-slate-600 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-500/5"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-center w-full">
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {uploadMsg || "กำลังอัปโหลด..."}
                </span>
                <div className="w-4/5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="mt-1 px-2 py-0.5 rounded bg-red-500 hover:bg-red-600 text-[10px] font-bold text-white shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> หยุด
                </button>
              </div>
            ) : (
              <>
                <ImagePlus className="w-6 h-6 text-slate-400" />
                <span className="text-[11px] text-slate-400 text-center px-2">
                  {dragOver ? "วางที่นี่" : "แตะหรือลากไฟล์"}
                </span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </motion.div>
        )}

        {/* Full indicator */}
        {isFull && (
          <div className="aspect-square rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 opacity-50">
            <Camera className="w-5 h-5 text-slate-400" />
            <span className="text-[10px] text-slate-400">ครบแล้ว</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface RepairPhotosPanelProps {
  repairId: string;
  repairStatus: string;
  requesterId?: string;
  assigneeId?: string | null;
  photosData: {
    BEFORE: Photo[];
    AFTER: Photo[];
    limits: { BEFORE: number; AFTER: number };
  };
  userId: string;
  userRole: string;
  userPosition?: string | null;
  onRefresh: () => void;
}

export default function RepairPhotosPanel({
  repairId,
  repairStatus,
  requesterId,
  assigneeId,
  photosData,
  userId,
  userRole,
  userPosition,
  onRefresh,
}: RepairPhotosPanelProps) {
  const isAdmin = userRole === "ADMIN" || userPosition === "แอดมิน";
  const isTechnician = userPosition === "ช่าง" || userRole === "REPAIR_MANAGER";
  const isAssignee = !!assigneeId && assigneeId === userId;
  const isRequester = !!requesterId && requesterId === userId;

  // ผู้แจ้งหรือช่าง/ADMIN: สามารถอัปโหลดและจัดการรูป BEFORE ได้ถ้าคำขอยังไม่ถูกยกเลิก
  const canUploadBefore =
    (isAdmin || isTechnician || isAssignee || isRequester) &&
    repairStatus !== "CANCELLED";

  const canUploadAfter =
    (isAdmin || isTechnician || isAssignee) &&
    (repairStatus === "ASSIGNED" || repairStatus === "IN_PROGRESS" || repairStatus === "COMPLETED");

  const canDeleteBefore = (isAdmin || isTechnician || isAssignee || isRequester) && repairStatus !== "CANCELLED";
  const canDeleteAfter = isAdmin || isTechnician || isAssignee;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20">
          <Camera className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">รูปภาพประกอบ</h3>
      </div>

      <PhotoGroup
        repairId={repairId}
        photoType="BEFORE"
        photos={photosData.BEFORE}
        limit={photosData.limits.BEFORE}
        canUpload={canUploadBefore}
        canDelete={canDeleteBefore}
        onRefresh={onRefresh}
      />

      <div className="border-t border-slate-100 dark:border-slate-800" />

      <PhotoGroup
        repairId={repairId}
        photoType="AFTER"
        photos={photosData.AFTER}
        limit={photosData.limits.AFTER}
        canUpload={canUploadAfter}
        canDelete={canDeleteAfter}
        onRefresh={onRefresh}
      />
    </div>
  );
}
