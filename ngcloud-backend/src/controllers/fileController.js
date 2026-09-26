const minioClient = require('../config/minioClient');
const pool = require('../config/db');
const { logActivity } = require('../services/activityLogger');
const bucket = process.env.MINIO_BUCKET;
const { randomUUID } = require('crypto');
const { sanitizeFilename, isUuid, parsePositiveInteger } = require('../utils/validation');
const { canRead, canWrite, canReview, canShare } = require('../utils/permissions');
const { getMaxFileSizeBytes, getAllowedExtensions, getAllowedMimeTypes } = require('../utils/filePolicy');

function getUserId(req) {
  const user = req.user || {};
  return user.id || user.sub || null;
}

function publicFile(row) {
  if (!row) return null;

  return {
    id: row.id,
    fileId: row.id,

    ownerId: row.owner_id,
    owner_id: row.owner_id,

    filename: row.filename,
    name: row.filename,

    totalChunks: row.total_chunks,
    total_chunks: row.total_chunks,

    minioPath: row.minio_path,
    minio_path: row.minio_path,

    chunkMap: row.chunk_map,
    chunk_map: row.chunk_map,

    status: row.status || 'uploaded',

    size: Number(row.size_bytes || 0),
    size_bytes: Number(row.size_bytes || 0),

    nonce: row.nonce || null,

    algorithm: row.algorithm || null,

    originalFilename: row.original_filename || null,
    original_filename: row.original_filename || null,

    encryptedFilename: row.encrypted_filename || null,
    encrypted_filename: row.encrypted_filename || null,

    chunkSize: row.chunk_size || null,
    chunk_size: row.chunk_size || null,

    wrappedKey: row.wrapped_key || null,
    wrapped_key: row.wrapped_key || null,

    fileHash: row.file_hash || null,
    file_hash: row.file_hash || null,

    createdAt: row.created_at,
    created_at: row.created_at,

    updatedAt: row.updated_at,
    updated_at: row.updated_at,

    permission: row.permission || 'owner',

    lock: row.lock_id ? {
      id: row.lock_id,
      lockedBy: row.locked_by_username,
      lockReason: row.lock_reason,
      lockedAt: row.locked_at,
      expiresAt: row.expires_at,
    } : null,
  };
}

// Permission helpers using shared permission module
async function checkReadAccess(fileId, userId) {
  const fileRes = await pool.query('SELECT owner_id, status FROM files WHERE id = $1', [fileId]);
  if (fileRes.rows.length === 0 || fileRes.rows[0].status === 'deleted') return { hasAccess: false, isOwner: false };
  if (fileRes.rows[0].owner_id === userId) return { hasAccess: true, isOwner: true };

  const shareRes = await pool.query(
    'SELECT permission FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
    [fileId, userId]
  );
  if (shareRes.rows.length === 0) return { hasAccess: false, isOwner: false };

  const perm = shareRes.rows[0].permission;
  return { hasAccess: canRead(perm), isOwner: false, permission: perm };
}

async function checkWriteAccess(fileId, userId) {
  const fileRes = await pool.query('SELECT owner_id, status FROM files WHERE id = $1', [fileId]);
  if (fileRes.rows.length === 0 || fileRes.rows[0].status === 'deleted') return { hasAccess: false, isOwner: false };
  if (fileRes.rows[0].owner_id === userId) return { hasAccess: true, isOwner: true };

  const shareRes = await pool.query(
    'SELECT permission FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
    [fileId, userId]
  );
  if (shareRes.rows.length === 0) return { hasAccess: false, isOwner: false };

  const perm = shareRes.rows[0].permission;
  return { hasAccess: canWrite(perm), isOwner: false, permission: perm };
}

async function checkShareAccess(fileId, userId) {
  const fileRes = await pool.query('SELECT owner_id, status FROM files WHERE id = $1', [fileId]);
  if (fileRes.rows.length === 0 || fileRes.rows[0].status === 'deleted') return { hasAccess: false, isOwner: false };
  if (fileRes.rows[0].owner_id === userId) return { hasAccess: true, isOwner: true };

  const shareRes = await pool.query(
    'SELECT permission FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
    [fileId, userId]
  );
  if (shareRes.rows.length === 0) return { hasAccess: false, isOwner: false };

  const perm = shareRes.rows[0].permission;
  return { hasAccess: canShare(perm), isOwner: false, permission: perm };
}

