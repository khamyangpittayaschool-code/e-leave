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
import { getDashboardStats } from "@/app/actions/leave";
import { 
  CheckCircle2, AlertCircle, Briefcase, 
  Users, Activity, Clock
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
          { title: isOverview ? t("allStaff") : t("quotaRemaining"), value: isOverview ? `${totalStaff} ${t("persons")}` : `${totalRemaining} ${t("days")}`, icon: isOverview ? Users : CheckCircle2, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { title: t("usedQuota"), value: `${totalUsed} ${t("days")}`, icon: Activity, color: "text-orange-500 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
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
    </motion.div>
  );
}
