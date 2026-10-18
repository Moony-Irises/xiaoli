---
type: refactor
scope: runtime
audience: developer
summary: 将跨动作共享的当前移动相关标识收敛到独立运行时 Store
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/movement-intent-store.test.ts
  - npx tsx --test --import ./scripts/test-setup.ts test/agent-tool-executors.test.ts test/stop-follow-command-integration.test.ts test/client-adapter-entity-actions.test.ts test/client-adapter-status.test.ts test/movement-event-routing.test.ts test/movement-intent-store.test.ts test/position-movement.test.ts test/follow-session.test.ts test/follow-session-lifecycle.test.ts test/duel-session.test.ts test/idle-follow-policy.test.ts
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/movement-intent-store.ts
  - src/tools/action-tools.ts
  - test/movement-intent-store.test.ts
  - src/runtime/README.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

follow、定点移动、决斗、聊天攻击和采矿原先共用的当前移动相关标识已从 `action-tools.ts` 的裸 Map 迁入 `MovementIntentStore`。原 key 格式、覆盖、查询和删除时机保持不变；新增单元测试覆盖多 Bot 隔离、同 Bot 替换和幂等删除。

## Why it matters

移动异步结果和 movement event 现在依赖一个明确的状态所有者判断自己是否仍属于当前动作，降低 `action-tools.ts` 的隐式共享状态数量。后续拆分 MovementRuntime 时可以复用该边界，而无需让各动作重新维护自己的相关性 Map。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。没有新增或改变游戏动作；Store 不创建 Pathfinder goal、不调用 Adapter、不结算任务，也不证明服务器已接受或完成移动。真实地形中的目标替换、途中封路、停止和迟到事件仍需按手动测试指南验证。
