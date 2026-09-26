import { CryptoService, initialize } from './CryptoService'
import { kt_qhf_init } from './wasm/crypto_engine.js'

export function ktQhfHash(message) {
  const bytes = CryptoService.generateKTQHFHash(message)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function ktQhfHashBytes(bytes) {
  return ktQhfHash(bytes)
}

export function ktQhfHashText(text) {
  const bytes = new TextEncoder().encode(text)
  return ktQhfHashBytes(bytes)
}

export async function ktQhfHashFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return ktQhfHashBytes(bytes)
}

// ─────────────────────────────────────────────────────────────────
// Streaming API — avoids loading the entire file into WASM memory.
// Produces IDENTICAL results to ktQhfHashBytes(fullFileBytes).
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new streaming KT-QHF hasher.
 * WASM must be initialized before calling this (it is always initialized
 * by the time Upload.jsx calls this, because CryptoService.initialize() is
 * called during login).
 * @returns {KtQhfHandle} opaque WASM handle
 */
export function ktQhfInit() {
  return kt_qhf_init()
}

/**
 * Feed a plaintext chunk into the running hash state.
 * @param {import('./wasm/crypto_engine.js').KtQhfHandle} handle
 * @param {Uint8Array} chunk
 */
export function ktQhfUpdate(handle, chunk) {
  handle.update(chunk)
}

/**
 * Finalize and return the hex-encoded KT-QHF digest.
 * The handle is consumed and must not be used after this call.
 * Result is identical to ktQhfHashBytes(full_message).
 * @param {import('./wasm/crypto_engine.js').KtQhfHandle} handle
 * @returns {string} hex-encoded 32-byte digest
 */
export function ktQhfFinalize(handle) {
  const bytes = handle.finalize()
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
