---
type: refactor
scope: runtime
audience: developer
summary: 让 movement.stop 和 player.look 开始通过 ClientAdapter 执行
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

`ClientAdapter` 增加了 `look()` 动作能力，`MineflayerAdapter` 负责调用原生 `bot.look()`。`BotRuntime` 暴露对应转发方法，`player.look` 工具改为通过 runtime 执行。

`movement.stop` 现在会等待 `runtime.stopMovement()` 完成后再返回，并继续清理 pathfinder goal 缓存。

## Why it matters

这让“转头”和“停下”两个高频基础动作也进入统一客户端适配层。未来替换为整合包客户端桥时，可以把这些动作映射到真实客户端控制或 bridge API，而不是继续散落在工具层里。

## Demo posture / limitations

这不是完整移动系统抽象。`movement.walk` 的持续按键控制、follow 主循环、pathfinder 路线仍然保留在原生 mineflayer 细节中，后续需要分小步继续迁移。
