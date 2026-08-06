---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 昼夜与下雨兼容采集及转场判定迁入纯 runtime 边界
breaking: false
demo_ready: false
tests:
  - npx tsx --test --import ./scripts/test-setup.ts test/self-guard-environment.test.ts test/combat-execution-state-store.test.ts test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/invalidatable-task-queue.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts test/self-guard-state.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-environment.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-environment.test.ts
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

新增纯 runtime `readSelfGuardEnvironment` 与 `detectSelfGuardEnvironmentTransitions`，兼容读取 Mineflayer 的昼夜/下雨动态字段并判定首次观察、白天转夜晚和无雨转下雨。self-guard 主 tick 改为通过该边界采集和判断，再沿用原有 Store 写入与聊天副作用。

## Why it matters

天气字段的动态访问和场景转场条件不再散落在旧编排层，正常、缺失/异常、首次观察、双转场与反向变化均可离线回归。该抽取保留旧 `Boolean(...)` 兼容语义、状态写入顺序和聊天文本，没有扩大公共接口。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不新增 MCP/Web 工具、配置字段或 Adapter capability；环境输入仍来自原生 Mineflayer Bot，完整 self-guard tick、受伤/攻击业务和 Modded Adapter 世界环境快照均未迁移。自动化测试不代表真实服务器的昼夜与下雨提示已经完成游戏内回归。
