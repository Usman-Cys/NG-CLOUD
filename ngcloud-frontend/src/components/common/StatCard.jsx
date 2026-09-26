import { motion } from 'framer-motion'
import GlassCard from './GlassCard'

export default function StatCard({ icon: Icon, label, value, hint, accent='cyan', delay=0 }) {
  const accents = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-300',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-300',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-300',
  }
  return (
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay, duration:0.4}}>
      <GlassCard className="relative overflow-hidden">
        <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${accents[accent]} blur-2xl opacity-60`} />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-display font-semibold text-white">{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
          </div>
          {Icon && (
            <div className={`rounded-xl p-2.5 bg-gradient-to-br ${accents[accent]}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}
