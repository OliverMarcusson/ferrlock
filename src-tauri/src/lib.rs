mod commands;
mod config;
mod errors;
mod ifeo;
mod launcher;
mod password;
mod tray;

use commands::AppState;
use std::sync::Mutex;

enum AppMode {
    Management,
    PasswordPrompt { target_exe: String },
    Relock { exe_name: String },
}

fn detect_mode(args: &[String]) -> AppMode {
    if args.len() <= 1 {
        return AppMode::Management;
    }

    if args[1] == "--relock" {
        if let Some(exe_name) = args.get(2) {
            return AppMode::Relock {
                exe_name: exe_name.clone(),
            };
        }
        return AppMode::Management;
    }

    // IFEO prepends the debugger path to the original command line.
    // Some launches pass a full path, others only pass the image name.
    // Reconstruct split paths, but accept bare *.exe names too.
    let mut candidate = String::new();
    for arg in &args[1..] {
        if !candidate.is_empty() {
            candidate.push(' ');
        }
        candidate.push_str(arg.trim_matches('"'));

        if candidate.to_lowercase().ends_with(".exe") {
            return AppMode::PasswordPrompt {
                target_exe: candidate,
            };
        }
    }

    AppMode::Management
}

fn get_ferrlock_path() -> String {
    std::env::current_exe()
        .expect("Failed to get current exe path")
        .to_string_lossy()
        .to_string()
}

fn sync_ifeo_entries(cfg: &config::AppConfig, ferrlock_path: &str) {
    for app in &cfg.protected_apps {
        if let Err(err) = ifeo::set_ifeo_debugger(&app.exe_name, ferrlock_path) {
            eprintln!(
                "[ferrlock] warning: failed to sync IFEO for {}: {}",
                app.exe_name, err
            );
            continue;
        }

        if let Err(err) = ifeo::repair_ifeo_permissions(&app.exe_name) {
            eprintln!(
                "[ferrlock] warning: failed to repair IFEO permissions for {}: {}",
                app.exe_name, err
            );
        }
    }
}

pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let mode = detect_mode(&args);

    match mode {
        AppMode::Management => run_management_mode(),
        AppMode::PasswordPrompt { target_exe } => run_prompt_mode(target_exe),
        AppMode::Relock { exe_name } => run_relock_mode(exe_name),
    }
}

fn run_management_mode() {
    let cfg = config::load_config().unwrap_or_default();
    let ferrlock_path = get_ferrlock_path();
    sync_ifeo_entries(&cfg, &ferrlock_path);

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            config: Mutex::new(cfg),
            ferrlock_path,
            target_exe: None,
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_protected_apps,
            commands::add_protected_app,
            commands::remove_protected_app,
            commands::set_password,
            commands::is_password_set,
            commands::get_target_exe,
            commands::verify_and_launch,
        ])
        .setup(|app| {
            // Create the main management window
            let window =
                tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("/".into()))
                    .title("Ferrlock")
                    .inner_size(700.0, 500.0)
                    .resizable(true)
                    .center()
                    .build()?;

            // Set up system tray
            tray::setup_tray(app.handle())?;

            // Hide main window on close instead of quitting
            let w = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = w.hide();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to run Ferrlock");
}

fn run_prompt_mode(target_exe: String) {
    let cfg = config::load_config().unwrap_or_default();
    let ferrlock_path = get_ferrlock_path();

    tauri::Builder::default()
        .manage(AppState {
            config: Mutex::new(cfg),
            ferrlock_path,
            target_exe: Some(target_exe),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_target_exe,
            commands::verify_and_launch,
            commands::is_password_set,
        ])
        .setup(move |app| {
            let prompt_window =
                tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("/".into()))
                    .data_directory(
                        dirs::data_dir()
                            .unwrap_or_default()
                            .join("ferrlock")
                            .join("webview-prompt"),
                    )
                    .title("Ferrlock")
                    .inner_size(380.0, 280.0)
                    .resizable(false)
                    .center()
                    .build()?;

            prompt_window.set_focus()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to run Ferrlock prompt");
}

fn run_relock_mode(exe_name: String) {
    let ferrlock_path = get_ferrlock_path();

    if let Err(err) = launcher::wait_and_relock(&exe_name, &ferrlock_path) {
        eprintln!(
            "[ferrlock] warning: failed to relock {} after exit: {}",
            exe_name, err
        );
    }
}
