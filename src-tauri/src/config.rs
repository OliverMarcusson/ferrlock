use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::errors::FerrlockError;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProtectedApp {
    pub name: String,
    pub exe_name: String,
    pub exe_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AppConfig {
    pub password_hash: Option<String>,
    pub protected_apps: Vec<ProtectedApp>,
    pub autostart_enabled: bool,
}

pub fn config_dir() -> PathBuf {
    dirs::config_dir()
        .expect("Failed to get config directory")
        .join("ferrlock")
}

pub fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn load_config() -> Result<AppConfig, FerrlockError> {
    let path = config_path();
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| FerrlockError::Config(format!("Failed to read config: {e}")))?;

    serde_json::from_str(&content)
        .map_err(|e| FerrlockError::Config(format!("Failed to parse config: {e}")))
}

pub fn save_config(config: &AppConfig) -> Result<(), FerrlockError> {
    let dir = config_dir();
    fs::create_dir_all(&dir)
        .map_err(|e| FerrlockError::Config(format!("Failed to create config dir: {e}")))?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| FerrlockError::Config(format!("Failed to serialize config: {e}")))?;

    fs::write(config_path(), content)
        .map_err(|e| FerrlockError::Config(format!("Failed to write config: {e}")))
}
