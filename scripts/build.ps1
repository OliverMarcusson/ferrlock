param(
    [string]$KeyPath = "$env:USERPROFILE\.tauri\ferrlock-updater.key",
    [string]$PrivateKey = $env:TAURI_SIGNING_PRIVATE_KEY,
    [string]$KeyPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-TauriSigningKey {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $trimmed = $Value.Trim()

    if ($trimmed -match '^untrusted comment:') {
        return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$trimmed`n"))
    }

    return ($trimmed -replace '\s+', '')
}

$privateKey = $PrivateKey
if ([string]::IsNullOrWhiteSpace($privateKey)) {
    if (-not (Test-Path -LiteralPath $KeyPath)) {
        throw "Updater signing key not found at '$KeyPath'."
    }

    $privateKey = Get-Content -Raw -Path $KeyPath
}

if ($null -eq $KeyPassword) {
    $KeyPassword = ""
}

$env:TAURI_SIGNING_PRIVATE_KEY = Normalize-TauriSigningKey -Value $privateKey
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $KeyPassword
$env:CI = "true"

bun run tauri build --ci
