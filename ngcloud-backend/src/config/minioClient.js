require('dotenv').config();
const Minio = require('minio');

const requiredEnv = [
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required MinIO environment variables: ${missing.join(', ')}`);
}

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
const MINIO_PORT = parseInt(process.env.MINIO_PORT, 10);
if (Number.isNaN(MINIO_PORT)) {
  throw new Error('MINIO_PORT must be a valid number');
}

const MINIO_USE_SSL = String(process.env.MINIO_USE_SSL || '').toLowerCase() === 'true';

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

function getMinioConfigSummary() {
  return {
    endpoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    bucket: process.env.MINIO_BUCKET,
    useSSL: MINIO_USE_SSL,
  };
}

function classifyMinioError(err) {
  const message = String(err && err.message ? err.message : err);
  const code = err && err.code ? String(err.code) : '';
  const name = err && err.name ? String(err.name) : '';

  if (message.includes('S3 API Requests must be made to API port')) {
    return { type: 'wrong_port', message };
  }
  if (code === 'AccessDenied' || code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') {
    return { type: 'auth_failure', message };
  }
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    return { type: 'network_failure', message };
  }
  if (name === 'S3Error') {
    return { type: 's3_error', message: code ? `${code}: ${message}` : message };
  }
  return { type: 'unknown', message };
}

async function testMinioConnection() {
  const bucket = process.env.MINIO_BUCKET;
  try {
    const exists = await minioClient.bucketExists(bucket);
    return {
      ok: true,
      bucketExists: exists,
    };
  } catch (err) {
    const classified = classifyMinioError(err);
    const code = err && err.code ? String(err.code) : null;
    const statusCode = err && err.statusCode ? Number(err.statusCode) : null;
    const name = err && err.name ? String(err.name) : null;
    return {
      ok: false,
      bucketExists: false,
      errorType: classified.type,
      errorMessage: classified.message,
      errorCode: code,
      statusCode: Number.isFinite(statusCode) ? statusCode : null,
      errorName: name,
      amzRequestid: err && err.amzRequestid ? String(err.amzRequestid) : null,
      amzId2: err && err.amzId2 ? String(err.amzId2) : null,
      amzBucketRegion: err && err.amzBucketRegion ? String(err.amzBucketRegion) : null,
    };
  }
}

function ensureBucketExists() {
  const bucket = process.env.MINIO_BUCKET;
  return new Promise((resolve, reject) => {
    minioClient.bucketExists(bucket, (err, exists) => {
      if (err) return reject(err);
      if (exists) {
        console.log(`✓ MinIO bucket exists: ${bucket}`);
        return resolve();
      }
      console.log(`MinIO bucket not found. Creating: ${bucket}`);
      minioClient.makeBucket(bucket, 'us-east-1', (makeErr) => {
        if (makeErr) return reject(makeErr);
        console.log(`✓ MinIO bucket created: ${bucket}`);
        return resolve();
      });
    });
  });
}

minioClient.ensureBucketExists = ensureBucketExists;
minioClient.getMinioConfigSummary = getMinioConfigSummary;
minioClient.testMinioConnection = testMinioConnection;
minioClient.classifyMinioError = classifyMinioError;

module.exports = minioClient;
