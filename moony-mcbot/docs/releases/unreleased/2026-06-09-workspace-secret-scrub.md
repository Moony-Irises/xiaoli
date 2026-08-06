---
type: fix
scope: workspace
audience: developer
summary: Remove committed default credentials and token log output from reference code
breaking: false
demo_ready: false
tests: cmd /c npm run build
artifacts:
  - reference/config.ts
  - reference/bot-connection.ts
---

## What changed

Removed hard-coded reference bot credentials and changed reference auth diagnostics so they only report whether tokens exist instead of printing token prefixes.

## Why it matters

Reference code is easy to forget during commits, but it is still part of the repository. Keeping credentials and token fragments out of committed files prevents accidental leakage before the project is pushed to a remote.

## Demo posture / limitations

This is a security hygiene fix for local source control. It does not rotate any real credential; any credential that has appeared in a local file should still be treated as exposed if it was ever shared outside this machine.
