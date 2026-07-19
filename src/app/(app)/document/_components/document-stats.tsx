"use client";

import { motion } from "framer-motion";
import { FileText, Send, Clock, Megaphone, AlertCircle } from "lucide-react";

type StatsProps = {
  inboundTotal: number;
  outboundTotal: number;
  inboundPending: number;
  commandTotal: number;
  activeTab: "outbound" | "inbound";
  onCardClick: (key: "inbound" | "outbound" | "pending" | "command") => void;
};

export default function DocumentStats({
  inboundTotal,
  outboundTotal,
  inboundPending,
  commandTotal,
  activeTab,
  onCardClick,
}: StatsProps) {
  const cards = [
    {
      key: "inbound" as const,
      title: "หนังสือรับ",
      count: inboundTotal,
      desc: "รายการทั้งหมด",
      icon: FileText,
      color: "blue",
      gradient: "from-blue-500/10 to-indigo-500/10 dark:from-blue-950/20 dark:to-indigo-950/20",
      iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
      ringColor: "ring-blue-500/20",
      activeBorder: "border-blue-500"
    },
    {
      key: "outbound" as const,
      title: "หนังสือส่ง",
      count: outboundTotal,
      desc: "รายการทั้งหมด",
      icon: Send,
      color: "emerald",
      gradient: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/20 dark:to-teal-950/20",
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
      ringColor: "ring-emerald-500/20",
      activeBorder: "border-emerald-500"
    },
    {
      key: "pending" as const,
      title: "รอดำเนินการ",
      count: inboundPending,
      desc: "ต้องตรวจสอบ",
      icon: Clock,
      color: "amber",
      gradient: "from-amber-500/10 to-orange-500/10 dark:from-amber-950/20 dark:to-orange-950/20",
      iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
      ringColor: "ring-amber-500/20",
      activeBorder: "border-amber-500",
      warning: true
    },
    {
      key: "command" as const,
      title: "คำสั่ง/ประกาศ",
      count: commandTotal,
      desc: "ปีนี้",
      icon: Megaphone,
      color: "purple",
      gradient: "from-purple-500/10 to-pink-500/10 dark:from-purple-950/20 dark:to-pink-950/20",
      iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
      ringColor: "ring-purple-500/20",
      activeBorder: "border-purple-500"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = activeTab === c.key || (c.key === "pending" && activeTab === "inbound") || (c.key === "command" && activeTab === "outbound");

        return (
          <motion.div
            key={c.title}
            whileHover={{ y: -4 }}
            onClick={() => onCardClick(c.key)}
            className={`cursor-pointer rounded-2xl p-5 border bg-white dark:bg-slate-900 transition-all flex justify-between items-center relative overflow-hidden group shadow-sm ${
              isActive
                ? `${c.activeBorder} ring-2 ${c.ringColor}`
                : "border-slate-100 dark:border-slate-800/80 hover:border-slate-300"
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-40 group-hover:opacity-60 transition-opacity`} />
            
            <div className="relative z-10 space-y-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold block">{c.title}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-950 dark:text-white leading-none">{c.count}</span>
                <span className="text-[11px] text-slate-500 font-medium">รายการ</span>
              </div>
              
              <div className="flex items-center gap-1 mt-2">
                {c.warning ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                    <AlertCircle className="w-2.5 h-2.5" />
                    {c.desc}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">
                    {c.desc}
                  </span>
                )}
              </div>
            </div>

            <div className={`relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${c.iconBg}`}>
              <Icon className="w-6 h-6" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
