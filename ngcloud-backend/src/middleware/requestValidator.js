const pool = require('../config/db');
const { logActivity } = require('../services/activityLogger');
const { getAllowedExtensions, getAllowedMimeTypes, getMaxFileSizeBytes } = require('../utils/filePolicy');
const { validatePassword } = require('../utils/validation');
const { logAction } = require('../utils/auditLogger');

// Help log security anomalies without logging sensitive data like passwords or keys
async function logSecurityEvent(req, action, description, metadata = {}) {
  const userId = req.user ? req.user.id : null;
  const isAdmin = req.user && req.user.role === 'admin';
  console.warn(`[SECURITY ALERT] Action: ${action} | Description: ${description} | IP: ${req.ip} | User: ${userId || 'unauthenticated'}`);
  
  const logUserId = isAdmin ? null : userId;
  const logAdminId = isAdmin ? userId : null;
  
  await logAction(
    logUserId,
    logAdminId,
    `SEC_${action}`,
    'denied',
    req.ip,
    { ...metadata, description, userAgent: req.headers['user-agent'] }
  );
}

// Check for Prototype Pollution in URL or parsed JSON body
function hasPrototypePollution(req) {
  const rawUrl = decodeURIComponent(req.url || '');
  if (rawUrl.includes('__proto__') || rawUrl.includes('constructor') || rawUrl.includes('prototype')) {
    return true;
  }
  if (req.body) {
    try {
      const bodyStr = JSON.stringify(req.body);
      if (bodyStr.includes('"__proto__"') || bodyStr.includes('"constructor"') || bodyStr.includes('"prototype"')) {
        return true;
      }
    } catch (e) {
      return true;
    }
  }
  return false;
}

// Check UUID format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

// Check Base64 format
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;
function isBase64(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (s.length === 0) return false;
  if (s.length % 4 !== 0) return false;
  return BASE64_REGEX.test(s);
}

// Check allowed filenames & extensions & double extensions
const FILENAME_REGEX = /^[a-zA-Z0-9._ -]+$/;
function validateFilenameAndExtension(filename) {
  if (typeof filename !== 'string') return 'Filename must be a string';
  const name = filename.trim();
  if (name.length === 0) return 'Filename cannot be empty';
  if (name.length > 180) return 'Filename is too long';
  if (name.includes('../') || name.includes('..\\') || name.includes('/') || name.includes('\\')) {
    return 'Path traversal attempts are forbidden';
  }
  if (!FILENAME_REGEX.test(name)) {
    return 'Filename contains forbidden characters';
  }
  
  let checkName = name;
  if (checkName.toLowerCase().endsWith('.enc')) {
    checkName = checkName.slice(0, -4);
  }
  
  const parts = checkName.split('.');
  if (parts.length > 2) {
    return 'Double extensions are prohibited for security';
  }
  
  if (parts.length > 1) {
    const ext = '.' + parts.pop().toLowerCase();
    const allowed = getAllowedExtensions();
    if (!allowed.includes(ext)) {
      return `File extension ${ext} is not allowed`;
    }
  }
  return null;
}

