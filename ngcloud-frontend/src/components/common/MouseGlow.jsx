import { useEffect, useState } from 'react'
export default function MouseGlow() {
  const [p, setP] = useState({ x: -200, y: -200 })
  useEffect(() => {
    const onMove = (e) => setP({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background: `radial-gradient(380px circle at ${p.x}px ${p.y}px, rgba(34,211,238,0.10), transparent 60%)`,
        transition: 'background 80ms linear',
      }}
    />
  )
}
