---
type: refactor
scope: runtime
audience: developer
summary: 让 interact.swing 通过 ClientAdapter 动作入口执行
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

`ClientAdapter` 增加了 `swingArm()` 动作能力，`MineflayerAdapter` 将它映射到原生 `bot.swingArm()`。

`BotRuntime` 暴露 `swingArm()` 转发方法，`interact.swing` 工具改为通过 runtime/adapter 执行。

## Why it matters

摆臂动画是最简单的客户端交互动画之一，通常对应攻击/使用时的手臂摆动，而不是 Minecraft Java 版的独立社交“挥手”动作。先把它迁到 adapter，可以继续验证动作接口的边界，同时不牵动攻击、方块交互或背包系统。

## Demo posture / limitations

这不是完整交互系统抽象。丢弃物品、攻击实体/玩家、开门、右键使用等仍然保留在原生 mineflayer 路线中，后续需要按功能块继续迁移。
