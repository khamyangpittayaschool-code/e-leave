"use client";

import { useState, useEffect } from "react";
import { signIn, signUp, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, Briefcase, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSystemSettings } from "@/app/actions/settings";
import { resolveEmailForLogin } from "@/app/actions/auth_actions";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("ครู");
  const [subjectGroup, setSubjectGroup] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const router = useRouter();

  // Dynamic branding from SystemSettings
  const [schoolName, setSchoolName] = useState("ระบบจัดการการลา");
  const [subheader, setSubheader] = useState("ระบบจัดการการลา");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [footerText, setFooterText] = useState("© 2006 Panchapon Getrat KP-school");
  const [isLoadingBrand, setIsLoadingBrand] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // 1. Immediately read from localStorage on client-side mount to prevent async DB fetch lag
    if (typeof window !== "undefined") {
      const storedSchoolName = localStorage.getItem("eleave_schoolName");
      const storedSubheader = localStorage.getItem("eleave_subheader");
      const storedLogoUrl = localStorage.getItem("eleave_logoUrl");
      const storedFooterText = localStorage.getItem("eleave_footerText");

      if (storedSchoolName) setSchoolName(storedSchoolName);
      if (storedSubheader) setSubheader(storedSubheader);
      if (storedLogoUrl) setLogoUrl(storedLogoUrl);
      if (storedFooterText) setFooterText(storedFooterText);
      
      // If we loaded cached data, we can mark brand loading as finished
      if (storedSchoolName || storedLogoUrl) {
        setIsLoadingBrand(false);
      }
    }

    getSystemSettings().then((s) => {
      const finalSchoolName = s.schoolName || (lang === "en" ? "Leave Management System" : "ระบบจัดการการลา");
      const finalSubheader = s.subheader || (lang === "en" ? "Leave Management System" : "ระบบจัดการการลา");
      const finalLogoUrl = s.logoUrl || null;
      const finalFooterText = s.footerText || "© 2006 Panchapon Getrat KP-school";

      setSchoolName(finalSchoolName);
      setSubheader(finalSubheader);
      setLogoUrl(finalLogoUrl);
      setFooterText(finalFooterText);
      setIsLoadingBrand(false);

      if (typeof window !== "undefined") {
        localStorage.setItem("eleave_schoolName", finalSchoolName);
        localStorage.setItem("eleave_subheader", finalSubheader);
        if (finalLogoUrl) {
          localStorage.setItem("eleave_logoUrl", finalLogoUrl);
        } else {
          localStorage.removeItem("eleave_logoUrl");
        }
        localStorage.setItem("eleave_footerText", finalFooterText);
      }

      // Show splash for at least 1.4s for a smooth feel
      setTimeout(() => setShowSplash(false), 1400);
    }).catch(() => {
      setIsLoadingBrand(false);
      setTimeout(() => setShowSplash(false), 600);
    });
  }, [lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Safety timeout: reset loading after 15s ป้องกัน stuck ทุกกรณี
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 15000);

    let finalEmail = email.trim();
    let usernameVal = "";
    if (!finalEmail.includes("@")) {
      usernameVal = finalEmail;
      finalEmail = `${finalEmail}@eleave.local`;
    } else {
      usernameVal = finalEmail.split("@")[0];
    }

    if (isRegister) {
      if (["ครู", "นักศึกษาฝึกประสบการณ์", "หัวหน้างานบุคคล"].includes(position) && !subjectGroup) {
        alert(t("requiredSubjectGroup"));
        clearTimeout(safetyTimer);
        setLoading(false);
        return;
      }

      await signUp.email({
        email: finalEmail,
        password,
        name,
        // @ts-ignore
        username: usernameVal,
        role: position === "แอดมิน" ? "ADMIN" : "TEACHER",
        position,
        subjectGroup: ["ครู", "นักศึกษาฝึกประสบการณ์", "หัวหน้างานบุคคล"].includes(position) ? subjectGroup : "",
        fetchOptions: {
          onSuccess: () => {
            clearTimeout(safetyTimer);
            alert(t("registerSuccess"));
            setIsRegister(false);
            setLoading(false);
            setPassword("");
          },
          onError: (ctx: any) => {
            clearTimeout(safetyTimer);
            alert(ctx.error.message);
            setLoading(false);
          },
        },
      });
    } else {
      try {
        const resolvedEmail = await resolveEmailForLogin(email);
        await signIn.email({
          email: resolvedEmail,
          password,
          fetchOptions: {
            onSuccess: () => {
              clearTimeout(safetyTimer);
              // ใช้ window.location เป็น hard fallback ถ้า router.push ช้า
              try {
                router.push("/dashboard");
                setTimeout(() => {
                  if (document.location.pathname !== "/dashboard") {
                    window.location.href = "/dashboard";
                  }
                }, 3000);
              } catch {
                window.location.href = "/dashboard";
              }
            },
            onError: (ctx: any) => {
              clearTimeout(safetyTimer);
              alert(ctx.error.message);
              setLoading(false);
            },
          },
        });
      } catch (err: any) {
        clearTimeout(safetyTimer);
        alert(err.message || (lang === "en" ? "An error occurred during login." : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"));
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resolvedEmail = await resolveEmailForLogin(resetEmail);
      await (authClient as any).forgetPassword({
        email: resolvedEmail,
        redirectTo: "/reset-password",
        fetchOptions: {
          onSuccess: () => {
            alert(lang === "en" ? "A reset password link has been sent to your email (if it exists)." : "ระบบได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว (หากมีในระบบ)");
            setIsForgotPassword(false);
          },
          onError: (ctx: any) => {
            alert(ctx.error.message || t("operationFailed"));
          }
        }
      });
    } catch (err) {
      alert(t("operationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "facebook" | "line") => {
    signIn.social({ provider, callbackURL: "/dashboard" }).catch((e) => {
      console.error(e);
      alert(lang === "en" ? "Social login is not configured yet." : "ระบบล็อกอินด้วยโซเชียลยังไม่ถูกตั้งค่า API Keys ใน Better Auth ครับ");
    });
  };

  return (
    <>
      {/* Brand Splash Screen – shown before login form */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-purple-400/15 dark:bg-purple-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/15 dark:bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '0.8s' }} />

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative z-10 flex flex-col items-center text-center space-y-5 px-8"
            >
              {/* Logo with pulse ring */}
              <div className="relative flex items-center justify-center mb-1">
                <div className="absolute inset-0 rounded-full bg-purple-400/25 dark:bg-purple-500/15 animate-ping opacity-60" style={{ animationDuration: '1.8s' }} />
                <div className="absolute -inset-5 rounded-full bg-gradient-to-tr from-purple-400/10 to-indigo-400/10 blur-xl animate-pulse" />

                <div className="relative w-28 h-28 rounded-[28px] bg-white dark:bg-slate-800 p-2 shadow-[0_12px_40px_rgba(109,40,217,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-slate-100/80 dark:border-slate-700/50 flex items-center justify-center overflow-hidden">
                  <motion.img
                    initial={{ scale: 0.75, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
                    src={logoUrl || "/icon.jpg"}
                    alt="School Logo"
                    className="w-full h-full object-cover rounded-[20px]"
                  />
                </div>
              </div>

              {/* School name */}
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-xl font-bold text-slate-900 dark:text-white leading-snug max-w-[280px]"
              >
                {isLoadingBrand ? "กำลังโหลด..." : (schoolName || "โรงเรียน")}
              </motion.h1>

              {/* Subheader */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-xs font-semibold tracking-[0.12em] text-purple-600 dark:text-purple-400 uppercase"
              >
                {isLoadingBrand ? "" : (subheader || "ระบบจัดการการลาออนไลน์")}
              </motion.p>

              {/* Progress bar */}
              <div className="w-44 pt-3 mx-auto">
                <div className="h-[3px] w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-600 rounded-full absolute top-0 bottom-0"
                    animate={{
                      left: ["-100%", "100%"],
                      width: ["25%", "65%", "25%"]
                    }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] dark:bg-slate-900 relative overflow-hidden p-4">
      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={() => setLang(lang === "th" ? "en" : "th")}
          className="flex items-center justify-center px-4 py-2 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 font-bold text-xs shadow-sm cursor-pointer"
        >
          {lang === "th" ? "TH / EN" : "EN / TH"}
        </button>
      </div>

      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/40 dark:bg-purple-800/20 blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/40 dark:bg-indigo-800/20 blur-[80px]" />
      </div>

      <div className="w-full max-w-[420px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] p-8 relative z-10 border border-white/60 dark:border-slate-800">

        {/* Branding Header */}
        <div className="flex flex-col items-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover shadow-lg mb-4" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-4">
              <Lock className="w-9 h-9 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center">{schoolName}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">{subheader}</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${!isRegister ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
          >
            {t("loginButton")}
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isRegister ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
          >
            {t("registerButton")}
          </button>
        </div>

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("forgotPasswordTitle")}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("forgotPasswordSubtitle")}</p>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-[20px] w-[20px] text-slate-400" />
              </div>
              <input
                type="text"
                required
                className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                placeholder={t("usernameOrEmailPlaceholder")}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[50px] rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[15px] font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all duration-200 mt-2"
            >
              {loading ? t("sendingLink") : t("resetPasswordButton")}
            </button>
            <div className="flex justify-center pt-2">
              <button type="button" onClick={() => setIsForgotPassword(false)} className="text-[13px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                {t("backToLogin")}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-[20px] w-[20px] text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                    placeholder={t("name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Briefcase className="h-[20px] w-[20px] text-slate-400" />
                  </div>
                  <select
                    required
                    className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all appearance-none"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  >
                    <option value="" disabled>{t("selectPositionPlaceholder")}</option>
                    <option value="ครู">{lang === "en" ? "Teacher" : "ครู"}</option>
                    <option value="นักศึกษาฝึกประสบการณ์">{lang === "en" ? "Trainee" : "นักศึกษาฝึกประสบการณ์"}</option>
                    <option value="หัวหน้างานบุคคล">{lang === "en" ? "Head of HR" : "หัวหน้างานบุคคล"}</option>
                    <option value="เจ้าหน้าที่บุคคล">{lang === "en" ? "HR Staff" : "เจ้าหน้าที่บุคคล"}</option>
                    <option value="ผู้ตรวจสอบ">{lang === "en" ? "Inspector" : "ผู้ตรวจสอบ"}</option>
                    <option value="รองผู้อำนวยการ">{lang === "en" ? "Deputy Director" : "รองผู้อำนวยการ"}</option>
                    <option value="ผู้อำนวยการ">{lang === "en" ? "Director" : "ผู้อำนวยการ"}</option>
                    <option value="แอดมิน">{lang === "en" ? "Admin" : "แอดมิน"}</option>
                  </select>
                </div>

                {["ครู", "นักศึกษาฝึกประสบการณ์", "หัวหน้างานบุคคล", "เจ้าหน้าที่บุคคล", "ผู้ตรวจสอบ", "รองผู้อำนวยการ"].includes(position) && (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <BookOpen className="h-[20px] w-[20px] text-slate-400" />
                    </div>
                    <select
                      required
                      className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all appearance-none"
                      value={subjectGroup}
                      onChange={(e) => setSubjectGroup(e.target.value)}
                    >
                      <option value="" disabled>{t("selectSubjectGroupPlaceholder")}</option>
                      <option value="คณิตศาสตร์">{lang === "en" ? "Mathematics" : "กลุ่มสาระการเรียนรู้คณิตศาสตร์"}</option>
                      <option value="วิทยาศาสตร์และเทคโนโลยี">{lang === "en" ? "Science & Tech" : "กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี"}</option>
                      <option value="ภาษาไทย">{lang === "en" ? "Thai Language" : "กลุ่มสาระการเรียนรู้ภาษาไทย"}</option>
                      <option value="ภาษาต่างประเทศ">{lang === "en" ? "Foreign Languages" : "กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ"}</option>
                      <option value="สังคมศึกษา ศาสนาและวัฒนธรรม">{lang === "en" ? "Social Studies" : "กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนาและวัฒนธรรม"}</option>
                      <option value="สุขศึกษา พลศึกษา">{lang === "en" ? "Health & PE" : "กลุ่มสาระการเรียนรู้สุขศึกษา พลศึกษา"}</option>
                      <option value="ศิลปศึกษา">{lang === "en" ? "Arts" : "กลุ่มสาระการเรียนรู้ศิลปศึกษา"}</option>
                      <option value="การงานอาชีพ">{lang === "en" ? "Occupations & Tech" : "กลุ่มสาระการเรียนรู้การงานอาชีพ"}</option>
                      <option value="กิจกรรมพัฒนาผู้เรียน">{lang === "en" ? "Student Development" : "กิจกรรมพัฒนาผู้เรียน"}</option>
                      <option value="งานแนะแนว">{lang === "en" ? "Guidance" : "งานแนะแนว"}</option>
                      <option value="นักพัฒนาโรงเรียนและบุคลากรอื่นๆ">{lang === "en" ? "School Dev & Others" : "นักพัฒนาโรงเรียนและบุคลากรอื่นๆ"}</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-[20px] w-[20px] text-slate-400" />
              </div>
              <input
                type="text"
                required
                className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                placeholder={t("usernameOrEmailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-[20px] w-[20px] text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full h-[50px] pl-[44px] pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {!isRegister && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-[13px] font-medium text-purple-500 hover:text-purple-700 dark:hover:text-purple-400 transition-colors"
                >
                  {t("forgotPasswordLink")}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[50px] rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[15px] font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all duration-200 mt-2"
            >
              {loading ? (isRegister ? t("registering") : t("signingIn")) : (isRegister ? t("registerButton") : t("loginButton"))}
            </button>
          </form>
        )}

        {!isRegister && !isForgotPassword && (
          <>
            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-[13px]">
                <span className="bg-white/80 dark:bg-slate-900/80 px-4 text-slate-400">{t("orLoginWith")}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialLogin("google")}
                className="flex items-center justify-center gap-2 h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                <span className="text-[14px] font-medium text-slate-600 dark:text-slate-300">Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin("facebook")}
                className="flex items-center justify-center gap-2 h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" /></svg>
                <span className="text-[14px] font-medium text-slate-600 dark:text-slate-300">Facebook</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin("line")}
                className="flex items-center justify-center gap-2 h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 10.304c0-5.369-5.383-9.738-12-9.738S0 4.935 0 10.304c0 4.814 4.27 8.846 10.035 9.608.391.084.922.258 1.057.592.122.302.079.768.038 1.084l-.168 1.02c-.053.303-.243 1.183 1.037.643 1.28-.54 6.91-4.069 9.428-6.967C23.11 14.364 24 12.435 24 10.304z" fill="#00C300" /><path d="M7.443 11.968H5.617a.386.386 0 01-.387-.387V7.124c0-.213.174-.387.387-.387h.464c.213 0 .386.174.386.387v3.993h.976c.213 0 .386.173.386.386v.465c0 .213-.173.387-.386.387zm3.178 0h-.465a.387.387 0 01-.386-.387V7.124c0-.213.173-.387.386-.387h.465c.214 0 .387.174.387.387v4.457c0 .213-.174.387-.387.387zm6.002 0h-1.826a.388.388 0 01-.387-.387V7.124c0-.213.173-.387.387-.387h.464c.213 0 .386.174.386.387v3.993h.976c.214 0 .386.173.386.386v.465c0 .213-.172.387-.386.387zm-2.855-3.03l-1.39-1.745c-.068-.086-.168-.13-.267-.13a.362.362 0 00-.13.023.385.385 0 00-.256.365v4.093c0 .213.173.387.386.387h.465a.387.387 0 00.386-.387V9.757l1.39 1.745c.068.085.168.129.267.129a.363.363 0 00.13-.024.386.386 0 00.256-.364V7.124a.386.386 0 00-.386-.387h-.465a.386.386 0 00-.386.387v2.361z" fill="#fff" /></svg>
                <span className="text-[14px] font-medium text-slate-600 dark:text-slate-300">LINE</span>
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            {footerText}
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
