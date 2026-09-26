function normalizeUsername(username) {
  return String(username || '').trim();
}

function validateUsername(username) {
  const value = normalizeUsername(username);
  if (!value) return 'Username is required.';
  if (value.length < 3 || value.length > 30) return 'Username must be 3 to 30 characters.';
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Username can only contain letters, numbers, dot, dash, and underscore.';
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long.';

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score < 3) {
    return 'Password is too weak. It must be at least 8 characters and contain at least two of the following: uppercase letters, numbers, or special characters.';
  }
  return null;
}

function sanitizeFilename(name) {
  const simple = String(name || '').trim();
  if (!simple || simple.length > 180) return null;
  if (simple.includes('../') || simple.includes('..\\') || simple.includes('/') || simple.includes('\\')) return null;
  // Allow practical file names while blocking control characters and SQL/path punctuation that should not be needed in object names.
  if (!/^[a-zA-Z0-9._ -]+$/.test(simple)) return null;
  return simple.replace(/\s+/g, '_');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function parsePositiveInteger(value, fallback = 1) {
  const n = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return null;
  return n;
}

module.exports = {
  normalizeUsername,
  validateUsername,
  validatePassword,
  sanitizeFilename,
  isUuid,
  parsePositiveInteger,
};
