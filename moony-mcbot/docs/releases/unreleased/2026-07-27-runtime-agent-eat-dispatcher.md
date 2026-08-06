---
type: fix
scope: runtime
audience: developer
summary: 补齐 interact.eat 的 Agent 内部 dispatcher 与离线执行测试
breaking: false
demo_ready: false
tests: npx tsx --test test/agent-tool-executors.test.ts test/client-adapter-status.test.ts test/skill-permission-audit.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/agent/tool-executors.ts
  - src/agent/index.ts
  - src/agent/README.md
  - src/tools/action-tools.ts
  - test/agent-tool-executors.test.ts
  - package.json
  - docs/skill-permission-policy.md
  - docs/tool-skill-catalog-design.md
  - docs/manual-testing-guide.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增可独立测试的 Agent 进食执行函数，并将 `executeAgentToolCall()` 的 `interact.eat` 分支接到 `BotRuntime.eatFood()`。参数校验覆盖可选食物名称的类型、trim 和非空边界，失败结果与底层异常会进入原有 Agent 失败路径。

## Why it matters

显式配置 `interact.eat` 自定义权限时，Skill 不再通过 allowlist 后才因 dispatcher 缺失而失败。执行仍经过 Runtime/Adapter，因此动作证据和客户端边界保持统一。

## Demo posture / limitations

本轮是内部执行链修复，不是 install demo、已发布版本或 GA 功能。`interact.eat` 仍不在 17 项默认 allowlist，Planner 默认不可见，MCP schema 与默认 Agent 行为均未改变；游戏内效果仍需按测试积压验证。
