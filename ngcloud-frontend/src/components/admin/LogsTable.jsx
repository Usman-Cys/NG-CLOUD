import StatusBadge from '../common/StatusBadge'
import { formatDate } from '../../utils/formatDate'

export default function LogsTable({ rows }) {
  return (
    <div className="glass overflow-hidden font-mono text-[12px]">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-900/70 text-left uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3 hidden md:table-cell">IP</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden lg:table-cell">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-cyan-500/5">
                <td className="px-4 py-2.5 text-slate-300">{formatDate(r.time)}</td>
                <td className="px-4 py-2.5 text-cyan-300">{r.user}</td>
                <td className="px-4 py-2.5 text-white">{r.action}</td>
                <td className="px-4 py-2.5 hidden md:table-cell text-slate-400">{r.ip}</td>
                <td className="px-4 py-2.5"><StatusBadge status={r.status === 'ok' ? 'ok' : 'denied'}/></td>
                <td className="px-4 py-2.5 hidden lg:table-cell text-slate-400 truncate max-w-[300px]" title={r.details ? JSON.stringify(r.details) : ''}>
                  {r.details ? (typeof r.details === 'object' ? JSON.stringify(r.details) : String(r.details)) : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No audit logs recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
