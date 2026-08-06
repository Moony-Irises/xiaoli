---
type: refactor
scope: runtime
audience: developer
summary: 地点记录、最近地点和地点移动改读 Adapter 自身位置快照
breaking: false
demo_ready: false
tests: npx tsx --test test/self-location.test.ts test/position-movement.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/self-location.ts
  - src/tools/action-tools.ts
  - test/self-location.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯 `requireSelfLocation()`，从 Adapter `SelfStateSnapshot` 校验有限坐标、规范化维度，并生成原始坐标和三位小数坐标。Web Capture Place 与 MCP `memory.place.captureHere` 共享同一实现；`memory.place.nearest` 和 `memory.place.goTo` 也不再为位置或维度读取原生 Mineflayer bot。

## Why it matters

地点记忆属于高层游戏状态，不应依赖 Mineflayer 的 `entity.position` 构造器或 `game.dimension`。统一快照读取既减少重复持久化逻辑，也让未来 Modded Client Bridge 可以复用相同地点工具。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。MCP schema、返回字段、地点持久化格式、维度冲突文案和安全定点移动入口均未改变；容器查找、容器交互与领地检测仍读取 Mineflayer 世界对象，真实游戏回归仍记录在手测文档。
