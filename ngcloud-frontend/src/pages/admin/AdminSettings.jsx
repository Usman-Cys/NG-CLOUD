import { useState, useEffect } from 'react'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/authApi'
import { adminApi } from '../../api/adminApi'
import { toast } from 'sonner'
import { UserPlus, ShieldAlert, Users, Key, Mail, User, Info, Settings } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

const Row = ({ k, v }) => (
  <div className="flex justify-between py-2 border-b border-white/5 last:border-b-0 text-sm">
    <span className="text-slate-400">{k}</span>
    <span className="text-slate-200">{v}</span>
  </div>
)

export default function AdminSettings() {
  const { user: currentAdmin } = useAuth()
  const [admins, setAdmins] = useState([])
  const [policy, setPolicy] = useState(null)
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [loadingPolicy, setLoadingPolicy] = useState(true)
  
  // Registration form state
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '' })
  const [regLoading, setRegLoading] = useState(false)

  const fetchAdmins = async () => {
    try {
      const { data } = await authApi.listAdmins()
      setAdmins(data)
    } catch (err) {
      console.error('Failed to load admins', err)
      toast.error('Could not load administrative accounts.')
    } finally {
      setLoadingAdmins(false)
    }
  }

  const fetchPolicy = async () => {
    try {
      const data = await adminApi.getPolicy()
      setPolicy(data)
    } catch (err) {
      console.error('Failed to load policy', err)
      toast.error('Could not load upload policy settings.')
    } finally {
      setLoadingPolicy(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
    fetchPolicy()
  }, [])

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!regForm.username.trim()) {
      return toast.error('Username is required.')
    }
    if (regForm.password.length < 8) {
      return toast.error('Password must be at least 8 characters.')
    }

    setRegLoading(true)
    try {
      await authApi.adminRegister(regForm)
      toast.success(`Admin "${regForm.username}" registered successfully.`)
      setRegForm({ username: '', email: '', password: '' })
      fetchAdmins()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to register new admin.')
    } finally {
      setRegLoading(false)
    }
  }

  const handleDisable = async (id, username) => {
    if (id === currentAdmin?.id) {
      return toast.error('You cannot disable your own admin account.')
    }
    if (!window.confirm(`Are you sure you want to disable admin account "${username}"?`)) {
      return
    }

    try {
      await authApi.disableAdmin(id)
      toast.success(`Admin account "${username}" has been disabled.`)
      fetchAdmins()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to disable admin account.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-white">System Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Review policy configurations, registration checks, and manage admin users.
        </p>
      </div>

      {/* Upload Policy section from Section 18 */}
      {!loadingPolicy && policy && (
        <GlassCard hover={false} className="border-cyan-500/10">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display font-semibold text-lg text-white">Upload & Storage Policy</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Row k="Max File Size" v={`${policy.maxFileSizeMb} MB`} />
              <Row k="Default User Quota" v={`${policy.defaultUserQuotaMb} MB`} />
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Allowed Extensions</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                  {policy.allowedExtensions.join(", ")}
                </p>
              </div>
              <div>
                <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Allowed MIME Types</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-white/5 max-h-24 overflow-y-auto">
                  {policy.allowedMimeTypes.join(", ")}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <h3 className="font-display text-lg text-white">System Info</h3>
          <div className="mt-3">
            <Row k="System name" v="NGCloud" />
            <Row k="JWT expiry" v="1h (Admin) / 2h (User)" />
            <Row k="Upload size limit" v={policy ? `${policy.maxFileSizeMb} MB` : "500 MB"} />
            <Row k="Allowed file types" v="Configured Extensions (encrypted)" />
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display text-lg text-white">Active Session</h3>
          <div className="mt-3">
            <Row k="Admin session" v={<StatusBadge status="active" />} />
            <Row k="Current user ID" v={<span className="font-mono text-xs text-slate-400">{currentAdmin?.id}</span>} />
            <Row k="Current username" v={currentAdmin?.username} />
            <Row k="Theme" v="Dark (default)" />
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Register New Admin Form */}
        <GlassCard className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-violet-400" />
            <h3 className="font-display text-lg text-white">Register New Admin</h3>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Admin Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="Username"
                  required
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Email Address (Optional)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  className="input pl-10"
                  placeholder="admin@ngcloud.local"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  className="input pl-10"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Must be at least 8 characters.
              </p>
            </div>

            <Button
              type="submit"
              loading={regLoading}
              className="w-full mt-2"
              variant="primary"
              icon={UserPlus}
            >
              Create Admin Account
            </Button>
          </form>
        </GlassCard>

        {/* Manage Admins List */}
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-cyan-400" />
            <h3 className="font-display text-lg text-white">Manage Admins</h3>
          </div>

          {loadingAdmins ? (
            <div className="flex justify-center items-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-cyan-500/40 border-t-cyan animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Created</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-violet-500/5">
                      <td className="px-4 py-3 text-white">
                        <div className="flex flex-col">
                          <span>{admin.username}</span>
                          {admin.id === currentAdmin?.id && (
                            <span className="text-[10px] text-violet-300 font-medium">
                              (Logged In)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                        {admin.email || <span className="text-slate-600">N/A</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-300">
                        {formatDate(admin.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={admin.is_active ? 'active' : 'disabled'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDisable(admin.id, admin.username)}
                          disabled={admin.id === currentAdmin?.id || !admin.is_active}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
