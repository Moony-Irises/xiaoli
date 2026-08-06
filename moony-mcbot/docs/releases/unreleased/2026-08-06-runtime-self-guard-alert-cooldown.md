---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 聊天告警冷却条件迁入纯运行时决策
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

新增纯 `evaluateSelfGuardAlertCooldown`，显式区分关闭、无效输入、冷却中和允许四种结果。`maybeAlertGuard` 改为消费该决策，并继续在允许时先写 `lastAlertAt`、随后尝试发送聊天。

## Why it matters

首次告警、严格冷却窗口、恰好达到边界和损坏时间输入现在可以离线验证。冷却条件不再绑定 ConfigStore、RuntimeStateStore、时钟或聊天发送，同时旧的发送失败不回滚冷却语义保持不变。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web、Adapter、配置或持久化公共契约，不迁移聊天发送、主动发言时间、完整 tick 或其他 self-guard 副作用。完整 tick 快照会改变部分采集相对副作用的顺序，需等待原子 Adapter 快照或明确的分阶段 plan。
