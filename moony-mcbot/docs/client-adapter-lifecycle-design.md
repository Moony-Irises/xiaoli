# ClientAdapter 生命周期设计

## 目标

让 `BotRuntime` 只通过 `ClientAdapter` 建立和关闭客户端连接，使未来客户端后端不需要复制 Mineflayer 专用清理逻辑。MCP 工具名、参数和状态 JSON 保持不变。

实施状态：2026-07-31 已完成。`BotRuntime.disconnect()` 的直接 TypeScript 契约已改为异步；MCP `bot.disconnect` 的名称、输入 schema 和成功文本保持兼容。离线回归已完成，真实服务器断开、重连和进程退出仍按手测文档验收。

## 实施前问题

- `BotRuntime.connect()` 已调用 `adapter.connect()` / `adapter.awaitReady()`，但 `disconnect()` 仍直接调用 `McClientService`。
- `ClientAdapter.disconnect()` 虽然返回 Promise，Mineflayer 实现只调用同步 `quit()`，没有等待 `end`。
- 连接失败使用 `bot.removeAllListeners()`，会移除不属于 Runtime 的 Mineflayer/插件监听器。
- 进程关闭调用同步 `disconnect()`，无法确认 Adapter 清理是否完成。
- 同时触发工具断开、进程退出或重新连接时，没有显式的断开中互斥边界。

## 契约决策

### BotRuntime

- `disconnect(reason?)` 返回 `Promise<RuntimeStatus>`。这是 TypeScript 调用契约的破坏性变更；MCP `bot.disconnect` 的 schema 和成功文本不变。
- 收到断开请求后立即递增 connection generation、关闭自动重连、清除移动桥并把 Runtime 状态设为 `disconnected`，阻止后续动作。
- 实际客户端清理由 `adapter.disconnect()` 唯一负责。Runtime 不读取原生 bot 后再直接 `quit()`。
- 同一轮断开中的重复调用返回同一个 Promise；断开完成后再次调用是幂等空操作。
- 断开进行中拒绝 `connect()`，避免新连接覆盖尚未释放的客户端引用。
- Adapter 断开失败时，Runtime 保持 `disconnected`、记录错误并让 Promise reject，使 MCP 和 shutdown 能看到失败。

### MineflayerAdapter 与 McClientService

- `McClientService.disconnect()` 先订阅 bot 的 `end`，再调用 `quit(reason)`，收到 `end` 后 resolve。
- 等待有固定超时；超时或 `quit()` 抛错时 reject，并移除本次等待监听器。
- `MineflayerAdapter.disconnect()` 清除路径评估、聊天/实体/移动订阅，并发调用复用同一 Promise。
- 无活动 bot 时直接进入 `disconnected`。有 bot 时无论底层成功或失败，最终都只清除本轮 bot 的引用，不能误清后续新连接。

### 生命周期监听所有权

- `BotRuntime` 只移除自己注册的 `login`、`kicked`、`error`、`end` 监听器。
- 手动断开和连接失败清理前先解除 Runtime 监听，避免清理产生的 `end` 被当作非预期掉线并触发自动重连。
- 服务端主动 kick/end 仍走既有状态和自动重连逻辑，并在终止事件后释放 Runtime 自己的监听器。
- 禁止调用 `removeAllListeners()`，因为 Mineflayer 插件和 Adapter 也拥有 bot 监听器。

## 数据流

```text
MCP / shutdown
  -> await BotRuntime.disconnect(reason)
     -> cancel generation / reconnect / movement
     -> detach Runtime-owned bot listeners
     -> await ClientAdapter.disconnect(reason)
        -> clear Adapter subscriptions
        -> await McClientService.disconnect(bot, reason)
           -> bot.quit(reason)
           -> wait bot.end or timeout
     -> return disconnected RuntimeStatus
```

连接失败使用同一条 Adapter 清理链，但不设置 `manualDisconnect`，因此当前 connect retry 仍可按既有分类与退避策略继续。

## 错误与边界

- 无 bot：成功、幂等。
- `quit()` 同步抛错：清除监听和引用，Runtime 记录错误并 reject。
- 未收到 `end`：到达超时后按失败处理，不无限阻塞 shutdown。
- 同时断开两次：只调用一次底层断开。
- 断开中连接：明确拒绝，不创建第二个客户端。
- 旧连接迟到的事件：connection generation 和按 bot 捕获的解绑函数共同隔离，不得修改新连接状态。

## 验证

- `McClientService`：正常 `end`、同步抛错、超时和监听器清理。
- `MineflayerAdapter`：无 bot、成功、并发复用、失败后引用/订阅清理。
- `BotRuntime`：委托并等待 Adapter、并发幂等、断开中拒绝连接、错误传播、连接失败使用 Adapter 清理。
- 调用方：MCP 工具和进程 shutdown 必须 `await`。
- 完整静态门禁与离线测试后，真实服务器再验证断开、重连和 `Ctrl+C`。

## 暂不包含

- 不给 `BotConfig` 增加 `adapterKind`。
- 不实现 Modded Client Bridge。
- 不移除 `getActiveBotOrThrow()` 兼容出口。
- 不修改动作 capability、MCP schema、配置文件或自动重连参数。