// Validate Key wrapping envelope (Decapsulates and verifies length checks)
function validateWrappedKey(wrappedKey) {
  if (!isBase64(wrappedKey)) {
    return { ok: false, error: 'Wrapped key is not valid Base64' };
  }
  try {
    const decoded = Buffer.from(wrappedKey, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Wrapped key JSON is not an object' };
    }
    const { version, kem, wrapCipher } = parsed;
    if (version !== 1 && version !== 2) {
      return { ok: false, error: `Unsupported wrapped key version: ${version}` };
    }
    if (version === 2) {
      if (kem !== 'ML-KEM-768') {
        return { ok: false, error: `Unsupported KEM algorithm: ${kem}` };
      }
      if (wrapCipher !== 'Ascon-128a') {
        return { ok: false, error: `Unsupported wrap cipher: ${wrapCipher}` };
      }
      if (!parsed.nonce || !isBase64(parsed.nonce)) {
        return { ok: false, error: 'Missing or invalid nonce in container' };
      }
      if (Buffer.from(parsed.nonce, 'base64').length !== 16) {
        return { ok: false, error: 'Invalid nonce length (should be 16 bytes)' };
      }
      if (!parsed.kemCiphertext || !isBase64(parsed.kemCiphertext)) {
        return { ok: false, error: 'Missing or invalid kemCiphertext in container' };
      }
      if (Buffer.from(parsed.kemCiphertext, 'base64').length !== 1088) {
        return { ok: false, error: 'Invalid kemCiphertext length (should be 1088 bytes)' };
      }
      if (!parsed.encryptedFileKey || !isBase64(parsed.encryptedFileKey)) {
        return { ok: false, error: 'Missing or invalid encryptedFileKey in container' };
      }
      if (Buffer.from(parsed.encryptedFileKey, 'base64').length !== 48) {
        return { ok: false, error: 'Invalid encryptedFileKey length (should be 48 bytes)' };
      }
    } else if (version === 1) {
      if (kem !== 'Kyber-768') {
        return { ok: false, error: `Unsupported KEM algorithm: ${kem}` };
      }
      if (wrapCipher !== 'AES-256-GCM') {
        return { ok: false, error: `Unsupported wrap cipher: ${wrapCipher}` };
      }
      if (!parsed.iv || !isBase64(parsed.iv)) {
        return { ok: false, error: 'Missing or invalid iv in container' };
      }
      if (Buffer.from(parsed.iv, 'base64').length !== 12) {
        return { ok: false, error: 'Invalid iv length (should be 12 bytes)' };
      }
      if (!parsed.kemCiphertext || !isBase64(parsed.kemCiphertext)) {
        return { ok: false, error: 'Missing or invalid kemCiphertext in container' };
      }
      if (Buffer.from(parsed.kemCiphertext, 'base64').length !== 1088) {
        return { ok: false, error: 'Invalid kemCiphertext length (should be 1088 bytes)' };
      }
      if (!parsed.encryptedFileKey || !isBase64(parsed.encryptedFileKey)) {
        return { ok: false, error: 'Missing or invalid encryptedFileKey in container' };
      }
      if (Buffer.from(parsed.encryptedFileKey, 'base64').length !== 48) {
        return { ok: false, error: 'Invalid encryptedFileKey length (should be 48 bytes)' };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Wrapped key JSON failed to parse' };
  }
}

// General validator runner checking Content-Type, Whitelists and Pollution
function makeValidator(allowedKeys, validateFn) {
  return async (req, res, next) => {
    // Check JSON Content-Type for POST/PUT/PATCH methods if body is present
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentLength = req.headers['content-length'];
      if (contentLength && contentLength !== '0') {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
          await logSecurityEvent(req, 'INVALID_CONTENT_TYPE', `Content-Type "${contentType}" rejected`);
          return res.status(415).json({ error: 'Content-Type must be application/json' });
        }
      }
    }

    // Prototype Pollution check
    if (hasPrototypePollution(req)) {
      await logSecurityEvent(req, 'PROTOTYPE_POLLUTION', 'Rejected prototype pollution attack');
      return res.status(400).json({ error: 'Malformed request: Prototype Pollution detected' });
    }

    // Whitelist check
    if (allowedKeys) {
      const bodyKeys = Object.keys(req.body || {});
      const unexpected = bodyKeys.filter(k => !allowedKeys.includes(k));
      if (unexpected.length > 0) {
        await logSecurityEvent(req, 'UNEXPECTED_PARAMETERS', `Rejected unexpected properties: ${unexpected.join(', ')}`);
        return res.status(400).json({ error: `Malformed request: Unexpected properties: ${unexpected.join(', ')}` });
      }
    }

    try {
      const errorMsg = await validateFn(req);
      if (errorMsg) {
        await logSecurityEvent(req, 'VALIDATION_FAILED', errorMsg);
        return res.status(400).json({ error: errorMsg });
      }
      next();
    } catch (err) {
      console.error('[RequestValidator] Unexpected handler error:', err);
      res.status(500).json({ error: 'Internal Server Error during validation' });
    }
  };
}

