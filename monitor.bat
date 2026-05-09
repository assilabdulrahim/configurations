@echo off
set HOST=assilabdulrahim@192.168.86.24

wt -w new new-tab --title "dashboard" cmd /k ssh %HOST% ; ^
split-pane -H --size 0.5 cmd /k ssh %HOST% ; ^
split-pane -V --size 0.65 cmd /k "ssh -tt %HOST% nvtop" ; ^
split-pane -V --size 0.5 cmd /k "ssh -tt %HOST% /home/assilabdulrahim/watch-mem.sh" ; ^
split-pane -V --size 0.5 cmd /k "ssh %HOST% journalctl -p 3 -f"