async function cleanupExpiredLocks() {
  try {
    const expiredLocksRes = await pool.query(
      `SELECT l.file_id, l.locked_by, f.filename
       FROM file_locks l
       JOIN files f ON f.id = l.file_id
       WHERE l.expires_at < CURRENT_TIMESTAMP`
    );

    if (expiredLocksRes.rows.length > 0) {
      await pool.query('DELETE FROM file_locks WHERE expires_at < CURRENT_TIMESTAMP');
      for (const lock of expiredLocksRes.rows) {
        await logActivity({
          userId: lock.locked_by,
          fileId: lock.file_id,
          action: 'LOCK_EXPIRED',
          description: `Edit lock expired on ${lock.filename}`,
          metadata: { filename: lock.filename }
        });
      }
    }
  } catch (err) {
    console.error('[cleanupExpiredLocks] Error:', err.message);
  }
}

async function checkLockAndWriteAccess(fileId, userId) {
  const access = await checkWriteAccess(fileId, userId);
  if (!access.hasAccess) {
    return { allowed: false, error: 'Unauthorized: Write access required', status: 403 };
  }

  // Delete expired locks first to prevent stale locks blocking edits
  await cleanupExpiredLocks();

  const lockRes = await pool.query(
    `SELECT l.locked_by, u.username
     FROM file_locks l
     JOIN users u ON u.id = l.locked_by
     WHERE l.file_id = $1 AND l.expires_at > CURRENT_TIMESTAMP`,
    [fileId]
  );

  if (lockRes.rows.length > 0) {
    const lock = lockRes.rows[0];
    if (lock.locked_by !== userId) {
      return {
        allowed: false,
        error: `This file is currently being edited by ${lock.username}.`,
        status: 409,
        lockDetails: {
          locked: true,
          lockedBy: lock.username,
        }
      };
    }
  }

  return { allowed: true, ...access };
}

function presignedPut(objectName, expires) {
  return new Promise((resolve, reject) => {
    minioClient.presignedPutObject(bucket, objectName, expires, (err, presignedUrl) => {
      if (err) return reject(err);
      return resolve(presignedUrl);
    });
  });
}

function presignedGet(objectName, expires) {
  return new Promise((resolve, reject) => {
    minioClient.presignedGetObject(bucket, objectName, expires, (err, presignedUrl) => {
      if (err) return reject(err);
      return resolve(presignedUrl);
    });
  });
}

