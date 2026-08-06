---
type: refactor
scope: runtime
audience: developer
summary: self-guard 配置状态和阈值归一化收口到独立 ConfigStore
breaking: false
demo_ready: false
tests:
  - npm test -- test/self-guard-config-store.test.ts test/chat-config-reload.test.ts test/self-guard-state.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/config/self-guard-config-store.ts
  - src/config/README.md
  - src/tools/action-tools.ts
  - test/self-guard-config-store.test.ts
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增 `SelfGuardConfigStore`，统一拥有 self-guard 配置类型、默认值、数值与阈值归一化、运行时 Map、持久化 replace/delete 和独立快照。`action-tools` 移除对应重复状态与转换实现，配置热重载和持久化快照改为委托 Store；守卫循环及其 cleanup 仍沿用原流程。

## Why it matters

self-guard 配置现在可以脱离游戏 runtime 独立验证，包括显式 `false`、上下限以及 `criticalHealth <= lowHealth` 的依赖约束。这进一步缩小了旧编排层直接拥有的配置状态，且没有把 timer、Promise 或原生游戏对象带入配置模块。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具名、输入输出、`chat-configs.json` 路径或字段、环境覆盖顺序、自动进食、反击、告警或游戏行为。self-guard interval、任务和 `entityHurt` handler 仍由 `action-tools` 管理；同一 bot 热重载时既有受伤 handler 可能继续闭包旧配置，该既有问题已记录但未在本轮修复。
