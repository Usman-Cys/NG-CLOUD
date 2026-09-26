# KT-QHF Integrity Verification Failure — Root-Cause Report

---

## 1. Upload Hashing Pipeline

**File:** `a:\ngcloud full app\ngcloud-frontend\ngcloud\src\pages\client\Upload.jsx`

| Step | Line(s) | Description |
|------|---------|-------------|
| Read file as bytes | 62–63 | `file.arrayBuffer()` → `new Uint8Array(arrayBuffer)` |
| Split into plaintext chunks | 67–71 | `fileBytes.slice(startOffset, endOffset)` → `plainChunks[]` |
| **Compute KT-QHF hash on plaintext** | **72** | `plainHashes.push(ktQhfHashBytes(chunkBytes))` ← **PLAINTEXT** |
| Encrypt chunk (plaintext→ciphertext) | 166 | `encryptChunk(plainChunks[i], fileKey, chunkNonce)` |
| Save chunk metadata to DB | 180–185 | `chunkHash: plainHash` ← **PLAINTEXT hash** stored in DB |
| Save chunks via API | 193 | `filesApi.saveFileChunks(fileId, uploadedChunks)` |

**Conclusion:** Upload stores the **plaintext KT-QHF hash** in `file_chunks.chunk_hash`.

---

## 2. Download Verification Pipeline

**File:** `a:\ngcloud full app\ngcloud-frontend\ngcloud\src\pages\client\Files.jsx`

| Step | Line(s) | Description |
|------|---------|-------------|
| Fetch encrypted chunk from MinIO | 145 | `chunkResponse.blob()` → `chunkEncryptedBlob` (**Blob**) |
| Derive chunk nonce | 147 | `deriveChunkNonce(nonce, chunk.chunkIndex)` |
| Decrypt chunk | 148 | `decryptChunk(chunkEncryptedBlob, fileKey, chunkNonce)` |
| **Compute hash on decrypted output** | **150** | `ktQhfHashBytes(decryptedBytes)` ← **PLAINTEXT** (conceptually correct) |
| Compare with stored hash | 152 | `computedHash !== chunk.chunkHash` |

**Conclusion:** Download correctly attempts to hash the **plaintext** after decryption — the concept is right.

---

## 3. Comparison: Upload vs. Download Hashing

| Property | Upload | Download |
|----------|--------|----------|
| Data hashed | plaintext chunk ✅ | plaintext chunk ✅ (conceptually) |
| Hash stored in DB | plaintext hash ✅ | — |
| Hash compared against | — | plaintext hash from DB ✅ (conceptually) |

**Both sides conceptually hash plaintext.** The algorithm is correct in principle.

---

## 4. ROOT CAUSE IDENTIFIED

### The Bug: Blob → Uint8Array Conversion Failure in `decryptChunk`

**File:** `a:\ngcloud full app\ngcloud-frontend\ngcloud\src\pages\client\Files.jsx`
**Line:** 148
**Function:** `onDownload`

### Call chain:

```
Files.jsx:145  chunkEncryptedBlob = await chunkResponse.blob()     → Blob object
Files.jsx:148  decryptedBytes = await decryptChunk(chunkEncryptedBlob, fileKey, chunkNonce)
                                                    ↑
                                        Blob passed, NOT Uint8Array
```

### Inside `decryptChunk` (fsmlweCipher.js:402–406):

```javascript
export async function decryptChunk(encryptedChunkBytes, fileKey, chunkNonce) {
  const input = encryptedChunkBytes instanceof Uint8Array
    ? encryptedChunkBytes
    : new Uint8Array(encryptedChunkBytes)   // ← BUG: Blob treated as array-like
```

When `encryptedChunkBytes` is a **Blob**:
- `Blob instanceof Uint8Array` → `false`
- Falls to `new Uint8Array(encryptedChunkBytes)`
- Blob has a `.length` property (its byte size), so `new Uint8Array(blob)` creates a **zero-filled** array of the correct length, but **all bytes are 0x00** — the actual encrypted data is **lost**.
- The XOR decryption then XORs zeros with the keystream mask, producing **garbage** plaintext
- `ktQhfHashBytes(garbage)` produces a hash that does NOT match the stored plaintext hash
- → **"Integrity check failed: chunk 0 hash mismatch"**

