import { Users, Files, Layers, HardDrive, Server, Database, Activity, ShieldAlert } from 'lucide-react'
import StatCard from '../common/StatCard'
import { formatBytes } from '../../utils/formatBytes'

export default function AdminStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={Users}   label="Total Users"   value={stats.totalUsers}   accent="cyan"   delay={0}/>
      <StatCard icon={Files}   label="Total Files"   value={stats.totalFiles}   accent="violet" delay={0.05}/>
      <StatCard icon={Layers}  label="Total Chunks"  value={stats.totalChunks}  accent="emerald" delay={0.1}/>
      <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(stats.storageUsed)} accent="amber" delay={0.15}/>
      <StatCard icon={Server}   label="MinIO Status" value="Online" accent="emerald" delay={0.2}/>
      <StatCard icon={Database} label="PostgreSQL"  value="Connected" accent="cyan" delay={0.25}/>
      <StatCard icon={Activity} label="Uptime (h)"  value={stats.uptimeHours} accent="violet" delay={0.3}/>
      <StatCard icon={ShieldAlert} label="Failed Attempts" value={stats.failedAttempts} accent="rose" delay={0.35}/>
    </div>
  )
}
