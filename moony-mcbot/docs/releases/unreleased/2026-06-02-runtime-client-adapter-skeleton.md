---
type: refactor
scope: runtime
audience: developer
summary: 为未来整合包客户端支持补上 ClientAdapter 骨架
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/types.ts
  - README.md
  - TODO.md
---

## What changed

这次在 runtime 层补了第一版客户端适配骨架：

- 新增 `ClientAdapter` 接口和一组基础快照/动作结果类型
- 新增 `MineflayerAdapter`，把现有 `mineflayer` 接入包装成一个 adapter 实现
- `BotRuntime` 现在内部不再直接以 `mineflayer.Bot` 为唯一持有形态，而是先持有 adapter，再由 adapter 提供原生 bot

为了避免这一轮改动面过大，外部工具层的 `getActiveBotOrThrow()` 行为暂时保持不变，所以现有 follow/mine/container 等工具不需要同步重写。

## Why it matters

如果未来要支持真正的整合包客户端，小狸的高层 agent 不应该继续直接依赖 `mineflayer.Bot`。这次 refactor 先把底层执行载体抽出来，给后续的 `ModdedClientAdapter` 和 companion mod bridge 预留了稳定落点。

这一步的价值不在于“马上支持整合包”，而在于让当前项目从“只有一种执行后端”走向“允许多执行后端并存”的结构。

## Demo posture / limitations

这次不是新功能交付，而是底层结构预埋。当前对外能力仍然主要是原版/协议兼容路线；`action-tools.ts` 里大量技能仍旧直接读取 `mineflayer` 细节，后续还需要逐步迁移到 adapter 能力接口。