### Why it works during upload:

In `encryptChunk` (fsmlweCipher.js:377–381), the caller passes `plainChunks[i]` which is already a **Uint8Array**, so the branch `chunkBytes instanceof Uint8Array ? chunkBytes : ...` correctly uses the Uint8Array directly. No Blob conversion issue.

### Why it fails during download:

`chunkResponse.blob()` returns a **Blob**, not a Uint8Array. The fallback `new Uint8Array(blob)` does not read the blob's bytes — it only uses the `.length` property to determine size and fills with zeros.

### Contrast with `encryptFile`/`decryptFile` which work correctly:

- `encryptFile` (line 303): `new Uint8Array(await file.arrayBuffer())` — properly reads bytes
- `decryptFile` (line 348): `new Uint8Array(await encryptedBlob.arrayBuffer())` — properly reads bytes

These use **`await blob.arrayBuffer()`** before creating the Uint8Array. `decryptChunk` does NOT.

---

## 5. Verification: Encryption Round-Trip

The encryption itself (`encryptChunk`/`decryptChunk`) is correct. The round-trip `decryptChunk(encryptChunk(X))` would return the original bytes **if the input types were handled correctly**. The bug is exclusively in the type conversion of the input parameter.

---

## 6. Delta-Sync Not Affected

The delta-sync logic (Upload.jsx:140–147) compares `oldChunk.chunkHash === plainHash` where both are plaintext hashes. This is correct and not involved in the bug.

---

## 7. KT-QHF Determinism

`ktQhfHashBytes` is deterministic — `ktQhfHashBytes(X) === ktQhfHashBytes(X)` always. This is not involved in the bug.

---

## 8. Database Values

The `file_chunks.chunk_hash` column stores the **correct plaintext hash** as computed during upload. The values are valid 64-char hex strings (SHA-256 based). This is not a data issue.

---

## ROOT CAUSE SUMMARY

| Item | Value |
|------|-------|
| **Root Cause** | Blob passed to `decryptChunk` without conversion to Uint8Array |
| **File** | `a:\ngcloud full app\ngcloud-frontend\ngcloud\src\pages\client\Files.jsx` |
| **Function** | `onDownload` |
| **Line** | 148 |
| **Explanation** | `chunkResponse.blob()` returns a Blob. `decryptChunk(blob, ...)` creates `new Uint8Array(blob)` which produces a zero-filled array instead of reading the actual encrypted bytes. This corrupts the decryption output, causing the recomputed KT-QHF hash to mismatch the stored hash. |
| **Fix scope** | Single line change: convert blob to Uint8Array before passing to `decryptChunk` |

---

## FIX

**File:** `a:\ngcloud full app\ngcloud-frontend\ngcloud\src\pages\client\Files.jsx`
**Current line 145–148:**
```javascript
const chunkEncryptedBlob = await chunkResponse.blob()
const chunkNonce = deriveChunkNonce(nonce, chunk.chunkIndex)
const decryptedBytes = await decryptChunk(chunkEncryptedBlob, fileKey, chunkNonce)
```

**Replace with:**
```javascript
const chunkEncryptedBlob = await chunkResponse.blob()
const chunkEncryptedBytes = new Uint8Array(await chunkEncryptedBlob.arrayBuffer())
const chunkNonce = deriveChunkNonce(nonce, chunk.chunkIndex)
const decryptedBytes = await decryptChunk(chunkEncryptedBytes, fileKey, chunkNonce)
```

This is the **smallest possible fix** — one additional line that properly reads the Blob bytes into a Uint8Array before passing to `decryptChunk`, consistent with how `encryptFile`/`decryptFile` handle Blob conversion.

---

## VERIFICATION PLAN

After applying the fix, test:
1. **Small file** (1 chunk) — upload + download
2. **Medium file** (multiple chunks) — upload + download
3. **Single chunk file** — verify integrity
4. **Multi-chunk file** — verify all chunks pass integrity
5. **Delta sync update** — update existing file, verify download

All should pass KT-QHF integrity verification.