// ── Auth Validations ──────────────────────────────────────────

exports.validateRegister = makeValidator(
  ['username', 'password', 'email', 'publicKeyPqc', 'kyberPublicKey'],
  (req) => {
    const { username, password, email, publicKeyPqc, kyberPublicKey } = req.body || {};
    if (!username || typeof username !== 'string') return 'Username is required';
    if (username.length < 3 || username.length > 30) return 'Username must be 3 to 30 characters';
    if (!FILENAME_REGEX.test(username)) return 'Username can only contain letters, numbers, dots, dashes, and underscores';
    if (!password || typeof password !== 'string') return 'Password is required';
    const pwdErr = validatePassword(password);
    if (pwdErr) return pwdErr;
    if (email && (typeof email !== 'string' || !email.includes('@'))) return 'Invalid email format';
    if (publicKeyPqc && !isBase64(publicKeyPqc)) return 'publicKeyPqc must be a valid Base64 string';
    if (kyberPublicKey && !isBase64(kyberPublicKey)) return 'kyberPublicKey must be a valid Base64 string';
    return null;
  }
);

exports.validateLogin = makeValidator(
  ['username', 'password'],
  (req) => {
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string') return 'Username is required';
    if (!password || typeof password !== 'string') return 'Password is required';
    return null;
  }
);

exports.validateSavePublicKey = makeValidator(
  ['kyberPublicKey'],
  (req) => {
    const { kyberPublicKey } = req.body || {};
    if (!kyberPublicKey || !isBase64(kyberPublicKey)) return 'kyberPublicKey must be a valid Base64 string';
    return null;
  }
);

// ── File Validations ──────────────────────────────────────────

exports.validateUploadUrl = makeValidator(
  ['filename', 'originalFilename', 'original_filename', 'mimeType', 'mime_type', 'size', 'sizeBytes', 'size_bytes', 'totalChunks', 'total_chunks', 'fileId', 'file_id'],
  (req) => {
    const { filename, originalFilename, original_filename, mimeType, mime_type, size, sizeBytes, size_bytes, totalChunks, total_chunks, fileId, file_id } = req.body || {};
    
    // Check filename
    if (!filename) return 'filename is required';
    const nameErr = validateFilenameAndExtension(filename);
    if (nameErr) return nameErr;

    const orig = originalFilename || original_filename;
    if (orig) {
      const origErr = validateFilenameAndExtension(orig);
      if (origErr) return origErr;
    }

    // Check size
    const finalSize = Number(size ?? sizeBytes ?? size_bytes);
    if (isNaN(finalSize) || !Number.isInteger(finalSize) || finalSize <= 0) {
      return 'sizeBytes must be a positive integer';
    }
    if (finalSize > getMaxFileSizeBytes()) {
      return 'File size exceeds maximum upload limit of 100 MB';
    }

    // Check chunks count
    const chunks = Number(totalChunks ?? total_chunks ?? 1);
    if (isNaN(chunks) || !Number.isInteger(chunks) || chunks < 1 || chunks > 100) {
      return 'totalChunks must be a positive integer between 1 and 100';
    }

    // Check optional UUID
    const fid = fileId ?? file_id;
    if (fid && !isUuid(fid)) return 'Invalid fileId format';

    // Check MIME type
    const mime = mimeType ?? mime_type;
    if (mime && !getAllowedMimeTypes().includes(mime.toLowerCase())) {
      return 'Unsupported media type: MIME type is not allowed';
    }
    return null;
  }
);

