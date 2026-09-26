import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import { ArrowLeft, Download, Share2, Trash2, Server, Database, Lock, Unlock, Shield, Eye } from 'lucide-react'
import { filesApi } from '../../api/filesApi'
import { validateFileId } from '../../utils/validation'
import { useFiles } from '../../hooks/useFiles'
import { formatBytes } from '../../utils/formatBytes'
import { formatDate } from '../../utils/formatDate'
import { toast } from 'sonner'
import Loader from '../../components/common/Loader'
import { decryptChunk, deriveChunkNonce } from '../../crypto/fsmlweCipher'
import { base64ToBytes } from '../../crypto/kyberKeyManager'
import { unwrapFileKeyWithKyber } from '../../crypto/kyberKeyManager'
import { ktQhfHashBytes } from '../../crypto/ktqhf'
import { useAuth } from '../../context/AuthContext'
import { zeroize } from '../../crypto/CryptoService'
import { canRead, canWrite, canShare, canReview, getPermissionLabel } from '../../utils/permissions'

export default function FileDetails({ fileIdOverride, embedded = false }) {
  const params = useParams()
  const fileId = fileIdOverride || params.fileId
  const { files, refresh } = useFiles()
  const { user } = useAuth()
  const nav = useNavigate()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locking, setLocking] = useState(false)

  const loadFile = async () => {
    try {
      const { data } = await filesApi.get(fileId)
      setFile(data.file)
    } catch (err) {
      console.error('Get file error:', err)
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFile()
  }, [fileId])

  const download = async () => {
    if (!file) return

    let fileKey
    try {
      const idError = validateFileId(fileId)
      if (idError) {
        toast.error(idError)
        return
      }

      const nonceBase64 = file.nonce || file.fileNonce
      const wrappedKeyBase64 = file.wrappedKey || file.wrapped_key

      if (!nonceBase64 || !wrappedKeyBase64) {
        toast.error('Missing encryption metadata. Cannot decrypt this file.')
        return
      }

      const nonce = base64ToBytes(nonceBase64)
      const password = prompt('Enter your account password to decrypt this file:')
      if (!password) {
        toast.error('Password is required to decrypt Kyber-wrapped files.')
        return
      }

      toast.info('Starting secure download and decryption...')

      const unwrapResult = await unwrapFileKeyWithKyber(wrappedKeyBase64, user?.id, password)
      fileKey = unwrapResult.fileKey

      const { data } = await filesApi.getDownloadUrl(fileId)
      const originalFilename = file.filename || file.name || 'decrypted-file'

      let decryptedFile

      if (data.chunks && data.chunks.length > 0) {
        const decryptedChunksList = []
        
        for (const chunk of data.chunks) {
          const chunkResponse = await fetch(chunk.downloadUrl)
          if (!chunkResponse.ok) {
            throw new Error(`Could not download encrypted chunk ${chunk.chunkIndex} from MinIO.`)
          }
          const chunkEncryptedBlob = await chunkResponse.blob()
          const chunkEncryptedBytes = new Uint8Array(await chunkEncryptedBlob.arrayBuffer())

          const chunkNonce = deriveChunkNonce(nonce, chunk.chunkIndex)
          const decryptedBytes = await decryptChunk(chunkEncryptedBytes, fileKey, chunkNonce)

          const computedHash = ktQhfHashBytes(decryptedBytes)
          if (computedHash !== chunk.chunkHash) {
            throw new Error(`Integrity check failed: chunk ${chunk.chunkIndex} hash mismatch.`)
          }

          decryptedChunksList.push(decryptedBytes)
        }

        decryptedFile = new File(decryptedChunksList, originalFilename)
      } else {
        // Fallback for older non-chunked files
        const downloadUrl = data.downloadUrl || data.url
        if (!downloadUrl) {
          throw new Error('Download URL was not returned by backend.')
        }

        const response = await fetch(downloadUrl)
        if (!response.ok) {
          throw new Error('Could not download encrypted file from MinIO.')
        }

        const encryptedBlob = await response.blob()
        const arrayBuffer = await encryptedBlob.arrayBuffer()
        const encryptedBytes = new Uint8Array(arrayBuffer)
        const decryptedBytes = await decryptChunk(encryptedBytes, fileKey, nonce)

        decryptedFile = new File([decryptedBytes], originalFilename)
      }

      const objectUrl = URL.createObjectURL(decryptedFile)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = originalFilename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)

      toast.success('File downloaded and decrypted locally.')
      } catch (err) {
        console.error('Download/decryption error:', err)
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Download/decryption failed.'
        toast.error(msg)
      } finally {
        if (fileKey) {
          zeroize(fileKey)
          fileKey = null
        }
      }
  }

  const del = async () => {
    try {
      await filesApi.delete(fileId)
      toast.success('File removed.')
      refresh()
      if (!embedded) nav('/files')
    } catch {
      toast.error('Delete failed.')
    }
  }

  const handleReplaceFile = async () => {
    setLocking(true)
    try {
      const { data } = await filesApi.lockFile(fileId)
      if (data.locked) {
        toast.error(`This file is currently being edited by ${data.lockedBy}.`)
        return
      }
      toast.success('Lock acquired. Redirecting to upload interface...')
      nav('/upload', { state: { fileId, filename: file.filename || file.name } })
    } catch (err) {
      console.error('Lock error:', err)
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Could not acquire lock.'
      toast.error(msg)
    } finally {
      setLocking(false)
    }
  }

  const [showReviewMenu, setShowReviewMenu] = useState(false)

  const handleReview = async (status) => {
    try {
      await filesApi.reviewFile(fileId, status)
      toast.success(`File successfully marked as ${status}.`)
      loadFile()
    } catch (err) {
      console.error('Review error:', err)
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Could not complete review.'
      toast.error(msg)
    }
  }

  if (loading) return <Loader />
  if (!file) return (
    <div className="text-center py-10">
      <p className="text-slate-400">File not found or you don't have access.</p>
      {!embedded && <Link to="/files" className="text-cyan-300 text-sm">Back to files</Link>}
    </div>
  )

  const isOwner = file.permission === 'owner'
  const canWriteAccess = canWrite(file.permission)
  const canShareAccess = canShare(file.permission)
  const canReviewAccess = canReview(file.permission)
  const isLocked = !!file.lock

  const Row = ({ label, value, mono }) => (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-white/5 last:border-b-0">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className={`text-sm text-slate-200 text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )

  return (
    <div className="space-y-5">
      {!embedded && (
        <Link to="/files" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to files
        </Link>
      )}

      <GlassCard>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-white break-all">{file.filename || file.name}</h2>
            <p className="text-xs text-slate-500 font-mono mt-1">{fileId}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status="encrypted" />
              <StatusBadge status="zk" />
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isLocked ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}>
                {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                {isLocked ? `Locked by ${file.lock.lockedBy}` : 'Available for edit'}
              </span>
              <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-300 border border-violet-500/30">
                {getPermissionLabel(file.permission)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button icon={Download} onClick={download}>
              Download
            </Button>
            
            {canWriteAccess && (
              <Button
                variant="secondary"
                icon={isLocked ? Lock : Unlock}
                onClick={handleReplaceFile}
                loading={locking}
                disabled={isLocked && file.lock.lockedBy !== user?.username}
              >
                Upload New Version
              </Button>
            )}

            {canShareAccess && (
              <Button
                variant="secondary"
                icon={Share2}
                onClick={() => nav('/shared', { state: { shareFile: file } })}
              >
                Share
              </Button>
            )}

            {canReviewAccess && (
              <div className="relative inline-block">
                <Button variant="secondary" icon={Eye} onClick={() => setShowReviewMenu(!showReviewMenu)}>
                  Review
                </Button>
                {showReviewMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-slate-850 ring-1 ring-black ring-opacity-5 z-50 border border-white/10 backdrop-blur-md">
                    <div className="py-1" role="menu">
                      <button
                        onClick={() => { handleReview('reviewed'); setShowReviewMenu(false); }}
                        className="block w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        Mark as Reviewed
                      </button>
                      <button
                        onClick={() => { handleReview('approved'); setShowReviewMenu(false); }}
                        className="block w-full text-left px-4 py-2 text-sm text-emerald-400 hover:bg-slate-700 transition-colors"
                      >
                        Approve File
                      </button>
                      <button
                        onClick={() => { handleReview('rejected'); setShowReviewMenu(false); }}
                        className="block w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-slate-700 transition-colors"
                      >
                        Reject File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isOwner && (
              <Button variant="danger" icon={Trash2} onClick={del}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard>
          <h3 className="font-display text-lg text-white flex items-center gap-2"><Lock className="h-4 w-4 text-cyan-300"/> File Information</h3>
          <dl className="mt-3">
            <Row label="Original filename" value={file.filename || file.name} />
            <Row label="Size" value={formatBytes(file.size || file.size_bytes || 0)} />
            <Row label="Type" value={file.type || 'application/octet-stream'} />
            <Row label="Created at" value={formatDate(file.createdAt || file.created_at)} />
            <Row label="Total chunks" value={file.totalChunks ?? file.total_chunks ?? 1} />
          </dl>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display text-lg text-white flex items-center gap-2"><Server className="h-4 w-4 text-violet-300"/> Storage</h3>
          <dl className="mt-3">
            <Row label="Bucket" value="ngcloud-vault" />
            <Row label="Object path" value={file.minioPath || file.minio_path || `ngcloud-vault/${fileId}.enc`} mono />
            <Row label="Storage type" value="Encrypted object chunks" />
            <Row label="Cluster" value="MinIO · Local Network" />
          </dl>
        </GlassCard>

        <GlassCard>
          <h3 className="font-display text-lg text-white flex items-center gap-2"><Database className="h-4 w-4 text-emerald-300"/> Ownership & Access</h3>
          <dl className="mt-3">
            <Row label="Owner ID" value={file.ownerId || file.owner_id} mono />
            <Row label="Your Role" value={getPermissionLabel(file.permission)} />
            {canReviewAccess && (
              <Row label="Review Access" value={<span className="text-amber-300 text-xs font-semibold">Allowed</span>} />
            )}
            <Row label="Lock Reason" value={isLocked ? file.lock.lockReason : '—'} />
          </dl>
        </GlassCard>

        <GlassCard className="border-cyan-500/30">
          <h3 className="font-display text-lg text-white flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300"/> Encryption</h3>
          <dl className="mt-3">
            <Row label="File status" value={<StatusBadge status="encrypted" />} />
            <Row label="Algorithm" value={file.algorithm || 'FS-MLWE-SC-256'} />
            <Row label="Key storage" value="Wrapped with Kyber (ML-KEM-768)" />
            <Row label="Plaintext key exposure" value={<StatusBadge status="denied" label="None" />} />
            <Row label="Integrity assurance" value="KT-QHF Hashes manifest" />
          </dl>
        </GlassCard>
      </div>
    </div>
  )
}
