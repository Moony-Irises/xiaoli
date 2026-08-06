---
type: docs
scope: docs
audience: developer
summary: 定义采矿 Adapter 的单块原子动作、兼容映射和安全寻路决策点
breaking: false
demo_ready: false
tests: git diff --check
artifacts:
  - docs/mining-adapter-migration-design.md
  - docs/architecture-convergence-roadmap.md
  - TODO.md
  - CLAUDE.md
---

## What changed

Documented a staged mining migration centered on one structured `mineBlock` adapter action. The design records the four duplicated mining paths, outcome mapping, pilot scope, test order and the confirmed zero-destruction movement policy with unreachable-route feedback.

## Why it matters

Mining combines movement, mutable block state, visibility, equipment and a destructive action. Defining this boundary before implementation prevents another client adapter from inheriting Mineflayer-specific loops and prevents all four existing paths from being rewritten at once.

## Demo posture / limitations

This change is design-only. It does not add the capability, alter mining behavior, implement Modded Client support, provide an install demo, publish a release or represent GA readiness. The contract and zero-destruction route policy are confirmed; implementation remains a separate tested change.
