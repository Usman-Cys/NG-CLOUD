import { Inbox } from 'lucide-react'
export default function EmptyState({ icon: Icon = Inbox, title='Nothing here yet', description, action }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-display font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
