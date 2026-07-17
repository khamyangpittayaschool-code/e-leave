"use client";

import Link from "next/link";
import { ToastProvider, useToast } from "@/components/toast-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  CheckSquare, 
  Settings, 
  UserCircle, 
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Maximize,
  Minimize,
  FileSpreadsheet,
  Users,
  Activity,
  Archive,
  Bell,
  BookOpen,
  Plus,
  Clock,
  ClipboardList
} from "lucide-react";

function ToolbarButtons({ isAdmin, isApprover }: { isAdmin: boolean; isApprover: boolean }) {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [counts, setCounts] = useState({ users: 0, leaves: 0 });
  const notiRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchNotifications = useCallback(() => {
    if (isAdmin || isApprover) {
      import("@/app/actions/admin").then(({ getNotifications }) => {
        getNotifications().then((data) => {
          setNotifications(data.items);
          setCounts(data.counts);
        }).catch(() => {});
      });
    }
  }, [isAdmin, isApprover]);
  
  // Refresh on mount + on route change + on window focus + on custom event (no polling)
  useEffect(() => {
    fetchNotifications();
    const onRefresh = () => fetchNotifications();
    const onFocus = () => fetchNotifications();
    window.addEventListener("noti-refresh", onRefresh);
    window.addEventListener("focus", onFocus);
    return () => { 
      window.removeEventListener("noti-refresh", onRefresh); 
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifications]);

  // Refresh whenever the user navigates to a different page
  useEffect(() => {
    fetchNotifications();
  }, [pathname, fetchNotifications]);

  // Close panel when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const totalCount = counts.users + counts.leaves;

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("momentAgo");
    if (mins < 60) return `${mins} ${t("minutesAgo")}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ${t("hoursAgo")}`;
    const days = Math.floor(hrs / 24);
    return `${days} ${t("daysAgo")}`;
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLang(lang === "th" ? "en" : "th")}
        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-all duration-300 font-bold text-sm"
        title={lang === "th" ? "เปลี่ยนเป็นภาษาอังกฤษ" : "Switch to Thai"}
      >
        {lang === "th" ? "TH" : "EN"}
      </button>

      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-all duration-300"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <button
        onClick={toggleFullscreen}
        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-all duration-300"
      >
        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
      </button>

      {/* Notification Bell + Panel */}
      {(isAdmin || isApprover) && (
        <div className="relative" ref={notiRef}>
          <button
            onClick={() => { setNotiOpen(!notiOpen); if (!notiOpen) fetchNotifications(); }}
            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-purple-600 transition-all duration-300"
          >
            <Bell className="w-5 h-5" />
            {totalCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-[#F4F7FB] dark:ring-slate-900"
              >
                {totalCount > 99 ? "99+" : totalCount}
              </motion.span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          <AnimatePresence>
            {notiOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-0 top-14 w-[380px] max-h-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-[100] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t("notifications")}
                    </h3>
                    {totalCount > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {totalCount} {t("itemsPending")}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setNotiOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Action Buttons */}
                {(counts.users > 0 || counts.leaves > 0) && (
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
                    {counts.leaves > 0 && (
                      <Link
                        href="/approvals"
                        onClick={() => setNotiOpen(false)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                      >
                        <CheckSquare className="w-4 h-4" />
                        {t("approveLeave")} ({counts.leaves})
                      </Link>
                    )}
                    {counts.users > 0 && isAdmin && (
                      <Link
                        href="/users"
                        onClick={() => setNotiOpen(false)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                      >
                        <Users className="w-4 h-4" />
                        {t("approveUsers")} ({counts.users})
                      </Link>
                    )}
                  </div>
                )}

                {/* Notification Items List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Bell className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm font-medium">{t("noNotifications")}</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {notifications.map((noti, i) => (
                        <Link
                          key={noti.id}
                          href={noti.href}
                          onClick={() => setNotiOpen(false)}
                          className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                        >
                          <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5 ${
                            noti.type === "user" 
                              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                              : "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"
                          }`}>
                            {noti.type === "user" ? <Users className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{noti.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{noti.desc}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{timeAgo(noti.time)}</p>
                          </div>
                          <div className={`shrink-0 w-2 h-2 rounded-full mt-2 ${
                            noti.type === "user" ? "bg-emerald-500" : "bg-purple-500"
                          }`} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <Link
                      href={counts.leaves > 0 ? "/approvals" : "/users"}
                      onClick={() => setNotiOpen(false)}
                      className="block w-full text-center text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                    >
                      {t("viewAll")} →
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function getUserRoleKey(user: any, isFinalApprover: boolean = false) {
  if (user?.role === "ADMIN" || user?.position === "แอดมิน") return "ADMIN";
  if (user?.position === "ผู้อำนวยการ" || isFinalApprover) return "DIRECTOR";
  if (user?.position === "หัวหน้างานบุคคล") return "HR";
  if (user?.position === "เจ้าหน้าที่บุคคล") return "HR_STAFF";
  if (user?.position === "ผู้ตรวจสอบ") return "INSPECTOR";
  if (user?.position === "หัวหน้าหมวด" || user?.position === "หัวหน้ากลุ่มสาระ") return "DEPT_HEAD";
  return "TEACHER";
}

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  calendar: ["ADMIN", "DIRECTOR", "HR", "HR_STAFF", "INSPECTOR", "DEPT_HEAD", "TEACHER"],
  reports: ["ADMIN", "DIRECTOR", "HR", "HR_STAFF", "INSPECTOR", "DEPT_HEAD"],
  approvals: ["ADMIN", "DIRECTOR", "HR", "INSPECTOR", "DEPT_HEAD"],
  logs: ["ADMIN"],
  backups: ["ADMIN"],
  users: ["ADMIN", "HR"],
  settings: ["ADMIN"],
  manual_import: ["ADMIN", "HR", "HR_STAFF"]
};

function AppContent({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { t, lang } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [brandName, setBrandName] = useState("ระบบการลา");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [isFinalApprover, setIsFinalApprover] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<any>(null);
  const [pendingDocsCount, setPendingDocsCount] = useState(0);
  const [enableAttendance, setEnableAttendance] = useState(false);
  const [enableDocument, setEnableDocument] = useState(false);
  const [brandSubheader, setBrandSubheader] = useState("ระบบจัดการการลา");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      import("@/app/actions/incoming").then(({ getMyPendingRoutingCount }) => {
        getMyPendingRoutingCount().then(setPendingDocsCount).catch(() => {});
      });
    }
  }, [session?.user?.id, pathname]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    // 1. Immediately read from localStorage on client-side mount to prevent async DB fetch lag
    if (typeof window !== "undefined") {
      const storedSchoolName = localStorage.getItem("eleave_schoolName");
      const storedSubheader = localStorage.getItem("eleave_subheader");
      const storedLogoUrl = localStorage.getItem("eleave_logoUrl");
      const storedEnableAttendance = localStorage.getItem("eleave_enableAttendance");
      const storedEnableDocument = localStorage.getItem("eleave_enableDocument");

      if (storedSchoolName) setBrandName(storedSchoolName);
      if (storedSubheader) setBrandSubheader(storedSubheader);
      if (storedLogoUrl) setBrandLogo(storedLogoUrl);
      if (storedEnableAttendance) setEnableAttendance(storedEnableAttendance === "true");
      if (storedEnableDocument) setEnableDocument(storedEnableDocument === "true");
      
      // If we loaded cached data, we can mark settings loading as finished to bypass default splash page
      if (storedSchoolName || storedLogoUrl) {
        setIsLoadingSettings(false);
      }
    }

    import("@/app/actions/settings").then(({ getSystemSettings }) => {
      getSystemSettings().then((s) => {
        const finalSchoolName = s.schoolName || t("loginTitle");
        const finalSubheader = s.subheader || "ระบบจัดการการลา";
        const finalLogoUrl = s.logoUrl || null;
        const finalEnableAttendance = s.enableAttendance === true;
        const finalEnableDocument = s.enableDocument === true;

        setBrandName(finalSchoolName);
        setBrandLogo(finalLogoUrl);
        setBrandSubheader(finalSubheader);
        setEnableAttendance(finalEnableAttendance);
        setEnableDocument(finalEnableDocument);
        
        if (s.finalApproverUserIds && session?.user?.id) {
          const allowedIds = s.finalApproverUserIds.split(",").map((id: string) => id.trim()).filter(Boolean);
          setIsFinalApprover(allowedIds.includes(session.user.id));
        }
        if (s.rolePermissions) {
          try {
            setRolePermissions(JSON.parse(s.rolePermissions));
          } catch (e) {
            console.error("Failed to parse rolePermissions", e);
          }
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("eleave_schoolName", finalSchoolName);
          localStorage.setItem("eleave_subheader", finalSubheader);
          if (finalLogoUrl) {
            localStorage.setItem("eleave_logoUrl", finalLogoUrl);
          } else {
            localStorage.removeItem("eleave_logoUrl");
          }
          localStorage.setItem("eleave_enableAttendance", String(finalEnableAttendance));
          localStorage.setItem("eleave_enableDocument", String(finalEnableDocument));
        }

        setIsLoadingSettings(false);
      }).catch(() => {
        setIsLoadingSettings(false);
      });
    });
  }, [session?.user?.id, t]);

  if (isPending || isLoadingSettings) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 p-6 overflow-hidden">
        {/* Decorative background lights */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-400/10 dark:bg-purple-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-400/10 dark:bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center max-w-sm w-full text-center space-y-6"
        >
          {/* Logo container with pulse rings */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-purple-500/20 dark:bg-purple-400/10 animate-ping opacity-75" />
            <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-purple-500/10 to-indigo-500/10 blur-md animate-pulse" />
            
            <div className="relative w-24 h-24 rounded-3xl bg-white dark:bg-slate-800 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-slate-100 dark:border-slate-700/50 flex items-center justify-center overflow-hidden">
              {brandLogo ? (
                <motion.img 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.5, type: "spring" }}
                  src={brandLogo} 
                  alt="School Logo" 
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Texts */}
          <div className="space-y-2">
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-lg font-bold text-gray-900 dark:text-white leading-snug px-4 line-clamp-2"
            >
              {brandName || "โรงเรียนของเรา"}
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xs font-semibold tracking-wider text-purple-600 dark:text-purple-400 uppercase"
            >
              {brandSubheader || "ระบบจัดการการลาออนไลน์"}
            </motion.p>
          </div>

          {/* Load indicator */}
          <div className="w-40 pt-4 mx-auto">
            <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full absolute top-0 bottom-0"
                animate={{ 
                  left: ["-100%", "100%"],
                  width: ["30%", "60%", "30%"]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isApprover = isAdmin || user.position === "ผู้อำนวยการ" || user.position === "หัวหน้างานบุคคล" || isFinalApprover;

  if (!isAdmin && !user.isApproved) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-[#F4F7FB] dark:bg-slate-900 p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t("pendingAccountTitle")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("pendingAccountDesc")}
            </p>
          </div>
          <button 
            onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/login") }})}
            className="w-full px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {t("logout")}
          </button>
        </div>
      </div>
    );
  }

  const userRole = getUserRoleKey(user, isFinalApprover);
  const activePermissions = rolePermissions || DEFAULT_PERMISSIONS;

  const showDocument = enableDocument || isAdmin;
  const generalNavItems = [];
  if (showDocument) {
    generalNavItems.push({ href: "/document", label: lang === "en" ? "Documents" : "ระบบเอกสาร", icon: ClipboardList, badge: pendingDocsCount });
  }

  const showAttendance = enableAttendance || isAdmin;
  const hrNavItems = [];
  if (showAttendance) {
    hrNavItems.push({ href: "/attendance", label: lang === "en" ? "Attendance" : "ลงเวลา", icon: Clock });
  }

  const leaveNavItems = [
    { href: "/request", label: t("requestLeave"), icon: FileText },
    { href: "/history", label: t("history"), icon: History },
  ];
  if (activePermissions.approvals?.includes(userRole)) {
    leaveNavItems.push({ href: "/approvals", label: t("approvals"), icon: CheckSquare });
  }
  if (activePermissions.reports?.includes(userRole)) {
    leaveNavItems.push({ href: "/reports", label: t("reports"), icon: FileSpreadsheet });
  }
  leaveNavItems.push({ href: "/manual", label: t("userManual"), icon: BookOpen });

  const settingsNavItems = [];
  if (activePermissions.settings?.includes(userRole)) {
    settingsNavItems.push({ href: "/settings", label: t("settings"), icon: Settings });
  } else if (activePermissions.manual_import?.includes(userRole)) {
    settingsNavItems.push({ href: "/settings?section=manual-import", label: lang === "en" ? "Manual Leave Entry" : "กรอกข้อมูลใบลาเอง", icon: Plus });
  }
  if (activePermissions.users?.includes(userRole)) {
    settingsNavItems.push({ href: "/users", label: t("users"), icon: Users });
  }
  if (activePermissions.logs?.includes(userRole)) {
    settingsNavItems.push({ href: "/logs", label: t("logs"), icon: Activity });
  }

  const mobileNavItems = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/request", label: t("requestLeave"), icon: FileText },
    { href: "/history", label: t("history"), icon: History },
  ];
  if (showAttendance) {
    mobileNavItems.push({ href: "/attendance", label: lang === "en" ? "Attendance" : "ลงเวลา", icon: Clock });
  }
  if (showDocument) {
    mobileNavItems.push({ href: "/document", label: lang === "en" ? "Documents" : "เอกสาร", icon: ClipboardList });
  }

  const renderNavItem = (item: any) => {
    const isActive = pathname === item.href || (item.href.startsWith("/settings") && pathname.startsWith("/settings") && searchParams?.get("section") === "manual-import");
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href}>
        <div className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-[14.5px] font-medium transition-all duration-300 group overflow-hidden ${
          isActive 
            ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10" 
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }`}>
          {isActive && (
            <motion.div layoutId="activeNav" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-purple-500 rounded-r-full" />
          )}
          <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  const checkPermission = (path: string): boolean => {
    const key = getUserRoleKey(user, isFinalApprover);
    const activePerms = rolePermissions || DEFAULT_PERMISSIONS;
    if (path.startsWith("/attendance") && !enableAttendance && !isAdmin) return false;
    if (path.startsWith("/document") && !enableDocument && !isAdmin) return false;
    if (path.startsWith("/reports") && !activePerms.reports?.includes(key)) return false;
    if (path.startsWith("/approvals") && !activePerms.approvals?.includes(key)) return false;
    if (path.startsWith("/logs") && !activePerms.logs?.includes(key)) return false;
    if (path.startsWith("/users") && !activePerms.users?.includes(key)) return false;
    if (path.startsWith("/settings")) {
      const section = searchParams?.get("section");
      if (section === "manual-import" && activePerms.manual_import?.includes(key)) {
        return true;
      }
      if (!activePerms.settings?.includes(key)) return false;
    }
    return true;
  };

  const hasAccess = checkPermission(pathname);

  const isImpersonating = user.isActualAdmin === true && (user.role !== "ADMIN" && user.position !== "แอดมิน");

  const handleClearImpersonation = async () => {
    try {
      const { clearImpersonation } = await import("@/app/actions/settings");
      await clearImpersonation();
      window.location.reload();
    } catch (error: any) {
      showToast("error", "เกิดข้อผิดพลาด: " + (error?.message || error));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white font-sans selection:bg-purple-500/30">
      {isImpersonating && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 flex items-center justify-between text-xs sm:text-sm font-bold shadow-md shrink-0 print:hidden z-[9999]">
          <div className="flex items-center gap-2">
            <span className="animate-pulse flex h-2.5 w-2.5 rounded-full bg-white shrink-0" />
            <span>
              ขณะนี้คุณกำลังจำลองมุมมองสิทธิ์เป็น: <span className="underline decoration-wavy decoration-2 decoration-white/70">{user.position || "ครู (สิทธิ์ทั่วไป)"}</span> (บทบาท: {user.role})
            </span>
          </div>
          <button 
            type="button"
            onClick={handleClearImpersonation}
            className="ml-4 px-3.5 py-1.5 bg-white text-orange-600 hover:bg-orange-50 font-bold rounded-xl shadow transition-colors shrink-0"
          >
            กลับเป็นแอดมิน
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        
        {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`fixed top-0 bottom-0 left-0 z-50 w-[280px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[4px_0_24px_rgba(0,0,0,0.02)] print:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        
        {/* Brand */}
        <div className="h-24 px-8 flex items-center">
          <div className="flex items-center gap-3 min-w-0">
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" className="w-10 h-10 rounded-2xl object-cover shadow-lg" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 leading-tight">{brandName}</h1>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {/* Dashboard (Top level) */}
          <Link href="/dashboard">
            <div className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-[14.5px] font-medium transition-all duration-300 group overflow-hidden ${
              pathname === "/dashboard" 
                ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10" 
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
            }`}>
              {pathname === "/dashboard" && (
                <motion.div layoutId="activeNav" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-purple-500 rounded-r-full" />
              )}
              <LayoutDashboard className={`w-5 h-5 transition-transform duration-300 ${pathname === "/dashboard" ? "scale-110" : "group-hover:scale-110"}`} />
              <span className="flex-1">{t("dashboard")}</span>
            </div>
          </Link>

          {/* Category: งานทั่วไป */}
          {generalNavItems.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="px-4 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === "en" ? "General" : "งานทั่วไป"}
              </div>
              {generalNavItems.map(renderNavItem)}
            </div>
          )}

          {/* Category: งานบุคคล */}
          {hrNavItems.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="px-4 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === "en" ? "HR System" : "งานบุคคล"}
              </div>
              {hrNavItems.map(renderNavItem)}
            </div>
          )}

          {/* Category: ลาออนไลน์ */}
          <div className="pt-2 space-y-1.5">
            <div className="px-4 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {lang === "en" ? "Online Leave" : "ลาออนไลน์"}
            </div>
            {leaveNavItems.map(renderNavItem)}
          </div>

          {/* Category: ตั้งค่า */}
          {settingsNavItems.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="px-4 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {lang === "en" ? "Settings" : "ตั้งค่า"}
              </div>
              {settingsNavItems.map(renderNavItem)}
            </div>
          )}

          <div className="px-4 pt-6 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t("accountMenu")}</div>
          <Link href="/profile">
            <div className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl text-[14.5px] font-medium transition-all duration-300 group overflow-hidden ${
              pathname === "/profile" 
                ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10" 
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50"
            }`}>
              {pathname === "/profile" && (
                <motion.div layoutId="activeNav" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-purple-500 rounded-r-full" />
              )}
              <UserCircle className={`w-5 h-5 transition-transform duration-300 ${pathname === "/profile" ? "scale-110" : "group-hover:scale-110"}`} />
              {t("profile")}
            </div>
          </Link>
        </nav>

        {/* User Footer Component */}
        <div className="p-4 mx-4 mb-6 mt-auto">
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              {user.image ? (
                <img src={user.image} alt={user.name} className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-sm">
                  {user.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.position || t("staff")}</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t("logout")}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen lg:pl-[280px]">
        
        {/* Top Header */}
        <header className="h-24 px-6 lg:px-10 flex items-center justify-between z-30 print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:block">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {t("welcomeBack")}, {user.name.split(" ")[0]} 
                <motion.span 
                  animate={{ rotate: [0, 14, -8, 14, -4, 10, 0, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                  className="text-2xl origin-[70%_70%] inline-block"
                >
                  👋
                </motion.span>
              </h2>
            </div>
          </div>
          
          <ToolbarButtons isAdmin={isAdmin} isApprover={isApprover} />
        </header>

        {/* Page Content */}
        <div className="flex-1 px-6 lg:px-10 pb-24 lg:pb-12 w-full max-w-[1600px] mx-auto">
          {hasAccess ? children : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-lg mx-auto mt-12">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">ไม่มีสิทธิ์เข้าถึงหน้านี้ (Access Denied)</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed max-w-xs">
                บัญชีผู้ใช้ของคุณไม่ได้รับอนุญาตให้เข้าถึงเนื้อหาในส่วนนี้ หากเป็นข้อผิดพลาด กรุณาติดต่อแอดมินหรือหัวหน้างานบุคคล
              </p>
              <Link href="/dashboard" className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95">
                กลับสู่แดชบอร์ด
              </Link>
            </div>
          )}
        </div>
      </main>

      </div>

      {/* Mobile Bottom Navbar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-2 py-1.5 flex justify-around items-center lg:hidden print:hidden">
        {mobileNavItems.slice(0, 4).map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center py-1 group transition-all">
              <div className={`flex flex-col items-center gap-1 ${isActive ? "text-purple-600 dark:text-purple-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110 stroke-[2.5]" : "group-hover:scale-110"}`} />
                <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
              </div>
            </Link>
          );
        })}
        {/* Profile Item (always 5th or 4th item) */}
        <Link href="/profile" className="flex-1 flex flex-col items-center justify-center py-1 group transition-all">
          <div className={`flex flex-col items-center gap-1 ${pathname === "/profile" ? "text-purple-600 dark:text-purple-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>
            <UserCircle className={`w-5 h-5 transition-transform duration-200 ${pathname === "/profile" ? "scale-110 stroke-[2.5]" : "group-hover:scale-110"}`} />
            <span className="text-[10px] font-semibold tracking-tight">{t("profile")}</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] dark:bg-slate-900">
          <div className="w-10 h-10 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      }>
        <AppContent>{children}</AppContent>
      </Suspense>
    </ToastProvider>
  );
}
