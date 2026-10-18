---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 库存变化事件的摘要基线收口到 HierarchicalAgentRuntime
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-blackboard.test.ts test/self-guard-state.test.ts test/self-guard-runtime-state-store.test.ts test/chat-config-reload.test.ts
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

`HierarchicalAgentRuntime` 新增按 Bot 的库存事件摘要基线，提供观察摘要与显式清理接口；Supervisor 可在不创建缺失 Runtime 的情况下清理基线。`action-tools.ts` 删除 `agentInventorySnapshots` 裸 Map，并在 Agent 配置删除和 self-guard 库存采样路径调用 Runtime。

## Why it matters

`inventory_changed` 的短期去重状态不再由大型工具编排文件隐式拥有。首次采样、重复抑制、变化、回变和配置删除可以独立测试，同时保留“先写新基线、再发布事件”的原顺序，避免同一变化在后续 tick 重复报告。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。本轮只迁移库存事件摘要基线，不迁移 Adapter 采集、摘要算法、Agent 事件发布、库存动作或持久化；真实服务器上的背包变化仍按现有 self-guard 场景验证。
