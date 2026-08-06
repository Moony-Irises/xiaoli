---
type: docs
scope: docs
audience: developer
summary: Plan shared memory storage for Minecraft bot and future TTS voice modules
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - README.md
  - docs/shared-memory-plan.md
  - docs/idea-inbox.md
---

## What changed

Added a shared memory migration plan for moving long-term XiaoLi memory toward `C:\xiaoli\memory`, so Minecraft gameplay, TTS voice, and future livestream assistant modules can eventually share player profiles, places, relationship facts, preferences, and episodic summaries.

## Why it matters

The current memory data is embedded inside `chat-configs.json` together with runtime configuration. That is workable for the Minecraft prototype, but it is not a clean long-term source for TTS and livestream modules.

## Demo posture / limitations

This is planning only. It does not migrate existing data, create a new runtime `MemoryStore`, or change where current tools persist memory.
