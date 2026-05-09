@echo off
set HOST=assilabdulrahim@192.168.86.24

wt -w new ^
new-tab --title "dashboard" cmd /k ssh %HOST% ^
; split-pane -H --size 0.6 cmd /k ssh %HOST% ^
; move-focus left ^
; split-pane -V --size 0.6 cmd /k ssh %HOST% ^
; move-focus right ^
; split-pane -V --size 0.6 cmd /k ssh %HOST% ^
; move-focus down ^
; split-pane -H --size 0.7 cmd /k "ssh -tt %HOST% /home/assilabdulrahim/watch-mem.sh" ^
; split-pane -H --size 0.3 cmd /k "ssh -tt %HOST% nvtop"