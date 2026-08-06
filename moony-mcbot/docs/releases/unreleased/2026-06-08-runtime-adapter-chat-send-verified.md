---
type: refactor
scope: runtime
audience: developer
summary: 让 chat.sendVerified 的发送动作复用 ClientAdapter 发送入口
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

`chat.sendVerified` 不再直接调用原生 `bot.chat()` 发送消息，而是通过 `BotRuntime.sendChat()` 复用已经 adapter 化的聊天发送入口。

服务器回显等待逻辑保持不变，仍然使用当前 mineflayer bot 的聊天事件做验证。

## Why it matters

这让普通发送和带回显验证的发送走同一条底层发送路径。未来接整合包客户端桥时，只要 adapter 提供统一 `sendChat()`，两类聊天工具都可以复用。

## Demo posture / limitations

这不是完整聊天事件抽象。`chat.sendVerified` 的“等待服务器回显”部分仍依赖原生 mineflayer 事件；本轮只迁移发送动作本身，不改变 MCP 工具契约和返回结构。
