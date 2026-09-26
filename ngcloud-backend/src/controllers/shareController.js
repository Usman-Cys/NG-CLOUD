const pool = require('../config/db');
const { isUuid } = require('../utils/validation');
const { canRead, canWrite, canReview, canShare } = require('../utils/permissions');
const { logActivity } = require('../services/activityLogger');

exports.sharedByMe = async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await pool.query(
      `SELECT
        fs.id AS share_id,
        fs.id,
        fs.file_id,
        fs.owner_id,
        fs.recipient_id,
        fs.recipient_wrapped_key,
        fs.permission,
        fs.created_at,
        fs.updated_at,
        f.filename,
        f.size_bytes,
        f.total_chunks,
        u.username AS recipient_username,
        COALESCE(u.kyber_public_key, u.public_key_pqc) AS recipient_public_key
      FROM file_shares fs
      JOIN files f ON f.id = fs.file_id
      JOIN users u ON u.id = fs.recipient_id
      WHERE fs.owner_id = $1
      ORDER BY fs.created_at DESC`,
      [userId]
    );

    const shares = result.rows.map(row => ({
      id: row.id,
      shareId: row.id,
      fileId: row.file_id,
      ownerId: row.owner_id,
      recipientId: row.recipient_id,
      recipientWrappedKey: row.recipient_wrapped_key,
      permission: row.permission,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      filename: row.filename,
      sizeBytes: Number(row.size_bytes),
      totalChunks: row.total_chunks,
      recipientUsername: row.recipient_username,
      recipientPublicKey: row.recipient_public_key,
    }));

    return res.json({ shares });
  } catch (err) {
    console.error('sharedByMe error:', err);
    return res.status(500).json({ error: 'Could not retrieve shared by me' });
  }
};

exports.sharedWithMe = async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await pool.query(
      `SELECT
        fs.id AS share_id,
        fs.id,
        fs.file_id,
        fs.owner_id,
        fs.recipient_id,
        fs.recipient_wrapped_key,
        fs.permission,
        fs.created_at,
        fs.updated_at,
        f.filename,
        f.size_bytes,
        f.total_chunks,
        f.nonce,
        f.algorithm,
        f.original_filename,
        f.encrypted_filename,
        f.chunk_size,
        f.file_hash,
        u.username AS owner_username,
        l.id AS lock_id,
        l.locked_by,
        l.lock_reason,
        l.locked_at,
        l.expires_at,
        lu.username AS locked_by_username
      FROM file_shares fs
      JOIN files f ON f.id = fs.file_id
      JOIN users u ON u.id = fs.owner_id
      LEFT JOIN file_locks l ON l.file_id = fs.file_id AND l.expires_at > CURRENT_TIMESTAMP
      LEFT JOIN users lu ON lu.id = l.locked_by
      WHERE fs.recipient_id = $1
      ORDER BY fs.created_at DESC`,
      [userId]
    );

    const shares = result.rows.map(row => ({
      id: row.id,
      shareId: row.id,
      fileId: row.file_id,
      ownerId: row.owner_id,
      recipientId: row.recipient_id,
      recipientWrappedKey: row.recipient_wrapped_key,
      wrapped_key: row.recipient_wrapped_key, // For frontend compatibility
      permission: row.permission,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      filename: row.filename,
      sizeBytes: Number(row.size_bytes),
      totalChunks: row.total_chunks,
      nonce: row.nonce,
      algorithm: row.algorithm,
      originalFilename: row.original_filename,
      encryptedFilename: row.encrypted_filename,
      chunkSize: row.chunk_size,
      fileHash: row.file_hash,
      ownerUsername: row.owner_username,
      lock: row.lock_id ? {
        id: row.lock_id,
        lockedBy: row.locked_by_username,
        lockReason: row.lock_reason,
        lockedAt: row.locked_at,
        expiresAt: row.expires_at,
      } : null,
    }));

    return res.json({ shares });
  } catch (err) {
    console.error('sharedWithMe error:', err);
    return res.status(500).json({ error: 'Could not retrieve shared with me' });
  }
};

