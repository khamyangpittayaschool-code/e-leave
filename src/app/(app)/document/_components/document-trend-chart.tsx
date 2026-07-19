"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { TrendingUp } from "lucide-react";

interface TrendData {
  month: string;
  memo: number;
  outgoing: number;
  command: number;
}

interface DocumentTrendChartProps {
  data: TrendData[];
}

export default function DocumentTrendChart({ data }: DocumentTrendChartProps) {
  const [chartMode, setChartMode] = useState<"type" | "total">("type");

  // Format data for total mode
  const chartData = data.map((d) => ({
    ...d,
    total: d.memo + d.outgoing + d.command
  }));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              แนวโน้มการออกเลขทะเบียนประจำเดือน
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">สถิติเปรียบเทียบการขอเลขในรอบปีงบประมาณ</p>
          </div>
        </div>

        {/* Chart Mode Toggle Pills */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setChartMode("type")}
            className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
              chartMode === "type"
                ? "bg-white dark:bg-slate-900 text-slate-850 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            แยกตามประเภท
          </button>
          <button
            onClick={() => setChartMode("total")}
            className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
              chartMode === "total"
                ? "bg-white dark:bg-slate-900 text-slate-850 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            ยอดรวม
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorMemo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCommand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800/40" vertical={false} />
            
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              stroke="#94a3b8"
            />
            <YAxis 
              tick={{ fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              stroke="#94a3b8"
            />
            
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                fontSize: "11px",
                fontFamily: "inherit"
              }}
              labelStyle={{ fontWeight: 800, color: "#1e293b", marginBottom: "4px" }}
            />
            
            <Legend 
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 10 }}
            />

            {chartMode === "type" ? (
              <>
                <Area
                  name="บันทึกข้อความ (MEMO)"
                  type="monotone"
                  dataKey="memo"
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorMemo)"
                  dot={{ r: 4, strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  name="หนังสือส่ง (OUTGOING)"
                  type="monotone"
                  dataKey="outgoing"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorOutgoing)"
                  dot={{ r: 4, strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  name="คำสั่ง / ประกาศ"
                  type="monotone"
                  dataKey="command"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCommand)"
                  dot={{ r: 4, strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
              </>
            ) : (
              <Area
                name="ยอดรวมการขอเลขทั้งหมด"
                type="monotone"
                dataKey="total"
                stroke="#4f46e5"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorTotal)"
                dot={{ r: 4, strokeWidth: 1 }}
                activeDot={{ r: 6 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
