import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { adminApi } from "../../api/adminApi";
import GlassCard from "../../components/common/GlassCard";
import Loader from "../../components/common/Loader";
import StatCard from "../../components/common/StatCard";
import { motion } from "framer-motion";
import {
  RefreshCw, Server, Database, Layers, HardDrive, Users, FileText,
  Activity, Shield, Gauge, BarChart3, PieChart, AlertTriangle,
  CheckCircle2, TrendingUp, TrendingDown, Cpu, Box, Archive
} from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";

/* ─── helper: animated circular gauge ─────────────────── */
function CircularGauge({ percent, size = 120, stroke = 10, color = "#22d3ee", label, sublabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(Math.max(percent, 0), 100);
  const offset = c - (p / 100) * c;
  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-display font-bold text-white">{p.toFixed(1)}%</span>
          {label && <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>}
        </div>
      </div>
      {sublabel && <span className="text-xs text-slate-500 mt-1">{sublabel}</span>}
    </div>
  );
}

/* ─── helper: horizontal bar ──────────────────────────── */
function HorizBar({ percent, colorFrom = "#06b6d4", colorTo = "#8b5cf6", height = 8 }) {
  const p = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "rgba(255,255,255,0.05)" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})` }}
      />
    </div>
  );
}

/* ─── helper: capacity health badge ───────────────────── */
function HealthBadge({ health }) {
  const map = {
    healthy:  { icon: CheckCircle2, text: "Healthy",  bg: "bg-emerald-500/10", border: "border-emerald-500/30", color: "text-emerald-400" },
    warning:  { icon: AlertTriangle, text: "Warning",  bg: "bg-amber-500/10",   border: "border-amber-500/30",   color: "text-amber-400" },
    critical: { icon: AlertTriangle, text: "Critical", bg: "bg-rose-500/10",    border: "border-rose-500/30",    color: "text-rose-400" },
  };
  const s = map[health] || map.healthy;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.border} ${s.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {s.text}
    </span>
  );
}

/* ─── helper: mini donut for distribution ─────────────── */
const DISTRIBUTION_COLORS = {
  documents:     "#22d3ee",
  images:        "#a78bfa",
  videos:        "#f472b6",
  archives:      "#fbbf24",
  spreadsheets:  "#34d399",
  presentations: "#f97316",
  other:         "#64748b",
};

function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.bytes, 0) || 1;
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  let accumulated = 0;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={16} />
      {data.filter(d => d.bytes > 0).map((d, i) => {
        const pct = d.bytes / total;
        const dashLen = pct * c;
        const dashOff = accumulated * c;
        accumulated += pct;
        return (
          <circle
            key={d.category}
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={DISTRIBUTION_COLORS[d.category] || "#64748b"}
            strokeWidth={14} strokeLinecap="butt"
            strokeDasharray={`${dashLen} ${c - dashLen}`}
            strokeDashoffset={-dashOff}
            className="transition-all duration-700"
          />
        );
      })}
    </svg>
  );
}

/* ─── helper: quota bar color ─────────────────────────── */
function quotaColors(pct) {
  if (pct >= 95) return { from: "#ef4444", to: "#f87171", text: "text-rose-400" };
  if (pct >= 80) return { from: "#f59e0b", to: "#fbbf24", text: "text-amber-400" };
  return { from: "#06b6d4", to: "#8b5cf6", text: "text-cyan-300" };
}

/* ─── infra icon map ──────────────────────────────────── */
const infraIconMap = {
  PostgreSQL:              Database,
  MinIO:                   HardDrive,
  "Docker Images":         Box,
  "Docker Volumes":        Layers,
  "Application Logs":      FileText,
  "Audit Logs":            Shield,
  "Portainer & Services":  Cpu,
};

/* ─── Trend indicator component ───────────────────────── */
function TrendBadge({ trend, direction }) {
  if (direction === "stable") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 font-medium">
        <TrendingUp className="h-3 w-3 text-slate-500" />
        stable
      </span>
    );
  }
  const isUp = direction === "up";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isUp ? "text-amber-400" : "text-emerald-400"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {trend}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function AdminStorage() {
  const [storage, setStorage] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [perUserStorage, setPerUserStorage] = useState([]);
  const [largestFiles, setLargestFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [storageData, capacityData] = await Promise.all([
        adminApi.getStorage(),
        adminApi.getStorageCapacity(),
      ]);
      setStorage(storageData.storage);
      setPerUserStorage(storageData.perUserStorage || []);
      setLargestFiles(storageData.largestFiles || []);
      setCapacity(capacityData);
    } catch (error) {
      console.error(error);
      if (!silent) toast.error("Failed to load storage data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, []);

  // Distribution chart data
  const distData = useMemo(() => {
    if (!capacity?.fileTypeDistribution) return [];
    return capacity.fileTypeDistribution
      .filter(d => d.count > 0)
      .sort((a, b) => b.bytes - a.bytes);
  }, [capacity]);

  if (loading || !storage || !capacity) return <Loader />;

  const cl = capacity.cluster;
  const cp = capacity.capacity;
  const an = capacity.analytics;

  return (
    <div className="space-y-6">
      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display text-white">Storage Analytics & Capacity</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time cluster storage monitoring and capacity planning
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

      {/* ── TOP STATUS CARDS ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Server}   label="MinIO Status"      value={storage.minioStatus}     hint={storage.clusterMode}                  accent="cyan" />
        <StatCard icon={Database}  label="Bucket"            value={storage.bucket}          hint={`Endpoint: ${storage.endpoint || 'local'}`} accent="violet" />
        <StatCard icon={Layers}    label="Objects"           value={storage.objectCount}     accent="emerald" />
        <StatCard icon={HardDrive} label="Aggregate Storage" value={`${storage.totalMb} MB`} accent="amber" />
      </div>

      {/* ── CLUSTER OVERVIEW + CAPACITY PLANNING ROW ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Card 1: Cluster Storage Overview */}
        <GlassCard hover={false} className="border-cyan-500/10 lg:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <HardDrive className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display font-semibold text-lg text-white">Cluster Storage</h2>
          </div>

          <div className="flex justify-center mb-6 relative">
            <CircularGauge
              percent={cl.utilizationPercent}
              size={140}
              stroke={12}
              color={cl.utilizationPercent > 85 ? "#ef4444" : cl.utilizationPercent > 60 ? "#f59e0b" : "#22d3ee"}
              label="Utilized"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Cluster</span>
              <span className="text-white font-semibold font-mono">{cl.totalStorageGb} GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Infrastructure Reserved</span>
              <span className="text-amber-400 font-semibold font-mono">{cl.reservedInfrastructureGb} GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">User Storage Pool</span>
              <span className="text-cyan-300 font-semibold font-mono">{cl.availableUserStorageGb} GB</span>
            </div>
            <div className="border-t border-white/5 my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Used</span>
              <span className="text-emerald-400 font-semibold font-mono">{cl.usedUserStorageGb.toFixed(3)} GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Available</span>
              <span className="text-violet-300 font-semibold font-mono">{cl.remainingUserStorageGb.toFixed(3)} GB</span>
            </div>
            <HorizBar percent={cl.utilizationPercent} />
          </div>
        </GlassCard>

        {/* Card 2: Capacity Planning */}
        <GlassCard hover={false} className="border-violet-500/10 lg:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <Gauge className="h-5 w-5 text-violet-400" />
            <h2 className="font-display font-semibold text-lg text-white">Capacity Planning</h2>
          </div>

          <div className="text-center mb-6">
            <div className="text-5xl font-display font-bold text-white">{cp.guaranteedUserCapacity}</div>
            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Guaranteed Fully Utilized Users</div>
          </div>

          <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Per-User Quota</span>
              <span className="text-white font-mono font-semibold">{cp.userQuotaMb} MB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Max File Size</span>
              <span className="text-white font-mono font-semibold">{cp.maxFileSizeMb} MB</span>
            </div>
            <div className="border-t border-white/5 my-1" />
            <div className="text-xs text-slate-500 text-center">
              {cl.availableUserStorageGb} GB ÷ {cp.userQuotaMb} MB = {cp.guaranteedUserCapacity} users
            </div>
          </div>
        </GlassCard>

        {/* Card 3: Active User Capacity */}
        <GlassCard hover={false} className="border-emerald-500/10 lg:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-5 w-5 text-emerald-400" />
            <h2 className="font-display font-semibold text-lg text-white">Active Capacity</h2>
          </div>

          <div className="flex justify-center mb-4">
            <HealthBadge health={cp.capacityHealth} />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Current Users</span>
              <span className="text-white font-semibold font-mono">{cp.currentUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Users With Files</span>
              <span className="text-cyan-300 font-semibold font-mono">{cp.usersConsumingStorage}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Guaranteed Capacity</span>
              <span className="text-white font-semibold font-mono">{cp.guaranteedUserCapacity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Remaining Capacity</span>
              <span className="text-emerald-400 font-semibold font-mono">{cp.remainingCapacity}</span>
            </div>
            <HorizBar
              percent={cp.usedCapacityPercent}
              colorFrom={cp.capacityHealth === "critical" ? "#ef4444" : cp.capacityHealth === "warning" ? "#f59e0b" : "#10b981"}
              colorTo={cp.capacityHealth === "critical" ? "#f87171" : cp.capacityHealth === "warning" ? "#fbbf24" : "#34d399"}
            />
            <div className="text-xs text-slate-500 text-center">
              {cp.usedCapacityPercent.toFixed(1)}% user capacity utilized
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── ANALYTICS + DISTRIBUTION ROW ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Real-Time Storage Analytics */}
        <GlassCard hover={false} className="border-cyan-500/10">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display font-semibold text-lg text-white">Real-Time Analytics</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-950/40 border border-white/5 p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Total Files</div>
              <div className="text-xl font-display font-bold text-white mt-1">{an.totalFiles}</div>
            </div>
            <div className="rounded-xl bg-slate-950/40 border border-white/5 p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Total Used</div>
              <div className="text-xl font-display font-bold text-cyan-300 mt-1">{formatBytes(an.totalStorageUsedBytes)}</div>
            </div>
            <div className="rounded-xl bg-slate-950/40 border border-white/5 p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Avg / User</div>
              <div className="text-xl font-display font-bold text-violet-300 mt-1">{formatBytes(an.averageStoragePerUserBytes)}</div>
            </div>
            <div className="rounded-xl bg-slate-950/40 border border-white/5 p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Avg File Size</div>
              <div className="text-xl font-display font-bold text-amber-300 mt-1">{formatBytes(an.averageFileSizeBytes)}</div>
            </div>
          </div>

          {/* Largest file */}
          {an.largestFile && (
            <div className="mt-4 rounded-xl bg-slate-950/40 border border-white/5 p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Largest File</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white truncate max-w-[200px]" title={an.largestFile.filename}>{an.largestFile.filename}</span>
                <span className="text-xs font-mono text-rose-300">{formatBytes(an.largestFile.sizeBytes)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">by {an.largestFile.ownerUsername}</div>
            </div>
          )}

          {/* Top consumer */}
          {an.topConsumer && an.topConsumer.totalBytes > 0 && (
            <div className="mt-3 rounded-xl bg-slate-950/40 border border-white/5 p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Top Storage Consumer</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-semibold">{an.topConsumer.username}</span>
                <span className="text-xs font-mono text-emerald-300">{formatBytes(an.topConsumer.totalBytes)}</span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Storage Distribution */}
        <GlassCard hover={false} className="border-violet-500/10">
          <div className="flex items-center gap-2 mb-5">
            <PieChart className="h-5 w-5 text-violet-400" />
            <h2 className="font-display font-semibold text-lg text-white">Storage Distribution</h2>
          </div>

          {distData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 relative">
                <DonutChart data={distData} size={160} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-display font-bold text-white">{an.totalFiles}</span>
                  <span className="text-[10px] text-slate-400 uppercase">Files</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {distData.map(d => (
                  <div key={d.category} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: DISTRIBUTION_COLORS[d.category] || "#64748b" }} />
                    <span className="text-xs text-slate-300 capitalize flex-1">{d.category}</span>
                    <span className="text-xs text-slate-400 font-mono">{d.count}</span>
                    <span className="text-xs text-slate-500 font-mono w-16 text-right">{formatBytes(d.bytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">No files in storage</div>
          )}
        </GlassCard>
      </div>

      {/* ── 5-NODE CLUSTER ─────────────────────────────── */}
      <GlassCard hover={false} className="border-cyan-500/10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-display font-semibold text-lg text-white">5-Node MinIO Cluster</h2>
            <p className="text-slate-400 text-sm mt-1">
              Erasure Coding Configuration: <strong className="text-white font-mono">{storage.erasureCoding}</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {storage.nodes?.map((node) => (
            <div key={node.name} className="rounded-xl border border-white/5 bg-slate-950/40 p-4 transition duration-300 hover:border-cyan-500/20">
              <div className="font-semibold text-white text-sm">{node.name}</div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`h-2.5 w-2.5 rounded-full ${node.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                <span className={`text-xs font-semibold capitalize ${node.status === "online" ? "text-emerald-400" : "text-rose-400"}`}>
                  {node.status}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">{node.role}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ── INFRASTRUCTURE MONITORING ──────────────────── */}
      <GlassCard hover={false} className="border-amber-500/10">
        <div className="flex items-center gap-2 mb-5">
          <Cpu className="h-5 w-5 text-amber-400" />
          <h2 className="font-display font-semibold text-lg text-white">Infrastructure Storage</h2>
          <span className="ml-auto text-xs text-slate-500">{cl.reservedInfrastructureGb} GB Reserved</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3 text-right">Current Size</th>
                  <th className="px-4 py-3 text-right">% of Reserved</th>
                  <th className="px-4 py-3 text-right">Trend</th>
                  <th className="px-4 py-3 w-40">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {capacity.infrastructure.map((svc, i) => {
                  const pct = cl.reservedInfrastructureGb > 0
                    ? (svc.currentSizeGb / cl.reservedInfrastructureGb) * 100
                    : 0;
                  const Icon = infraIconMap[svc.name] || Cpu;
                  return (
                    <tr key={i} className="hover:bg-amber-500/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-amber-400" />
                          <span className="text-sm text-white font-semibold">{svc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-amber-300 font-semibold">
                        {svc.currentSizeGb} GB
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TrendBadge trend={svc.trend} direction={svc.trendDirection} />
                      </td>
                      <td className="px-4 py-3">
                        <HorizBar percent={pct} colorFrom="#f59e0b" colorTo="#fbbf24" height={6} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>

      {/* ── USER QUOTA MONITORING + LARGEST FILES ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Per-User Quota Monitoring */}
        <GlassCard hover={false} className="border-cyan-500/10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display font-semibold text-lg text-white">User Quota Monitoring</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/40">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3 text-center">Files</th>
                    <th className="px-4 py-3 text-right">Used</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3 text-right">Quota %</th>
                    <th className="px-4 py-3 w-32">Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {(capacity.perUserQuota || []).map((u, i) => {
                    const colors = quotaColors(u.quotaPercent);
                    return (
                      <tr key={i} className="hover:bg-cyan-500/5 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-300">{u.username}</td>
                        <td className="px-4 py-3 text-center text-slate-400">{u.filesCount}</td>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-300 text-right">{formatBytes(u.usedBytes)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-emerald-400 text-right">{formatBytes(u.remainingBytes)}</td>
                        <td className={`px-4 py-3 font-mono text-xs text-right font-semibold ${colors.text}`}>{u.quotaPercent.toFixed(1)}%</td>
                        <td className="px-4 py-3">
                          <HorizBar percent={u.quotaPercent} colorFrom={colors.from} colorTo={colors.to} height={6} />
                        </td>
                      </tr>
                    );
                  })}
                  {(!capacity.perUserQuota || capacity.perUserQuota.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No active users.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>

        {/* Largest Files */}
        <GlassCard hover={false} className="border-violet-500/10">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-violet-400" />
            <h2 className="font-display font-semibold text-lg text-white">Largest Files</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/40">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Filename</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {largestFiles.map((f, i) => (
                    <tr key={i} className="hover:bg-violet-500/5 transition-colors">
                      <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate" title={f.filename}>{f.filename}</td>
                      <td className="px-4 py-3 font-mono text-xs text-rose-300">{formatBytes(f.sizeBytes)}</td>
                      <td className="px-4 py-3 text-slate-300 font-semibold">{f.ownerUsername}</td>
                    </tr>
                  ))}
                  {largestFiles.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No files in storage.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── SUMMARY CARD ───────────────────────────────── */}
      <GlassCard hover={false} className="border-emerald-500/10">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h2 className="font-display font-semibold text-lg text-white">NGCloud Storage Summary</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Cluster Capacity",      value: `${cl.totalStorageGb} GB`,       color: "text-white" },
            { label: "Infrastructure",         value: `${cl.reservedInfrastructureGb} GB`, color: "text-amber-400" },
            { label: "User Storage Pool",      value: `${cl.availableUserStorageGb} GB`,   color: "text-cyan-300" },
            { label: "User Quota",             value: `${cp.userQuotaMb} MB`,          color: "text-violet-300" },
            { label: "Guaranteed Capacity",    value: `${cp.guaranteedUserCapacity} users`, color: "text-emerald-400" },
            { label: "Storage Health",         value: null,                            color: "" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl bg-slate-950/40 border border-white/5 p-3 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{item.label}</div>
              {item.value ? (
                <div className={`text-lg font-display font-bold ${item.color}`}>{item.value}</div>
              ) : (
                <div className="mt-1"><HealthBadge health={cp.capacityHealth} /></div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}