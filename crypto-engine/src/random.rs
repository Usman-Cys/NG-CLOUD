use getrandom::getrandom;

pub fn generate_random_bytes(len: usize) -> Result<Vec<u8>, String> {
    let mut buf = vec![0u8; len];
    getrandom(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}
