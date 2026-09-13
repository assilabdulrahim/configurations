#Requires -Version 7.0
<#
.SYNOPSIS
    One-time install. Copies commands/agents/templates into Claude Code's
    own global config directory (~\.claude) so:
      - typing /loop-idea inside an interactive `claude` session works
        from any project, using Claude Code's normal global resolution
      - loop.ps1 reads the same files headlessly, from any project,
        without you ever copying anything into a new project again

.EXAMPLE
    .\setup.ps1
    .\setup.ps1 -Destination D:\somewhere\.claude
#>

param(
    [string]$Source = $PSScriptRoot,
    [string]$Destination = "$env:USERPROFILE\.claude"
)

Write-Host "Installing harness into: $Destination"
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

# .claude\commands and .claude\agents copy straight across.
foreach ($dir in @('commands', 'agents')) {
    $src = Join-Path $Source ".claude\$dir"
    $dst = Join-Path $Destination $dir
    if (Test-Path $src) {
        New-Item -ItemType Directory -Force -Path $dst | Out-Null
        Copy-Item "$src\*" $dst -Force
        Write-Host "  copied .claude\$dir -> $dst"
    } else {
        Write-Warning "  $src not found — skipped"
    }
}

# CLAUDE.md (builder protocol) to the global root, if not already present —
# don't clobber one the user may already have there.
$claudeMd = Join-Path $Source '.claude\CLAUDE.md'
$claudeMdDst = Join-Path $Destination 'CLAUDE.md'
if ((Test-Path $claudeMd) -and -not (Test-Path $claudeMdDst)) {
    Copy-Item $claudeMd $claudeMdDst
    Write-Host "  copied CLAUDE.md -> $claudeMdDst"
} elseif (Test-Path $claudeMdDst) {
    Write-Warning "  $claudeMdDst already exists — not overwritten. Merge manually if needed."
}

# templates\ — loop.ps1 seeds a project-local copy from here on first run.
$templSrc = Join-Path $Source 'templates'
$templDst = Join-Path $Destination 'templates'
if (Test-Path $templSrc) {
    New-Item -ItemType Directory -Force -Path $templDst | Out-Null
    Copy-Item "$templSrc\*" $templDst -Force
    Write-Host "  copied templates -> $templDst"
}

Write-Host ""
Write-Host "Done. Verify:" -ForegroundColor Green
Write-Host "  Get-ChildItem '$Destination\commands'"
Write-Host ""
Write-Host "Then from ANY project folder, no per-project copying:"
Write-Host "  claude              # interactive; type / and loop-* commands appear"
Write-Host "  loop.ps1 -Goal '...'  # headless driver"
Write-Host ""
Write-Host "Put loop.ps1 itself somewhere on PATH, or call it by full path each time."
