$keyPath = "$env:USERPROFILE\.ssh\nerox_ed25519"
if (Test-Path $keyPath) { Remove-Item $keyPath -Force }
if (Test-Path "$keyPath.pub") { Remove-Item "$keyPath.pub" -Force }
ssh-keygen -t ed25519 -f $keyPath -N '""' -C nerox
Get-Content "$keyPath.pub"
