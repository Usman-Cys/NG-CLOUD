import { useState, useEffect } from 'react'
import GlassCard from '../common/GlassCard'
import StatusBadge from '../common/StatusBadge'
import { adminApi } from '../../api/adminApi'
import { RefreshCw, Clock } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

export default function SystemHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHealth = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const data = await adminApi.health()
      setHealth(data)
    } catch (err) {
      console.error('Failed to load health status', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchHealth()

    // 10s auto refresh
    const interval = setInterval(() => {
      fetchHealth(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const rows = health
    ? [
        { label: 'API Server', status: health.apiServer || 'online' },
        { label: 'PostgreSQL', status: health.database === 'connected' ? 'online' : 'error', labelOverride: health.database === 'connected' ? 'Connected' : 'Disconnected' },
        { label: 'MinIO Bucket', status: health.minio === 'connected' ? 'online' : 'error', labelOverride: health.minio === 'connected' ? 'Connected' : 'Disconnected' },
        { label: 'HTTPS Configuration', status: health.https === 'active' ? 'active' : 'warning', labelOverride: health.https === 'active' ? 'HTTPS Active' : 'HTTP Only' },
        { label: 'JWT Authentication', status: health.jwt || 'active' },
        { label: 'Docker Swarm Cluster', status: health.dockerSwarm || 'active' }
      ]
    : []

  return (
    <GlassCard className="relative flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-lg text-white">System Health</h3>
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing || loading}
            className="rounded-lg p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
            title="Refresh Health Status"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <span className="h-6 w-6 rounded-full border-2 border-cyan-500/40 border-t-cyan animate-spin" />
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map(r => (
              <li key={r.label} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-300">{r.label}</span>
                <StatusBadge status={r.status} label={r.labelOverride} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {health && (
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-slate-500">
          <Clock className="h-3 w-3" />
          <span>Last Checked: {formatDate(health.lastChecked)}</span>
        </div>
      )}
    </GlassCard>
  )
}
