"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { motion } from "framer-motion";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from "recharts";
import { getDashboardStats, getCalendarLeaves } from "@/app/actions/leave";
import { getHolidays } from "@/app/actions/holiday";
import { getSystemSettings } from "@/app/actions/settings";
import { getTodayAttendanceStats } from "@/app/actions/attendance-stats";
import { getMyAttendanceToday, generateAttendanceNonce, clockIn, clockOut } from "@/app/actions/attendance";
import { 
  CheckCircle2, AlertCircle, Briefcase, 
  Users, Activity, Clock, Calendar, ChevronLeft, ChevronRight, X,
  UserCheck, XCircle, MapPin, Fingerprint, CalendarDays, Loader2
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Animation Variants
const containerVariants: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: any = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const COLORS = {
  purple: "#8B5CF6",
  blue: "#38BDF8",
  green: "#34D399",
  orange: "#FBBF24",
  pink: "#FB7185",
  teal: "#14B8A6"
};

const COLOR_PALETTE = [COLORS.pink, COLORS.purple, COLORS.green, COLORS.orange, COLORS.teal];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const { t, lang, tPosition, tLeaveType } = useI18n();

  const monthNamesTh = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const monthNamesEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const weekDaysTh = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const weekDaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getCurrentFiscalYear = () => {
    const now = new Date();
    const month = now.getMonth();
    const calendarYear = now.getFullYear();
    return (month >= 9 ? calendarYear + 1 : calendarYear) + 543;
  };

  const currentFY = getCurrentFiscalYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentFY - i);
  const [dashboardYear, setDashboardYear] = useState<number>(currentFY);

  const [cycleFilter, setCycleFilter] = useState<"current" | "cycle1" | "cycle2" | "year">("current");
  const [leaderboardFilter, setLeaderboardFilter] = useState<"times" | "days">("times");
  const [viewMode, setViewMode] = useState<"school" | "personal">("school");

  // Calendar states
  const [calendarView, setCalendarView] = useState<"week" | "month" | "year">("month");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarLeaves, setCalendarLeaves] = useState<any[]>([]);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState<any[]>([]);
  const [isDayDetailModalOpen, setIsDayDetailModalOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [hasCalendarPermission, setHasCalendarPermission] = useState(true);
  const [holidays, setHolidays] = useState<any[]>([]);

  // Time Attendance Dashboard states
  const [activeSystemTab, setActiveSystemTab] = useState<"leave" | "attendance">("leave");
  const [attendanceEnabled, setAttendanceEnabled] = useState(false);
  const [schoolAttendanceStats, setSchoolAttendanceStats] = useState<any>(null);
  const [personalAttendanceToday, setPersonalAttendanceToday] = useState<any>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);

  useEffect(() => {
    getSystemSettings().then((s) => {
      setSysSettings(s);
      setAttendanceEnabled(!!s.enableAttendance);
      if (s.rolePermissions && session?.user) {
        try {
          const perms = JSON.parse(s.rolePermissions);
          const allowedRoles = perms.calendar || ["ADMIN", "DIRECTOR", "HR", "INSPECTOR", "TEACHER"];
          const user = session.user as any;
          let isFinalApprover = false;
          if (s.finalApproverUserIds) {
            const allowedIds = s.finalApproverUserIds.split(",").map((id: string) => id.trim()).filter(Boolean);
            isFinalApprover = allowedIds.includes(user.id);
          }
          let userRole = "TEACHER";
          if (user.role === "ADMIN" || user.position === "แอดมิน") userRole = "ADMIN";
          else if (user.position === "ผู้อำนวยการ" || isFinalApprover) userRole = "DIRECTOR";
          else if (user.position === "หัวหน้างานบุคคล" || user.position === "เจ้าหน้าที่บุคคล") userRole = "HR";
          else if (user.position === "ผู้ตรวจสอบ" || user.position === "หัวหน้าหมวด" || user.position === "หัวหน้ากลุ่มสาระ") userRole = "INSPECTOR";
          
          setHasCalendarPermission(allowedRoles.includes(userRole));
        } catch (e) {
          console.error("Failed to parse calendar permissions", e);
        }
      }
    }).catch(console.error);
  }, [session]);

  useEffect(() => {
    if (mounted && hasCalendarPermission) {
      getCalendarLeaves(dashboardYear)
        .then(setCalendarLeaves)
        .catch(console.error);
    }
    if (mounted) {
      getHolidays(dashboardYear)
        .then(setHolidays)
        .catch(console.error);
    }
  }, [dashboardYear, mounted]);

  useEffect(() => {
    const ceYear = dashboardYear - 543;
    setCalendarDate(prev => {
      const d = new Date(prev);
      d.setFullYear(ceYear);
      return d;
    });
  }, [dashboardYear]);

  useEffect(() => { 
    setMounted(true); 
    setStats(null);
    getDashboardStats(cycleFilter, lang, dashboardYear, viewMode)
      .then((data: any) => {
        setStats(data);
        if (data && !data.canViewOverview && viewMode !== "personal") {
          setViewMode("personal");
        }
      })
      .catch((err: any) => {
        console.error("Dashboard error:", err);
        if (err.message === "Unauthorized") {
          router.push("/login");
        }
      });
  }, [cycleFilter, lang, dashboardYear, viewMode, router]);

  useEffect(() => {
    if (!mounted || !session?.user || activeSystemTab !== "attendance") return;
    
    setLoadingAttendance(true);
    if (viewMode === "school") {
      getTodayAttendanceStats()
        .then(setSchoolAttendanceStats)
        .catch(console.error)
        .finally(() => setLoadingAttendance(false));
    } else {
      getMyAttendanceToday()
        .then((res: any) => {
          if (res) {
            setPersonalAttendanceToday({
              ...(res.attendance || {}),
              workShift: res.userSettings?.shiftName ? {
                name: res.userSettings.shiftName,
                startTime: res.userSettings.shiftStart,
                endTime: res.userSettings.shiftEnd,
              } : null,
              user: {
                bypassAttendance: res.userSettings?.bypassAttendance ?? false
              }
            });
          } else {
            setPersonalAttendanceToday(null);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingAttendance(false));
    }
  }, [activeSystemTab, viewMode, mounted, session]);

  const handleQuickClock = async (type: "in" | "out") => {
    if (!session?.user) return;
    
    const bypass = personalAttendanceToday?.user?.bypassAttendance === true;
    const requireFace = sysSettings?.requireFaceScan === true;
    const requireGPS = sysSettings?.requireGeofence === true;
    const requireLiveness = sysSettings?.requireLivenessCheck === true;

    // If security checks are required and user is not bypassed, redirect to clock-in page
    if (type === "in" && !bypass && (requireFace || requireGPS || requireLiveness)) {
      router.push("/attendance");
      return;
    }
    
    setClockActionLoading(true);
    try {
      if (type === "in") {
        const nonceRes = await generateAttendanceNonce();
        if (!nonceRes || !nonceRes.nonce) {
          alert("Failed to generate nonce. Please reload.");
          return;
        }
        
        const res = await clockIn({
          nonce: nonceRes.nonce,
          browserFingerprint: typeof window !== "undefined" ? window.navigator.userAgent : "dashboard"
        });
        
        if (res.success) {
          const todayRes = await getMyAttendanceToday();
          setPersonalAttendanceToday({
            ...(todayRes.attendance || {}),
            workShift: todayRes.userSettings?.shiftName ? {
              name: todayRes.userSettings.shiftName,
              startTime: todayRes.userSettings.shiftStart,
              endTime: todayRes.userSettings.shiftEnd,
            } : null,
            user: {
              bypassAttendance: todayRes.userSettings?.bypassAttendance ?? false
            }
          });
          alert(lang === "en" ? "Clocked in successfully!" : "ลงเวลาเข้างานสำเร็จ!");
        } else {
          alert(res.error || "Failed to clock in");
        }
      } else {
        const res = await clockOut({
          browserFingerprint: typeof window !== "undefined" ? window.navigator.userAgent : "dashboard"
        });
        
        if (res.success) {
          const todayRes = await getMyAttendanceToday();
          setPersonalAttendanceToday({
            ...(todayRes.attendance || {}),
            workShift: todayRes.userSettings?.shiftName ? {
              name: todayRes.userSettings.shiftName,
              startTime: todayRes.userSettings.shiftStart,
              endTime: todayRes.userSettings.shiftEnd,
            } : null,
            user: {
              bypassAttendance: todayRes.userSettings?.bypassAttendance ?? false
            }
          });
          alert(lang === "en" ? "Clocked out successfully!" : "ลงเวลาออกงานสำเร็จ!");
        } else {
          alert(res.error || "Failed to clock out");
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred");
    } finally {
      setClockActionLoading(false);
    }
  };

  // Calendar Helper functions
  const getLeaveColorClass = (type: string) => {
    return { 
      dot: "bg-indigo-500", 
      text: "text-indigo-650 dark:text-indigo-400 font-bold", 
      bg: "bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-150 dark:border-indigo-900/30 hover:bg-indigo-100/70" 
    };
  };

  const getHolidayForDay = (day: Date) => {
    const dYear = day.getFullYear();
    const dMonth = String(day.getMonth() + 1).padStart(2, '0');
    const dDate = String(day.getDate()).padStart(2, '0');
    const dStr = `${dYear}-${dMonth}-${dDate}`;
    
    return holidays.find(h => {
      const start = new Date(h.startDate);
      const sYear = start.getUTCFullYear();
      const sMonth = String(start.getUTCMonth() + 1).padStart(2, '0');
      const sDate = String(start.getUTCDate()).padStart(2, '0');
      const sStr = `${sYear}-${sMonth}-${sDate}`;

      const end = new Date(h.endDate);
      const eYear = end.getUTCFullYear();
      const eMonth = String(end.getUTCMonth() + 1).padStart(2, '0');
      const eDate = String(end.getUTCDate()).padStart(2, '0');
      const eStr = `${eYear}-${eMonth}-${eDate}`;

      return dStr >= sStr && dStr <= eStr;
    });
  };

  const getLeavesForDay = (day: Date) => {
    const target = new Date(day);
    target.setHours(0, 0, 0, 0);

    return calendarLeaves.filter(r => {
      const start = new Date(r.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(r.endDate);
      end.setHours(0, 0, 0, 0);
      return target >= start && target <= end;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const prevDaysCount = new Date(year, month, 0).getDate();
    
    const grid = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      grid.push({
        date: new Date(year, month - 1, prevDaysCount - i),
        isCurrentMonth: false
      });
    }
    for (let i = 1; i <= daysCount; i++) {
      grid.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    const totalCells = grid.length > 35 ? 42 : 35;
    const nextDaysNeed = totalCells - grid.length;
    for (let i = 1; i <= nextDaysNeed; i++) {
      grid.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    return grid;
  };

  const getDaysInWeek = (date: Date) => {
    const currentDay = date.getDay();
    const sun = new Date(date);
    sun.setDate(date.getDate() - currentDay);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const handleDayClick = (day: Date) => {
    const dayLeaves = getLeavesForDay(day);
    setSelectedDayLeaves(dayLeaves);
    setSelectedCalendarDate(day);
    setIsDayDetailModalOpen(true);
  };

  const handlePrev = () => {
    setCalendarDate(prev => {
      const d = new Date(prev);
      if (calendarView === "month") {
        d.setMonth(prev.getMonth() - 1);
      } else if (calendarView === "week") {
        d.setDate(prev.getDate() - 7);
      } else if (calendarView === "year") {
        d.setFullYear(prev.getFullYear() - 1);
      }
      return d;
    });
  };

  const handleNext = () => {
    setCalendarDate(prev => {
      const d = new Date(prev);
      if (calendarView === "month") {
        d.setMonth(prev.getMonth() + 1);
      } else if (calendarView === "week") {
        d.setDate(prev.getDate() + 7);
      } else if (calendarView === "year") {
        d.setFullYear(prev.getFullYear() + 1);
      }
      return d;
    });
  };

  if (!mounted || !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full" />
      </div>
    );
  }

  const { isOverview, usedDaysMap, leaveConfigs, pendingCount, totalStaff, approvalRate, monthlyData, deptStats, recentRequests, limitTimes = 6, limitDays = 15 } = stats;
  
  let totalUsed = 0;
  for (const type in usedDaysMap) {
    totalUsed += usedDaysMap[type];
  }

  const totalQuota = leaveConfigs
    ?.filter((c: any) => c.isActive !== false && c.maxDaysPerYear > 0)
    .reduce((sum: number, c: any) => sum + c.maxDaysPerYear, 0) || 15;
  const totalRemaining = Math.max(totalQuota - totalUsed, 0);
  const watchlistRemaining = Math.max(limitDays - (stats.userWatchlistStats?.totalDays ?? 0), 0);
  const user = session?.user as any;
  const missingFields: string[] = [];
  if (user) {
    if (!user.address) missingFields.push(lang === "en" ? "Address" : "ที่อยู่");
    if (!user.phoneNumber) missingFields.push(lang === "en" ? "Phone Number" : "เบอร์โทรศัพท์");
    if (!user.signatureUrl) missingFields.push(lang === "en" ? "Signature" : "ลายเซ็นดิจิทัล");
  }
  const isProfileIncomplete = missingFields.length > 0;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Welcome & KPIs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          {isOverview ? t("overviewTitle") : t("yourLeaveOverview")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isOverview ? t("overviewSubtitle") : t("yourLeaveSubtitle")}
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 w-full md:w-auto">
          {/* View Mode Selector */}
          {stats.canViewOverview && (
            <select
              value={viewMode}
              onChange={(e: any) => setViewMode(e.target.value as "school" | "personal")}
              className="h-10 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 cursor-pointer w-full md:w-auto shadow-sm"
            >
              <option value="school">{t("schoolOverview")}</option>
              <option value="personal">{t("myData")}</option>
            </select>
          )}
          {/* Year Filter */}
          <select
            value={dashboardYear}
            onChange={(e: any) => setDashboardYear(Number(e.target.value))}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 cursor-pointer w-full md:w-auto"
          >
            {availableYears.map(yr => (
              <option key={yr} value={yr}>{t("fiscalYearPrefix")} {yr}</option>
            ))}
          </select>

          {/* Cycle Filter */}
          <select
            value={cycleFilter}
            onChange={(e: any) => setCycleFilter(e.target.value)}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 cursor-pointer w-full md:w-auto"
          >
            <option value="current">{t("cycleCurrent")}</option>
            <option value="cycle1">{t("cycle1")}</option>
            <option value="cycle2">{t("cycle2")}</option>
            <option value="year">{t("yearFull")}</option>
          </select>
        </div>
      </div>

      {/* Profile Incomplete Warning CTA */}
      {isProfileIncomplete && (
        <motion.div 
          variants={itemVariants}
          className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-500/5 dark:via-orange-500/2 dark:to-transparent border border-amber-200/60 dark:border-amber-900/30 rounded-3xl p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                {lang === "en" ? "Please complete your profile information" : "กรุณาอัปเดตข้อมูลส่วนตัวให้ครบถ้วน"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {lang === "en" 
                  ? `You have not set your ${missingFields.join(", ")}. Complete this information to ensure your printed leave forms are fully valid.` 
                  : `คุณยังไม่ได้อัปเดต ${missingFields.join(", ")} ในระบบ กรุณากรอกข้อมูลเพื่อใช้ในการพิมพ์ใบสมัครขอลาที่ถูกต้อง`}
              </p>
            </div>
          </div>
          
          <Link
            href="/profile"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-md shadow-amber-500/10 hover:scale-[1.02] active:scale-95 whitespace-nowrap"
          >
            {lang === "en" ? "Update Profile →" : "ไปอัปเดตข้อมูลส่วนตัว →"}
          </Link>
        </motion.div>
      )}

      {/* System Toggle Tabs */}
      {attendanceEnabled && (
        <div className="flex gap-2 p-1.5 bg-slate-150/60 dark:bg-slate-800/80 rounded-2xl w-fit mb-2 border border-slate-200/40">
          <button
            onClick={() => setActiveSystemTab("leave")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSystemTab === "leave"
                ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm scale-100"
                : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-350"
            }`}
          >
            <CalendarDays className="w-4.5 h-4.5 text-purple-500" />
            {lang === "en" ? "Leave System" : "ระบบการลา"}
          </button>
          <button
            onClick={() => setActiveSystemTab("attendance")}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSystemTab === "attendance"
                ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm scale-100"
                : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-350"
            }`}
          >
            <Clock className="w-4.5 h-4.5 text-purple-500" />
            {lang === "en" ? "Time Attendance" : "ระบบลงเวลาทำงาน"}
          </button>
        </div>
      )}

      {activeSystemTab === "leave" && (
        <>
          <div className="hidden md:flex flex-col mb-6 space-y-3">
        <p className="text-sm font-medium text-slate-500">
          {isOverview ? t("overviewStats") : t("yourQuotaStats")} 
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
            {stats.currentCycle}
          </span>
        </p>
        {!isOverview && stats.userWatchlistStats && (
          <div className={`text-xs inline-flex w-fit items-center px-3 py-2 rounded-xl font-medium border shadow-sm ${stats.userWatchlistStats.isWarning ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'}`}>
            <AlertCircle className="w-4 h-4 mr-2" />
            {t("personalSickStats")} {stats.userWatchlistStats.totalTimes} {t("timesUnit")} ({t("leaveTotal")} {stats.userWatchlistStats.totalDays} {t("days")})
            {stats.userWatchlistStats.isWarning ? ` - ${t("watchlistWarning")}` : ""}
          </div>
        )}
      </div>

      {/* KPI Cards Layer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            title: isOverview ? t("allStaff") : (lang === "en" ? "Total Leave Days" : "จำนวนวันที่ลา"), 
            value: isOverview ? `${totalStaff} ${t("persons")}` : `${totalUsed} ${t("days")}`, 
            icon: isOverview ? Users : Activity, 
            color: "text-blue-500 dark:text-blue-400", 
            bg: "bg-blue-50 dark:bg-blue-500/10" 
          },
          { 
            title: isOverview ? t("usedQuota") : (lang === "en" ? "Quota Remaining" : "โควตาคงเหลือ"), 
            value: isOverview ? `${totalUsed} ${t("days")}` : `${watchlistRemaining} ${t("days")}`, 
            icon: isOverview ? Activity : CheckCircle2, 
            color: isOverview ? "text-orange-500 dark:text-orange-400" : "text-emerald-500 dark:text-emerald-400", 
            bg: isOverview ? "bg-orange-50 dark:bg-orange-500/10" : "bg-emerald-50 dark:bg-emerald-500/10" 
          },
          { title: t("pendingItems"), value: `${pendingCount} ${t("requestsCount")}`, icon: AlertCircle, color: "text-purple-500 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
          { title: t("approvalRate"), value: `${approvalRate}%`, icon: Briefcase, color: "text-green-500 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" }
        ].map((kpi, i) => (
          <motion.div key={i} variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-none transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">{kpi.title}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 truncate">{kpi.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Complex Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Global Quota Progress */}
        <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-1 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{t("leaveOverviewSickPersonal")}</h3>
          <div className="space-y-6">
            {/* Times Progress */}
            <div>
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span className="text-slate-700 dark:text-slate-300">{t("usedQuotaTimes")}</span>
                <span className="text-slate-900 dark:text-white">{stats.userWatchlistStats?.totalTimes || 0} / {limitTimes} {t("timesUnit")}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((stats.userWatchlistStats?.totalTimes || 0) / limitTimes) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${(stats.userWatchlistStats?.totalTimes || 0) >= Math.floor(limitTimes * 0.67) ? 'bg-orange-500' : 'bg-purple-500'}`}
                />
              </div>
            </div>
            
            {/* Days Progress */}
            <div>
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span className="text-slate-700 dark:text-slate-300">{t("usedQuotaDays")}</span>
                <span className="text-slate-900 dark:text-white">{stats.userWatchlistStats?.totalDays || 0} / {limitDays} {t("days")}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((stats.userWatchlistStats?.totalDays || 0) / limitDays) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  className={`h-full rounded-full ${(stats.userWatchlistStats?.totalDays || 0) >= Math.floor(limitDays * 0.8) ? 'bg-rose-500' : 'bg-blue-500'}`}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                {t("quotaWarningNote")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Monthly Trend Area Chart */}
        <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{t("monthlyTrend")}</h3>
          <div className="min-h-[250px] h-[250px] w-full flex-1">
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSick" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94A3B8" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94A3B8" }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    color: '#fff', 
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(8px)'
                  }} 
                  itemStyle={{ color: '#e2e8f0' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="value" stroke={COLORS.blue} strokeWidth={4} fill="url(#colorSick)" activeDot={{ r: 8, fill: COLORS.blue, stroke: '#fff', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        

        {/* Admin Watchlist / Leaderboard */}
        {isOverview && (
          <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col max-h-[400px] overflow-hidden">
            <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 py-1 z-10 backdrop-blur-sm mb-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  {t("watchlist")}
                </h3>
                <select 
                  value={leaderboardFilter}
                  onChange={(e) => setLeaderboardFilter(e.target.value as "times" | "days")}
                  className="h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="times">{t("sortByTimes")}</option>
                  <option value="days">{t("sortByDays")}</option>
                </select>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("watchlistDescExtra")}</p>
            </div>
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {stats.leaveLeaderboard?.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t("noStaffLeaveYet")}</p>
              ) : (
                [...stats.leaveLeaderboard]
                  .sort((a, b) => leaderboardFilter === "times" ? b.totalTimes - a.totalTimes : b.totalDays - a.totalDays)
                  .map((item: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${item.isWarning ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-700'} transition-colors`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-snug ${item.isWarning ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                        <span className="text-xs text-slate-400 mr-2">#{i + 1}</span>{item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{tPosition(item.position)}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className={`text-sm font-bold ${leaderboardFilter === 'times' ? (item.isWarning ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300') : 'text-slate-500 dark:text-slate-400'}`}>
                        {item.totalTimes} {t("timesUnit")}
                      </p>
                      <p className={`text-xs ${leaderboardFilter === 'days' ? (item.isWarning ? 'text-rose-600 font-bold' : 'text-slate-700 font-bold dark:text-slate-300') : 'text-slate-500 dark:text-slate-400'}`}>
                        {item.totalDays} {t("days")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Recent Activity List */}
        <motion.div variants={itemVariants} className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col ${!isOverview ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("recentActivity")}</h3>
            <Link href={isOverview ? "/approvals" : "/history"} className="text-xs font-bold text-purple-500 hover:text-purple-600">
              {t("viewAll")}
            </Link>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {recentRequests.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">{t("noActivityYet")}</p>
            ) : (
              recentRequests.map((req: any, i: number) => {
                const config = leaveConfigs.find((c: any) => c.type === req.type);
                
                // Status Mapping
                let statusLabel = req.status;
                let statusColor = "text-orange-500 dark:text-orange-400";
                if (req.status === "APPROVED") {
                  statusLabel = t("approvedStatus") || "อนุมัติแล้ว";
                  statusColor = "text-emerald-500 dark:text-emerald-400";
                } else if (req.status === "REJECTED") {
                  statusLabel = t("rejectedStatus") || "ปฏิเสธแล้ว";
                  statusColor = "text-rose-500 dark:text-rose-400";
                } else if (req.status === "PENDING_HEAD") {
                  statusLabel = t("pendingHrHead");
                } else if (req.status === "PENDING_EXEC") {
                  statusLabel = t("pendingDirector");
                }

                return (
                  <div key={i} className="flex items-start gap-4 p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all duration-300 group cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-800/60">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm mt-0.5 ${
                      req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400' :
                      req.status === 'REJECTED' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400' :
                      'bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 dark:text-white leading-relaxed">
                        {isOverview && req.userName ? (
                          <span className="text-purple-600 dark:text-purple-400 font-bold mr-1.5">{req.userName}</span>
                        ) : null}
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {t("requested")}{tLeaveType(req.type, config?.name)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-slate-400 dark:text-slate-500 font-medium">
                          {new Date(req.createdAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

      </div>

      {/* Teacher Leave Calendar */}
      {hasCalendarPermission && (
        <motion.div 
          variants={itemVariants} 
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mt-6 flex flex-col"
        >
          {/* Calendar Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-850 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === "en" ? "Staff Leave Calendar" : "ปฏิทินการลาของบุคลากร"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calendarView === "month" ? (lang === "en" ? `${monthNamesEn[calendarDate.getMonth()]} ${calendarDate.getFullYear()}` : `${monthNamesTh[calendarDate.getMonth()]} ${calendarDate.getFullYear() + 543}`) : 
                   calendarView === "week" ? (lang === "en" ? `Week of ${calendarDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `สัปดาห์วันที่ ${calendarDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}`) :
                   (lang === "en" ? `Year ${calendarDate.getFullYear()}` : `ปี พ.ศ. ${calendarDate.getFullYear() + 543}`)}
                </p>
              </div>
            </div>

            {/* Navigation and Segmented Control */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button 
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setCalendarDate(new Date())}
                  className="px-2.5 py-1 hover:bg-white dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-lg transition-all"
                >
                  {lang === "en" ? "Today" : "วันนี้"}
                </button>
                <button 
                  onClick={handleNext}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(["week", "month", "year"] as const).map(view => (
                  <button
                    key={view}
                    onClick={() => setCalendarView(view)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      calendarView === view
                        ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                    }`}
                  >
                    {view === "week" ? (lang === "en" ? "Week" : "สัปดาห์") :
                     view === "month" ? (lang === "en" ? "Month" : "เดือน") :
                     (lang === "en" ? "Year" : "ปี")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* View Content */}
          {calendarView === "month" && (
            <div className="space-y-2">
              {/* Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 dark:text-slate-400 py-1">
                {(lang === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]).map((day, dIdx) => {
                  const isWeekendHeader = dIdx === 0 || dIdx === 6;
                  return (
                    <div key={day} className={isWeekendHeader ? "text-rose-500/80 dark:text-rose-400/80" : ""}>
                      {day}
                    </div>
                  );
                })}
              </div>
              {/* Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {getDaysInMonth(calendarDate).map((cell, idx) => {
                  const leaves = getLeavesForDay(cell.date);
                  const isToday = cell.date.toDateString() === new Date().toDateString();
                  const holiday = getHolidayForDay(cell.date);
                  const isHoliday = holiday && !holiday.isWorkday;
                  const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;

                  let cellBgStyle = cell.isCurrentMonth 
                    ? isWeekend
                      ? 'bg-slate-100/50 hover:bg-slate-200/50 dark:bg-slate-850/40 dark:hover:bg-slate-800/40 border-slate-200/70 dark:border-slate-800/80'
                      : 'bg-slate-50/50 hover:bg-slate-100/50 dark:bg-slate-900/40 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/80' 
                    : 'bg-white/10 dark:bg-slate-950/5 opacity-40 border-transparent pointer-events-none';
                  
                  if (cell.isCurrentMonth && isHoliday) {
                    cellBgStyle = 'bg-rose-50/40 hover:bg-rose-100/40 dark:bg-rose-950/10 dark:hover:bg-rose-900/20 border-rose-100 dark:border-rose-900/30';
                  }

                  return (
                    <div 
                      key={idx}
                      onClick={() => handleDayClick(cell.date)}
                      className={`min-h-[90px] p-1.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${cellBgStyle} ${isToday ? 'ring-2 ring-purple-500 dark:ring-purple-400 ring-offset-2 dark:ring-offset-slate-950 bg-purple-50/20 dark:bg-purple-950/10' : ''}`}
                    >
                      <span className={`text-[11px] font-bold self-start ${
                        isToday 
                          ? 'text-purple-600 dark:text-purple-400' 
                          : isHoliday 
                            ? 'text-rose-600 dark:text-rose-400' 
                            : isWeekend
                              ? 'text-slate-550 dark:text-slate-400'
                              : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {cell.date.getDate()}
                      </span>
                      <div className="flex-1 w-full space-y-1 mt-1">
                        {isHoliday && (
                          <div 
                            className="px-1.5 py-0.5 rounded-lg border text-[9px] truncate flex items-center gap-1 bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 font-bold"
                            title={holiday.name}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-rose-500" />
                            <span>{holiday.name}</span>
                          </div>
                        )}
                        {holiday && holiday.isWorkday && (
                          <div 
                            className="px-1.5 py-0.5 rounded-lg border text-[9px] truncate flex items-center gap-1 bg-amber-50/70 dark:bg-amber-950/40 border-amber-250 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 font-bold"
                            title={holiday.name}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                            <span>{holiday.name}</span>
                          </div>
                        )}
                        {leaves.slice(0, holiday ? 2 : 3).map((l, i) => {
                          const style = getLeaveColorClass(l.type);
                          return (
                            <div 
                              key={i} 
                              className={`px-1.5 py-0.5 rounded-lg border text-[9px] truncate flex items-center gap-1 ${style.bg} ${style.text}`}
                              title={`${l.user?.name || 'ครู'}: ${l.type}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                              <span>{l.user?.name || l.type}</span>
                            </div>
                          );
                        })}
                        {leaves.length > (holiday ? 2 : 3) && (
                          <div className="text-[8px] text-slate-400 font-semibold pl-1.5">
                            + {leaves.length - (holiday ? 2 : 3)} {lang === "en" ? "more" : "คน"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {calendarView === "week" && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {getDaysInWeek(calendarDate).map((day, idx) => {
                const leaves = getLeavesForDay(day);
                const isToday = day.toDateString() === new Date().toDateString();
                const holiday = getHolidayForDay(day);
                const isHoliday = holiday && !holiday.isWorkday;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const weekDaysTh = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
                const weekDaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                return (
                  <div 
                    key={idx}
                    className={`p-4 rounded-2xl border flex flex-col gap-3 min-h-[300px] ${
                      isToday 
                        ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-200 dark:border-purple-900/50 shadow-sm'
                        : isHoliday
                          ? 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30 shadow-sm'
                          : isWeekend
                            ? 'bg-slate-100/40 dark:bg-slate-850/20 border-slate-205 dark:border-slate-800'
                            : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="border-b border-slate-100 dark:border-slate-850 pb-2 flex flex-col items-center">
                      <span className={`text-xs font-bold ${day.getDay() === 0 || day.getDay() === 6 ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-slate-400 dark:text-slate-500'}`}>
                        {lang === "en" ? weekDaysEn[day.getDay()] : weekDaysTh[day.getDay()]}
                      </span>
                      <span className={`text-2xl font-bold mt-0.5 ${isToday ? 'text-purple-600 dark:text-purple-400' : isHoliday ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {day.getDate()}
                      </span>
                      {isHoliday && (
                        <span className="text-[9px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded-md mt-1 truncate max-w-full text-center" title={holiday.name}>
                          {holiday.name}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1.5 custom-scrollbar">
                      {leaves.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-6 italic">{lang === "en" ? "No leaves" : "ไม่มีการลา"}</p>
                      ) : (
                        leaves.map((l, i) => {
                          const style = getLeaveColorClass(l.type);
                          return (
                            <div 
                              key={i} 
                              onClick={() => handleDayClick(day)}
                              className={`p-2 rounded-xl border text-[10px] space-y-1 cursor-pointer transition-all ${style.bg}`}
                            >
                              <div className="font-bold truncate text-slate-900 dark:text-white">{l.user?.name || "ครู"}</div>
                              <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                <span className="font-semibold">{tLeaveType(l.type)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calendarView === "year" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
              {(() => {
                const year = calendarDate.getFullYear();
                const monthsTh = [
                  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
                ];
                const monthsEn = [
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"
                ];
                
                return Array.from({ length: 12 }).map((_, mIdx) => {
                  const mDate = new Date(year, mIdx, 1);
                  const days = getDaysInMonth(mDate);
                  
                  return (
                    <div 
                      key={mIdx} 
                      className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col gap-2 transition-all hover:shadow-md"
                    >
                      {/* Month Header - Clickable to switch to that month view */}
                      <button
                        type="button"
                        onClick={() => {
                          setCalendarDate(mDate);
                          setCalendarView("month");
                        }}
                        className="text-left font-bold text-sm text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full flex justify-between items-center"
                      >
                        <span>{lang === "en" ? monthsEn[mIdx] : monthsTh[mIdx]}</span>
                        <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          {lang === "en" ? "View" : "ดูรายเดือน"}
                        </span>
                      </button>

                      {/* Mini Weekday Headers */}
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-slate-400">
                        {(lang === "en" ? ["S", "M", "T", "W", "T", "F", "S"] : ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]).map(day => (
                          <div key={day}>{day}</div>
                        ))}
                      </div>

                      {/* Mini Days Grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((cell, dIdx) => {
                          const leaves = getLeavesForDay(cell.date);
                          const isToday = cell.date.toDateString() === new Date().toDateString();
                          const holiday = getHolidayForDay(cell.date);
                          const isHoliday = holiday && !holiday.isWorkday;
                          const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;

                          let cellBgClass = "bg-transparent text-slate-350 dark:text-slate-600 pointer-events-none opacity-20";
                          let cellBorderClass = "border-transparent";
                          if (cell.isCurrentMonth) {
                            if (isHoliday) {
                              cellBgClass = "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-250 font-bold hover:bg-rose-200 dark:hover:bg-rose-900/80 cursor-pointer";
                              cellBorderClass = "border-rose-200 dark:border-rose-900/40";
                            } else if (leaves.length > 0) {
                              cellBgClass = "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-250 font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/80 cursor-pointer";
                              cellBorderClass = "border-indigo-200 dark:border-indigo-900/40";
                            } else if (isWeekend) {
                              cellBgClass = "bg-slate-100/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer";
                              cellBorderClass = "border-slate-150 dark:border-slate-850/80";
                            } else {
                              cellBgClass = "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer";
                              cellBorderClass = "border-slate-100 dark:border-slate-850";
                            }
                            if (isToday) {
                              cellBorderClass = "border-purple-500 ring-1 ring-purple-500/50";
                            }
                          }

                          return (
                            <div 
                              key={dIdx}
                              onClick={() => cell.isCurrentMonth && handleDayClick(cell.date)}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-semibold border transition-all ${cellBgClass} ${cellBorderClass}`}
                              title={cell.isCurrentMonth 
                                ? isHoliday 
                                  ? `${cell.date.getDate()} ${lang === "en" ? monthsEn[mIdx] : monthsTh[mIdx]} (${lang === "en" ? "Holiday" : "วันหยุด"}: ${holiday.name})`
                                  : `${cell.date.getDate()} ${lang === "en" ? monthsEn[mIdx] : monthsTh[mIdx]} (${leaves.length} ${lang === "en" ? "on leave" : "คนลา"})` 
                                : ""}
                            >
                              {cell.isCurrentMonth ? cell.date.getDate() : ""}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </motion.div>
      )}
        </>
      )}

      {/* Time Attendance Tab Content */}
      {activeSystemTab === "attendance" && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {loadingAttendance ? (
            <div className="flex flex-col items-center justify-center min-h-[45vh] bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 rounded-3xl p-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 font-semibold tracking-wide animate-pulse">
                {lang === "en" ? "Loading attendance statistics..." : "กำลังโหลดข้อมูลสถิติการลงเวลา..."}
              </p>
            </div>
          ) : viewMode === "school" ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    title: lang === "en" ? "On Time" : "มาปกติ",
                    value: `${schoolAttendanceStats?.summary?.present ?? 0} ${t("persons")}`,
                    icon: UserCheck,
                    color: "text-emerald-500 dark:text-emerald-400",
                    bg: "bg-emerald-50 dark:bg-emerald-500/10",
                    pct: schoolAttendanceStats?.summary?.total ? Math.round(((schoolAttendanceStats?.summary?.present ?? 0) / schoolAttendanceStats.summary.total) * 100) : 0
                  },
                  {
                    title: lang === "en" ? "Late" : "มาสาย",
                    value: `${schoolAttendanceStats?.summary?.late ?? 0} ${t("persons")}`,
                    icon: Clock,
                    color: "text-amber-500 dark:text-amber-400",
                    bg: "bg-amber-50 dark:bg-amber-500/10",
                    pct: schoolAttendanceStats?.summary?.total ? Math.round(((schoolAttendanceStats?.summary?.late ?? 0) / schoolAttendanceStats.summary.total) * 100) : 0
                  },
                  {
                    title: lang === "en" ? "On Leave" : "ลาหยุดวันนี้",
                    value: `${schoolAttendanceStats?.summary?.leave ?? 0} ${t("persons")}`,
                    icon: Calendar,
                    color: "text-purple-500 dark:text-purple-400",
                    bg: "bg-purple-50 dark:bg-purple-500/10",
                    pct: schoolAttendanceStats?.summary?.total ? Math.round(((schoolAttendanceStats?.summary?.leave ?? 0) / schoolAttendanceStats.summary.total) * 100) : 0
                  },
                  {
                    title: lang === "en" ? "Pending Scan" : "ยังไม่ลงชื่อ",
                    value: `${schoolAttendanceStats?.summary?.pending ?? 0} ${t("persons")}`,
                    icon: AlertCircle,
                    color: "text-rose-500 dark:text-rose-400",
                    bg: "bg-rose-50 dark:bg-rose-500/10",
                    pct: schoolAttendanceStats?.summary?.total ? Math.round(((schoolAttendanceStats?.summary?.pending ?? 0) / schoolAttendanceStats.summary.total) * 100) : 0
                  }
                ].map((kpi, i) => (
                  <motion.div key={i} variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-none transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                        <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{kpi.title}</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 truncate">{kpi.value}</p>
                        <p className="text-[10px] text-slate-405 dark:text-slate-500 mt-0.5">{kpi.pct}% {lang === "en" ? "of total staff" : "ของบุคลากรทั้งหมด"}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Complex Layout: Donut Chart + Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Today Ratio Pie/Donut Chart */}
                <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-1 flex flex-col items-center justify-center min-h-[360px]">
                  <h3 className="text-sm font-bold text-slate-850 dark:text-white mb-4 self-start">
                    {lang === "en" ? "Today's Attendance Ratio" : "อัตราส่วนการลงชื่อวันนี้"}
                  </h3>
                  
                  <div className="relative flex items-center justify-center my-4">
                    <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-90">
                      {/* Background Circle */}
                      <circle cx="90" cy="90" r="70" fill="transparent" stroke="#F1F5F9" strokeWidth="18" className="dark:stroke-slate-800/60" />
                      {/* Segment Drawings */}
                      {(() => {
                        const total = schoolAttendanceStats?.summary?.total || 1;
                        let offset = 0;
                        const slices = [
                          { val: schoolAttendanceStats?.summary?.present || 0, color: "#10B981" }, // Emerald - Present
                          { val: schoolAttendanceStats?.summary?.late || 0, color: "#F59E0B" },    // Amber - Late
                          { val: schoolAttendanceStats?.summary?.leave || 0, color: "#8B5CF6" },   // Purple - Leave
                          { val: schoolAttendanceStats?.summary?.pending || 0, color: "#EF4444" }  // Rose - Pending
                        ];
                        const circ = 439.82;
                        return slices.map((s, idx) => {
                          if (s.val === 0) return null;
                          const size = (s.val / total) * circ;
                          const currOffset = offset;
                          offset += size;
                          return (
                            <circle
                              key={idx}
                              cx="90"
                              cy="90"
                              r="70"
                              fill="transparent"
                              stroke={s.color}
                              strokeWidth="18"
                              strokeDasharray={`${size} ${circ}`}
                              strokeDashoffset={-currOffset}
                              strokeLinecap="round"
                              className="transition-all duration-500 ease-in-out"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-black text-slate-850 dark:text-white">
                        {schoolAttendanceStats?.summary?.total ?? 0}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                        {lang === "en" ? "Total Staff" : "บุคลากรทั้งหมด"}
                      </span>
                    </div>
                  </div>

                  {/* Legend Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 w-full text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-650 dark:text-slate-400 font-medium truncate">
                        {lang === "en" ? "On Time" : "ตรงเวลา"}: <strong>{schoolAttendanceStats?.summary?.present ?? 0}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-slate-650 dark:text-slate-400 font-medium truncate">
                        {lang === "en" ? "Late" : "สาย"}: <strong>{schoolAttendanceStats?.summary?.late ?? 0}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      <span className="text-slate-650 dark:text-slate-400 font-medium truncate">
                        {lang === "en" ? "On Leave" : "ลา"}: <strong>{schoolAttendanceStats?.summary?.leave ?? 0}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-650 dark:text-slate-400 font-medium truncate">
                        {lang === "en" ? "Pending" : "ยังไม่สแกน"}: <strong>{schoolAttendanceStats?.summary?.pending ?? 0}</strong>
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Late List Widget */}
                <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-1 flex flex-col min-h-[360px] max-h-[360px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-4.5 h-4.5 text-amber-500" />
                      {lang === "en" ? "Lates Today" : "รายชื่อผู้ลงชื่อสายวันนี้"}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-55/60 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                      {schoolAttendanceStats?.lateList?.length ?? 0} {lang === "en" ? "Persons" : "คน"}
                    </span>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
                    {!schoolAttendanceStats?.lateList || schoolAttendanceStats.lateList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-10">
                        <UserCheck className="w-10 h-10 stroke-1.5 mb-2 text-emerald-450 dark:text-emerald-600" />
                        <p className="text-xs font-semibold">{lang === "en" ? "No late sign-ins today!" : "วันนี้ไม่มีบุคลากรมาสายเลย!"}</p>
                      </div>
                    ) : (
                      schoolAttendanceStats.lateList.map((a: any, index: number) => (
                        <div key={index} className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-850 dark:text-white block truncate">{a.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{a.subjectGroup}</span>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold text-rose-600 dark:text-rose-450 bg-rose-55/10 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/20 px-2 py-1 rounded-xl flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {a.checkIn} {lang === "en" ? "Late" : "น. (สาย)"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>

                {/* Pending List Widget */}
                <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-1 flex flex-col min-h-[360px] max-h-[360px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-1.5">
                      <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
                      {lang === "en" ? "Not Checked In Yet" : "ยังไม่ได้ลงเวลาทำงานวันนี้"}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-55/60 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
                      {schoolAttendanceStats?.pendingList?.length ?? 0} {lang === "en" ? "Persons" : "คน"}
                    </span>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
                    {!schoolAttendanceStats?.pendingList || schoolAttendanceStats.pendingList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-10">
                        <CheckCircle2 className="w-10 h-10 stroke-1.5 mb-2 text-emerald-450 dark:text-emerald-600" />
                        <p className="text-xs font-semibold">{lang === "en" ? "Everyone has signed in!" : "บุคลากรทุกคนลงเวลาเข้างานครบแล้ว!"}</p>
                      </div>
                    ) : (
                      schoolAttendanceStats.pendingList.map((u: any, index: number) => (
                        <div key={index} className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-850 dark:text-white block truncate">{u.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{u.position}</span>
                          </div>
                          <span className="shrink-0 text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                            {u.subjectGroup}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>

              {/* CTA to Stats Page */}
              <motion.div variants={itemVariants} className="flex justify-end mt-2">
                <Link
                  href="/attendance/stats"
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/10 hover:scale-[1.01] active:scale-95 cursor-pointer"
                >
                  <Activity className="w-4.5 h-4.5" />
                  {lang === "en" ? "View Detailed Attendance Statistics →" : "ดูประวัติและรายงานการลงเวลาอย่างละเอียด →"}
                </Link>
              </motion.div>
            </>
          ) : (
            /* PERSONAL TODAY ATTENDANCE VIEW */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Today Status Card */}
              <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-2 flex flex-col justify-between min-h-[280px]">
                <div>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {lang === "en" ? "Today's Work Log" : "การลงชื่อเข้างานวันนี้"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date().toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    {personalAttendanceToday?.workShift && (
                      <span className="px-3 py-1.5 rounded-2xl text-[10px] font-bold bg-indigo-55/10 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 w-fit">
                        {lang === "en" ? "Shift" : "กะเวลา"}: {personalAttendanceToday.workShift.name} ({personalAttendanceToday.workShift.startTime} - {personalAttendanceToday.workShift.endTime})
                      </span>
                    )}
                  </div>

                  {/* Clock Status Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {/* Clock In */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        {lang === "en" ? "Clock In" : "เวลาเข้างาน"}
                      </span>
                      {personalAttendanceToday?.checkInTime ? (
                        <div className="flex flex-col">
                          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                            {new Date(personalAttendanceToday.checkInTime).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })} น.
                          </span>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded-xl text-[9px] font-bold ${
                              personalAttendanceToday.status === "LATE"
                                ? "bg-rose-55/10 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                                : "bg-emerald-55/10 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                            }`}>
                              {personalAttendanceToday.status === "LATE" ? (lang === "en" ? "LATE" : "มาสาย") : (lang === "en" ? "ON TIME" : "ตรงเวลา")}
                            </span>
                            {personalAttendanceToday.latitude && (
                              <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {lang === "en" ? "GPS" : "GPS"}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col py-2">
                          <span className="text-sm font-bold text-slate-400 italic">
                            {lang === "en" ? "Not Checked In" : "ยังไม่สแกนเข้างาน"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Clock Out */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        {lang === "en" ? "Clock Out" : "เวลาเลิกงาน"}
                      </span>
                      {personalAttendanceToday?.checkOutTime ? (
                        <div className="flex flex-col">
                          <span className="text-3xl font-black text-indigo-650 dark:text-indigo-400">
                            {new Date(personalAttendanceToday.checkOutTime).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })} น.
                          </span>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded-xl text-[9px] font-bold ${
                              personalAttendanceToday.status === "EARLY_OUT"
                                ? "bg-rose-55/10 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                                : "bg-indigo-55/10 text-indigo-750 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30"
                            }`}>
                              {personalAttendanceToday.status === "EARLY_OUT" ? (lang === "en" ? "EARLY OUT" : "กลับก่อนเวลา") : (lang === "en" ? "COMPLETED" : "กลับปกติ")}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col py-2">
                          <span className="text-sm font-bold text-slate-400 italic text-wrap">
                            {personalAttendanceToday?.checkInTime 
                              ? (lang === "en" ? "Pending Clock Out" : "รอสแกนออกงาน")
                              : (lang === "en" ? "Not Checked In" : "ยังไม่ได้ลงเวลา")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interactive Clock In/Out Actions */}
                {!personalAttendanceToday?.checkInTime ? (
                  <div className="mt-6 flex justify-end">
                    <button
                      disabled={clockActionLoading}
                      onClick={() => handleQuickClock("in")}
                      className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {clockActionLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Fingerprint className="w-5 h-5 text-white animate-pulse" />
                      )}
                      {lang === "en" ? "Clock In Now →" : "สแกนนิ้ว / ลงเวลาเข้างาน →"}
                    </button>
                  </div>
                ) : !personalAttendanceToday?.checkOutTime ? (
                  <div className="mt-6 flex justify-end">
                    <button
                      disabled={clockActionLoading}
                      onClick={() => handleQuickClock("out")}
                      className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-md shadow-rose-600/20 hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {clockActionLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Clock className="w-5 h-5 text-white animate-pulse" />
                      )}
                      {lang === "en" ? "Clock Out Now →" : "ลงเวลาออกงาน (Clock Out) →"}
                    </button>
                  </div>
                ) : null}
              </motion.div>

              {/* Quick Actions & Navigation */}
              <motion.div variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:col-span-1 flex flex-col justify-between min-h-[280px]">
                <div>
                  <h3 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-1.5 mb-4">
                    <Activity className="w-4.5 h-4.5 text-indigo-500" />
                    {lang === "en" ? "Attendance Shortcuts" : "ทางลัดลงเวลาทำงาน"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed mb-6">
                    {lang === "en" 
                      ? "You can view your history logs, print reports, or scan in/out for daily shifting."
                      : "คุณสามารถสแกนเวลาเข้าออกงาน ตรวจสอบประวัติการเข้างานรายเดือน หรือพิมพ์สถิติการมาปฏิบัติราชการเพื่อประกอบรายงาน"}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Link
                    href="/attendance"
                    className="w-full py-3 rounded-2xl border border-indigo-250/80 text-indigo-600 hover:bg-indigo-50/50 dark:border-indigo-800/40 dark:text-indigo-400 dark:hover:bg-indigo-950/20 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Fingerprint className="w-4.5 h-4.5" />
                    {lang === "en" ? "Clock In/Out Dashboard" : "หน้าจอลงเวลาทำงาน"}
                  </Link>
                  <Link
                    href="/history"
                    className="w-full py-3 rounded-2xl border border-slate-200 text-slate-650 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-900/50 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Calendar className="w-4.5 h-4.5" />
                    {lang === "en" ? "View Full History" : "ดูประวัติส่วนตัวทั้งหมด"}
                  </Link>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      {/* Calendar Day Details Modal */}
      {isDayDetailModalOpen && selectedCalendarDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-gray-150 dark:border-gray-800 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-850 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Calendar className="w-5 h-5" />
                <span className="text-md font-bold text-gray-950 dark:text-white">
                  {lang === "en" ? "Leave Details" : "รายชื่อผู้ลากิจ/ลาป่วย"}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setIsDayDetailModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold block">{lang === "en" ? "DATE" : "วันที่เลือก"}</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {selectedCalendarDate.toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <div className="space-y-3">
                {selectedDayLeaves.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                    <p className="text-xs font-semibold">{lang === "en" ? "All staff present - no one on leave!" : "ทุกคนอยู่ครบ - ไม่มีบุคลากรลาในวันนี้"}</p>
                  </div>
                ) : (
                  selectedDayLeaves.map((l, i) => {
                    const style = getLeaveColorClass(l.type);
                    return (
                      <div 
                        key={i} 
                        className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white block">{l.user?.name || "ครู"}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{tPosition(l.user?.position) || "-"}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 ${style.bg} ${style.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {tLeaveType(l.type)}
                          </span>
                        </div>
                        
                        <div className="bg-white/40 dark:bg-slate-950/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-850 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-semibold">{lang === "en" ? "Duration" : "ระยะเวลาลา"}</span>
                            <span className="text-slate-700 dark:text-slate-300 font-bold">
                              {new Date(l.startDate).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: 'numeric', month: 'short' })} - {new Date(l.endDate).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {l.reason && (
                            <div className="flex flex-col gap-1 border-t border-slate-100/40 dark:border-slate-850/50 pt-1.5">
                              <span className="text-slate-400 font-semibold">{lang === "en" ? "Reason" : "เหตุผลการลา"}</span>
                              <span className="text-slate-700 dark:text-slate-300 font-medium italic">"{l.reason}"</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-950/40 border-t border-gray-100 dark:border-gray-800 text-center shrink-0">
              <button
                type="button"
                onClick={() => setIsDayDetailModalOpen(false)}
                className="px-6 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white font-bold text-xs transition-all shadow-md"
              >
                {lang === "en" ? "Close" : "ปิด"}
              </button>
            </div>
          </div>
        </div>
      )}
  </motion.div>
);
}
