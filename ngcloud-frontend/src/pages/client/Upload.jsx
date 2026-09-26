import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Lock, KeyRound, UploadCloud, Database, Sparkles, AlertCircle } from 'lucide-react'
import GlassCard from '../../components/common/GlassCard'
import UploadBox from '../../components/client/UploadBox'
import Button from '../../components/common/Button'
import { filesApi } from '../../api/filesApi'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { validateFilename } from '../../utils/validation'
import { generateFileKey, generateNonce, deriveChunkNonce, encryptChunk } from '../../crypto/fsmlweCipher'
import { useAuth } from '../../context/AuthContext'
import { wrapFileKeyWithKyber, unwrapFileKeyWithKyber, bytesToBase64, base64ToBytes } from '../../crypto/kyberKeyManager'
import { ktQhfHashBytes, ktQhfInit, ktQhfUpdate, ktQhfFinalize } from '../../crypto/ktqhf'
import { formatBytes } from '../../utils/formatBytes'
import { zeroize } from '../../crypto/CryptoService'

const STEPS = [
  { key: 'prepare', label: 'Preparing file & KT-QHF hashes', icon: Sparkles },
  { key: 'encrypt', label: 'Encrypting locally', icon: Lock },
  { key: 'presign', label: 'Requesting secure upload URLs', icon: KeyRound },
  { key: 'upload', label: 'Uploading encrypted chunks', icon: UploadCloud },
  { key: 'meta', label: 'Saving metadata & manifest', icon: Database },
  { key: 'done', label: 'Complete', icon: CheckCircle2 },
]

