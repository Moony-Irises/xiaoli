---
type: docs
scope: docs
audience: developer
summary: Add Codex notes for the on-demand eating policy idea
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - docs/idea-inbox.md
---

## What changed

Added Codex evaluation notes to the on-demand eating idea in `docs/idea-inbox.md`, promoted it to `candidate`, and sketched a staged implementation path around self-guard auto-eating, food hotbar slots, whitelists, owner approval, and later food scoring.

## Why it matters

The idea is close to existing runtime behavior, but needs a careful split between stable survival behavior and more experimental food optimization. Writing the note down keeps the future plan grounded in executable slices.

## Demo posture / limitations

This is documentation only. It does not change self-guard behavior, food selection, whitelist approval, or Minecraft runtime actions.
