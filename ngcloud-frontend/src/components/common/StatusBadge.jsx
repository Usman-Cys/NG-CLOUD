import { Shield, CheckCircle2, AlertTriangle, XCircle, Lock, Eye } from 'lucide-react'
const map = {
  active:        { cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2, label: 'Active' },
  online:        { cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2, label: 'Online' },
  ok:            { cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2, label: 'OK' },
  encrypted:     { cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30', Icon: Lock, label: 'Encrypted' },
  zk:            { cls: 'bg-violet-500/10 text-violet-300 border-violet-500/30', Icon: Shield, label: 'Zero-Knowledge' },
  warning:       { cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30', Icon: AlertTriangle, label: 'Warning' },
  error:         { cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30', Icon: XCircle, label: 'Error' },
  denied:        { cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30', Icon: XCircle, label: 'Denied' },
  disabled:      { cls: 'bg-slate-500/10 text-slate-300 border-slate-500/30', Icon: XCircle, label: 'Disabled' },
  admin:         { cls: 'bg-violet-500/10 text-violet-300 border-violet-500/30', Icon: Shield, label: 'Admin' },
  user:          { cls: 'bg-slate-500/10 text-slate-300 border-slate-500/30', Icon: Eye, label: 'User' },
}
export default function StatusBadge({ status, label, className='' }) {
  const cfg = map[status] || map.active
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls} ${className}`}>
      <Icon className="h-3 w-3" />
      {label || cfg.label}
    </span>
  )
}
