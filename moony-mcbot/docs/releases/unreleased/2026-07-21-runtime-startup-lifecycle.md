---
type: fix
scope: runtime
audience: developer
summary: Made persisted runtime configuration loading awaitable and applied environment overrides deterministically.
breaking: false
demo_ready: false
tests:
  - git diff --check
  - npm run typecheck
  - npm test
artifacts:
  - src/runtime/startup-lifecycle.ts
  - src/tools/action-tools.ts
  - src/main.ts
  - test/client-adapter-status.test.ts
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-21-runtime-startup-lifecycle.md
---

## What changed

Startup now waits for persisted chat, Agent, self-guard, and shared-memory state before applying environment overrides. The runtime is reconciled after the default bot is created, so persisted listeners, Agent executors, and self-guard loops can be activated consistently. The shared AI base URL and model environment variables also override stale persisted defaults for the configured default bot.

## Why it matters

Configuration no longer depends on an asynchronous load racing with startup defaults. This makes `.env.local`, `chat-configs.json`, and runtime activation behavior predictable across restarts and fixes the case where an old API base URL remains effective simply because a persisted config already exists.

## Demo posture / limitations

This change only closes the startup/configuration lifecycle. It does not yet add connection cancellation, safe pathfinder profiles, Web authentication, chat deduplication, or the final Agent single-source-of-truth migration.
