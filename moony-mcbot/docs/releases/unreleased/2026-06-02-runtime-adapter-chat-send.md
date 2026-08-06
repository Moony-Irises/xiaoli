---
type: refactor
scope: runtime
audience: developer
summary: 让 chat.send 开始通过 ClientAdapter 和 BotRuntime 的统一入口执行
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

这轮把聊天发送从“工具层直接拿 `mineflayer.Bot` 然后 `bot.chat(...)`”推进到第一批 adapter 化实现：

- `ClientAdapter` 新增 `sendChat(message)` 能力
- `MineflayerAdapter` 实现 `sendChat`
- `BotRuntime` 新增统一的 `sendChat(...)` 入口
- `action-tools.ts` 里的 `chat.send` 和部分运行时主动发话入口开始通过 runtime / adapter 调用

同时保留了现有外部工具契约和大部分行为逻辑，不触碰 follow loop 的核心细节。

## Why it matters

这一步的价值不在于“聊天行为本身更强”，而在于它把最简单、最稳定的一条动作链先从 `mineflayer` 细节里拆出来，给后面的：

- `follow`
- `move`
- `observe`
- `container`

逐步 adapter 化打了样。

它也验证了当前重构方向是可行的：我们可以不推翻现有 MCP 工具和行为模块，而是小步地把底层统一到 `ClientAdapter` 边界上。

## Demo posture / limitations

这次不是用户可见的新玩法，也不代表已经支持整合包客户端。

当前仍然只有：

- `MineflayerAdapter`
- 原版 / 协议兼容路线

而且大量聊天调用点、以及 follow 链内部循环，仍然直接依赖 `mineflayer` 细节。换句话说，这次只是把“统一聊天出口”这一步先站稳，还没有进入 companion mod / modded client bridge 的实现阶段。
