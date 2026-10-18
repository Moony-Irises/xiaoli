---
type: refactor
scope: runtime
audience: developer
summary: 将限时直接行走的停止计时器收敛到独立运行时生命周期
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/walk-timer-lifecycle.test.ts
  - npm test -- test/walk-timer-lifecycle.test.ts test/walk-command-integration.test.ts test/agent-tool-executors.test.ts test/mcp-tool-registration.test.ts test/client-adapter-conformance.test.ts test/client-adapter-status.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/timeout-scheduler.ts
  - src/runtime/walk-timer-lifecycle.ts
  - src/tools/action-tools.ts
  - test/walk-timer-lifecycle.test.ts
  - test/walk-command-integration.test.ts
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

`movement.walk` 原先由 `action-tools.ts` 的裸 Map 持有每个 Bot 的停止 timeout，现已收敛到 `WalkTimerLifecycle`。Agent 与 MCP 两个创建点、普通停止和进程 shutdown 共用同一资源所有者；新增测试覆盖登记、到期顺序、同步失败、幂等停止、覆盖兼容语义和全量清理。

## Why it matters

限时直接行走不再由入口编排文件直接协调 timeout 句柄，进程关闭也能通过一个明确边界释放已登记资源。后续拆分 MovementRuntime 时，可以继续复用该生命周期，而不改变 Adapter 动作和入口协议。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增游戏行为，没有改变 `movement.walk` / `movement.stop` 参数、返回文本或默认 Agent 权限。生命周期不提供地形前视、落差保护或服务器动作确认；真实游戏中的到期停止、手动停止和 shutdown 仍需在安全封闭区域按手动测试指南验证。
