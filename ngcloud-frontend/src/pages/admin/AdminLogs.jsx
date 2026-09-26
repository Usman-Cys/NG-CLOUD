import { useEffect, useState, useMemo } from "react";
import { adminApi } from "../../api/adminApi";
import Loader from "../../components/common/Loader";
import StatusBadge from "../../components/common/StatusBadge";
import { RefreshCw, Search } from "lucide-react";

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadLogs(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await adminApi.getLogs();
      setLogs(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLogs();

    const interval = setInterval(() => {
      loadLogs(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const filteredLogs = useMemo(() => {
    return (logs || []).filter(l => {
      const matchesSearch = 
        l.username?.toLowerCase().includes(q.toLowerCase()) ||
        l.action?.toLowerCase().includes(q.toLowerCase()) ||
        (l.ipAddress && l.ipAddress.includes(q));
      
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [logs, q, statusFilter]);

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display text-white">Activity Logs</h1>
          <p className="text-slate-400 text-sm mt-1">
            System audit trail for auth, upload, download, sharing, and policy events.
          </p>
        </div>
        <button
          onClick={() => loadLogs(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            className="input pl-10 bg-slate-900/40 border-white/5 text-slate-200 text-sm py-2 rounded-xl w-full focus:outline-none focus:border-cyan-500/30"
            placeholder="Search by action, user, or IP…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <select
          className="bg-slate-900 border border-white/5 text-slate-300 text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-cyan-500/30"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="success">Success / OK</option>
          <option value="failed">Failed / Denied</option>
        </select>
      </div>

      <div className="glass overflow-hidden rounded-2xl border border-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-violet-500/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {new Date(l.createdAt || l.time).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">{l.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">{l.action}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={l.status === "success" || l.status === "ok" ? "ok" : "disabled"} label={l.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.ipAddress || "-"}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No activity logs recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
