import GlassCard from '../common/GlassCard'
import { LogIn, UploadCloud, Download, Trash2, Share2, ShieldAlert } from 'lucide-react'
import { timeAgo } from '../../utils/formatDate'

const iconMap = {
  LOGIN: LogIn, UPLOAD: UploadCloud, DOWNLOAD: Download, DELETE: Trash2,
  SHARE: Share2, BLOCKED: ShieldAlert,
}
const colorMap = {
  LOGIN: 'text-cyan-300 bg-cyan-500/10',
  UPLOAD: 'text-violet-300 bg-violet-500/10',
  DOWNLOAD: 'text-emerald-300 bg-emerald-500/10',
  DELETE: 'text-rose-300 bg-rose-500/10',
  SHARE: 'text-amber-300 bg-amber-500/10',
  BLOCKED: 'text-rose-300 bg-rose-500/10',
}

export default function RecentActivity({ items }) {
  return (
    <GlassCard>
      <h3 className="font-display text-lg text-white">Recent Activity</h3>
      <ul className="mt-4 space-y-2">
        {items.map((it, i) => {
          const Icon = iconMap[it.type] || LogIn
          return (
            <li key={i} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5 transition">
              <div className={`rounded-lg p-2 ${colorMap[it.type]}`}><Icon className="h-4 w-4"/></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{it.text}</p>
                <p className="text-[11px] text-slate-500">{timeAgo(it.time)}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </GlassCard>
  )
}
