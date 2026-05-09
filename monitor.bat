@echo off

wt -w new ^
new-tab -t "dashboard" ^
cmd /k "ssh -t assilabdulrahim@192.168.86.24 nvtop" ^
; split-pane -H --size 0.55 ^
cmd /k "ssh -t assilabdulrahim@192.168.86.24 /home/assilabdulrahim/watch-mem.sh" ^
; split-pane -V --size 0.5 ^
cmd /k "ssh assilabdulrahim@192.168.86.24" ^
; move-focus down ^
; split-pane -H --size 0.5 ^
cmd /k "ssh assilabdulrahim@192.168.86.24" ^
; split-pane -V --size 0.5 ^
cmd /k "ssh assilabdulrahim@192.168.86.24" ^
; move-focus right ^
; split-pane -V --size 0.5 ^
cmd /k "ssh assilabdulrahim@192.168.86.24"