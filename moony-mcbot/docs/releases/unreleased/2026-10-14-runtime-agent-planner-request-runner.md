---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 单次规划请求的生命周期接入独立运行器
breaking: false
demo_ready: false
tests:
  - npm test -- test/planner-request-runner.test.ts test/agent-planner-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - src/agent/planner-request-runner.ts
  - src/agent/index.ts
  - src/tools/action-tools.ts
  - test/planner-request-runner.test.ts
  - src/agent/README.md
  - src/runtime/README.md
  - test/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增 `planner-request-runner.ts`，统一单次 Agent planner 请求的输入转发、取消信号、运行中状态、成功/失败终态和 lifecycle handle 清理；MCP、Web 和自动战略 pass 继续复用原有调用路径。

补充离线测试，覆盖请求参数与 `AbortSignal`、成功状态、取消失败分类、错误重新抛出和请求结束后的生命周期清理。

## Why it matters

planner 请求的生命周期现在有独立边界，后续可以把完整轮次协调接入 `StrategicPlanner`，而不必继续把 HTTP 请求状态管理和黑板/执行逻辑绑定在 `action-tools.ts` 中。

## Demo posture / limitations

这次不代表完整 `StrategicPlanner` 已经在生产运行时注入，也不代表云端计划或游戏动作已获得服务器确认；这不是 install demo、已发布版本或 GA。真实服务器回归仍按手动测试指南执行。
