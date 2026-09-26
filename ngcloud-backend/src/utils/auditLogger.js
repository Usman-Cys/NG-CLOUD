const pool = require('../config/db');

async function logAction(userId, adminId, action, status, ipAddress, details = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, admin_id, action, status, ip_address, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId || null,
        adminId || null,
        action,
        status,
        ipAddress || null,
        details ? JSON.stringify(details) : null
      ]
    );
    console.log(`📝 Audit Log: [${action}] status=${status} userId=${userId || 'N/A'} adminId=${adminId || 'N/A'}`);
  } catch (err) {
    console.error('❌ Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
