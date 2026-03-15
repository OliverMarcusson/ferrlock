use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum FerrlockError {
    #[error("Registry operation failed: {0}")]
    Registry(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Password error: {0}")]
    Password(String),

    #[error("Launch error: {0}")]
    Launch(String),
}

impl Serialize for FerrlockError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
