---
type: fix
scope: runtime
audience: developer
summary: 修复权限拒绝事件订阅者抛错时残留动作执行状态
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
  - test/agent-runtime-action-executor.test.ts
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

权限拒绝的 `task_failed` 发布使用独立 `try/finally`：直接或通配订阅者抛错后仍释放 active action/skill，原异常继续上抛。新增故障注入回归，先复现旧实现的状态残留，再验证动作不重放、后续队列可执行及另一个 Bot 的 pending Skill 不受影响。

## Why it matters

同步事件回调异常不应让已消费且被拒绝的动作一直显示为正在执行。清理回到实际拥有绑定状态的执行器内，保持原权限、拒绝事件优先级、工具调用和诊断行为。

## Demo posture / limitations

这次不代表事件投递得到保证，也不代表游戏内动作已验证。EventBus 仍同步派发，订阅者异常可能中断后续派发及黑板记录；预览/绑定异常、已提交动作的取消和指定食物参数问题不在本轮修复范围内。测试指南第 9.2 节记录观察方式，离线回归不需要真实 API 或游戏。这不是 install demo、已发布版本或 GA。
