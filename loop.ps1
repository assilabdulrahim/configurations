#Requires -Version 7.0
<#
.SYNOPSIS
    Loop harness driver. Runs the objective -> challenge -> plan -> execute
    sequence end to end, with self-correction and a defined stopping point.

.DESCRIPTION
    Wraps the .claude/commands/*.md slash commands in a single driver so the
    end-user experience is one command, not five.

    Three powers, and what each actually means here:

      self-execution   the driver detects which phase the project is in and
                       runs the next one without being told
      self-correction  a NEEDS_WORK verdict from the evaluator becomes the
                       next cycle's task, automatically, until it passes
      self-conclusion  the run ends when every feature in the contract is
                       true, or when a stopping condition fires

    It is NOT fully autonomous by default, and that is deliberate. See the
    -Unattended switch and read the warning before using it.

.PARAMETER Goal
    One-line goal. Only used when OBJECTIVE.md does not yet exist.

.PARAMETER MaxCycles
    Hard ceiling on build/evaluate cycles. This bounds your spend.

.PARAMETER MaxNoProgress
    Consecutive cycles producing no new commit before the driver gives up.

.PARAMETER Unattended
    Skips the human checkpoint after the challenge phase. Read the warning.

.PARAMETER Phase
    Force a specific phase instead of auto-detecting.
    One of: init, challenge, plan, execute, status

.PARAMETER HarnessRoot
    Where the harness lives. Defaults to Claude Code's own global config
    directory (~\.claude) so one copy serves BOTH loop.ps1's headless reads
    and normal interactive slash-command typing inside `claude` — no
    duplication, and you never copy anything into a new project again.

.EXAMPLE
    .\loop.ps1 -Goal "Emit a CycloneDX 1.6 CBOM that passes the official validator"

.EXAMPLE
    .\loop.ps1 -MaxCycles 10

.NOTES
    UNTESTED end to end. One key assumption WAS tested and failed: headless
    mode (`claude -p "/command"`) does not resolve custom slash commands -
    confirmed 2026-07-30, it treats the text literally instead of running
    the command file. This script works around that by reading each command
    file's body directly (see Get-CommandPrompt) rather than invoking by
    name. Everything downstream of that fix is still unexecuted. Read this
    script before running it, and run it first against a throwaway repo.
#>

[CmdletBinding()]
param(
    [string]$Goal,
    [int]$MaxCycles = 20,
    [int]$MaxNoProgress = 3,
    [switch]$Unattended,
    [ValidateSet('init','challenge','plan','execute','status')]
    [string]$Phase,
    [string]$HarnessRoot = "$env:USERPROFILE\.claude"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

$Contract   = 'test-results.json'
$Findings   = 'NEXT_FINDINGS.md'
$StopFile   = 'AGENT_STOP'
$LogDir     = '.loop-logs'
$RunId      = Get-Date -Format 'yyyyMMdd-HHmmss'

# Tools the agent may use without prompting. Deliberately narrow.
$AllowedTools = 'Read,Write,Edit,Glob,Grep,Bash'

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

function Write-Phase {
    param([string]$Text)
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor DarkCyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor DarkCyan
}

function Write-Note { param([string]$T) Write-Host "  $T" -ForegroundColor Gray }
function Write-Good { param([string]$T) Write-Host "  $T" -ForegroundColor Green }
function Write-Warn { param([string]$T) Write-Host "  $T" -ForegroundColor Yellow }
function Write-Bad  { param([string]$T) Write-Host "  $T" -ForegroundColor Red }

function Assert-Prerequisites {
    foreach ($cmd in @('claude','git')) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            throw "'$cmd' not found on PATH. Install it before running this driver."
        }
    }
    if (-not (Test-Path (Join-Path $HarnessRoot 'commands\loop-next.md'))) {
        throw "Harness not found at '$HarnessRoot'. Run setup.ps1 once, or pass -HarnessRoot to point at your install."
    }
    if (-not (Test-Path '.git')) {
        Write-Warn 'No git repository here. The driver needs commits to detect progress.'
        if (-not $Unattended) {
            $a = Read-Host '  Run git init now? [y/N]'
            if ($a -eq 'y') { git init | Out-Null } else { throw 'Aborted: git required.' }
        } else { throw 'Aborted: git required.' }
    }

    # Command bodies reference templates\OBJECTIVE.md / RUBRIC.md as paths
    # relative to the project root (Claude's cwd when it reads them), not
    # to the central harness. Seed a project-local copy once. These are
    # meant to be filled in per-project anyway, so this is not duplication
    # in the same sense the commands/agents would be.
    $templSrc = Join-Path $HarnessRoot 'templates'
    if ((Test-Path $templSrc) -and -not (Test-Path '.\templates')) {
        Copy-Item $templSrc '.\templates' -Recurse
        Write-Note 'Seeded .\templates from the central harness.'
    }

    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
}

function Test-KillSwitch {
    if (Test-Path $StopFile) {
        Write-Bad "$StopFile present. Operator halt."
        Write-Note "Delete it to resume: Remove-Item $StopFile"
        return $true
    }
    return $false
}

function Get-CommandPrompt {
    <#  headless mode (claude -p) does NOT resolve custom slash commands -
        confirmed empirically 2026-07-30: /loop-status ran as plain text,
        Claude reasoned about the string instead of executing the command
        file. So the driver reads the command file's body itself and sends
        that as the prompt, instead of asking headless to resolve a name.

        Strips YAML frontmatter (the --- delimited block) and substitutes
        $ARGUMENTS if given, matching the documented slash-command contract
        even though headless can't do this substitution itself.  #>
    param(
        [Parameter(Mandatory)][string]$CommandName,
        [string]$Arguments = ''
    )

    $path = Join-Path $HarnessRoot "commands\$CommandName.md"
    if (-not (Test-Path $path)) {
        throw "Command file not found: $path`nExpected the harness at -HarnessRoot '$HarnessRoot'. Run setup or pass -HarnessRoot to point at it."
    }

    $raw = Get-Content $path -Raw

    # Strip frontmatter: everything between the first two '---' lines.
    if ($raw -match '(?s)^---\s*\r?\n.*?\r?\n---\s*\r?\n(.*)$') {
        $body = $Matches[1]
    } else {
        $body = $raw
    }

    $body = $body -replace '\$ARGUMENTS', $Arguments
    return $body.Trim()
}

function Invoke-Claude {
    <#  Runs Claude Code headless and returns stdout as a single string.
        Flags are the documented headless ones: --print, --allowedTools,
        --permission-mode. Transcript is logged for audit.

        -Command reads a .claude/commands/*.md file body directly (the
        working path). -Prompt sends raw text for one-off cases.  #>
    param(
        [string]$Command,
        [string]$Arguments = '',
        [string]$Prompt,
        [string]$Label = 'claude'
    )

    if ($Command) {
        $Prompt = Get-CommandPrompt -CommandName $Command -Arguments $Arguments
        $Label  = $Command
    }
    if (-not $Prompt) { throw 'Invoke-Claude: supply -Command or -Prompt.' }

    $logFile = Join-Path $LogDir "$RunId-$Label.log"
    Write-Note "-> claude -p [$Label] ($($Prompt.Length) chars)"

    $output = & claude -p $Prompt `
        --allowedTools $AllowedTools `
        --permission-mode acceptEdits 2>&1 | Out-String

    $output | Out-File -FilePath $logFile -Encoding utf8
    Write-Note "   transcript: $logFile"
    return $output
}

function Get-Contract {
    if (-not (Test-Path $Contract)) { return $null }
    try { return Get-Content $Contract -Raw | ConvertFrom-Json }
    catch { throw "$Contract is not valid JSON. Fix it before continuing." }
}

function Get-Remaining {
    $c = Get-Contract
    if ($null -eq $c) { return @() }
    return @($c.PSObject.Properties | Where-Object { -not $_.Value.passes } | Select-Object -Expand Name)
}

function Set-FeaturePassed {
    param([Parameter(Mandatory)][string]$Feature)
    $c = Get-Contract
    if ($null -eq $c.$Feature) {
        Write-Warn "Feature '$Feature' is not in the contract. Not recording a pass."
        return $false
    }
    $c.$Feature.passes = $true
    $c | ConvertTo-Json -Depth 10 | Set-Content $Contract -Encoding utf8
    return $true
}

function Get-HeadSha {
    try { return (git rev-parse HEAD 2>$null) } catch { return 'none' }
}

function Get-FeatureFromLastCommit {
    $subject = git log -1 --pretty=%s 2>$null
    if ($subject -match '(feature-\d+)') { return $Matches[1] }
    return $null
}

function Wait-ForHuman {
    <#  The checkpoint. This is the single most important line in the file. #>
    param([Parameter(Mandatory)][string]$File, [Parameter(Mandatory)][string]$What)

    if ($Unattended) {
        Write-Warn "-Unattended: skipping the $What checkpoint. The agent is now grading its own scope."
        return
    }

    Write-Host ''
    Write-Host "  ACTION REQUIRED: $What" -ForegroundColor Magenta
    Write-Note "File: $File"
    Write-Host ''
    $open = Read-Host '  Open it now? [Y/n]'
    if ($open -ne 'n') { Invoke-Item $File }

    do {
        $done = Read-Host "  Type 'done' when you have finished, or 'abort'"
        if ($done -eq 'abort') { throw 'Aborted by operator at checkpoint.' }
    } until ($done -eq 'done')
}

# --------------------------------------------------------------------------
# Phases
# --------------------------------------------------------------------------

function Invoke-InitPhase {
    Write-Phase 'PHASE 1 - OBJECTIVE'

    if (Test-Path 'OBJECTIVE.md') {
        Write-Good 'OBJECTIVE.md already exists. Skipping.'
        return
    }
    if (-not $Goal) {
        throw "No OBJECTIVE.md and no -Goal supplied. Re-run with: .\loop.ps1 -Goal 'your one-line goal'"
    }

    $initPrompt = (Get-CommandPrompt -CommandName 'loop-init' -Arguments $Goal) + @"


NOTE: this is a headless, non-interactive session. Do not interview me
turn by turn. Where the command above would have asked a question, write
that section with a TODO marker and a specific question for me to answer
instead. Be explicit about what you could not determine.
"@

    Invoke-Claude -Label 'init' -Prompt $initPrompt | Out-Null

    if (-not (Test-Path 'OBJECTIVE.md')) { throw 'Init phase did not produce OBJECTIVE.md.' }

    Wait-ForHuman -File 'OBJECTIVE.md' -What `
        'Fill in every TODO in OBJECTIVE.md. Done-conditions need named evidence; the OUT-of-scope list should not be empty.'
}

function Invoke-ChallengePhase {
    Write-Phase 'PHASE 2 - CHALLENGE'

    if (Test-Path 'CHALLENGE.md') {
        Write-Good 'CHALLENGE.md already exists. Skipping generation.'
    } else {
        Invoke-Claude -Command 'loop-challenge' | Out-Null
        if (-not (Test-Path 'CHALLENGE.md')) { throw 'Challenge phase did not produce CHALLENGE.md.' }
    }

    Wait-ForHuman -File 'CHALLENGE.md' -What `
        'Answer the challenge questions inline. This is the only real check on scope in the whole harness.'
}

function Invoke-PlanPhase {
    Write-Phase 'PHASE 3 - LOCK SCOPE'

    if (Test-Path $Contract) {
        Write-Good 'Contract already exists. Skipping planning.'
    } else {
        Invoke-Claude -Command 'loop-plan' | Out-Null
        foreach ($f in @('BUILD_PLAN.md','SCOPE.lock',$Contract)) {
            if (-not (Test-Path $f)) { throw "Plan phase did not produce $f." }
        }
    }

    $remaining = Get-Remaining
    Write-Note "Planned features: $($remaining.Count)"

    Wait-ForHuman -File 'BUILD_PLAN.md' -What `
        'Cut scope now. This is the last cheap moment to remove work - every feature you leave in costs cycles.'

    if ((git status --porcelain).Length -gt 0) {
        git add -A | Out-Null
        git commit -m 'harness: plan locked' | Out-Null
        Write-Good 'Plan committed.'
    }
}

function Invoke-ExecutePhase {
    Write-Phase 'PHASE 4 - EXECUTE'

    $cycle = 0
    $noProgress = 0
    $stopReason = 'unknown'

    while ($true) {

        $remaining = Get-Remaining
        if ($remaining.Count -eq 0) { $stopReason = 'COMPLETE'; break }
        if (Test-KillSwitch)        { $stopReason = 'KILL SWITCH'; break }

        $cycle++
        if ($cycle -gt $MaxCycles) { $stopReason = "BUDGET ($MaxCycles cycles)"; break }

        Write-Host ''
        Write-Host "  --- cycle $cycle/$MaxCycles | $($remaining.Count) features remaining ---" -ForegroundColor DarkCyan

        $headBefore = Get-HeadSha

        # --- build + evaluate, delegated to the slash command ---------------
        $result = Invoke-Claude -Command 'loop-next' -Label "cycle$cycle"

        # --- no-progress detection -----------------------------------------
        if ((Get-HeadSha) -eq $headBefore) {
            $noProgress++
            Write-Warn "No commit this cycle ($noProgress/$MaxNoProgress)"
            if ($noProgress -ge $MaxNoProgress) {
                $stopReason = "STALLED (no commit for $MaxNoProgress cycles)"
                break
            }
            continue
        }
        $noProgress = 0

        # --- self-correction ------------------------------------------------
        # /loop-next writes NEXT_FINDINGS.md on NEEDS_WORK. Its presence is
        # the signal that the next cycle is a fix, not a new feature. The
        # driver does nothing here on purpose - the file IS the mechanism.
        if (Test-Path $Findings) {
            Write-Warn 'NEEDS_WORK - findings carried into next cycle.'
        } else {
            $feature = Get-FeatureFromLastCommit
            if ($feature) {
                if (Set-FeaturePassed -Feature $feature) { Write-Good "PASS: $feature" }
            } else {
                Write-Warn 'Commit subject has no feature-N id. Contract not advanced.'
                Write-Note 'This is the known brittle point. Fix the commit message convention.'
            }
        }
    }

    # --- self-conclusion ---------------------------------------------------
    Write-Phase "RUN ENDED - $stopReason"

    $c = Get-Contract
    $total  = @($c.PSObject.Properties).Count
    $passed = @($c.PSObject.Properties | Where-Object { $_.Value.passes }).Count

    Write-Note "cycles used : $cycle of $MaxCycles"
    Write-Note "features    : $passed of $total passing"

    if ($stopReason -eq 'COMPLETE') {
        Write-Good 'Every feature in the contract passed evaluation.'
        Write-Note 'Verify against OBJECTIVE.md done-conditions yourself before you believe it.'
    } else {
        Write-Bad "Incomplete. Remaining: $((Get-Remaining) -join ', ')"
        Write-Note "Resume with: .\loop.ps1 -Phase execute -MaxCycles $MaxCycles"
    }

    Write-Note "transcripts : $LogDir\$RunId-*.log"
}

function Invoke-StatusPhase {
    Write-Phase 'STATUS'
    Invoke-Claude -Command 'loop-status' | Write-Host
}

# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

try {
    Assert-Prerequisites

    if ($Unattended) {
        Write-Bad 'UNATTENDED MODE'
        Write-Note 'Checkpoints are skipped. The agent will challenge its own objective and then'
        Write-Note 'plan against its own answers. Scope control is effectively off.'
        Write-Note 'Only use this on a run you have already completed attended at least once.'
        Write-Host ''
    }

    if ($Phase) {
        switch ($Phase) {
            'init'      { Invoke-InitPhase }
            'challenge' { Invoke-ChallengePhase }
            'plan'      { Invoke-PlanPhase }
            'execute'   { Invoke-ExecutePhase }
            'status'    { Invoke-StatusPhase }
        }
    } else {
        # Auto-detect: run every phase not yet satisfied.
        Invoke-InitPhase
        Invoke-ChallengePhase
        Invoke-PlanPhase
        Invoke-ExecutePhase
    }
}
catch {
    Write-Host ''
    Write-Bad "ABORTED: $($_.Exception.Message)"
    Write-Note "transcripts: $LogDir\$RunId-*.log"
    exit 1
}
