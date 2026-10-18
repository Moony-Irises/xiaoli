---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 玩家地点及共享基线状态从工具编排层收口到独立 Memory Store
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-game-memory-state-store.test.ts test/chat-config-reload.test.ts test/shared-game-memory-store.test.ts test/idle-social-policy.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/memory/agent-game-memory-state-store.ts
  - src/tools/action-tools.ts
  - test/agent-game-memory-state-store.test.ts
  - test/chat-config-reload.test.ts
  - src/memory/README.md
  - src/config/README.md
  - docs/shared-memory-plan.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增 `AgentGameMemoryStateStore`，按 Bot 管理玩家/地点工作集并维护共享基线，统一负责记录副本、持久化快照替换、严格较新导入、跨 Bot 聚合、清空和删除。`action-tools.ts` 的配置恢复、共享文件导入、记忆工具和配置删除路径改为委托该 Store；配置热重载测试补充玩家与地点恢复及删除断言。

## Why it matters

玩家/地点状态不再由最大工具编排文件中的四张裸 Map 隐式拥有，内存合并规则和复制边界可以独立测试。后续可继续迁移 Agent 持久化组合和 territory 联动，而不改变现有工具名称、返回字段、共享文件 schema 或游戏行为。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。它只收口玩家/地点及共享基线的内存所有权；输入归一化、时间戳生成、`chat-configs.json` 与共享文件双写队列、territory、战略目标、任务历史持久化组合、planner 请求/执行和完整 Agent tick 仍未迁移。`players.json` / `places.json` 继续使用 `version: 1`，Voice 仍只读共享文件，本轮不替代真实重启或服务器验收。