exports.validateSaveMetadata = makeValidator(
  [
    'fileId', 'filename', 'totalChunks', 'minioPath', 'chunkMap', 'status',
    'size', 'sizeBytes', 'nonce', 'algorithm', 'originalFilename',
    'encryptedFilename', 'chunkSize', 'wrappedKey', 'fileHash', 'file_hash', 'isReplace'
  ],
  (req) => {
    const { fileId, filename, totalChunks, minioPath, size, sizeBytes, nonce, algorithm, wrappedKey } = req.body || {};

    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    
    if (filename) {
      const nameErr = validateFilenameAndExtension(filename);
      if (nameErr) return nameErr;
    }

    const chunks = Number(totalChunks);
    if (isNaN(chunks) || !Number.isInteger(chunks) || chunks < 1 || chunks > 100) {
      return 'totalChunks must be an integer between 1 and 100';
    }

    if (minioPath !== undefined && minioPath !== null) {
      if (typeof minioPath !== 'string' || minioPath.includes('..')) {
        return 'minioPath cannot contain path traversal';
      }
    }

    const finalSize = Number(size ?? sizeBytes);
    if (isNaN(finalSize) || !Number.isInteger(finalSize) || finalSize <= 0) {
      return 'sizeBytes must be a positive integer';
    }

    if (!nonce || !isBase64(nonce)) {
      return 'nonce is required and must be a valid Base64 string';
    }
    if (Buffer.from(nonce, 'base64').length !== 24) {
      return 'nonce must represent exactly 24 bytes of initialization data';
    }

    if (algorithm !== 'FS-MLWE-SC-256' && algorithm !== 'FS-LWE-SC') {
      return `Unsupported encryption algorithm: ${algorithm}`;
    }

    if (!wrappedKey) {
      return 'wrappedKey key container is required (plaintext uploads are prohibited)';
    }

    const keyVal = validateWrappedKey(wrappedKey);
    if (!keyVal.ok) {
      return `Wrapped key verification failed: ${keyVal.error}`;
    }

    return null;
  }
);

