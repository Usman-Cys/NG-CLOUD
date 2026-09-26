import AppRouter from './router/AppRouter.jsx'
import MouseGlow from './components/common/MouseGlow.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-slate-100 font-sans antialiased relative overflow-x-hidden">
      <MouseGlow />
      <AppRouter />
    </div>
  )
}
