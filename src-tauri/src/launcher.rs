use std::os::windows::process::CommandExt;
use std::process::Command;
use std::thread;
use std::time::Duration;

use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{
    CreateMutexW, ReleaseMutex, WaitForSingleObject, INFINITE,
};

use crate::errors::FerrlockError;
use crate::ifeo;

/// RAII guard for a Windows named mutex.
struct MutexGuard {
    handle: HANDLE,
}

impl MutexGuard {
    fn acquire(name: &str) -> Result<Self, FerrlockError> {
        let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();

        unsafe {
            let handle = CreateMutexW(None, false, PCWSTR(wide.as_ptr()))
                .map_err(|e| FerrlockError::Launch(format!("Failed to create mutex: {e}")))?;

            let wait_result = WaitForSingleObject(handle, INFINITE);
            if wait_result != WAIT_OBJECT_0 {
                let _ = CloseHandle(handle);
                return Err(FerrlockError::Launch("Failed to acquire mutex".to_string()));
            }

            Ok(Self { handle })
        }
    }
}

impl Drop for MutexGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = ReleaseMutex(self.handle);
            let _ = CloseHandle(self.handle);
        }
    }
}

fn spawn_relock_helper(exe_name: &str, ferrlock_path: &str) -> Result<(), FerrlockError> {
    const DETACHED_PROCESS: u32 = 0x00000008;

    Command::new(ferrlock_path)
        .arg("--relock")
        .arg(exe_name)
        .creation_flags(DETACHED_PROCESS)
        .spawn()
        .map_err(|e| FerrlockError::Launch(format!("Failed to start relock helper: {e}")))?;

    Ok(())
}

/// Launch a protected app safely by temporarily removing the IFEO entry.
pub fn launch_protected_app(
    exe_name: &str,
    exe_path: &str,
    ferrlock_path: &str,
) -> Result<(), FerrlockError> {
    let mutex_name = format!("Global\\ferrlock_{exe_name}");
    let _guard = MutexGuard::acquire(&mutex_name)?;

    // Temporarily remove IFEO so the real app launches without recursion
    ifeo::remove_ifeo_debugger(exe_name)?;

    // Launch the actual application (DETACHED_PROCESS avoids inheriting console)
    const DETACHED_PROCESS: u32 = 0x00000008;
    Command::new(exe_path)
        .creation_flags(DETACHED_PROCESS)
        .spawn()
        .map_err(|e| FerrlockError::Launch(format!("Failed to launch {exe_path}: {e}")))?;

    spawn_relock_helper(exe_name, ferrlock_path)?;

    Ok(())
}

pub fn wait_and_relock(exe_name: &str, ferrlock_path: &str) -> Result<(), FerrlockError> {
    const STARTUP_GRACE_PERIOD: Duration = Duration::from_secs(5);
    const POLL_INTERVAL: Duration = Duration::from_secs(1);

    let mutex_name = format!("Global\\ferrlock_{exe_name}");
    let _guard = MutexGuard::acquire(&mutex_name)?;

    thread::sleep(STARTUP_GRACE_PERIOD);

    while is_process_running(exe_name)? {
        thread::sleep(POLL_INTERVAL);
    }

    ifeo::set_ifeo_debugger(exe_name, ferrlock_path)
}

fn is_process_running(exe_name: &str) -> Result<bool, FerrlockError> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|e| FerrlockError::Launch(format!("Failed to snapshot processes: {e}")))?;

        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut running = false;

        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let process_name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                if process_name.eq_ignore_ascii_case(exe_name) {
                    running = true;
                    break;
                }

                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        Ok(running)
    }
}
