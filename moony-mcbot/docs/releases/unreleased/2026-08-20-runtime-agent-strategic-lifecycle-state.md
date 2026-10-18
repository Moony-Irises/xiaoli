---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 战略生命周期提示与完成汇报的去重状态收口到 HierarchicalAgentRuntime
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-blackboard.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - git diff --check
artifacts:
  - src/agent/runtime.ts
  - src/agent/README.md
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/agent-blackboard.test.ts
  - README.md
  - CLAUDE.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
---

## What changed

`HierarchicalAgentRuntime` 现在分别保存最近一次已占用的战略生命周期提示事件 ID 和最近一次已成功发送汇报的事件 ID，并由 Supervisor 提供不创建缺失 Runtime 的按 Bot 清理。`action-tools.ts` 删除对应两张裸 Map，普通提示与完成/放弃汇报改用 Runtime 接口。

## Why it matters

生命周期事件的去重状态不再散落在大型工具编排文件中，可以独立验证普通提示的即时占用、汇报的成功后记账、两类状态隔离和配置删除清理。事件筛选、规划指令、聊天目标、汇报文案和公共返回契约保持原有顺序。

## Demo posture / limitations

这不是 install demo、已发布版本或 GA。本轮只迁移两个短期去重标记，不迁移生命周期历史、planner 请求、目标选择、聊天发送或完整 Agent tick；真实服务器上的目标完成/放弃汇报仍按现有手动测试场景观察。
