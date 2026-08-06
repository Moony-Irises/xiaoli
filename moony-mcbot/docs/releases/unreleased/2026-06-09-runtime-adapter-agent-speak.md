---
type: refactor
scope: runtime
audience: developer
summary: 让 planner 和 agent step 的 speak 输出复用 ClientAdapter 聊天发送入口
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

planner 的 `plan.speak` 和 agent step 的 `step.speak` 不再直接调用原生 `bot.chat()`，而是通过 `sendRuntimeChat()` 进入 `BotRuntime.sendChat()` 和当前 `ClientAdapter.sendChat()`。

完成后，`src/tools/action-tools.ts` 中不再存在直接 `bot.chat()` 调用。

## Why it matters

这把 agent 规划链路里的“说话”输出也收敛到了统一发送入口。未来如果底层换成整合包客户端桥，planner/agent step 的语音反馈不需要额外改工具层。

## Demo posture / limitations

这只收敛聊天发送动作，不代表聊天监听、服务器回显、频道路由或权限语义已经抽象完成。`chat.sendVerified` 的回显等待仍依赖 mineflayer 事件。
