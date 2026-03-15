$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw "$env:USERPROFILE\.tauri\ferrlock-updater.key"; $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""; bun run tauri build
