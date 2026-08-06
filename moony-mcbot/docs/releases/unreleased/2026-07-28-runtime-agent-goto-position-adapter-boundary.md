---
type: refactor
scope: runtime
audience: developer
summary: Agent 定点移动 dispatcher 不再依赖原生 Mineflayer Vec3
breaking: false
demo_ready: false
tests: npx tsx --test test/agent-tool-executors.test.ts test/position-movement.test.ts test/movement-event-routing.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/tools/action-tools.ts
  - test/agent-tool-executors.test.ts
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

Agent 内部 `move.goToPosition` 分支移到 Mineflayer 专用 dispatcher 边界之前，经过原有数值转换后直接把 `{x,y,z}` 传给既有 `goToPosition()` 安全移动链。新增回归测试使用没有可用原生 bot 句柄的 runtime 替身，验证动作仍能受理并正常结束移动任务。

## Why it matters

高层 dispatcher 不应仅为构造 Mineflayer Vec3 而访问具体客户端。普通坐标已经是项目内部定点移动契约，保留该边界能让未来 Modded Client Adapter 复用同一 Agent 动作。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。工具 ID、参数转换、错误文案、默认 `stopRadius=2.3`、返回文本、Agent task 生命周期和安全 Pathfinder 行为均未改变；`mine.collectVisible` 仍使用 Mineflayer 方块扫描与挖掘 API，真实游戏定点移动仍在手测积压中。