export default function Upload({ embedded = false, onComplete }) {
  const { user } = useAuth()
  const location = useLocation()
  const nav = useNavigate()
  
  // Detect if we are replacing an existing file
  const prepopulatedFileId = location.state?.fileId || null
  const prepopulatedFilename = location.state?.filename || null

  const [file, setFile] = useState(null)
  const [stepIdx, setStepIdx] = useState(-1)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [lockAcquired, setLockAcquired] = useState(false)
  const [policy, setPolicy] = useState(null)

  const loadPolicy = () => {
    filesApi.getUploadPolicy()
      .then(({ data }) => setPolicy(data))
      .catch((err) => console.error('Failed to fetch upload policy:', err))
  }

  useEffect(() => {
    loadPolicy()
  }, [])

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // Acquire lock on mount if replacing a file
  useEffect(() => {
    if (prepopulatedFileId) {
      filesApi.lockFile(prepopulatedFileId)
        .then(({ data }) => {
          if (data.locked) {
            toast.error(`This file is currently being edited by ${data.lockedBy}. Redirecting...`)
            setTimeout(() => nav(`/file/${prepopulatedFileId}`), 2500)
          } else {
            setLockAcquired(true)
            toast.success('Editing lock acquired. Your session is protected.')
          }
        })
        .catch((err) => {
          console.error('Lock acquisition error:', err)
          toast.error('Could not acquire editing lock. Redirecting...')
          setTimeout(() => nav(`/file/${prepopulatedFileId}`), 2000)
        })
    }
  }, [prepopulatedFileId, nav])

  // Release lock on unmount/page exit
  useEffect(() => {
    return () => {
      if (prepopulatedFileId && lockAcquired) {
        filesApi.unlockFile(prepopulatedFileId).catch(() => {})
      }
    }
  }, [prepopulatedFileId, lockAcquired])

  const [existingFileDetail, setExistingFileDetail] = useState(null)

  useEffect(() => {
    if (prepopulatedFileId) {
      filesApi.get(prepopulatedFileId)
        .then(({ data }) => {
          if (data && data.file) {
            setExistingFileDetail(data.file)
          }
        })
        .catch((err) => console.error('Failed to fetch existing file details:', err))
    }
  }, [prepopulatedFileId])

  const validateFileSelection = (selectedFile) => {
    if (!selectedFile) return true;

    const maxSizeBytes = 100 * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      toast.error('File is too large. Maximum allowed size is 100 MB.');
      return false;
    }

    const allowedExtensions = policy?.allowedExtensions || [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".zip", ".ppt", ".pptx"];
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast.error('File extension is not allowed.');
      return false;
    }

    if (policy) {
      let remainingSpace = policy.userQuota.remaining;
      if (prepopulatedFileId && existingFileDetail) {
        remainingSpace += existingFileDetail.size;
      }
      if (selectedFile.size > remainingSpace) {
        const remainingMb = (remainingSpace / (1024 * 1024)).toFixed(1);
        toast.error(`Storage quota exceeded. Remaining space: ${remainingMb} MB.`);
        return false;
      }
    }
    return true;
  }

  const resetState = () => {
    setFile(null)
    setStepIdx(-1)
    setDone(false)
    setProgress(0)
  }

  const start = async () => {
    if (!file) return

    const filenameError = validateFilename(file.name)
    if (filenameError) {
      toast.error(filenameError)
      return
    }

    if (!validateFileSelection(file)) {
      return
    }

    setBusy(true)
    setDone(false)
    setProgress(0)

    let fileKey = null

    try {
      const CHUNK_SIZE_4MB = 4 * 1024 * 1024
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE_4MB)

      // Step 2: Request presigned MinIO upload URLs before we start reading
      // (we need fileId and chunkUrls before processing any data)
      setStepIdx(2) // Requesting secure upload URLs
      const encryptedName = `${file.name}.enc`
      const { data } = await filesApi.getUploadUrl(
        encryptedName,
        totalChunks,
        file.size,
        prepopulatedFileId,
        file.name,
        file.type || 'application/octet-stream'
      )

      const fileId = data.fileId || data.id
      const chunkUrls = data.chunkUrls
      const existingFile = data.existingFile

      if (!fileId) {
        throw new Error('File ID was not returned by backend.')
      }

      fileKey = null
      let fileNonce = null
      let useDeltaSync = false

      // Enforce file key reuse if replacing/updating
      if (prepopulatedFileId) {
        if (!existingFile || !existingFile.wrappedKey || !existingFile.nonce) {
          throw new Error('Existing key metadata not returned by backend.')
        }

        const password = prompt(
          'Entering key validation mode. Please enter your account password to verify key ownership and update this file:'
        )
        if (!password) {
          throw new Error('Password verification is required to overwrite this file.')
        }

        try {
          const userId = user?.id || user?.sub
          const unwrapResult = await unwrapFileKeyWithKyber(existingFile.wrappedKey, userId, password)
          fileKey = unwrapResult.fileKey
          fileNonce = base64ToBytes(existingFile.nonce)
          useDeltaSync = true
          toast.info('Reusing existing file key. Incrementally uploading changes...')
        } catch (e) {
          throw new Error('Incorrect password or key decryption failed. Overwrite aborted.')
        }
      } else if (existingFile && existingFile.wrappedKey && existingFile.nonce) {
        // Fallback for default incremental uploads
        const password = prompt(
          'An existing file with the same name was found. Enter your password to update it incrementally, or press Cancel to upload as a new version:'
        )
        if (password) {
          try {
            const userId = user?.id || user?.sub
            const unwrapResult = await unwrapFileKeyWithKyber(existingFile.wrappedKey, userId, password)
            fileKey = unwrapResult.fileKey
            fileNonce = base64ToBytes(existingFile.nonce)
            useDeltaSync = true
            toast.info('Reusing existing file key. Incrementally uploading changes...')
          } catch (e) {
            toast.error('Incorrect password. Performing full re-upload with a new encryption key.')
          }
        }
      }

      if (!useDeltaSync) {
        fileKey = generateFileKey()
        fileNonce = generateNonce()
      }

      // Step 0: Streaming KT-QHF hash + Step 3: encrypt & upload
      // Process ONE chunk at a time — never hold more than ~4 MiB of plaintext.
      setStepIdx(0) // Preparing file & KT-QHF hashes
      await sleep(300)

      // Initialise streaming full-file KT-QHF hasher
      const fileHasher = ktQhfInit()

      setStepIdx(3) // Uploading encrypted chunks
      const uploadedChunks = []
      const chunkProgresses = new Array(totalChunks).fill(0)

      const updateCombinedProgress = () => {
        const sum = chunkProgresses.reduce((a, b) => a + b, 0)
        setProgress(Math.round(sum / totalChunks))
      }

      for (let i = 0; i < totalChunks; i++) {
        const startOffset = i * CHUNK_SIZE_4MB
        const endOffset = Math.min(startOffset + CHUNK_SIZE_4MB, file.size)

        // Read this one chunk only — no large buffers retained between iterations
        const chunkSlice = file.slice(startOffset, endOffset)
        const chunkBuffer = await chunkSlice.arrayBuffer()
        const chunkBytes = new Uint8Array(chunkBuffer)

        // Feed into the running full-file KT-QHF streamer
        ktQhfUpdate(fileHasher, chunkBytes)

        // Compute per-chunk KT-QHF hash (for delta-sync deduplication)
        const plainHash = ktQhfHashBytes(chunkBytes)

        const chunkNonce = deriveChunkNonce(fileNonce, i)

        let minioPath = chunkUrls[i].minioPath
        let uploadUrl = chunkUrls[i].uploadUrl
        let reuse = false

        if (useDeltaSync && existingFile.chunks && existingFile.chunks[i]) {
          const oldChunk = existingFile.chunks[i]
          if (oldChunk.chunkHash === plainHash) {
            minioPath = oldChunk.minioPath
            reuse = true
          }
        }

        let chunkSize

        if (reuse) {
          chunkProgresses[i] = 100
          updateCombinedProgress()
          chunkSize = existingFile.chunks[i].chunkSize
          uploadedChunks.push({
            chunkIndex: i,
            minioPath,
            chunkHash: plainHash,
            chunkSize,
          })
        } else {
          // Encrypt and upload this chunk
          const encryptedBlob = await encryptChunk(chunkBytes, fileKey, chunkNonce)
          chunkSize = encryptedBlob.size

          await filesApi.putToPresigned(
            uploadUrl,
            encryptedBlob,
            (p) => {
              chunkProgresses[i] = p
              updateCombinedProgress()
            }
          )

          uploadedChunks.push({
            chunkIndex: i,
            minioPath,
            chunkHash: plainHash,
            chunkSize,
          })
        }

        // chunkBytes and chunkBuffer go out of scope here — GC can reclaim them
      }

      // Finalise streaming full-file hash — equivalent to KT-QHF(entire plaintext)
      const fullFileHash = ktQhfFinalize(fileHasher)

      // Step 4: save metadata
      setStepIdx(4) // Saving metadata & manifest

      await filesApi.saveFileChunks(fileId, uploadedChunks)

      const kyberPublicKey = user?.kyberPublicKey || user?.kyber_public_key
      if (!kyberPublicKey) {
        throw new Error('Kyber public key is missing. Please log out and back in to generate keys.')
      }

      const wrappedKey = await wrapFileKeyWithKyber(fileKey, kyberPublicKey)
      const totalEncryptedSize = uploadedChunks.reduce((sum, c) => sum + c.chunkSize, 0)

      await filesApi.saveMetadata({
        fileId,
        status: 'uploaded',
        size: totalEncryptedSize,
        totalChunks,
        chunkSize: CHUNK_SIZE_4MB,
        originalFilename: file.name,
        encryptedFilename: encryptedName,
        algorithm: 'FS-MLWE-SC-256',
        nonce: bytesToBase64(fileNonce),
        wrappedKey,
        fileHash: fullFileHash,
        isReplace: !!prepopulatedFileId,
      })

      // If lock was acquired, release it immediately on completion
      if (prepopulatedFileId) {
        await filesApi.unlockFile(prepopulatedFileId).catch(() => {})
      }

      loadPolicy()
      await sleep(300)
      setStepIdx(5)
      setDone(true)

      toast.success('Encrypted file version uploaded successfully.')
      
      if (prepopulatedFileId) {
        setTimeout(() => nav(`/file/${prepopulatedFileId}`), 1500)
      } else {
        onComplete?.(fileId)
      }
    } catch (err) {
      console.error('Upload error:', err)
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Upload failed.'
      toast.error(msg)
      setStepIdx(-1)
    } finally {
      setBusy(false)
      if (fileKey) {
        zeroize(fileKey)
        fileKey = null
      }
    }
  }

  return (
    <div className={embedded ? '' : 'space-y-6'}>
      <div>
        <h2 className="font-display text-2xl text-white">
          {prepopulatedFileId ? 'Upload New Version' : 'Encrypted Upload'}
        </h2>
        <p className="text-sm text-slate-400">
          {prepopulatedFileId 
            ? `Replacing contents for file: ${prepopulatedFilename || prepopulatedFileId}`
            : 'Your file is encrypted in your browser before any byte leaves your device.'
          }
        </p>
      </div>

      {prepopulatedFileId && (
        <GlassCard className="border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm text-amber-300 font-semibold">Protected Lock Mode Active</p>
              <p className="text-xs text-slate-400 mt-1">
                You have acquired the editing lease for this file. Leaving this page or cancelling the upload will automatically release the lock.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className={embedded ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
        <div className={embedded ? '' : 'lg:col-span-2 space-y-6'}>
          <GlassCard hover={false}>
            <UploadBox
              file={file}
              onFile={(selectedFile) => {
                if (selectedFile && !validateFileSelection(selectedFile)) {
                  return
                }
                setFile(selectedFile)
                setStepIdx(-1)
                setDone(false)
                setProgress(0)
              }}
              disabled={busy}
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!file || busy}
                onClick={resetState}
              >
                Clear
              </Button>

              <Button
                type="button"
                disabled={!file || busy}
                loading={busy}
                onClick={start}
                icon={UploadCloud}
              >
                {done ? 'Upload Again' : prepopulatedFileId ? 'Encrypt & Replace File' : 'Encrypt & Upload'}
              </Button>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <h3 className="font-display text-lg text-white">Pipeline</h3>

            <ol className="mt-4 space-y-2">
              {STEPS.map((s, i) => {
                const active = i === stepIdx
                const completed = i < stepIdx || done
                const Icon = s.icon

                return (
                  <motion.li
                    key={s.key}
                    animate={{
                      opacity: active || completed || stepIdx === -1 ? 1 : 0.55,
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                      completed
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : active
                          ? 'border-cyan-500/40 bg-cyan-500/5 shadow-glow-cyan'
                          : 'border-white/5 bg-slate-900/40'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-1.5 ${
                        completed
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : active
                            ? 'bg-cyan-500/15 text-cyan-300'
                            : 'bg-slate-700/40 text-slate-400'
                      }`}
                    >
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>

                    <span className="flex-1 text-sm text-slate-200">
                      {s.label}
                    </span>

                    {active && s.key === 'upload' && (
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-violet-400"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}

                    {active && s.key === 'upload' && (
                      <span className="w-10 text-right text-xs text-cyan-300">
                        {progress}%
                      </span>
                    )}
                  </motion.li>
                )
              })}
            </ol>

            <p className="mt-4 text-[11px] text-slate-500">
              Backend never receives plaintext. Presigned URLs grant temporary, scoped access to MinIO.
            </p>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard hover={false} className="border-cyan-500/10">
            <h3 className="font-display text-base font-semibold text-white mb-4">Upload Policy</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Maximum file size:</span>
                <span className="font-semibold text-white">100 MB</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Storage used:</span>
                <span className="font-semibold text-white">
                  {policy ? `${formatBytes(policy.userQuota.used)} / ${formatBytes(policy.userQuota.quota)}` : 'Loading...'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Remaining space:</span>
                <span className="font-semibold text-emerald-400">
                  {policy ? formatBytes(policy.userQuota.remaining) : 'Loading...'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1.5">Allowed file types:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(policy?.allowedExtensions || [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".zip", ".ppt", ".pptx"]).map((ext) => (
                    <span key={ext} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/10 uppercase">
                      {ext.replace('.', '')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}