---
type: refactor
scope: runtime
audience: developer
summary: 让 TPA 请求发送复用 ClientAdapter 聊天发送入口
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

`chat.requestTeleportToPlayer` 的 `/tpa <player>` 命令发送不再直接调用原生 `bot.chat()`，而是通过 `sendRuntimeChat()` 进入 `BotRuntime.sendChat()` 和当前 `ClientAdapter.sendChat()`。

聊天监听里的“来找我”硬规则也复用同一条发送路径，包括后续的“已发送 TPA 请求”确认提示。

## Why it matters

TPA 是聊天命令类动作，不应该长期散落在 mineflayer 直接调用里。统一到 runtime/adapter 后，未来整合包客户端桥只需要实现聊天发送能力，就能覆盖这类服务器命令发送。

## Demo posture / limitations

这不改变服务器传送语义，也不实现真正的传送 API。当前仍只是向服务器聊天频道发送 `/tpa <player>` 命令；是否成功取决于服务器插件、权限和聊天命令规则。