function removeObject(objectName) {
  return new Promise((resolve, reject) => {
    minioClient.removeObject(bucket, objectName, (err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}

exports.generateUploadUrl = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const filename = req.body.filename || '';
  const originalFilename = req.body.originalFilename || req.body.original_filename || '';
  const mimeType = req.body.mimeType || req.body.mime_type || '';
  const sizeBytes = Number(req.body.size || req.body.sizeBytes || req.body.size_bytes || 0);
  const fileIdParam = req.body.fileId || req.body.file_id;

  // 1. Validate file size limits (100 MB)
  const maxFileSizeBytes = getMaxFileSizeBytes();
  if (sizeBytes > maxFileSizeBytes) {
    return res.status(413).json({
      error: 'File is too large. Maximum allowed size is 100 MB.',
      message: 'File is too large. Maximum allowed size is 100 MB.'
    });
  }

  // 2. Validate filename
  const safe = sanitizeFilename(filename);
  if (!safe) {
    return res.status(400).json({
      error: 'Invalid filename.',
      message: 'Invalid filename.'
    });
  }

  if (originalFilename) {
    const safeOriginal = sanitizeFilename(originalFilename);
    if (!safeOriginal) {
      return res.status(400).json({
        error: 'Invalid filename.',
        message: 'Invalid filename.'
      });
    }
  }

  // 3. Validate extension
  const allowedExtensions = getAllowedExtensions();
  let origName = originalFilename || safe || '';
  if (origName.toLowerCase().endsWith('.enc')) {
    origName = origName.slice(0, -4);
  }
  const ext = '.' + origName.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return res.status(400).json({
      error: 'File extension is not allowed.',
      message: 'File extension is not allowed.'
    });
  }

  // 4. Validate MIME Type if provided
  const allowedMimeTypes = getAllowedMimeTypes();
  if (mimeType && !allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return res.status(400).json({
      error: 'File extension is not allowed.',
      message: 'File extension is not allowed.'
    });
  }

  // 5. Validate storage quota
  try {
    const usedRes = await pool.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used
       FROM files
       WHERE owner_id = $1 AND status != 'deleted'`,
      [userId]
    );
    let usedBytes = Number(usedRes.rows[0].used);

    // Deduct size of existing file if we are replacing/updating
    let existingFileId = fileIdParam;
    if (!existingFileId) {
      const dupRes = await pool.query(
        `SELECT id, size_bytes FROM files WHERE owner_id = $1 AND filename = $2 AND status = $3`,
        [userId, safe, 'uploaded']
      );
      if (dupRes.rows.length > 0) {
        existingFileId = dupRes.rows[0].id;
        usedBytes = Math.max(0, usedBytes - Number(dupRes.rows[0].size_bytes));
      }
    } else {
      const oldFileRes = await pool.query(
        `SELECT size_bytes FROM files WHERE id = $1`,
        [existingFileId]
      );
      if (oldFileRes.rows.length > 0) {
        usedBytes = Math.max(0, usedBytes - Number(oldFileRes.rows[0].size_bytes));
      }
    }

    const userRes = await pool.query(
      'SELECT storage_quota_bytes FROM users WHERE id = $1',
      [userId]
    );
    const quotaBytes = Number(userRes.rows[0]?.storage_quota_bytes || 524288000);
    const remainingBytes = Math.max(0, quotaBytes - usedBytes);

    if (sizeBytes > remainingBytes) {
      const remainingMb = (remainingBytes / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        error: `Storage quota exceeded. Remaining space: ${remainingMb} MB.`,
        message: `Storage quota exceeded. Remaining space: ${remainingMb} MB.`
      });
    }
  } catch (dbErr) {
    console.error('generateUploadUrl quota check db error', dbErr);
    return res.status(500).json({ error: 'Database error validating storage quota' });
  }

  const totalChunks = parsePositiveInteger(
    req.body.totalChunks || req.body.total_chunks || 1,
    1
  );

  if (!totalChunks) {
    return res.status(400).json({ error: 'totalChunks must be a positive integer' });
  }

  const objectName = `${userId}/${randomUUID()}-${safe}`;
  const expires = 15 * 60;

  try {
    let fileId = fileIdParam;
    let baseObjectName = objectName;
    let fileRow;
    let existingFile = null;

    if (fileId) {
      if (!isUuid(fileId)) {
        return res.status(400).json({ error: 'Invalid fileId format' });
      }

      // Check lock and write access on existing file
      const check = await checkLockAndWriteAccess(fileId, userId);
      if (!check.allowed) {
        return res.status(check.status).json({ error: check.error, lockDetails: check.lockDetails });
      }

      // Fetch file details
      const oldFileRes = await pool.query(
        `SELECT id, owner_id, filename, total_chunks, minio_path, nonce, algorithm, size_bytes, created_at, updated_at
         FROM files
         WHERE id = $1`,
        [fileId]
      );

      if (oldFileRes.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }

      const oldFile = oldFileRes.rows[0];
      baseObjectName = oldFile.minio_path;

      // Fetch wrapped key (for owner from file_keys, for recipient from file_shares)
      let wrappedKey = null;
      if (oldFile.owner_id === userId) {
        const keyResult = await pool.query(
          'SELECT wrapped_key FROM file_keys WHERE file_id = $1 AND user_id = $2',
          [fileId, userId]
        );
        wrappedKey = keyResult.rows[0]?.wrapped_key || null;
      } else {
        const shareResult = await pool.query(
          'SELECT recipient_wrapped_key FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
          [fileId, userId]
        );
        wrappedKey = shareResult.rows[0]?.recipient_wrapped_key || null;
      }

      // Fetch old chunks
      const chunksResult = await pool.query(
        'SELECT chunk_index, minio_path, chunk_hash, chunk_size FROM file_chunks WHERE file_id = $1 ORDER BY chunk_index ASC',
        [fileId]
      );

      existingFile = {
        id: fileId,
        fileId,
        filename: oldFile.filename,
        totalChunks: oldFile.total_chunks,
        minioPath: oldFile.minio_path,
        nonce: oldFile.nonce,
        wrappedKey,
        chunks: chunksResult.rows.map(c => ({
          chunkIndex: c.chunk_index,
          chunk_index: c.chunk_index,
          minioPath: c.minio_path,
          minio_path: c.minio_path,
          chunkHash: c.chunk_hash,
          chunk_hash: c.chunk_hash,
          chunkSize: Number(c.chunk_size),
          chunk_size: Number(c.chunk_size),
        })),
      };

      // Update existing file row to pending, update total_chunks and size_bytes
      const updateResult = await pool.query(
        `UPDATE files
         SET status = 'pending',
             total_chunks = $2,
             size_bytes = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [fileId, totalChunks, Number.isFinite(sizeBytes) ? sizeBytes : 0]
      );
      fileRow = updateResult.rows[0];
    } else {
      // Look up if same file already exists for owner (default sync fallback)
      const existingFileResult = await pool.query(
        `SELECT id, owner_id, filename, total_chunks, minio_path, nonce, algorithm, size_bytes, created_at, updated_at
         FROM files
         WHERE owner_id = $1 AND filename = $2 AND status = $3`,
        [userId, safe, 'uploaded']
      );

      if (existingFileResult.rows.length > 0) {
        const oldFile = existingFileResult.rows[0];
        fileId = oldFile.id;
        baseObjectName = oldFile.minio_path;

        // Fetch old file key
        const keyResult = await pool.query(
          'SELECT wrapped_key FROM file_keys WHERE file_id = $1 AND user_id = $2',
          [fileId, userId]
        );
        const wrappedKey = keyResult.rows[0]?.wrapped_key || null;

        // Fetch old chunks
        const chunksResult = await pool.query(
          'SELECT chunk_index, minio_path, chunk_hash, chunk_size FROM file_chunks WHERE file_id = $1 ORDER BY chunk_index ASC',
          [fileId]
        );

        existingFile = {
          id: fileId,
          fileId,
          filename: oldFile.filename,
          totalChunks: oldFile.total_chunks,
          minioPath: oldFile.minio_path,
          nonce: oldFile.nonce,
          wrappedKey,
          chunks: chunksResult.rows.map(c => ({
            chunkIndex: c.chunk_index,
            chunk_index: c.chunk_index,
            minioPath: c.minio_path,
            minio_path: c.minio_path,
            chunkHash: c.chunk_hash,
            chunk_hash: c.chunk_hash,
            chunkSize: Number(c.chunk_size),
            chunk_size: Number(c.chunk_size),
          })),
        };

        // Update existing file row to pending, update total_chunks and size_bytes
        const updateResult = await pool.query(
          `UPDATE files
           SET status = 'pending',
               total_chunks = $2,
               size_bytes = $3,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [fileId, totalChunks, Number.isFinite(sizeBytes) ? sizeBytes : 0]
        );
        fileRow = updateResult.rows[0];
      } else {
        const insertResult = await pool.query(
          `INSERT INTO files (owner_id, filename, total_chunks, minio_path, status, size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            userId,
            safe,
            totalChunks,
            objectName,
            'pending',
            Number.isFinite(sizeBytes) ? sizeBytes : 0,
          ]
        );
        fileRow = insertResult.rows[0];
        fileId = fileRow.id;
      }
    }

    // Generate chunk URLs
    const chunkUrls = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = `${baseObjectName}.part${i}`;
      const url = await presignedPut(chunkPath, expires);
      chunkUrls.push({
        chunkIndex: i,
        minioPath: chunkPath,
        uploadUrl: url,
      });
    }

    const file = publicFile(fileRow);

    await logActivity({
      userId,
      fileId,
      action: "UPLOAD_URL_GENERATED",
      description: `Generated upload URL for file ${fileRow.filename}`,
      metadata: {
        status: "success",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        filename: fileRow.filename,
        size: Number(fileRow.size_bytes),
      },
    });

    return res.json({
      fileId,
      id: fileId,
      objectName: baseObjectName,
      uploadUrl: chunkUrls[0]?.uploadUrl || null,
      url: chunkUrls[0]?.uploadUrl || null,
      chunkUrls,
      existingFile,
      file,
    });
  } catch (err) {
    console.error('generateUploadUrl error', err);
    return res.status(500).json({ error: 'Could not generate upload URL' });
  }
};