exports.createShare = async (req, res) => {
  const callerId = req.user?.id || req.user?.sub;
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const fileId = req.body.fileId || req.body.file_id;
  const recipientId = req.body.recipientId || req.body.recipient_id;
  const permission = req.body.permission || 'read';
  const recipientWrappedKey = req.body.recipientWrappedKey || req.body.recipient_wrapped_key;

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required' });
  }
  if (!recipientId || !isUuid(recipientId)) {
    return res.status(400).json({ error: 'Valid recipientId is required' });
  }
  if (!recipientWrappedKey || typeof recipientWrappedKey !== 'string') {
    return res.status(400).json({ error: 'recipientWrappedKey is required' });
  }

  const validPermissions = ['read', 'write', 'review', 'share', 'read_write', 'read_review', 'full_access'];
  if (!validPermissions.includes(permission)) {
    return res.status(400).json({ error: `Invalid permission: ${permission}. Must be one of ${validPermissions.join(', ')}` });
  }

  if (callerId === recipientId) {
    return res.status(400).json({ error: 'You cannot share files with yourself' });
  }

  try {
    // 1. Verify file exists and retrieve its owner ID and filename
    const fileRes = await pool.query('SELECT owner_id, filename FROM files WHERE id = $1', [fileId]);
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const fileOwnerId = fileRes.rows[0].owner_id;
    const filename = fileRes.rows[0].filename;

    if (recipientId === fileOwnerId) {
      return res.status(400).json({ error: 'You cannot share a file with its owner' });
    }

    // Check if share already exists to determine if it is a permission change
    const existingShare = await pool.query(
      'SELECT permission FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
      [fileId, recipientId]
    );

    // 2. Verify caller has sharing rights (owner OR has share/full_access permission)
    const isOwner = fileOwnerId === callerId;
    let hasShareAccess = isOwner;

    if (!isOwner) {
      const callerShare = await pool.query(
        'SELECT permission FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
        [fileId, callerId]
      );
      if (callerShare.rows.length > 0) {
        const callerPerm = callerShare.rows[0].permission;
        if (canShare(callerPerm)) {
          hasShareAccess = true;
        }
      }
    }

    if (!hasShareAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have share permissions for this file' });
    }

    // 3. Verify recipient exists and has Kyber public key
    const recipientRes = await pool.query(
      'SELECT id, username, kyber_public_key, public_key_pqc FROM users WHERE id = $1',
      [recipientId]
    );
    if (recipientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    const recipient = recipientRes.rows[0];
    const recipientUsername = recipient.username;
    if (!recipient.kyber_public_key && !recipient.public_key_pqc) {
      return res.status(400).json({ error: 'Recipient does not have a Kyber public key' });
    }

    // 4. Create/Update share record
    const result = await pool.query(
      `INSERT INTO file_shares (file_id, owner_id, recipient_id, recipient_wrapped_key, permission)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (file_id, recipient_id)
       DO UPDATE SET
         recipient_wrapped_key = EXCLUDED.recipient_wrapped_key,
         permission = EXCLUDED.permission,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [fileId, fileOwnerId, recipientId, recipientWrappedKey, permission]
    );

    if (existingShare.rows.length > 0) {
      await logActivity({
        userId: callerId,
        fileId,
        action: 'PERMISSION_CHANGED',
        description: `Changed permissions for file ${filename} with ${recipientUsername} to ${permission}`,
        metadata: { filename, recipientUsername, permission }
      });
    } else {
      await logActivity({
        userId: callerId,
        fileId,
        action: 'FILE_SHARE',
        description: `Shared file ${filename} with ${recipientUsername}`,
        metadata: { filename, recipientUsername, permission }
      });
    }

    return res.status(201).json({
      message: 'File shared successfully',
      share: result.rows[0],
    });
  } catch (err) {
    console.error('createShare error:', err);
    return res.status(500).json({ error: 'Could not create file share' });
  }
};

exports.deleteShare = async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { shareId } = req.params;
  if (!shareId || !isUuid(shareId)) {
    return res.status(400).json({ error: 'Valid shareId is required' });
  }

  try {
    const shareRes = await pool.query(
      `SELECT fs.id, fs.file_id, fs.owner_id, fs.recipient_id, f.filename, u.username AS recipient_username
       FROM file_shares fs
       JOIN files f ON f.id = fs.file_id
       JOIN users u ON u.id = fs.recipient_id
       WHERE fs.id = $1`,
      [shareId]
    );

    if (shareRes.rows.length === 0) {
      return res.status(404).json({ error: 'Share record not found' });
    }

    const share = shareRes.rows[0];

    // Allowed if current user is owner (who shared it) or recipient (who leaves it)
    const isOwner = share.owner_id === userId;
    const isRecipient = share.recipient_id === userId;

    if (!isOwner && !isRecipient) {
      return res.status(403).json({ error: 'Forbidden: You cannot revoke this share' });
    }

    await pool.query('DELETE FROM file_shares WHERE id = $1', [shareId]);

    await logActivity({
      userId,
      fileId: share.file_id,
      action: 'FILE_UNSHARE',
      description: `Revoked share for file ${share.filename} with ${share.recipient_username}`,
      metadata: { filename: share.filename, recipientUsername: share.recipient_username }
    });

    return res.json({
      message: 'Share revoked successfully',
      shareId,
    });
  } catch (err) {
    console.error('deleteShare error:', err);
    return res.status(500).json({ error: 'Could not revoke share' });
  }
};

exports.createShareBatch = async (req, res) => {
  const callerId = req.user?.id || req.user?.sub;
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const fileId = req.body.fileId || req.body.file_id;
  const permission = req.body.permission || 'read';
  const shares = req.body.shares;

  if (!shares || !Array.isArray(shares)) {
    return res.status(400).json({ error: 'At least one recipient is required.' });
  }

  if (shares.length === 0) {
    return res.status(400).json({ error: 'At least one recipient is required.' });
  }

  if (shares.length > 5) {
    return res.status(400).json({ error: 'Cannot share with more than 5 recipients at once.' });
  }

  if (!fileId || !isUuid(fileId)) {
    return res.status(400).json({ error: 'Valid fileId is required' });
  }

  const validPermissions = ['read', 'write', 'review', 'share', 'read_write', 'read_review', 'full_access'];
  if (!validPermissions.includes(permission)) {
    return res.status(400).json({ error: `Invalid permission: ${permission}. Must be one of ${validPermissions.join(', ')}` });
  }

  try {
    const fileRes = await pool.query('SELECT owner_id, filename FROM files WHERE id = $1', [fileId]);
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const fileOwnerId = fileRes.rows[0].owner_id;

    const isOwner = fileOwnerId === callerId;
    let hasShareAccess = isOwner;

    if (!isOwner) {
      const callerShare = await pool.query(
        'SELECT permission FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
        [fileId, callerId]
      );
      if (callerShare.rows.length > 0) {
        const callerPerm = callerShare.rows[0].permission;
        if (canShare(callerPerm)) {
          hasShareAccess = true;
        }
      }
    }

    if (!hasShareAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have share permissions for this file' });
    }

    const checkedShares = [];
    const recipientIdsSeen = new Set();

    for (const item of shares) {
      const recipientId = item.recipientId || item.recipient_id;
      const recipientWrappedKey = item.recipientWrappedKey || item.recipient_wrapped_key;

      if (!recipientId || !isUuid(recipientId)) {
        return res.status(400).json({ error: 'Valid recipientId is required for all shares' });
      }
      if (!recipientWrappedKey || typeof recipientWrappedKey !== 'string') {
        return res.status(400).json({ error: 'recipientWrappedKey is required for all shares' });
      }

      if (recipientId === callerId) {
        return res.status(400).json({ error: 'You cannot share files with yourself' });
      }
      if (recipientId === fileOwnerId) {
        return res.status(400).json({ error: 'You cannot share a file with its owner' });
      }

      if (recipientIdsSeen.has(recipientId)) {
        return res.status(400).json({ error: 'Duplicate recipients detected in batch share request' });
      }
      recipientIdsSeen.add(recipientId);

      const recipientRes = await pool.query(
        'SELECT id, username, kyber_public_key, public_key_pqc FROM users WHERE id = $1',
        [recipientId]
      );
      if (recipientRes.rows.length === 0) {
        return res.status(404).json({ error: 'Recipient user not found' });
      }

      const recipient = recipientRes.rows[0];
      if (!recipient.kyber_public_key && !recipient.public_key_pqc) {
        return res.status(400).json({ error: `User ${recipient.username} does not have a Kyber public key.` });
      }

      const shareRes = await pool.query(
        'SELECT id FROM file_shares WHERE file_id = $1 AND recipient_id = $2',
        [fileId, recipientId]
      );
      if (shareRes.rows.length > 0) {
        return res.status(409).json({ error: `File is already shared with ${recipient.username}.` });
      }

      checkedShares.push({
        recipientId,
        recipientWrappedKey,
        recipientUsername: recipient.username,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of checkedShares) {
        await client.query(
          `INSERT INTO file_shares (file_id, owner_id, recipient_id, recipient_wrapped_key, permission)
           VALUES ($1, $2, $3, $4, $5)`,
          [fileId, fileOwnerId, item.recipientId, item.recipientWrappedKey, permission]
        );
      }
      await client.query('COMMIT');

      const filename = fileRes.rows[0].filename;
      for (const item of checkedShares) {
        await logActivity({
          userId: callerId,
          fileId,
          action: 'FILE_SHARE',
          description: `Shared file ${filename} with ${item.recipientUsername}`,
          metadata: { filename, recipientUsername: item.recipientUsername, permission }
        });
      }
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    return res.status(201).json({
      message: `File shared with ${checkedShares.length} users successfully.`,
      count: checkedShares.length,
    });
  } catch (err) {
    console.error('createShareBatch error:', err);
    return res.status(500).json({ error: 'Could not create file shares' });
  }
};

