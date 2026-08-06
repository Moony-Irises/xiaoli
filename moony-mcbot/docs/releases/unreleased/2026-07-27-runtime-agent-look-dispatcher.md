---
type: fix
scope: runtime
audience: developer
summary: 补齐 player.look 的 Agent 内部 dispatcher 与严格参数校验
breaking: false
demo_ready: false
tests: npx tsx --test test/agent-tool-executors.test.ts test/skill-permission-audit.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/agent/tool-executors.ts
  - src/agent/README.md
  - src/tools/action-tools.ts
  - test/agent-tool-executors.test.ts
  - docs/skill-permission-policy.md
  - docs/tool-skill-catalog-design.md
  - docs/manual-testing-guide.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增 `player.look` 的 Agent 执行函数和 dispatcher 分支。执行前要求 `yaw/pitch` 为有限数字，`force` 为可选布尔值并默认 `true`；动作复用 `BotRuntime.look()`，底层 `ok: false` 与异常会进入原有 Agent 失败路径。

## Why it matters

显式配置 `player.look` 自定义权限时，Social Skill 不会再通过 allowlist 后才因 dispatcher 缺失或参数隐式转换而失败。执行仍经过 Runtime/Adapter，可继续产生统一动作证据。

## Demo posture / limitations

本轮是内部执行链修复，不是 install demo、已发布版本或 GA 功能。`player.look` 仍不在 17 项默认 allowlist，Planner 默认不可见，MCP schema 未变；在加入确定性的战略动作注入入口前，游戏侧 Agent dispatcher 验证保持暂缓。
