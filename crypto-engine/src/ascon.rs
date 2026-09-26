use ascon::State;

fn to_u64(bytes: &[u8]) -> u64 {
    let mut buf = [0u8; 8];
    buf[..bytes.len().min(8)].copy_from_slice(&bytes[..bytes.len().min(8)]);
    u64::from_be_bytes(buf)
}

fn from_u64(val: u64) -> [u8; 8] {
    val.to_be_bytes()
}

pub fn ascon_128a_encrypt(key: &[u8], nonce: &[u8], plaintext: &[u8], ad: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != 16 {
        return Err("Ascon key must be 16 bytes".to_string());
    }
    if nonce.len() != 16 {
        return Err("Ascon nonce must be 16 bytes".to_string());
    }

    let k0 = to_u64(&key[0..8]);
    let k1 = to_u64(&key[8..16]);
    let n0 = to_u64(&nonce[0..8]);
    let n1 = to_u64(&nonce[8..16]);

    // 1. Initialization
    let mut state = State::new(0x80800c0800000000, k0, k1, n0, n1);
    state.permute_12();
    state[3] ^= k0;
    state[4] ^= k1;

    // 2. Associated Data Processing
    if !ad.is_empty() {
        let mut offset = 0;
        while offset < ad.len() {
            let chunk = &ad[offset..ad.len().min(offset + 16)];
            if chunk.len() == 16 {
                state[0] ^= to_u64(&chunk[0..8]);
                state[1] ^= to_u64(&chunk[8..16]);
            } else {
                let mut padded = [0u8; 16];
                padded[..chunk.len()].copy_from_slice(chunk);
                padded[chunk.len()] = 0x80;
                state[0] ^= to_u64(&padded[0..8]);
                state[1] ^= to_u64(&padded[8..16]);
            }
            state.permute_8();
            offset += 16;
        }
    }
    state[4] ^= 1;

    // 3. Plaintext Encryption
    let mut ciphertext = Vec::with_capacity(plaintext.len() + 16);
    let mut offset = 0;
    while offset < plaintext.len() {
        let chunk = &plaintext[offset..plaintext.len().min(offset + 16)];
        if chunk.len() == 16 {
            let p0 = to_u64(&chunk[0..8]);
            let p1 = to_u64(&chunk[8..16]);
            state[0] ^= p0;
            state[1] ^= p1;
            ciphertext.extend_from_slice(&from_u64(state[0]));
            ciphertext.extend_from_slice(&from_u64(state[1]));
            state.permute_8();
        } else {
            let mut padded = [0u8; 16];
            padded[..chunk.len()].copy_from_slice(chunk);
            padded[chunk.len()] = 0x80;
            state[0] ^= to_u64(&padded[0..8]);
            state[1] ^= to_u64(&padded[8..16]);

            let c0_bytes = from_u64(state[0]);
            let c1_bytes = from_u64(state[1]);
            let mut c_bytes = [0u8; 16];
            c_bytes[0..8].copy_from_slice(&c0_bytes);
            c_bytes[8..16].copy_from_slice(&c1_bytes);
            ciphertext.extend_from_slice(&c_bytes[..chunk.len()]);
        }
        offset += 16;
    }

    // 4. Finalization
    state[2] ^= k0;
    state[3] ^= k1;
    state.permute_12();
    state[3] ^= k0;
    state[4] ^= k1;

    let tag_high = from_u64(state[3]);
    let tag_low = from_u64(state[4]);
    ciphertext.extend_from_slice(&tag_high);
    ciphertext.extend_from_slice(&tag_low);

    Ok(ciphertext)
}

