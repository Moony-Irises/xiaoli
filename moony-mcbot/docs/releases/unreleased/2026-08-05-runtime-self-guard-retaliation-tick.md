---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 持续反击的超时、移动和攻击时机迁入纯 tick 决策
breaking: false
demo_ready: false
tests:
  - npx tsx --test --import ./scripts/test-setup.ts test/self-guard-retaliation.test.ts test/self-guard-environment.test.ts test/combat-execution-state-store.test.ts test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-retaliation.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-retaliation.test.ts
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

新增纯 `decideRetaliationTick` 判别联合，显式返回超时、目标不可用或 active 状态，并在 active 分支给出接近/停留与本轮是否应攻击。持续反击循环现在把 60 秒超时、3 格移动边界、配置攻击距离和 600ms 冷却委托给该决策，原生动作成功后才更新 session 的既有时序保持不变。

## Why it matters

持续反击的关键分支顺序与距离边界现在可脱离 Mineflayer 做确定性回归测试。超时优先于目标缺失、损坏快照 fail-closed、边界包含关系和冷却条件不再散落在副作用编排中。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不新增或修改 MCP/Web、Adapter 或配置公共契约，也不代表真实服务器行为已经回归。原生实体竞态复核、追击、控制状态、装备、跳击、攻击和聊天汇报仍依赖 Mineflayer；`entityHurt` 也仍不提供真实伤害来源。
