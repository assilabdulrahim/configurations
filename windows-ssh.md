ssh-copy-id -i \~/.ssh/id\_ed25519\_work.pub assilabdulrahim@192.168.86.24

cat \~/.ssh/id\_ed25519.pub | ssh assilabdulrahim@192.168.86.24 "mkdir -p \~/.ssh \&\& chmod 700 \~/.ssh \&\& cat >> \~/.ssh/authorized\_keys \&\& chmod 600 \~/.ssh/authorized\_keys"



cat \~/.ssh/id\_ed25519.pub | ssh -v assilabdulrahim@192.168.86.24 "mkdir -p \~/.ssh \&\& cat >> \~/.ssh/authorized\_keys"

