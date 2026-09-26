import { motion } from 'framer-motion'
import logo from '../assets/logo.svg'

export default function AuthLayout({ children, title, subtitle, admin=false }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 cyber-grid overflow-hidden">
      {/* Animated blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl animate-pulse-glow" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl animate-pulse-glow" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="gradient-border p-[1px] rounded-2xl">
          <div className="glass-strong rounded-2xl p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative h-14 w-14 mb-3 animate-float">
                <div className={`absolute inset-0 rounded-2xl ${admin ? 'bg-rose-500/20' : 'bg-cyan-500/20'} blur-xl`} />
                <img src={logo} alt="NGCloud" className="relative h-full w-full" />
              </div>
              <h1 className="font-mono text-2xl tracking-wider text-white">NGCloud</h1>
              <p className="mt-2 text-base font-display text-white">{title}</p>
              {subtitle && <p className="mt-1 text-sm text-slate-400 max-w-xs">{subtitle}</p>}
              {admin && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs text-rose-300">
                  ⚠ Restricted Administrative Access
                </span>
              )}
            </div>
            {children}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Zero-knowledge cloud storage • Client-side encryption • Post-quantum ready
        </p>
      </motion.div>
    </div>
  )
}
