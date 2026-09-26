/**
 * NGCloud Password Hashing Utility — KT-QHF Salted Iterative Hashing
 *
 * Stored format:  ktqhf$v1$iterations$saltHex$hashHex
 * Example:        ktqhf$v1$10000$9f8a...$a31c...
 *
 * Backward-compatible with legacy bcrypt hashes ($2a$, $2b$, $2y$).
 * Automatically signals when a bcrypt hash should be migrated.
 *
 * Security features:
 *   - Unique random 16-byte salt per password
 *   - Configurable iterations via KTQHF_PASSWORD_ITERATIONS env var
 *   - Optional server-side pepper from KTQHF_PASSWORD_PEPPER env var
 *   - Constant-time comparison via crypto.timingSafeEqual
 */

'use strict';

const crypto = require('crypto');
const { ktqhf } = require('./ktqhf');

// Lazy-load bcrypt only when needed for legacy verification
let bcrypt = null;
function getBcrypt() {
  if (!bcrypt) {
    try {
      bcrypt = require('bcryptjs');
    } catch (_) {
      bcrypt = require('bcrypt');
    }
  }
  return bcrypt;
}

// ════════════════════════════════════════════════════════════
// §1  CONFIGURATION
// ════════════════════════════════════════════════════════════

const CURRENT_VERSION = 'v1';
const SALT_BYTES = 16;

function getIterations() {
  return Number(process.env.KTQHF_PASSWORD_ITERATIONS) || 10000;
}

function getPepper() {
  const pepper = process.env.KTQHF_PASSWORD_PEPPER || '';
  if (!pepper && process.env.NODE_ENV !== 'production') {
    // Only warn once
    if (!getPepper._warned) {
      console.warn(
        '⚠️  KTQHF_PASSWORD_PEPPER is not set. ' +
        'Passwords will be hashed without a pepper. ' +
        'Set KTQHF_PASSWORD_PEPPER in .env for production use.'
      );
      getPepper._warned = true;
    }
  }
  return pepper;
}

// ════════════════════════════════════════════════════════════
// §2  HASH DETECTION HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Check if a stored hash is a KT-QHF hash.
 * @param {string} storedHash
 * @returns {boolean}
 */
function isKtqhfHash(storedHash) {
  return typeof storedHash === 'string' && storedHash.startsWith('ktqhf$');
}

/**
 * Check if a stored hash is a bcrypt hash.
 * @param {string} storedHash
 * @returns {boolean}
 */
function isBcryptHash(storedHash) {
  if (typeof storedHash !== 'string') return false;
  return (
    storedHash.startsWith('$2a$') ||
    storedHash.startsWith('$2b$') ||
    storedHash.startsWith('$2y$')
  );
}

/**
 * Check if a stored hash needs to be re-hashed (migrated to current KT-QHF).
 * @param {string} storedHash
 * @returns {boolean}
 */
function needsRehash(storedHash) {
  // Any bcrypt hash needs migration
  if (isBcryptHash(storedHash)) return true;

  // If it's a KT-QHF hash, check version and iterations
  if (isKtqhfHash(storedHash)) {
    const parts = storedHash.split('$');
    // Format: ktqhf$v1$iterations$saltHex$hashHex
    if (parts.length !== 5) return true;
    const version = parts[1];
    const iterations = Number(parts[2]);
    if (version !== CURRENT_VERSION) return true;
    if (iterations < getIterations()) return true;
    return false;
  }

  // Unknown format — needs rehash
  return true;
}

// ════════════════════════════════════════════════════════════
// §3  CORE ITERATIVE HASHING
// ════════════════════════════════════════════════════════════

/**
 * Run iterative KT-QHF hashing.
 * @param {string} password     — plaintext password
 * @param {string} saltHex      — hex-encoded salt
 * @param {number} iterations   — number of iterations
 * @returns {string} 64-char hex hash
 */
function iterativeKtqhf(password, saltHex, iterations) {
  const pepper = getPepper();

  // Initial state: password + saltHex + pepper
  let state = password + saltHex + pepper;

  for (let i = 0; i < iterations; i++) {
    state = ktqhf(state + ':' + i);
  }

  return state; // ktqhf() returns a 64-char hex string
}

// ════════════════════════════════════════════════════════════
// §4  PUBLIC API
// ════════════════════════════════════════════════════════════

/**
 * Hash a plaintext password using KT-QHF iterative hashing.
 * @param {string} password
 * @returns {Promise<string>} formatted hash string: ktqhf$v1$iterations$saltHex$hashHex
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const saltHex = salt.toString('hex');
  const iterations = getIterations();

  const hashHex = iterativeKtqhf(password, saltHex, iterations);

  return `ktqhf$${CURRENT_VERSION}$${iterations}$${saltHex}$${hashHex}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Supports both KT-QHF and legacy bcrypt hashes.
 *
 * @param {string} password    — plaintext password to verify
 * @param {string} storedHash  — stored hash string from database
 * @returns {Promise<{valid: boolean, needsRehash: boolean}>}
 */
async function verifyPassword(password, storedHash) {
  // ── KT-QHF hash ────────────────────────────────────────────
  if (isKtqhfHash(storedHash)) {
    const parts = storedHash.split('$');
    // Format: ktqhf$v1$iterations$saltHex$hashHex
    if (parts.length !== 5) {
      return { valid: false, needsRehash: false };
    }

    const version    = parts[1];
    const iterations = Number(parts[2]);
    const saltHex    = parts[3];
    const hashHex    = parts[4];

    if (version !== CURRENT_VERSION || !iterations || !saltHex || !hashHex) {
      return { valid: false, needsRehash: false };
    }

    const computed = iterativeKtqhf(password, saltHex, iterations);

    // Constant-time comparison
    const computedBuf = Buffer.from(computed, 'hex');
    const storedBuf   = Buffer.from(hashHex, 'hex');

    if (computedBuf.length !== storedBuf.length) {
      return { valid: false, needsRehash: false };
    }

    const valid = crypto.timingSafeEqual(computedBuf, storedBuf);

    return {
      valid,
      needsRehash: valid ? (iterations < getIterations()) : false,
    };
  }

  // ── Legacy bcrypt hash ─────────────────────────────────────
  if (isBcryptHash(storedHash)) {
    try {
      const bc = getBcrypt();
      const valid = await bc.compare(password, storedHash);
      return {
        valid,
        needsRehash: valid ? true : false,
      };
    } catch (err) {
      console.error('bcrypt comparison error:', err.message);
      return { valid: false, needsRehash: false };
    }
  }

  // ── Unknown format ─────────────────────────────────────────
  return { valid: false, needsRehash: false };
}

// ════════════════════════════════════════════════════════════
// §5  EXPORTS
// ════════════════════════════════════════════════════════════

module.exports = {
  hashPassword,
  verifyPassword,
  isKtqhfHash,
  isBcryptHash,
  needsRehash,
};
