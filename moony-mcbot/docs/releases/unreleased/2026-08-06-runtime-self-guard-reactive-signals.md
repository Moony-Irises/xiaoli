---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 低生命与低饥饿 reactive 信号迁入纯运行时决策
breaking: false
demo_ready: false
tests:
  - npm test -- test/self-guard-state.test.ts test/self-guard-runtime-state-store.test.ts test/self-guard-config-store.test.ts test/self-guard-environment.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-state.ts
  - src/runtime/self-guard-runtime-state-store.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-state.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增纯 `evaluateSelfGuardReactiveSignals`，根据 vitals、食物可用性和上一组 flags 生成有序的 `low_health` / `low_food` 信号及下一组 flags。reactive flags 类型移入纯状态边界，原 Store 模块继续 re-export；`maybePublishSelfGuardSignals` 只负责按顺序发布信号并最后写 Store。

## Why it matters

首次阈值进入、重复抑制、critical 升降级、恢复清除、事件优先级和 payload 现在都可离线验证。状态判断不再与 Agent runtime 发布细节绑定，同时保留现有内部类型导入路径。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web、Adapter、配置或持久化公共契约，不迁移事件 ID/时间戳、发布失败处理、聊天、反击或完整 tick。调用层仍按 low-health、low-food、flags 写入顺序执行；发布函数继续内部隔离桥接异常，随后仍更新 flags。
