---
type: test
scope: runtime
audience: developer
summary: Expanded offline adapter tests to cover action-history error, privacy, and retention behavior.
breaking: false
demo_ready: false
tests:
  - cmd /c npm test
  - cmd /c npm run build
artifacts:
  - test/client-adapter-status.test.ts
  - README.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-client-adapter-action-history-tests.md
---

## What changed

Extended the offline client-adapter test with controlled adapter method replacements. It verifies successful chat actions are redacted, thrown action errors are recorded, timestamps are present, and the in-memory recent-action list retains only the newest 24 entries.

## Why it matters

The adapter diagnostics now have regression coverage for the properties that make them useful during remote debugging: a failed action is visible, chat content is not copied into the status snapshot, and high-frequency actions cannot grow the history unboundedly.

## Demo posture / limitations

The test replaces adapter methods in an offline runtime and does not simulate Mineflayer or a Minecraft server. It validates runtime bookkeeping rather than real inventory, combat, chat, or network behavior.
