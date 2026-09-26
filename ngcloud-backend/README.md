# NGCloud Backend (Zero-Knowledge)

This backend is zero-knowledge: it never receives, processes, or stores user file contents. The client uploads and downloads encrypted data directly to MinIO using pre-signed URLs.

Quick start

1. Copy `.env.template` to `.env` and fill values.
2. Install deps:

```bash
npm install
```

3. Start server:

```bash
npm run start
```

Endpoints

Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

Files (all require `Authorization: Bearer <token>`)

- `POST /api/files/upload-url`
- `POST /api/files/download-url`
- `GET /api/files`
- `DELETE /api/files/:fileId`
- `POST /api/files/metadata`
- `POST /api/files/:fileId/chunks`

Thunder Client example requests

1) Generate upload URL

```
POST https://localhost:5000/api/files/upload-url
Authorization: Bearer <token>
Content-Type: application/json

{
	"filename": "photo.enc"
}
```

Response

```
{
	"fileId": 12,
	"objectName": "1/uuid-photo.enc",
	"uploadUrl": "https://minio..."
}
```

2) Upload encrypted content directly to MinIO

```
PUT <uploadUrl>
Content-Type: application/octet-stream

<encrypted bytes>
```

3) Save metadata

```
POST https://localhost:5000/api/files/metadata
Authorization: Bearer <token>
Content-Type: application/json

{
	"fileId": 12,
	"filename": "photo.enc",
	"totalChunks": 1,
	"minioPath": "1/uuid-photo.enc",
	"chunkMap": {"0": "sha256..."}
}
```

4) Save chunk records

```
POST https://localhost:5000/api/files/12/chunks
Authorization: Bearer <token>
Content-Type: application/json

{
	"chunks": [
		{
			"chunkIndex": 0,
			"minioPath": "1/uuid-photo.enc",
			"chunkHash": "sha256..."
		}
	]
}
```

5) Generate download URL

```
POST https://localhost:5000/api/files/download-url
Authorization: Bearer <token>
Content-Type: application/json

{
	"fileId": 12
}
```

Response

```
{
	"url": "https://minio..."
}
```

6) List files

```
GET https://localhost:5000/api/files
Authorization: Bearer <token>
```

7) Delete file

```
DELETE https://localhost:5000/api/files/12
Authorization: Bearer <token>
```

Security & zero-knowledge guarantees

- The server never handles file payloads; the client uploads/downloads directly to MinIO.
- Only encrypted files/chunks should be uploaded to MinIO.
- Encryption keys must never be stored in plaintext on the backend.
- JWT protects all file endpoints; the backend derives `owner_id` from the verified token.
- Download URLs are generated only after ownership checks and by `fileId`.
