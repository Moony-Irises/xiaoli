---
type: feature
scope: runtime
audience: developer
summary: McBot prompt profile now defaults to the shared XiaoLi memory folder.
breaking: false
demo_ready: true
tests:
  - node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('C:/xiaoli/memory/prompts/mcbot-prompt-profile.json','utf8')); console.log('shared prompt ok')"
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - .env.local.example
  - docs/shared-prompt-context-plan.md
  - TODO.md
  - docs/releases/unreleased/2026-07-09-runtime-mcbot-prompt-profile-memory-path.md
---

## What changed

McBot now resolves its prompt profile from `C:\xiaoli\memory\prompts\mcbot-prompt-profile.json` by default. `MCBOT_PROMPT_PROFILE_PATH` still has highest priority. If the shared file is missing and no explicit override is configured, McBot copies the legacy AppData prompt profile once from `%LOCALAPPDATA%\moony-mcbot\config\prompt-profile.json`.

## Why it matters

The game bot prompt is now managed in the shared XiaoLi memory tree without making McBot consume Voice/live `context-pack.json`. This keeps livestream context available to Voice while keeping in-game chat behavior scoped to McBot.

## Demo posture / limitations

This changes the default file location only. It does not migrate chat configs, account credentials, API keys, or Voice prompt files. Existing AppData prompt profiles remain as a migration source and manual fallback reference.
