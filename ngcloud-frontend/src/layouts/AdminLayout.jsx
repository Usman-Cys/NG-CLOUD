import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, FileLock2, HardDrive, ShieldCheck, ScrollText, Settings, Activity } from 'lucide-react'
import Sidebar from '../components/common/Sidebar'
import Navbar from '../components/common/Navbar'
import PageTransition from '../components/common/PageTransition'

const items = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/files', label: 'Files Metadata', icon: FileLock2 },
  { to: '/admin/storage', label: 'Storage', icon: HardDrive },
  { to: '/admin/security', label: 'Security Center', icon: ShieldCheck },
  { to: '/admin/logs', label: 'Logs', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]
const titleMap = {
  '/admin/dashboard': 'Admin Command Center',
  '/admin/users': 'User Management',
  '/admin/files': 'Files Metadata',
  '/admin/storage': 'Storage Health',
  '/admin/security': 'Security Center',
  '/admin/logs': 'Audit Logs',
  '/admin/settings': 'System Settings',
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  return (
    <div className="relative flex min-h-screen">
      <Sidebar
        items={items} open={open} onClose={() => setOpen(false)} accent="violet"
        footer={
          <div className="mt-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs">
            <div className="flex items-center gap-2 text-violet-300 font-medium">
              <Activity className="h-4 w-4" /> Command Center
            </div>
            <p className="mt-1 text-slate-400">Admin can monitor metadata only.</p>
          </div>
        }
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenu={() => setOpen(true)} title={titleMap[loc.pathname] || 'Admin'} />
        <main className="flex-1 p-4 md:p-8 max-w-[1500px] mx-auto w-full">
          <PageTransition key={loc.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
