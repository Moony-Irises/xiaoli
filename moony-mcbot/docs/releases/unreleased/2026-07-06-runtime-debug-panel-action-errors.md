---
type: fix
scope: runtime
audience: developer
summary: Show failed debug-panel action responses in Last Action Result
breaking: false
demo_ready: true
tests: cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - docs/manual-testing-guide.md
---

## What changed

The Web debug panel now writes both successful and failed action responses into `Last Action Result`. Failed actions also update the toolbar status text with the error reason.

## Why it matters

Adapter actions such as `Eat` can legitimately fail when the bot has no edible item or Minecraft refuses consumption. Before this change, those failures looked like the button did nothing.

## Demo posture / limitations

This improves debug-panel feedback only. It does not change the underlying Minecraft action behavior or make eating possible when the game disallows it.
