import { useMemo, useState } from 'react'
import { Search, UploadCloud, RefreshCw } from 'lucide-react'
import Button from '../../components/common/Button'
import FileTable from '../../components/client/FileTable'
import EmptyState from '../../components/common/EmptyState'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Loader from '../../components/common/Loader'
import { useFiles } from '../../hooks/useFiles'
import { filesApi } from '../../api/filesApi'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { validateFileId, sanitizeSearchQuery } from '../../utils/validation'
import { decryptFile, decryptChunk, deriveChunkNonce, base64ToBytes } from '../../crypto/fsmlweCipher'
import { useAuth } from '../../context/AuthContext'
import { unwrapFileKeyWithKyber } from '../../crypto/kyberKeyManager'
import { ktQhfHashBytes } from '../../crypto/ktqhf'
import { zeroize } from '../../crypto/CryptoService'

export default function Files() {
  const { user } = useAuth()
  const { files, loading, refresh } = useFiles()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('date')
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)

  const filtered = useMemo(() => {
    const safeQ = sanitizeSearchQuery(q).toLowerCase()

    let arr = files.filter((f) =>
      (f.filename || f.name || '').toLowerCase().includes(safeQ)
    )

    if (sort === 'date') {
      arr = arr
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.created_at || 0) -
            new Date(a.createdAt || a.created_at || 0)
        )
    }

    if (sort === 'size') {
      arr = arr
        .slice()
        .sort((a, b) => (b.size || b.size_bytes || 0) - (a.size || a.size_bytes || 0))
    }

    if (sort === 'name') {
      arr = arr
        .slice()
        .sort((a, b) =>
          (a.filename || a.name || '').localeCompare(b.filename || b.name || '')
        )
    }

    return arr
  }, [files, q, sort])

  const onDownload = async (f) => {
    const fileId = f.fileId || f.id

    try {
      const idError = validateFileId(fileId)
      if (idError) {
        toast.error(idError)
        return
      }

      const nonceBase64 = f.nonce || f.fileNonce
      const wrappedKeyBase64 = f.wrappedKey || f.wrapped_key

      if (!nonceBase64 || !wrappedKeyBase64) {
        toast.error('Missing encryption metadata. Cannot decrypt this file.')
        return
      }

      // --- Kyber vs legacy key detection ---
      // Kyber-wrapped keys are Base64-encoded JSON objects.
      // Legacy keys are direct Base64-encoded raw file key bytes.
      const nonce = base64ToBytes(nonceBase64)
      let fileKey
      let isKyberWrapped = false

      try {
        const decoded = atob(wrappedKeyBase64)
        const trimmed = decoded.trimStart()
        if (trimmed.startsWith('{')) {
          const parsed = JSON.parse(decoded)
          if (parsed.kem && parsed.kemCiphertext) {
            isKyberWrapped = true
          }
        }
      } catch {
        // Not JSON — treat as legacy Base64 file key
      }

      if (isKyberWrapped) {
        // ML-KEM/Kyber decapsulation path
        const password = prompt(
          'Enter your account password to decrypt this file:'
        ) || 'P@ssword123!'

        if (!password) {
          toast.error('Password is required to decrypt Kyber-wrapped files.')
          return
        }

        const userId = user?.id
        if (!userId) {
          toast.error('User session is missing. Please log in again.')
          return
        }

        const unwrapResult = await unwrapFileKeyWithKyber(wrappedKeyBase64, userId, password)
        fileKey = unwrapResult.fileKey
      } else {
        // Legacy path — raw Base64 file key
        fileKey = base64ToBytes(wrappedKeyBase64)
      }

      setDownloadingId(fileId)

      const { data } = await filesApi.getDownloadUrl(fileId)
      
      const originalFilename =
        f.originalFilename ||
        f.original_filename ||
        f.originalName ||
        f.filename?.replace(/\.enc$/i, '') ||
        f.name?.replace(/\.enc$/i, '') ||
        'decrypted-file'

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

        decryptedFile = await decryptFile(
          encryptedBlob,
          fileKey,
          nonce,
          originalFilename
        )
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

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Download/decryption failed.'

      toast.error(msg)
    } finally {
      setDownloadingId(null)
      if (fileKey) {
        zeroize(fileKey)
        fileKey = null
      }
    }
  }

  const onDelete = (f) => {
    setToDelete(f)
  }

  const confirmDelete = async () => {
    if (!toDelete) return

    setDeleting(true)

    try {
      const fileId = toDelete.fileId || toDelete.id
      const idError = validateFileId(fileId)

      if (idError) {
        toast.error(idError)
        return
      }

      await filesApi.delete(fileId)

      toast.success('File removed from encrypted vault.')
      setToDelete(null)
      refresh()
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  const onShare = () => {
    toast.info('Secure sharing wraps the key for the recipient — coming soon.')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-10"
            placeholder="Search encrypted files…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          className="input md:w-44"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date">Sort: Date</option>
          <option value="size">Sort: Size</option>
          <option value="name">Sort: Name</option>
        </select>

        <Button variant="secondary" icon={RefreshCw} onClick={refresh}>
          Refresh
        </Button>

        <Link to="/upload">
          <Button icon={UploadCloud}>Upload</Button>
        </Link>
      </div>

      {loading ? (
        <Loader label="Loading encrypted vault…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No encrypted files yet."
          description="Upload your first secure file to NGCloud."
          action={
            <Link to="/upload">
              <Button icon={UploadCloud}>Upload Encrypted File</Button>
            </Link>
          }
        />
      ) : (
        <FileTable
          files={filtered}
          onDownload={onDownload}
          onDelete={onDelete}
          onShare={onShare}
          downloadingId={downloadingId}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete encrypted file?"
        description={`This will remove the encrypted object “${
          toDelete?.filename || toDelete?.name || ''
        }” from MinIO and its metadata from PostgreSQL. This cannot be undone.`}
        confirmText="Delete"
        loading={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}