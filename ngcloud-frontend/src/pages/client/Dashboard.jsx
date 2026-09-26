import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Files, HardDrive, Lock, Share2, UploadCloud, Clock, ShieldCheck } from 'lucide-react'
import StatCard from '../../components/common/StatCard'
import GlassCard from '../../components/common/GlassCard'
import SecurityStatus from '../../components/client/SecurityStatus'
import RecentActivity from '../../components/client/RecentActivity'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useFiles } from '../../hooks/useFiles'
import { formatBytes } from '../../utils/formatBytes'
import { timeAgo } from '../../utils/formatDate'
import FileTable from '../../components/client/FileTable'
import EmptyState from '../../components/common/EmptyState'
import { filesApi } from '../../api/filesApi'
import StorageStats from '../../components/client/StorageStats'

const mockActivity = [
  { type: 'LOGIN', text: 'JWT session established', time: new Date(Date.now() - 60000).toISOString() },
  { type: 'UPLOAD', text: 'Encrypted upload completed', time: new Date(Date.now() - 600000).toISOString() },
  { type: 'DOWNLOAD', text: 'Decrypted vault.zip locally', time: new Date(Date.now() - 3600000).toISOString() },
  { type: 'SHARE', text: 'Wrapped key issued to recipient', time: new Date(Date.now() - 86400000).toISOString() },
  { type: 'BLOCKED', text: 'Cross-user access blocked by ownership check', time: new Date(Date.now() - 172800000).toISOString() },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { files } = useFiles()
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0)
  const lastUpload = files[0]?.createdAt

  const [policy, setPolicy] = useState(null)

  useEffect(() => {
    filesApi.getUploadPolicy()
      .then(({ data }) => setPolicy(data))
      .catch((err) => console.error('Failed to fetch upload policy:', err))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Welcome back,</p>
          <h2 className="font-display text-3xl text-white">{user?.username || 'Operator'} 👋</h2>
          <p className="mt-1 text-slate-400">Your encrypted cloud vault is ready.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/upload"><Button icon={UploadCloud}>Upload Encrypted File</Button></Link>
          <Link to="/files"><Button variant="outline">View Files</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Files} label="Total Files" value={files.length} accent="cyan" delay={0}/>
        <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(totalSize)} accent="violet" delay={0.05}/>
        <StatCard icon={Lock} label="Encrypted Uploads" value={files.length} accent="emerald" delay={0.1}/>
        <StatCard icon={Share2} label="Shared" value={0} accent="amber" delay={0.15}/>
        <StatCard icon={Clock} label="Last Upload" value={lastUpload ? timeAgo(lastUpload) : '—'} accent="cyan" delay={0.2}/>
        <StatCard icon={ShieldCheck} label="Security" value="Secure" hint="Zero-knowledge" accent="emerald" delay={0.25}/>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-white">Quick Upload</h3>
              <Link to="/upload" className="text-xs text-cyan-300 hover:text-cyan-200">Open full uploader →</Link>
            </div>
            <Link to="/upload" className="mt-4 block rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-500/5 p-8 text-center transition">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><UploadCloud className="h-6 w-6"/></div>
              <p className="mt-3 text-white font-medium">Drag & drop to encrypt and upload</p>
              <p className="text-xs text-slate-400">Files are encrypted locally before leaving your device.</p>
            </Link>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-white">Recent Files</h3>
              <Link to="/files" className="text-xs text-cyan-300 hover:text-cyan-200">View all →</Link>
            </div>
            <div className="mt-4">
              {files.length === 0
                ? <EmptyState title="No encrypted files yet." description="Upload your first secure file to NGCloud." action={<Link to="/upload"><Button icon={UploadCloud}>Upload</Button></Link>} />
                : <FileTable files={files.slice(0,5)}/>}
            </div>
          </GlassCard>
        </div>
        <div className="space-y-6">
          <StorageStats 
            used={policy?.userQuota?.used ?? totalSize} 
            quota={policy?.userQuota?.quota ?? 500 * 1024 * 1024} 
          />
          <SecurityStatus/>
          <RecentActivity items={mockActivity}/>
        </div>
      </div>
    </div>
  )
}