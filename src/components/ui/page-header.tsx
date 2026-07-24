"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  description: string;
  badge?: string;
  icon?: LucideIcon;
  gradient?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  badge,
  icon: Icon,
  gradient = "from-indigo-600 to-purple-600",
  action,
}: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
      {/* Background ambient glow */}
      <div className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-3xl pointer-events-none`} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0 mt-0.5`}>
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div>
            {badge && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 mb-2">
                {badge}
              </span>
            )}
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
