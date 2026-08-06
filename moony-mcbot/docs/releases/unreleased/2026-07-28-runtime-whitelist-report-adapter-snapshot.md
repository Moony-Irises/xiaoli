---
type: refactor
scope: runtime
audience: developer
summary: 就近白名单汇报目标改由 Adapter 玩家快照选择
breaking: false
demo_ready: false
tests: npx tsx --test test/player-selection.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/player-selection.ts
  - src/tools/action-tools.ts
  - test/player-selection.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增类型安全的纯玩家选择器，只从精确命中白名单、距离非负有限且带有效坐标的 Adapter `PlayerSnapshot` 中选择最近目标。self-guard 结束后的汇报入口改用 `BotRuntime.getNearbyPlayers()`，不再遍历原生 Mineflayer 玩家表。

## Why it matters

汇报目标选择是一个高层编排决策，不应依赖具体客户端的玩家对象和 `Vec3`。迁移后 Mineflayer 与未来 Modded Client Bridge 可以提供同一种玩家快照，同时无效或不完整快照会安全地被忽略。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。对外 MCP 参数、汇报半径、场景台词、默认权限和后续安全移动链均未改变；反击目标追踪与 self-guard 其他循环仍包含 Mineflayer 专用实现，真实游戏中的多人目标选择仍待手动验证。
