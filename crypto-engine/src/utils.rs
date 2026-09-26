use base64ct::{Base64, Encoding};

pub fn bytes_to_base64(bytes: &[u8]) -> String {
    Base64::encode_string(bytes)
}

pub fn base64_to_bytes(base64: &str) -> Result<Vec<u8>, String> {
    Base64::decode_vec(base64.trim()).map_err(|e| e.to_string())
}

pub fn concat_bytes(arrays: &[&[u8]]) -> Vec<u8> {
    let total_len: usize = arrays.iter().map(|a| a.len()).sum();
    let mut out = Vec::with_capacity(total_len);
    for a in arrays {
        out.extend_from_slice(a);
    }
    out
}

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{:02x}", b));
    }
    out
}
