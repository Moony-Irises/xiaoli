---
type: fix
scope: runtime
audience: developer
summary: 配置和聊天短期记忆改用原子写入，并在进程退出前显式等待持久化
breaking: false
demo_ready: false
tests: npx tsx --test test/atomic-json-file.test.ts test/chat-memory-persistence.test.ts test/promise-queue.test.ts test/runtime-shutdown-lifecycle.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/atomic-json-file.ts
  - src/runtime/promise-queue.ts
  - src/runtime/shutdown-lifecycle.ts
  - src/memory/chat-memory.ts
  - src/tools/action-tools.ts
  - src/main.ts
  - test/atomic-json-file.test.ts
  - test/chat-memory-persistence.test.ts
  - test/promise-queue.test.ts
  - test/runtime-shutdown-lifecycle.test.ts
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
  - docs/architecture-convergence-roadmap.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增同目录临时文件、文件 sync、关闭后 rename 和失败清理的公共 JSON writer，并迁移 `chat-configs.json` 与 `chat-summary-state.json`。新增队列 drain 和幂等关闭协调器；`SIGINT` / `SIGTERM` 会停止 action watchdog、动作循环、订阅与模型请求，断开 bot，依次等待动作侧和聊天记忆侧持久化，再关闭 MCP。

## Why it matters

此前直接覆盖 JSON，进程在写入中退出时可能留下截断文件；主入口也没有等待异步配置、日志和短期聊天记忆队列。现在普通终止信号下可完成可预测的关闭，异常写入不会破坏上一份完整 JSON。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能，也没有修改 MCP schema、文件路径或现有 JSON 字段。`chat-summary-state.json` 继续使用 `version: 1`；`chat-configs.json` 尚未增加顶层版本，需另行确认兼容策略。`SIGKILL`、断电和系统崩溃无法执行 flush，真实进程 `Ctrl+C` 重启恢复仍列在手测文档中。
