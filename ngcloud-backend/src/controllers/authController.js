const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/auditLogger');
const { logActivity } = require('../services/activityLogger');
const {
  normalizeUsername,
  validateUsername,
  validatePassword,
} = require('../utils/validation');
const { hashPassword, verifyPassword } = require('../utils/passwordHash');

function publicUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    role: row.role || 'user',

    publicKeyPqc: row.public_key_pqc || null,
    public_key_pqc: row.public_key_pqc || null,

    kyberPublicKey: row.kyber_public_key || null,
    kyber_public_key: row.kyber_public_key || null,

    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role || 'user',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

exports.register = async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const { password, publicKeyPqc, kyberPublicKey } = req.body;

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({
      error: usernameError,
      message: usernameError,
    });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({
      error: passwordError,
      message: passwordError,
    });
  }

  try {
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Username is already taken.',
        message: 'Username is already taken.',
      });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await pool.query(
      `INSERT INTO users
       (username, password_hash, public_key_pqc, kyber_public_key, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING
         id,
         username,
         role,
         public_key_pqc,
         kyber_public_key,
         created_at`,
      [username, passwordHash, publicKeyPqc || null, kyberPublicKey || null]
    );

    return res.status(201).json({
      message: 'User registered successfully!',
      user: publicUser(newUser.rows[0]),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Username is already taken.',
        message: 'Username is already taken.',
      });
    }

    console.error('Registration Error:', err);
    return res.status(500).json({
      error: 'Internal server error during registration.',
    });
  }
};

exports.login = async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const { password } = req.body;

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({
      error: usernameError,
      message: usernameError,
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      error: 'Password is required.',
      message: 'Password is required.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         username,
         password_hash,
         role,
         public_key_pqc,
         kyber_public_key,
         created_at,
         is_active
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      await logAction(null, null, 'USER_LOGIN_FAILED', 'denied', req.ip, { username, reason: 'user not found' });
      return res.status(401).json({
        error: 'Invalid credentials.',
        message: 'Invalid credentials.',
      });
    }

    const user = result.rows[0];

    if (user.is_active === false || user.status === 'disabled' || user.status === 'locked') {
      await logAction(user.id, null, 'USER_LOGIN_FAILED', 'denied', req.ip, { username, reason: 'account deactivated' });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account has been deactivated.',
      });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await logAction(user.id, null, 'USER_LOGIN_FAILED', 'denied', req.ip, { username, reason: 'password mismatch' });
      return res.status(401).json({
        error: 'Invalid credentials.',
        message: 'Invalid credentials.',
      });
    }

    // Migrate legacy bcrypt hash to KT-QHF in background
    if (needsRehash) {
      hashPassword(password)
        .then((newHash) => {
          pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, user.id])
            .catch((err) => console.error('Password rehash update error:', err.message));
        })
        .catch((err) => console.error('Password rehash error:', err.message));
    }

    const token = signToken(user);
    await logAction(user.id, null, 'USER_LOGIN_SUCCESS', 'ok', req.ip, { username });
    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      description: 'Logged in',
      metadata: { username: user.username, ipAddress: req.ip, userAgent: req.headers['user-agent'] }
    });

    // Update last_login_at in background
    pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]).catch(console.error);

    return res.status(200).json({
      message: 'Authentication successful!',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({
      error: 'Internal server error during login.',
    });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         username,
         role,
         public_key_pqc,
         kyber_public_key,
         created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: publicUser(result.rows[0]),
    });
  } catch (err) {
    console.error('Me Error:', err);
    return res.status(500).json({
      error: 'Could not load user profile.',
    });
  }
};

exports.saveKyberPublicKey = async (req, res) => {
  const userId = req.user?.id || req.user?.sub;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { kyberPublicKey } = req.body || {};

  if (!kyberPublicKey || typeof kyberPublicKey !== 'string') {
    return res.status(400).json({
      error: 'kyberPublicKey is required',
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET kyber_public_key = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING
         id,
         username,
         role,
         public_key_pqc,
         kyber_public_key,
         created_at`,
      [kyberPublicKey, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      message: 'Kyber public key saved successfully',
      user: publicUser(result.rows[0]),
    });
  } catch (err) {
    console.error('saveKyberPublicKey error:', err);
    return res.status(500).json({
      error: 'Could not save Kyber public key',
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const userId = req.user?.id;
    const username = req.user?.username;
    if (userId) {
      await logActivity({
        userId,
        action: 'LOGOUT',
        description: 'Logged out',
        metadata: { username, ipAddress: req.ip, userAgent: req.headers['user-agent'] }
      });
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout handler error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
};