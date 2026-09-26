import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LogOut, ShieldCheck, Bell, Menu } from 'lucide-react'
import Button from './Button'

export default function Navbar({ onMenu, title }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const handleLogout = () => { logout(); nav('/login') }
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-white/5 bg-bg/70 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={onMenu} className="md:hidden p-2 rounded-lg hover:bg-white/5"><Menu className="h-5 w-5"/></button>
          <h1 className="font-display text-base md:text-lg text-white">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> JWT session active
          </span>
          <button className="p-2 rounded-lg hover:bg-white/5 text-slate-300"><Bell className="h-5 w-5"/></button>
          <div className="hidden sm:block text-right">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="text-sm font-medium text-white">{user?.username || '—'}</p>
          </div>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout}>Logout</Button>
        </div>
      </div>
    </header>
  )
}
