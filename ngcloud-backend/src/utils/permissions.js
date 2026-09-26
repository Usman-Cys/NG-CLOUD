/**
 * Shared-file permission helpers.
 *
 * Permission hierarchy:
 *   read       – download/view
 *   write      – download + upload new version + lock
 *   review     – download + review actions
 *   share      – download + share/re-share
 *   read_write – download + upload + lock
 *   read_review – download + review
 *   full_access – everything
 *
 * The file owner bypasses all checks (implied full_access).
 */

const READ_PERMISSIONS = new Set(['read', 'write', 'review', 'share', 'read_write', 'read_review', 'full_access']);
const WRITE_PERMISSIONS = new Set(['write', 'read_write', 'full_access']);
const REVIEW_PERMISSIONS = new Set(['review', 'read_review', 'full_access']);
const SHARE_PERMISSIONS = new Set(['share', 'full_access']);

function canRead(permission) {
  return permission === 'owner' || READ_PERMISSIONS.has(permission);
}

function canWrite(permission) {
  return permission === 'owner' || WRITE_PERMISSIONS.has(permission);
}

function canReview(permission) {
  return permission === 'owner' || REVIEW_PERMISSIONS.has(permission);
}

function canShare(permission) {
  return permission === 'owner' || SHARE_PERMISSIONS.has(permission);
}

module.exports = { canRead, canWrite, canReview, canShare };