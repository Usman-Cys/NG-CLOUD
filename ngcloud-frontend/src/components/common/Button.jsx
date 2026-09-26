import { forwardRef } from 'react'
import { motion } from 'framer-motion'

const variants = {
  primary: 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-glow-cyan hover:shadow-glow-violet',
  secondary: 'bg-slate-800/70 border border-slate-700 text-slate-100 hover:bg-slate-800',
  ghost: 'text-slate-300 hover:bg-white/5',
  danger: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-glow-cyan hover:shadow-[0_0_30px_rgba(244,63,94,0.35)]',
  outline: 'border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10',
}
const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-sm', lg: 'px-7 py-3 text-base' }

const Button = forwardRef(function Button(
  { variant='primary', size='md', className='', children, loading, icon: Icon, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      ) : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </motion.button>
  )
})
export default Button
