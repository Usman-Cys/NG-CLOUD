import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, User, ShieldCheck } from 'lucide-react'
import AuthLayout from '../../layouts/AuthLayout'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { validateUsername } from '../../utils/validation'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const usernameError = validateUsername(form.username)
    if (usernameError) return toast.error(usernameError)
    if (!form.password) return toast.error('Password is required')
    setLoading(true)
    try {
      const user = await login(form)
      toast.success('Access granted. JWT session active.')
      nav(user?.role === 'admin' ? '/admin/dashboard' : '/dashboard')
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Invalid username or password.'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout title="Access NGCloud" subtitle="JWT-protected · HTTPS required · Zero-knowledge ready">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input className="input pl-10" autoComplete="username" required
              value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input type={show?'text':'password'} className="input pl-10 pr-10" autoComplete="current-password" required
              value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
            <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
            </button>
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full" size="lg" icon={ShieldCheck}>
          Access NGCloud
        </Button>
        <p className="text-center text-sm text-slate-400">
          Don't have an account? <Link to="/register" className="text-cyan-300 hover:text-cyan-200">Register</Link>
        </p>
        <div className="pt-4 mt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-[11px] text-slate-400 text-center">
          <span>🔒 JWT session</span><span>🛡 HTTPS</span><span>🧬 Zero-knowledge</span>
        </div>
      </form>
    </AuthLayout>
  )
}
