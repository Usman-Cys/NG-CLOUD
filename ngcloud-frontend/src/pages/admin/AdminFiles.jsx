import { useState, useEffect, useMemo } from 'react'
import AdminFilesTable from '../../components/admin/AdminFilesTable'
import Loader from '../../components/common/Loader'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { adminApi } from '../../api/adminApi'
import { toast } from 'sonner'
import { Info, Search, RefreshCw, X, ShieldAlert, AlertOctagon, Trash2 } from 'lucide-react'
import { formatBytes } from '../../utils/formatBytes'
import { formatDate } from '../../utils/formatDate'

const InfoRow = ({ k, v }) => (
  <div className="flex justify-between py-2 border-b border-white/5 last:border-b-0 text-sm">
    <span className="text-slate-400 font-medium">{k}</span>
    <span className="text-slate-200">{v}</span>
  </div>
)

export default function AdminFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [q, setQ] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  
  // Deletion modals state
  const [deleteTarget, setDeleteTarget] = useState(null) // { fileId, filename }
  const [confirmInput, setConfirmInput] = useState('')
  const [checkedPermanent, setCheckedPermanent] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchFiles = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const data = await adminApi.getFiles()
      setFiles(data)
    } catch (err) {
      console.error('Failed to load files', err)
      toast.error('Could not refresh files index.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchFiles()

    const interval = setInterval(() => {
      fetchFiles(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const handleSoftDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await adminApi.deleteFile(deleteTarget.fileId, false)
      toast.success(res.message || 'File soft-deleted successfully.')
      setDeleteTarget(null)
      fetchFiles(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to soft-delete file.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return
    if (!checkedPermanent) {
      return toast.error('Please check the confirmation box.')
    }
    if (confirmInput.toUpperCase() !== 'DELETE') {
      return toast.error('Please type DELETE to confirm permanent deletion.')
    }

    const firstConfirm = window.confirm(`WARNING: You are about to permanently delete "${deleteTarget.filename}" and purge all its blocks from MinIO storage. This action is irreversible. Are you sure you want to proceed?`)
    if (!firstConfirm) return

    const secondConfirm = window.confirm(`FINAL CONFIRMATION: Are you absolutely sure? This will delete the metadata and files forever.`)
    if (!secondConfirm) return

    setDeleteLoading(true)
    try {
      const res = await adminApi.deleteFile(deleteTarget.fileId, true)
      toast.success(res.message || 'File permanently deleted from storage.')
      setDeleteTarget(null)
      setConfirmInput('')
      setCheckedPermanent(false)
      fetchFiles(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to permanently delete file.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const rows = useMemo(() => {
    return (files || []).filter(f =>
      f.filename.toLowerCase().includes(q.toLowerCase()) ||
      f.fileId.toLowerCase().includes(q.toLowerCase()) ||
      f.ownerUsername.toLowerCase().includes(q.toLowerCase())
    )
  }, [files, q])

  if (loading) return <Loader />

  return (
    <div className="space-y-4 relative">
      <GlassCard className="border-cyan-500/20" hover={false}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-cyan-300 mt-0.5" />
          <p className="text-sm text-slate-300">
            Admin can view metadata only. File contents and plaintext keys are never available to the backend or administrator.
          </p>
        </div>
      </GlassCard>

      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            className="input pl-10"
            placeholder="Search files by ID, name, or owner…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <button
          onClick={() => fetchFiles(true)}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <AdminFilesTable
        rows={rows}
        onViewMetadata={setSelectedFile}
        onDeleteFile={(fileId, filename) => setDeleteTarget({ fileId, filename })}
      />

      {/* File Details Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative max-w-md w-full">
            <GlassCard className="border-cyan-500/30 p-6 relative">
              <button
                onClick={() => setSelectedFile(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="h-5 w-5 text-cyan-400" />
                <h3 className="font-display text-lg text-white">File Metadata Inspector</h3>
              </div>

              <div className="space-y-1">
                <InfoRow k="File ID" v={<span className="font-mono text-xs text-slate-400">{selectedFile.fileId}</span>} />
                <InfoRow k="Owner ID" v={<span className="font-mono text-xs text-slate-400">{selectedFile.ownerId}</span>} />
                <InfoRow k="Owner Username" v={selectedFile.ownerUsername} />
                <InfoRow k="Encrypted Name" v={<span className="text-slate-300 max-w-[200px] truncate block" title={selectedFile.filename}>{selectedFile.filename}</span>} />
                <InfoRow k="Size" v={formatBytes(selectedFile.size)} />
                <InfoRow k="Chunks Count" v={selectedFile.totalChunks} />
                <InfoRow k="MinIO Path" v={<span className="font-mono text-xs text-slate-400 max-w-[200px] truncate block" title={selectedFile.minioPath}>{selectedFile.minioPath}</span>} />
                <InfoRow k="Status" v={<StatusBadge status={selectedFile.status === 'deleted' ? 'disabled' : 'encrypted'} label={selectedFile.status === 'deleted' ? 'Deleted' : 'Encrypted'} />} />
                <InfoRow k="Lock Status" v={<StatusBadge status={selectedFile.isLocked ? 'warning' : 'ok'} label={selectedFile.isLocked ? 'Locked' : 'Unlocked'} />} />
                <InfoRow k="Shares Count" v={selectedFile.sharingCount} />
                <InfoRow k="Created Date" v={formatDate(selectedFile.createdAt)} />
              </div>

              <Button
                variant="outline"
                onClick={() => setSelectedFile(null)}
                className="w-full mt-6"
              >
                Close Inspector
              </Button>
            </GlassCard>
          </div>
        </div>
      )}

       {/* Double Confirmation Deletion Dialog */}
       {deleteTarget && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="relative max-w-lg w-full">
             <GlassCard className="border-rose-500/30 p-6 relative">
               <button
                 onClick={() => {
                   setDeleteTarget(null)
                   setConfirmInput('')
                   setCheckedPermanent(false)
                 }}
                 disabled={deleteLoading}
                 className="absolute top-4 right-4 text-slate-400 hover:text-white"
               >
                 <X className="h-5 w-5" />
               </button>
 
               <div className="flex items-center gap-2 mb-4">
                 <AlertOctagon className="h-6 w-6 text-rose-400" />
                 <h3 className="font-display text-lg text-white">Delete Administrative Action</h3>
               </div>
 
               <p className="text-sm text-slate-300 mb-4">
                 You are deleting metadata file: <strong className="text-white font-mono">{deleteTarget.filename}</strong>.
               </p>
 
               <div className="grid md:grid-cols-2 gap-4 mb-6">
                 <div className="border border-white/5 bg-slate-900/40 rounded-xl p-4 flex flex-col justify-between">
                   <div>
                     <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Option 1: Soft Delete</h4>
                     <p className="text-[11px] text-slate-400 mt-1">
                       Sets the file status to "deleted" in PostgreSQL. The physical chunks in MinIO are retained for safety. Highly recommended.
                     </p>
                   </div>
                   <Button
                     onClick={handleSoftDelete}
                     loading={deleteLoading}
                     variant="outline"
                     className="w-full mt-4 text-xs py-2"
                   >
                     Apply Soft Delete
                   </Button>
                 </div>
 
                 <div className="border border-rose-500/10 bg-rose-950/10 rounded-xl p-4 flex flex-col justify-between">
                   <div>
                     <h4 className="text-xs uppercase font-semibold text-rose-300 tracking-wider">Option 2: Permanent Delete</h4>
                     <p className="text-[11px] text-rose-400/80 mt-1">
                       Deletes the file metadata row and permanently removes the underlying encrypted object blocks from MinIO storage. Action cannot be undone.
                     </p>
                   </div>
 
                   <div className="mt-3 flex items-start gap-2">
                     <input
                       type="checkbox"
                       id="check-perm"
                       className="mt-0.5 rounded border-white/10 bg-slate-950 text-rose-500 focus:ring-0"
                       checked={checkedPermanent}
                       onChange={e => setCheckedPermanent(e.target.checked)}
                       disabled={deleteLoading}
                     />
                     <label htmlFor="check-perm" className="text-[10px] text-rose-300 leading-tight cursor-pointer select-none">
                       I understand this will permanently purge all chunks from MinIO.
                     </label>
                   </div>
 
                   <div className="mt-3">
                     <label className="text-[10px] text-rose-400/70 font-medium">Type <strong className="text-white">DELETE</strong> to confirm:</label>
                     <input
                       type="text"
                       className="input py-1 text-xs px-2 mt-1 border-rose-500/20 text-rose-100"
                       placeholder="DELETE"
                       disabled={deleteLoading || !checkedPermanent}
                       value={confirmInput}
                       onChange={e => setConfirmInput(e.target.value)}
                     />
                   </div>
 
                   <Button
                     onClick={handlePermanentDelete}
                     loading={deleteLoading}
                     disabled={!checkedPermanent || confirmInput.toUpperCase() !== 'DELETE'}
                     variant="danger"
                     icon={Trash2}
                     className="w-full mt-3 text-xs py-2"
                   >
                     Delete Permanently
                   </Button>
                 </div>
               </div>
             </GlassCard>
           </div>
         </div>
       )}
    </div>
  )
}
