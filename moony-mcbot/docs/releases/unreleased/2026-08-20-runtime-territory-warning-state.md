---
type: refactor
scope: runtime
audience: developer
summary: 将领地警告冷却与升级条件抽成可测试的纯状态判定
breaking: false
demo_ready: false
tests:
  - npm test -- test/territory-warning-state.test.ts test/territory-presence-store.test.ts test/territory-presence.test.ts test/chat-config-reload.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/runtime/territory-warning-state.ts
  - src/runtime/territory-presence-store.ts
  - src/runtime/territory-presence.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/territory-warning-state.test.ts
  - test/territory-presence-store.test.ts
  - test/territory-presence.test.ts
  - src/config/README.md
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
---

## What changed

新增纯 `evaluateTerritoryWarning()` 状态判定，根据当前时间、警告冷却、升级配置、主人在场和已有 presence 返回 `warn`、`hold_escalation`、`escalate` 或 `none`，并在需要时返回下一状态。`maybeHandleTerritoryWarning()` 改为消费该决策，同时保留 Store 写回、聊天、Agent 事件和 `startDuel` 副作用。

## Why it matters

首次警告、严格冷却边界、升级延迟、主人策略、重复升级和损坏时间状态现在可以离线验证。判定仍保持旧代码的分支优先级：冷却到期先警告，升级只在后续未警告的 tick 检查；旧 falsy `escalatedAt` 语义也继续兼容。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。它只迁移领地警告/升级条件，不迁移配置、玩家采集、状态写回、聊天、事件、决斗或公共 MCP/Web/JSON 契约。真实服务器上的多人进入/离开、冷却重入和主人在场升级仍需手测，完整 TerritoryRuntime 尚未完成。
