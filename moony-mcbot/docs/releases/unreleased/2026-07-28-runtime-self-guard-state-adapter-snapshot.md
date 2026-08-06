---
type: refactor
scope: runtime
audience: developer
summary: self-guard 周期状态判断改由 Adapter 自身与背包快照驱动
breaking: false
demo_ready: false
tests: npx tsx --test test/self-guard-state.test.ts test/client-adapter-conformance.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/self-guard-state.ts
  - src/tools/action-tools.ts
  - test/self-guard-state.test.ts
  - package.json
  - README.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - TODO.md
  - CLAUDE.md
---

## What changed

新增纯 self-guard vitals 决策器，固定低血量、危险血量、低饥饿、回血进食和自动进食开关语义。周期循环的自身状态、食物背包、库存变化和附近玩家检测改读 Adapter 快照，排队后的进食任务会再次读取最新快照再决定是否执行。

## Why it matters

self-guard 的周期策略不应依赖 Mineflayer 的原生玩家表和背包对象。迁移后阈值决策可以离线验证，并能复用于未来 Modded Client Adapter；可选 vitals 缺失或不是有限数字时会 fail-closed，不会误触发告警、停跟随或进食。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。没有修改 MCP schema、配置结构、默认 allowlist 或 `ClientAdapter` 公共契约；现有阈值和事件 payload 保持不变。受伤事件监听、昼夜天气与原生实体反击仍依赖 Mineflayer，真实服务器上的低饥饿、无食物反馈和库存变化事件仍需按手测文档验证。
