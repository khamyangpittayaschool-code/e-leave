"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import { useI18n, I18nProvider } from "@/lib/i18n";
import { useState, useEffect, useRef, useCallback } from "react";
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
  Bell
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
    </div>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [brandName, setBrandName] = useState("ระบบการลา");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    import("@/app/actions/settings").then(({ getSystemSettings }) => {
      getSystemSettings().then((s) => {
        setBrandName(s.schoolName || t("loginTitle"));
        setBrandLogo(s.logoUrl || null);
      }).catch(() => {});
    });
  }, []);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] dark:bg-slate-900">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-purple-200 border-t-purple-600 rounded-full" 
        />
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.position === "แอดมิน";
  const isApprover = isAdmin || user.position === "ผู้บริหาร" || user.position === "หัวหน้างานบุคคล";

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

  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/request", label: t("requestLeave"), icon: FileText },
    { href: "/history", label: t("history"), icon: History },
  ];

  if (isApprover) {
    navItems.push({ href: "/approvals", label: t("approvals"), icon: CheckSquare });
  }
  
  if (isAdmin) {
    navItems.push(
      { href: "/reports", label: t("reports"), icon: FileSpreadsheet },
      { href: "/users", label: t("users"), icon: Users },
      { href: "/logs", label: t("logs"), icon: Activity },
      { href: "/settings", label: t("settings"), icon: Settings }
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white font-sans selection:bg-purple-500/30">
      
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
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[280px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[4px_0_24px_rgba(0,0,0,0.02)] print:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        
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
          <div className="px-4 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t("mainMenu")}</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
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
                  {item.label}
                </div>
              </Link>
            );
          })}

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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-sm">
                {user.name?.charAt(0)?.toUpperCase()}
              </div>
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
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        
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
        <div className="flex-1 px-6 lg:px-10 pb-12 w-full max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>

    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AppContent>{children}</AppContent>
    </I18nProvider>
  );
}
