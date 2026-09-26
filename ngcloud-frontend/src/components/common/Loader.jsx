export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        <div className="absolute inset-2 rounded-full bg-cyan-500/10 animate-pulse-glow" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}
