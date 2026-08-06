---
type: feature
scope: runtime
audience: developer
summary: 停止跟随的 MCP、Web 和 Agent 入口统一经过 CommandDispatcher 并显示跨入口结果历史
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/command-dispatcher.test.ts test/debug-web-goal-dialog.test.ts test/stop-follow-command-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/commands/command-dispatcher.ts
  - src/tools/action-tools.ts
  - src/debug/debug-server.ts
  - test/command-dispatcher.test.ts
  - test/stop-follow-command-integration.test.ts
  - docs/command-invocation-design.md
---

## What changed

新增独立 CommandDispatcher，负责 Zod 输入复核、MCP/Web/Agent 调用来源、requestId、耗时、`executed` / `failed` 终态和最近 100 条内存历史。`move.stopFollow` 是首个迁移命令，三入口共用同一个领域 handler，同时保持原 MCP 文本、Web body/HTTP 错误和 Agent 成功文本。Web 面板新增 Command History 区块。

## Why it matters

停止跟随现在不再由三个入口分别解释执行结果。远程测试时可以在同一面板判断动作来自 MCP、Web 还是 Agent，并看到失败是否发生在统一命令边界，为后续权限、证据和领域拆分提供可测试入口。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。统一命令只覆盖 `move.stopFollow`；其他 Web/MCP/Agent 动作仍走原路径。`executed` 只表示 handler 正常完成，不代表服务器已确认角色静止；`accepted`、`confirmed`、`cancelled`、游戏事件证据、统一权限和持久化队列均未实现。
