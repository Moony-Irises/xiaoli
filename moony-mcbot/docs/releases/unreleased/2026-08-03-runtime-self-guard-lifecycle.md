---
type: fix
scope: runtime
audience: developer
summary: Self-guard 受伤订阅与排队任务不再跨配置代次使用旧配置
breaking: false
demo_ready: false
tests:
  - npm test -- test/invalidatable-task-queue.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts test/self-guard-state.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-hurt-subscriptions.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-hurt-subscriptions.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增 `SelfGuardHurtSubscriptionRegistry`，按 Bot 管理 Mineflayer `entityHurt` emitter/listener，并在事件发生时按 botId 获取当前 self-guard 配置。主周期与持续反击周期同样改为每次执行时读取当前 Store。自动进食和反击 Promise 改由独立 `InvalidatableTaskQueue` 串行管理；配置 replace、configure、停用或删除会失效尚未开始的旧任务，runtime stop 会关闭并 drain 队列。

## Why it matters

热重载替换 `SelfGuardConfig` 对象后，同一原生 Bot 的旧受伤 handler 不会继续按旧阈值或旧反击开关行动。配置删除也不再通过移除 Promise Map 条目丢失 shutdown tail 所有权。重连 emitter 替换、重复绑定和 listener 清理由单一边界负责，不会移除其他模块注册的事件监听器。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP 工具、配置 schema、聊天文本或公共 `ClientEntityEvent`；`entityHurt` 数据源和原生反击实现仍属于 Mineflayer 兼容边界。配置代次只跳过尚未开始的任务，已经运行的短任务不会被强制中断；self-guard interval 与反击业务仍在 `action-tools.ts`，尚未形成完整 `GuardRuntime`。
