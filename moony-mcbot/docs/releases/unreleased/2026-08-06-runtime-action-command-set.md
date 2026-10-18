---
type: refactor
scope: runtime
audience: developer
summary: 四个 canonical 动作命令集中到独立 ActionCommandSet 模块
breaking: false
demo_ready: false
tests:
  - npm test -- test/action-command-set.test.ts
  - npm test -- test/action-command-set.test.ts test/command-dispatcher.test.ts test/stop-follow-command-integration.test.ts test/eat-command-integration.test.ts test/hold-category-command-integration.test.ts test/open-door-command-integration.test.ts test/mcp-tool-registration.test.ts test/tool-catalog.test.ts test/client-adapter-conformance.test.ts test/skill-permission-audit.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/commands/action-command-set.ts
  - src/tools/action-tools.ts
  - test/action-command-set.test.ts
  - src/commands/README.md
  - docs/command-invocation-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

`move.stopFollow`、`interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 的 canonical schema、输出守卫、CommandDispatcher 注册和 typed invocation 从 `action-tools.ts` 迁入 `src/commands/action-command-set.ts`。新模块只依赖最小 Runtime 接口，并通过构造参数接收原有停止跟随回调；MCP、Web 和 Agent 入口改为调用同一个 typed command set。

## Why it matters

命令定义现在有明确的 commands 层所有者，不再和聊天、Agent、自保、战斗及采矿编排混在巨型入口文件中。直接模块测试固定了四个 handler 的精确输出、依赖调用、source/requester 历史和失败记录，同时原三入口集成测试继续保护兼容行为。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增命令、Web endpoint、Agent 权限或游戏能力，四个入口的公开 schema、文本、HTTP 和错误语义均保持不变。停止跟随的 session/task/Pathfinder 状态仍由 `action-tools.ts` 持有并通过回调注入；`executed` 仍只表示 handler 正常返回，不代表服务器确认动作完成，其余命令也尚未迁移。
