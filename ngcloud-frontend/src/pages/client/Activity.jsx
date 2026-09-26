import { useEffect, useState } from 'react'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import Loader from '../../components/common/Loader'
import { 
  LogOut, 
  UploadCloud, 
  Download, 
  Trash2, 
  Share2, 
  RefreshCw, 
  Lock, 
  Unlock, 
  User, 
  Clock, 
  Eye, 
  CheckCircle, 
  XCircle, 
  UserMinus 
} from 'lucide-react'
import { filesApi } from '../../api/filesApi'
import { toast } from 'sonner'
import { formatDate } from '../../utils/formatDate'

const ACTION_CONFIGS = {
  LOGIN: { icon: User, color: 'cyan', label: 'Login' },
  LOGOUT: { icon: LogOut, color: 'slate', label: 'Logout' },
  FILE_UPLOAD: { icon: UploadCloud, color: 'violet', label: 'Upload' },
  FILE_DOWNLOAD: { icon: Download, color: 'emerald', label: 'Download' },
  FILE_SHARE: { icon: Share2, color: 'amber', label: 'Share' },
  FILE_UNSHARE: { icon: UserMinus, color: 'rose', label: 'Unshare' },
  FILE_UPDATE: { icon: RefreshCw, color: 'sky', label: 'Update' },
  FILE_DELETE: { icon: Trash2, color: 'rose', label: 'Delete' },
  LOCK_ACQUIRED: { icon: Lock, color: 'indigo', label: 'Lock Acquired' },
  LOCK_RELEASED: { icon: Unlock, color: 'emerald', label: 'Lock Released' },
  LOCK_EXPIRED: { icon: Clock, color: 'amber', label: 'Lock Expired' },
  FILE_REVIEWED: { icon: Eye, color: 'sky', label: 'Reviewed' },
  FILE_APPROVED: { icon: CheckCircle, color: 'emerald', label: 'Approved' },
  FILE_REJECTED: { icon: XCircle, color: 'rose', label: 'Rejected' }
};

const getActionConfig = (action) => {
  const upper = String(action).toUpperCase();
  if (ACTION_CONFIGS[upper]) return ACTION_CONFIGS[upper];
  if (upper.includes('UPLOAD')) return { icon: UploadCloud, color: 'violet', label: 'Upload' };
  if (upper.includes('LOCK')) return { icon: Lock, color: 'indigo', label: 'Lock' };
  if (upper.includes('SHARE')) return { icon: Share2, color: 'amber', label: 'Share' };
  return { icon: Eye, color: 'slate', label: action };
};

function getRelativeTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffSec < 10) {
    return 'Just now'
  } else if (diffSec < 60) {
    return `${diffSec} seconds ago`
  } else if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`
  } else if (diffHrs < 24) {
    return `${diffHrs} ${diffHrs === 1 ? 'hour' : 'hours'} ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else {
    return `${diffDays} days ago`
  }
}

export default function Activity() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadActivities = async () => {
    setLoading(true)
    try {
      const params = { limit: 50, page }
      if (filterAction) {
        params.action = filterAction
      }
      const { data } = await filesApi.getActivity(params)
      setActivities(data.activities || [])
      if (data.pagination) {
        setTotalPages(data.pagination.pages || 1)
      }
    } catch (err) {
      console.error('Failed to load activities:', err)
      toast.error('Could not load activity log.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActivities()
  }, [page, filterAction])

  const handleFilterChange = (action) => {
    setFilterAction(action)
    setPage(1)
  }

  return (
    <GlassCard hover={false}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-white">Activity Timeline</h2>
          <p className="text-sm text-slate-400">User-level audit trail.</p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterChange('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filterAction === ''
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('FILE_UPLOAD')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filterAction === 'FILE_UPLOAD'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-white'
            }`}
          >
            Uploads
          </button>
          <button
            onClick={() => handleFilterChange('FILE_SHARE')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filterAction === 'FILE_SHARE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-white'
            }`}
          >
            Shares
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12">
          <Loader />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No activities logged yet.</p>
        </div>
      ) : (
        <>
          <ol className="mt-8 relative border-l border-white/10 ml-4">
            {activities.map((it) => {
              const cfg = getActionConfig(it.action)
              const Icon = cfg.icon
              const filename = it.metadata?.filename || '—'
              const statusText = it.metadata?.status || 'success'

              // Color mapping for tailwind ring/background classes
              const colorMap = {
                cyan: 'bg-cyan-500/20 text-cyan-300 shadow-glow-cyan',
                slate: 'bg-slate-500/20 text-slate-300',
                violet: 'bg-violet-500/20 text-violet-300',
                emerald: 'bg-emerald-500/20 text-emerald-300',
                amber: 'bg-amber-500/20 text-amber-300',
                rose: 'bg-rose-500/20 text-rose-300',
                sky: 'bg-sky-500/20 text-sky-300',
                indigo: 'bg-indigo-500/20 text-indigo-300'
              }
              const colorClasses = colorMap[cfg.color] || 'bg-slate-500/20 text-slate-300'

              return (
                <li key={it.id} className="mb-6 ml-6">
                  <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-bg ${colorClasses}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <div>
                      <p className="text-white font-medium">
                        {it.description}
                        {filename !== '—' && (
                          <span className="ml-1.5 text-xs text-cyan-300 font-mono bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/20">
                            {filename}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wide font-semibold">
                        Action: {cfg.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge 
                        status={statusText === 'failed' ? 'denied' : 'active'} 
                        label={statusText === 'failed' ? 'Failed' : 'Success'}
                      />
                      <span className="text-xs text-slate-400 whitespace-nowrap" title={formatDate(it.createdAt)}>
                        {getRelativeTime(it.createdAt)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded bg-slate-800 text-xs font-semibold text-slate-300 border border-white/5 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 transition"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded bg-slate-800 text-xs font-semibold text-slate-300 border border-white/5 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </GlassCard>
  )
}
