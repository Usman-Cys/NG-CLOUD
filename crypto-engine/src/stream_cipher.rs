const N: usize = 512;
const K: usize = 4;
const Q: i32 = 32768;
const CHUNK_SIZE: usize = 1024 * 1024; // 1 MB sub-chunks

fn mod_q(x: i32) -> i32 {
    let r = x % Q;
    if r < 0 { r + Q } else { r }
}

fn add_poly(a: &[i32], b: &[i32]) -> Vec<i32> {
    let mut out = vec![0; N];
    for i in 0..N {
        out[i] = mod_q(a[i] + b[i]);
    }
    out
}

fn negacyclic_mul(a: &[i32], b: &[i32]) -> Vec<i32> {
    let mut out = vec![0; N];
    for i in 0..N {
        for j in 0..N {
            let index = i + j;
            let product = a[i] * b[j];
            if index < N {
                out[index] = mod_q(out[index] + product);
            } else {
                out[index - N] = mod_q(out[index - N] - product);
            }
        }
    }
    out
}

fn serialize_poly(poly: &[i32]) -> Vec<u8> {
    let mut out = vec![0u8; N * 2];
    for i in 0..N {
        let val = mod_q(poly[i]) as u16;
        let bytes = val.to_be_bytes();
        out[i * 2] = bytes[0];
        out[i * 2 + 1] = bytes[1];
    }
    out
}

fn serialize_module(module_vector: &[Vec<i32>]) -> Vec<u8> {
    let mut out = Vec::with_capacity(module_vector.len() * N * 2);
    for poly in module_vector {
        out.extend_from_slice(&serialize_poly(poly));
    }
    out
}

fn bytes_to_poly(bytes: &[u8], offset: usize) -> Vec<i32> {
    let mut poly = vec![0; N];
    for i in 0..N {
        let b1 = bytes[offset + i * 2] as i32;
        let b2 = bytes[offset + i * 2 + 1] as i32;
        poly[i] = ((b1 << 8) | b2) % Q;
    }
    poly
}

fn number_to_bytes(num: u32) -> [u8; 4] {
    num.to_be_bytes()
}

fn deterministic_bytes(seed: &[u8], nonce: &[u8], label: &str, epoch: u32, length: usize) -> Vec<u8> {
    let mut data = Vec::new();
    data.extend_from_slice(label.as_bytes());
    data.extend_from_slice(seed);
    data.extend_from_slice(nonce);
    data.extend_from_slice(&number_to_bytes(epoch));
    crate::hashing::shake256(&data, length)
}

fn centered_noise(byte: u8) -> i32 {
    (byte as i32 % 7) - 3 // 2 * sigma + 1 = 7, sigma = 3
}

fn sample_noise_module(seed: &[u8], nonce: &[u8], label: &str, epoch: u32) -> Vec<Vec<i32>> {
    let bytes = deterministic_bytes(seed, nonce, label, epoch, N * K);
    let mut module_vector = Vec::new();
    let mut offset = 0;
    for _ in 0..K {
        let mut poly = vec![0; N];
        for i in 0..N {
            poly[i] = mod_q(centered_noise(bytes[offset]));
            offset += 1;
        }
        module_vector.push(poly);
    }
    module_vector
}

fn generate_initial_state(file_key: &[u8], nonce: &[u8]) -> Vec<Vec<i32>> {
    let mut data = Vec::new();
    data.extend_from_slice(b"FS-MLWE-SC-256-INITIAL-STATE");
    data.extend_from_slice(file_key);
    data.extend_from_slice(nonce);
    let bytes = crate::hashing::shake256(&data, N * K * 2);
    let mut state = Vec::new();
    for row in 0..K {
        state.push(bytes_to_poly(&bytes, row * N * 2));
    }
    state
}

fn update_state(current_state: &[Vec<i32>], file_key: &[u8], nonce: &[u8], epoch: u32) -> Vec<Vec<i32>> {
    let noise = sample_noise_module(file_key, nonce, "FS-MLWE-SC-256-STATE-NOISE", epoch);
    let mut noisy_state = Vec::new();
    for i in 0..K {
        noisy_state.push(add_poly(&current_state[i], &noise[i]));
    }
    let serialized = serialize_module(&noisy_state);
    
    let mut data = Vec::new();
    data.extend_from_slice(b"FS-MLWE-SC-256-RECURSIVE-STATE");
    data.extend_from_slice(&serialized);
    data.extend_from_slice(nonce);
    data.extend_from_slice(&number_to_bytes(epoch));
    
    let next_bytes = crate::hashing::shake256(&data, N * K * 2);
    let mut next_state = Vec::new();
    for row in 0..K {
        next_state.push(bytes_to_poly(&next_bytes, row * N * 2));
    }
    next_state
}

