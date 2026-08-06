---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 告警冷却与上一轮观察状态迁入独立 Store
breaking: false
demo_ready: false
tests:
  - npm test -- test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/invalidatable-task-queue.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts test/self-guard-state.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-runtime-state-store.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-runtime-state-store.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增纯内存 `SelfGuardRuntimeStateStore`，用一份按 Bot 记录替代告警冷却、健康、昼夜、天气、Bot 引用、邻近玩家和 reactive flags 七张全局 Map。self-guard 信号去重、告警、周期观察、普通 stop 和配置删除现在通过 Store 读写。

## Why it matters

上一轮观察状态不再依赖七条分散的初始化和 cleanup 路径，多 Bot 数据、嵌套 reactive flags 和两级清理语义可以离线验证。普通 stop 仍保留告警冷却，只有配置条目删除才全清，因此没有静默改变重启循环后的聊天节流行为。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具、配置 schema、tick 频率、聊天文本、告警阈值或攻击动作；昼夜天气采集、tick 回调、目标推断、combat 命中/装备状态和真实服务器行为仍在旧编排层或尚未回归。
