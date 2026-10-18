---
type: refactor
scope: runtime
audience: developer
summary: 将旧采矿串行任务 tail 收口到 MiningTaskQueue
breaking: false
demo_ready: false
tests:
  - npm test -- test/mining-task-queue.test.ts test/mining-approach.test.ts test/pathfinder-movement-profile.test.ts test/client-adapter-mining.test.ts test/mineflayer-inventory.test.ts test/mcp-tool-registration.test.ts test/agent-tool-executors.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/runtime/mining-task-queue.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/mining-task-queue.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/persistence-lifecycle-design.md
  - docs/manual-testing-guide.md
---

## What changed

新增 `MiningTaskQueue`，按 Bot 持有旧采矿执行链的串行 Promise tail，并向调用方原样回传任务结果或异常。`action-tools.ts` 使用该队列替换顶层 `miningTasks` Map，shutdown 继续等待调用时已登记任务的一次快照。

## Why it matters

采矿任务的串行所有权、跨 Bot 并发、失败隔离和退出等待现在具有独立、可测试的边界。后续拆分采矿业务时不再需要依赖 `action-tools.ts` 中的裸任务 Map，同时保留现有执行顺序和错误语义。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。本轮不新增采矿能力，不改变 MCP/Web/Agent schema、返回文本、寻路或游戏动作；四条旧采矿业务链仍由 `action-tools.ts` 编排并依赖现有 Mineflayer 路径，批量采矿尚未迁入 Adapter，也没有因此完成真实游戏验收。
