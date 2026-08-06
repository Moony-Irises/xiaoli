---
type: refactor
scope: runtime
audience: developer
summary: 让 observe.self 和 observe.nearbyPlayers 开始优先走 ClientAdapter 观测快照
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

这轮继续推进 adapter 化，但目标从动作链切到了观测链：

- `ClientAdapter` 新增 `getNearbyPlayers(radius)` 能力
- `SelfStateSnapshot` 和 `PlayerSnapshot` 扩展了更多可用字段
- `MineflayerAdapter` 实现了：
  - `getSelfState()`
  - `getPlayerSnapshot(username)`
  - `getNearbyPlayers(radius)`
- `BotRuntime` 暴露统一的 nearby players 读取入口
- `observe.self`
  - 核心状态字段优先读取 adapter 快照
- `observe.nearbyPlayers`
  - 改为直接使用 adapter 返回的统一玩家快照
- `executeAgentToolCall(...)` 里的 `observe.nearbyPlayers` 摘要也同步切到了 adapter

## Why it matters

未来如果要接真正的整合包客户端桥接，最先需要稳定的通常不是“复杂执行动作”，而是“统一观测层”。

这次改动把两条最基础、最高频的观察链开始从 `mineflayer` 直接读取里抽出来，意味着后续我们可以更系统地把：

- self state
- nearby players
- nearby entities
- visible blocks

逐步收口到 `ClientAdapter` 上，而不是让上层 runtime 和工具层长期耦合在 `mineflayer` 结构上。

## Demo posture / limitations

这次仍然不是用户可见的新功能，也不代表观测层已经完全 adapter 化。

当前仍有这些限制：

- `observe.self` 里的手持、护甲、背包细节仍然依赖原生 `mineflayer` 视图
- `observe.nearbyEntities` / `observe.blocks` 还没迁
- `agent.stateSnapshot` 里的很多深层观察路径还未统一到 adapter

所以这轮的定位很明确：先把“自身状态 + 附近玩家”这两个最基础的观测入口站稳。
