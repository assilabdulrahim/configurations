$Server = "gn100-3692"
$Shares = @(
    @{ Letter = "K:"; Path = "\\$Server\KnowledgeBase" },
    @{ Letter = "F:"; Path = "\\$Server\FileShare" }
)

foreach ($Share in $Shares) {
    $Drive = $Share.Letter
    $Target = $Share.Path

    # Interrogate existing SMB mappings
    $Mapping = Get-SmbMapping -LocalPath $Drive -ErrorAction SilentlyContinue

    if ($Mapping) {
        # Verify if the OS can actually traverse the path
        $IsHealthy = Test-Path -Path $Drive -ErrorAction SilentlyContinue
        
        if ($IsHealthy) {
            Write-Output "STATUS: $Drive is mapped and healthy. Skipping."
            continue
        } else {
            Write-Warning "STATE MISMATCH: $Drive is unresponsive. Purging corrupted connection..."
            Remove-SmbMapping -LocalPath $Drive -Force -UpdateProfile -ErrorAction SilentlyContinue
            
            # Ensure legacy net use handles are also destroyed
            net use $Drive /delete /y *>$null
            Start-Sleep -Seconds 2
        }
    }

    Write-Output "ACTION: Mapping $Drive to $Target..."
    try {
        New-SmbMapping -LocalPath $Drive -RemotePath $Target -Persistent $true -ErrorAction Stop
        Write-Output "SUCCESS: $Drive mapped cleanly."
    } catch {
        Write-Error "FAILURE: Could not map $Drive. $_"
    }
}