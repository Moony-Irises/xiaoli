---
type: refactor
scope: runtime
audience: developer
summary: 让 observe.inventory 的基础背包快照开始通过 ClientAdapter 执行
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

`ClientAdapter` 增加了基础背包快照接口，`MineflayerAdapter` 负责把原生 mineflayer 物品转换为稳定的 `heldItem`、`items` 和可选 `slots` 快照。

`BotRuntime` 暴露 `getInventoryState()`，`observe.inventory`、agent 内部 `observe.inventory` 调用，以及 agent 状态摘要里的 `held` / `bestFood` 开始读取同一份 runtime 快照。

## Why it matters

这把“观察背包”从直接读取 `mineflayer.Bot` 往客户端适配层推进了一步。未来接入整合包客户端桥时，只需要让新 adapter 提供同样的背包快照，基础观察工具就不必重新改一轮。

## Demo posture / limitations

这不是完整的整合包背包/容器支持。当前只迁移基础背包、手持物和槽位快照；容器会话、槽位点击、后勤存取和复杂 GUI 交互仍然保留在原生 mineflayer 路线中。
