---
type: refactor
scope: runtime
audience: developer
summary: 将聊天订阅与监听 watchdog 收口到 ChatListenerLifecycle
breaking: false
demo_ready: false
tests:
  - npm test -- test/chat-listener-lifecycle.test.ts test/chat-listener-lifecycle-integration.test.ts test/chat-event-dedup.test.ts test/chat-config-reload.test.ts test/chat-listener-config-store.test.ts test/client-adapter-conformance.test.ts test/client-adapter-lifecycle.test.ts test/agent-executor-integration.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/runtime/chat-listener-lifecycle.ts
  - src/runtime/README.md
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/chat-listener-lifecycle.test.ts
  - test/chat-listener-lifecycle-integration.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
---

## What changed

新增 `ChatListenerLifecycle`，按 Bot 持有当前 Runtime 引用和聊天订阅的 `unsubscribe` 回调，并统一拥有单例监听 watchdog。`action-tools.ts` 使用该生命周期替换原 `chatHandlers` Map 与 `listenerWatchdogTimer`，继续负责配置、消息处理、去重、重连协调和具体聊天行为。

## Why it matters

聊天监听的资源所有权、替换顺序、解绑失败和 shutdown 错误隔离现在有独立且可测试的边界。MCP 接线回归同时确认重复启用不会创建重复订阅，停用会解除实际订阅并更新 `attached` 状态。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。本轮不新增聊天能力，不改变 MCP/Web schema、配置路径、持久化格式、回复文案或游戏动作；真实服务器聊天回显、重复消息和断线重连仍需手动验证，完整 ChatRuntime 也尚未从 `action-tools.ts` 拆出。
