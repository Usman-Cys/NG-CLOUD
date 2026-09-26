# NGCloud Lovable Frontend Connectivity Notes

This frontend was cleaned to work with the NGCloud Express backend.

## Main fixes included

- `.env.example` points to `http://localhost:5000`.
- Demo login is now controlled by `VITE_ENABLE_DEMO_LOGIN=true`.
- Real backend login/register is the default.
- Added frontend validation helpers.
- Upload now sends filename + file size to backend.
- Upload calls backend `/api/files/upload-url`, then raw PUT to MinIO presigned URL.
- Upload then calls `/api/files/metadata` to mark file uploaded.
- File list supports camelCase and snake_case backend fields.
- Admin pages can call real admin endpoints; mock fallback remains for demo mode.

## Setup

1. Copy `.env.example` to `.env`.
2. For real backend testing:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_ENABLE_DEMO_LOGIN=false
```

3. Run:

```bash
npm install
npm run dev
```

4. Open:

```text
http://localhost:5173
```

## Demo login mode

If backend is not running and you only want to view UI, set:

```env
VITE_ENABLE_DEMO_LOGIN=true
```

Then use:

```text
user / user123
admin / admin123
```

Restart Vite after changing `.env`.

## Real connectivity flow

1. Start backend.
2. Accept backend cert at `http://localhost:5000/health`.
3. Start frontend.
4. Register a user from frontend.
5. Login.
6. Upload a test file.
7. Check PostgreSQL `files` table.
8. Check MinIO bucket.
9. Download and delete from frontend.
