"use client";

import { useSession } from "@/lib/auth-client";

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Leaves</h3>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">12 Days</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pending Requests</h3>
          <p className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-500">2</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Remaining Quota</h3>
          <p className="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-500">18 Days</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Recent Activity</h3>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          No recent activity found.
        </div>
      </div>
    </div>
  );
}
