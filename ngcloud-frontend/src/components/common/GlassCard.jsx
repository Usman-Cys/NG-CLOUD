import { motion } from 'framer-motion'
export default function GlassCard({ children, className='', glow=false, hover=true, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={hover ? { y: -2 } : undefined}
      className={`glass rounded-2xl p-6 ${glow ? 'shadow-glow-cyan' : ''} ${hover ? 'hover:border-cyan-500/30 hover:shadow-glow-cyan' : ''} transition-all duration-300 ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
