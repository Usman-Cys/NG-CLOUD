import { useRef, useState } from 'react'
import { UploadCloud, X, FileLock2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatBytes } from '../../utils/formatBytes'

export default function UploadBox({ file, onFile, disabled }) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)

  const handleFiles = (files) => {
    if (!files || !files[0]) return
    onFile(files[0])
  }

  return (
    <div
      onDragOver={(e)=>{e.preventDefault(); setDrag(true)}}
      onDragLeave={()=>setDrag(false)}
      onDrop={(e)=>{e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files)}}
      className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
        drag ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/40 hover:border-cyan-500/50'
      }`}
    >
      <input ref={inputRef} type="file" hidden onChange={(e)=>handleFiles(e.target.files)} />
      {!file ? (
        <div>
          <motion.div animate={{y:[-4,4,-4]}} transition={{duration:3, repeat:Infinity}}
            className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-violet-500/20 text-cyan-300 shadow-glow-cyan">
            <UploadCloud className="h-8 w-8"/>
          </motion.div>
          <h3 className="mt-5 font-display text-lg text-white">Drop file to encrypt and upload</h3>
          <p className="mt-1 text-sm text-slate-400">or click to select. Files are encrypted in your browser before upload.</p>
          <button type="button" disabled={disabled} onClick={()=>inputRef.current?.click()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white shadow-glow-cyan hover:shadow-glow-violet transition">
            <FileLock2 className="h-4 w-4"/> Select File
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-cyan-500/15 p-3 text-cyan-300"><FileLock2 className="h-6 w-6"/></div>
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{file.name}</p>
              <p className="text-xs text-slate-400">{formatBytes(file.size)} · {file.type || 'application/octet-stream'}</p>
            </div>
          </div>
          <button onClick={()=>onFile(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Remove">
            <X className="h-4 w-4"/>
          </button>
        </div>
      )}
    </div>
  )
}
