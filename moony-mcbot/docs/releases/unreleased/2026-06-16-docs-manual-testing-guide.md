---
type: docs
scope: docs
audience: developer
summary: Add a manual testing guide for startup, MCP tools, agent flow, and adapter actions
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - README.md
  - docs/manual-testing-guide.md
---

## What changed

Added `docs/manual-testing-guide.md`, a step-by-step manual testing guide covering default bot startup, the local debug web panel, MCP Inspector typing pitfalls, smoke tests, agent configuration, follow/stop-follow, adapter action checks, self-guard auto-eating, and common troubleshooting.

## Why it matters

Existing acceptance documents describe scenarios, but they are not a single "sit down and test from scratch" workflow. This guide gives a practical route for returning to the project after a break and verifying the main runtime paths.

## Demo posture / limitations

This is documentation only. It does not add automated tests, change runtime behavior, or replace the deeper acceptance scenario docs.
