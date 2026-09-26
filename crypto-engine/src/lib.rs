mod utils;
mod random;
mod hashing;
mod argon2;
mod ascon;
mod mlkem;
mod stream_cipher;
mod ktqhf;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct KeyPair {
    public_key: Vec<u8>,
    private_key: Vec<u8>,
}

#[wasm_bindgen]
impl KeyPair {
    #[wasm_bindgen(getter)]
    pub fn public_key(&self) -> Vec<u8> {
        self.public_key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn private_key(&self) -> Vec<u8> {
        self.private_key.clone()
    }
}

#[wasm_bindgen]
pub struct EncapResult {
    ciphertext: Vec<u8>,
    shared_secret: Vec<u8>,
}

#[wasm_bindgen]
impl EncapResult {
    #[wasm_bindgen(getter)]
    pub fn ciphertext(&self) -> Vec<u8> {
        self.ciphertext.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn shared_secret(&self) -> Vec<u8> {
        self.shared_secret.clone()
    }
}

#[wasm_bindgen]
pub fn generate_file_key() -> Result<Vec<u8>, JsError> {
    random::generate_random_bytes(32).map_err(|e| JsError::new(&e))
}

#[wasm_bindgen]
pub fn generate_nonce() -> Result<Vec<u8>, JsError> {
    random::generate_random_bytes(24).map_err(|e| JsError::new(&e))
}

#[wasm_bindgen]
pub fn derive_chunk_nonce(file_nonce: &[u8], chunk_index: u32) -> Vec<u8> {
    stream_cipher::derive_chunk_nonce(file_nonce, chunk_index)
}

#[wasm_bindgen]
pub fn encrypt_chunk(plain: &[u8], file_key: &[u8], nonce: &[u8]) -> Vec<u8> {
    stream_cipher::encrypt_chunk(plain, file_key, nonce)
}

#[wasm_bindgen]
pub fn decrypt_chunk(cipher: &[u8], file_key: &[u8], nonce: &[u8]) -> Vec<u8> {
    stream_cipher::decrypt_chunk(cipher, file_key, nonce)
}

#[wasm_bindgen]
pub fn kt_qhf_hash(message: &[u8]) -> Vec<u8> {
    ktqhf::kt_qhf_hash(message).to_vec()
}

/// Opaque handle returned by kt_qhf_init.
/// The JS side holds this as an object and passes it back to update/finalize.
#[wasm_bindgen]
pub struct KtQhfHandle {
    streamer: ktqhf::KtQhfStreamer,
}

#[wasm_bindgen]
impl KtQhfHandle {
    /// Feed one chunk of plaintext into the running hash state.
    pub fn update(&mut self, chunk: &[u8]) {
        self.streamer.update(chunk);
    }

    /// Consume the handle and return the final 32-byte digest.
    /// Produces the same result as kt_qhf_hash(full_message).
    pub fn finalize(self) -> Vec<u8> {
        self.streamer.finalize().to_vec()
    }
}

/// Create a new streaming KT-QHF hasher.
#[wasm_bindgen]
pub fn kt_qhf_init() -> KtQhfHandle {
    KtQhfHandle { streamer: ktqhf::KtQhfStreamer::new() }
}

#[wasm_bindgen]
pub fn ascon_128a_encrypt(key: &[u8], nonce: &[u8], plaintext: &[u8], ad: &[u8]) -> Result<Vec<u8>, JsError> {
    ascon::ascon_128a_encrypt(key, nonce, plaintext, ad).map_err(|e| JsError::new(&e))
}

#[wasm_bindgen]
pub fn ascon_128a_decrypt(key: &[u8], nonce: &[u8], ciphertext: &[u8], ad: &[u8]) -> Result<Vec<u8>, JsError> {
    ascon::ascon_128a_decrypt(key, nonce, ciphertext, ad).map_err(|e| JsError::new(&e))
}

#[wasm_bindgen]
pub fn argon2id_derive_key(password: &[u8], salt: &[u8]) -> Result<Vec<u8>, JsError> {
    argon2::argon2id_derive_key(password, salt).map_err(|e| JsError::new(&e))
}

#[wasm_bindgen]
pub fn mlkem768_keygen() -> KeyPair {
    let kp = mlkem::mlkem768_keygen();
    KeyPair {
        public_key: kp.public_key,
        private_key: kp.private_key,
    }
}

#[wasm_bindgen]
pub fn mlkem768_encap(public_key: &[u8]) -> Result<EncapResult, JsError> {
    let (ct, ss) = mlkem::mlkem768_encap(public_key).map_err(|e| JsError::new(&e))?;
    Ok(EncapResult {
        ciphertext: ct,
        shared_secret: ss,
    })
}

#[wasm_bindgen]
pub fn mlkem768_decap(ciphertext: &[u8], private_key: &[u8]) -> Result<Vec<u8>, JsError> {
    mlkem::mlkem768_decap(ciphertext, private_key).map_err(|e| JsError::new(&e))
}
