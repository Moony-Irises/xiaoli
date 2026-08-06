---
type: fix
scope: runtime
audience: developer
summary: Stop logging shortened Yggdrasil token values during authentication
breaking: false
demo_ready: false
tests: cmd /c npm run build
artifacts:
  - src/services/auth-service.ts
---

## What changed

Authentication success logs no longer include a shortened access token. They now report only whether access and client tokens are present.

## Why it matters

Even shortened tokens are unnecessary in normal diagnostics. Keeping token material out of logs reduces accidental leakage through copied logs, screenshots, or debug output.

## Demo posture / limitations

This changes logging only. It does not alter the Yggdrasil login flow, stored sessions, or Minecraft server connection behavior.
