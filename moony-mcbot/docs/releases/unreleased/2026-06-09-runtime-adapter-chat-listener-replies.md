---
type: refactor
scope: runtime
audience: developer
summary: 让白名单聊天监听固定回复复用 ClientAdapter 聊天发送入口
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

白名单聊天监听里的固定回复不再直接调用原生 `bot.chat()`，而是通过 `sendRuntimeChatNoWait()` 进入 `BotRuntime.sendChat()` 和当前 `ClientAdapter.sendChat()`。

覆盖范围包括特殊回复、状态回复、战斗准备结果、挑战结果、跟随失败提示、吃东西/整理/下矿/开门/攻击等固定提示。

## Why it matters

这些回复是玩家日常交互里最常出现的本地聊天输出。统一到 runtime/adapter 后，未来接整合包客户端桥时，聊天监听触发的反馈也能复用同一套发送能力。

## Demo posture / limitations

这不是完整 agent 说话链路迁移。planner `speak` 和 agent step `speak` 当前仍有独立的原生 `bot.chat()` 调用点，后续需要单独按 agent 执行链路收敛。
