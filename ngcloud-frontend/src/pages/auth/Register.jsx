import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, User, ShieldCheck, KeyRound } from 'lucide-react'
import AuthLayout from '../../layouts/AuthLayout'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { validateUsername, validatePassword } from '../../utils/validation'

function strength(p) {
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const s = useMemo(() => strength(form.password), [form.password])
  const colors = ['bg-slate-700','bg-rose-500','bg-amber-500','bg-cyan-500','bg-emerald-500']
  const labels = ['','Weak','Fair','Good','Strong']

  const submit = async (e) => {
    e.preventDefault()
    const usernameError = validateUsername(form.username)
    if (usernameError) return toast.error(usernameError)
    const passwordError = validatePassword(form.password)
    if (passwordError) return toast.error(passwordError)
    if (form.password !== form.confirm) return toast.error('Passwords do not match.')
    if (s < 3) return toast.error('Please choose a stronger password.')
    setLoading(true)
    try {
      await register({ username: form.username, password: form.password })
      toast.success('Account created. Please login.')
      nav('/login')
    } catch (err) {
      const code = err?.response?.status
      const msg = code === 409 ? 'Username already taken.' : (err?.response?.data?.message || 'Registration failed.')
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout title="Create Secure Account" subtitle="Password is hashed before storage. Public key support powers secure key wrapping.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input className="input pl-10" required value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input type={show?'text':'password'} className="input pl-10 pr-10" required
              value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
            <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
            </button>
          </div>
          {form.password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`flex-1 ${i <= s ? colors[s] : ''} transition-all`} />
                ))}
              </div>
              <span className="text-xs text-slate-400 w-12 text-right">{labels[s]}</span>
            </div>
          )}
        </div>
        <div>
          <label className="label">Confirm Password</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input type={show?'text':'password'} className="input pl-10" required
              value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})}/>
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full" size="lg" icon={ShieldCheck}>
          Create Secure Account
        </Button>
        <p className="text-center text-sm text-slate-400">
          Already registered? <Link to="/login" className="text-cyan-300 hover:text-cyan-200">Login</Link>
        </p>
        <div className="pt-4 mt-4 border-t border-white/5 space-y-1.5 text-[11px] text-slate-400">
          <p>• Password is hashed before storage</p>
          <p>• Public key wrapping for secure key sharing</p>
          <p>• Your files will be encrypted before upload</p>
        </div>
      </form>
    </AuthLayout>
  )
}
