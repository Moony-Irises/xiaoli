---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 计划到战略指令的纯翻译逻辑移出工具编排层
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-plan-to-directive.test.ts test/agent-planner-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - src/agent/plan-to-directive.ts
  - src/agent/index.ts
  - src/tools/action-tools.ts
  - test/agent-plan-to-directive.test.ts
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

新增无副作用的 `plan-to-directive` 模块，负责高层 `directive.actions` 过滤、旧工具步骤归一化、已知工具映射、缺参数回退和 `maxPlanSteps` 截断。旧 MCP/Agent 编排仍拥有冷却、权限校验、战略目标更新和实际执行，外部工具契约不变。

补充纯翻译单元测试和 MCP 接线回归，覆盖显式动作优先、动作顺序与元数据、兼容步骤、未映射步骤、缺参数、空执行计划和动作上限。

## Why it matters

规划结果的语义转换现在有独立边界，后续可以单独替换 Strategic Layer 或测试翻译规则，不必让模型请求模块和 Mineflayer/命令执行代码共同承载这部分逻辑。

## Demo posture / limitations

这次不代表 StrategicPlanner 已经接入生产，也不代表完整 planner 轮次或游戏动作确认已经完成；这不是 install demo、已发布版本或 GA。真实服务器回归仍按手动测试指南执行，未映射旧工具步骤仍会经过原有权限和兼容执行队列。
