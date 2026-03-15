use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use password_hash::rand_core::OsRng;
use password_hash::SaltString;

use crate::errors::FerrlockError;

pub fn hash_password(password: &str) -> Result<String, FerrlockError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| FerrlockError::Password(format!("Failed to hash password: {e}")))?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, FerrlockError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| FerrlockError::Password(format!("Invalid password hash: {e}")))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
