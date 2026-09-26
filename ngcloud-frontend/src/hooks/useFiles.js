import { useCallback, useEffect, useState } from 'react'
import { filesApi } from '../api/filesApi'

function normalizeFile(file) {
  if (!file || typeof file !== 'object') return file

  return {
    ...file,
    id: file.id || file.fileId,
    fileId: file.fileId || file.id,
    filename: file.filename || file.name || file.original_name || 'unnamed-file',
    name: file.name || file.filename || file.original_name || 'unnamed-file',
    ownerId: file.ownerId || file.owner_id,
    totalChunks: file.totalChunks ?? file.total_chunks ?? 1,
    minioPath: file.minioPath || file.minio_path,
    createdAt: file.createdAt || file.created_at || file.uploadedAt || file.uploaded_at,
    size: Number(file.size || file.file_size || file.bytes || 0),
  }
}

export function useFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data } = await filesApi.list()
      const list = Array.isArray(data) ? data : (data?.files || data?.items || [])
      setFiles(list.map(normalizeFile))
    } catch (e) {
      setError(e)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { files, loading, error, refresh }
}
