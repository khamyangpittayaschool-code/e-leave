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
  gradient = "bg-indigo-500",
  subtext,
  delay = 0,
  onClick,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${
        onClick ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all" : ""
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${gradient} bg-opacity-15 text-slate-900 dark:text-white`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {subtext && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtext}</p>}
    </motion.div>
  );
}
