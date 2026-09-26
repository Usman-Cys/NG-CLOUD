import GlassCard from '../common/GlassCard'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function SecurityChecklist({ checks, tests }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Architecture Checks</h3>
        <ul className="mt-3 space-y-2">
          {checks.map(c => (
            <li key={c.label} className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <span className="text-sm text-slate-200">{c.label}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4"/> {c.status}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Security Tests</h3>
        <ul className="mt-3 space-y-2">
          {tests.map(t => (
            <li key={t.name} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${t.pass ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-rose-500/5 border border-rose-500/20'}`}>
              <div>
                <p className="text-sm text-slate-200">{t.name}</p>
                <p className="text-[11px] text-slate-500">expected: {t.expected} · got: {t.result}</p>
              </div>
              {t.pass ? <CheckCircle2 className="h-5 w-5 text-emerald-400"/> : <XCircle className="h-5 w-5 text-rose-400"/>}
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  )
}
