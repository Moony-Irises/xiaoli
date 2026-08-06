---
type: fix
scope: runtime
audience: developer
summary: Chat AI 排队任务通过配置代次失效并保留 shutdown drain 所有权
breaking: false
demo_ready: false
tests:
  - npm test -- test/invalidatable-task-queue.test.ts test/ai-request-lifecycle.test.ts test/ai-request.test.ts test/chat-ai-config-store.test.ts test/chat-config-reload.test.ts test/promise-queue.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/invalidatable-task-queue.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/invalidatable-task-queue.test.ts
  - src/config/chat-ai-config-store.ts
  - test/chat-ai-config-store.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增 `InvalidatableTaskQueue`，按 botId 串行维护 Chat AI queue tail，并用配置代次跳过尚未开始的旧任务。热重载 replace、配置删除和 `chat.ai.configure` 会推进代次；runtime stop 会关闭队列，persistence flush 通过队列自己的动态 drain 等待仍在运行的 tail。跳过回调只在时间戳仍匹配时撤销该消息写入的用户冷却，任务异常经注入回调上报且不阻塞后续任务。

## Why it matters

Chat AI 不会再在配置热重载或删除后启动捕获旧配置的排队闭包，删除配置也不会因直接移除 Map 条目而让未结束 Promise 逃逸 shutdown drain。队列和当前请求生命周期各自拥有明确边界：队列决定任务是否开始，请求 lifecycle 负责已经开始的网络请求取消与诊断回写。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具名、输入输出、配置 schema、模型 fallback 或游戏动作。配置代次变化会有意丢弃尚未开始的旧回复；已经运行的回复不由队列中止。该队列只存在于当前进程，不持久化任务、不自动重试，也不提供 exactly-once 保证。
