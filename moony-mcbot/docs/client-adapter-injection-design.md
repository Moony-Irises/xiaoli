# ClientAdapter 构造注入设计

## 目标

让应用组合层可以为 `BotRuntime` 选择并注入具体客户端 Adapter，同时保持当前 Mineflayer 默认行为和所有外部配置契约。该阶段只建立可替换构造边界，不启用 Modded Client。

实施状态：2026-07-31 已完成。Runtime 与 Registry 的无参数/两参数默认调用保持 Mineflayer；自定义 Factory 只用于应用组合和测试，尚无配置入口，也不能让未实现的 Modded Client 建立连接。

## 当前问题

- `BotRuntime` 在构造函数中固定调用 `createClientAdapter("mineflayer", ...)`。
- `BotRegistry` 固定直接构造 `BotRuntime`，应用启动层无法注入另一种 Adapter 组合策略。
- `createClientAdapter()` 的依赖参数包含 Mineflayer service；未来 Modded Adapter 不应被迫依赖该 service。
- Factory 返回值与请求 kind 之间没有运行时一致性检查。

## 契约决策

### Factory

- 保留现有 `createClientAdapter(kind, dependencies)` 函数，避免破坏测试和直接 TypeScript 调用方。
- 新增 `ClientAdapterFactory` 接口，只暴露 `create(kind): ClientAdapter`。
- 新增默认 Factory 构造函数，把 `McClientService` 捕获在 Mineflayer 默认实现内部；自定义 Factory 不需要声明 Mineflayer 依赖。
- 现有 `modded-client` 默认分支继续明确报未实现，不添加空壳连接行为。

### BotRuntime

- 新增可选 `BotRuntimeDependencies`：`clientAdapterKind` 与 `clientAdapterFactory`。
- 未传依赖时仍选择 `mineflayer` 并使用默认 Factory，现有两参数构造调用保持不变。
- 自定义 Factory 返回的 `adapter.kind` 必须等于请求 kind；不一致时立即抛错，避免状态和 capability 报告自相矛盾。
- 该依赖对象只属于应用组合和测试边界，不进入 `BotCreateInput` / `BotConfig`。

### BotRegistry

- 构造时可选接收同一组 Runtime 依赖，并在每次 `create()` 时透传。
- 默认无参数构造保持不变。
- Runtime/Factory 构造失败时，不得把 botId 写入 Registry。

## 数据流

```text
application composition / test
  -> new BotRegistry(optional runtime dependencies)
     -> new BotRuntime(botId, input, dependencies)
        -> selected kind (default: mineflayer)
        -> ClientAdapterFactory.create(kind)
        -> verify returned adapter.kind
        -> runtime owns adapter lifecycle
```

## 错误与边界

- 默认请求 `modded-client`：继续报 `not implemented`。
- 自定义 Factory 抛错：原样传播，Registry 保持无该 bot。
- Factory 返回错误 kind：构造失败并报告 requested/returned kind。
- 多 bot：当前一个 Registry 共享同一 Factory 和默认 kind；Factory 本身负责每次创建独立 Adapter。
- 不在本轮读取环境变量决定 kind，避免未经确认的隐式切换。

## 验证

- 现有 Factory 函数和默认 Mineflayer 构造行为不变。
- Runtime 无依赖时仍报告 `mineflayer`。
- 自定义 Factory 能收到 `modded-client` 并让 Runtime/Registry 使用 Fake Adapter。
- kind 不匹配与 Factory 抛错均 fail closed，Registry 不保留半成品。
- 完成定向测试、lint、源码/测试 typecheck、完整测试和 build。

## 暂不包含

- 不给 `BotCreateInput` / `BotConfig` 增加 `adapterKind`。
- 不新增 MCP、Web、`.env.local` 或持久化配置字段。
- 不实现 Modded Client、Companion Mod 或 Local Bridge。
- 不改 Adapter capability、动作、快照或生命周期接口。