pub fn ascon_128a_decrypt(key: &[u8], nonce: &[u8], ciphertext: &[u8], ad: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != 16 {
        return Err("Ascon key must be 16 bytes".to_string());
    }
    if nonce.len() != 16 {
        return Err("Ascon nonce must be 16 bytes".to_string());
    }
    if ciphertext.len() < 16 {
        return Err("Ascon ciphertext too short (missing tag)".to_string());
    }

    let clen = ciphertext.len() - 16;
    let encrypted_payload = &ciphertext[0..clen];
    let expected_tag = &ciphertext[clen..];

    let k0 = to_u64(&key[0..8]);
    let k1 = to_u64(&key[8..16]);
    let n0 = to_u64(&nonce[0..8]);
    let n1 = to_u64(&nonce[8..16]);

    // 1. Initialization
    let mut state = State::new(0x80800c0800000000, k0, k1, n0, n1);
    state.permute_12();
    state[3] ^= k0;
    state[4] ^= k1;

    // 2. Associated Data Processing
    if !ad.is_empty() {
        let mut offset = 0;
        while offset < ad.len() {
            let chunk = &ad[offset..ad.len().min(offset + 16)];
            if chunk.len() == 16 {
                state[0] ^= to_u64(&chunk[0..8]);
                state[1] ^= to_u64(&chunk[8..16]);
            } else {
                let mut padded = [0u8; 16];
                padded[..chunk.len()].copy_from_slice(chunk);
                padded[chunk.len()] = 0x80;
                state[0] ^= to_u64(&padded[0..8]);
                state[1] ^= to_u64(&padded[8..16]);
            }
            state.permute_8();
            offset += 16;
        }
    }
    state[4] ^= 1;

    // 3. Plaintext Decryption
    let mut plaintext = Vec::with_capacity(clen);
    let mut offset = 0;
    while offset < clen {
        let chunk = &encrypted_payload[offset..clen.min(offset + 16)];
        if chunk.len() == 16 {
            let c0 = to_u64(&chunk[0..8]);
            let c1 = to_u64(&chunk[8..16]);
            let p0 = state[0] ^ c0;
            let p1 = state[1] ^ c1;
            state[0] = c0;
            state[1] = c1;
            plaintext.extend_from_slice(&from_u64(p0));
            plaintext.extend_from_slice(&from_u64(p1));
            state.permute_8();
        } else {
            // Partial block decryption
            let mut c_padded = [0u8; 16];
            c_padded[..chunk.len()].copy_from_slice(chunk);

            let s0_bytes = from_u64(state[0]);
            let s1_bytes = from_u64(state[1]);
            let mut s_bytes = [0u8; 16];
            s_bytes[0..8].copy_from_slice(&s0_bytes);
            s_bytes[8..16].copy_from_slice(&s1_bytes);

            let mut p_bytes = [0u8; 16];
            for i in 0..chunk.len() {
                p_bytes[i] = s_bytes[i] ^ c_padded[i];
            }
            p_bytes[chunk.len()] = 0x80;

            state[0] ^= to_u64(&p_bytes[0..8]);
            state[1] ^= to_u64(&p_bytes[8..16]);

            plaintext.extend_from_slice(&p_bytes[..chunk.len()]);
        }
        offset += 16;
    }

    // 4. Finalization
    state[2] ^= k0;
    state[3] ^= k1;
    state.permute_12();
    state[3] ^= k0;
    state[4] ^= k1;

    let tag_high = from_u64(state[3]);
    let tag_low = from_u64(state[4]);
    let mut computed_tag = [0u8; 16];
    computed_tag[0..8].copy_from_slice(&tag_high);
    computed_tag[8..16].copy_from_slice(&tag_low);

    if computed_tag != expected_tag {
        return Err("Ascon integrity check failed (invalid tag)".to_string());
    }

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ascon_reference() {
        let key = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        let nonce = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        let plain = b"hello";
        let ad = b"NGCloud-Kyber-Private-Key-v2";
        let cipher = ascon_128a_encrypt(&key, &nonce, plain, ad).unwrap();
        println!("Rust encrypted bytes: {:?}", cipher);
        // reference: [29, 241, 131, 95, 77, 174, 167, 181, 166, 110, 228, 227, 76, 189, 24, 27, 197, 237, 42, 38, 251]
        assert_eq!(cipher, vec![29, 241, 131, 95, 77, 174, 167, 181, 166, 110, 228, 227, 76, 189, 24, 27, 197, 237, 42, 38, 251]);
    }

    #[test]
    fn test_ascon_decrypt() {
        let key = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        let nonce = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        let plain = b"hello";
        let ad = b"NGCloud-Kyber-Private-Key-v2";
        let cipher = ascon_128a_encrypt(&key, &nonce, plain, ad).unwrap();
        let decrypted = ascon_128a_decrypt(&key, &nonce, &cipher, ad).unwrap();
        assert_eq!(decrypted, plain);
    }

    #[test]
    fn test_ascon_various_lengths() {
        let key = [5; 16];
        let nonce = [10; 16];
        let ad = b"AssociatedDataTest";
        for len in 0..=128 {
            let plain = vec![0x42u8; len];
            let cipher = ascon_128a_encrypt(&key, &nonce, &plain, ad).unwrap();
            assert_eq!(cipher.len(), len + 16);
            let decrypted = ascon_128a_decrypt(&key, &nonce, &cipher, ad).unwrap();
            assert_eq!(decrypted, plain);
        }
    }
}

