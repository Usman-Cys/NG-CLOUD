import { useState } from 'react'
import StatusBadge from '../common/StatusBadge'
import { Download, Eye, X, Lock, Unlock, FileText, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBytes } from '../../utils/formatBytes'
import { formatDate } from '../../utils/formatDate'
import { getFileIcon } from '../../utils/fileHelpers'
import { filesApi } from '../../api/filesApi'
import { useAuth } from '../../context/AuthContext'
import { base64ToBytes } from '../../crypto/kyberKeyManager'
import { unwrapFileKeyWithKyber } from '../../crypto/kyberKeyManager'
import { decryptChunk, deriveChunkNonce } from '../../crypto/fsmlweCipher'
import { ktQhfHashBytes } from '../../crypto/ktqhf'
import { toast } from 'sonner'
import { zeroize } from '../../crypto/CryptoService'

export default function SharedFilesTable({ rows, canRevoke, onRevoke }) {
  const { user } = useAuth()
  const [downloadingId, setDownloadingId] = useState(null)

  const getPermissionBadge = (perm) => {
    switch (perm) {
      case 'read':
        return <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-300 border border-blue-500/30">Read</span>
      case 'write':
        return <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">Write</span>
      case 'review':
        return <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">Review</span>
      case 'share':
        return <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-300 border border-purple-500/30">Share</span>
      case 'read_write':
        return <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30">Read + Write</span>
      case 'read_review':
        return <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-300 border border-orange-500/30">Read + Review</span>
      case 'full_access':
        return <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-500/30 shadow-glow-cyan">Full Access</span>
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-500/30">{perm}</span>
    }
  }

  const handleDownload = async (r) => {
    const fileId = r.fileId || r.file_id
    const nonceBase64 = r.nonce
    const wrappedKeyBase64 = r.wrapped_key || r.recipientWrappedKey

    if (!nonceBase64 || !wrappedKeyBase64) {
      toast.error('Missing encryption metadata. Cannot decrypt this file.')
      return
    }

    const password = prompt('Enter your account password to decrypt this shared file:')
    if (!password) {
      toast.error('Password is required to decrypt Kyber-wrapped keys.')
      return
    }

    setDownloadingId(fileId)
    toast.info('Starting secure decapsulation and download...')

    let fileKey
    try {
      // 1. Unwrap key locally using recipient private key
      const unwrapResult = await unwrapFileKeyWithKyber(wrappedKeyBase64, user?.id, password)
      fileKey = unwrapResult.fileKey

      // 2. Fetch chunk URLs from backend
      const { data } = await filesApi.getDownloadUrl(fileId)
      
      const originalFilename = r.filename?.replace(/\.enc$/i, '') || 'shared-decrypted-file'
      const nonce = base64ToBytes(nonceBase64)

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

      toast.success('Shared file decrypted and downloaded successfully.')
    } catch (err) {
      console.error('Download/decryption error:', err)
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Download/decryption failed.'
      toast.error(msg)
    } finally {
      setDownloadingId(null)
      if (fileKey) {
        zeroize(fileKey)
        fileKey = null
      }
    }
  }

  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">{canRevoke ? 'Shared with' : 'Owner'}</th>
              <th className="px-4 py-3 hidden md:table-cell">Size</th>
              <th className="px-4 py-3 hidden md:table-cell">Permission</th>
              <th className="px-4 py-3 hidden lg:table-cell">Lock Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                  No shares found in this section.
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const Icon = getFileIcon(r.filename)
                const isLocked = !!r.lock
                const fileId = r.fileId || r.file_id

                return (
                  <tr key={r.id} className="hover:bg-cyan-500/5 group transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate max-w-[200px]">{r.filename}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{fileId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {canRevoke ? r.recipientUsername : r.ownerUsername || 'you'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-300">
                      {formatBytes(r.sizeBytes || 0)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {getPermissionBadge(r.permission)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <Lock className="h-3 w-3" /> Locked by {r.lock.lockedBy}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <Unlock className="h-3 w-3" /> Available
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/file/${fileId}`}
                          className="rounded-lg p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                          title="Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        
                        <button
                          onClick={() => handleDownload(r)}
                          disabled={downloadingId === fileId}
                          className="rounded-lg p-2 text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                          title="Download"
                        >
                          {downloadingId === fileId ? (
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </button>
                        
                        {canRevoke && (
                          <button
                            onClick={() => onRevoke?.(r.id)}
                            className="rounded-lg p-2 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                            title="Revoke Share"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
