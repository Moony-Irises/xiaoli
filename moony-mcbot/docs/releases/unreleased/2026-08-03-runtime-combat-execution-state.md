---
type: refactor
scope: runtime
audience: developer
summary: 装备节流与反击命中序号迁入独立战斗执行状态 Store
breaking: false
demo_ready: false
tests:
  - npx tsx --test --import ./scripts/test-setup.ts test/combat-execution-state-store.test.ts test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/invalidatable-task-queue.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts test/self-guard-state.test.ts test/chat-config-reload.test.ts test/runtime-shutdown-lifecycle.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/combat-execution-state-store.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/combat-execution-state-store.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
---

## What changed

新增纯内存 `CombatExecutionStateStore`，将旧编排层共享的最后一次成功装备武器时间与反击命中序号合并为一份按 Bot 记录。准备战斗的回退装备路径、self-guard 反击和 self-guard stop 现在通过 Store 读写，旧的两张全局 Map 已移除。

## Why it matters

装备节流与跳击序号现在有单一所有者和可离线验证的清理边界，不再依赖两条分散 Map cleanup。装备时间仍只在成功后记录，命中序号仍在实际看向和攻击前递增，普通 stop 仍同时清理两项状态，因此没有静默改变既有动作时序。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不修改 MCP/Web 工具、配置 schema、700ms 节流、四次三跳击比例、聊天文本或攻击动作；`MineflayerClientAdapter` 的独立攻击计数没有合并，自动化测试也不代表真实服务器上的装备和反击动画已经回归。
