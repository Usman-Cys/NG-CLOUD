/**
 * Frontend permission helpers for shared-file access control.
 *
 * Permission levels:
 *   'owner'      – full access (implied canRead/canWrite/canReview/canShare)
 *   'read'       – download/view
 *   'write'      – download + upload new version + lock
 *   'review'     – download + review actions
 *   'share'      – download + share/re-share
 *   'read_write'  – download + upload + lock
 *   'read_review' – download + review
 *   'full_access' – everything
 */

const READ_PERMISSIONS = new Set(['read', 'write', 'review', 'share', 'read_write', 'read_review', 'full_access']);
const WRITE_PERMISSIONS = new Set(['write', 'read_write', 'full_access']);
const REVIEW_PERMISSIONS = new Set(['review', 'read_review', 'full_access']);
const SHARE_PERMISSIONS = new Set(['share', 'full_access']);

export function canRead(permission) {
  return permission === 'owner' || READ_PERMISSIONS.has(permission);
}

export function canWrite(permission) {
  return permission === 'owner' || WRITE_PERMISSIONS.has(permission);
}

export function canReview(permission) {
  return permission === 'owner' || REVIEW_PERMISSIONS.has(permission);
}

export function canShare(permission) {
  return permission === 'owner' || SHARE_PERMISSIONS.has(permission);
}

export function getPermissionLabel(permission) {
  if (permission === 'owner') return 'Owner (Full Access)';
  if (permission === 'read_write') return 'Read + Write';
  if (permission === 'read_review') return 'Read + Review';
  if (permission === 'full_access') return 'Full Access (All Actions)';
  return (permission || '').charAt(0).toUpperCase() + (permission || '').slice(1);
}