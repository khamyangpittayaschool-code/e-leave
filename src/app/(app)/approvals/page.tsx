import { getPendingApprovals, updateLeaveStatus } from "@/app/actions/leave";

export default async function ApprovalsPage() {
  const pendingRequests = await getPendingApprovals();

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Pending Approvals</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-zinc-500 dark:text-zinc-400">
          <thead className="text-xs text-zinc-700 uppercase bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3">Teacher</th>
              <th scope="col" className="px-6 py-3">Type</th>
              <th scope="col" className="px-6 py-3">Dates</th>
              <th scope="col" className="px-6 py-3">Reason</th>
              <th scope="col" className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">No pending requests found.</td>
              </tr>
            ) : pendingRequests.map((item) => (
              <tr key={item.id} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800">
                <td className="px-6 py-4 font-medium text-zinc-900 whitespace-nowrap dark:text-zinc-50">{item.user?.name || item.user?.email || "Unknown"}</td>
                <td className="px-6 py-4">{item.type}</td>
                <td className="px-6 py-4">{item.startDate.toLocaleDateString()} - {item.endDate.toLocaleDateString()}</td>
                <td className="px-6 py-4">{item.reason}</td>
                <td className="px-6 py-4 flex gap-2">
                  <form action={async () => { "use server"; await updateLeaveStatus(item.id, "APPROVED"); }}>
                    <button type="submit" className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium cursor-pointer">Approve</button>
                  </form>
                  <form action={async () => { "use server"; await updateLeaveStatus(item.id, "REJECTED"); }}>
                    <button type="submit" className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium cursor-pointer">Reject</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
