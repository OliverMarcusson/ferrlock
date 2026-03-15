use std::sync::Mutex;

use tauri::State;

use crate::config::{self, AppConfig, ProtectedApp};
use crate::errors::FerrlockError;
use crate::ifeo;
use crate::launcher;
use crate::password;

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub ferrlock_path: String,
    pub target_exe: Option<String>,
}

// --- Management Commands ---

#[tauri::command]
pub fn get_protected_apps(state: State<'_, AppState>) -> Vec<ProtectedApp> {
    let config = state.config.lock().unwrap();
    eprintln!(
        "[ferrlock] get_protected_apps: {} apps",
        config.protected_apps.len()
    );
    config.protected_apps.clone()
}

#[tauri::command]
pub fn add_protected_app(
    state: State<'_, AppState>,
    name: String,
    exe_name: String,
    exe_path: String,
) -> Result<(), FerrlockError> {
    eprintln!("[ferrlock] add_protected_app called: name={name}, exe_name={exe_name}, exe_path={exe_path}");

    let mut config = state.config.lock().unwrap();

    // Check if already protected
    if config.protected_apps.iter().any(|a| a.exe_name == exe_name) {
        eprintln!("[ferrlock] already protected: {exe_name}");
        return Err(FerrlockError::Config(format!(
            "{exe_name} is already protected"
        )));
    }

    // Register IFEO
    eprintln!(
        "[ferrlock] setting IFEO for {exe_name} -> {}",
        &state.ferrlock_path
    );
    if let Err(e) = ifeo::set_ifeo_debugger(&exe_name, &state.ferrlock_path) {
        eprintln!("[ferrlock] IFEO error: {e}");
        return Err(e);
    }
    eprintln!("[ferrlock] IFEO set successfully");

    // Add to config
    config.protected_apps.push(ProtectedApp {
        name,
        exe_name,
        exe_path,
    });

    eprintln!("[ferrlock] saving config...");
    config::save_config(&config)?;
    eprintln!("[ferrlock] config saved successfully");
    Ok(())
}

#[tauri::command]
pub fn remove_protected_app(
    state: State<'_, AppState>,
    exe_name: String,
) -> Result<(), FerrlockError> {
    eprintln!("[ferrlock] remove_protected_app: {exe_name}");
    let mut config = state.config.lock().unwrap();

    ifeo::clear_ifeo_protection(&exe_name)?;
    config.protected_apps.retain(|a| a.exe_name != exe_name);
    config::save_config(&config)?;
    eprintln!("[ferrlock] removed {exe_name}");
    Ok(())
}

#[tauri::command]
pub fn set_password(state: State<'_, AppState>, password: String) -> Result<(), FerrlockError> {
    eprintln!("[ferrlock] set_password called");
    let hash = password::hash_password(&password)?;
    let mut config = state.config.lock().unwrap();
    config.password_hash = Some(hash);
    config::save_config(&config)?;
    eprintln!("[ferrlock] password set successfully");
    Ok(())
}

#[tauri::command]
pub fn is_password_set(state: State<'_, AppState>) -> bool {
    let config = state.config.lock().unwrap();
    let set = config.password_hash.is_some();
    eprintln!("[ferrlock] is_password_set: {set}");
    set
}

#[tauri::command]
pub fn verify_management_password(
    state: State<'_, AppState>,
    password: String,
) -> Result<bool, FerrlockError> {
    eprintln!("[ferrlock] verify_management_password called");
    let config = state.config.lock().unwrap();

    let Some(hash) = config.password_hash.as_ref() else {
        eprintln!("[ferrlock] management password not set");
        return Ok(true);
    };

    let valid = password::verify_password(&password, hash)?;
    eprintln!("[ferrlock] management password valid: {valid}");
    Ok(valid)
}

// --- Mode Detection ---

#[tauri::command]
pub fn get_target_exe(state: State<'_, AppState>) -> Option<String> {
    state.target_exe.clone()
}

// --- Password Prompt Commands ---

#[tauri::command]
pub fn verify_and_launch(
    state: State<'_, AppState>,
    password: String,
    target_exe: String,
) -> Result<bool, FerrlockError> {
    eprintln!("[ferrlock] verify_and_launch: target={target_exe}");
    let config = state.config.lock().unwrap();

    let hash = config
        .password_hash
        .as_ref()
        .ok_or_else(|| FerrlockError::Password("No password set".to_string()))?;

    if !password::verify_password(&password, hash)? {
        eprintln!("[ferrlock] wrong password");
        return Ok(false);
    }

    let exe_name = std::path::Path::new(&target_exe)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| FerrlockError::Launch("Invalid exe path".to_string()))?
        .to_string();

    let launch_path = config
        .protected_apps
        .iter()
        .find(|app| app.exe_name.eq_ignore_ascii_case(&exe_name))
        .map(|app| app.exe_path.clone())
        .unwrap_or_else(|| target_exe.clone());

    eprintln!("[ferrlock] password correct, launching {exe_name}");
    launcher::launch_protected_app(&exe_name, &launch_path, &state.ferrlock_path)?;

    Ok(true)
}
