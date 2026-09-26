const pool = require('../config/db');

/**
 * Retrieves the current user's activity logs.
 * Supports pagination (?page=1&limit=50) and optional action filtering (?action=FILE_UPLOAD).
 * Sanitizes metadata so that secrets/keys/passwords are never returned.
 */
exports.getActivities = async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  const actionFilter = req.query.action;

  try {
    let queryText = `
      SELECT
        id,
        user_id AS "userId",
        file_id AS "fileId",
        action,
        description,
        metadata,
        created_at AS "createdAt"
      FROM activity_logs
      WHERE user_id = $1
    `;
    const queryParams = [userId];

    if (actionFilter) {
      queryParams.push(actionFilter);
      queryText += ` AND action = $2`;
    }

    // Sort newest first, apply limit and offset
    queryText += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryText, queryParams);

    // Get total count for pagination info
    let countQueryText = `SELECT COUNT(*)::int AS total FROM activity_logs WHERE user_id = $1`;
    const countQueryParams = [userId];
    if (actionFilter) {
      countQueryText += ` AND action = $2`;
      countQueryParams.push(actionFilter);
    }
    const countResult = await pool.query(countQueryText, countQueryParams);
    const totalCount = countResult.rows[0]?.total || 0;

    // Sanitize metadata to remove any potential keys, passwords, or encryption secrets
    const sanitizedActivities = result.rows.map((row) => {
      const sanitized = { ...row };
      if (sanitized.metadata) {
        const m = { ...sanitized.metadata };
        const keysToClear = [
          'private_key', 'privateKey', 'wrapped_key', 'wrappedKey', 
          'password', 'password_hash', 'decrypted_data', 'decryptedData', 
          'encryption_secret', 'encryptionSecret', 'secret', 'key'
        ];
        keysToClear.forEach(k => {
          if (k in m) delete m[k];
        });
        sanitized.metadata = m;
      }
      return sanitized;
    });

    return res.json({
      activities: sanitizedActivities,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      }
    });
  } catch (error) {
    console.error('getActivities error:', error);
    return res.status(500).json({ error: 'Failed to retrieve activities' });
  }
};