fn generate_public_matrix(file_key: &[u8], nonce: &[u8]) -> Vec<Vec<Vec<i32>>> {
    let mut data = Vec::new();
    data.extend_from_slice(b"FS-MLWE-SC-256-PUBLIC-MATRIX-A");
    data.extend_from_slice(file_key);
    data.extend_from_slice(nonce);
    let bytes = crate::hashing::shake256(&data, K * K * N * 2);
    let mut matrix = Vec::new();
    let mut offset = 0;
    for _r in 0..K {
        let mut row = Vec::new();
        for _c in 0..K {
            row.push(bytes_to_poly(&bytes, offset));
            offset += N * 2;
        }
        matrix.push(row);
    }
    matrix
}

fn compute_raw_keystream(
    matrix_a: &[Vec<Vec<i32>>],
    state: &[Vec<i32>],
    file_key: &[u8],
    nonce: &[u8],
    epoch: u32,
) -> Vec<Vec<i32>> {
    let noise = sample_noise_module(file_key, nonce, "FS-MLWE-SC-256-KEYSTREAM-NOISE", epoch);
    let mut output = Vec::new();
    for r in 0..K {
        let mut acc = vec![0; N];
        for c in 0..K {
            let product = negacyclic_mul(&matrix_a[r][c], &state[c]);
            acc = add_poly(&acc, &product);
        }
        acc = add_poly(&acc, &noise[r]);
        output.push(acc);
    }
    output
}

fn generate_mask(raw_keystream: &[Vec<i32>], nonce: &[u8], epoch: u32, length: usize) -> Vec<u8> {
    let serialized = serialize_module(raw_keystream);
    let mut data = Vec::new();
    data.extend_from_slice(b"FS-MLWE-SC-256-FINAL-MASK");
    data.extend_from_slice(&serialized);
    data.extend_from_slice(nonce);
    data.extend_from_slice(&number_to_bytes(epoch));
    crate::hashing::shake256(&data, length)
}

fn xor_bytes(data: &[u8], mask: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; data.len()];
    for i in 0..data.len() {
        out[i] = data[i] ^ mask[i];
    }
    out
}

pub fn derive_chunk_nonce(file_nonce: &[u8], chunk_index: u32) -> Vec<u8> {
    let mut chunk_nonce = file_nonce.to_vec();
    let index_bytes = chunk_index.to_be_bytes();
    let len = chunk_nonce.len();
    if len >= 4 {
        chunk_nonce[len - 4..len].copy_from_slice(&index_bytes);
    }
    chunk_nonce
}

pub fn encrypt_chunk(plain: &[u8], file_key: &[u8], nonce: &[u8]) -> Vec<u8> {
    let matrix_a = generate_public_matrix(file_key, nonce);
    let mut state = generate_initial_state(file_key, nonce);
    let mut encrypted = Vec::with_capacity(plain.len());
    
    let mut offset = 0;
    let mut epoch = 0;
    while offset < plain.len() {
        let subchunk_len = CHUNK_SIZE.min(plain.len() - offset);
        let subchunk = &plain[offset..offset + subchunk_len];
        
        let raw_keystream = compute_raw_keystream(&matrix_a, &state, file_key, nonce, epoch);
        let mask = generate_mask(&raw_keystream, nonce, epoch, subchunk_len);
        
        encrypted.extend_from_slice(&xor_bytes(subchunk, &mask));
        state = update_state(&state, file_key, nonce, epoch);
        
        offset += CHUNK_SIZE;
        epoch += 1;
    }
    encrypted
}

pub fn decrypt_chunk(cipher: &[u8], file_key: &[u8], nonce: &[u8]) -> Vec<u8> {
    // Stream cipher decryption is symmetric/identical to encryption
    encrypt_chunk(cipher, file_key, nonce)
}
