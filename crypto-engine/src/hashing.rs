use sha2::{Sha256, Digest};
use sha3::Shake256;
use sha3::digest::{Update, ExtendableOutput, XofReader};

pub fn sha256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    Digest::update(&mut hasher, data);
    hasher.finalize().to_vec()
}

pub fn shake256(data: &[u8], out_len: usize) -> Vec<u8> {
    let mut hasher = Shake256::default();
    Update::update(&mut hasher, data);
    let mut reader = hasher.finalize_xof();
    let mut out = vec![0u8; out_len];
    reader.read(&mut out);
    out
}
