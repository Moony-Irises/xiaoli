---
type: refactor
scope: runtime
audience: developer
summary: ClientAdapter 的 kind 与 Factory 可由 Runtime 和 Registry 构造边界注入
breaking: false
demo_ready: false
tests:
  - npx tsx --test test/client-adapter-factory.test.ts test/bot-runtime-adapter-injection.test.ts
  - npm run typecheck
  - npm test
artifacts:
  - src/runtime/client-adapter-factory.ts
  - src/runtime/bot-runtime.ts
  - src/runtime/bot-registry.ts
  - test/helpers/fake-client-adapter.ts
  - test/client-adapter-factory.test.ts
  - test/bot-runtime-adapter-injection.test.ts
  - docs/client-adapter-injection-design.md
---

## What changed

新增 `ClientAdapterFactory.create(kind)` 对象契约和默认 Mineflayer Factory。`BotRuntime` 与 `BotRegistry` 接受可选的内部 kind/Factory 组合依赖，默认调用保持 Mineflayer；Factory 返回错误 kind 或构造抛错时立即失败，Registry 不记录半成品。原 `createClientAdapter(kind, dependencies)` 函数继续保留。

## Why it matters

应用组合层和离线测试现在可以替换 Adapter 构造，而不必修改 bot 配置或在 Runtime 内硬编码另一套客户端。这为后续 Bridge 提供了可测试的接入点，同时避免“请求一种 Adapter、状态却报告另一种”的错误组合。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。默认运行仍只使用 Mineflayer；没有新增 `BotCreateInput`、MCP、环境变量或持久化配置入口，也没有实现非 Mineflayer 认证、生命周期事件或 Modded Client Bridge。Fake Adapter 构造测试不代表可以进入整合包服务器。
