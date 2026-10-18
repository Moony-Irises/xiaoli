# Command Invocation / Action Result 试点设计

## 1. 目标

为 MCP、Web 和 Agent 建立同一条命令调用边界，避免每个入口分别解释执行成功、失败和调试记录。首轮迁移 `move.stopFollow`；2026-08-06 又增加 `interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 三个低风险、已 Adapter 化的试点。

本轮不改变 MCP 工具名称、输入 schema、文本返回、Web endpoint、HTTP 状态、Agent 工具 ID 或 Agent 成功文本。

## 2. 当前问题

`move.stopFollow` 已有一份领域动作 `stopFollowLoop()`，但三个入口仍分别处理结果：

1. MCP handler 捕获异常并返回 `isError: true`。
2. Web `stop-follow` endpoint 调用调试 helper，再单独写入 Web action history。
3. Agent dispatcher 直接返回自己的成功字符串。

因此 MCP 和 Agent 的动作不会进入 Web action history，也没有统一的调用来源、请求 ID、耗时或失败分类。Catalog 只能证明工具元数据存在，不能证明一次动作真实执行到了哪一步。

## 3. 模块边界

`src/commands/command-dispatcher.ts` 提供通用调用内核：

- 注册稳定 `commandId`、Zod 输入 schema 和领域 handler。
- 接收 `source`、`botId`、可选 `requester` 与可选 `requestId`。
- 在 handler 前校验输入。
- 返回统一终态结果并保存有界内存历史。
- 不依赖 MCP、HTTP、Agent 黑板或 Mineflayer。

`src/commands/action-command-set.ts` 拥有四个试点的 canonical schema、输出守卫、领域 handler 和 typed invocation。它只读取最小 Runtime 接口，并通过构造参数接收停止跟随回调，不依赖 MCP、Web、Agent 黑板或 Mineflayer。`src/catalog/` 继续只保存共享元数据；`action-tools.ts` 现在只负责按 `BotRegistry` 缓存命令集，并注入仍由旧编排层持有的 follow 清理副作用。待 follow 状态所有权拆出后，该回调再迁入 movement 领域模块。

## 4. 第一版契约

```ts
type CommandSource = "mcp" | "web" | "agent" | "internal";
type CommandTerminalStatus = "executed" | "failed";

interface CommandInvocationContext {
  source: CommandSource;
  botId: string;
  requester?: string;
  requestId?: string;
}

