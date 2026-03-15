param(
    [string]$KeyPath = "$env:USERPROFILE\.tauri\ferrlock-updater.key",
    [string]$KeyPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "Updater signing key not found at '$KeyPath'."
}

$privateKey = Get-Content -Raw -Path $KeyPath
if ($null -eq $KeyPassword) {
    $KeyPassword = ""
}

$env:TAURI_SIGNING_PRIVATE_KEY = $privateKey
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $KeyPassword
$env:CI = "true"

bun run tauri build --ci
