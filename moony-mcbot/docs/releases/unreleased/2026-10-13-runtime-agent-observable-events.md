---
type: refactor
scope: runtime
audience: developer
summary: 统一 Agent 调试出口的有界可观察事件视图
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-blackboard.test.ts test/agent-planner-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - src/agent/blackboard.ts
  - src/agent/runtime.ts
  - src/tools/action-tools.ts
  - test/agent-blackboard.test.ts
  - test/agent-planner-integration.test.ts
  - src/agent/README.md
  - test/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

黑板现在按真实写入顺序维护最多 20 条可观察 Agent 事件。它合并执行事件和有意义的框架事件，按事件 ID 去重，并过滤 `tick` 与 `perception_updated` 刷新噪声。Runtime 调试快照、`agent.framework.status`、`agent.events.tail`、`agent.trace.summary` 和 Web 状态读取同一视图；原始 execution stream 继续供生命周期判断、planner 输入和低优先级限流使用。

补充了黑板边界回归与 MCP 规划接线回归，覆盖规划请求/结果、Skill 完成、刷新噪声、时钟回退、容量、去重和多 Bot 隔离。

## Why it matters

远程查看时可以从任意 Agent 调试入口核对同一组行为证据，不会再因为事件被写入另一条内部流而误以为 planner 或 Skill 没有运行。

## Demo posture / limitations

这次不代表真实游戏行为已经通过验收，也不是 install demo、已发布版本或 GA。`recentEvents` 仍是内部规范化输入流，可能包含被调试视图过滤的感知刷新；事件可见性一致不等于 Command History 或游戏客户端已确认动作成功。
