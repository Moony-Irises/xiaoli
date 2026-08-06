---
type: refactor
scope: runtime
audience: developer
summary: 空闲跟随主人策略改用 Adapter 自身与玩家快照
breaking: false
demo_ready: false
tests: npx tsx --test test/idle-follow-policy.test.ts test/self-location.test.ts test/follow-session.test.ts test/position-movement.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/idle-follow-policy.ts
  - src/tools/action-tools.ts
  - test/idle-follow-policy.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯空闲跟随决策器，固定 4.5 格开始跟随、8 格外允许冲刺和主人不可见时 3.5 格外退回记忆地点的既有规则。`follow_owner` 执行路径改读 `BotRuntime.getSelfState()` 与 `getPlayerSnapshot()`，并把普通地点坐标交给已有安全定点移动链。

## Why it matters

空闲策略属于高层编排，不应遍历 Mineflayer 玩家表或依赖原生 Vec3 构造器。使用 Adapter 快照后，未来 Modded Client Bridge 能复用相同决策，同时阈值边界可在没有 Minecraft 的环境中回归。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。配置结构、默认跟随参数、记忆地点选择、事件文案、MCP schema 和安全寻路实现均未改变；`socialize_whitelist` 的按世界坐标观察尚未进入当前 Adapter，真实游戏中的待命、追随、冲刺和地点回退仍需手动验收。
