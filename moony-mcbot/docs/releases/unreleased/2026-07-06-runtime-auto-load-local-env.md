---
type: fix
scope: runtime
audience: developer
summary: Program startup now auto-loads the local .env.local file without requiring the PowerShell wrapper.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
  - node -e "import('./dist/utils/local-env.js').then(() => console.log(process.env.MCBOT_DEFAULT_BOT_ID ? 'loaded' : 'missing'))"
artifacts:
  - src/utils/local-env.ts
  - src/main.ts
  - src/tools/action-tools.ts
  - src/bootstrap/default-bot.ts
  - README.md
---

## What changed

Added a runtime `.env.local` loader that runs from the main MCP server entrypoint and from modules that read environment variables during module initialization.

## Why it matters

Direct startup paths such as `node dist/main.js`, `npm start`, CherryStudio, VS Code MCP Inspector, or a hand-written MCP config no longer depend on `scripts/start-mcp-server.ps1` to load local credentials and default bot settings.

## Demo posture / limitations

This makes local startup more forgiving, but it does not change secret storage rules. `.env.local` remains a local-only file ignored by git, and external environment variables still take precedence over values in `.env.local`.
