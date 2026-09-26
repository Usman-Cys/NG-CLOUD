import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, User, Terminal } from 'lucide-react'
import AuthLayout from '../../layouts/AuthLayout'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'

export default function AdminLogin() {
  const { adminLogin, logout } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ username: 'admin', password: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const loggedInUser = await adminLogin(form)
      if (loggedInUser?.role !== 'admin') {
        toast.error('Admin access required')
        logout()
        return
      }
      toast.success('Admin session active.')
      nav('/admin/dashboard')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout admin title="Administrative Console" subtitle="Authorized personnel only. All activity is logged.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Admin Username</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/>
            <input className="input pl-10" required value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/>
            <input type="password" className="input pl-10" required value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full" size="lg" icon={Terminal}>Access Command Center</Button>
        <p className="text-center text-xs text-slate-500">
          Not an admin? <Link to="/login" className="text-cyan-300">User login</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
