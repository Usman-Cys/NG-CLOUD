export function validateUsername(username) {
  const value = String(username || '').trim()
  if (!value) return 'Username is required'
  if (value.length < 3 || value.length > 30) return 'Username must be 3 to 30 characters'
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Username can only contain letters, numbers, dot, dash, and underscore'
  return null
}

export function validatePassword(password) {
  if (!password) return 'Password is required'
  if (String(password).length < 8) return 'Password must be at least 8 characters'
  if (String(password).length > 128) return 'Password is too long'
  return null
}

export function validateFilename(filename) {
  const value = String(filename || '').trim()
  if (!value) return 'Filename is required'
  if (value.length > 180) return 'Filename is too long'
  if (value.includes('../') || value.includes('..\\') || value.includes('/') || value.includes('\\')) return 'Filename cannot contain path separators'
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(value)) return 'Filename contains invalid characters'
  return null
}

export function validateFileId(fileId) {
  const value = String(fileId || '').trim()
  if (!value) return 'File ID is required'
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(value)) return 'Invalid file ID format'
  return null
}

export function sanitizeSearchQuery(query) {
  return String(query || '').replace(/[<>]/g, '').slice(0, 80)
}
