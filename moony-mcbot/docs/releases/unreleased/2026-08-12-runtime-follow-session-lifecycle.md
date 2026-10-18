---
type: refactor
scope: runtime
audience: developer
summary: 将跟随会话的定时器、订阅和 session 状态收敛到独立生命周期模块
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/follow-session-lifecycle.test.ts
  - npx tsx --test test/follow-session.test.ts test/follow-session-lifecycle.test.ts test/stop-follow-command-integration.test.ts test/agent-tool-executors.test.ts test/mcp-tool-registration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/follow-session-lifecycle.ts
  - src/runtime/interval-scheduler.ts
  - src/tools/action-tools.ts
  - test/follow-session-lifecycle.test.ts
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

跟随 interval、session 元数据和 movement subscription 的资源所有权已迁入 `FollowSessionLifecycle`。`action-tools.ts` 继续负责跟随启动顺序、tick、路径缓存、任务结算、事件发布、停止移动和玩家提示；普通停止与进程 shutdown 的旧清理顺序保持不变。新增生命周期单元测试覆盖查询、清理顺序、异常边界和 shutdown 分阶段释放。

## Why it matters

跟随资源不再由三个分散的 Map 分别维护，后续可以独立验证资源释放并降低 `action-tools.ts` 的状态所有者数量。后台排查时，停止和进程退出的资源边界也有明确的测试与文档契约。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增游戏行为；`FollowSessionLifecycle` 不执行寻路、停止移动、聊天或任务结算。真实服务器上的跟随、不可达地形、断线重连和游戏内静止仍需按手动测试指南验证。为保持兼容，单 bot 订阅清理抛错和 shutdown 后 session 元数据保留的旧语义本轮没有修复。