exports.generateDownloadUrl = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId } = req.body || {};

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required in body' });
  }

  try {
    const result = await pool.query(
      `SELECT
         f.id,
         f.owner_id,
         f.filename,
         f.minio_path,
         f.total_chunks,
         f.chunk_map,
         f.status,
         f.size_bytes,
         f.nonce,
         f.algorithm,
         f.original_filename,
         f.encrypted_filename,
         f.chunk_size,
         f.file_hash,
         f.created_at,
         f.updated_at,
         fk.wrapped_key AS owner_wrapped_key,
         fs.recipient_wrapped_key AS recipient_wrapped_key,
         fs.permission
       FROM files f
       LEFT JOIN file_keys fk
         ON fk.file_id = f.id
        AND fk.user_id = f.owner_id
       LEFT JOIN file_shares fs
         ON fs.file_id = f.id
        AND fs.recipient_id = $2
       WHERE f.id = $1
         AND f.status != 'deleted'
         AND (f.owner_id = $2 OR fs.recipient_id = $2)`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    const fileRow = result.rows[0];
    const isOwner = fileRow.owner_id === userId;
    let wrappedKey = null;

    // Enforce read permission
    if (!isOwner && !canRead(fileRow.permission)) {
      return res.status(403).json({ error: 'Forbidden: Read access required' });
    }

    if (isOwner) {
      wrappedKey = fileRow.owner_wrapped_key;
    } else {
      wrappedKey = fileRow.recipient_wrapped_key;
    }

    if (!wrappedKey) {
      return res.status(404).json({ error: 'Encryption key not found for this user' });
    }

    const expires = 15 * 60;

    // Fetch chunk records
    const chunksResult = await pool.query(
      `SELECT chunk_index, minio_path, chunk_hash, chunk_size
       FROM file_chunks
       WHERE file_id = $1
       ORDER BY chunk_index ASC`,
      [fileId]
    );

    const chunks = [];
    for (const chunkRow of chunksResult.rows) {
      const chunkDownloadUrl = await presignedGet(chunkRow.minio_path, expires);
      chunks.push({
        chunkIndex: chunkRow.chunk_index,
        chunk_index: chunkRow.chunk_index,
        minioPath: chunkRow.minio_path,
        minio_path: chunkRow.minio_path,
        chunkHash: chunkRow.chunk_hash,
        chunk_hash: chunkRow.chunk_hash,
        chunkSize: Number(chunkRow.chunk_size),
        chunk_size: Number(chunkRow.chunk_size),
        downloadUrl: chunkDownloadUrl,
        url: chunkDownloadUrl,
      });
    }

    let mainDownloadUrl = null;
    try {
      mainDownloadUrl = await presignedGet(fileRow.minio_path, expires);
    } catch (e) {
      console.warn('Could not generate base download URL:', e.message);
    }

    const fileObj = publicFile(fileRow);
    fileObj.wrapped_key = wrappedKey;
    fileObj.wrappedKey = wrappedKey;

    await logActivity({
      userId,
      fileId,
      action: 'FILE_DOWNLOAD',
      description: isOwner
        ? `Downloaded file ${fileRow.filename}`
        : `Downloaded shared file ${fileRow.filename}`,
      metadata: { filename: fileRow.filename, isOwner }
    });

    return res.json({
      url: mainDownloadUrl,
      downloadUrl: mainDownloadUrl,
      file: fileObj,
      chunks,
    });
  } catch (err) {
    console.error('generateDownloadUrl error', err);
    return res.status(500).json({ error: 'Could not generate download URL' });
  }
};