interface CommandInvocationResult {
  requestId: string;
  commandId: string;
  source: CommandSource;
  botId: string;
  requester?: string;
  status: CommandTerminalStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  output?: Record<string, unknown>;
  error?: {
    code: "invalid_input" | "execution_failed" | "command_not_found";
    message: string;
  };
}
```

第一版同步等待 handler 结束，因此只产生 `executed` 或 `failed`。路线图中的 `accepted`、`confirmed`、`cancelled` 需要队列、游戏事件证据和取消令牌，不能在停止跟随试点里伪造。

`executed` 仅表示领域 handler 无异常完成。对于 `stopFollowLoop()`，它不等于服务器已确认角色完全静止；该差异必须保留在文档和后续证据模型中。

## 5. 入口兼容映射

### MCP

- 输入仍为 `{ botId: string }`。
- 成功仍返回文本 `Stopped following`。
- 失败仍返回文本结果并设置 `isError: true`。
- 统一结果暂不添加到 MCP `structuredContent`，避免改变当前外部契约。

[MCP 官方 TypeScript SDK 文档](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md#error-handling)将工具级失败与协议级失败区分开；可恢复的领域执行失败继续使用 `isError: true`，而不是改成 JSON-RPC 协议错误。

MCP 注册层仍保留原 Zod shape，让 SDK 在 handler 前维持既有协议校验；CommandDispatcher 会再次校验 canonical input。第一试点不把两者强行改成同一个导出 schema，以免把公共 MCP 注册形态变更混入执行边界迁移。

### Web

- endpoint 仍为 `POST /api/action/stop-follow`。
- 成功 body 仍为 `{ botId, stopped: true, message: "Stopped following" }`。
- 失败继续走现有 HTTP 错误映射。
- 原 Web action history 保留；调试 payload 额外提供跨入口的 command history。

### Agent

- 工具 ID 仍为 `move.stopFollow`。
- 成功仍返回 `stopped follow`。
- 统一失败结果在边缘重新抛为现有 Agent 执行错误。

### `interact.eat` 第二试点

- canonical 输出固定为 `{ botId, action: "eatFood", result }`，其中 `result` 沿用 `ActionResult`。
- MCP 输入 schema、`Ate ...` 成功文本和工具级 `isError` 失败保持不变。
- Web endpoint 仍为 `POST /api/action/eat-food`，body、HTTP 错误映射和原 Action History 保持不变。
- Agent 继续先由现有执行器校验并 trim `itemName`，成功文本与失败抛出语义保持不变；`interact.eat` 仍不加入默认 allowlist。
- 三入口的实际 `BotRuntime.eatFood()` 调用现在共用同一个 CommandDispatcher handler，并记录各自 source。

### `inventory.holdByCategory` 第三试点

- canonical 输入为 `{ botId, category }`；`category` 只接受 `sword`、`axe`、`pickaxe` 或 `food`。
- canonical 输出固定为 Web 旧结构 `{ action: "hold-category", result }`，不额外加入 `botId`。
- MCP 保留原枚举 schema、`Equipped ...` 成功文本与工具级 `isError` 失败。
- Web endpoint 仍为 `POST /api/action/hold-category`，body、HTTP 错误映射和原 Action History 保持不变；trim 与非法类别错误仍在 Web 边缘执行，非法输入不会形成命令执行记录。
- Agent 继续先 trim 类别并保留缺失/不支持类别的原错误文本，成功仍返回 Adapter detail 或原 fallback 文本。
- 三入口的实际 `BotRuntime.holdItemByCategory()` 调用共用 CommandDispatcher handler；该工具原本就在默认 Agent allowlist，本轮没有扩大或缩小权限。

### `interact.openDoor` 第四试点

- canonical 输出固定为 Web 旧结构 `{ botId, action: "openDoor", result }`，其中 `result` 沿用 `ActionResult`。
- MCP 继续用原注册 schema 提供 `reach=4.5`、`radius=6` 默认值，以及 reach 正数/最大 8、radius 整数/1-16 的协议边缘校验；成功文本和工具级 `isError` 不变。
- Web endpoint 仍为 `POST /api/action/open-door`，只转发 JSON number 字段；省略或非 number 字段继续作为 `undefined` 交给 Adapter 默认值，body、HTTP 错误和 Action History 不变。
- Agent 继续用 `Number(args.reach ?? 4.5)` / `Number(args.radius ?? 6)` 转换参数，成功 detail 与 fallback 文本不变。
- canonical schema 只复核 JavaScript number 类型，不在共享层增加 MCP 的范围限制，避免静默收紧 Web/Agent 旧契约。
- 因此 Agent 非数值字符串当前仍会转换为 `NaN` 并进入 Runtime；这是本轮有测试保护的兼容技术债，不代表推荐输入语义，后续改为明确参数错误前需单独确认公共契约。
- 三入口的实际 `BotRuntime.openDoor()` 调用共用 CommandDispatcher handler；默认 Agent allowlist 没有改变。

## 6. 安全与历史

- 命令历史不保存原始输入，避免后续 chat/auth 命令把秘密带入调试面板。
- 历史只保存来源、bot、requester、时间、终态、输出或脱敏后的错误文本。
- 默认保留最近 100 条，读取时返回副本，调用方不能修改内部历史。
- 重复 command ID 注册立即失败；未知 command ID 返回 `command_not_found`，不调用任何 handler。

## 7. 测试顺序

1. 纯 dispatcher 与 action command set：成功、输入失败、handler 失败、未知命令、重复注册、依赖注入、typed output、历史上限和副本隔离。
2. Agent：确认四个已迁移命令走统一结果，旧成功字符串、参数转换和异常语义不变。
3. MCP：确认四个已迁移 handler 的成功文本、schema 和 `isError` 契约不变。
4. Web：确认四个 endpoint 的 body、HTTP 错误和原 action history 不变，并能读取跨入口 command history。
5. 完整 lint、源码/测试 typecheck、全部测试和 build。

## 8. 本轮不做

- 除 `move.stopFollow`、`interact.eat`、`inventory.holdByCategory` 与 `interact.openDoor` 外，不迁移其他命令。
- 不移动 follow loop、task lifecycle 或 Pathfinder 状态所有权。
- 不增加持久化命令队列。
- 不把 command history 写入磁盘或共享记忆。
- 不扩大 Catalog audience 或 Agent 默认权限。
- 不增加 MCP `structuredContent`、title 或 annotations。
- 不实现游戏确认、重试、撤销或分布式 request tracing。

## 9. 实施状态

2026-07-31 已完成 `move.stopFollow` 试点：

- `src/commands/command-dispatcher.ts` 提供独立注册、输入校验、终态结果和最近 100 条历史。
- MCP、Web 和 Agent 共用同一个 stop-follow handler，各入口原返回契约由集成测试固定。
- Command History 不保存原始 input；写入历史的错误文本和输出对象会递归替换常见 password/token/api key/secret，入口拿到的原始错误保持不变。
- 2026-08-03 起 Command History 与 Web Action History 复用同一 diagnostics 投影；投影会深拷贝并脱敏，Web endpoint 与 CommandDispatcher 调用方的原响应仍保持原样。
- Web `/api/debug` 和页面均可查看按 bot 过滤的 Command History，原 Action History 继续保留。
- 自动化测试覆盖 dispatcher 边界、三入口成功/失败、页面脚本和历史脱敏。

2026-08-06 已完成 `interact.eat` 第二试点：

- MCP、Web 和 Agent 共用 `BotRuntime.eatFood()` canonical handler，原入口参数、文本、HTTP 与 `isError` 契约由跨入口集成测试固定。
- Agent 仍保留自身的严格参数错误文本；canonical schema 作为实际执行前的第二层复核。
- Web Command History 现在也能显示 `interact.eat` 的 source、终态、耗时和脱敏输出；原 Web Action History 与 Adapter `eat_food` 证据继续保留。
- 默认 Agent allowlist 未扩大，`executed` 仍只表示 handler 返回，不代表服务器确认吃下食物。

2026-08-06 已完成 `inventory.holdByCategory` 第三试点：

- MCP、Web 和 Agent 共用 `BotRuntime.holdItemByCategory()` canonical handler，三入口正常、缺失 bot、Agent/Web 边缘校验和类别 trim 均有集成回归。
- canonical 输出保持 Web 原有 `{ action: "hold-category", result }`，MCP 成功文本/`isError`、Web endpoint/HTTP/Action History 和 Agent 文本均未改变。
- Web Command History 可按 `mcp`、`web` 或 `agent` source 显示该动作；Web/Agent 的非法类别仍在入口边缘拦截，不伪造一次已接受的命令。
- 默认 Agent allowlist 保持原 17 项不变，`executed` 仍不代表游戏客户端已成功切换手持物。

2026-08-06 已完成 `interact.openDoor` 第四试点：

- MCP、Web 和 Agent 共用 `BotRuntime.openDoor()` canonical handler，三入口正常、缺失 bot、Agent 数值字符串转换、默认值和 Web 省略参数均有集成回归。
- MCP 的严格 schema 继续留在协议边缘；共享 schema 有意不把该范围强加给 Web/Agent，原文本、`isError`、Web body/HTTP/Action History 和 Agent fallback 均未改变。
- Web Command History 可显示该动作的 `mcp`、`web` 或 `agent` source；Adapter `open_door` 记录继续提供客户端动作证据。
- 默认 Agent allowlist 保持原 17 项不变，`executed` 不代表游戏世界中的门一定完成状态切换。

2026-08-06 已完成四个试点的模块所有权收敛：

- canonical schema、输出守卫、注册和 typed invocation 已从 `action-tools.ts` 迁入 `src/commands/action-command-set.ts`，避免入口编排文件继续拥有命令定义。
- `ActionCommandSet` 依赖最小 Runtime 契约；停止跟随通过注入回调复用原 `stopFollowLoop()`，没有移动 follow session、task lifecycle 或 Pathfinder 状态。
- MCP、Web 与 Agent 仍保留各自边缘 schema、参数转换、文本和错误映射；本轮没有新增命令、endpoint、权限或游戏确认语义。
- 独立模块测试覆盖四个 handler、精确输出、source/requester 历史和 Runtime 失败记录；原三入口集成测试继续固定兼容契约。

本状态不表示阶段 B 全部完成。其余命令、统一权限、异步队列、游戏确认与证据事件仍按本文“本轮不做”保留。
