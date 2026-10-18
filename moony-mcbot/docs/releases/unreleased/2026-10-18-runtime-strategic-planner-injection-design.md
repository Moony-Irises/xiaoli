---
type: test
scope: runtime
audience: developer
summary: 补齐规划请求取消与交错回归并明确 Strategic Layer 生产注入提案
breaking: false
demo_ready: false
tests:
  - npm test -- test/planner-request-runner.test.ts test/ai-request-lifecycle.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - test/planner-request-runner.test.ts
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

增加五组请求边界测试，覆盖超时/普通错误原样传递、实际取消、失效后的迟到完成、同 Bot 交错及多 Bot 隔离。补充生产策略注入提案，明确原始计划、战略指令、里程碑和兼容步骤的保留方式，以及完整轮次的生命周期所有权。

## Why it matters

旧 StrategicPlanner 只返回指令，不能直接承载完整生产规划结果。提案给出单次应用和执行前有效性检查的迁移边界；回归同时明确当前生命周期只阻止旧诊断覆盖，上游忽略取消时仍会返回迟到计划。

## Demo posture / limitations

这次不代表生产策略注入已经完成，也不代表取消后不会执行迟到计划；共享接口和游戏行为未改，方案待确认。真实 API 与服务器回归仍待手动测试，不是 install demo、已发布版本或 GA。
