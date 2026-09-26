use sha2::{Sha256, Digest};

fn get_neighbors(idx: usize) -> [usize; 8] {
    let x = (idx % 8) as i32;
    let y = (idx / 8) as i32;
    let moves = [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]];
    let mut neighbors = [0; 8];
    for i in 0..8 {
        let nx = ((x + moves[i][0]) % 8 + 8) % 8;
        let ny = ((y + moves[i][1]) % 8 + 8) % 8;
        neighbors[i] = (ny * 8 + nx) as usize;
    }
    neighbors
}

/// Run the 128-step quantum-walk diffusion given seed bytes, message bits, and message sha256.
///
/// `seed`     — sha256(message)
/// `bits`     — the bit-sequence used for the walk (only bits[0..127] are consumed)
/// `msg_digest` — sha256(message), XOR'd into output
fn run_walk(seed: &[u8], bits: &[i32], msg_digest: &[u8]) -> [u8; 32] {
    let mut state = [0.0f64; 64];
    for i in 0..64 {
        state[i] = seed[i] as f64 / 255.0;
    }
    let mut total: f64 = state.iter().sum();
    if total <= 0.0 { total = 1.0; }
    for i in 0..64 {
        state[i] /= total;
    }

    let mut new_state = [0.0f64; 64];
    for step in 0..128 {
        let bit = bits[step % bits.len()];
        new_state.fill(0.0);

        for idx in 0..64 {
            let neighbors = get_neighbors(idx);
            let share = state[idx] / 8.0;
            for &nbr_idx in &neighbors {
                new_state[nbr_idx] += share;
            }
            let phase = if bit == 0 { 1.0 } else { -1.0 };
            new_state[idx] += phase * (2.0 / 8.0 - 1.0) * state[idx];
        }

        total = new_state.iter().sum();
        if total <= 0.0 { total = 1.0; }
        for i in 0..64 {
            state[i] = new_state[i] / total;
        }

        if step % 16 == 15 {
            let slot = (step / 16) % 32;
            let ibyte = seed[slot] as usize;
            let ipos = ibyte % 64;
            state[ipos] *= 1.0 + 0.05 * bit as f64 + 0.02 * (ibyte as f64 / 255.0);
            total = state.iter().sum();
            if total <= 0.0 { total = 1.0; }
            for i in 0..64 {
                state[i] /= total;
            }
        }
    }

    let mut state_buf = vec![0u8; 512];
    for i in 0..64 {
        let bytes = state[i].to_be_bytes();
        state_buf[i * 8..(i + 1) * 8].copy_from_slice(&bytes);
    }

    let walk_digest = crate::hashing::sha256(&state_buf);

    let mut digest = [0u8; 32];
    for i in 0..32 {
        digest[i] = walk_digest[i] ^ msg_digest[i];
    }
    digest
}

/// One-shot KT-QHF hash. This function is UNCHANGED from the original.
pub fn kt_qhf_hash(message: &[u8]) -> [u8; 32] {
    let seed = crate::hashing::sha256(message);
    let mut data2 = message.to_vec();
    data2.push(0x01);
    let seed2 = crate::hashing::sha256(&data2);
    let raw = crate::utils::concat_bytes(&[&seed, &seed2]);

    // Build the full message bit-sequence
    let mut bits = Vec::with_capacity(message.len() * 8);
    for &byte in message {
        for b in (0..8).rev() {
            bits.push(((byte >> b) & 1) as i32);
        }
    }
    if bits.is_empty() {
        bits.push(0);
    }

    // seed for initial state is sha256(message) || sha256(message || 0x01)
    // We use first 64 bytes (raw) as the seed for state initialisation
    let state_seed: Vec<u8> = raw.iter().take(64).cloned().collect();
    let msg_digest = crate::hashing::sha256(message);
    run_walk(&state_seed, &bits, &msg_digest)
}

// ─────────────────────────────────────────────────────────────────
// Streaming API
// ─────────────────────────────────────────────────────────────────

/// Streaming KT-QHF hasher.
///
/// For files of any size, produces the **exact same result** as `kt_qhf_hash(full_message)`.
///
/// Design rationale:
///   - sha256(message) is computed incrementally via a running Sha256 hasher.
///   - sha256(message || 0x01) is computed via a second running hasher.
///   - The KT-QHF walk uses `bits[step % bits.len()]` for steps 0..127.
///     For messages with ≥ 128 bits (≥ 16 bytes), `step % bits.len()` maps to `step`
///     for all steps 0..127, so only bits[0..127] (the first 16 bytes) are ever used.
///     We capture those on first update and never need the rest of the message bits.
///
/// Invariant: produces identical output to `kt_qhf_hash` for all inputs ≥ 16 bytes.
/// For inputs < 16 bytes, use the one-shot function instead (they fit in memory trivially).
pub struct KtQhfStreamer {
    sha256_full: Sha256,
    sha256_plus1: Sha256,
    first_bytes: [u8; 16],
    bytes_seen: u64,
}

