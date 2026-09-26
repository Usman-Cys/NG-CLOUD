import StatusBadge from '../common/StatusBadge'
import { formatBytes } from '../../utils/formatBytes'
import { formatDate } from '../../utils/formatDate'
import { Eye, UserX, Trash2 } from 'lucide-react'

export default function UsersTable({ rows, onViewMetadata, onDisable, onDelete }) {
  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3 hidden md:table-cell">User ID</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 hidden lg:table-cell">Files</th>
              <th className="px-4 py-3 hidden lg:table-cell">Storage</th>
              <th className="px-4 py-3 hidden md:table-cell">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(u => (
              <tr key={u.id} className="hover:bg-violet-500/5">
                <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-slate-400">{u.id}</td>
                <td className="px-4 py-3"><StatusBadge status={u.role}/></td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-300">{u.filesCount}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-300">{formatBytes(u.storageUsed)}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-300">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3"><StatusBadge status={u.status === 'active' ? 'active' : 'disabled'}/></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onViewMetadata(u)}
                      className="rounded-lg p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                      title="View User Metadata"
                    >
                      <Eye className="h-4 w-4"/>
                    </button>
                    <button
                      onClick={() => onDisable(u.id, u.username)}
                      disabled={u.status === 'disabled'}
                      className="rounded-lg p-2 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Deactivate Account"
                    >
                      <UserX className="h-4 w-4"/>
                    </button>
                    <button
                      onClick={() => onDelete(u.id, u.username)}
                      className="rounded-lg p-2 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                      title="Soft Delete Profile"
                    >
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No users found matching filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
