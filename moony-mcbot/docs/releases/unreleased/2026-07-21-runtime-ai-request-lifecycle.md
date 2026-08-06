---
type: fix
scope: runtime
audience: developer
summary: Added timeout, cancellation, fallback, and observable request states for planner, chat AI, and memory summaries.
breaking: false
demo_ready: false
tests:
  - git diff --check
  - npm run build
  - npm run typecheck
  - npm test
artifacts:
  - src/runtime/ai-request.ts
  - src/tools/action-tools.ts
  - src/memory/chat-memory.ts
  - test/ai-request.test.ts
  - package.json
  - .env.local.example
  - README.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-21-runtime-ai-request-lifecycle.md
---

## What changed

Planner, chat AI, and memory summary requests now use a shared timeout-aware text request helper that also accepts external cancellation. Chat AI cancels an active request when its configuration changes, Agent planning cancels when Agent configuration or strategic goal state is changed, and all three layers expose the last request state and error details through their status surfaces.

## Why it matters

An unavailable model endpoint previously left the caller waiting without a bounded request lifecycle, while fallback behavior was mainly visible only in logs. The runtime now ends requests within a configured limit and distinguishes success, fallback, timeout, cancellation, and failure for Web/MCP diagnostics.

## Demo posture / limitations

This adds request lifecycle control and observability; it does not change model selection policy or guarantee that every provider returns a compatible chat-completion response. Real provider timeout and cancellation behavior still needs a manual diagnostic run.
