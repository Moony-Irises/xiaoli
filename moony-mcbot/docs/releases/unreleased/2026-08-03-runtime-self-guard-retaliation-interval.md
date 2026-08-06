---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 持续反击 interval 迁入统一循环生命周期
breaking: false
demo_ready: false
tests:
  - npm test -- test/self-guard-loop-lifecycle.test.ts test/invalidatable-task-queue.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts test/self-guard-state.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-loop-lifecycle.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-loop-lifecycle.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

`SelfGuardLoopLifecycle` 现在还按 Bot 持有持续反击 interval，提供幂等启动、查询、停止和全量释放。旧编排层的反击启动，以及无 session、超时、目标丢失、命中完成、self-guard 停止和 shutdown 清理路径，均改为调用同一 lifecycle；`retaliationLoops` Map 已移除。

## Why it matters

所有 self-guard timer 句柄现在由一个边界拥有，退出和配置停用不再分别维护反击 Map 的 clear/delete 逻辑。同 Bot 重复受伤不会启动第二条持续反击 interval，不同 Bot 的停止互不影响，这些语义可以通过注入 scheduler 离线验证。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具、配置 schema、反击阈值、250ms tick、60 秒超时、聊天文本或攻击动作。`retaliationSessions`、命中衰减、装备冷却、攻击节奏和 tick 回调仍在 `action-tools.ts`；自动化测试不代表真实服务器上的追击、攻击或控制状态已经回归。
