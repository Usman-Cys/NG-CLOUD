import axiosClient from './axiosClient'
import axios from 'axios'

export const filesApi = {
  list: () => axiosClient.get('/api/files'),
  get: (id) => axiosClient.get(`/api/files/${id}`),
  getUploadPolicy: () => axiosClient.get('/api/policy/upload'),
  getUploadUrl: (filename, totalChunks = 1, size = 0, fileId = null, originalFilename = '', mimeType = '') =>
    axiosClient.post('/api/files/upload-url', { filename, totalChunks, size, fileId, originalFilename, mimeType }),
  saveMetadata: (data) => axiosClient.post('/api/files/metadata', data),
  saveFileChunks: (fileId, chunks) => axiosClient.post(`/api/files/${fileId}/chunks`, { chunks }),
  getDownloadUrl: (fileId) => axiosClient.post('/api/files/download-url', { fileId }),
  delete: (fileId) => axiosClient.delete(`/api/files/${fileId}`),
  shared: () => axiosClient.get('/api/files/shared'),
  sharesSharedByMe: () => axiosClient.get('/api/shares/shared-by-me'),
  sharesSharedWithMe: () => axiosClient.get('/api/shares/shared-with-me'),
  sharesCreate: (data) => axiosClient.post('/api/shares', data),
  sharesCreateBatch: (data) => axiosClient.post('/api/shares/batch', data),
  sharesDelete: (shareId) => axiosClient.delete(`/api/shares/${shareId}`),
  usersSearch: (query) => axiosClient.get(`/api/users/search?q=${encodeURIComponent(query)}`),
  lockFile: (fileId) => axiosClient.post(`/api/files/${fileId}/lock`),
  unlockFile: (fileId) => axiosClient.delete(`/api/files/${fileId}/lock`),
  reviewFile: (fileId, status) => axiosClient.post(`/api/files/${fileId}/review`, { status }),
  getActivity: (params) => axiosClient.get('/api/activity', { params }),
  // Raw PUT to MinIO presigned URL (no backend JWT header)
  putToPresigned: (url, blob, onProgress) =>
    axios.put(url, blob, {
      headers: { 'Content-Type': blob?.type || 'application/octet-stream' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    }),
}
