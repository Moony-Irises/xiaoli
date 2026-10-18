---
type: refactor
scope: runtime
audience: developer
summary: 接入可注入 Strategic Layer 并阻止失效规划产生副作用
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-planning-strategy.test.ts test/agent-planning-turn.test.ts test/agent-planning-injection-integration.test.ts
  - npm test -- test/planner-request-runner.test.ts test/ai-request-lifecycle.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - src/agent/planning-strategy.ts
  - src/agent/planning-turn-coordinator.ts
  - src/agent/planner-request-runner.ts
  - src/tools/action-tools.ts
  - src/main.ts
  - test/agent-planning-strategy.test.ts
  - test/agent-planning-turn.test.ts
  - test/agent-planning-injection-integration.test.ts
  - docs/strategic-planner-injection-design.md
  - docs/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - src/agent/README.md
  - test/README.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

增加默认规划策略和完整轮次协调器，并让 MCP、Web、自动战略 pass 复用同一注入入口。协调器在目标更新、动作入队、计划发言和 executor 启动前复核请求作用域；配置重载、清空目标和 shutdown 会使轮次失效。补充单元与接线测试，覆盖超时/普通错误原样传递、实际取消、忽略取消后的迟到回复、同 Bot 交错、多 Bot 隔离、异步聊天和配置生命周期。

## Why it matters

旧 StrategicPlanner 只返回指令，不能直接承载完整生产规划结果。新策略返回原始计划、战略指令和兼容步骤，协调器只应用一次并保留现有入口返回；上游忽略取消时，迟到计划会在副作用边界前被拒绝。

## Demo posture / limitations

这次不代表旧 StrategicPlanner 接口已删除，也不代表云端模型或游戏服务器已经确认执行；真实 API 与服务器回归仍待手动测试。这不是 install demo、已发布版本或 GA。
