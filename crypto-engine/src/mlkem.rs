use ml_kem::{MlKem768, KemCore, EncodedSizeUser};
use ml_kem::kem::{Decapsulate, Encapsulate};
use rand_core::{RngCore, CryptoRng};
use getrandom::getrandom;

pub struct WasmRng;

impl RngCore for WasmRng {
    fn next_u32(&mut self) -> u32 {
        let mut buf = [0u8; 4];
        let _ = getrandom(&mut buf);
        u32::from_le_bytes(buf)
    }

    fn next_u64(&mut self) -> u64 {
        let mut buf = [0u8; 8];
        let _ = getrandom(&mut buf);
        u64::from_le_bytes(buf)
    }

    fn fill_bytes(&mut self, dest: &mut [u8]) {
        let _ = getrandom(dest);
    }

    fn try_fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), rand_core::Error> {
        getrandom(dest).map_err(|e| {
            rand_core::Error::from(e.code())
        })
    }
}

impl CryptoRng for WasmRng {}

pub struct KeyPair {
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
}

pub fn mlkem768_keygen() -> KeyPair {
    let mut rng = WasmRng;
    let (dk, ek) = MlKem768::generate(&mut rng);
    KeyPair {
        public_key: ek.as_bytes().to_vec(),
        private_key: dk.as_bytes().to_vec(),
    }
}

pub fn mlkem768_encap(public_key_bytes: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
    if public_key_bytes.len() != 1184 {
        return Err(format!("Invalid public key length: expected 1184, got {}", public_key_bytes.len()));
    }
    let mut rng = WasmRng;
    let ek_array = hybrid_array::Array::try_from(public_key_bytes)
        .map_err(|_| "Failed to parse public key into fixed array".to_string())?;
    
    let ek = <MlKem768 as KemCore>::EncapsulationKey::from_bytes(&ek_array);
    let (ct, ss) = ek.encapsulate(&mut rng)
        .map_err(|e| format!("Encapsulation error: {:?}", e))?;
    
    Ok((ct.to_vec(), ss.to_vec()))
}

pub fn mlkem768_decap(ciphertext_bytes: &[u8], private_key_bytes: &[u8]) -> Result<Vec<u8>, String> {
    if ciphertext_bytes.len() != 1088 {
        return Err(format!("Invalid ciphertext length: expected 1088, got {}", ciphertext_bytes.len()));
    }
    if private_key_bytes.len() != 2400 {
        return Err(format!("Invalid private key length: expected 2400, got {}", private_key_bytes.len()));
    }
    
    let dk_array = hybrid_array::Array::try_from(private_key_bytes)
        .map_err(|_| "Failed to parse private key into fixed array".to_string())?;
    let ct_array = hybrid_array::Array::try_from(ciphertext_bytes)
        .map_err(|_| "Failed to parse ciphertext into fixed array".to_string())?;
        
    let dk = <MlKem768 as KemCore>::DecapsulationKey::from_bytes(&dk_array);
    let ss = dk.decapsulate(&ct_array)
        .map_err(|e| format!("Decapsulation error: {:?}", e))?;
        
    Ok(ss.to_vec())
}
