---
type: fix
scope: runtime
audience: developer
summary: Added token authentication, Origin validation, security headers, and JSON body limits to the debug Web panel.
breaking: false
demo_ready: false
tests:
  - git diff --check
  - npm run build
  - npm run typecheck
  - npm test
artifacts:
  - src/debug/debug-server.ts
  - test/debug-web-security.test.ts
  - package.json
  - .env.local.example
  - README.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-22-runtime-debug-web-security.md
---

## What changed

The debug Web panel now supports an optional Bearer token, rejects unexpected browser Origins, adds basic security response headers, and limits POST JSON bodies. Non-loopback bindings are refused unless `MCBOT_DEBUG_WEB_AUTH_TOKEN` is configured. The browser client accepts a one-time `?token=` URL parameter and stores it in session storage for API requests.

## Why it matters

The panel can execute movement, inventory, combat, goal, and configuration actions. It should not become an unauthenticated control surface when exposed beyond localhost, and malformed or oversized requests should be rejected before action dispatch.

## Demo posture / limitations

This protects the current local debug panel and its JSON action endpoints. It is not a full user/account system, token rotation service, or HTTPS termination layer; use a private network and a reverse proxy for stronger deployment security.
