import GlassCard from '../common/GlassCard'
import { motion } from 'framer-motion'
import { Server } from 'lucide-react'

export default function StorageNodeGraph({ nodes }) {
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-white">MinIO Cluster</h3>
        <span className="text-xs text-slate-400">5 nodes · 3+2 erasure coding</span>
      </div>
      <div className="relative mt-8 h-64">
        {/* Center hub */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-2xl animate-pulse-glow"/>
            <div className="relative rounded-2xl border border-cyan-500/40 bg-slate-900/80 px-4 py-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Bucket</p>
              <p className="font-mono text-sm text-white">ngcloud-vault</p>
            </div>
          </div>
        </div>
        {/* Nodes */}
        {nodes.map((n, i) => {
          const angle = (i / nodes.length) * 2 * Math.PI - Math.PI/2
          const r = 110
          const x = Math.cos(angle) * r
          const y = Math.sin(angle) * r
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-emerald-500/20 blur-lg animate-pulse-glow"/>
                <div className="relative rounded-xl border border-emerald-500/30 bg-slate-900/80 px-3 py-2 text-center min-w-[80px]">
                  <Server className="mx-auto h-4 w-4 text-emerald-300"/>
                  <p className="mt-1 text-[11px] font-mono text-white">{n.name}</p>
                  <p className="text-[10px] text-emerald-300">{n.status}</p>
                </div>
              </div>
            </motion.div>
          )
        })}
        {/* SVG lines */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          {nodes.map((_, i) => {
            const angle = (i / nodes.length) * 2 * Math.PI - Math.PI/2
            const r = 110
            return <line key={i} x1="50%" y1="50%" x2={`calc(50% + ${Math.cos(angle)*r}px)`} y2={`calc(50% + ${Math.sin(angle)*r}px)`} stroke="rgba(34,211,238,0.2)" strokeDasharray="3,3"/>
          })}
        </svg>
      </div>
    </GlassCard>
  )
}
