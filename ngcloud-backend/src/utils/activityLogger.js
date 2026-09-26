const { logActivity: serviceLogActivity } = require('../services/activityLogger');

/**
 * Legacy logActivity wrapper for backward compatibility.
 * Translates old parameter format and delegates to the new activityLogger service.
 */
async function logActivity({
  userId = null,
  action,
  status = "success",
  ipAddress = null,
  userAgent = null,
  fileId = null,
  details = {},
}) {
  // Translate action to uppercase for consistency in new schema
  const upperAction = String(action).toUpperCase();
  
  // Create description from action and status/details
  const description = details?.filename 
    ? `${upperAction} performed on ${details.filename} (${status})`
    : `${upperAction} performed (${status})`;

  // Package metadata
  const metadata = {
    status,
    ipAddress,
    userAgent,
    ...details
  };

  await serviceLogActivity({
    userId,
    fileId,
    action: upperAction,
    description,
    metadata
  });
}

module.exports = { logActivity };
