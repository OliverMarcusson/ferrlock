function Normalize-TauriSigningKey {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $trimmed = $Value.Replace([string][char]0xFEFF, "").Trim()

    if ($trimmed -match '^untrusted comment:') {
        return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$trimmed`n"))
    }

    return ($trimmed -replace "[\s$([char]0xFEFF)]", "")
}

function Assert-TauriSigningKey {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $normalized = Normalize-TauriSigningKey -Value $Value

    try {
        $decodedBytes = [Convert]::FromBase64String($normalized)
    }
    catch {
        throw "Updater signing key is not valid base64 after normalization."
    }

    $decodedText = [Text.Encoding]::UTF8.GetString($decodedBytes).Replace("`r", "")
    $decodedText = $decodedText.TrimStart([char]0xFEFF)
    $lines = $decodedText.TrimEnd("`n").Split("`n")

    if ($lines.Count -lt 2 -or -not $lines[0].StartsWith("untrusted comment:")) {
        throw "Updater signing key decoded successfully but is not in the expected minisign secret key format."
    }

    return $normalized
}
