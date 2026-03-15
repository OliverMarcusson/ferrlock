# Ferrlock

Ferrlock is a Windows desktop app that password-protects selected `.exe` applications. It uses Tauri for the desktop shell, React for the UI, and the Windows Image File Execution Options (IFEO) debugger hook to intercept launches and require a password before the protected app starts.

## Features

- Protect specific Windows applications by executable name
- Store the master password as an Argon2 hash
- Show a lightweight unlock prompt when a protected app is launched
- Restore protection automatically after the target app exits
- Run as a tray app and optionally start with Windows

## Platform Scope

Ferrlock is currently Windows-only. The backend depends on the Windows registry and Win32 APIs, and the current bundle target is an NSIS installer.

## How It Works

When you add an app to Ferrlock, the Rust backend registers Ferrlock as the IFEO `Debugger` for that executable under:

`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options`

When the protected app is launched:

1. Windows starts Ferrlock instead of the target executable.
2. Ferrlock shows a password prompt.
3. If the password is correct, Ferrlock temporarily removes the IFEO debugger entry.
4. Ferrlock launches the real app.
5. A helper process waits for the app to exit, then re-enables protection.

Because Ferrlock writes under `HKLM`, adding or removing protected apps may require elevated rights depending on the current registry ACLs and how the app was installed.

## Requirements

- Windows 10 or Windows 11
- [Rust](https://www.rust-lang.org/tools/install) with the MSVC toolchain
- [Bun](https://bun.sh/)
- WebView2 runtime
- Tauri build prerequisites for Windows, including Visual Studio C++ build tools

## Development

Install dependencies:

```powershell
bun install
```

Run the app in development mode:

```powershell
bun run tauri dev
```

Create a production build:

```powershell
bun run tauri build
```

## Usage

1. Launch Ferrlock.
2. Open the `Settings` tab and set a password.
3. Open `Protected Apps` and add one or more `.exe` files.
4. Launch a protected app normally from Explorer, Start, or a shortcut.
5. Enter the password in the Ferrlock prompt to continue.

## Configuration

Ferrlock stores its configuration in:

`%APPDATA%\ferrlock\config.json`

That file contains:

- The Argon2 password hash
- The list of protected applications
- UI-level application settings

## Project Layout

```text
src/          React frontend
src-tauri/    Rust backend, Tauri config, Windows integration
```

## Security Notes

Ferrlock is a local access-control convenience tool, not a full anti-tamper system. Anyone with sufficient Windows privileges can still modify registry entries, replace binaries, or remove the protection mechanism. Use it as an application gate on your own machine, not as a hardened security boundary.

## GitHub Notes

The repository includes standard ignore rules and editor metadata files, but no license file has been added yet. Choose a license explicitly before publishing the repo publicly.

