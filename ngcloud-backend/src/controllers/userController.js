const pool = require('../config/db');

exports.searchUsers = async (req, res) => {
  const currentUserId = req.user?.id || req.user?.sub;
  const q = req.query.q || req.query.username || '';

  if (!currentUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, kyber_public_key, public_key_pqc
       FROM users
       WHERE id != $1
         AND (kyber_public_key IS NOT NULL OR public_key_pqc IS NOT NULL)
         AND username ILIKE $2
       ORDER BY username ASC
       LIMIT 20`,
      [currentUserId, `%${q}%`]
    );

    const users = result.rows.map(row => ({
      id: row.id,
      username: row.username,
      kyberPublicKey: row.kyber_public_key || row.public_key_pqc || null,
      kyber_public_key: row.kyber_public_key || row.public_key_pqc || null,
    }));

    return res.json({ users });
  } catch (err) {
    console.error('searchUsers error:', err);
    return res.status(500).json({ error: 'Could not search users' });
  }
};
