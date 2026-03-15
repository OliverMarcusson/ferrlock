use winreg::enums::*;
use winreg::RegKey;

use crate::errors::FerrlockError;

const IFEO_BASE: &str =
    r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options";
const ERROR_FILE_NOT_FOUND: i32 = 2;
const ERROR_PATH_NOT_FOUND: i32 = 3;
const FERRLOCK_ORIGINAL_USE_FILTER: &str = "FerrlockOriginalUseFilter";

/// Register ferrlock as the IFEO debugger for a given executable.
/// When running with sufficient rights (management mode, elevated),
/// also grants BUILTIN\Users write access so the non-elevated prompt
/// mode can later toggle the Debugger value.
pub fn set_ifeo_debugger(exe_name: &str, ferrlock_path: &str) -> Result<(), FerrlockError> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey_path = format!("{IFEO_BASE}\\{exe_name}");

    let key = match hklm.open_subkey_with_flags(&subkey_path, KEY_ALL_ACCESS) {
        Ok(key) => {
            grant_users_write_access(&key)?;
            key
        }
        Err(full_access_err) => {
            match hklm.open_subkey_with_flags(&subkey_path, KEY_QUERY_VALUE | KEY_SET_VALUE) {
                Ok(key) => {
                    set_runtime_debugger(&key, ferrlock_path)?;
                    return Ok(());
                }
                Err(set_value_err) if is_not_found(&set_value_err) => {
                    let (key, _) = hklm
                        .create_subkey_with_flags(&subkey_path, KEY_ALL_ACCESS)
                        .map_err(|e| {
                            FerrlockError::Registry(format!("Failed to create IFEO key: {e}"))
                        })?;

                    grant_users_write_access(&key)?;
                    key
                }
                Err(set_value_err) => {
                    return Err(FerrlockError::Registry(format!(
                    "Failed to open IFEO key for writing: {set_value_err} (full access attempt: {full_access_err})"
                )));
                }
            }
        }
    };

    disable_use_filter_if_needed(&key)?;
    set_debugger_on_targets(&key, ferrlock_path)?;

    Ok(())
}

/// Remove the IFEO debugger entry for a given executable.
pub fn remove_ifeo_debugger(exe_name: &str) -> Result<(), FerrlockError> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey_path = format!("{IFEO_BASE}\\{exe_name}");

    let key = hklm
        .open_subkey_with_flags(&subkey_path, KEY_SET_VALUE)
        .map_err(|e| FerrlockError::Registry(format!("Failed to open IFEO key: {e}")))?;

    delete_value_if_present(&key, "Debugger")?;

    Ok(())
}

/// Remove all IFEO protection state for a given executable.
pub fn clear_ifeo_protection(exe_name: &str) -> Result<(), FerrlockError> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey_path = format!("{IFEO_BASE}\\{exe_name}");

    let key = hklm
        .open_subkey_with_flags(&subkey_path, KEY_ALL_ACCESS)
        .map_err(|e| FerrlockError::Registry(format!("Failed to open IFEO key: {e}")))?;

    remove_debugger_from_targets(&key)?;
    restore_use_filter_if_needed(&key)?;

    Ok(())
}

/// Check if an IFEO debugger is set for a given executable.
pub fn get_ifeo_debugger(exe_name: &str) -> Result<Option<String>, FerrlockError> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey_path = format!("{IFEO_BASE}\\{exe_name}");

    match hklm.open_subkey_with_flags(&subkey_path, KEY_READ) {
        Ok(key) => match key.get_value::<String, _>("Debugger") {
            Ok(val) => Ok(Some(val)),
            Err(_) => Ok(None),
        },
        Err(_) => Ok(None),
    }
}

/// Repair the IFEO key ACL for an already-protected executable.
pub fn repair_ifeo_permissions(exe_name: &str) -> Result<(), FerrlockError> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey_path = format!("{IFEO_BASE}\\{exe_name}");

    match hklm.open_subkey_with_flags(&subkey_path, KEY_ALL_ACCESS) {
        Ok(key) => grant_access_on_targets(&key),
        Err(err) if is_not_found(&err) => Ok(()),
        Err(err) => Err(FerrlockError::Registry(format!(
            "Failed to open IFEO key for ACL repair: {err}"
        ))),
    }
}

