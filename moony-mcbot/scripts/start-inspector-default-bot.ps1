$ErrorActionPreference = "Stop"

$serverScript = Resolve-Path -LiteralPath "$PSScriptRoot\start-mcp-server.ps1"

npx @modelcontextprotocol/inspector `
  "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  "-NoProfile" `
  "-ExecutionPolicy" `
  "Bypass" `
  "-File" `
  "$serverScript" `
  "-SkipBuild"
