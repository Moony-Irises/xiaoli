---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent task progress 节流状态收口到 HierarchicalAgentRuntime
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-blackboard.test.ts test/agent-executor-integration.test.ts test/agent-executor-lifecycle.test.ts test/chat-config-reload.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/agent/runtime.ts
  - src/agent/README.md
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/agent-blackboard.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
---

## What changed

将 `action-tools.ts` 中用于 `task_progress` 去重与 1200ms 节流的裸 Map 迁入 `HierarchicalAgentRuntime`。Runtime 提供只读判定、成功发布后的时间记录和显式清理；Supervisor 的按 Bot 清理不会为不存在的 Bot 创建运行时。事件仍由 `action-tools.ts` 生成和发布。

## Why it matters

任务进度的短期协调状态现在和 Agent 黑板、任务 timeout、tick 冷却位于同一运行时所有权边界，任务切换、详情变化、严格冷却边界、时钟回退和配置删除可以独立验证，同时避免改变事件发布顺序和失败语义。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。它只迁移 task progress 节流状态，不迁移任务生命周期、事件总线、planner 请求/执行或完整 Agent tick；MCP/Web/JSON、事件 payload、持久化和游戏行为保持不变。