exports.validateSaveFileChunks = async (req, res, next) => {
  // Check JSON Content-Type
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    await logSecurityEvent(req, 'INVALID_CONTENT_TYPE', `Content-Type "${contentType}" rejected`);
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  // Prototype Pollution check
  if (hasPrototypePollution(req)) {
    await logSecurityEvent(req, 'PROTOTYPE_POLLUTION', 'Rejected prototype pollution attack');
    return res.status(400).json({ error: 'Malformed request: Prototype Pollution detected' });
  }

  const { fileId } = req.params || {};
  if (!fileId || !isUuid(fileId)) {
    await logSecurityEvent(req, 'INVALID_PARAMS', 'fileId must be a valid UUID');
    return res.status(400).json({ error: 'fileId must be a valid UUID' });
  }

  const { chunks } = req.body || {};
  if (!Array.isArray(chunks) || chunks.length === 0) {
    await logSecurityEvent(req, 'INVALID_CHUNKS_PAYLOAD', 'chunks must be a non-empty array');
    return res.status(400).json({ error: 'chunks must be a non-empty array' });
  }

  if (chunks.length > 100) {
    await logSecurityEvent(req, 'EXCESSIVE_CHUNKS', `Request contains ${chunks.length} chunks (max 100)`);
    return res.status(400).json({ error: 'Maximum chunk count limit exceeded (max 100)' });
  }

  try {
    const fileRes = await pool.query('SELECT total_chunks FROM files WHERE id = $1 AND status != $2', [fileId, 'deleted']);
    if (fileRes.rows.length === 0) {
      await logSecurityEvent(req, 'CHUNK_UPLOAD_ORPHAN', `File ID ${fileId} not found`);
      return res.status(404).json({ error: 'File not found' });
    }

    const dbTotalChunks = fileRes.rows[0].total_chunks;
    if (chunks.length !== dbTotalChunks) {
      await logSecurityEvent(req, 'CHUNK_COUNT_MISMATCH', `Payload chunks count ${chunks.length} does not match file total chunks ${dbTotalChunks}`);
      return res.status(400).json({ error: `Inconsistent chunks count: expected exactly ${dbTotalChunks} chunks` });
    }

    const indexes = [];
    for (const chunk of chunks) {
      const idx = Number(chunk.chunkIndex ?? chunk.chunk_index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= dbTotalChunks) {
        await logSecurityEvent(req, 'CHUNK_INDEX_INVALID', `Invalid chunk index: ${idx}`);
        return res.status(400).json({ error: `chunkIndex must be an integer between 0 and ${dbTotalChunks - 1}` });
      }

      const path = chunk.minioPath || chunk.minio_path;
      if (!path || typeof path !== 'string' || path.includes('..')) {
        await logSecurityEvent(req, 'CHUNK_PATH_INVALID', `Invalid chunk minio path: ${path}`);
        return res.status(400).json({ error: 'chunk minioPath is required and cannot contain path traversal' });
      }

      const hash = chunk.chunkHash || chunk.chunk_hash;
      if (!hash || typeof hash !== 'string' || !/^[A-Za-z0-9]+$/.test(hash) || hash.length !== 64) {
        await logSecurityEvent(req, 'CHUNK_HASH_INVALID', `Invalid KT-QHF chunk hash: ${hash}`);
        return res.status(400).json({ error: 'chunkHash must be a valid 64-character alphanumeric string' });
      }

      const size = Number(chunk.chunkSize ?? chunk.chunk_size ?? 0);
      if (isNaN(size) || !Number.isInteger(size) || size <= 0 || size > 10 * 1024 * 1024) {
        await logSecurityEvent(req, 'CHUNK_SIZE_INVALID', `Invalid chunk size: ${size}`);
        return res.status(400).json({ error: 'chunkSize must be a positive integer and cannot exceed 10 MB' });
      }

      indexes.push(idx);
    }

    // Verify ordering and uniqueness (no gaps or duplicates)
    indexes.sort((a, b) => a - b);
    for (let i = 0; i < dbTotalChunks; i++) {
      if (indexes[i] !== i) {
        await logSecurityEvent(req, 'CHUNK_SEQUENCE_INVALID', `Chunk index sequence is missing elements or duplicate index found: sorted indexes [${indexes.join(',')}]`);
        return res.status(400).json({ error: 'Chunks must cover the entire sequence 0 to totalChunks-1 exactly once with no duplicates' });
      }
    }

    next();
  } catch (err) {
    console.error('[RequestValidator] Chunks validation database error:', err);
    res.status(500).json({ error: 'Internal Server Error during chunks validation' });
  }
};

exports.validateDownloadUrl = makeValidator(
  ['fileId'],
  (req) => {
    const { fileId } = req.body || {};
    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    return null;
  }
);

exports.validateFileLock = makeValidator(
  ['lockReason'],
  (req) => {
    const { fileId } = req.params || {};
    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    const { lockReason } = req.body || {};
    if (lockReason && (typeof lockReason !== 'string' || lockReason.length > 500)) {
      return 'lockReason must be a string under 500 characters';
    }
    return null;
  }
);

exports.validateFileUnlock = makeValidator(
  [],
  (req) => {
    const { fileId } = req.params || {};
    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    return null;
  }
);

exports.validateFileDelete = makeValidator(
  [],
  (req) => {
    const { fileId } = req.params || {};
    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    return null;
  }
);

exports.validateFileReview = makeValidator(
  ['status', 'comment'],
  (req) => {
    const { fileId } = req.params || {};
    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    const { status, comment } = req.body || {};
    if (status !== 'approved' && status !== 'rejected') return 'status must be approved or rejected';
    if (comment && (typeof comment !== 'string' || comment.length > 500)) {
      return 'comment must be a string under 500 characters';
    }
    return null;
  }
);

