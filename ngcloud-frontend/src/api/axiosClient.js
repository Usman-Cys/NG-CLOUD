import axios from 'axios'
import { getToken, clearToken } from '../utils/token'

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

axiosClient.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

axiosClient.interceptors.response.use(
  (response) => response,
  (err) => {
    if (err?.response?.status === 401) {
      const token = getToken()
      const isDemo = token?.startsWith('demo-')

      if (!isDemo) {
        clearToken()

        if (!['/login', '/admin/login', '/register', '/'].includes(window.location.pathname)) {
          const isAdmin = window.location.pathname.startsWith('/admin')
          window.location.href = isAdmin ? '/admin/login' : '/login'
        }
      }
    }

    return Promise.reject(err)
  }
)

export default axiosClient