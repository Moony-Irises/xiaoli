---
type: refactor
scope: runtime
audience: developer
summary: 让 interact.dropHeld 通过 ClientAdapter 动作入口执行
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

`ClientAdapter` 增加了 `dropHeldItem()` 动作能力，支持丢弃手持物的一件或整组。

`MineflayerAdapter` 将它映射到原生 `bot.toss()` / `bot.tossStack()`，`BotRuntime` 暴露对应转发方法，`interact.dropHeld` 工具和 agent tool call 都改为通过 runtime/adapter 执行。

## Why it matters

手持物丢弃是物品交互里最小的一块。先迁移它可以继续扩大 adapter 动作覆盖，同时不把快捷栏切槽、容器或复杂库存整理逻辑一起卷进来。

## Demo posture / limitations

这不是完整物品系统抽象。`interact.dropHotbarSlot` 仍然需要切换快捷栏并可选恢复原槽位，目前保留在原生 mineflayer 路线中，后续单独迁移。
