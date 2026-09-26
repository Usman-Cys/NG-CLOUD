import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import { KeyRound, LogOut, ShieldCheck, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const handleLogout = () => { logout(); nav('/login') }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <GlassCard>
        <h3 className="font-display text-lg text-white">Profile</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-400">Username</dt><dd className="text-white">{user?.username}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Role</dt><dd><StatusBadge status={user?.role==='admin' ? 'admin' : 'user'}/></dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">User ID</dt><dd className="text-slate-300 font-mono text-xs">{user?.id || '—'}</dd></div>
        </dl>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Security</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-400">JWT session</dt><dd><StatusBadge status="active"/></dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Active session</dt><dd className="text-slate-300">This device</dd></div>
        </dl>
        <Button className="mt-4" variant="secondary" icon={KeyRound} onClick={()=>toast.info('Password change coming soon.')}>
          Change Password
        </Button>
      </GlassCard>

      <GlassCard>
        <h3 className="font-display text-lg text-white">Crypto Vault</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-400">Local key vault</dt><dd><StatusBadge status="encrypted"/></dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Recovery phrase</dt><dd className="text-slate-300">Not configured</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Encrypted private key</dt><dd className="text-slate-300">Stored locally</dd></div>
        </dl>
        <p className="mt-3 text-[11px] text-slate-500">Private keys never leave your device.</p>
      </GlassCard>

      <GlassCard className="border-rose-500/20">
        <h3 className="font-display text-lg text-white">Danger Zone</h3>
        <p className="text-sm text-slate-400 mt-1">Be careful — these actions affect your session and local vault.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" icon={RotateCcw} onClick={()=>toast.info('Local vault reset coming soon.')}>Reset Local Vault</Button>
          <Button variant="danger" icon={LogOut} onClick={handleLogout}>Logout</Button>
        </div>
      </GlassCard>
    </div>
  )
}
