---
type: refactor
scope: runtime
audience: developer
summary: 将单个分层动作执行迁入独立边界并覆盖权限与失败清理
breaking: false
demo_ready: false
tests:
  - npm test -- test/agent-runtime-action-executor.test.ts test/agent-planner-integration.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
  - npm run validate:releases
  - git diff --check
artifacts:
  - src/agent/runtime-action-executor.ts
  - src/agent/index.ts
  - src/tools/action-tools.ts
  - test/agent-runtime-action-executor.test.ts
  - test/agent-planner-integration.test.ts
  - src/agent/README.md
  - test/README.md
  - docs/strategic-planner-injection-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

将分层动作的 Skill 预览、权限/任务冲突复核、绑定、工具执行、诊断、终态事件和执行后清理迁入 `executeAgentRuntimeAction`。生产调用继续先同步状态、发布 tick 并轮询任务超时，通过四个内部 hooks 接回当前配置、领域工具和结果诊断。新增独立执行器测试及 MCP 权限拒绝、Adapter 失败的迁移前后接线回归。

## Why it matters

规划和单个动作执行有各自可离线验证的边界。测试覆盖排队等待、运行中 active 状态、成功/失败证据、工具执行后的状态释放、反应优先级、后续动作继续执行和 Bot 隔离，为后续清理旧兼容编排提供基线。

## Demo posture / limitations

这次不代表游戏服务器已经确认执行，也不代表已提交或开始的动作可以取消或回滚。旧工具兼容分支、tick、领域工具和拒绝路径订阅者异常继续保留原行为；指定食物参数丢失和拒绝事件异常清理已记录 TODO。真实游戏回归见测试指南第 9.1-9.2 节。这不是 install demo、已发布版本或 GA。
