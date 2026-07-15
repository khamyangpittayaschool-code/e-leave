"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Clock, BarChart3, 
  Printer, RefreshCw, Loader2,
  ChevronDown, TrendingUp, AlertTriangle
} from "lucide-react";
import { 
  getTodayAttendanceStats, 
  getIndividualAttendanceStats, 
  getSchoolAttendanceAnalytics 
} from "@/app/actions/attendance-stats";
import { getSimpleUsersList } from "@/app/actions/settings";
import { useToast } from "@/components/toast-provider";
import { recordOfficialDuty, removeOfficialDuty, getOfficialDutyRecords } from "@/app/actions/attendance";

// --- SVG Chart Components ---

function PieChart({ data, size = 200 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <p className="text-sm text-slate-400">ไม่มีข้อมูล</p>
    </div>
  );

  const r = 80;
  const cx = 100;
  const cy = 100;
  let cumulativeAngle = -90;

  const slices = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    return (
      <path
        key={d.label}
        d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`}
        fill={d.color}
        stroke="white"
        strokeWidth="2"
        className="transition-opacity hover:opacity-80"
      >
        <title>{d.label}: {d.value} ({((d.value / total) * 100).toFixed(1)}%)</title>
      </path>
    );
  });

  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      {slices}
      <circle cx={cx} cy={cy} r="45" fill="white" className="dark:fill-slate-800" />
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-800 dark:fill-white text-lg font-bold" fontSize="22">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-500" fontSize="10">ทั้งหมด</text>
    </svg>
  );
}

function BarChartSVG({ data, color = "#8b5cf6", maxVal }: { data: { label: string; value: number }[]; color?: string; maxVal?: number }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.max(20, Math.min(50, 600 / data.length - 8));

  return (
    <svg viewBox={`0 0 ${data.length * (barWidth + 8) + 40} 200`} className="w-full h-48" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = (d.value / max) * 150;
        const x = i * (barWidth + 8) + 30;
        return (
          <g key={i}>
            <rect
              x={x}
              y={180 - barH}
              width={barWidth}
              height={barH}
              fill={color}
              rx="4"
              className="transition-all hover:opacity-75"
            >
              <title>{d.label}: {d.value}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={195}
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400"
              fontSize="8"
            >
              {d.label}
            </text>
            {d.value > 0 && (
              <text
                x={x + barWidth / 2}
                y={175 - barH}
                textAnchor="middle"
                className="fill-slate-700 dark:fill-slate-300"
                fontSize="9"
                fontWeight="bold"
              >
                {d.value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LineTrendSVG({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 500;
  const h = 160;
  const padX = 40;
  const padY = 20;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1 || 1)) * chartW,
    y: padY + chartH - (d.value / max) * chartH
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + chartH} L${points[0].x},${padY + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#8b5cf6" stroke="white" strokeWidth="2" />
          <text x={p.x} y={padY + chartH + 15} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" fontSize="9">
            {data[i].label}
          </text>
          <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-slate-700 dark:fill-slate-300" fontSize="9" fontWeight="bold">
            {data[i].value}
          </text>
        </g>
      ))}
    </svg>
  );
}

// --- Status helpers ---
const STATUS_LABELS: Record<string, string> = {
  PRESENT: "ปกติ",
  LATE: "สาย",
  LEAVE: "ลา",
  EARLY_OUT: "ออกก่อน",
  ABSENT: "ขาด",
};

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  LEAVE: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  EARLY_OUT: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  ABSENT: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
};

// --- Main Page ---
export default function AttendanceStatsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"today" | "individual" | "school" | "official-duty">("today");
  
  // States for Official Duty
  const [officialDutyList, setOfficialDutyList] = useState<any[]>([]);
  const [odUserId, setOdUserId] = useState("");
  const [odDateInput, setOdDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingOd, setIsSavingOd] = useState(false);
  const [isLoadingOd, setIsLoadingOd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // States for Today view
  const [todayStats, setTodayStats] = useState<any>(null);

  // States for Individual view
  const [userList, setUserList] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [periodType, setPeriodType] = useState<"monthly" | "round1" | "round2" | "fiscal">("monthly");
  const [periodValue, setPeriodValue] = useState<string>("");
  const [individualData, setIndividualData] = useState<any[]>([]);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  // States for School view
  const [schoolAnalytics, setSchoolAnalytics] = useState<any>(null);

  // Initialize current month for periodValue
  useEffect(() => {
    const now = new Date();
    setPeriodValue(`${now.getFullYear()}-${now.getMonth() + 1}`);
  }, []);

  // Load official duties when activeTab is "official-duty"
  useEffect(() => {
    if (activeTab === "official-duty") {
      setIsLoadingOd(true);
      getOfficialDutyRecords()
        .then((res) => {
          if (res.success && res.data) {
            setOfficialDutyList(res.data);
          } else {
            showToast("error", "โหลดข้อมูลไปราชการล้มเหลว");
          }
        })
        .catch(() => showToast("error", "โหลดข้อมูลไปราชการล้มเหลว"))
        .finally(() => setIsLoadingOd(false));
    }
  }, [activeTab]);

  const handleSaveOfficialDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!odUserId || !odDateInput) {
      showToast("error", "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setIsSavingOd(true);
    try {
      const res = await recordOfficialDuty({ userId: odUserId, dateStr: odDateInput });
      if (res.success) {
        showToast("success", "บันทึกข้อมูลการไปราชการสำเร็จ");
        const listRes = await getOfficialDutyRecords();
        if (listRes.success && listRes.data) {
          setOfficialDutyList(listRes.data);
        }
      }
    } catch (err: any) {
      showToast("error", err.message || "บันทึกล้มเหลว");
    } finally {
      setIsSavingOd(false);
    }
  };

  const handleDeleteOfficialDuty = async (id: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกสถานะไปราชการของคนนี้?")) return;
    try {
      const res = await removeOfficialDuty(id);
      if (res.success) {
        showToast("success", "ยกเลิกข้อมูลสำเร็จ");
        const listRes = await getOfficialDutyRecords();
        if (listRes.success && listRes.data) {
          setOfficialDutyList(listRes.data);
        }
      }
    } catch (err: any) {
      showToast("error", err.message || "ยกเลิกล้มเหลว");
    }
  };

  // Load basic configurations and user list
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTodayAttendanceStats(),
      getSimpleUsersList(),
      getSchoolAttendanceAnalytics()
    ]).then(([today, users, school]) => {
      setTodayStats(today);
      setUserList(users);
      if (users.length > 0) setSelectedUserId(users[0].id);
      setSchoolAnalytics(school);
      setLoading(false);
    }).catch(() => {
      showToast("error", "โหลดข้อมูลสถิติล้มเหลว");
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch individual details when parameters change
  useEffect(() => {
    if (!selectedUserId || !periodValue) return;
    setIsSearchingUser(true);
    getIndividualAttendanceStats(selectedUserId, periodType, periodValue)
      .then((data) => {
        setIndividualData(data);
        setIsSearchingUser(false);
      })
      .catch(() => {
        showToast("error", "ไม่สามารถดึงข้อมูลของพนักงานท่านนี้ได้");
        setIsSearchingUser(false);
      });
  }, [selectedUserId, periodType, periodValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [today, school] = await Promise.all([
        getTodayAttendanceStats(),
        getSchoolAttendanceAnalytics()
      ]);
      setTodayStats(today);
      setSchoolAnalytics(school);
      showToast("success", "รีเฟรชข้อมูลสำเร็จ");
    } catch {
      showToast("error", "รีเฟรชล้มเหลว");
    }
    setRefreshing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Compute individual summary
  const individualSummary = {
    present: individualData.filter(d => d.status === "PRESENT").length,
    late: individualData.filter(d => d.status === "LATE").length,
    leave: individualData.filter(d => d.status === "LEAVE").length,
    absent: individualData.filter(d => d.status === "ABSENT" || d.status === "EARLY_OUT").length,
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-purple-600" />
        </motion.div>
        <p className="text-sm text-slate-500 animate-pulse">กำลังโหลดข้อมูลสถิติ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 print:p-0 print:max-w-none">
      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          header, aside, footer, nav, .no-print { display: none !important; }
          .print-container { width: 100% !important; margin: 0 !important; padding: 10mm !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
          main { padding: 0 !important; margin: 0 !important; }
          @page { size: A4 portrait; margin: 10mm; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap no-print">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            สถิติการลงเวลา
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-[52px]">
            แดชบอร์ดสรุปสถิติ ค้นหารายบุคคล วิเคราะห์วินัยองค์กร
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>

          {/* View Switcher Dropdown */}
          <div className="relative">
            <select 
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="h-11 pl-4 pr-10 rounded-xl border border-purple-200 dark:border-purple-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 text-sm font-bold text-purple-800 dark:text-purple-200 focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
            >
              <option value="today">📊 แดชบอร์ดสรุปยอดวันนี้</option>
              <option value="individual">🖨️ สถิติรายบุคคล / พิมพ์</option>
              <option value="school">📈 ภาพรวมวิเคราะห์</option>
              <option value="official-duty">✈️ จัดการการไปราชการ</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ===== View 1: Today Dashboard ===== */}
        {activeTab === "today" && todayStats && (
          <motion.div
            key="today"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 no-print"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "ทั้งหมด", count: todayStats.summary.total, icon: Users, gradient: "from-slate-500 to-slate-600", bg: "bg-slate-50 dark:bg-slate-800/60 border-slate-200" },
                { label: "มาแล้ว", count: todayStats.summary.present, icon: Clock, gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200" },
                { label: "มาสาย", count: todayStats.summary.late, icon: AlertTriangle, gradient: "from-amber-500 to-orange-600", bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200" },
                { label: "ลาหยุด", count: todayStats.summary.leave, icon: BarChart3, gradient: "from-blue-500 to-indigo-600", bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200" },
                { label: "ยังไม่ลงเวลา", count: todayStats.summary.pending, icon: Users, gradient: "from-rose-500 to-pink-600", bg: "bg-rose-50 dark:bg-rose-500/10 border-rose-200" },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative p-5 rounded-2xl border ${card.bg} dark:border-slate-700/50 overflow-hidden group`}
                >
                  <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${card.gradient} opacity-10 rounded-bl-3xl group-hover:opacity-20 transition-opacity`} />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{card.label}</p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{card.count}</p>
                  <p className="text-xs text-slate-400 mt-0.5">คน</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SVG Pie Chart */}
              <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <h3 className="text-md font-bold mb-6 text-slate-900 dark:text-white">สัดส่วนลงเวลาของวันนี้</h3>
                <div className="flex flex-col items-center">
                  <PieChart 
                    data={[
                      { label: "มาปกติ", value: todayStats.summary.present, color: "#10b981" },
                      { label: "มาสาย", value: todayStats.summary.late, color: "#f59e0b" },
                      { label: "ลาหยุด", value: todayStats.summary.leave, color: "#3b82f6" },
                      { label: "ยังไม่ลงเวลา", value: todayStats.summary.pending, color: "#e2e8f0" },
                    ]}
                    size={220}
                  />
                  <div className="flex flex-wrap gap-4 mt-6 text-xs font-semibold justify-center">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow" />ปกติ ({todayStats.summary.total > 0 ? ((todayStats.summary.present / todayStats.summary.total) * 100).toFixed(0) : 0}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 shadow" />สาย ({todayStats.summary.total > 0 ? ((todayStats.summary.late / todayStats.summary.total) * 100).toFixed(0) : 0}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 shadow" />ลา ({todayStats.summary.total > 0 ? ((todayStats.summary.leave / todayStats.summary.total) * 100).toFixed(0) : 0}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200 shadow" />ยังไม่ลง ({todayStats.summary.total > 0 ? ((todayStats.summary.pending / todayStats.summary.total) * 100).toFixed(0) : 0}%)</span>
                  </div>
                </div>
              </div>

              {/* Late & Pending Lists */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                  <h3 className="text-md font-bold text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    ผู้มาสายวันนี้ ({todayStats.lateList.length} คน)
                  </h3>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {todayStats.lateList.map((u: any) => (
                      <div key={u.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border border-slate-100 dark:border-slate-700/30">
                        <div>
                          <span className="font-bold block text-slate-800 dark:text-white">{u.name}</span>
                          <span className="text-xs text-slate-500">{u.subjectGroup}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">สาย {u.checkIn} น.</span>
                      </div>
                    ))}
                    {todayStats.lateList.length === 0 && <p className="text-sm text-slate-500 text-center py-6">ไม่มีประวัติเข้าสายวันนี้ 🎉</p>}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                  <h3 className="text-md font-bold text-rose-600 dark:text-rose-400 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    ยังไม่ลงเวลา ({todayStats.pendingList.length} คน)
                  </h3>
                  <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                    {todayStats.pendingList.map((u: any) => (
                      <div key={u.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border border-slate-100 dark:border-slate-700/30">
                        <div>
                          <span className="font-bold block text-slate-800 dark:text-white">{u.name}</span>
                          <span className="text-xs text-slate-500">{u.subjectGroup}</span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{u.position}</span>
                      </div>
                    ))}
                    {todayStats.pendingList.length === 0 && <p className="text-sm text-slate-500 text-center py-4">ทุกคนลงเวลาครบแล้ว ✅</p>}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== View 2: Individual Calendar with Print design ===== */}
        {activeTab === "individual" && (
          <motion.div
            key="individual"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 print-container"
          >
            {/* Filter Panel */}
            <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm no-print">
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <div className="flex gap-3 flex-wrap">
                  <select 
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20 min-w-[200px]"
                  >
                    {userList.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.position || "ครู"})</option>
                    ))}
                  </select>

                  <select 
                    value={periodType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setPeriodType(newType);
                      // Set default period value
                      const now = new Date();
                      if (newType === "monthly") {
                        setPeriodValue(`${now.getFullYear()}-${now.getMonth() + 1}`);
                      } else {
                        setPeriodValue(String(now.getFullYear()));
                      }
                    }}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="monthly">รายเดือน</option>
                    <option value="round1">รอบประเมินที่ 1 (ต.ค. - มี.ค.)</option>
                    <option value="round2">รอบประเมินที่ 2 (เม.ย. - ก.ย.)</option>
                    <option value="fiscal">ปีงบประมาณ</option>
                  </select>

                  {periodType === "monthly" && (
                    <input
                      type="month"
                      value={periodValue ? `${periodValue.split("-")[0]}-${String(periodValue.split("-")[1]).padStart(2, "0")}` : ""}
                      onChange={(e) => {
                        const [y, m] = e.target.value.split("-");
                        setPeriodValue(`${y}-${parseInt(m)}`);
                      }}
                      className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20"
                    />
                  )}

                  {periodType !== "monthly" && (
                    <select
                      value={periodValue}
                      onChange={(e) => setPeriodValue(e.target.value)}
                      className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/20"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <option key={y} value={y}>ปี พ.ศ. {y + 543}</option>
                      ))}
                    </select>
                  )}
                </div>

                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  พิมพ์ A4
                </button>
              </div>
            </div>

            {/* Loading overlay for individual data */}
            {isSearchingUser && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            )}

            {!isSearchingUser && (
              <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6 print:rounded-none print:border-none print:shadow-none">
                {/* Print Header */}
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">รายงานสรุปเวลาการทำงานและการเข้าเวร</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    ของ: <span className="font-bold">{userList.find(u => u.id === selectedUserId)?.name || "-"}</span> | ตำแหน่ง: {userList.find(u => u.id === selectedUserId)?.position || "ครู"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {periodType === "monthly" ? "รายเดือน" : periodType === "round1" ? "รอบการประเมินที่ 1 (ต.ค. - มี.ค.)" : periodType === "round2" ? "รอบการประเมินที่ 2 (เม.ย. - ก.ย.)" : "รายปีงบประมาณ"}
                    {periodValue && ` - ${periodType === "monthly" ? new Date(Number(periodValue.split("-")[0]), Number(periodValue.split("-")[1]) - 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" }) : `พ.ศ. ${Number(periodValue) + 543}`}`}
                  </p>
                </div>

                {/* Summary mini cards */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: "มาปกติ", count: individualSummary.present, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200" },
                    { label: "สาย", count: individualSummary.late, color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200" },
                    { label: "ลา", count: individualSummary.leave, color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200" },
                    { label: "ขาด/ออกก่อน", count: individualSummary.absent, color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-200" },
                  ].map((s, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${s.color} dark:border-slate-700/50`}>
                      <p className="text-2xl font-extrabold">{s.count}</p>
                      <p className="text-xs font-bold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Attendance Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden print:rounded-none">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <th className="p-3 pl-4">ลำดับ</th>
                        <th className="p-3">วันที่</th>
                        <th className="p-3">เวลาเข้า</th>
                        <th className="p-3">เวลาออก</th>
                        <th className="p-3">สถานะ</th>
                        <th className="p-3">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {individualData.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 print:hover:bg-transparent">
                          <td className="p-3 pl-4 text-slate-500 font-mono text-xs">{idx + 1}</td>
                          <td className="p-3 font-medium">{new Date(row.attendanceDate).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</td>
                          <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400">{row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "-"}</td>
                          <td className="p-3 font-mono text-blue-700 dark:text-blue-400">{row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "-"}</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[row.status] || "bg-slate-100 text-slate-600"}`}>
                              {STATUS_LABELS[row.status] || row.status}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-500">-</td>
                        </tr>
                      ))}
                      {individualData.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">ไม่มีข้อมูลการลงเวลาในช่วงนี้</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Total row */}
                {individualData.length > 0 && (
                  <div className="text-right text-xs text-slate-500 font-medium">
                    รวมทั้งสิ้น {individualData.length} วัน | มาปกติ {individualSummary.present} วัน | สาย {individualSummary.late} วัน | ลา {individualSummary.leave} วัน
                  </div>
                )}

                {/* Print Signature Footer */}
                <div className="hidden print:grid grid-cols-2 gap-12 pt-16 text-center text-xs">
                  <div className="space-y-12">
                    <p>ลงชื่อ.............................................................. ผู้ขอรับการประเมิน<br/>( {userList.find(u => u.id === selectedUserId)?.name || "-"} )</p>
                  </div>
                  <div className="space-y-12">
                    <p>ลงชื่อ.............................................................. ผู้รับรองสถิติข้อมูล<br/>( รักษาการแทนในตำแหน่งผู้อำนวยการโรงเรียน )</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ===== View 3: School Analytics ===== */}
        {activeTab === "school" && schoolAnalytics && (
          <motion.div
            key="school"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 no-print"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Department stats */}
              <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                <h3 className="text-md font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-amber-600" />
                  </div>
                  อัตราการมาสายแยกตามกลุ่มสาระ
                </h3>
                {schoolAnalytics.deptLates.length > 0 ? (
                  <div className="space-y-3">
                    {schoolAnalytics.deptLates
                      .sort((a: any, b: any) => b.count - a.count)
                      .map((item: any, idx: number) => {
                        const maxCount = Math.max(...schoolAnalytics.deptLates.map((d: any) => d.count), 1);
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                              <span className="text-amber-600">{item.count} ครั้ง</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.count / maxCount) * 100}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.1 }}
                                className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">ไม่มีข้อมูลการมาสาย</p>
                )}
              </div>

              {/* Scanner Peak Hours */}
              <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                <h3 className="text-md font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  ช่วงเวลาลงสแกน (Peak Hours)
                </h3>
                <BarChartSVG 
                  data={schoolAnalytics.peakHours.map((item: any) => ({ label: item.hour.replace(":00", ""), value: item.count }))}
                  color="#8b5cf6"
                />
              </div>
            </div>

            {/* Monthly Late Trend */}
            <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
              <h3 className="text-md font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                แนวโน้มการมาสายรายเดือน (6 เดือนล่าสุด)
              </h3>
              <LineTrendSVG 
                data={schoolAnalytics.latesTrend.map((item: any) => ({ label: item.month, value: item.count }))}
              />
            </div>
          </motion.div>
        )}

        {/* ===== View 4: Official Duty Management ===== */}
        {activeTab === "official-duty" && (
          <motion.div
            key="official-duty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Card */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-150 dark:border-gray-800 h-fit">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ✈️ บันทึกการไปราชการ
                </h3>
                <form onSubmit={handleSaveOfficialDuty} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      เลือกบุคลากร *
                    </label>
                    <select
                      value={odUserId}
                      onChange={(e) => setOdUserId(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-gray-900 dark:text-white"
                    >
                      <option value="">-- กรุณาเลือกบุคลากร --</option>
                      {userList.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.position || "ครู"})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      วันที่ไปราชการ *
                    </label>
                    <input
                      type="date"
                      required
                      value={odDateInput}
                      onChange={(e) => setOdDateInput(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-gray-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingOd}
                    className="w-full h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-md shadow-purple-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingOd && <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                    บันทึกข้อมูลไปราชการ
                  </button>
                </form>
              </div>

              {/* List Table Card */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-150 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                  📋 รายการที่บันทึกแล้ว
                </h3>
                {isLoadingOd ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                  </div>
                ) : officialDutyList.length === 0 ? (
                  <p className="text-center py-12 text-xs text-gray-400 font-medium border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                    ไม่มีข้อมูลบันทึกการไปราชการ
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                          <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">ตำแหน่ง</th>
                          <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">วันที่ปฏิบัติงาน</th>
                          <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right font-sans">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-850">
                        {officialDutyList.map((h) => {
                          const date = new Date(h.attendanceDate);
                          const formattedDate = date.toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          });
                          return (
                            <tr key={h.id} className="hover:bg-slate-55 dark:hover:bg-slate-800/10 transition-colors">
                              <td className="py-3 text-xs font-semibold text-gray-900 dark:text-white">{h.user?.name}</td>
                              <td className="py-3 text-xs text-gray-500 dark:text-gray-400">{h.user?.position || "ครู"}</td>
                              <td className="py-3 text-xs text-gray-900 dark:text-white font-medium">{formattedDate}</td>
                              <td className="py-3 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOfficialDuty(h.id)}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-lg transition-colors"
                                >
                                  ยกเลิก
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
