---
type: refactor
scope: runtime
audience: developer
summary: 让部分本地自动消息复用 ClientAdapter 聊天发送入口
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - TODO.md
---

## What changed

战略目标完成/放弃的本地汇报、领地警告、挖矿开始/结束提示不再直接调用原生 `bot.chat()`，而是复用 `sendRuntimeChat()` 或 `sendRuntimeChatNoWait()`。

这些调用最终会进入 `BotRuntime.sendChat()` 和当前 `ClientAdapter.sendChat()`。

## Why it matters

这些是 agent 自己主动说话时最常见的本地 fallback 消息。把它们收敛到统一发送入口后，未来整合包客户端桥只需要实现 adapter 的聊天发送能力，就能覆盖更多非 planner 场景。

## Demo posture / limitations

这不是全量聊天发送迁移。聊天监听、部分白名单命令回复、战斗台词和其他散落在复杂流程里的 `bot.chat()` 仍然保留在原生 mineflayer 路线中，后续继续按功能块拆。
