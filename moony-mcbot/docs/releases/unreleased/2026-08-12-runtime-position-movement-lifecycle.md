---
type: refactor
scope: runtime
audience: developer
summary: 将定点移动的定时器与事件订阅收敛到独立运行时生命周期
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/position-movement-lifecycle.test.ts
  - npx tsx --test --import ./scripts/test-setup.ts test/position-movement-lifecycle.test.ts test/position-movement.test.ts test/agent-tool-executors.test.ts test/movement-event-routing.test.ts test/self-guard-loop-lifecycle.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/position-movement-lifecycle.ts
  - src/tools/action-tools.ts
  - test/position-movement-lifecycle.test.ts
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

定点移动原先由 `action-tools.ts` 的两张 Map 分别持有 interval 和 movement subscription，现已收敛到 `PositionMovementLifecycle`。普通停止、self-guard 停止和进程 shutdown 保留原有清理顺序；新增测试覆盖当前句柄判定、替换边界、异常语义和两阶段 shutdown。

## Why it matters

定点移动的资源释放现在有单一所有者，迟到的 Promise 或 movement event 仍只能通过当前 interval 句柄和 `MovementIntentStore` 的相关 key 影响当前任务。后续拆分 MovementRuntime 时可以复用这条边界，而不必让业务入口继续维护成对的生命周期 Map。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增游戏动作或改变公开工具参数；生命周期不执行 Pathfinder、Adapter、任务结算或停止移动。真实服务器上的绕障、途中封路、主动停止、断线重连和游戏内静止仍需按手动测试指南验证。
