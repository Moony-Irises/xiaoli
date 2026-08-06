---
type: refactor
scope: runtime
audience: developer
summary: 收紧旧可见方块扫描与采矿寻路的 Mineflayer 和 Pathfinder 类型边界
breaking: false
demo_ready: false
tests: npx tsx --test test/pathfinder-movement-profile.test.ts test/mining-approach.test.ts test/client-adapter-mining.test.ts test/mcp-tool-registration.test.ts test/focus-perception.test.ts; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/tools/action-tools.ts
  - src/runtime/README.md
  - docs/mining-adapter-migration-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

旧 `GoalNear`、Movements、位置等待、可见方块扫描和最近目标选择改用 Mineflayer/Pathfinder 正式类型；Movements 缓存从 bot 动态字段改为实例级 `WeakMap`。玩家附近清矿、Agent/MCP 批量采矿、`block.findVisible` 和 focus 调用移除动态 bot 强转，并将射线与工具选择的旧接口偏差集中到两个局部 `unknown` 桥。本轮移除 24 处显式 `any` 文本命中。

## Why it matters

旧批量链虽然尚未迁入 Adapter，但此前将 Bot、Block、位置、Pathfinder 模块和排序元素全部视为动态对象，任何上游字段漂移都只能在真实游戏中暴露。现在大部分兼容链受 strict typecheck 约束，且不再污染 Mineflayer bot 实例。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，不改变 MCP schema、扫描半径、数量、排序、射线步长、路径安全 profile、超时、停止原因或挖掘流程。它不代表可见扫描或批量采矿已迁入 ClientAdapter，三个旧批量入口仍需要真实服务器回归；`mineflayer-mining.ts` 的 effects 类型偏差也仍待独立修复。
