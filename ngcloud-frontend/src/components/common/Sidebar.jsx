import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import logo from '../../assets/logo.svg'

export default function Sidebar({ items, open, onClose, footer, accent='cyan' }) {
  const accentRing = accent === 'violet'
    ? 'from-violet-500/20 to-cyan-500/20'
    : 'from-cyan-500/20 to-violet-500/20'

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />
      )}
      <aside className={`fixed md:sticky md:top-0 z-40 md:z-10 left-0 top-0 h-screen w-64 shrink-0 border-r border-white/5 bg-bg/85 backdrop-blur-xl transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center gap-2 px-2 py-3">
            <div className={`relative h-9 w-9 rounded-xl bg-gradient-to-br ${accentRing} p-1.5 shadow-glow-cyan`}>
              <img src={logo} alt="NGCloud" className="h-full w-full" />
            </div>
            <div>
              <p className="font-mono text-base tracking-wider text-white">NGCloud</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Zero-Knowledge</p>
            </div>
          </div>

          <nav className="mt-4 flex-1 space-y-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/15 to-violet-500/10 text-white border border-cyan-500/30 shadow-glow-cyan'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`h-4 w-4 ${isActive ? 'text-cyan-300' : ''}`} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <motion.span layoutId="nav-dot" className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-glow-cyan" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {footer}
        </div>
      </aside>
    </>
  )
}
