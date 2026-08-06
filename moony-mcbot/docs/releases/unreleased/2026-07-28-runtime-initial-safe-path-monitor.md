---
type: fix
scope: runtime
audience: developer
summary: 定点移动和实体追击会审计首轮 Pathfinder 结果并报告不可达或长绕行
breaking: true
demo_ready: false
tests: npx tsx --test test/mining-approach.test.ts test/client-adapter-entity-actions.test.ts test/follow-session.test.ts; npm run typecheck; npm test; npm run build; git diff --check
artifacts:
  - src/runtime/mining-approach.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/follow-session.ts
  - src/tools/action-tools.ts
  - test/client-adapter-entity-actions.test.ts
  - test/follow-session.test.ts
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - README.md
  - TODO.md
  - CLAUDE.md
---

## What changed

将原采矿路线长度判定泛化为安全路径评估，并新增带稳定 `reason` 的 `SafePathError`。`MineflayerAdapter.moveTo()` 与 `pursueEntity()` 现在等待首轮完整 `path_update` 后才返回成功；寻路器不可用、`setGoal()` 拒绝、`noPath`、`timeout`、超过 `max(24, 直线距离 × 2.5)` 的路线以及本地评估超时都会停止路径和控制状态并拒绝调用。Adapter 同时只保留一个首轮监听器，新目标、停止和断线会清理旧监听。跟随捕获结构化失败后结束任务并只发送一次“我跟不上你啦”，决斗追击失败后也会结束而不是高频重试。

## Why it matters

此前 `setGoal()` 成功只表示目标被接收，并不能证明 Pathfinder 找到了安全且合理的路线。上层会把稍后发生的 `noPath` 当作已成功开始移动，既没有后台失败证据，也可能持续重试。首轮结果现在进入 Runtime 的成功/失败边界，并可由上层可靠区分不可达与普通瞬时错误。

## Demo posture / limitations

本轮不是 install demo、已发布版本或 GA 功能。`ClientAdapter` 方法签名、MCP schema、Tool Catalog 和默认 allowlist 在首轮监控阶段未变，但 `moveTo()` / `pursueEntity()` 的 Promise 会等待首轮路径结果并可能以 `SafePathError` 拒绝，因此按行为兼容性标记为 breaking。持续监听与关联事件由后续 `runtime-continuous-safe-path-events` 条目扩展；真实服务器表现必须按手测文档验证。
