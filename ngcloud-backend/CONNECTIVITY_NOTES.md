# NGCloud Backend Connectivity Notes

This backend was cleaned for frontend connectivity with the Lovable NGCloud frontend.

## Main fixes included

- Full PostgreSQL schema in `scripts/init-db.js` using UUID IDs.
- Added `role` support for users and JWT payloads.
- Added `GET /api/auth/me`.
- Added admin middleware and admin API routes:
  - `GET /api/admin/stats`
  - `GET /api/admin/users`
  - `GET /api/admin/files`
  - `GET /api/admin/storage`
  - `GET /api/admin/security`
  - `GET /api/admin/logs`
- Added frontend-compatible file responses.
- Added `GET /api/files/:fileId`.
- Added `GET /api/files/shared` placeholder.
- Fixed download response to return both `url` and `downloadUrl`.
- Added stricter CORS using `CORS_ORIGINS`.
- Added safer validation for username, password, filename, UUID file IDs.
- Presigned MinIO upload/download flow remains direct-to-MinIO.

## Setup

1. Copy `.env.template` to `.env` and fill real values.
2. Run:

```bash
npm install
npm run init-db
npm run dev
```

3. Open browser once and accept the local self-signed certificate:

```text
https://localhost:5000/health
```

## Create admin user

Register admin normally, then in PostgreSQL:

```sql
UPDATE users SET role = 'admin' WHERE username = 'admin';
SELECT id, username, role FROM users;
```

## Important frontend URL

Frontend `.env` must contain:

```env
VITE_API_BASE_URL=https://localhost:5000
```

## MinIO browser CORS

If browser PUT/GET to MinIO presigned URL fails with CORS, configure MinIO bucket CORS for:

```text
http://localhost:5173
http://localhost:3000
```
