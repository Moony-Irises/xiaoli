---
type: refactor
scope: runtime
audience: developer
summary: 让 movement.walk 开始通过 ClientAdapter 执行基础前进动作
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

`ClientAdapter` 增加了 `walkForward()` 动作能力，`MineflayerAdapter` 负责把它映射到原生 `forward` / `sprint` / `jump` 控制态。

`movement.walk` 工具现在保留原有 duration 计时逻辑，但实际开始前进和停止动作都通过 `BotRuntime` / adapter 执行。

## Why it matters

这把最基础的手动移动动作也收敛到了客户端适配层。未来接整合包客户端桥时，可以把 `walkForward()` 映射为真实客户端按键、bridge 指令或别的移动 API，而不用让 MCP 工具层知道底层客户端细节。

## Demo posture / limitations

这不是完整寻路抽象。follow 主循环、pathfinder goal、追击/战斗移动仍然保留在原生 mineflayer 路线中；本轮只覆盖 `movement.walk` 的基础前进/冲刺/跳跃控制。
