import { CryptoService, base64ToBytes, bytesToBase64 } from './CryptoService'

export { base64ToBytes, bytesToBase64 }

export async function generateAndStoreKyberKeys(userId, password) {
  return CryptoService.generateAndStoreKyberKeys(userId, password)
}

export async function getStoredKyberPrivateKey(userId, password) {
  return CryptoService.getStoredKyberPrivateKey(userId, password)
}

export function hasLocalKyberPrivateKey(userId) {
  return CryptoService.hasLocalKyberPrivateKey(userId)
}

export function deleteLocalKyberPrivateKey(userId) {
  CryptoService.deleteLocalKyberPrivateKey(userId)
}

export async function wrapFileKeyWithKyber(fileKey, publicKeyBase64) {
  return CryptoService.wrapFileKeyWithKyber(fileKey, publicKeyBase64)
}

export async function unwrapFileKeyWithKyber(wrappedKeyBase64, userId, password) {
  return CryptoService.unwrapFileKeyWithKyber(wrappedKeyBase64, userId, password)
}
