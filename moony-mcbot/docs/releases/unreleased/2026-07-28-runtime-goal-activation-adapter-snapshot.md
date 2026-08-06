---
type: refactor
scope: runtime
audience: developer
summary: 确定性跟随与记忆地点目标激活改读 Adapter 快照
breaking: false
demo_ready: false
tests: npx tsx --test test/self-location.test.ts test/follow-session.test.ts test/position-movement.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/self-location.ts
  - src/tools/action-tools.ts
  - test/self-location.test.ts
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/agent-core-chain-checklist.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

auto 战略目标中的确定性跟随激活改用 `BotRuntime.getPlayerSnapshot()` 判断玩家可见性；记忆地点激活改用 Adapter 自身位置快照完成维度检查，并直接把普通坐标交给既有安全定点移动。地点维度兼容规则被抽成纯函数，由 MCP GoTo 与 Agent 激活共同使用。

## Why it matters

目标激活属于高层编排，不应为了判断玩家是否可见或构造地点坐标而访问 Mineflayer 私有对象。统一 Adapter 快照后，未来客户端实现只需提供同一玩家和自身状态契约。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。auto/busy/queue/task 门槛、激活返回字段、事件文案、默认跟随参数、MCP schema 和持久化格式均未改变；自动采矿激活、容器和领地逻辑仍含 Mineflayer 专用世界访问，游戏内 follow/place 激活仍需回归。