exports.listFiles = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await pool.query(
      `SELECT
         f.id,
         f.owner_id,
         f.filename,
         f.total_chunks,
         f.minio_path,
         f.chunk_map,
         f.status,
         f.size_bytes,
         f.nonce,
         f.algorithm,
         f.original_filename,
         f.encrypted_filename,
         f.chunk_size,
         f.file_hash,
         f.created_at,
         f.updated_at,
         fk.wrapped_key,
         l.id AS lock_id,
         l.locked_by,
         l.lock_reason,
         l.locked_at,
         l.expires_at,
         lu.username AS locked_by_username
       FROM files f
       LEFT JOIN file_keys fk
         ON fk.file_id = f.id
        AND fk.user_id = f.owner_id
       LEFT JOIN file_locks l ON l.file_id = f.id AND l.expires_at > CURRENT_TIMESTAMP
       LEFT JOIN users lu ON lu.id = l.locked_by
       WHERE f.owner_id = $1 AND f.status != 'deleted'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    return res.json({ files: result.rows.map(publicFile) });
  } catch (err) {
    console.error('listFiles error', err);
    return res.status(500).json({ error: 'Could not list files' });
  }
};

exports.getFile = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId } = req.params || {};

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required' });
  }

  try {
    const result = await pool.query(
      `SELECT
         f.id,
         f.owner_id,
         f.filename,
         f.total_chunks,
         f.minio_path,
         f.chunk_map,
         f.status,
         f.size_bytes,
         f.nonce,
         f.algorithm,
         f.original_filename,
         f.encrypted_filename,
         f.chunk_size,
         f.file_hash,
         f.created_at,
         f.updated_at,
         fk.wrapped_key AS owner_wrapped_key,
         fs.recipient_wrapped_key AS recipient_wrapped_key,
         fs.permission,
         l.id AS lock_id,
         l.locked_by,
         l.lock_reason,
         l.locked_at,
         l.expires_at,
         lu.username AS locked_by_username
       FROM files f
       LEFT JOIN file_keys fk
         ON fk.file_id = f.id
        AND fk.user_id = f.owner_id
       LEFT JOIN file_shares fs
         ON fs.file_id = f.id
        AND fs.recipient_id = $2
       LEFT JOIN file_locks l ON l.file_id = f.id AND l.expires_at > CURRENT_TIMESTAMP
       LEFT JOIN users lu ON lu.id = l.locked_by
       WHERE f.id = $1
         AND f.status != 'deleted'
         AND (f.owner_id = $2 OR fs.recipient_id = $2)`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    const row = result.rows[0];
    const isOwner = row.owner_id === userId;

    // Enforce read permission
    if (!isOwner && !canRead(row.permission)) {
      return res.status(403).json({ error: 'Forbidden: Read access required' });
    }

    const wrappedKey = isOwner ? row.owner_wrapped_key : row.recipient_wrapped_key;

    const fileObj = publicFile(row);
    fileObj.wrapped_key = wrappedKey;
    fileObj.wrappedKey = wrappedKey;
    fileObj.permission = isOwner ? 'owner' : row.permission;

    return res.json({ file: fileObj });
  } catch (err) {
    console.error('getFile error', err);
    return res.status(500).json({ error: 'Could not load file' });
  }
};

exports.deleteFile = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId } = req.params || {};

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required in params' });
  }

  try {
    const result = await pool.query(
      'SELECT id, minio_path, owner_id, status FROM files WHERE id = $1',
      [fileId]
    );

    if (result.rows.length === 0 || result.rows[0].status === 'deleted') {
      return res.status(404).json({ error: 'File not found' });
    }

    if (result.rows[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Only the file owner can delete it' });
    }

    // Default: Soft delete (do not delete MinIO objects or delete DB row)
    const deleteRes = await pool.query(
      "UPDATE files SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND owner_id = $2 RETURNING filename",
      [fileId, userId]
    );

    if (deleteRes.rows.length > 0) {
      const filename = deleteRes.rows[0].filename;
      await logActivity({
        userId,
        fileId,
        action: 'FILE_DELETE',
        description: `Deleted file ${filename}`,
        metadata: { filename }
      });
    }

    return res.json({
      status: 'deleted',
      message: 'File soft-deleted successfully',
    });
  } catch (err) {
    console.error('deleteFile error', err);
    return res.status(500).json({ error: 'Could not delete file' });
  }
};

exports.saveMetadata = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    fileId,
    filename,
    totalChunks,
    minioPath,
    chunkMap,
    status,
    size,
    sizeBytes,

    nonce,
    algorithm,
    originalFilename,
    encryptedFilename,
    chunkSize,
    wrappedKey,
    fileHash,
    file_hash,
  } = req.body || {};

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required in body' });
  }

  const safe = filename ? sanitizeFilename(filename) : null;

  if (filename && !safe) {
    return res.status(400).json({ error: 'filename contains invalid characters' });
  }

  const parsedChunks =
    totalChunks !== undefined ? parsePositiveInteger(totalChunks, 1) : null;

  if (totalChunks !== undefined && !parsedChunks) {
    return res.status(400).json({ error: 'totalChunks must be a positive integer' });
  }

  const parsedSize =
    sizeBytes !== undefined || size !== undefined ? Number(sizeBytes ?? size) : null;

  const parsedChunkSize =
    chunkSize !== undefined && chunkSize !== null ? Number(chunkSize) : null;

  const nextStatus = status || 'uploaded';
  const finalFileHash = fileHash || file_hash || null;

  // 1. Verify lock & write permissions
  const check = await checkLockAndWriteAccess(fileId, userId);
  if (!check.allowed) {
    return res.status(check.status).json({ error: check.error, lockDetails: check.lockDetails });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const params = [
      fileId,
      safe,
      parsedChunks,
      minioPath || null,
      chunkMap || null,
      nextStatus,
      Number.isFinite(parsedSize) ? parsedSize : null,
      nonce || null,
      algorithm || null,
      originalFilename || null,
      encryptedFilename || null,
      Number.isFinite(parsedChunkSize) ? parsedChunkSize : null,
      finalFileHash,
    ];
    console.log('saveMetadata params:', params);

    const updateResult = await client.query(
      `UPDATE files
       SET filename = COALESCE($2, filename),
           total_chunks = COALESCE($3, total_chunks),
           minio_path = COALESCE($4, minio_path),
           chunk_map = COALESCE($5, chunk_map),
           status = COALESCE($6, status),
           size_bytes = COALESCE($7, size_bytes),
           nonce = COALESCE($8, nonce),
           algorithm = COALESCE($9, algorithm),
           original_filename = COALESCE($10, original_filename),
           encrypted_filename = COALESCE($11, encrypted_filename),
           chunk_size = COALESCE($12, chunk_size),
           file_hash = COALESCE($13, file_hash),
           updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         owner_id,
         filename,
         total_chunks,
         minio_path,
         chunk_map,
         status,
         size_bytes,
         nonce,
         algorithm,
         original_filename,
         encrypted_filename,
         chunk_size,
         file_hash,
         created_at,
         updated_at`,
      params
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'File not found' });
    }

    const isOwner = check.isOwner;

    if (wrappedKey) {
      if (isOwner) {
        await client.query(
          `INSERT INTO file_keys (file_id, user_id, wrapped_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (file_id, user_id)
           DO UPDATE SET wrapped_key = EXCLUDED.wrapped_key`,
          [fileId, userId, wrappedKey]
        );
      } else {
        await client.query(
          `UPDATE file_shares
           SET recipient_wrapped_key = $3, updated_at = CURRENT_TIMESTAMP
           WHERE file_id = $1 AND recipient_id = $2`,
          [fileId, userId, wrappedKey]
        );
      }
    }

    await client.query('COMMIT');

    const fileRow = updateResult.rows[0];
    const isReplace = req.body.isReplace === true;
    const isUploaded = nextStatus === 'uploaded';

    await logActivity({
      userId,
      fileId,
      action: isUploaded ? (isReplace ? 'FILE_UPDATE' : 'FILE_UPLOAD') : 'FILE_UPDATE',
      description: isUploaded
        ? (isReplace ? `Uploaded a new version of file ${fileRow.filename}` : `Uploaded file ${fileRow.filename}`)
        : `Updated metadata for file ${fileRow.filename}`,
      metadata: { filename: fileRow.filename, size: Number(fileRow.size_bytes) }
    });

    const fileWithKey = {
      ...fileRow,
      wrapped_key: wrappedKey || null,
      permission: isOwner ? 'owner' : (check.permission || 'write')
    };

    return res.json({ file: publicFile(fileWithKey) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('saveMetadata error', err);
    return res.status(500).json({ error: 'Could not save metadata' });
  } finally {
    client.release();
  }
};

exports.saveFileChunks = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId } = req.params || {};

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required in params' });
  }

  const { chunks } = req.body || {};

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return res.status(400).json({ error: 'chunks array is required in body' });
  }

  try {
    const check = await checkLockAndWriteAccess(fileId, userId);
    if (!check.allowed) {
      return res.status(check.status).json({ error: check.error, lockDetails: check.lockDetails });
    }

    const values = [];

    const placeholders = chunks.map((chunk, index) => {
      const chunkIndex = Number(chunk.chunkIndex ?? chunk.chunk_index);

      if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
        const err = new Error('chunkIndex must be a non-negative integer');
        err.status = 400;
        throw err;
      }

      const path = chunk.minioPath || chunk.minio_path;
      const hash = chunk.chunkHash || chunk.chunk_hash;
      const size = Number(chunk.chunkSize ?? chunk.chunk_size ?? 0);

      if (!path || !hash) {
        const err = new Error('chunk minioPath and chunkHash are required');
        err.status = 400;
        throw err;
      }

      values.push(fileId, chunkIndex, path, hash, size);

      const base = index * 5;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    await pool.query(
      `INSERT INTO file_chunks (file_id, chunk_index, minio_path, chunk_hash, chunk_size)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (file_id, chunk_index)
       DO UPDATE SET
         minio_path = EXCLUDED.minio_path,
         chunk_hash = EXCLUDED.chunk_hash,
         chunk_size = EXCLUDED.chunk_size`,
      values
    );

    return res.json({
      status: 'chunks_saved',
      count: chunks.length,
    });
  } catch (err) {
    console.error('saveFileChunks error', err.message || err);
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || 'Could not save chunk data',
    });
  }
};

exports.listShared = async (req, res) => {
  return res.json({ files: [] });
};

// File Locking Endpoints
exports.lockFile = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId } = req.params;
  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required' });
  }

  try {
    // 1. Check write permissions (write, read_write, full_access, or owner)
    const access = await checkWriteAccess(fileId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Forbidden: Write access required to lock file' });
    }

    // 2. Clean up expired locks
    await cleanupExpiredLocks();

    // Fetch filename for logging
    const fileRes = await pool.query('SELECT filename FROM files WHERE id = $1', [fileId]);
    const filename = fileRes.rows[0]?.filename || 'file';

    // 3. Check for active lock
    const lockRes = await pool.query(
      `SELECT l.id, l.locked_by, u.username, l.locked_at, l.expires_at
       FROM file_locks l
       JOIN users u ON u.id = l.locked_by
       WHERE l.file_id = $1 AND l.expires_at > CURRENT_TIMESTAMP`,
      [fileId]
    );

    if (lockRes.rows.length > 0) {
      const lock = lockRes.rows[0];
      if (lock.locked_by !== userId) {
        return res.status(409).json({
          locked: true,
          lockedBy: lock.username,
          lockedAt: lock.locked_at,
          expiresAt: lock.expires_at,
          message: `This file is currently being edited by ${lock.username}.`
        });
      }

      // If already locked by this user, extend the lease
      const extendRes = await pool.query(
        `UPDATE file_locks
         SET expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
         WHERE file_id = $1 AND locked_by = $2
         RETURNING locked_at, expires_at`,
        [fileId, userId]
      );
      
      await logActivity({
        userId,
        fileId,
        action: 'LOCK_ACQUIRED',
        description: `Acquired edit lock on ${filename}`,
        metadata: { filename, extended: true }
      });

      return res.json({
        message: 'Lock lease extended',
        locked: false,
        lockedBy: lock.username,
        lockedAt: extendRes.rows[0].locked_at,
        expiresAt: extendRes.rows[0].expires_at,
      });
    }

    // 4. Create new lock
    const insertRes = await pool.query(
      `INSERT INTO file_locks (file_id, locked_by, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
       RETURNING locked_at, expires_at`,
      [fileId, userId]
    );

    await logActivity({
      userId,
      fileId,
      action: 'LOCK_ACQUIRED',
      description: `Acquired edit lock on ${filename}`,
      metadata: { filename }
    });

    return res.status(201).json({
      message: 'Lock acquired successfully',
      locked: false,
      lockedAt: insertRes.rows[0].locked_at,
      expiresAt: insertRes.rows[0].expires_at,
    });
  } catch (err) {
    console.error('lockFile error:', err);
    return res.status(500).json({ error: 'Could not acquire lock' });
  }
};

exports.unlockFile = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId } = req.params;
  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required' });
  }

  try {
    const fileRes = await pool.query('SELECT owner_id, filename FROM files WHERE id = $1', [fileId]);
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const ownerId = fileRes.rows[0].owner_id;
    const filename = fileRes.rows[0].filename;

    // Check active lock
    const lockRes = await pool.query('SELECT locked_by FROM file_locks WHERE file_id = $1', [fileId]);
    if (lockRes.rows.length === 0) {
      return res.json({ message: 'File is not locked' });
    }

    const lockedBy = lockRes.rows[0].locked_by;

    // Only lock holder or file owner can release lock
    if (lockedBy !== userId && ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You cannot release this lock' });
    }

    await pool.query('DELETE FROM file_locks WHERE file_id = $1', [fileId]);

    await logActivity({
      userId,
      fileId,
      action: 'LOCK_RELEASED',
      description: `Released edit lock on ${filename}`,
      metadata: { filename }
    });

    return res.json({ message: 'Lock released successfully' });
  } catch (err) {
    console.error('unlockFile error:', err);
    return res.status(500).json({ error: 'Could not release lock' });
  }
};

exports.reviewFile = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { fileId } = req.params;
  const { status } = req.body; // 'reviewed' | 'approved' | 'rejected'

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required' });
  }

  const validStatuses = ['reviewed', 'approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    // Check permission to review
    const fileRes = await pool.query(
      `SELECT f.owner_id, f.filename, fs.permission
       FROM files f
       LEFT JOIN file_shares fs ON fs.file_id = f.id AND fs.recipient_id = $2
       WHERE f.id = $1 AND f.status != 'deleted'`,
      [fileId, userId]
    );

    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    const file = fileRes.rows[0];
    const isOwner = file.owner_id === userId;
    const hasReviewAccess = isOwner || canReview(file.permission);

    if (!hasReviewAccess) {
      return res.status(403).json({ error: 'Forbidden: Review access required' });
    }

    // Determine action name and description
    let action = '';
    let description = '';
    const filename = file.filename;

    if (status === 'reviewed') {
      action = 'FILE_REVIEWED';
      description = `Reviewed file ${filename}`;
    } else if (status === 'approved') {
      action = 'FILE_APPROVED';
      description = `Approved file ${filename}`;
    } else if (status === 'rejected') {
      action = 'FILE_REJECTED';
      description = `Rejected file ${filename}`;
    }

    // Log the activity
    await logActivity({
      userId,
      fileId,
      action,
      description,
      metadata: { filename, status }
    });

    return res.json({ message: `File marked as ${status} successfully` });
  } catch (err) {
    console.error('reviewFile error:', err);
    return res.status(500).json({ error: 'Could not complete review' });
  }
};