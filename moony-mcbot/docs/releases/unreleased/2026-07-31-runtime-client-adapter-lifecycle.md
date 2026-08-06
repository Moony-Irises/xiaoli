---
type: refactor
scope: runtime
audience: developer
summary: BotRuntime 的连接失败、手动断开和进程退出统一等待 ClientAdapter 清理
breaking: true
demo_ready: false
tests:
  - npx tsx --test test/mc-client-service-lifecycle.test.ts test/client-adapter-lifecycle.test.ts test/bot-runtime-connection.test.ts
  - npm run typecheck
  - npm test
artifacts:
  - src/services/mc-client-service.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/main.ts
  - src/tools/bot-tools.ts
  - test/mc-client-service-lifecycle.test.ts
  - test/client-adapter-lifecycle.test.ts
  - test/bot-runtime-connection.test.ts
  - docs/client-adapter-lifecycle-design.md
---

## What changed

`BotRuntime` 不再直接调用 Mineflayer service 断开连接。连接失败、手动断开和进程退出统一经过 `ClientAdapter.disconnect()`；Mineflayer 实现会清理自身订阅并等待 bot `end`，重复断开复用同一 Promise，等待超过 5 秒或底层抛错时向调用方传播失败。Runtime 生命周期监听器改为精确注册和注销，不再使用 `removeAllListeners()`。

## Why it matters

这为未来可替换客户端后端建立了单一清理边界，也避免 MCP 或进程关闭提前报告成功、旧连接迟到恢复、重复断开建立竞态，以及误删 Mineflayer 插件监听器。直接 TypeScript 调用 `BotRuntime.disconnect()` 的代码现在必须等待 `Promise<RuntimeStatus>`；MCP `bot.disconnect` 的名称、输入 schema 和成功文本保持不变。

## Demo posture / limitations

本轮通过离线生命周期、类型和全量回归，但不是 install demo、尚未发布，也不是 GA。它不实现 Adapter 类型配置或 Modded Client Bridge，不升级 Mineflayer，也不能代替真实服务器上的断开、重连和 `Ctrl+C` 验证。
