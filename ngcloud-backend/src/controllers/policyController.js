const pool = require('../config/db');
const { getMaxFileSizeBytes, getAllowedExtensions } = require('../utils/filePolicy');

function getUserId(req) {
  const user = req.user || {};
  return user.id || user.sub || null;
}

exports.getUploadPolicy = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRes = await pool.query(
      'SELECT storage_quota_bytes FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const quota = Number(userRes.rows[0].storage_quota_bytes || 524288000);

    const usedRes = await pool.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used
       FROM files
       WHERE owner_id = $1 AND status != 'deleted'`,
      [userId]
    );
    const used = Number(usedRes.rows[0].used);
    const remaining = Math.max(0, quota - used);

    return res.json({
      maxFileSizeBytes: getMaxFileSizeBytes(),
      userQuota: {
        used,
        quota,
        remaining
      },
      allowedExtensions: getAllowedExtensions(),
      allowedMimeTypes: []
    });
  } catch (error) {
    console.error('getUploadPolicy error:', error);
    return res.status(500).json({ error: 'Failed to retrieve upload policy' });
  }
};
