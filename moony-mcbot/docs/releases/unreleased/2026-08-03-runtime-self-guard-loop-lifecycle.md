---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 主循环与 watchdog 句柄由独立生命周期对象统一管理
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

新增 `SelfGuardLoopLifecycle`，通过可注入 interval scheduler 按 Bot 管理 self-guard 主循环，并单独持有全局 watchdog。重复启动会替换旧句柄，单 Bot 停止、watchdog 停止和全量停止均为幂等操作；非法间隔会在创建 timer 前失败。`action-tools.ts` 的启动、停止、状态、watchdog reconcile 和 shutdown 已委托给该边界。

## Why it matters

主循环和 watchdog 不再由旧编排层的裸 Map 与可空 timer 变量分别管理。热重载重启、运行状态查询和退出清理现在共享同一个所有权来源，降低重复 clear/delete 和漏清理风险；注入 scheduler 后，替换与释放语义可以脱离真实时间稳定测试。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具、JSON schema、配置路径、守卫阈值、聊天文本或游戏行为。主 tick 回调、持续反击 interval、Bot reconcile 规则和其他守卫状态仍在 `action-tools.ts`，因此这不是完整 `GuardRuntime`，也不能替代真实服务器上的热重载与退出回归。
