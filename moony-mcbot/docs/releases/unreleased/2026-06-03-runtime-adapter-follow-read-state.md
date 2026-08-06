---
type: refactor
scope: runtime
audience: developer
summary: 让 follow 链开始通过 ClientAdapter 读取玩家位置并统一停止移动
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

这轮继续推进底层 adapter 化，但依然保持在很小的范围内：

- `ClientAdapter` 新增：
  - `getSelfState()`
  - `getPlayerSnapshot(username)`
  - `stopMovement()`
- `MineflayerAdapter` 实现了这些能力
- `BotRuntime` 暴露了对应统一入口
- `action-tools.ts` 中：
  - `stopMovement(...)` 改为优先通过 runtime/adapter 停止移动
  - `startFollow(...)` 开始通过 adapter 读取自身与目标玩家位置，而不再直接从 `bot.players` / `bot.entity` 读取这些基础状态

## Why it matters

这一步把 follow 链往“多客户端后端可替换”的方向再推了一小段，而且避开了最危险的部分。

我们现在已经有两类 adapter 化验证点：

- `chat.send` 统一出口
- `follow` 的基础状态读取与停止移动

这说明后面可以继续按相同节奏推进：

- 先收口最基础、最稳定的读写动作
- 再处理 pathfinder、look、control-state 这些更深的 mineflayer 细节

## Demo posture / limitations

这次仍然不是用户可见的新玩法，也不代表 follow 已经完全脱离 mineflayer。

当前 follow 主循环仍然直接依赖：

- pathfinder
- control state
- lookAt

所以这轮的定位很明确：只是把 follow 的“基础状态读取”和“停止移动”先放进 adapter 边界里，为后续进一步拆分主循环做准备。
