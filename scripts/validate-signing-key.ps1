param(
    [string]$KeyPath = "$env:USERPROFILE\.tauri\ferrlock-updater.key",
    [string]$PrivateKey = $env:TAURI_SIGNING_PRIVATE_KEY
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. $PSScriptRoot\tauri-signing.ps1

$privateKey = $PrivateKey
if ([string]::IsNullOrWhiteSpace($privateKey)) {
    if (-not (Test-Path -LiteralPath $KeyPath)) {
        throw "Updater signing key not found at '$KeyPath'."
    }

    $privateKey = Get-Content -Raw -Path $KeyPath
}

[void](Assert-TauriSigningKey -Value $privateKey)
Write-Host "Validated updater signing key format."
