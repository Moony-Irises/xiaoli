---
type: refactor
scope: runtime
audience: developer
summary: interact.openDoor 的 MCP、Web 和 Agent 入口统一经过 CommandDispatcher
breaking: false
demo_ready: false
tests:
  - npm test -- test/open-door-command-integration.test.ts
  - npm test -- test/command-dispatcher.test.ts test/stop-follow-command-integration.test.ts test/eat-command-integration.test.ts test/hold-category-command-integration.test.ts test/open-door-command-integration.test.ts test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/client-adapter-conformance.test.ts test/skill-permission-audit.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/tools/action-tools.ts
  - test/open-door-command-integration.test.ts
  - src/commands/README.md
  - src/agent/README.md
  - src/runtime/README.md
  - docs/command-invocation-design.md
  - docs/manual-testing-guide.md
---

## What changed

`interact.openDoor` 成为第四个统一命令试点。MCP、Web 和 Agent 的实际执行现在共用 CommandDispatcher handler 与 `BotRuntime.openDoor()`，同时保留 MCP 的默认值/范围 schema、成功文本/`isError`、Web endpoint/body/HTTP/Action History，以及 Agent 的 `Number(...)` 参数转换和成功 fallback。跨入口测试覆盖正常执行、缺失 bot、Agent 字符串数值、默认值和 Web 省略参数。

## Why it matters

开门动作现在可以从 Web Command History 判断请求来自 MCP、Web 还是 Agent，并查看 requestId、耗时与统一终态。该试点也明确了 canonical schema 的兼容职责：共享执行层不能把 MCP 专属的严格范围静默施加到历史上更宽松的 Web/Agent 入口。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。默认 17 项 Agent allowlist 没有变化；`executed` 只表示 handler 正常返回，不代表服务器已确认门状态变化。Agent 非数值字符串仍沿用 `Number(...) -> NaN` 的旧行为，本轮仅为兼容保留，未完成参数治理。活板门、栅栏门、红石门、锁门和模组门的特殊逻辑仍不在本轮能力范围，其余命令、统一权限和游戏证据也尚未迁移。
