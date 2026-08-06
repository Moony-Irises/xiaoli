---
type: refactor
scope: runtime
audience: developer
summary: 让 observe.nearbyEntities 开始优先走 ClientAdapter 实体快照
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - TODO.md
  - README.md
---

## What changed

这轮把观测层 adapter 化继续往前推了一步：

- `EntitySnapshot` 扩展了 `entityId` / `displayName` / `kind` / `distance` 等字段
- `ClientAdapter` 新增 `getNearbyEntities(radius)` 能力
- `MineflayerAdapter` 实现附近实体快照
- `BotRuntime` 暴露统一的 `getNearbyEntities(radius)` 入口
- `observe.nearbyEntities` 工具改为优先读取 adapter 快照
- `executeAgentToolCall(...)` 里的实体摘要也同步切到 runtime / adapter 出口

## Why it matters

整合包客户端桥接最先要稳定下来的不是复杂玩法，而是观测面。

上一轮已经把 `observe.self` 和 `observe.nearbyPlayers` 接到 adapter，这一轮继续把 `observe.nearbyEntities` 纳进来，让上层 runtime 后续可以更少依赖 `mineflayer` 的实体结构。

## Demo posture / limitations

这次仍然不是用户可见的新功能，也不代表观测层已经完整迁移。

当前仍有这些限制：

- `observe.blocks` 还没有迁到 adapter
- `observe.inventory` 还没有迁到 adapter
- `agent.stateSnapshot` 中还有不少路径直接读原生 `mineflayer.Bot`

这轮只是把“附近实体”这条最基础的观测入口先站稳。
