const pool = require('../config/db');

/**
 * Logs a user activity/event to the database.
 * Uses try/catch so activity failures never break application flow.
 *
 * @param {Object} params
 * @param {string} params.userId - UUID of the user performing the action (NOT NULL)
 * @param {string} [params.fileId] - UUID of the related file, if any
 * @param {string} params.action - Action identifier/type (e.g. FILE_UPLOAD)
 * @param {string} params.description - Human-readable description of the activity
 * @param {Object} [params.metadata] - Extra structured metadata (will be JSON serialized)
 */
async function logActivity({
  userId,
  fileId = null,
  action,
  description,
  metadata = null
}) {
  try {
    if (!userId) {
      console.warn(`[ActivityLogger] Warning: Skipped logging action "${action}" because userId was null or undefined.`);
      return;
    }

    const queryText = `
      INSERT INTO activity_logs (user_id, file_id, action, description, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `;
    const queryParams = [
      userId,
      fileId || null,
      action,
      description,
      metadata ? JSON.stringify(metadata) : null
    ];

    await pool.query(queryText, queryParams);
  } catch (error) {
    console.error(`[ActivityLogger] Error logging activity (${action}):`, error.message);
  }
}

module.exports = { logActivity };
