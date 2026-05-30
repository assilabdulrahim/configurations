<#
.SYNOPSIS
    Maps GN100 Blackwell Samba Shares to local Windows Drive Letters.
    Designed for high-performance development environments.
#>

$ServerIP = "gn100-3692" # Or change to your node's raw IP if DNS isn't resolving yet
$Shares = @{
    "S" = "\\$ServerIP\FileShare"
    "K" = "\\$ServerIP\KnowledgeBase"
}

Write-Output "Initializing SMB Mapping Protocol..."

# Step 1: Force clean existing stale or disconnected sessions to prevent drive-letter locking
foreach ($Drive in $Shares.Keys) {
    if (Get-PSDrive -Name $Drive -ErrorAction SilentlyContinue) {
        Write-Output "Removing existing drive mapping: ${Drive}:"
        Remove-PSDrive -Name $Drive -Force -ErrorAction SilentlyContinue
    }
    # Backup legacy Windows network caching clearance
    if (Test-Path "${Drive}:") {
        (New-Object -ComObject WScript.Network).RemoveNetworkDrive("${Drive}:", $true, $true)
    }
}

# Step 2: Establish crisp SMB Connections using modern Windows Network Providers
foreach ($Drive in $Shares.Keys) {
    $RemotePath = $Shares[$Drive]
    try {
        Write-Output "Mounting ${RemotePath} to ${Drive}:..."
        New-SmbMapping -LocalPath "${Drive}:" -RemotePath $RemotePath -Persistent $true -ErrorAction Stop
        Write-Output "Successfully mapped ${Drive}:"
    }
    catch {
        Write-Warning "Failed to map ${Drive}: to ${RemotePath}. Error: $_"
    }
}