import StatusBadge from '../common/StatusBadge'
import { formatBytes } from '../../utils/formatBytes'
import { formatDate } from '../../utils/formatDate'
import { Eye, Trash2 } from 'lucide-react'

export default function AdminFilesTable({ rows, onViewMetadata, onDeleteFile }) {
  return (
    <div className="glass overflow-hidden rounded-2xl border border-white/5">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Shares</th>
              <th className="px-4 py-3">Wrapped Keys</th>
              <th className="px-4 py-3">Plaintext</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {rows.map(f => (
              <tr key={f.id} className="hover:bg-violet-500/5 transition-colors">
                <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate" title={f.filename}>
                  {f.filename}
                </td>
                <td className="px-4 py-3 text-slate-300 font-semibold">{f.ownerUsername}</td>
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{f.sizeMb} MB</td>
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{f.extension || 'unknown'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={f.status === 'deleted' ? 'disabled' : 'encrypted'} label={f.status} />
                </td>
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{f.shareCount}</td>
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{f.wrappedKeyCount}</td>
                <td className="px-4 py-3 text-emerald-400 font-semibold uppercase tracking-wider">Blocked</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onViewMetadata(f)}
                      className="rounded-lg p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                      title="View File Metadata"
                    >
                      <Eye className="h-4 w-4"/>
                    </button>
                    <button
                      onClick={() => onDeleteFile(f.id, f.filename)}
                      className="rounded-lg p-2 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                      title="Delete File"
                    >
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No files registered in system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
