import { useEffect, useState } from 'react'
import { adminApi } from '../api/adminApi'

export function useAdminData(key) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    adminApi[key]().then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [key])
  return { data, loading }
}
