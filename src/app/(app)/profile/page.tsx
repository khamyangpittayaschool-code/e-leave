"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { updateProfile } from "@/app/actions/user";
import { authClient } from "@/lib/auth-client";
import { Save, Lock, User as UserIcon, ShieldCheck, Mail, BookOpen, KeyRound, CheckCircle, Fingerprint, Camera, Trash2, Pencil, RefreshCw, Paperclip, Phone, MapPin, Award, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/toast-provider";
import { motion, AnimatePresence } from "framer-motion";

const compressImage = (file: File, maxWidth: number, maxHeight: number, format: "jpeg" | "png" = "jpeg", quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(`image/${format}`, quality));
      };
      img.onerror = () => reject(new Error("Image load error"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
};

const processSignatureFile = (file: File, removeBackground: boolean): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context error"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        if (removeBackground) {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > 200 && g > 200 && b > 200) {
              data[i + 3] = 0; // Alpha
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Image load error"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
};

export default function ProfilePage() {
  const { data: session, isPending, refetch } = useSession();
  const user = session?.user as any;
  const { t, lang, tPosition, tSubjectGroup, tLevel } = useI18n();
  const { showToast } = useToast();
  const [avatarActionSheetOpen, setAvatarActionSheetOpen] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subjectGroup, setSubjectGroup] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [level, setLevel] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState("");
  const [signaturePreview, setSignaturePreview] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedSigFile, setSelectedSigFile] = useState<File | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [sigMethod, setSigMethod] = useState<"upload" | "draw">("upload");

  // Sync state with user data once loaded
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setSubjectGroup(user.subjectGroup || "");
      setAddress(user.address || "");
      setPhoneNumber(user.phoneNumber || "");
      setLevel(user.level || "");
      setAvatarPreview(user.image || "");
      setSignaturePreview(user.signatureUrl || "");
    }
  }, [user]);

  if (isPending) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-3xl"></div>
            <div className="md:col-span-2 space-y-6">
              <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-3xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({ name, email, subjectGroup, address, phoneNumber, level });
      await refetch();
      showToast("success", t("profileUpdateSuccess"));
    } catch (error) {
      showToast("error", t("profileUpdateError"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("error", lang === "en" ? "Image size must not exceed 10MB" : "ขนาดรูปภาพต้องไม่เกิน 10MB");
      return;
    }

    try {
      const compressedBase64 = await compressImage(file, 200, 200, "jpeg", 0.85);
      setAvatarPreview(compressedBase64);
      await updateProfile({ name, subjectGroup, address, phoneNumber, level, image: compressedBase64 });
      await refetch();
    } catch (err) {
      console.error("Failed to save avatar", err);
      showToast("error", lang === "en" ? "Failed to save avatar" : "เกิดข้อผิดพลาดในการบันทึกรูปภาพประจำตัว");
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("error", lang === "en" ? "File size must not exceed 10MB" : "ขนาดไฟล์ต้องไม่เกิน 10MB");
      return;
    }
    setSelectedSigFile(file);
  };

  useEffect(() => {
    if (selectedSigFile) {
      processSignatureFile(selectedSigFile, removeBg)
        .then(base64 => {
          setSignaturePreview(base64);
        })
        .catch(err => {
          console.error("Failed to process signature", err);
        });
    }
  }, [selectedSigFile, removeBg]);

  // --- Signature Canvas Drawing Handlers ---
  useEffect(() => {
    if (isDrawingModalOpen) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = rect.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "#4F46E5"; // Indigo-600
          }
        }
      }, 150);
    }
  }, [isDrawingModalOpen]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#4F46E5"; // Indigo-600

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y);
    ctx.stroke();
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveDrawnSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // Check if canvas is empty
    const buffer = new Uint32Array(canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    const isEmpty = !buffer.some(color => color !== 0);

    if (isEmpty) {
      showToast("warning", t("drawSigWarning"));
      return;
    }

    const base64 = canvas.toDataURL("image/png");
    setSignaturePreview(base64);
    clearCanvas();
    setIsDrawingModalOpen(false);
  };

  const handleSaveSignatureToDb = async () => {
    if (!signaturePreview) return;
    setSavingSignature(true);
    try {
      await updateProfile({ name, subjectGroup, address, phoneNumber, level, signatureUrl: signaturePreview });
      await refetch();
      showToast("success", t("sigSaveSuccess"));
    } catch (err) {
      showToast("error", t("sigSaveError"));
    } finally {
      setSavingSignature(false);
    }
  };

  const handleDeleteSignature = async () => {
    if (!confirm(t("confirmDeleteSig"))) return;
    setSavingSignature(true);
    try {
      await updateProfile({ name, subjectGroup, address, phoneNumber, level, signatureUrl: "" });
      await refetch();
      setSignaturePreview("");
      showToast("success", t("sigDeleteSuccess"));
    } catch (err) {
      showToast("error", t("sigDeleteError"));
    } finally {
      setSavingSignature(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("passwordMinLength"));
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true,
      });

      if (res.error) {
        setPasswordError(res.error.message || t("currentPasswordIncorrect"));
      } else {
        setPasswordSuccess(t("changePasswordSuccess"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      setPasswordError(t("changePasswordError"));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 dark:from-purple-950 dark:via-indigo-950 dark:to-black p-8 md:p-10 shadow-lg border border-indigo-900/40">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-12 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl -z-10" />

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 text-white shadow-inner">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {t("profile")}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1">
              {t("manageProfileDesc")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Profile Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          {/* Cover Header */}
          <div className="h-32 bg-gradient-to-br from-purple-500 to-indigo-600 relative">
            <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
            <div className="absolute bottom-0 right-4 translate-y-1/2 flex items-center justify-center p-1 rounded-full bg-white dark:bg-slate-900 shadow-md">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-955 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Active
              </span>
            </div>
          </div>

          <div className="px-6 pb-8 pt-0 flex flex-col items-center text-center relative">
            {/* Avatar */}
            <div
              onClick={() => setAvatarActionSheetOpen(true)}
              className="-mt-16 w-28 h-28 rounded-full border-4 border-white dark:border-slate-950 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-extrabold shadow-xl relative group overflow-hidden cursor-pointer"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || "U"
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 text-[10px] font-bold">
                <Camera className="w-5 h-5 text-white" />
                <span>{t("changeAvatarText")}</span>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-4 leading-tight">{user?.name}</h2>

            <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <Mail className="w-3.5 h-3.5" />
              {user?.email}
            </div>

            {/* Quick Badge */}
            <div className="mt-5 w-full flex flex-col gap-2.5 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                <span>{t("roleLabel")}</span>
                <span>{t("departmentLabelShort")}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-100 dark:border-purple-900/50">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {tPosition(user?.position) || user?.position || t("staffMember")}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-100 dark:border-indigo-900/50 max-w-[140px] truncate" title={user?.subjectGroup}>
                  <BookOpen className="w-3.5 h-3.5" />
                  {tSubjectGroup(user?.subjectGroup)}
                </span>
              </div>
            </div>

            {/* Extra Account Stats */}
            <div className="mt-4 w-full flex items-center justify-between px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                UID: {user?.id ? user.id.substring(0, 8).toUpperCase() : "N/A"}
              </span>
              <span>
                {lang === "en" ? "Joined:" : "เริ่มใช้งานเมื่อ:"} {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { month: "short", year: "numeric" }) : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Forms */}
        <div className="lg:col-span-2 space-y-8">

          {/* Profile Info Form */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <UserIcon className="w-5 h-5 text-indigo-500" />
              {lang === "en" ? "Personal Information" : "ข้อมูลส่วนตัว"}
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {t("fullNameLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                    />
                    <UserIcon className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {t("email")}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                      placeholder="example@email.com"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>

                {["ครู", "นักศึกษาฝึกประสบการณ์", "หัวหน้างานบุคคล", "TEACHER", "HEAD"].includes(user?.position || "") && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                      {t("departmentLabel")}
                    </label>
                    <div className="relative">
                      <select
                        value={subjectGroup}
                        onChange={(e) => setSubjectGroup(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm appearance-none cursor-pointer"
                      >
                        <option value="" disabled>
                          {t("selectSubjectGroup")}
                        </option>
                        <option value="คณิตศาสตร์">{tSubjectGroup("คณิตศาสตร์")}</option>
                        <option value="วิทยาศาสตร์และเทคโนโลยี">{tSubjectGroup("วิทยาศาสตร์และเทคโนโลยี")}</option>
                        <option value="ภาษาไทย">{tSubjectGroup("ภาษาไทย")}</option>
                        <option value="ภาษาต่างประเทศ">{tSubjectGroup("ภาษาต่างประเทศ")}</option>
                        <option value="สังคมศึกษา ศาสนา และวัฒนธรรม">{tSubjectGroup("สังคมศึกษา ศาสนา และวัฒนธรรม")}</option>
                        <option value="สังคมศึกษา ศาสนาและวัฒนธรรม">{tSubjectGroup("สังคมศึกษา ศาสนาและวัฒนธรรม")}</option>
                        <option value="สุขศึกษาและพลศึกษา">{tSubjectGroup("สุขศึกษาและพลศึกษา")}</option>
                        <option value="สุขศึกษา พลศึกษา">{tSubjectGroup("สุขศึกษา พลศึกษา")}</option>
                        <option value="ศิลปะ">{tSubjectGroup("ศิลปะ")}</option>
                        <option value="ศิลปศึกษา">{tSubjectGroup("ศิลปศึกษา")}</option>
                        <option value="การงานอาชีพ">{tSubjectGroup("การงานอาชีพ")}</option>
                        <option value="กิจกรรมพัฒนาผู้เรียน">{tSubjectGroup("กิจกรรมพัฒนาผู้เรียน")}</option>
                        <option value="งานแนะแนว">{tSubjectGroup("งานแนะแนว")}</option>
                        <option value="นักพัฒนาโรงเรียนและบุคลากรอื่นๆ">{tSubjectGroup("นักพัฒนาโรงเรียนและบุคลากรอื่นๆ")}</option>
                      </select>
                      <BookOpen className="w-4 h-4 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {lang === "en" ? "Level" : "ระดับ"}
                  </label>
                  <div className="relative">
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm appearance-none cursor-pointer"
                    >
                      <option value="">{tLevel("")}</option>
                      <option value="ครูผู้ช่วย">{tLevel("ครูผู้ช่วย")}</option>
                      <option value="ครู">{tLevel("ครู")}</option>
                      <option value="ครูชำนาญการ">{tLevel("ครูชำนาญการ")}</option>
                      <option value="ครูชำนาญการพิเศษ">{tLevel("ครูชำนาญการพิเศษ")}</option>
                      <option value="ครูเชี่ยวชาญ">{tLevel("ครูเชี่ยวชาญ")}</option>
                      <option value="ครูเชี่ยวชาญพิเศษ">{tLevel("ครูเชี่ยวชาญพิเศษ")}</option>
                      <option value="รองผู้อำนวยการชำนาญการ">{tLevel("รองผู้อำนวยการชำนาญการ")}</option>
                      <option value="รองผู้อำนวยการชำนาญการพิเศษ">{tLevel("รองผู้อำนวยการชำนาญการพิเศษ")}</option>
                      <option value="รองผู้อำนวยการเชี่ยวชาญ">{tLevel("รองผู้อำนวยการเชี่ยวชาญ")}</option>
                      <option value="ผู้อำนวยการชำนาญการ">{tLevel("ผู้อำนวยการชำนาญการ")}</option>
                      <option value="ผู้อำนวยการชำนาญการพิเศษ">{tLevel("ผู้อำนวยการชำนาญการพิเศษ")}</option>
                      <option value="ผู้อำนวยการเชี่ยวชาญ">{tLevel("ผู้อำนวยการเชี่ยวชาญ")}</option>
                      <option value="ผู้อำนวยการเชี่ยวชาญพิเศษ">{tLevel("ผู้อำนวยการเชี่ยวชาญพิเศษ")}</option>
                    </select>
                    <Award className="w-4 h-4 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {lang === "en" ? "Phone Number" : "เบอร์โทรศัพท์ติดต่อ"}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                      placeholder="08XXXXXXXX"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {lang === "en" ? "Contact Address" : "ที่อยู่ที่ติดต่อได้"}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                      placeholder="บ้านเลขที่ ถนน ตำบล..."
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-6 h-10 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-md shadow-purple-500/10 focus:ring-4 focus:ring-purple-500/20 transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? t("saving") : t("saveData")}
                </button>
              </div>
            </form>
          </div>

          {/* Signature Upload & Drawing Card */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <Fingerprint className="w-5 h-5 text-indigo-500" />
              {t("signatureTitle")}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Preview Container */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t("currentSignature")}
                </label>
                <div className="h-44 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 flex flex-col items-center justify-center overflow-hidden p-4 relative group">
                  {signaturePreview ? (
                    <>
                      <img src={signaturePreview} alt="Signature Preview" className="max-h-full max-w-full object-contain dark:invert" />
                      <button
                        onClick={handleDeleteSignature}
                        className="absolute bottom-3 right-3 w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-955 hover:bg-rose-100 dark:hover:bg-rose-900 flex items-center justify-center text-rose-600 transition-colors shadow-sm cursor-pointer"
                        title={lang === "en" ? "Delete Signature" : "ลบลายเซ็นต์"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center text-slate-400 dark:text-slate-600">
                      <Fingerprint className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="text-xs font-semibold">{t("noSignature")}</p>
                      <p className="text-[10px] mt-1 text-slate-400 max-w-[180px]">{t("sigRequiredDesc")}</p>
                    </div>
                  )}
                </div>
                {signaturePreview && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveSignatureToDb}
                      disabled={savingSignature}
                      className="flex items-center gap-2 px-5 h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/10 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingSignature ? t("saving") : t("confirmSaveSig")}
                    </button>
                  </div>
                )}
              </div>

              {/* Upload/Draw Input Container */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t("uploadOrDrawSig")}
                </label>

                {/* Method selector tab */}
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSigMethod("upload")}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${sigMethod === "upload" 
                      ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/40 dark:border-slate-800/40" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-205"}`}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{t("uploadImageTab")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigMethod("draw")}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${sigMethod === "draw" 
                      ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/40 dark:border-slate-800/40" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-205"}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t("drawSigTab")}</span>
                  </button>
                </div>

                {/* Upload Section */}
                {sigMethod === "upload" && (
                  <div className="space-y-3">
                    <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-all cursor-pointer group">
                      <input
                        ref={signatureInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                      <Paperclip className="w-7 h-7 text-slate-300 dark:text-slate-700 group-hover:text-purple-400 transition-colors mb-1.5" />
                      <span className="text-xs text-slate-400 group-hover:text-purple-500 transition-colors">{t("clickUploadSig")}</span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-700 mt-1">{t("sigTransparentDesc")}</span>
                    </label>

                    <div className="flex items-center gap-2 mt-2 px-1">
                      <input
                        type="checkbox"
                        id="remove-bg-checkbox"
                        checked={removeBg}
                        onChange={(e) => setRemoveBg(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-650 focus:ring-purple-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <label htmlFor="remove-bg-checkbox" className="text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                        {lang === "en" ? "Automatically remove white background" : "ลบพื้นหลังสีขาวอัตโนมัติ (แนะนำ)"}
                      </label>
                    </div>
                  </div>
                )}

                {sigMethod === "draw" && (
                  <button
                    type="button"
                    onClick={() => setIsDrawingModalOpen(true)}
                    className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-500/5 transition-all cursor-pointer group"
                  >
                    <Pencil className="w-7 h-7 text-slate-300 dark:text-slate-700 group-hover:text-purple-400 transition-colors mb-1.5" />
                    <span className="text-xs text-slate-400 group-hover:text-purple-500 transition-colors">
                      {lang === "en" ? "Click to open signature drawing pad" : "คลิกเพื่อเปิดหน้าจอวาดลายเซ็น"}
                    </span>
                  </button>
                )}

              </div>
            </div>
          </div>

          {/* Password Form */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <KeyRound className="w-5 h-5 text-purple-500" />
              {t("changePassword")}
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {passwordError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-100 dark:border-rose-950">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-100 dark:border-emerald-950 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  {t("currentPasswordLabel")}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {t("newPasswordLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {t("confirmNewPasswordLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex items-center gap-2 px-6 h-10 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-md shadow-purple-500/10 focus:ring-4 focus:ring-purple-500/20 transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  {savingPassword ? t("updatingPasswordBtn") : t("updatePasswordBtn")}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>

      {/* Drawing Signature Modal */}
      <AnimatePresence>
        {isDrawingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-6"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-indigo-500" />
                    {lang === "en" ? "Draw Your Signature" : "วาดลายเซ็นของคุณ"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {lang === "en" ? "Please sign inside the frame below. The line will follow your movement directly." : "กรุณาลากเส้นเพื่อเขียนชื่อในช่องด้านล่าง เส้นวาดจะตรงตามตำแหน่งการลากของคุณ"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawingModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative rounded-2xl border-2 border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden shadow-inner">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-80 cursor-crosshair touch-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("clearCanvas")}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDrawingModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={saveDrawnSignature}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    {t("applySig")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
      {/* Action Sheet for Avatar */}
      {avatarActionSheetOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden animate-slide-up sm:animate-fade-in border border-gray-150 dark:border-gray-800">
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 text-center">
              <span className="text-sm font-bold text-gray-950 dark:text-white">
                {lang === "en" ? "Manage Profile Image" : "จัดการรูปโปรไฟล์ของคุณ"}
              </span>
            </div>
            <div className="p-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  avatarInputRef.current?.click();
                  setAvatarActionSheetOpen(false);
                }}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-gray-955 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-850 text-center transition-colors"
              >
                {lang === "en" ? "🖼️ Choose from Gallery" : "🖼️ เลือกจากคลังรูปภาพ"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.capture = "environment";
                  input.onchange = async (e: any) => {
                    if (!e.target.files?.[0]) return;
                    try {
                      const file = e.target.files[0];
                      if (file.size > 10 * 1024 * 1024) {
                        showToast("error", lang === "en" ? "Image size must not exceed 10MB" : "ขนาดรูปภาพต้องไม่เกิน 10MB");
                        return;
                      }
                      const compressedBase64 = await compressImage(file, 400, 400);
                      setAvatarPreview(compressedBase64);
                      const res = await updateProfile({ image: compressedBase64 });
                      if (res.success) {
                        showToast("success", lang === "en" ? "Avatar saved successfully" : "บันทึกรูปโปรไฟล์สำเร็จ");
                        refetch();
                      } else {
                        throw new Error(res.error);
                      }
                    } catch (err: any) {
                      console.error("Failed to save avatar", err);
                      showToast("error", lang === "en" ? "Failed to save avatar" : "เกิดข้อผิดพลาดในการบันทึกรูปประจำตัว");
                    }
                    setAvatarActionSheetOpen(false);
                  };
                  input.click();
                }}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-gray-955 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-850 text-center transition-colors"
              >
                {lang === "en" ? "📷 Take Photo" : "📷 ถ่ายรูปด้วยกล้อง"}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setAvatarPreview("");
                      setAvatarActionSheetOpen(false);
                      const res = await updateProfile({ image: "" });
                      if (res.success) {
                        showToast("success", lang === "en" ? "Profile image removed successfully" : "ลบรูปโปรไฟล์สำเร็จ");
                        refetch();
                      } else {
                        throw new Error(res.error);
                      }
                    } catch (err: any) {
                      showToast("error", lang === "en" ? "Failed to remove avatar" : "เกิดข้อผิดพลาดในการลบรูปประจำตัว");
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-center transition-colors"
                >
                  {lang === "en" ? "🗑️ Remove Current Image" : "🗑️ ลบรูปภาพปัจจุบัน"}
                </button>
              )}
            </div>
            <div className="p-2 border-t border-gray-100 dark:border-gray-850">
              <button
                type="button"
                onClick={() => setAvatarActionSheetOpen(false)}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-850 text-center transition-colors"
              >
                {lang === "en" ? "Cancel" : "ยกเลิก"}
              </button>
            </div>
          </div>
        </div>
      )}
  );
}
