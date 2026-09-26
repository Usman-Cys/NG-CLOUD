require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const userRoutes = require('./routes/userRoutes');
const shareRoutes = require('./routes/shareRoutes');
const policyRoutes = require('./routes/policyRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();


const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow Thunder Client/Postman/curl where Origin is not set.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

// HTTP-to-HTTPS redirect middleware for proxy-based setups
app.use((req, res, next) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (!isSecure && process.env.HTTPS_ENABLED === 'true') {
    const host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
    const targetPort = process.env.PORT === '443' ? '' : `:${process.env.PORT || 5000}`;
    return res.redirect(301, `https://${host}${targetPort}${req.url}`);
  }
  next();
});

// Full browser security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  
  // Strict Content Security Policy for the REST API
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  
  // Permissions Policy to restrict browser features
  res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');

  // Enforce HSTS if HTTPS is enabled
  if (process.env.HTTPS_ENABLED === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
});

app.get('/', (req, res) => res.json({ status: 'ok', service: 'NGCloud Backend API' }));

app.get('/health', async (req, res) => {
  const health = { status: 'healthy', database: 'unknown', minio: 'unknown' };
  try {
    await require('./config/db').query('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.status = 'unhealthy';
    health.database = 'disconnected';
    health.databaseError = error.message;
  }

  try {
    const minioClient = require('./config/minioClient');
    if (typeof minioClient.testMinioConnection === 'function') {
      const minio = await minioClient.testMinioConnection();
      health.minio = minio.ok ? 'connected' : 'disconnected';
      health.bucketExists = minio.bucketExists;
      if (!minio.ok) {
        health.status = 'degraded';
        health.minioError = minio.errorMessage;
      }
    }
  } catch (error) {
    health.status = 'degraded';
    health.minio = 'disconnected';
    health.minioError = error.message;
  }

  return res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/activity', activityRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message || err);
  if (err.stack) console.error('Stack:', err.stack);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal Server Error' : err.message });
});

module.exports = app;
