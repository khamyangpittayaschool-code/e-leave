"use client";

import { useState } from "react";
import { submitLeaveRequest } from "@/app/actions/leave";
import { useRouter } from "next/navigation";

export default function RequestLeavePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      await submitLeaveRequest({
        type: formData.get("type") as string,
        startDate: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
        reason: formData.get("reason") as string,
      });
      alert("Request submitted successfully!");
      router.push("/history");
    } catch (error) {
      alert("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
      <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Submit Leave Request</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Leave Type</label>
          <select name="type" required className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
            <option value="">Select a leave type</option>
            <option value="SICK">Sick Leave (ลาป่วย)</option>
            <option value="PERSONAL">Personal Leave (ลากิจ)</option>
            <option value="VACATION">Vacation (ลาพักผ่อน)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Start Date</label>
            <input name="startDate" type="date" required className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">End Date</label>
            <input name="endDate" type="date" required className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Reason</label>
          <textarea name="reason" required rows={4} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50" placeholder="Please provide a detailed reason..." />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Attachment (Optional)</label>
          <input type="file" className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300 dark:hover:file:bg-zinc-700" />
        </div>

        <button type="submit" disabled={loading} className="w-full h-10 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90">
          {loading ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
