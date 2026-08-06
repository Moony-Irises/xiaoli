---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 附近玩家的距离校验和首次进入转场迁入纯运行时决策
breaking: false
demo_ready: false
tests:
  - npx tsx --test --import ./scripts/test-setup.ts test/self-guard-state.test.ts test/self-guard-runtime-state-store.test.ts test/self-guard-config-store.test.ts test/self-guard-environment.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-state.ts
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

新增纯 `evaluateSelfGuardProximity`，从只读 Adapter 玩家快照中排除自身、忽略缺失/负数/非有限距离，并在包含边界的范围内判定当前是否接近以及是否刚进入范围。self-guard 主 tick 现在把原有筛选、排序和上一轮比较委托给该函数。

## Why it matters

附近玩家转场不再混在随机聊天副作用旁边，可以离线验证自身排除、损坏快照、范围边界和首次进入语义。持续停留不会被每个 tick 误判为新的进入机会。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web、Adapter 或配置公共契约，不改变 `nearPlayerTalkChance`、场景文本和冷却，也不代表完整 self-guard tick 已迁出旧编排层。随机数、聊天副作用和 `lastIsNearPlayer` 状态写入仍由 `action-tools.ts` 按原顺序执行。
