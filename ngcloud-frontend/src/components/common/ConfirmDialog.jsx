import { AnimatePresence, motion } from 'framer-motion'
import Button from './Button'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ open, title='Are you sure?', description, onCancel, onConfirm, confirmText='Confirm', loading }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="glass-strong rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-500/15 p-2 text-rose-300"><AlertTriangle className="h-5 w-5" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-display font-semibold text-white">{title}</h3>
                {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmText}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
