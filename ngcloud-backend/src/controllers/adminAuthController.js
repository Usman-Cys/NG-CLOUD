const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/auditLogger');
const { hashPassword, verifyPassword } = require('../utils/passwordHash');

// Simple helper to sign admin token
function signAdminToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: admin.role || 'admin',
      type: 'admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Controller Methods

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Username and password are required'
    });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      await logAction(null, null, 'ADMIN_LOGIN_FAILED', 'denied', req.ip, { username, reason: 'admin not found' });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid admin credentials'
      });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      await logAction(null, admin.id, 'ADMIN_LOGIN_FAILED', 'denied', req.ip, { username, reason: 'account disabled' });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin account disabled'
      });
    }

    const { valid, needsRehash } = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      await logAction(null, admin.id, 'ADMIN_LOGIN_FAILED', 'denied', req.ip, { username, reason: 'password mismatch' });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid admin credentials'
      });
    }

    // Migrate legacy bcrypt hash to KT-QHF in background
    if (needsRehash) {
      hashPassword(password)
        .then((newHash) => {
          pool.query('UPDATE admins SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, admin.id])
            .catch((err) => console.error('Admin password rehash update error:', err.message));
        })
        .catch((err) => console.error('Admin password rehash error:', err.message));
    }

    const token = signAdminToken(admin);
    await logAction(null, admin.id, 'ADMIN_LOGIN_SUCCESS', 'ok', req.ip, { username });

    return res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Username is required'
    });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Password must be at least 8 characters long'
    });
  }

  try {
    // Check duplicate username in admins
    const usernameCheck = await pool.query(
      'SELECT id FROM admins WHERE username = $1',
      [username]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists'
      });
    }

    // Check duplicate email in admins (if email is provided)
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM admins WHERE email = $1',
        [email]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Email already exists'
        });
      }
    }

    const passwordHash = await hashPassword(password);
    const createdBy = req.admin.id;

    const result = await pool.query(
      `INSERT INTO admins (username, email, password_hash, role, created_by)
       VALUES ($1, $2, $3, 'admin', $4)
       RETURNING id, username, email, role, is_active, created_by, created_at`,
      [username, email || null, passwordHash, createdBy]
    );

    const newAdmin = result.rows[0];
    await logAction(null, createdBy, 'ADMIN_REGISTER_SUCCESS', 'ok', req.ip, { new_admin_username: username, new_admin_id: newAdmin.id });

    return res.status(201).json({
      message: 'Admin registered successfully',
      admin: newAdmin
    });
  } catch (err) {
    console.error('Admin registration error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

exports.listAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, is_active, created_by, created_at
       FROM admins
       ORDER BY created_at DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('List admins error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

exports.disableAdmin = async (req, res) => {
  const { id } = req.params;

  if (req.admin.id === id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Admins cannot disable themselves'
    });
  }

  try {
    const checkAdmin = await pool.query(
      'SELECT id, username FROM admins WHERE id = $1',
      [id]
    );

    if (checkAdmin.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Admin not found'
      });
    }

    const targetAdmin = checkAdmin.rows[0];

    await pool.query(
      'UPDATE admins SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    await logAction(null, req.admin.id, 'ADMIN_DISABLE_SUCCESS', 'ok', req.ip, { disabled_admin_id: id, disabled_admin_username: targetAdmin.username });

    return res.json({
      message: 'Admin account disabled successfully'
    });
  } catch (err) {
    console.error('Disable admin error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