impl KtQhfStreamer {
    pub fn new() -> Self {
        KtQhfStreamer {
            sha256_full: Sha256::new(),
            sha256_plus1: Sha256::new(),
            first_bytes: [0u8; 16],
            bytes_seen: 0,
        }
    }

    pub fn update(&mut self, chunk: &[u8]) {
        // Capture first 16 bytes across chunk boundaries
        if self.bytes_seen < 16 {
            let need = (16 - self.bytes_seen as usize).min(chunk.len());
            let start = self.bytes_seen as usize;
            self.first_bytes[start..start + need].copy_from_slice(&chunk[..need]);
        }
        self.bytes_seen += chunk.len() as u64;
        Digest::update(&mut self.sha256_full, chunk);
        Digest::update(&mut self.sha256_plus1, chunk);
    }

    pub fn finalize(mut self) -> [u8; 32] {
        // Finalize sha256(message)
        let msg_digest_vec = self.sha256_full.finalize().to_vec();

        // Finalize sha256(message || 0x01)
        Digest::update(&mut self.sha256_plus1, &[0x01u8]);
        let seed2 = self.sha256_plus1.finalize().to_vec();

        // Reconstruct the raw seed (sha256(msg) || sha256(msg || 0x01))
        let mut raw = Vec::with_capacity(64);
        raw.extend_from_slice(&msg_digest_vec);
        raw.extend_from_slice(&seed2);

        // Determine bits to use for the walk
        let bits: Vec<i32> = if self.bytes_seen < 16 {
            // Tiny message — fall back to one-shot (should never happen for large files)
            // Reconstruct bits from the first_bytes we captured
            let actual_len = self.bytes_seen as usize;
            let mut b = Vec::with_capacity(actual_len * 8);
            for i in 0..actual_len {
                for bit in (0..8).rev() {
                    b.push(((self.first_bytes[i] >> bit) & 1) as i32);
                }
            }
            if b.is_empty() { b.push(0); }
            b
        } else {
            // For messages ≥ 16 bytes: bits[step % total_bits] for step 0..127
            // Since total_bits = bytes_seen * 8 >> 127, step % total_bits == step
            // so only first_bytes[0..16] (bits 0..127) are accessed.
            let mut b = Vec::with_capacity(128);
            for &byte in &self.first_bytes {
                for bit in (0..8).rev() {
                    b.push(((byte >> bit) & 1) as i32);
                }
            }
            b
        };

        run_walk(&raw, &bits, &msg_digest_vec)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn oneshot(data: &[u8]) -> [u8; 32] {
        kt_qhf_hash(data)
    }

    fn streaming(data: &[u8], chunk_size: usize) -> [u8; 32] {
        let mut s = KtQhfStreamer::new();
        for chunk in data.chunks(chunk_size) {
            s.update(chunk);
        }
        s.finalize()
    }

    #[test]
    fn equivalence_1kb() {
        let data = vec![0x42u8; 1024];
        assert_eq!(oneshot(&data), streaming(&data, 256));
    }

    #[test]
    fn equivalence_10kb() {
        let data: Vec<u8> = (0u8..=255).cycle().take(10 * 1024).collect();
        assert_eq!(oneshot(&data), streaming(&data, 1024));
    }

    #[test]
    fn equivalence_1mb() {
        let data: Vec<u8> = (0u8..=255).cycle().take(1024 * 1024).collect();
        assert_eq!(oneshot(&data), streaming(&data, 4096));
    }

    #[test]
    fn equivalence_4mb() {
        let data: Vec<u8> = (0u8..=255).cycle().take(4 * 1024 * 1024).collect();
        // Use 4 MiB chunk size (same as upload)
        assert_eq!(oneshot(&data), streaming(&data, 4 * 1024 * 1024));
    }

    #[test]
    fn equivalence_multi_chunk_varied() {
        // 10 MiB with varied data
        let data: Vec<u8> = (0u32..)
            .flat_map(|i| i.to_le_bytes())
            .take(10 * 1024 * 1024)
            .collect();
        assert_eq!(oneshot(&data), streaming(&data, 4 * 1024 * 1024));
    }

    #[test]
    fn equivalence_single_chunk() {
        // When there is exactly one chunk, update+finalize == oneshot
        let data: Vec<u8> = (0u8..=255).cycle().take(4 * 1024 * 1024).collect();
        assert_eq!(oneshot(&data), streaming(&data, 8 * 1024 * 1024));
    }

    #[test]
    fn equivalence_empty() {
        let data: Vec<u8> = vec![];
        assert_eq!(oneshot(&data), streaming(&data, 1024));
    }
}
