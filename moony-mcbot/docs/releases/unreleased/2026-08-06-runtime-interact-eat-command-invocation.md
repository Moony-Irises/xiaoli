---
type: refactor
scope: runtime
audience: developer
summary: interact.eat 的 MCP、Web 和 Agent 入口统一经过 CommandDispatcher 并写入跨入口历史
breaking: false
demo_ready: false
tests:
  - npm test -- test/command-dispatcher.test.ts test/agent-tool-executors.test.ts test/stop-follow-command-integration.test.ts test/eat-command-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/tools/action-tools.ts
  - test/eat-command-integration.test.ts
  - src/commands/README.md
  - src/agent/README.md
  - docs/command-invocation-design.md
  - docs/manual-testing-guide.md
---

## What changed

`interact.eat` 成为继 `move.stopFollow` 之后第二个统一命令试点。MCP、Web 和 Agent 的实际执行现在共用 CommandDispatcher handler 与 `BotRuntime.eatFood()`，同时保留原 MCP schema/文本/`isError`、Web endpoint/body/action history，以及 Agent 参数校验和成功/失败文本。跨入口集成测试覆盖三种 source 的正常与错误路径。

## Why it matters

进食动作现在可以在 Web Command History 中按来源、requestId、耗时和终态排查，不再只能分别猜测 MCP、Web 或 Agent 是否触发到了 Runtime。这为继续迁移其他低风险 Adapter 动作提供了第二份兼容样例。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。`interact.eat` 仍不在默认 Agent allowlist，其他命令和统一权限尚未迁移；`executed` 只表示 handler 正常返回，不代表服务器确认食物已吃下，游戏内效果仍需按手动测试文档验证。
