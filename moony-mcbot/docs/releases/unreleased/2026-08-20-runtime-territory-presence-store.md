---
type: refactor
scope: runtime
audience: developer
summary: 将领地短期 presence 状态从 action-tools 裸 Map 收口到独立 Runtime Store
breaking: false
demo_ready: false
tests:
  - npm test -- test/territory-presence-store.test.ts test/territory-presence.test.ts test/chat-config-reload.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/runtime/territory-presence-store.ts
  - src/runtime/territory-presence.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/territory-presence-store.test.ts
  - test/territory-presence.test.ts
  - test/chat-config-reload.test.ts
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

新增 `TerritoryPresenceStore`，按 Bot 管理 `placeId:username` presence key 及 `enteredAt`、`warnedAt`、`escalatedAt` 短期状态，提供副本读写、active-key prune 和按 Bot 清理。`action-tools.ts` 的领地警告路径、配置替换和 Agent 配置删除已委托该 Store，修复了原先对带复合 key 的 presence 只按裸 `botId` 删除的问题。

## Why it matters

领地短期状态不再由最大工具编排文件隐式拥有，Bot 隔离和清理语义可以独立测试。纯入侵者匹配、领地配置、警告冷却判定、升级战斗和公共调用契约保持原边界，后续可以继续拆分完整 TerritoryRuntime。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。它只迁移 presence 内存状态所有权和清理机制，不改变游戏动作、聊天文案或冷却/升级规则；真实服务器上的玩家进入/离开、冷却重入和主人在场升级仍需按手测文档验证，完整 TerritoryRuntime 尚未完成。
