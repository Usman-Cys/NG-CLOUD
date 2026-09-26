/**
 * KT-QHF Hash Function — Node.js backend port
 *
 * Faithful port of the frontend KT-QHF Grover-diffusion classical
 * simulation hash. Uses Node built-in crypto for SHA-256 instead of
 * @noble/hashes.
 *
 * Exports:
 *   ktqhf(input)        — accepts string or Buffer, returns 64-char hex digest
 *   ktqhfBytes(input)    — accepts string or Buffer, returns Buffer (32 bytes)
 */

'use strict';

const crypto = require('crypto');

// ════════════════════════════════════════════════════════════
// §1  KNIGHT GRAPH  (8×8, toroidal boundary conditions)
// ════════════════════════════════════════════════════════════

const KNIGHT_MOVES = [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]];
const N = 8;

function posIdx(x, y) { return y * N + x; }

// Pre-compute neighbour list for all 64 squares (toroidal: mod N)
const GRAPH = new Array(64);
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const idx = posIdx(x, y);
    GRAPH[idx] = KNIGHT_MOVES.map(([dx, dy]) =>
      posIdx(((x + dx) % N + N) % N, ((y + dy) % N + N) % N)
    );
  }
}

// On a toroidal 8×8 board every square has exactly 8 knight-move neighbours
const DEGREE = 8;

// ════════════════════════════════════════════════════════════
// §2  HELPERS
// ════════════════════════════════════════════════════════════

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function concatBuffers(...buffers) {
  return Buffer.concat(buffers);
}

function bytesToHex(buf) {
  return Buffer.from(buf).toString('hex');
}

// ════════════════════════════════════════════════════════════
// §3  KT-QHF CORE HASH  (classical simulation)
// ════════════════════════════════════════════════════════════

/**
 * Core KT-QHF algorithm — returns a 32-byte Buffer (256-bit digest).
 * @param {string|Buffer|Uint8Array} message
 * @returns {Buffer} 32-byte hash digest
 */
function ktQhfHashCore(message) {
  if (typeof message === 'string') {
    message = Buffer.from(message, 'utf-8');
  } else if (!(message instanceof Buffer)) {
    message = Buffer.from(message);
  }

  // ── step 1: seed ────────────────────────────────────────────
  const seed  = sha256(message);                                           // 32 B
  const seed2 = sha256(concatBuffers(message, Buffer.from([0x01])));       // 32 B
  const raw   = concatBuffers(seed, seed2);                                // 64 B

  // ── step 2: initial distribution ───────────────────────────
  const state = new Float64Array(64);
  for (let i = 0; i < 64; i++) state[i] = raw[i] / 255.0;
  let total = 0;
  for (let i = 0; i < 64; i++) total += state[i];
  for (let i = 0; i < 64; i++) state[i] /= total;

  // ── step 3: message bits ────────────────────────────────────
  const bits = [];
  for (const byte of message) {
    for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
  }
  if (bits.length === 0) bits.push(0);

  // ── step 4: 128 Grover-diffusion steps ─────────────────────
  const newState = new Float64Array(64);

  for (let step = 0; step < 128; step++) {
    const bit = bits[step % bits.length];
    newState.fill(0);

    for (let idx = 0; idx < 64; idx++) {
      const nbrs  = GRAPH[idx];
      const share = state[idx] / DEGREE;
      for (const nbrIdx of nbrs) newState[nbrIdx] += share;
      // Grover phase kick: (2/k − 1) with message-bit polarity
      const phase = (bit === 0) ? 1.0 : -1.0;
      newState[idx] += phase * (2.0 / DEGREE - 1.0) * state[idx];
    }

    total = 0;
    for (let i = 0; i < 64; i++) total += newState[i];
    if (total <= 0) total = 1.0;
    for (let i = 0; i < 64; i++) state[i] = newState[i] / total;

    // Re-inject seed entropy every 16 steps
    if (step % 16 === 15) {
      const slot  = Math.floor(step / 16) % 32;
      const ibyte = seed[slot];
      const ipos  = ibyte % 64;
      state[ipos] *= 1.0 + 0.05 * bit + 0.02 * (ibyte / 255.0);
      total = 0;
      for (let i = 0; i < 64; i++) total += state[i];
      if (total <= 0) total = 1.0;
      for (let i = 0; i < 64; i++) state[i] /= total;
    }
  }

  // ── step 5: finalisation (post-processing) ──────────────────
  // Serialise the 64 float64 values into a 512-byte buffer (Big Endian)
  const stateBuf = Buffer.alloc(64 * 8);
  for (let i = 0; i < 64; i++) {
    stateBuf.writeDoubleBE(state[i], i * 8);
  }

  const walkDigest = sha256(stateBuf);
  const msgDigest  = sha256(message);

  // XOR fold
  const digest = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    digest[i] = walkDigest[i] ^ msgDigest[i];
  }

  return digest; // 32 bytes = 256-bit hash
}

// ════════════════════════════════════════════════════════════
// §4  PUBLIC EXPORTS
// ════════════════════════════════════════════════════════════

/**
 * Hash input and return 64-character hex string.
 * @param {string|Buffer|Uint8Array} input
 * @returns {string} 64-char hex digest
 */
function ktqhf(input) {
  return bytesToHex(ktQhfHashCore(input));
}

/**
 * Hash input and return raw 32-byte Buffer.
 * @param {string|Buffer|Uint8Array} input
 * @returns {Buffer} 32-byte digest
 */
function ktqhfBytes(input) {
  return ktQhfHashCore(input);
}

module.exports = { ktqhf, ktqhfBytes };
