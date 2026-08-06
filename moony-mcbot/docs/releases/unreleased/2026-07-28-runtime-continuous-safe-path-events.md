---
type: feature
scope: runtime
audience: developer
summary: 安全移动会关联并报告首轮成功后的持续路径失败
breaking: true
demo_ready: false
tests: npx tsx --test test/client-adapter-conformance.test.ts test/client-adapter-entity-actions.test.ts test/client-adapter-status.test.ts test/movement-event-routing.test.ts test/duel-session.test.ts test/follow-session.test.ts test/position-movement.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/runtime/movement-event-routing.ts
  - src/tools/action-tools.ts
  - test/client-adapter-conformance.test.ts
  - test/client-adapter-entity-actions.test.ts
  - test/client-adapter-status.test.ts
  - test/movement-event-routing.test.ts
  - docs/movement-event-contract-design.md
  - docs/manual-testing-guide.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

`ClientAdapter` 新增标准化 `subscribeMovementEvents()`，`moveTo()` 与 `pursueEntity()` 输入新增可选 `movementId`。Mineflayer 首轮路径成功后会继续监听重规划；后续 `noPath`、`timeout` 或长绕行先停止移动，再发送一次关联失败。`BotRuntime` 将异步失败写入 Adapter action history，定点移动、跟随和决斗只消费当前任务 ID。

## Why it matters

首轮路径成功不代表后续世界状态不会变化。持续监听使途中封路和动态追击重规划失败能够进入后台证据及任务生命周期；关联 ID 防止旧目标的迟到失败误停新任务。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。新增订阅方法会要求其他 `ClientAdapter` 实现同步实现，因此标记为 breaking；MCP schema、Tool Catalog、Planner allowlist 和现有 `ActionResult` 未变。离线测试不能证明真实服务器 Pathfinder 在所有封路时机都会产生预期事件，仍需按手测文档回归。