fn is_not_found(err: &std::io::Error) -> bool {
    matches!(
        err.raw_os_error(),
        Some(ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND)
    )
}

fn set_runtime_debugger(key: &RegKey, ferrlock_path: &str) -> Result<(), FerrlockError> {
    key.set_value("Debugger", &ferrlock_path)
        .map_err(|e| FerrlockError::Registry(format!("Failed to set Debugger value: {e}")))
}

fn disable_use_filter_if_needed(key: &RegKey) -> Result<(), FerrlockError> {
    let use_filter = key.get_value::<u32, _>("UseFilter").unwrap_or(0);
    if use_filter == 0 {
        return Ok(());
    }

    if key
        .get_value::<u32, _>(FERRLOCK_ORIGINAL_USE_FILTER)
        .is_err()
    {
        key.set_value(FERRLOCK_ORIGINAL_USE_FILTER, &use_filter)
            .map_err(|e| {
                FerrlockError::Registry(format!("Failed to persist original UseFilter value: {e}"))
            })?;
    }

    key.set_value("UseFilter", &0u32)
        .map_err(|e| FerrlockError::Registry(format!("Failed to disable UseFilter: {e}")))?;

    Ok(())
}

fn restore_use_filter_if_needed(key: &RegKey) -> Result<(), FerrlockError> {
    let original = match key.get_value::<u32, _>(FERRLOCK_ORIGINAL_USE_FILTER) {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };

    key.set_value("UseFilter", &original)
        .map_err(|e| FerrlockError::Registry(format!("Failed to restore UseFilter: {e}")))?;
    delete_value_if_present(key, FERRLOCK_ORIGINAL_USE_FILTER)
}

fn set_debugger_on_targets(key: &RegKey, ferrlock_path: &str) -> Result<(), FerrlockError> {
    key.set_value("Debugger", &ferrlock_path)
        .map_err(|e| FerrlockError::Registry(format!("Failed to set Debugger value: {e}")))?;

    for filter_key in open_existing_filter_subkeys(key, KEY_SET_VALUE)? {
        delete_value_if_present(&filter_key, "Debugger")?;
    }

    for filter_key in open_filter_subkeys(key, KEY_SET_VALUE)? {
        filter_key
            .set_value("Debugger", &ferrlock_path)
            .map_err(|e| {
                FerrlockError::Registry(format!("Failed to set filtered Debugger value: {e}"))
            })?;
    }

    Ok(())
}

fn remove_debugger_from_targets(key: &RegKey) -> Result<(), FerrlockError> {
    delete_value_if_present(key, "Debugger")?;

    for filter_key in open_existing_filter_subkeys(key, KEY_SET_VALUE)? {
        delete_value_if_present(&filter_key, "Debugger")?;
    }

    Ok(())
}

fn grant_access_on_targets(key: &RegKey) -> Result<(), FerrlockError> {
    grant_users_write_access(key)?;

    for filter_key in open_existing_filter_subkeys(key, KEY_ALL_ACCESS)? {
        grant_users_write_access(&filter_key)?;
    }

    Ok(())
}

fn delete_value_if_present(key: &RegKey, name: &str) -> Result<(), FerrlockError> {
    match key.delete_value(name) {
        Ok(()) => Ok(()),
        Err(err) if is_not_found(&err) => Ok(()),
        Err(err) => Err(FerrlockError::Registry(format!(
            "Failed to remove {name} value: {err}"
        ))),
    }
}

fn open_filter_subkeys(key: &RegKey, access: u32) -> Result<Vec<RegKey>, FerrlockError> {
    if key.get_value::<u32, _>("UseFilter").unwrap_or(0) == 0 {
        return Ok(Vec::new());
    }

    open_existing_filter_subkeys(key, access)
}

