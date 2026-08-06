---
type: docs
scope: docs
audience: developer
summary: Document McBot source attribution for shared XiaoLi memory writes
breaking: false
demo_ready: false
tests: cmd /c npm run build
artifacts:
  - docs/shared-memory-plan.md
  - C:\xiaoli\memory\README.md
  - C:\xiaoli\memory\episodes.jsonl
---

## What changed

Documented that moony-mcbot / Minecraft-side shared-memory notes should use the `McBot:` human-readable prefix and the `McBot` JSONL source value. The shared memory README now lists stable source names for Voice, McBot, and Pic.

## Why it matters

Voice, game, and image modules will all write into the same long-term XiaoLi memory area. Stable source attribution keeps future LLM context assembly auditable and makes it easier to resolve conflicting notes.

## Demo posture / limitations

This is documentation and convention only. It does not migrate moony-mcbot runtime memory into `C:\xiaoli\memory` yet, and it does not add runtime validation for source names.
