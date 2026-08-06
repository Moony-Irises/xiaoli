---
type: docs
scope: docs
audience: developer
summary: Add an idea inbox for early project concepts and Codex notes
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - README.md
  - docs/idea-inbox.md
---

## What changed

Added `docs/idea-inbox.md` as a lightweight place to collect loose project ideas before they become formal TODO items or design docs. The file includes a reusable entry template, status labels, and initial entries for modpack knowledge/skills and cloud-local model role splitting.

## Why it matters

The project now has a safe place for early thoughts that are not ready to become implementation tasks. This keeps TODO focused on current work while preserving longer-term design signals.

## Demo posture / limitations

This is documentation only. It does not add runtime behavior, planning logic, modpack support, or model routing.
