@echo off
set HOST=assilabdulrahim@192.168.86.24

wt -w new new-tab --title "dashboard" cmd /k ssh %HOST% ; split-pane -H --size 0.5 cmd /k ssh %HOST% ; split-pane -V --size 0.55 cmd /k "ssh -tt %HOST% nvtop" ; split-pane -V --size 0.5 cmd /k "ssh %HOST% tail -f /var/log/syslog" ; split-pane -V --size 0.5 cmd /k "ssh -tt %HOST% /home/assilabdulrahim/watch-mem.sh" ; split-pane -V --size 0.6 cmd /k "ssh -tt %HOST% htop" ; split-pane -V --size 0.5 cmd /k "ssh -tt %HOST% iostat -xz 1"