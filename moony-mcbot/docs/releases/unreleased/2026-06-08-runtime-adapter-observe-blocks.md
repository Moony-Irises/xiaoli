---
type: refactor
scope: runtime
audience: developer
summary: 让 observe.blocks 的基础方块观察开始通过 ClientAdapter 执行
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

这轮继续推进观测层 adapter 化：

- `BlockSnapshot` 增加 `displayName`
- 新增 `BlockObservationSnapshot`
- `ClientAdapter` 新增 `getBlockObservation(reach)` 能力
- `MineflayerAdapter` 实现脚下方块和准星方块快照
- `BotRuntime` 暴露统一的 `getBlockObservation(reach)` 入口
- `observe.blocks` 工具改为优先读取 runtime / adapter 方块观察快照

## Why it matters

`observe.blocks` 是后续整合包客户端桥接里很基础的一条观察链。

这一步先把最稳定的两类方块观察收进 adapter：

- 脚下方块
- 准星方块

这样未来 `ModdedClientAdapter` 可以先提供同样的基础方块视图，而不需要立即实现完整的可见方块扫描或复杂 raycast 逻辑。

## Demo posture / limitations

这次不是用户可见的新玩法，也不代表所有方块观察都已经迁移。

当前限制：

- 可见方块扫描仍然依赖原生 `mineflayer` 路线
- 挖矿、开门、容器查找中的方块访问还没迁到 adapter
- `observe.inventory` 仍然主要依赖原生 `mineflayer` 视图

这轮只把 `observe.blocks` 的脚下和准星观察先站稳。
