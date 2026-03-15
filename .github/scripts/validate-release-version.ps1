param(
    [Parameter(Mandatory = $true)]
    [string]$TagName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

if ($TagName -notmatch '^v(?<version>\d+\.\d+\.\d+)$') {
    throw "Release tag '$TagName' must use the form vX.Y.Z."
}

$expectedVersion = $Matches.version

function Get-JsonVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $json = Get-Content -Raw -Path $Path | ConvertFrom-Json
    if (-not $json.version) {
        throw "No version field found in '$Path'."
    }

    return [string]$json.version
}

function Get-CargoVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $content = Get-Content -Raw -Path $Path
    $match = [regex]::Match($content, '(?m)^version\s*=\s*"(?<version>\d+\.\d+\.\d+)"\s*$')
    if (-not $match.Success) {
        throw "No package version found in '$Path'."
    }

    return $match.Groups["version"].Value
}

$versions = [ordered]@{
    "package.json"          = Get-JsonVersion (Join-Path $repoRoot "package.json")
    "src-tauri/Cargo.toml"  = Get-CargoVersion (Join-Path $repoRoot "src-tauri\Cargo.toml")
    "src-tauri/tauri.conf.json" = Get-JsonVersion (Join-Path $repoRoot "src-tauri\tauri.conf.json")
}

$mismatches = @()
foreach ($entry in $versions.GetEnumerator()) {
    if ($entry.Value -ne $expectedVersion) {
        $mismatches += "$($entry.Key) has version $($entry.Value)"
    }
}

if ($mismatches.Count -gt 0) {
    $details = $mismatches -join "; "
    throw "Version mismatch for tag '$TagName': expected $expectedVersion, but $details."
}

Write-Host "Validated release version $expectedVersion."

if ($env:GITHUB_OUTPUT) {
    "version=$expectedVersion" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
}
