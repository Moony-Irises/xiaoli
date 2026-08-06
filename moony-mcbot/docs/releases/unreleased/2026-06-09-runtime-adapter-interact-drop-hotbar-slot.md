---
type: refactor
scope: runtime
audience: developer
summary: 让 interact.dropHotbarSlot 通过 ClientAdapter 动作入口执行
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - README.md
  - TODO.md
---

## What changed

`ClientAdapter` 增加了 `dropHotbarSlot()` 动作能力，支持指定 1-9 快捷栏槽位、丢弃一件或整组，并按参数恢复原快捷栏槽位。

`MineflayerAdapter` 将该动作映射到原生快捷栏切换与 `bot.toss()` / `bot.tossStack()`，`BotRuntime` 暴露对应转发方法，`interact.dropHotbarSlot` 工具和 agent tool call 都改为通过 runtime/adapter 执行。

## Why it matters

这把快捷栏丢弃动作也收敛到客户端适配层。未来真实客户端桥可以把它映射成按键或 bridge 指令，而不用让工具层继续直接操作 mineflayer 的快捷栏细节。

## Demo posture / limitations

这不是完整库存/容器系统抽象。当前只迁移快捷栏指定槽位丢弃；物品移动、整理、容器存取和复杂 GUI 交互仍然保留在原生 mineflayer 路线中。
