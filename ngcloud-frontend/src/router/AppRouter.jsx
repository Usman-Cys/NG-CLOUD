import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import Landing from '../pages/public/Landing'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'

import ClientLayout from '../layouts/ClientLayout'
import Dashboard from '../pages/client/Dashboard'
import Files from '../pages/client/Files'
import Upload from '../pages/client/Upload'
import Shared from '../pages/client/Shared'
import ActivityPage from '../pages/client/Activity'
import SettingsPage from '../pages/client/Settings'
import FileDetails from '../pages/client/FileDetails'

import AdminLogin from '../pages/admin/AdminLogin'
import AdminLayout from '../layouts/AdminLayout'
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminUsers from '../pages/admin/AdminUsers'
import AdminFiles from '../pages/admin/AdminFiles'
import AdminStorage from '../pages/admin/AdminStorage'
import AdminSecurity from '../pages/admin/AdminSecurity'
import AdminLogs from '../pages/admin/AdminLogs'
import AdminSettings from '../pages/admin/AdminSettings'

import ProtectedRoute from './ProtectedRoute'
import AdminProtectedRoute from './AdminProtectedRoute'

export default function AppRouter() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/files" element={<Files />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/shared" element={<Shared />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/file/:fileId" element={<FileDetails />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/files" element={<AdminFiles />} />
          <Route path="/admin/storage" element={<AdminStorage />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
