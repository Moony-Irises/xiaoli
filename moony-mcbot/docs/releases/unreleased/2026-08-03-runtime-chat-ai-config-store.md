---
type: refactor
scope: runtime
audience: developer
summary: Chat AI 配置状态和运行时保留语义收口到独立 ConfigStore
breaking: false
demo_ready: false
tests:
  - npm test -- test/chat-ai-config-store.test.ts test/chat-config-reload.test.ts test/local-env.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/config/chat-ai-config-store.ts
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/chat-ai-config-store.test.ts
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增 `ChatAiConfigStore`，统一拥有 Chat AI 配置类型、注入式默认构造、运行时 Map、持久化 replace/delete、深拷贝投影和批量 prompt 更新。热重载继续保留现存 bot 的运行时 API key、聊天历史、用户冷却表和请求状态对象，并继续忽略文件中的旧 API key。`action-tools` 移除对应重复状态与转换实现，但保留原警告文本和异步生命周期。

## Why it matters

Chat AI 的持久化字段与运行时专用字段现在有了可独立测试的明确边界，环境变量和当前 prompt 通过默认值工厂注入，不会让配置模块产生启动副作用。这减少了旧编排层的状态所有权，同时为后续迁移 Agent 和 self-guard 配置提供相同模式。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具名、输入输出、`chat-configs.json` 路径或字段、环境覆盖顺序、请求队列、AbortController、listener 生命周期和游戏行为。进行中的 AI 请求仍捕获旧配置对象，若与热重载并发，其最终 `lastRequest` 可能未写回当前 Store；该既有竞争已记录但未在本轮修复。
