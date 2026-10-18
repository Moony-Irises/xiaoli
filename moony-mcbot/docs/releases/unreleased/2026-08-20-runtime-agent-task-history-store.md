---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 最近任务历史从工具编排层的裸 Map 收口到独立运行时 Store
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-task-history-store.test.ts test/chat-config-reload.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/runtime/agent-task-history-store.ts
  - src/tools/action-tools.ts
  - test/agent-task-history-store.test.ts
  - test/chat-config-reload.test.ts
  - src/runtime/README.md
  - src/config/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增 `AgentTaskHistoryStore`，按 Bot 管理最近任务历史，并统一负责记录复制、最近 20 条裁剪、持久化快照替换、清空与删除。`action-tools.ts` 的现有读取、写入、配置加载和清理路径改为委托该 Store，热重载集成测试补充了 `memory.taskHistory` 恢复断言。

## Why it matters

任务历史不再由最大工具编排文件中的裸 Map 隐式拥有，后续可继续迁移 Agent 记忆和持久化组合，而不改变现有任务结算时机、返回字段或文件 schema。输入与查询均复制记录，也避免调用方意外修改 Store 内部状态。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。它只收口最近任务历史的内存所有权，不迁移玩家/地点记忆、任务生命周期、planner 请求/执行、持久化队列或完整 Agent tick；没有新增游戏动作，也不能替代真实服务器验收。
