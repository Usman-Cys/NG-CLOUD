# Permission Enforcement Test Matrix

## Backend Enforcement Points

| # | Endpoint / Controller | Action | Permissions Allowed | Blocked Permissions | Enforcement |
|---|----------------------|--------|---------------------|--------------------|-------------|
| 1 | `generateDownloadUrl` | Download/View | `owner`, `read`, `write`, `review`, `share`, `read_write`, `read_review`, `full_access` | none | `canRead()` check at fileController.js line 421 |
| 2 | `getFile` | View file details | `owner`, `read`, `write`, `review`, `share`, `read_write`, `read_review`, `full_access` | none | `canRead()` check at fileController.js line 575 |
| 3 | `generateUploadUrl` (with `fileId`) | Upload new version | `owner`, `write`, `read_write`, `full_access` | `read`, `review`, `share`, `read_review` | `checkLockAndWriteAccess()` → `canWrite()` at fileController.js line 89 |
| 4 | `saveMetadata` | Save file metadata | `owner`, `write`, `read_write`, `full_access` | `read`, `review`, `share`, `read_review` | `checkLockAndWriteAccess()` → `canWrite()` at fileController.js line 703 |
| 5 | `saveFileChunks` | Save chunk metadata | `owner`, `write`, `read_write`, `full_access` | `read`, `review`, `share`, `read_review` | `checkLockAndWriteAccess()` → `canWrite()` at fileController.js line 828 |
| 6 | `lockFile` | Acquire lock | `owner`, `write`, `read_write`, `full_access` | `read`, `review`, `share`, `read_review` | `checkWriteAccess()` → `canWrite()` at fileController.js line 899 |
| 7 | `createShare` | Share/re-share | `owner`, `share`, `full_access` | `read`, `write`, `review`, `read_write`, `read_review` | `canShare()` at shareController.js line 187 |
| 8 | `createShareBatch` | Batch share | `owner`, `share`, `full_access` | `read`, `write`, `review`, `read_write`, `read_review` | `canShare()` at shareController.js line 320 |
| 9 | `deleteFile` | Delete file | `owner` only | all others | Direct ownership check at fileController.js line 630 |

## Frontend UI Enforcement Points

| # | Component | Action | Shown If | Hidden If |
|---|-----------|--------|----------|-----------|
| 1 | FileDetails.jsx | Download button | Always (all permissions) | never |
| 2 | FileDetails.jsx | Upload New Version button | `canWrite(permission)` | `read`, `review`, `share`, `read_review` |
| 3 | FileDetails.jsx | Share button | `canShare(permission)` | `read`, `write`, `review`, `read_write`, `read_review` |
| 4 | FileDetails.jsx | Review button | `canReview(permission)` | `read`, `write`, `share`, `read_write` |
| 5 | FileDetails.jsx | Delete button | `owner` only | all non-owner permissions |

## Expected Behavior Matrix

| Permission | Download | Upload New Version | Lock Acquire | Share/Re-share | Review Actions |
|------------|----------|-------------------|-------------|----------------|---------------|
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `read` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 |
| `write` | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `review` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ✅ |
| `share` | ✅ | ❌ 403 | ❌ 403 | ✅ | ❌ 403 |
| `read_write` | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `read_review` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 | ✅ |
| `full_access` | ✅ | ✅ | ✅ | ✅ | ✅ |

## Test Procedure

For each of the 7 permission types (non-owner):

1. Owner shares a file with User B using the specific permission
2. User B attempts each action
3. Record PASS if action matches Expected Behavior Matrix, FAIL otherwise

### Test Setup Requirements
- Two registered users with Kyber key pairs
- Owner has at least one uploaded file
- Share record exists with the permission under test

### How to Run Tests

```bash
# Backend tests (ensure server is running in ngcloud-backend)
cd ngcloud-backend/ngcloud-backend
npm test
```

## Files Modified

| File | Changes |
|------|---------|
| `ngcloud-backend/src/utils/permissions.js` | **NEW** – `canRead()`, `canWrite()`, `canReview()`, `canShare()` helpers |
| `ngcloud-backend/src/controllers/fileController.js` | Added `checkReadAccess()`, `checkShareAccess()` helpers; refactored `checkWriteAccess()` to use `canWrite()`; added read permission checks to `generateDownloadUrl` and `getFile`; updated `lockFile` permission check |
| `ngcloud-backend/src/controllers/shareController.js` | Replaced hardcoded `['share', 'full_access']` checks with `canShare()` |
| `ngcloud-frontend/src/utils/permissions.js` | **NEW** – Frontend `canRead/Write/Review/Share` helpers + `getPermissionLabel()` |
| `ngcloud-frontend/src/pages/client/FileDetails.jsx` | Replaced hardcoded permission checks with centralized helpers; added Review button; added Review Access indicator |