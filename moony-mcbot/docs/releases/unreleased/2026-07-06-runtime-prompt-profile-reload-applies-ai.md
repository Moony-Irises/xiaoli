---
type: fix
scope: runtime
audience: developer
summary: Prompt profile loading is now synchronous and reloads immediately update active chat AI configs.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
  - node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('C:/Users/Moony/AppData/Local/moony-mcbot/config/prompt-profile.json','utf8')); console.log('prompt json ok')"
artifacts:
  - src/tools/action-tools.ts
---

## What changed

Prompt profile startup loading now happens synchronously before chat AI configs are created. `prompt.profile.reload` also pushes the reloaded `systemPrompt` into active `chat.ai` runtime configs.

## Why it matters

Editing `prompt-profile.json` is now much less ambiguous. The profile is treated as the canonical persona source for in-game AI small talk, instead of being silently shadowed by older runtime chat AI config state.

## Demo posture / limitations

This improves local persona iteration and debugging. It does not change model behavior guarantees: providers can still soften or ignore style instructions, so very strict tone should be tested in game after reload.
