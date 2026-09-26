import { Download, Eye, Share2, Trash2, Lock, Unlock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { formatBytes } from '../../utils/formatBytes'
import { formatDate } from '../../utils/formatDate'
import { getFileIcon } from '../../utils/fileHelpers'
import StatusBadge from '../common/StatusBadge'

export default function FileTable({ files, onDownload, onDelete, downloadingId }) {
  const navigate = useNavigate()

  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3 hidden md:table-cell">Size</th>
              <th className="px-4 py-3 hidden lg:table-cell">Chunks</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden md:table-cell">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {files.map(f => {
              const Icon = getFileIcon(f.filename || f.name)
              const fileId = f.fileId || f.id
              const isLocked = !!f.lock

              return (
                <tr key={fileId} className="group hover:bg-cyan-500/5 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300">
                        <Icon className="h-4 w-4"/>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white truncate max-w-[260px] font-medium">{f.filename || f.name}</p>
                        <p className="text-[11px] text-slate-500 truncate max-w-[260px] font-mono">{fileId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-300">{formatBytes(f.size || f.size_bytes || 0)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-300">{f.totalChunks ?? f.total_chunks ?? 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 w-fit">
                      <StatusBadge status="encrypted"/>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <Lock className="h-2.5 w-2.5" /> Locked by {f.lock.lockedBy}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <Unlock className="h-2.5 w-2.5" /> Available
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-300">{formatDate(f.createdAt || f.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link to={`/file/${fileId}`} className="rounded-lg p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10" title="Details">
                        <Eye className="h-4 w-4"/>
                      </Link>
                      
                      <button 
                        onClick={()=>onDownload?.(f)} 
                        disabled={downloadingId === fileId}
                        className="rounded-lg p-2 text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50" 
                        title="Download"
                      >
                        <Download className="h-4 w-4"/>
                      </button>
                      
                      <button 
                        onClick={() => navigate('/shared', { state: { shareFile: f } })}
                        className="rounded-lg p-2 text-slate-400 hover:text-violet-300 hover:bg-violet-500/10" 
                        title="Share"
                      >
                        <Share2 className="h-4 w-4"/>
                      </button>
                      
                      <button 
                        onClick={()=>onDelete?.(f)} 
                        className="rounded-lg p-2 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10" 
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4"/>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/5 px-4 py-2 text-[11px] text-slate-500 flex items-center gap-2">
        <Lock className="h-3 w-3 text-cyan-400"/> All vault objects are end-to-end encrypted locally in your browser.
      </div>
    </div>
  )
}
