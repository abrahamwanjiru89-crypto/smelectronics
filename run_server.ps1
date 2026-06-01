$P = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $P
$env:HOST = '0.0.0.0'
$env:PORT = '8000'
& "$P\.venv\Scripts\python.exe" server.py
