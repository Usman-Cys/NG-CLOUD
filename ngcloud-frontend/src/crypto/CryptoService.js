import wasmInit, {
  generate_file_key,
  generate_nonce,
  derive_chunk_nonce,
  encrypt_chunk,
  decrypt_chunk,
  kt_qhf_hash,
  kt_qhf_init,
  ascon_128a_encrypt,
  ascon_128a_decrypt,
  argon2id_derive_key,
  mlkem768_keygen,
  mlkem768_encap,
  mlkem768_decap
} from './wasm/crypto_engine.js'

let wasmPromise = null

export async function initialize() {
  if (!wasmPromise) {
    wasmPromise = wasmInit()
  }
  await wasmPromise
}

async function ensureInitialized() {
  await initialize()
}

// Helper: Bytes <-> Base64
export function bytesToBase64(bytes) {
  if (!bytes) return ''
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBytes(base64) {
  if (!base64) return new Uint8Array(0)
  const binary = atob(base64.trim())
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Helper: Wipes typed arrays securely in memory
export function zeroize(array) {
  if (array && (array instanceof Uint8Array || array instanceof Uint16Array || array instanceof Uint32Array || array instanceof Int8Array || array instanceof Int16Array || array instanceof Int32Array)) {
    array.fill(0)
  }
}

// Helper: Text -> Bytes
function textToBytes(text) {
  return new TextEncoder().encode(text)
}

export const CryptoService = {
  initialize,

  generateFileKey() {
    return generate_file_key()
  },

  generateNonce() {
    return generate_nonce()
  },

  deriveChunkNonce(fileNonce, chunkIndex) {
    return derive_chunk_nonce(fileNonce, chunkIndex)
  },

  encryptChunk(chunkBytes, fileKey, chunkNonce) {
    const chunkBytesArr = chunkBytes instanceof Uint8Array ? chunkBytes : new Uint8Array(chunkBytes)
    const fileKeyArr = fileKey instanceof Uint8Array ? fileKey : new Uint8Array(fileKey)
    const chunkNonceArr = chunkNonce instanceof Uint8Array ? chunkNonce : new Uint8Array(chunkNonce)
    const encrypted = encrypt_chunk(chunkBytesArr, fileKeyArr, chunkNonceArr)
    return new Blob([encrypted], { type: 'application/octet-stream' })
  },

  decryptChunk(encryptedChunkBytes, fileKey, chunkNonce) {
    const encChunkBytesArr = encryptedChunkBytes instanceof Uint8Array ? encryptedChunkBytes : new Uint8Array(encryptedChunkBytes)
    const fileKeyArr = fileKey instanceof Uint8Array ? fileKey : new Uint8Array(fileKey)
    const chunkNonceArr = chunkNonce instanceof Uint8Array ? chunkNonce : new Uint8Array(chunkNonce)
    return decrypt_chunk(encChunkBytesArr, fileKeyArr, chunkNonceArr)
  },

  encryptFile(fileBytes, fileKey, nonce) {
    const fileBytesArr = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes)
    const fileKeyArr = fileKey instanceof Uint8Array ? fileKey : new Uint8Array(fileKey)
    const nonceArr = nonce instanceof Uint8Array ? nonce : new Uint8Array(nonce)
    const encrypted = encrypt_chunk(fileBytesArr, fileKeyArr, nonceArr)
    return new Blob([encrypted], { type: 'application/octet-stream' })
  },

  decryptFile(encryptedBytes, fileKey, nonce) {
    const encBytesArr = encryptedBytes instanceof Uint8Array ? encryptedBytes : new Uint8Array(encryptedBytes)
    const fileKeyArr = fileKey instanceof Uint8Array ? fileKey : new Uint8Array(fileKey)
    const nonceArr = nonce instanceof Uint8Array ? nonce : new Uint8Array(nonce)
    return decrypt_chunk(encBytesArr, fileKeyArr, nonceArr)
  },

  generateKTQHFHash(bytes) {
    const bytesArr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    return kt_qhf_hash(bytesArr)
  },

  // Key Generation
  async generateAndStoreKyberKeys(userId, password) {
    await ensureInitialized()
    
    // 1. Generate keypair using Rust ML-KEM-768
    let keypair = mlkem768_keygen()
    const publicKeyBytes = keypair.public_key
    let privateKeyBytes = keypair.private_key

    // 2. Encrypt private key using derived Argon2id key + Ascon-128a
    const salt = window.crypto.getRandomValues(new Uint8Array(16))
    const nonce = window.crypto.getRandomValues(new Uint8Array(16))
    
    // Derive Argon2id key
    let passwordBytes = textToBytes(password)
    let rawKey = argon2id_derive_key(passwordBytes, salt)
    // Immediately zeroize password bytes after Argon2id finishes
    zeroize(passwordBytes)
    passwordBytes = null

    let asconKey = rawKey.slice(0, 16)
    
    const assocData = textToBytes('NGCloud-Kyber-Private-Key-v2')
    const encryptedPrivateKey = ascon_128a_encrypt(asconKey, nonce, privateKeyBytes, assocData)

    const record = {
      version: 2,
      kdf: 'Argon2id',
      cipher: 'Ascon-128a',
      salt: bytesToBase64(salt),
      nonce: bytesToBase64(nonce),
      associatedData: 'NGCloud-Kyber-Private-Key-v2',
      encryptedPrivateKey: bytesToBase64(encryptedPrivateKey)
    }

    localStorage.setItem(`ngcloud_kyber_private_key_encrypted_${userId}`, JSON.stringify(record))

    // Secure Memory Cleanup
    zeroize(rawKey)
    rawKey = null

    zeroize(asconKey)
    asconKey = null

    zeroize(privateKeyBytes)
    privateKeyBytes = null

    if (keypair) {
      keypair.free()
      keypair = null
    }

    return {
      publicKeyBase64: bytesToBase64(publicKeyBytes)
    }
  },

  async getStoredKyberPrivateKey(userId, password) {
    await ensureInitialized()
    const raw = localStorage.getItem(`ngcloud_kyber_private_key_encrypted_${userId}`)
    if (!raw) {
      throw new Error('Kyber private key is missing on this browser.')
    }
    const record = JSON.parse(raw)

    if (record.version === 2 && record.cipher === 'Ascon-128a') {
      const salt = base64ToBytes(record.salt)
      const nonce = base64ToBytes(record.nonce)
      const encryptedPrivateKey = base64ToBytes(record.encryptedPrivateKey)

      let passwordBytes = textToBytes(password)
      let rawKey = argon2id_derive_key(passwordBytes, salt)
      // Immediately zeroize password bytes after Argon2id finishes
      zeroize(passwordBytes)
      passwordBytes = null

      let asconKey = rawKey.slice(0, 16)
      const assocData = textToBytes(record.associatedData || 'NGCloud-Kyber-Private-Key-v2')

      const decrypted = ascon_128a_decrypt(asconKey, nonce, encryptedPrivateKey, assocData)

      // Secure Memory Cleanup
      zeroize(rawKey)
      rawKey = null

      zeroize(asconKey)
      asconKey = null

      return decrypted
    }

    // Version 1 (AES-256-GCM - fallback to Web Crypto API for backward compatibility)
    if (record.version === 1 && record.cipher === 'AES-256-GCM') {
      const salt = base64ToBytes(record.salt)
      const iv = base64ToBytes(record.iv)
      const encryptedPrivateKey = base64ToBytes(record.encryptedPrivateKey)

      // Legacy key derivation: Argon2id in JS
      let passwordBytes = textToBytes(password)
      let rawKey = argon2id_derive_key(passwordBytes, salt)
      // Immediately zeroize password bytes after Argon2id finishes
      zeroize(passwordBytes)
      passwordBytes = null
      
      // Import Web Crypto key
      const aesKey = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      )

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encryptedPrivateKey
      )
      const decryptedBytes = new Uint8Array(decryptedBuffer)

      // Automatic Migration to Version 2 in background
      try {
        console.log('[NGCloud] Migrating Kyber private key from AES-256-GCM to Ascon-128a...')
        // Re-encrypt using Ascon-128a
        const newSalt = window.crypto.getRandomValues(new Uint8Array(16))
        const newNonce = window.crypto.getRandomValues(new Uint8Array(16))
        
        let migrationPasswordBytes = textToBytes(password)
        let newRawKey = argon2id_derive_key(migrationPasswordBytes, newSalt)
        // Immediately zeroize password bytes after Argon2id finishes
        zeroize(migrationPasswordBytes)
        migrationPasswordBytes = null

        let newAsconKey = newRawKey.slice(0, 16)
        const assocData = textToBytes('NGCloud-Kyber-Private-Key-v2')
        const newEncrypted = ascon_128a_encrypt(newAsconKey, newNonce, decryptedBytes, assocData)

        const newRecord = {
          version: 2,
          kdf: 'Argon2id',
          cipher: 'Ascon-128a',
          salt: bytesToBase64(newSalt),
          nonce: bytesToBase64(newNonce),
          associatedData: 'NGCloud-Kyber-Private-Key-v2',
          encryptedPrivateKey: bytesToBase64(newEncrypted)
        }
        localStorage.setItem(`ngcloud_kyber_private_key_encrypted_${userId}`, JSON.stringify(newRecord))
        console.log('[NGCloud] Key migration complete.')

        zeroize(newRawKey)
        newRawKey = null

        zeroize(newAsconKey)
        newAsconKey = null
      } catch (err) {
        console.error('[NGCloud] Key migration failed:', err)
      }

      // Secure Memory Cleanup for legacy components
      zeroize(rawKey)
      rawKey = null

      return decryptedBytes
    }

    throw new Error('Unsupported private key encryption record.')
  },

  hasLocalKyberPrivateKey(userId) {
    if (!userId) return false
    return Boolean(localStorage.getItem(`ngcloud_kyber_private_key_encrypted_${userId}`))
  },

  deleteLocalKyberPrivateKey(userId) {
    if (!userId) return
    localStorage.removeItem(`ngcloud_kyber_private_key_encrypted_${userId}`)
  },

  // Key Encapsulation (Wrap / Unwrap File Key)
  async wrapFileKeyWithKyber(fileKey, publicKeyBase64) {
    await ensureInitialized()
    const publicKey = base64ToBytes(publicKeyBase64)
    let fileKeyBytes = new Uint8Array(fileKey)

    // ML-KEM-768 encapsulation
    let encapRes = mlkem768_encap(publicKey)
    const kemCiphertext = encapRes.ciphertext
    let sharedSecret = encapRes.shared_secret

    // Derive 16-byte Ascon-128a key via SHA-256
    const hashedSecret = await window.crypto.subtle.digest('SHA-256', sharedSecret)
    let asconKey = new Uint8Array(hashedSecret).slice(0, 16)

    const nonce = window.crypto.getRandomValues(new Uint8Array(16))
    const assocData = textToBytes('NGCloud-FileKey-Wrap-v2')

    // Encrypt file key with Ascon-128a
    const encrypted = ascon_128a_encrypt(asconKey, nonce, fileKeyBytes, assocData)

    const packageObject = {
      version: 2,
      kem: 'ML-KEM-768',
      wrapCipher: 'Ascon-128a',
      kemCiphertext: bytesToBase64(kemCiphertext),
      nonce: bytesToBase64(nonce),
      associatedData: 'NGCloud-FileKey-Wrap-v2',
      encryptedFileKey: bytesToBase64(encrypted)
    }

    // Secure Memory Cleanup
    zeroize(sharedSecret)
    sharedSecret = null

    zeroize(asconKey)
    asconKey = null

    // We can safely erase fileKeyBytes here, because the wrapping operation is complete and it is no longer required in this scope.
    zeroize(fileKeyBytes)
    fileKeyBytes = null

    if (encapRes) {
      encapRes.free()
      encapRes = null
    }

    return btoa(JSON.stringify(packageObject))
  },

  async unwrapFileKeyWithKyber(wrappedKeyBase64, userId, password) {
    await ensureInitialized()
    let privateKey = await this.getStoredKyberPrivateKey(userId, password)
    const packageObject = JSON.parse(atob(wrappedKeyBase64))

    const kemCiphertext = base64ToBytes(packageObject.kemCiphertext)
    const encryptedFileKey = base64ToBytes(packageObject.encryptedFileKey)

    // ML-KEM-768 decapsulation
    let sharedSecret = mlkem768_decap(kemCiphertext, privateKey)

    // Securely wipe privateKey immediately after decapsulation completes
    zeroize(privateKey)
    privateKey = null

    // Version 2 (Ascon-128a)
    if (packageObject.version === 2 && packageObject.wrapCipher === 'Ascon-128a') {
      const hashedSecret = await window.crypto.subtle.digest('SHA-256', sharedSecret)
      let asconKey = new Uint8Array(hashedSecret).slice(0, 16)
      const nonce = base64ToBytes(packageObject.nonce)
      const assocData = textToBytes(packageObject.associatedData || 'NGCloud-FileKey-Wrap-v2')

      let decrypted
      try {
        decrypted = ascon_128a_decrypt(asconKey, nonce, encryptedFileKey, assocData)
      } catch (err) {
        // Fallback for files corrupted by early zeroization bug:
        // Try decrypting with the key derived from a zeroed-out shared secret.
        console.warn('[NGCloud] Ascon decryption failed. Trying recovery fallback for zeroed secret bug...')
        const zeroedSecret = new Uint8Array(sharedSecret ? sharedSecret.length : 32)
        const fallbackHashedSecret = await window.crypto.subtle.digest('SHA-256', zeroedSecret)
        const fallbackAsconKey = new Uint8Array(fallbackHashedSecret).slice(0, 16)
        try {
          decrypted = ascon_128a_decrypt(fallbackAsconKey, nonce, encryptedFileKey, assocData)
          console.log('[NGCloud] Recovery fallback succeeded! File key recovered.')
        } catch (fallbackErr) {
          throw err
        }
      }

      // Securely wipe sharedSecret immediately after use
      zeroize(sharedSecret)
      sharedSecret = null

      // Securely wipe asconKey immediately after decryption completes
      zeroize(asconKey)
      asconKey = null

      return { fileKey: decrypted, migratedWrappedKey: null }
    }

    // Version 1 (AES-256-GCM - fallback to Web Crypto API for backward compatibility)
    if (packageObject.version === 1 && packageObject.wrapCipher === 'AES-256-GCM') {
      // Legacy SHA-256 and AES-GCM key import
      const hashedSecret = await window.crypto.subtle.digest('SHA-256', sharedSecret)
      const aesKey = await window.crypto.subtle.importKey(
        'raw',
        hashedSecret,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      )
      const iv = base64ToBytes(packageObject.iv)

      const fileKeyBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encryptedFileKey
      )
      const fileKey = new Uint8Array(fileKeyBuffer)

      // Automatic re-wrap with Version 2 (Ascon-128a)
      let migratedWrappedKey = null
      try {
        console.log('[NGCloud] Migrating file key wrap from AES-256-GCM to Ascon-128a...')
        const newHashedSecret = await window.crypto.subtle.digest('SHA-256', sharedSecret)
        let asconKey = new Uint8Array(newHashedSecret).slice(0, 16)
        const newNonce = window.crypto.getRandomValues(new Uint8Array(16))
        const assocData = textToBytes('NGCloud-FileKey-Wrap-v2')
        const reEncrypted = ascon_128a_encrypt(asconKey, newNonce, fileKey, assocData)

        const migratedPackage = {
          version: 2,
          kem: 'ML-KEM-768',
          wrapCipher: 'Ascon-128a',
          kemCiphertext: bytesToBase64(kemCiphertext),
          nonce: bytesToBase64(newNonce),
          associatedData: 'NGCloud-FileKey-Wrap-v2',
          encryptedFileKey: bytesToBase64(reEncrypted)
        }
        migratedWrappedKey = btoa(JSON.stringify(migratedPackage))
        console.log('[NGCloud] File key wrap migrated successfully.')

        zeroize(asconKey)
        asconKey = null
      } catch (migrationErr) {
        console.warn('[NGCloud] File key auto-migration to Ascon-128a failed:', migrationErr)
      }

      // Securely wipe sharedSecret immediately after use
      zeroize(sharedSecret)
      sharedSecret = null

      return { fileKey, migratedWrappedKey }
    }

    throw new Error(`Unsupported wrapped file key format (version=${packageObject.version}, cipher=${packageObject.wrapCipher}).`)
  }
}

