---
type: refactor
scope: runtime
audience: developer
summary: Agent 紧凑状态摘要改为完全读取 Adapter 快照
breaking: false
demo_ready: false
tests: npx tsx --test test/agent-tool-executors.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm test; npm run build; git diff --check
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

Agent 内部 `observe.self` 使用的紧凑状态摘要移除了 `getActiveBotOrThrow()` 和原生 `bot.health` / `bot.food` 兜底。生命、饥饿、背包、附近玩家和实体均来自 `BotRuntime` Adapter 快照；缺失或非有限的可选 vitals 显示为 `unknown`，其余上下文继续生成。

## Why it matters

Planner 和 Skill 的状态投影不应因为两个可选字段而依赖 Mineflayer 具体对象。部分可用快照继续产生保守上下文，也比把整段状态错误降级为 `state=unavailable` 更适合未来 Modded Client Adapter。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。Mineflayer 正常状态下的摘要字段、数值格式、排序、背包选择和 Agent 工具 ID 均保持不变；MCP `observe.self` 的 JSON schema、handler 和不可用错误不在本轮修改。真实 planner 调用仍需按手测文档验证。
