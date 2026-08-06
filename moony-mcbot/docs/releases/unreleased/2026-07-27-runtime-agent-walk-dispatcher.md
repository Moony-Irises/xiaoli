---
type: fix
scope: runtime
audience: developer
summary: 补齐 movement.walk 的 Agent dispatcher、严格参数校验与定时停止
breaking: false
demo_ready: false
tests: npx tsx --test test/agent-tool-executors.test.ts test/skill-permission-audit.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/agent/tool-executors.ts
  - src/agent/skill-catalog.ts
  - src/agent/README.md
  - src/tools/action-tools.ts
  - test/agent-tool-executors.test.ts
  - test/skill-permission-audit.test.ts
  - docs/skill-permission-policy.md
  - docs/tool-skill-catalog-design.md
  - docs/manual-testing-guide.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增 `movement.walk` 的 Agent 执行器与 dispatcher 分支，沿用 MCP 的 100-60000ms 整数时长约束，严格校验 `sprint/jump` 布尔值，`null` 不会被当作缺省值。执行会清理旧跟随和步行状态、等待并确认当前移动成功停止、启动 `BotRuntime.walkForward()`，并在时限结束后通过 Runtime 停止；初始停止失败时不会启动新移动。Wander Skill 不再使用 `Number()` / `Boolean()` 隐式转换 planner 参数。

## Why it matters

显式配置该自定义权限时，Agent 不会再因 dispatcher 缺失而失败，也不会把字符串 `"false"` 误解释成冲刺或跳跃。旧移动先停止、到时再次停止，避免一次闲逛动作无限前进。

## Demo posture / limitations

本轮是内部执行链修复，不是 install demo、已发布版本或 GA 功能。`movement.walk` 仍不在 17 项默认 allowlist，Planner 默认不可见，MCP schema 未变。底层动作仍是直接向前，没有地形前视、碰撞绕行或悬崖/大落差保护，因此不代表自动闲逛已达到安全开放标准。
