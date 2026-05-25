"use client";

import { useState, useEffect } from "react";
import { signIn, signUp, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, Briefcase, BookOpen } from "lucide-react";
import { getSystemSettings } from "@/app/actions/settings";

export default function LoginPage() {
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

  useEffect(() => {
    getSystemSettings().then((s) => {
      setSchoolName(s.schoolName || "ระบบจัดการการลา");
      setSubheader(s.subheader || "ระบบจัดการการลา");
      setLogoUrl(s.logoUrl || null);
      setFooterText(s.footerText || "© 2006 Panchapon Getrat KP-school");
    }).catch(() => { });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let finalEmail = email.trim();
    if (!finalEmail.includes("@")) {
      finalEmail = `${finalEmail}@eleave.local`;
    }

    if (isRegister) {
      if (["ครู", "หัวหน้างานบุคคล"].includes(position) && !subjectGroup) {
        alert("กรุณาเลือกกลุ่มสาระการเรียนรู้");
        setLoading(false);
        return;
      }

      await signUp.email({
        email: finalEmail,
        password,
        name,
        // @ts-ignore
        role: position === "แอดมิน" ? "ADMIN" : "TEACHER",
        position,
        subjectGroup: ["ครู", "หัวหน้างานบุคคล"].includes(position) ? subjectGroup : "",
        fetchOptions: {
          onSuccess: () => {
            alert("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
            setIsRegister(false);
            setLoading(false);
            setPassword("");
          },
          onError: (ctx: any) => {
            alert(ctx.error.message);
            setLoading(false);
          },
        },
      });
    } else {
      await signIn.email({
        email: finalEmail,
        password,
        fetchOptions: {
          onSuccess: () => {
            router.push("/dashboard");
          },
          onError: (ctx: any) => {
            alert(ctx.error.message);
            setLoading(false);
          },
        },
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalResetEmail = resetEmail.trim();
      if (!finalResetEmail.includes("@")) {
        finalResetEmail = `${finalResetEmail}@eleave.local`;
      }
      await (authClient as any).forgetPassword({
        email: finalResetEmail,
        redirectTo: "/reset-password",
        fetchOptions: {
          onSuccess: () => {
            alert("ระบบได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว (หากมีในระบบ)");
            setIsForgotPassword(false);
          },
          onError: (ctx: any) => {
            alert(ctx.error.message || "เกิดข้อผิดพลาด");
          }
        }
      });
    } catch (err) {
      alert("ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "facebook" | "line") => {
    signIn.social({ provider, callbackURL: "/dashboard" }).catch((e) => {
      console.error(e);
      alert("ระบบล็อกอินด้วยโซเชียลยังไม่ถูกตั้งค่า API Keys ใน Better Auth ครับ");
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] dark:bg-slate-900 relative overflow-hidden p-4">
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
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isRegister ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
          >
            สมัครสมาชิก
          </button>
        </div>

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">ลืมรหัสผ่าน?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-[20px] w-[20px] text-slate-400" />
              </div>
              <input
                type="text"
                required
                className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                placeholder="ชื่อผู้ใช้ หรือ อีเมล"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[50px] rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[15px] font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all duration-200 mt-2"
            >
              {loading ? "กำลังส่งลิงก์..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>
            <div className="flex justify-center pt-2">
              <button type="button" onClick={() => setIsForgotPassword(false)} className="text-[13px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                กลับไปหน้าเข้าสู่ระบบ
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
                    placeholder="ชื่อ - นามสกุล"
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
                    <option value="" disabled>เลือกตำแหน่ง</option>
                    <option value="ครู">ครู (Teacher)</option>
                    <option value="หัวหน้างานบุคคล">หัวหน้างานบุคคล (HR Head)</option>
                    <option value="ผู้บริหาร">ผู้บริหาร (Executive)</option>
                    <option value="แอดมิน">แอดมิน (Admin)</option>
                  </select>
                </div>

                {["ครู", "หัวหน้างานบุคคล"].includes(position) && (
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
                      <option value="" disabled>เลือกกลุ่มสาระการเรียนรู้</option>
                      <option value="คณิตศาสตร์">การเรียนรู้คณิตศาสตร์</option>
                      <option value="วิทยาศาสตร์และเทคโนโลยี">การเรียนรู้วิทยาศาสตร์และเทคโนโลยี</option>
                      <option value="ภาษาไทย">การเรียนรู้ภาษาไทย</option>
                      <option value="ภาษาต่างประเทศ">การเรียนรู้ภาษาต่างประเทศ</option>
                      <option value="สังคมศึกษา ศาสนาและวัฒนธรรม">การเรียนรู้สังคมศึกษา ศาสนาและวัฒนธรรม</option>
                      <option value="สุขศึกษา พลศึกษา">การเรียนรู้สุขศึกษา พลศึกษา</option>
                      <option value="ศิลปศึกษา">การเรียนรู้ศิลปศึกษา</option>
                      <option value="การงานอาชีพ">การเรียนรู้การงานอาชีพ</option>
                      <option value="กิจกรรมพัฒนาผู้เรียน">กิจกรรมพัฒนาผู้เรียน</option>
                      <option value="งานแนะแนว">งานแนะแนว</option>
                      <option value="นักพัฒนาโรงเรียนและบุคลากรอื่นๆ">นักพัฒนาโรงเรียนและบุคลากรอื่นๆ</option>
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
                placeholder="ชื่อผู้ใช้ หรือ อีเมล"
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
                placeholder="รหัสผ่าน"
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
                  ลืมรหัสผ่าน?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[50px] rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[15px] font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all duration-200 mt-2"
            >
              {loading ? (isRegister ? "กำลังลงทะเบียน..." : "กำลังเข้าสู่ระบบ...") : (isRegister ? "สมัครสมาชิก" : "เข้าสู่ระบบ")}
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
                <span className="bg-white/80 dark:bg-slate-900/80 px-4 text-slate-400">หรือเข้าสู่ระบบด้วย</span>
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
  );
}
