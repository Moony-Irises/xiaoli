---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent executor 的循环与串行运行 tail 收敛到独立生命周期
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-executor-lifecycle.test.ts
  - npm test -- test/agent-executor-lifecycle.test.ts test/agent-executor-integration.test.ts test/agent-config-store.test.ts test/chat-config-reload.test.ts test/invalidatable-task-queue.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/agent-executor-lifecycle.ts
  - src/tools/action-tools.ts
  - test/agent-executor-lifecycle.test.ts
  - test/agent-executor-integration.test.ts
  - src/agent/README.md
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

Agent executor 原先由 `action-tools.ts` 的两张裸 Map 分别持有每个 Bot 的 interval 和串行 Promise tail，现已收敛到 `AgentExecutorLifecycle`。状态投影、配置删除、热重载、shutdown 和 persistence flush 都改读同一资源所有者；新增测试覆盖 loop 登记与替换、同 Bot 串行、跨 Bot 并行、异常隔离、run 遗忘和 shutdown 行为，并通过 MCP handler 验证 `auto` / `manual` / shutdown 的公开状态投影。

## Why it matters

Agent 周期执行不再由大型入口编排文件直接管理 timer 与 Promise 链，资源边界和退出等待条件更明确。后续拆分 AgentRuntime 时，可以在不改变 planner、Skill 或工具执行契约的前提下继续迁移业务编排。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增游戏行为，没有改变 MCP/Web/Agent 字段、计划冷却或工具执行节奏。普通停止与 shutdown 不取消已开始/已排队任务，配置删除只遗忘当前 tail，flush 只等待调用时仍被跟踪的 Promise 快照；可取消执行和动态 drain 仍未实现。
