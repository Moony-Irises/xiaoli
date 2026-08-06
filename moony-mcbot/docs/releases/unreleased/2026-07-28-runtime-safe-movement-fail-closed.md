---
type: fix
scope: runtime
audience: developer
summary: 安全定点移动与实体追击不再在 Pathfinder 失败时退化为盲目前进
breaking: true
demo_ready: false
tests: npx tsx --test test/client-adapter-entity-actions.test.ts test/position-movement.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/position-movement.ts
  - test/client-adapter-entity-actions.test.ts
  - test/client-adapter-status.test.ts
  - test/position-movement.test.ts
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

`MineflayerAdapter.moveTo()` 与 `pursueEntity()` 现在要求零破坏 Pathfinder 成功接受目标。Pathfinder 缺失或 `setGoal` 拒绝目标时，Adapter 会清除 Pathfinder 目标并释放全部移动控制键，然后抛出明确错误；`BotRuntime` 会把该错误记录到 Adapter action history。仅供旧直接移动 fallback 使用的位置决策字段也已移除。

## Why it matters

此前这两条被文档描述为安全寻路的动作，在 Pathfinder 异常时会静默切换成 `forward` 控制，可能绕过不挖路、不搭路和落差限制。现在安全移动的底层契约是 fail-closed，调用方和 Web 面板能看到真实失败，而不是把盲目前进误报为成功。

## Demo posture / limitations

本轮是内部安全修复，不是 install demo、已发布版本或 GA 功能。`ClientAdapter` 方法签名、MCP schema、Tool Catalog 和默认 allowlist 均未变化，但依赖旧直接 fallback 的调用现在会收到错误，因此按行为兼容性标记为 breaking。`movement.walk` / `wander_area` 仍是没有地形保护的直接移动并保持默认关闭；真实服务器上的无路可达、长绕行和反馈语句仍需要后续状态监控与游戏内验收。
