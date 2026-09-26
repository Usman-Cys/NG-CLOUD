import { CryptoService, base64ToBytes, bytesToBase64 } from './CryptoService'

export { base64ToBytes, bytesToBase64 }

export function generateFileKey() {
  return CryptoService.generateFileKey()
}

export function generateNonce() {
  return CryptoService.generateNonce()
}

export function deriveChunkNonce(fileNonce, chunkIndex) {
  return CryptoService.deriveChunkNonce(fileNonce, chunkIndex)
}

export async function encryptChunk(chunkBytes, fileKey, chunkNonce) {
  return CryptoService.encryptChunk(chunkBytes, fileKey, chunkNonce)
}

export async function decryptChunk(encryptedChunkBytes, fileKey, chunkNonce) {
  return CryptoService.decryptChunk(encryptedChunkBytes, fileKey, chunkNonce)
}

export async function encryptFile(file) {
  const fileKey = generateFileKey()
  const nonce = generateNonce()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const encryptedBlob = CryptoService.encryptFile(bytes, fileKey, nonce)
  
  const totalChunks = Math.ceil(file.size / (1024 * 1024))

  return {
    encryptedBlob,
    fileKey,
    nonce,
    originalName: file.name,
    encryptedName: `${file.name}.enc`,
    algorithm: 'FS-MLWE-SC-256',
    chunkSize: 1024 * 1024,
    totalChunks,
  }
}

export async function decryptFile(encryptedBlob, fileKey, nonce, originalName = 'decrypted-file') {
  const bytes = new Uint8Array(await encryptedBlob.arrayBuffer())
  const decryptedBytes = CryptoService.decryptFile(bytes, fileKey, nonce)
  return new File([decryptedBytes], originalName)
}