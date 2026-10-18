---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 领地配置从工具编排层的裸 Map 收口到独立 Config Store
breaking: false
demo_ready: false
tests:
  - npm test -- test/territory-config-store.test.ts test/chat-config-reload.test.ts test/territory-presence.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/config/territory-config-store.ts
  - src/tools/action-tools.ts
  - test/territory-config-store.test.ts
  - test/chat-config-reload.test.ts
  - src/config/README.md
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增 `TerritoryConfigStore`，按 Bot 管理领地配置默认值、输入/输出副本、替换和删除。`action-tools.ts` 的持久化投影、热重载、配置工具、地点删除、记忆清空和状态查询改为委托该 Store；配置热重载测试补充完整恢复、半径/地点替换和 Agent 配置删除后的默认值断言。

## Why it matters

领地配置不再由最大工具编排文件中的裸 Map 隐式拥有，配置生命周期和数组引用边界可以独立测试。持久化配置与瞬时入侵 presence 保持分离，为后续迁移 warning/escalation 运行时状态留下明确边界，同时不改变现有工具和文件契约。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。它只迁移领地配置的内存所有权；参数归一化、Agent 持久化组合、地点联动、`territoryPresence`、警告冷却、升级战斗和完整 TerritoryRuntime 仍未迁移。本轮不改变 MCP/Web/JSON 字段或游戏行为，也不能替代真实服务器上的领地警告与升级验收。
