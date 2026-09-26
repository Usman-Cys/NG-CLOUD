use argon2::{Argon2, Algorithm, Version, Params};

pub fn argon2id_derive_key(password: &[u8], salt: &[u8]) -> Result<Vec<u8>, String> {
    let params = Params::new(65536, 3, 1, Some(32)).map_err(|e| e.to_string())?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut output = vec![0u8; 32];
    argon2.hash_password_into(password, salt, &mut output).map_err(|e| e.to_string())?;
    Ok(output)
}
