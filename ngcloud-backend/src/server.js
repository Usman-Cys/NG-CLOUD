require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');

const app = require('./app');
const minioClient = require('./config/minioClient');

const PORT = Number(process.env.PORT || 5000);
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED || '').toLowerCase() === 'true';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || 'ssl/server.key';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || 'ssl/server.cert';

function startHttpServer() {
  http.createServer(app).listen(PORT, () => {
    console.log(`NGCloud backend listening over HTTP at http://localhost:${PORT}`);
  });
}

function startHttpsServer() {
  if (!fs.existsSync(SSL_KEY_PATH)) {
    console.error(`HTTPS enabled, but SSL key file was not found at: ${SSL_KEY_PATH}`);
    console.error('Set SSL_KEY_PATH to a valid self-signed key file for local development.');
    process.exit(1);
  }

  if (!fs.existsSync(SSL_CERT_PATH)) {
    console.error(`HTTPS enabled, but SSL certificate file was not found at: ${SSL_CERT_PATH}`);
    console.error('Set SSL_CERT_PATH to a valid self-signed certificate file for local development.');
    process.exit(1);
  }

  // Self-signed certificates are intended for local development only.
  const sslOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH),
  };

  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`NGCloud backend listening over HTTPS at https://localhost:${PORT}`);
  });

  // Start HTTP companion server to redirect HTTP traffic to HTTPS
  const redirectPort = Number(process.env.HTTP_PORT || (PORT === 443 ? 80 : PORT + 1));
  http.createServer((req, res) => {
    const host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
    const targetPort = PORT === 443 ? '' : `:${PORT}`;
    res.writeHead(301, { Location: `https://${host}${targetPort}${req.url}` });
    res.end();
  }).listen(redirectPort, () => {
    console.log(`NGCloud HTTP redirect server listening over HTTP at http://localhost:${redirectPort} (redirects to HTTPS)`);
  });
}

async function startServer() {
  try {
    try {
      await require('../scripts/bootstrapAdmin').bootstrap();
    } catch (bootErr) {
      console.error('❌ Failed to bootstrap admin:', bootErr.message);
    }

    if (typeof minioClient.getMinioConfigSummary === 'function') {
      const cfg = minioClient.getMinioConfigSummary();
      console.log(`MinIO endpoint: ${cfg.endpoint}`);
      console.log(`MinIO port: ${cfg.port}`);
      console.log(`MinIO bucket: ${cfg.bucket}`);
      console.log(`MinIO SSL: ${cfg.useSSL}`);
    }

    if (typeof minioClient.ensureBucketExists === 'function') {
      await minioClient.ensureBucketExists();
    }
  } catch (err) {
    const classify =
      typeof minioClient.classifyMinioError === 'function'
        ? minioClient.classifyMinioError(err)
        : { type: 'unknown', message: err.message || String(err) };

    if (classify.type === 'wrong_port') {
      console.error('❌ MinIO bucket check failed: S3 API port mismatch.');
    } else if (classify.type === 'auth_failure') {
      console.error('❌ MinIO bucket check failed: authentication failed.');
    } else if (classify.type === 'network_failure') {
      console.error('❌ MinIO bucket check failed: network connectivity failure.');
    } else {
      console.error('❌ MinIO bucket check failed:', classify.message);
    }
  }

  if (HTTPS_ENABLED) {
    startHttpsServer();
  } else {
    startHttpServer();
  }
}

startServer();
