---
type: refactor
scope: runtime
audience: developer
summary: 将领地 presence、警告状态与副作用调用顺序收口到 TerritoryRuntime
breaking: false
demo_ready: false
tests:
  - npm test -- test/territory-runtime.test.ts test/territory-warning-state.test.ts test/territory-presence-store.test.ts test/territory-presence.test.ts test/chat-config-reload.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/runtime/territory-runtime.ts
  - src/runtime/territory-presence.ts
  - src/runtime/territory-presence-store.ts
  - src/runtime/territory-warning-state.ts
  - src/runtime/README.md
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/territory-runtime.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
---

## What changed

新增 `TerritoryRuntime`，由它组合 Adapter 玩家快照的 presence 判定、按 Bot 短期状态、active-key prune、警告/升级状态转移和同步副作用 hooks。`action-tools.ts` 改为只采集配置、记忆地点与玩家快照，并注入既有警告聊天、Agent 事件和 `startDuel` 实现；配置替换或删除也通过 Runtime 清理短期状态。

## Why it matters

领地 tick 的状态所有权和副作用顺序不再散落在大型工具编排文件中。首次警告、冷却优先、主人不在时等待、升级、离开重入、多 Bot 清理，以及 hook 抛错时已经写入的状态都可以离线验证，同时保留原 handled 布尔、事件文案、决斗目标和异常顺序。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。它只收口领地运行时协调，不迁移领地配置/记忆持久化，也不让 Runtime 直接操作 Bot；聊天、事件和决斗仍由 `action-tools.ts` hooks 实现。真实服务器上的玩家进入/离开、警告可见性和升级战斗仍需按手测文档验证，公共 MCP/Web/JSON 与游戏行为没有改变。