fn open_existing_filter_subkeys(key: &RegKey, access: u32) -> Result<Vec<RegKey>, FerrlockError> {
    let mut subkeys = Vec::new();
    for subkey_name in key.enum_keys() {
        let subkey_name = subkey_name.map_err(|e| {
            FerrlockError::Registry(format!("Failed to enumerate IFEO filter keys: {e}"))
        })?;
        let subkey = key
            .open_subkey_with_flags(&subkey_name, access)
            .map_err(|e| {
                FerrlockError::Registry(format!(
                    "Failed to open IFEO filter key {subkey_name}: {e}"
                ))
            })?;
        subkeys.push(subkey);
    }

    Ok(subkeys)
}

/// Grant BUILTIN\Users enough permission to inspect and toggle Debugger.
fn grant_users_write_access(key: &RegKey) -> Result<(), FerrlockError> {
    use windows::Win32::Foundation::{HANDLE, HLOCAL};
    use windows::Win32::Security::Authorization::{
        GetSecurityInfo, SetEntriesInAclW, SetSecurityInfo, EXPLICIT_ACCESS_W, GRANT_ACCESS,
        SE_REGISTRY_KEY, TRUSTEE_IS_SID, TRUSTEE_IS_WELL_KNOWN_GROUP, TRUSTEE_W,
    };
    use windows::Win32::Security::{
        CreateWellKnownSid, WinBuiltinUsersSid, ACL, DACL_SECURITY_INFORMATION,
        PSECURITY_DESCRIPTOR, PSID,
    };

    unsafe {
        let handle = HANDLE(key.raw_handle() as *mut std::ffi::c_void);

        // Read the current DACL so we can merge the new ACE into it.
        let mut existing_dacl: *mut ACL = std::ptr::null_mut();
        let mut sd = PSECURITY_DESCRIPTOR::default();
        GetSecurityInfo(
            handle,
            SE_REGISTRY_KEY,
            DACL_SECURITY_INFORMATION,
            None,
            None,
            Some(&mut existing_dacl),
            None,
            Some(&mut sd),
        )
        .ok()
        .map_err(|e| FerrlockError::Registry(format!("GetSecurityInfo failed: {e}")))?;

        let mut sid_size: u32 = 68;
        let mut sid_buf = vec![0u8; sid_size as usize];
        let users_sid = PSID(sid_buf.as_mut_ptr() as _);
        CreateWellKnownSid(WinBuiltinUsersSid, None, Some(users_sid), &mut sid_size)
            .map_err(|e| FerrlockError::Registry(format!("CreateWellKnownSid failed: {e}")))?;

        let ea = EXPLICIT_ACCESS_W {
            grfAccessPermissions: (KEY_QUERY_VALUE | KEY_SET_VALUE) as u32,
            grfAccessMode: GRANT_ACCESS,
            grfInheritance: windows::Win32::Security::ACE_FLAGS(0),
            Trustee: TRUSTEE_W {
                TrusteeForm: TRUSTEE_IS_SID,
                TrusteeType: TRUSTEE_IS_WELL_KNOWN_GROUP,
                ptstrName: windows::core::PWSTR(users_sid.0 as _),
                ..Default::default()
            },
        };

        let mut new_dacl: *mut ACL = std::ptr::null_mut();
        SetEntriesInAclW(Some(&[ea]), Some(existing_dacl), &mut new_dacl)
            .ok()
            .map_err(|e| FerrlockError::Registry(format!("SetEntriesInAclW failed: {e}")))?;

        SetSecurityInfo(
            handle,
            SE_REGISTRY_KEY,
            DACL_SECURITY_INFORMATION,
            None,
            None,
            Some(new_dacl),
            None,
        )
        .ok()
        .map_err(|e| FerrlockError::Registry(format!("SetSecurityInfo failed: {e}")))?;

        if !sd.0.is_null() {
            windows::Win32::Foundation::LocalFree(Some(HLOCAL(sd.0)));
        }
        if !new_dacl.is_null() {
            windows::Win32::Foundation::LocalFree(Some(HLOCAL(new_dacl as _)));
        }

        Ok(())
    }
}
