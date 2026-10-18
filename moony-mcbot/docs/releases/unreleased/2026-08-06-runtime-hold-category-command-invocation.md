---
type: refactor
scope: runtime
audience: developer
summary: inventory.holdByCategory 的 MCP、Web 和 Agent 入口统一经过 CommandDispatcher
breaking: false
demo_ready: false
tests:
  - npm test -- test/hold-category-command-integration.test.ts
  - npm test -- test/stop-follow-command-integration.test.ts test/eat-command-integration.test.ts test/hold-category-command-integration.test.ts test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/skill-permission-audit.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/tools/action-tools.ts
  - src/debug/debug-server.ts
  - test/hold-category-command-integration.test.ts
  - src/commands/README.md
  - src/agent/README.md
  - docs/command-invocation-design.md
  - docs/manual-testing-guide.md
---

## What changed

`inventory.holdByCategory` 成为第三个统一命令试点。MCP、Web 和 Agent 的实际执行现在共用 CommandDispatcher handler 与 `BotRuntime.holdItemByCategory()`，同时保留 MCP 枚举 schema/文本/`isError`、Web endpoint/body/HTTP/Action History，以及 Agent 的类别 trim、错误文本和成功 detail。跨入口测试覆盖正常执行、缺失 bot、非法类别和命令历史来源。

## Why it matters

库存类别切换现在可以和停止跟随、进食一样，从 Web Command History 判断请求究竟来自 MCP、Web 还是 Agent，并查看 requestId、耗时与统一终态。第三个试点还固定了一个重要兼容边界：canonical 输出必须沿用 Web 原有 `{ action: "hold-category", result }`，不能为了统一形状擅自增加字段。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。默认 17 项 Agent allowlist 没有变化，非法 Web/Agent 类别仍在入口边缘拒绝；`executed` 只表示 handler 正常返回，不代表游戏客户端已确认切换手持物。其余命令、统一权限、异步队列和游戏证据仍未迁移。
