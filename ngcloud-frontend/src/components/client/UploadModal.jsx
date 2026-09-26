import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import Upload from '../../pages/client/Upload'

export default function UploadModal({ open, onClose, onComplete }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
          <motion.div initial={{scale:0.96, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.96, opacity:0}}
            className="relative max-w-3xl mx-auto mt-10 glass-strong rounded-2xl p-6" onClick={(e)=>e.stopPropagation()}>
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
              <X className="h-4 w-4"/>
            </button>
            <Upload embedded onComplete={() => { onComplete?.(); onClose() }}/>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
