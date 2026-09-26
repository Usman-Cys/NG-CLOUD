import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import GlassCard from '../../components/common/GlassCard'
import SharedFilesTable from '../../components/client/SharedFilesTable'
import Button from '../../components/common/Button'
import Loader from '../../components/common/Loader'
import { Info, Plus, X, Search, Shield, KeyRound, AlertCircle } from 'lucide-react'
import { filesApi } from '../../api/filesApi'
import { useAuth } from '../../context/AuthContext'
import { unwrapFileKeyWithKyber, wrapFileKeyWithKyber } from '../../crypto/kyberKeyManager'
import { toast } from 'sonner'
import { zeroize } from '../../crypto/CryptoService'

export default function Shared() {
  const { user } = useAuth()
  const location = useLocation()
  
  const [tab, setTab] = useState('with') // 'with' (Shared With Me) or 'by' (Shared By Me)
  const [sharedWithMe, setSharedWithMe] = useState([])
  const [sharedByMe, setSharedByMe] = useState([])
  const [ownerFiles, setOwnerFiles] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedFileId, setSelectedFileId] = useState('')
  const [recipientUsername, setRecipientUsername] = useState('')
  const [recipientSuggestions, setRecipientSuggestions] = useState([])
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [permission, setPermission] = useState('read')
  const [password, setPassword] = useState('')
  const [sharing, setSharing] = useState(false)

  // Fetch all share data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [withRes, byRes, filesRes] = await Promise.all([
        filesApi.sharesSharedWithMe(),
        filesApi.sharesSharedByMe(),
        filesApi.list()
      ])
      
      setSharedWithMe(withRes.data.shares || [])
      setSharedByMe(byRes.data.shares || [])
      setOwnerFiles(filesRes.data.files || [])
      
      // Auto select first file if available
      if (filesRes.data.files?.length > 0) {
        setSelectedFileId(filesRes.data.files[0].id || filesRes.data.files[0].fileId)
      }
    } catch (err) {
      console.error('Fetch shares error:', err)
      toast.error('Could not load sharing data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Check if redirect has pre-selected file to share
    if (location.state?.shareFile) {
      const f = location.state.shareFile
      setSelectedFileId(f.id || f.fileId)
      setModalOpen(true)
      setTab('by')
    }
  }, [location.state])

  // Search users as the owner types
  useEffect(() => {
    if (recipientUsername.trim().length < 2) {
      setRecipientSuggestions([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await filesApi.usersSearch(recipientUsername)
        setRecipientSuggestions(data.users || [])
      } catch (err) {
        console.error('User search error:', err)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [recipientUsername])

  // Filter out users already selected or already shared on this file
  const filteredSuggestions = recipientSuggestions.filter(
    (u) =>
      !selectedRecipients.some((r) => r.id === u.id) &&
      !sharedByMe.some((s) => s.fileId === selectedFileId && s.recipientId === u.id)
  )

  const handleSelectRecipient = (u) => {
    if (selectedRecipients.some((r) => r.id === u.id)) {
      toast.error('Recipient is already selected.')
      return
    }

    if (selectedRecipients.length >= 5) {
      toast.error('Cannot share with more than 5 recipients at once.')
      return
    }

    const alreadyShared = sharedByMe.some(
      (s) => s.fileId === selectedFileId && s.recipientId === u.id
    )
    if (alreadyShared) {
      toast.error(`File is already shared with ${u.username}.`)
      return
    }

    setSelectedRecipients((prev) => [...prev, u])
    setRecipientUsername('')
    setRecipientSuggestions([])
  }

  const handleRemoveRecipient = (id) => {
    setSelectedRecipients((prev) => prev.filter((x) => x.id !== id))
  }

  const handleShareSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedFileId) {
      toast.error('Please select a file to share.')
      return
    }
    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient.')
      return
    }
    if (selectedRecipients.length > 5) {
      toast.error('Cannot share with more than 5 recipients at once.')
      return
    }
    if (!password) {
      toast.error('Owner password is required to decrypt Kyber private key.')
      return
    }

    let fileKey
    setSharing(true)
    try {
      const selectedFile = ownerFiles.find(f => (f.id || f.fileId) === selectedFileId)
      if (!selectedFile) {
        throw new Error('Selected file not found in owner library.')
      }

      // Step 1: Unlock owner private key & unwrap file key ONCE
      const wrappedKey = selectedFile.wrappedKey || selectedFile.wrapped_key
      if (!wrappedKey) {
        throw new Error('Encryption key for selected file is missing on backend.')
      }

      toast.info('Decrypting your file key locally...')
      const unwrapResult = await unwrapFileKeyWithKyber(wrappedKey, user?.id, password)
      fileKey = unwrapResult.fileKey

      // Step 2: Wrap the file key separately for each selected recipient
      toast.info('Encrypting key for all recipients locally...')
      const sharesPayload = []
      for (const recipient of selectedRecipients) {
        const recipientWrappedKey = await wrapFileKeyWithKyber(fileKey, recipient.kyberPublicKey)
        sharesPayload.push({
          recipientId: recipient.id,
          recipientWrappedKey
        })
      }

      // Step 3: Send batch share request
      const { data } = await filesApi.sharesCreateBatch({
        fileId: selectedFileId,
        permission,
        shares: sharesPayload
      })

      toast.success(data.message || `File shared with ${selectedRecipients.length} users successfully.`)
      setModalOpen(false)
      setPassword('')
      setRecipientUsername('')
      setSelectedRecipients([])
      fetchData()
    } catch (err) {
      console.error('Sharing error:', err)
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Sharing failed.'
      toast.error(msg)
    } finally {
      setSharing(false)
      if (fileKey) {
        zeroize(fileKey)
        fileKey = null
      }
    }
  }

  const handleRevokeShare = async (shareId) => {
    try {
      await filesApi.sharesDelete(shareId)
      toast.success('Access revoked successfully.')
      fetchData()
    } catch (err) {
      console.error('Revoke error:', err)
      toast.error('Could not revoke access.')
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard hover={false}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-cyan-300 mt-0.5" />
          <div>
            <p className="text-sm text-slate-300 font-semibold">Zero-Knowledge Multi-Recipient Sharing</p>
            <p className="text-xs text-slate-400 mt-1">
              Plaintext file keys are never sent to the backend. Your password unlocks your Kyber private key once
              to recover the file key in memory. The key is then re-wrapped individually for up to 5 recipients.
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {[['with', 'Shared With Me'], ['by', 'Shared By Me']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                tab === k
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'by' && (
          <Button icon={Plus} onClick={() => setModalOpen(true)}>
            Add Share
          </Button>
        )}
      </div>

      {loading ? (
        <Loader label="Syncing secure shares..." />
      ) : tab === 'with' ? (
        <SharedFilesTable
          rows={sharedWithMe}
          canRevoke={false}
          onRevoke={handleRevokeShare}
          refresh={fetchData}
        />
      ) : (
        <SharedFilesTable
          rows={sharedByMe}
          canRevoke={true}
          onRevoke={handleRevokeShare}
          refresh={fetchData}
        />
      )}

      {/* SHARE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-strong w-full max-w-lg overflow-hidden relative p-6 space-y-4 shadow-2xl border border-white/10 rounded-2xl">
            <button
              onClick={() => {
                setModalOpen(false)
                setPassword('')
                setRecipientUsername('')
                setSelectedRecipients([])
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Shield className="h-5 w-5 text-cyan-400" />
              <h3 className="font-display text-lg text-white">Share Secure Vault File</h3>
            </div>

            <form onSubmit={handleShareSubmit} className="space-y-4">
              {/* 1. File Selector */}
              <div>
                <label className="label">1. Select Encrypted File</label>
                <div className="relative">
                  <select
                    className="input appearance-none bg-slate-900"
                    value={selectedFileId}
                    onChange={(e) => {
                      setSelectedFileId(e.target.value)
                      setSelectedRecipients([]) // Reset selected recipients on file change to avoid invalid duplicates
                    }}
                    required
                  >
                    {ownerFiles.length === 0 ? (
                      <option value="">(No files found to share)</option>
                    ) : (
                      ownerFiles.map((f) => (
                        <option key={f.id || f.fileId} value={f.id || f.fileId}>
                          {f.filename || f.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* 2. Recipient Username Search and Chip List */}
              <div className="relative">
                <div className="flex justify-between items-center">
                  <label className="label">2. Search Recipients</label>
                  <span className="text-xs text-slate-400 font-semibold mb-2">
                    Selected recipients: {selectedRecipients.length}/5
                  </span>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-10"
                    placeholder={selectedRecipients.length >= 5 ? 'Maximum limit of 5 recipients reached' : 'Search users by username...'}
                    value={recipientUsername}
                    onChange={(e) => setRecipientUsername(e.target.value)}
                    disabled={selectedRecipients.length >= 5}
                  />
                </div>

                {/* Autocomplete suggestions */}
                {filteredSuggestions.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1.5 rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-2xl backdrop-blur-md max-h-40 overflow-y-auto">
                    {filteredSuggestions.map((u) => (
                      <li
                        key={u.id}
                        onClick={() => handleSelectRecipient(u)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-300 cursor-pointer transition"
                      >
                        <Shield className="h-3.5 w-3.5 text-cyan-400" />
                        <span>{u.username}</span>
                        <span className="text-[10px] text-slate-500 truncate ml-auto">
                          Kyber PK: {u.kyberPublicKey?.slice(0, 12)}...
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {recipientUsername && filteredSuggestions.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    No match found (or already selected/shared with this user).
                  </p>
                )}

                {/* Selected chips list */}
                {selectedRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 p-2 rounded-xl bg-slate-950/40 border border-white/5">
                    {selectedRecipients.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs text-cyan-300 font-medium"
                      >
                        {r.username}
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(r.id)}
                          className="hover:bg-cyan-500/20 rounded-full p-0.5 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Permission Dropdown */}
              <div>
                <label className="label">3. Share Permissions (Applies to all selected)</label>
                <select
                  className="input appearance-none bg-slate-900"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                >
                  <option value="read">Read (Download Only)</option>
                  <option value="write">Write (Download + Update)</option>
                  <option value="review">Review (Download + Review)</option>
                  <option value="share">Share (Download + Re-share)</option>
                  <option value="read_write">Read + Write</option>
                  <option value="read_review">Read + Review</option>
                  <option value="full_access">Full Access (All Actions)</option>
                </select>
              </div>

              {/* 4. Owner Password */}
              <div>
                <label className="label">4. Your Account Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    className="input pl-10"
                    placeholder="Enter password to unlock your private key..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Used locally to unlock your post-quantum private key to decapsulate the file key.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={sharing}
                  onClick={() => {
                    setModalOpen(false)
                    setPassword('')
                    setRecipientUsername('')
                    setSelectedRecipients([])
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={sharing}
                  disabled={sharing || selectedRecipients.length === 0}
                  icon={Shield}
                >
                  Share File
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
