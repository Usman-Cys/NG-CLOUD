import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Cloud, Lock, KeyRound, Database, Server, Eye, EyeOff,
  CheckCircle2, ArrowRight, Cpu, Network, Sparkles
} from 'lucide-react'
import logo from '../../assets/logo.svg'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'

const features = [
  { icon: ShieldCheck, title: 'Zero-Knowledge Storage', desc: 'The backend can never read your files. By design.' },
  { icon: Lock, title: 'Client-Side Encryption', desc: 'Files are encrypted in your browser before they ever leave your device.' },
  { icon: Cpu, title: 'Post-Quantum Ready', desc: 'Architecture prepared for quantum-resistant primitives.' },
  { icon: KeyRound, title: 'JWT Protected APIs', desc: 'All backend APIs require a signed JWT bearer token.' },
  { icon: Server, title: 'MinIO Object Storage', desc: 'Encrypted blobs persist in a 5-node MinIO cluster with erasure coding.' },
  { icon: Database, title: 'PostgreSQL Metadata', desc: 'Only metadata, ownership, and wrapped keys live in the database.' },
  { icon: Eye, title: 'Admin Monitoring', desc: 'Admins observe system health and metadata — never plaintext.' },
  { icon: Network, title: 'Secure Sharing Ready', desc: 'Recipients receive wrapped keys; the backend never sees the secret.' },
]

const flow = [
  { label: 'File Selected', icon: Cloud },
  { label: 'Local Encryption', icon: Lock },
  { label: 'Presigned Upload URL', icon: KeyRound },
  { label: 'Encrypted Object in MinIO', icon: Server },
  { label: 'Metadata in PostgreSQL', icon: Database },
  { label: 'Local Decryption on Download', icon: ShieldCheck },
]

export default function Landing() {
  return (
    <div className="relative">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 -z-10 cyber-grid">
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl animate-pulse-glow" />
        <div className="absolute top-40 right-10 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-20 left-1/2 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="NGCloud" className="h-9 w-9" />
          <span className="font-mono text-xl tracking-wider text-white">NGCloud</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-300">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#architecture" className="hover:text-white">Architecture</a>
          <a href="#security" className="hover:text-white">Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" size="sm">Login</Button></Link>
          <Link to="/register"><Button size="sm">Get Started</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24 text-center">
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{duration:0.6}}>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
            <Sparkles className="h-3 w-3" /> BS Cyber Security · Final Year Project
          </span>
          <h1 className="mt-6 font-mono text-5xl md:text-7xl font-bold tracking-tight text-white glow-text">
            NGCloud
          </h1>
          <p className="mt-4 font-display text-xl md:text-2xl bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent animate-gradient">
            Next-Generation Zero-Knowledge Cloud Storage
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-slate-400">
            Post-quantum ready encrypted cloud storage where your files are protected
            before they ever leave your device. The backend can't read them. The admin can't decrypt them.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register"><Button size="lg" icon={ArrowRight}>Get Started</Button></Link>
            <Link to="/login"><Button variant="outline" size="lg">Login</Button></Link>
            <a href="#architecture"><Button variant="ghost" size="lg">View Architecture</Button></a>
          </div>

          {/* Floating encrypted file cards */}
          <div className="relative mt-20 h-64 md:h-80">
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              animate={{ y: [-8, 8, -8] }} transition={{ duration: 4, repeat: Infinity }}
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-3xl animate-pulse-glow" />
                <Cloud className="relative h-32 w-32 md:h-40 md:w-40 text-cyan-300" strokeWidth={1} />
              </div>
            </motion.div>
            {[{x:-200,y:-40,d:0},{x:200,y:-20,d:1},{x:-160,y:80,d:2},{x:180,y:90,d:0.5}].map((c,i)=>(
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 hidden md:block"
                style={{ x: c.x, y: c.y }}
                animate={{ y: [c.y-6, c.y+6, c.y-6] }}
                transition={{ duration: 3 + i, repeat: Infinity, delay: c.d }}
              >
                <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-cyan-200 shadow-glow-cyan">
                  <Lock className="h-3.5 w-3.5" /> file_{i+1}.enc
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Problem / Solution */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-2 gap-6">
        <GlassCard className="border-rose-500/20">
          <div className="flex items-center gap-2 text-rose-300"><EyeOff className="h-5 w-5" /><h3 className="font-display text-lg">The Problem</h3></div>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Traditional cloud storage can expose data to server-side leaks, malicious insiders,
            and centralized compromise. Your provider holds your encryption keys —
            so a single breach reveals everything.
          </p>
        </GlassCard>
        <GlassCard className="border-cyan-500/20">
          <div className="flex items-center gap-2 text-cyan-300"><ShieldCheck className="h-5 w-5" /><h3 className="font-display text-lg">The Solution</h3></div>
          <p className="mt-3 text-slate-300 leading-relaxed">
            NGCloud combines <span className="text-cyan-300">client-side encryption</span>,
            <span className="text-violet-300"> JWT-protected APIs</span>,
            <span className="text-emerald-300"> PostgreSQL metadata</span>, and
            <span className="text-cyan-300"> MinIO encrypted object storage</span> —
            so the backend literally cannot read your data.
          </p>
        </GlassCard>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-center font-display text-3xl md:text-4xl font-semibold">How It Works</h2>
        <p className="text-center mt-2 text-slate-400">A six-step zero-knowledge pipeline.</p>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-6 gap-4">
          {flow.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
              transition={{delay: i*0.08}}
              className="glass rounded-2xl p-4 text-center relative"
            >
              <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/20 text-cyan-300">
                <s.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-xs uppercase tracking-wider text-slate-400">Step {i+1}</p>
              <p className="mt-1 text-sm font-medium text-white">{s.label}</p>
              {i < flow.length-1 && <div className="hidden md:block absolute top-1/2 -right-2 text-cyan-500/40">→</div>}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-center font-display text-3xl md:text-4xl font-semibold">Features</h2>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.05}}>
              <GlassCard className="h-full">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><f.icon className="h-5 w-5"/></div>
                <h3 className="mt-4 font-display text-base text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-center font-display text-3xl md:text-4xl font-semibold">Architecture</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {[
            { title: 'Client Browser', icon: Lock, color: 'cyan', bullets: ['Local file encryption','Wrapped key generation','JWT bearer token'] },
            { title: 'Backend API', icon: Server, color: 'violet', bullets: ['JWT verification','Ownership checks','Presigned URL issuance'] },
            { title: 'Storage Layer', icon: Database, color: 'emerald', bullets: ['MinIO 5-node cluster','3+2 erasure coding','PostgreSQL metadata'] },
          ].map((p) => (
            <GlassCard key={p.title} className="h-full">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-${p.color}-500/10 text-${p.color}-300`}>
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg text-white">{p.title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {p.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400"/>{b}</li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Security Promise */}
      <section id="security" className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        <GlassCard className="text-center" glow>
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-cyan-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-2xl md:text-3xl">Security Promise</h2>
          <div className="mt-6 grid md:grid-cols-3 gap-4 text-sm">
            {[
              'Backend cannot read your files.',
              'Admin cannot decrypt your data.',
              'Storage only contains encrypted objects.',
            ].map(t => (
              <div key={t} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-slate-200">{t}</div>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto max-w-7xl px-6 py-10 border-t border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6" />
            <span className="font-mono tracking-wider text-white">NGCloud FYP</span>
            <span>·</span> BS Cyber Security
          </div>
          <p>Zero-Knowledge Cloud Storage · © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  )
}
