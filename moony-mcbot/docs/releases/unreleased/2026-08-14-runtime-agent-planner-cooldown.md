---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent planner 冷却时间戳判定收敛到层级 runtime
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-blackboard.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm audit --omit=dev --json
artifacts:
  - src/agent/runtime.ts
  - src/tools/action-tools.ts
  - test/agent-blackboard.test.ts
  - src/agent/README.md
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - docs/lint-ci-design.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

`HierarchicalAgentRuntime` 现在负责 planner 冷却时间戳的同步、剩余时间计算和到期判定。`action-tools.ts` 仍负责发起模型请求，并把成功请求的同一时间写回 `AgentConfigStore` 作为兼容诊断镜像。

## Why it matters

planner 冷却不再由组合层直接读取和比较配置时间戳，Agent 黑板协调状态继续向单一 runtime 收口；热重载或旧诊断时间戳不会把 runtime 中较新的时间戳倒退。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有改变 MCP/Web/Agent 返回契约、冷却错误文本、并发请求、请求取消或 executor 执行队列语义；planner 请求/执行、任务历史/记忆和完整 Agent tick 仍需后续迁移，真实服务器回归仍按手动测试指南执行。本轮还刷新了当前依赖审计记录：`npm audit --omit=dev` 返回 0 项，但这不代表真实认证或游戏行为已经验收。
