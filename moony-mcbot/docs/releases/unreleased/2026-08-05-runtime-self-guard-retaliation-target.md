---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 最近疑似攻击者选择迁入纯 runtime 边界并改读 Adapter 玩家坐标
breaking: false
demo_ready: false
tests:
  - npx tsx --test --import ./scripts/test-setup.ts test/self-guard-retaliation.test.ts test/self-guard-environment.test.ts test/combat-execution-state-store.test.ts test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/invalidatable-task-queue.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts test/self-guard-state.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
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

新增纯 `selectLikelyRetaliationAttacker`，从现有 Adapter 玩家快照中排除自身和损坏候选，并按双方坐标计算精确三维距离选择半径内最近玩家。`handleHitReaction` 不再直接遍历原生 `bot.players`；选中玩家后的日志、白名单判断、反击计数/升级和原生攻击链保持原顺序。

## Why it matters

疑似攻击者的几何选择现在可离线验证，并能复用于未来 GuardRuntime。选择器不信任 Adapter 为展示保留两位小数的 `distance`，避免在边界和极近距离排序时改变旧几何语义；白名单仍在选中最近玩家后判断，因此不会静默改打第二近目标。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不新增 MCP/Web 工具、配置字段或 Adapter capability，也不修改聊天文本和反击次数。Mineflayer `entityHurt` 在这条链中没有真实伤害来源，最近玩家仍可能被错误归因；按用户名复核实体、追击、攻击和完整 self-guard tick 仍是旧实现。自动化测试不代表真实服务器反击行为已经回归。
