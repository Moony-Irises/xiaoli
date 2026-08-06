---
type: fix
scope: runtime
audience: developer
summary: Chat AI 与 planner 请求通过代次感知生命周期回写当前配置诊断
breaking: false
demo_ready: false
tests:
  - npm test -- test/ai-request-lifecycle.test.ts test/ai-request.test.ts test/chat-ai-config-store.test.ts test/agent-config-store.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/ai-request-lifecycle.ts
  - src/runtime/README.md
  - src/config/chat-ai-config-store.ts
  - src/config/agent-config-store.ts
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/ai-request-lifecycle.test.ts
  - test/chat-ai-config-store.test.ts
  - test/agent-config-store.test.ts
  - docs/persistence-lifecycle-design.md
---

## What changed

新增 `AiRequestLifecycle`，按 botId 和单调请求代次持有 Chat AI 与 planner 当前请求的 `AbortController`，区分允许终态写入的取消和禁止迟到回写的失效。Chat AI 与 Agent ConfigStore 新增窄诊断写入口；请求完成、失败和异步 Agent 执行结果改为按 botId 写入当前 Store，聊天历史裁剪改为原地更新。

## Why it matters

配置热重载替换运行时对象后，进行中的请求不会再把 `lastRequest`、`lastPlannerRequest` 或规划结果留在旧对象；新请求开始后，旧请求的迟到状态也不能覆盖较新的诊断。配置删除和 shutdown 可以中止当前信号并阻止后续回写，同时保持现有模型 fallback、planner 冷却和外部工具契约。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具名、输入输出、配置 schema、模型选择、fallback 或实际游戏行为；新请求不会为了诊断隔离而隐式中止旧请求。Chat AI Promise 队列仍在 `action-tools`，热重载或删除后，已经串入旧链但尚未开始的闭包仍可能使用旧配置运行；删除队列索引后还会逃逸 shutdown drain，后续需要独立的队列失效代次与可 drain 所有权。
