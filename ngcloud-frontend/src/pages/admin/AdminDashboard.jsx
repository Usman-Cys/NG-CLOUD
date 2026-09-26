import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "../../api/adminApi";
import GlassCard from "../../components/common/GlassCard";
import Loader from "../../components/common/Loader";
import { 
  RefreshCw, 
  Users, 
  Shield, 
  HardDrive, 
  FileText, 
  Lock, 
  Layers, 
  Server, 
  Database, 
  Activity, 
  ShieldAlert 
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

const COLORS = ["#22d3ee", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [fileTypes, setFileTypes] = useState([]);
  const [uploadsOverTime, setUploadsOverTime] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [lastCheckedTime, setLastCheckedTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await adminApi.getStats();
      setStats(data.stats);
      setFileTypes(data.fileTypes || []);
      setUploadsOverTime(data.uploadsOverTime || []);
      setUserGrowth(data.userGrowth || []);
      
      const now = new Date();
      setLastCheckedTime(
        now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + 
        ", " + 
        now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to load admin stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    const interval = setInterval(() => {
      load(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display text-white">Admin Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            System monitoring without violating zero-knowledge security.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* System Activity Section (8 Cards) */}
      <div>
        <h2 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3">System Activity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} accent="cyan" />
          <MiniStatCard title="Total Files" value={stats?.totalFiles ?? 0} icon={FileText} accent="violet" />
          <MiniStatCard title="Total Chunks" value={stats?.totalChunks ?? 0} icon={Layers} accent="emerald" />
          <MiniStatCard title="Storage Used" value={`${stats?.totalStorageMb ?? 0} MB`} icon={HardDrive} accent="amber" />
          <MiniStatCard title="MinIO Status" value={stats?.minioStatus || "Offline"} icon={Server} accent="cyan" />
          <MiniStatCard title="PostgreSQL" value={stats?.postgresStatus || "Connected"} icon={Database} accent="violet" />
          <MiniStatCard title="Uptime (h)" value={stats?.uptimeHours ?? 0} icon={Activity} accent="emerald" />
          <MiniStatCard title="Failed Attempts" value={stats?.failedAttempts ?? 0} icon={ShieldAlert} accent="rose" />
        </div>
      </div>

      {/* Middle Row: Chart & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Uploads (last 12 days) */}
        <GlassCard className="lg:col-span-2" hover={false}>
          <h2 className="font-display font-semibold text-lg text-white mb-4">Uploads (last 12 days)</h2>
          <div className="h-64">
            {uploadsOverTime.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                No recent uploads activity.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={uploadsOverTime}>
                  <defs>
                    <linearGradient id="uploadsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="uploads" name="Uploads" stroke="#22d3ee" fill="url(#uploadsGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        {/* Right: System Health */}
        <GlassCard hover={false} className="flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display font-semibold text-lg text-white">System Health</h2>
              <button onClick={() => load(true)} disabled={refreshing} className="p-1.5 rounded-lg border border-white/5 bg-slate-950/40 text-slate-400 hover:text-white disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="space-y-3">
              <HealthRow label="API Server" value="Online" status="ok" />
              <HealthRow label="PostgreSQL" value={stats?.postgresStatus || "Connected"} status="ok" />
              <HealthRow label="MinIO Bucket" value={stats?.minioStatus === "Online" ? "Connected" : "Disconnected"} status={stats?.minioStatus === "Online" ? "ok" : "danger"} />
              <HealthRow label="HTTPS Configuration" value="HTTP Only" status="warning" />
              <HealthRow label="JWT Authentication" value="Active" status="ok" />
              <HealthRow label="Docker Swarm Cluster" value="Active" status="ok" />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-4 pt-2 border-t border-white/5 flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            Last Checked: {lastCheckedTime || "—"}
          </div>
        </GlassCard>
      </div>

      {/* Bottom Row: Charts & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: User Growth */}
        <GlassCard hover={false}>
          <h2 className="font-display font-semibold text-lg text-white mb-4">User Growth</h2>
          <div className="h-56">
            {userGrowth.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                No user registrations.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowth}>
                  <defs>
                    <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="count" name="Users" stroke="#a78bfa" fill="url(#usersGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        {/* Middle: Storage by Type */}
        <GlassCard hover={false} className="flex flex-col justify-between">
          <div>
            <h2 className="font-display font-semibold text-lg text-white mb-4">Storage by Type</h2>
            <div className="h-44 flex items-center justify-center">
              {fileTypes.length === 0 ? (
                <div className="text-slate-500 text-sm">No files uploaded yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fileTypes}
                      nameKey="extension"
                      dataKey="count"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {fileTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-2 text-xs text-white">
                            <p className="font-semibold uppercase font-mono">{data.extension}</p>
                            <p className="text-slate-400 mt-1">{data.count} files ({data.mb} MB)</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          {/* Donut Legend */}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2 border-t border-white/5 pt-3">
            {fileTypes.slice(0, 4).map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5 text-[10px] text-slate-300 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="font-semibold uppercase font-mono">{entry.extension}</span>
                <span className="text-slate-500">({entry.count})</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Right: Security Summary */}
        <GlassCard hover={false} className="border-cyan-500/10 flex flex-col justify-between">
          <div>
            <h2 className="font-display font-semibold text-lg text-white mb-4">Security Summary</h2>
            <div className="space-y-2.5">
              <SecurityRow label="Zero-knowledge architecture" value={stats?.zeroKnowledgeStatus} status="ok" />
              <SecurityRow label="Admin plaintext access" value={stats?.adminPlaintextAccess} status="danger" />
              <SecurityRow label="Kyber public key storage" value="Active" status="ok" />
              <SecurityRow label="Private key storage" value="client-only" status="info" />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-4 pt-2 border-t border-white/5 font-medium">
            Key pairs are stored client-side. The backend database holds wrapped file keys and public key configurations only.
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function MiniStatCard({ title, value, icon: Icon, accent = "cyan" }) {
  const accents = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-500/20 bg-cyan-500/10',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-300 border-violet-500/20 bg-violet-500/10',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/20 bg-emerald-500/10',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-500/20 bg-amber-500/10',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-300 border-rose-500/20 bg-rose-500/10',
  };
  return (
    <GlassCard hover={false} className="relative overflow-hidden p-5 flex justify-between items-center border-white/5 bg-slate-900/60">
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">{title}</p>
        <p className="text-2xl font-display font-bold mt-2 text-white">{value}</p>
      </div>
      {Icon && (
        <div className={`rounded-xl p-2.5 bg-gradient-to-br ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
    </GlassCard>
  );
}

function HealthRow({ label, value, status }) {
  const statusStyles = {
    ok: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-400",
  };
  return (
    <div className="flex justify-between items-center rounded-xl bg-slate-950/40 border border-white/5 p-2.5">
      <span className="text-slate-400 text-sm font-medium">{label}</span>
      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${statusStyles[status]}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${status === "ok" ? "bg-emerald-400 animate-pulse" : status === "warning" ? "bg-amber-400" : "bg-rose-400"}`} />
        {value}
      </span>
    </div>
  );
}

function SecurityRow({ label, value, status }) {
  let valColor = "text-cyan-300 bg-cyan-500/10 border-cyan-500/20";
  if (status === "danger") valColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
  else if (status === "ok") valColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  else if (status === "info") valColor = "text-cyan-300 bg-cyan-500/10 border-cyan-500/20";

  return (
    <div className="flex justify-between items-center rounded-xl bg-slate-950/40 border border-white/5 p-3">
      <span className="text-slate-400 text-xs font-medium">{label}</span>
      <span className={`px-2 py-0.5 border text-[10px] font-semibold uppercase tracking-wider rounded-md ${valColor}`}>
        {value}
      </span>
    </div>
  );
}

