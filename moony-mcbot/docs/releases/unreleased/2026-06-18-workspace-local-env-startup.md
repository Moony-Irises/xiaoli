---
type: feature
scope: workspace
audience: developer
summary: Add local env based startup scripts for MCP clients and Inspector
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
  - powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mcp-server.ps1 -EnvFile .\.env.local.example -ValidateOnly
artifacts:
  - .env.local.example
  - scripts/start-mcp-server.ps1
  - scripts/start-inspector-default-bot.ps1
  - README.md
  - docs/manual-testing-guide.md
  - C:\xiaoli\mcp.json
---

## What changed

Added a local `.env.local` based startup path. `scripts/start-mcp-server.ps1` loads local environment values and starts the built MCP server, while `scripts/start-inspector-default-bot.ps1` now reuses that server script. The local `C:\xiaoli\mcp.json` was changed to call the script instead of embedding secrets.

## Why it matters

Testing no longer depends on retyping credentials and bot defaults into each MCP client. Secrets stay in ignored local env files, and clients can share one stable startup command.

## Demo posture / limitations

This improves local startup ergonomics only. It does not add a packaged desktop app, a secret manager, or a full background service.
