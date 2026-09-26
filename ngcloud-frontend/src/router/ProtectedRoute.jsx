import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  const loc = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc }} />
  return children
}
