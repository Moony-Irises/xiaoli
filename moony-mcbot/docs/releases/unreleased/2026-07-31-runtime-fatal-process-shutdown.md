---
type: fix
scope: runtime
audience: developer
summary: 未处理进程异常和启动失败现在复用幂等退出流程并锁定失败退出码
breaking: false
demo_ready: false
tests: npx tsx --test test/process-lifecycle.test.ts test/runtime-shutdown-lifecycle.test.ts; npm run lint; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/process-lifecycle.ts
  - src/runtime/shutdown-lifecycle.ts
  - src/main.ts
  - test/process-lifecycle.test.ts
  - test/runtime-shutdown-lifecycle.test.ts
  - package.json
  - src/runtime/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增可注入的进程 shutdown coordinator，把 `SIGINT`、`SIGTERM`、未处理 Promise、未捕获异常和启动失败接到现有幂等生命周期。fatal 会立即将退出码锁为 `1`，重复触发只运行一次清理；关闭 Web listener 与停止 action runtime 同时起步，后续 bot 断开、持久化和 MCP 关闭仍保持顺序执行。

## Why it matters

此前顶层异常处理器只写日志，Node 会继续保留 bot、定时器和动作循环；活动 Web 请求也可能延迟动作停止。现在 fatal 不会恢复正常运行，且 signal 关闭过程中出现的晚到异常也不会把结果错误地标为成功。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA，不修改 MCP 工具、配置文件、环境变量或 JSON schema。自动化测试验证协调逻辑和 shutdown 调用顺序，但没有在真实游戏中故意制造进程崩溃；`SIGKILL`、断电和操作系统崩溃仍无法运行清理 hook。
