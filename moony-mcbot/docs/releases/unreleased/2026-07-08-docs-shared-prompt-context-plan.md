---
type: docs
scope: docs
audience: developer
summary: Document shared XiaoLi persona and cross-channel context memory layout.
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - docs/shared-prompt-context-plan.md
  - README.md
  - C:\xiaoli\memory\README.md
  - docs/releases/unreleased/2026-07-08-docs-shared-prompt-context-plan.md
---

## What changed

Added a shared prompt/context memory plan for moving XiaoLi persona prompts and rolling interaction summaries into `C:\xiaoli\memory`. The plan separates stable persona, per-source pending buffers, cross-channel summaries, and a convenient `context/context-pack.json` read target for McBot, Voice, and livestream modules.

## Why it matters

Voice and livestream modules need to understand McBot's memory work without reading McBot's private runtime files. A shared context pack gives every module one safe read target while keeping raw pending chat, danmaku, and game messages out of normal prompt generation.

## Demo posture / limitations

This is documentation only. It does not migrate the current `prompt-profile.json`, generate `context-pack.json`, or change runtime prompt loading yet. The next implementation step should add the shared persona read fallback and a context-pack generator.