exports.validateFileGet = makeValidator(
  [],
  (req) => {
    const { fileId } = req.params || {};
    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    return null;
  }
);

// ── Share Validations ─────────────────────────────────────────

exports.validateCreateShare = makeValidator(
  ['fileId', 'recipientId', 'recipient_id', 'permission', 'recipientWrappedKey', 'recipient_wrapped_key'],
  (req) => {
    const fileId = req.body.fileId || req.body.file_id;
    const recipientId = req.body.recipientId || req.body.recipient_id;
    const permission = req.body.permission || 'read';
    const recipientWrappedKey = req.body.recipientWrappedKey || req.body.recipient_wrapped_key;

    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    if (!recipientId || !isUuid(recipientId)) return 'recipientId must be a valid UUID';
    
    const validPermissions = ['read', 'write', 'review', 'share', 'read_write', 'read_review', 'full_access'];
    if (!validPermissions.includes(permission)) {
      return `permission must be one of: ${validPermissions.join(', ')}`;
    }
    if (!recipientWrappedKey) return 'recipientWrappedKey key container is required';
    const keyVal = validateWrappedKey(recipientWrappedKey);
    if (!keyVal.ok) return `recipientWrappedKey verification failed: ${keyVal.error}`;
    return null;
  }
);

exports.validateCreateShareBatch = makeValidator(
  ['fileId', 'permission', 'shares'],
  (req) => {
    const { fileId, permission, shares } = req.body || {};
    if (!fileId || !isUuid(fileId)) return 'fileId must be a valid UUID';
    const validPermissions = ['read', 'write', 'review', 'share', 'read_write', 'read_review', 'full_access'];
    if (!validPermissions.includes(permission)) {
      return `permission must be one of: ${validPermissions.join(', ')}`;
    }
    if (!Array.isArray(shares) || shares.length === 0) return 'shares must be a non-empty array';
    if (shares.length > 100) return 'shares batch size limit exceeded (max 100)';
    for (const item of shares) {
      if (!item.recipientId || !isUuid(item.recipientId)) return 'recipientId must be a valid UUID';
      if (!item.recipientWrappedKey) return 'recipientWrappedKey key container is required';
      const keyVal = validateWrappedKey(item.recipientWrappedKey);
      if (!keyVal.ok) return `recipientWrappedKey verification failed: ${keyVal.error}`;
    }
    return null;
  }
);

exports.validateDeleteShare = makeValidator(
  [],
  (req) => {
    const { shareId } = req.params || {};
    if (!shareId || !isUuid(shareId)) return 'shareId must be a valid UUID';
    return null;
  }
);

// ── Admin Validations ──────────────────────────────────────────

exports.validateAdminUserQuota = makeValidator(
  ['quotaMb'],
  (req) => {
    const { userId } = req.params || {};
    if (!userId || !isUuid(userId)) return 'userId must be a valid UUID';
    const quotaMb = Number(req.body.quotaMb);
    if (isNaN(quotaMb) || quotaMb < 10 || quotaMb > 102400) {
      return 'quotaMb must be a number between 10 and 102400';
    }
    return null;
  }
);

exports.validateAdminUserStatus = makeValidator(
  ['status'],
  (req) => {
    const { userId } = req.params || {};
    if (!userId || !isUuid(userId)) return 'userId must be a valid UUID';
    const { status } = req.body || {};
    if (!['active', 'disabled', 'locked'].includes(status)) {
      return 'status must be active, disabled, or locked';
    }
    return null;
  }
);

exports.validateAdminUserDelete = makeValidator(
  [],
  (req) => {
    const { userId } = req.params || {};
    if (!userId || !isUuid(userId)) return 'userId must be a valid UUID';
    return null;
  }
);

exports.validateAdminFileDelete = makeValidator(
  [],
  (req) => {
    const { id } = req.params || {};
    if (!id || !isUuid(id)) return 'id must be a valid UUID';
    return null;
  }
);
