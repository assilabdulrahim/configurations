$TaskName = "AutoMapSambaShares"
$ScriptPath = "C:\Users\AssilAbdulrahim\source\repos\configurations\Mount-SambaShares.ps1"
$TargetUser = "AssilAbdulrahim"

# 1. Purge any old versions to prevent conflicts
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# 2. Define the Action (Run hidden, bypass execution policy just for this file)
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# 3. Define the Trigger (Execute upon user logon)
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# 4. Define Environment Settings (Wait for network, ignore battery restrictions)
$Settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# 5. Define the Security Principal (Forces interactive logon for your user)
$Principal = New-ScheduledTaskPrincipal -UserId $TargetUser -LogonType Interactive

# 6. Register the Task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal

Write-Output "SUCCESS: Scheduled task '$TaskName' has been registered."