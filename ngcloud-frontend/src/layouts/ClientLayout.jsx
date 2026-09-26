import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Files, UploadCloud, Share2, Activity, Settings, ShieldCheck } from 'lucide-react'
import Sidebar from '../components/common/Sidebar'
import Navbar from '../components/common/Navbar'
import PageTransition from '../components/common/PageTransition'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/files', label: 'Files', icon: Files },
  { to: '/upload', label: 'Upload', icon: UploadCloud },
  { to: '/shared', label: 'Shared', icon: Share2 },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const titleMap = {
  '/dashboard': 'Dashboard', '/files': 'Files', '/upload': 'Upload',
  '/shared': 'Shared Files', '/activity': 'Activity', '/settings': 'Settings',
}

export default function ClientLayout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const title = titleMap[loc.pathname] || 'NGCloud'

  return (
    <div className="relative flex min-h-screen">
      <Sidebar
        items={items}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <div className="mt-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-cyan-300 font-medium">
              <ShieldCheck className="h-4 w-4" /> Zero-Knowledge
            </div>
            <p className="mt-1 text-slate-400 leading-relaxed">
              Backend has no plaintext access. Files are encrypted before storage.
            </p>
          </div>
        }
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenu={() => setOpen(true)} title={title} />
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] mx-auto w-full">
          <PageTransition key={loc.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
