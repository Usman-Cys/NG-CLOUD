import GlassCard from '../common/GlassCard'
import { formatBytes } from '../../utils/formatBytes'

export default function StorageStats({ used = 0, quota = 500 * 1024 * 1024 }) {
  const remaining = Math.max(0, quota - used)
  const pct = Math.min(100, Math.round((used / quota) * 100))

  return (
    <GlassCard hover={false} className="border-cyan-500/10">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-400">Storage Usage</h3>
      <div className="mt-4 flex items-baseline justify-between text-white">
        <span className="text-2xl font-bold font-display">
          {formatBytes(used)} <span className="text-xs text-slate-400 font-normal">/ {formatBytes(quota)} used</span>
        </span>
        <span className="text-xs text-emerald-400 font-semibold">{formatBytes(remaining)} remaining</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 shadow-glow-cyan transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[10px] text-slate-500 font-mono tracking-wider uppercase">{pct}% OF ENCRYPTED CAPACITY USED</p>
    </GlassCard>
  )
}
