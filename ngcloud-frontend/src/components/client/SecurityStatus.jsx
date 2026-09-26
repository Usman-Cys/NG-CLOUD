import GlassCard from '../common/GlassCard'
import { ShieldCheck, Lock, Server, KeyRound, Database, EyeOff } from 'lucide-react'

const checks = [
  { icon: Lock, label: 'Client-side encryption', status: 'Ready' },
  { icon: EyeOff, label: 'Backend plaintext access', status: 'Blocked' },
  { icon: KeyRound, label: 'JWT session', status: 'Active' },
  { icon: Server, label: 'MinIO storage', status: 'Encrypted objects' },
  { icon: Database, label: 'PostgreSQL', status: 'Metadata only' },
  { icon: ShieldCheck, label: 'Zero-knowledge mode', status: 'Active' },
]

export default function SecurityStatus() {
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-white">Security Status</h3>
          <p className="text-xs text-slate-400">Live zero-knowledge guarantees</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
          <ShieldCheck className="h-3 w-3"/> All Systems Secure
        </span>
      </div>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {checks.map(c => (
          <li key={c.label} className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/50 px-3 py-2.5">
            <div className="rounded-lg bg-cyan-500/10 p-1.5 text-cyan-300"><c.icon className="h-4 w-4"/></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{c.label}</p>
              <p className="text-[11px] text-emerald-300">{c.status}</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-glow" />
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
