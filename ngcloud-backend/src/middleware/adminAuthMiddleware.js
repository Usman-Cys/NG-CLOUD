const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing token'
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.role !== 'admin' || payload.type !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can perform this action'
      });
    }

    // Verify admin is active in PostgreSQL
    const result = await pool.query(
      'SELECT id, username, email, role, is_active FROM admins WHERE id = $1',
      [payload.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin account not found'
      });
    }

    const admin = result.rows[0];
    if (!admin.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin account disabled'
      });
    }

    req.admin = admin;
    
    // Maintain backward compatibility for endpoints/middleware expecting req.user
    req.user = {
      id: admin.id,
      username: admin.username,
      role: admin.role
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired admin token'
    });
  }
};
