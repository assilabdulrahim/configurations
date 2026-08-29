#!/bin/bash
watch -n1 "awk '/MemTotal/{t=\$2}/MemAvailable/{a=\$2}END{printf \"Used: %.1f GB / %.1f GB\n\",(t-a)/1048576,t/1048576}' /proc/meminfo"