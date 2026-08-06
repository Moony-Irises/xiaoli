---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 反击 session 与命中衰减迁入独立状态 Store
breaking: false
demo_ready: false
tests:
  - npm test -- test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/invalidatable-task-queue.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts test/self-guard-state.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/retaliation-state-store.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/retaliation-state-store.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增纯内存 `RetaliationStateStore`，按 Bot 持有持续反击 session，并将每个攻击者的连续命中次数和最后命中时间合并为同一条记录。持续反击 tick、受伤命中累计、周期衰减和 self-guard stop 现在经由 Store 读写，旧的三张全局 Map 已移除。

## Why it matters

反击状态现在有单一所有者和可离线验证的清理边界，不会再因命中次数 Map 与时间 Map 分别维护而产生失配。session 仍保留原对象引用语义，因此迁移没有改变排队 tick 对剩余攻击次数和最近攻击时间的共享更新方式。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具、配置 schema、反击阈值、追击 timer、聊天文本或攻击动作；自动化测试不代表真实服务器上的攻击者推断、追击和命中结果已经回归。
