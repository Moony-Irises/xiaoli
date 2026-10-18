---
type: refactor
scope: runtime
audience: developer
summary: 将持续对决的定时器、会话与事件订阅收敛到独立运行时生命周期
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/duel-session-lifecycle.test.ts
  - npx tsx --test --import ./scripts/test-setup.ts test/duel-session-lifecycle.test.ts test/duel-session.test.ts test/agent-tool-executors.test.ts test/mcp-tool-registration.test.ts test/client-adapter-entity-actions.test.ts test/client-adapter-status.test.ts test/movement-event-routing.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/duel-session-lifecycle.ts
  - src/tools/action-tools.ts
  - test/duel-session-lifecycle.test.ts
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

持续对决原先由 `action-tools.ts` 的三张 Map 分别持有 interval、session 元数据和 entity/movement subscription，现已收敛到 `DuelSessionLifecycle`。普通停止和进程 shutdown 保留原清理顺序与异常边界；新增测试覆盖 session 更新、双订阅顺序、清理失败、资源替换和两阶段 shutdown。

## Why it matters

对决资源现在有单一所有者，状态查询、tick 更新和资源释放不再跨三张 Map 协调。后续拆分 DuelRuntime 时，可以在不改变目标选择、追击/攻击和任务结算的前提下复用这条生命周期边界。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增游戏行为或改变 `combat.challengeEntity` 参数与返回；生命周期不选择目标、不执行 tick、追击、攻击、聊天或任务结算。真实服务器上的目标死亡、自身死亡、目标丢失、追击失败、断线重连和游戏内停止仍需按手动测试指南验证。
