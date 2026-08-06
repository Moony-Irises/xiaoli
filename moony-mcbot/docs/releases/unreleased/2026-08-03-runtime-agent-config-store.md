---
type: refactor
scope: runtime
audience: developer
summary: Agent 核心配置和 planner 运行态保留收口到独立 ConfigStore
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-config-store.test.ts test/chat-config-reload.test.ts test/persisted-chat-config-repository.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/config/agent-config-store.ts
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/agent-config-store.test.ts
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增 `AgentConfigStore`，统一拥有 Agent 核心配置类型、默认构造、运行时 Map、持久化归一化、replace/delete 与核心快照。热重载会保留运行时 planner API key、最近规划时间/摘要/结果和请求诊断对象，旧配置文件中的 `plannerApiKey` 继续忽略；`action-tools` 仍把 Store 快照与战略目标、记忆、任务历史和领地组合成原有 `agentByBotId` 文档。

## Why it matters

Agent 核心配置现在可以脱离 Bot、黑板和游戏 runtime 独立验证，并通过注入获得环境默认值及 Catalog allowlist 解析。旧编排层不再直接拥有第四张配置 Map，同时保持现有四表文件结构、热加载提交顺序和外部工具契约。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具名、输入输出、`chat-configs.json` 路径或字段、环境覆盖顺序、战略目标、记忆、领地和实际游戏行为。planner 请求、AbortController、executor 与黑板仍由 `action-tools` 管理；进行中请求与热重载并发时，结束诊断仍可能写回旧配置对象，该既有问题已记录但未在本轮修复。
