"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  gradient?: string;
  subtext?: string;
  delay?: number;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  gradient = "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  subtext,
  delay = 0,
  onClick,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 md:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.03)] flex items-center justify-between ${
        onClick ? "cursor-pointer hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md transition-all" : ""
      }`}
    >
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</span>
          {subtext && <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{subtext}</span>}
        </div>
      </div>

      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${gradient}`}>
        <Icon className="w-6 h-6" />
      </div>
    </motion.div>
  );
}
