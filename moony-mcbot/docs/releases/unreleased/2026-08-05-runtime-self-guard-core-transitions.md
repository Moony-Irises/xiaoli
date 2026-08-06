---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 主 tick 的重连与健康下降条件迁入纯运行时决策
breaking: false
demo_ready: false
tests:
  - npm test -- test/self-guard-state.test.ts test/self-guard-runtime-state-store.test.ts test/self-guard-config-store.test.ts test/self-guard-environment.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-state.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-state.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增纯 `evaluateSelfGuardCoreTransitions`，根据当前/上一轮 Bot 引用和健康状态判定重连与健康下降。self-guard 主 tick 现在把原有两个内联条件委托给该函数，并在原位置执行既有重连短句、受伤处理和状态写入。

## Why it matters

首次观察、同一/不同 Bot 引用、严格 `0.5` 健康下降容差、vitals 不可用和损坏历史值现在可以离线回归。主 tick 的核心转场条件不再与 Mineflayer 副作用绑定，后续完整 GuardRuntime 迁移有了更窄的边界。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web、Adapter、配置或持久化公共契约，不迁移聊天、反击、采集和 Store 写入，也不提供真实伤害来源。`entityHurt` 订阅、`handleHitReaction`、随机场景逻辑和完整 tick 顺序仍由旧编排层负责。
