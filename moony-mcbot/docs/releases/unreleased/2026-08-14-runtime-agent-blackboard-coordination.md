---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 任务 timeout 与 executor tick 冷却协调状态归入黑板 runtime
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-blackboard.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/agent/runtime.ts
  - src/tools/action-tools.ts
  - test/agent-blackboard.test.ts
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

`HierarchicalAgentRuntime` 现在拥有每个 Bot 的任务 timeout timer 和 executor tick 冷却门。任务 timeout 在同一 Bot 上替换旧记录，清除和过期仍通过既有黑板 timer/event 链；tick 继续使用旧的严格最小间隔。`action-tools.ts` 不再直接持有对应的两张协调 Map。

## Why it matters

Agent 黑板逐步成为任务协调状态的唯一来源，减少大型组合层中的重复状态和 Bot 删除时的清理遗漏。planner、工具执行和公共入口无需改变即可继续使用同一行为。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增游戏行为或公共字段；任务历史、记忆、planner 冷却/执行、可取消 executor 和完整 Agent tick 副作用仍在 `action-tools.ts`，真实服务器回归仍需按手动测试文档执行。
