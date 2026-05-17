import { getMyLeaveHistory } from "@/app/actions/leave";

export default async function HistoryPage() {
  const history = await getMyLeaveHistory();

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Leave History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-zinc-500 dark:text-zinc-400">
          <thead className="text-xs text-zinc-700 uppercase bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3">Type</th>
              <th scope="col" className="px-6 py-3">Dates</th>
              <th scope="col" className="px-6 py-3">Reason</th>
              <th scope="col" className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center">No leave requests found.</td>
              </tr>
            ) : history.map((item) => (
              <tr key={item.id} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800">
                <td className="px-6 py-4 font-medium text-zinc-900 whitespace-nowrap dark:text-zinc-50">{item.type}</td>
                <td className="px-6 py-4">{item.startDate.toLocaleDateString()} - {item.endDate.toLocaleDateString()}</td>
                <td className="px-6 py-4">{item.reason}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
