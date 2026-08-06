# Command Invocation / Action Result 试点设计

## 1. 目标

为 MCP、Web 和 Agent 建立同一条命令调用边界，避免每个入口分别解释执行成功、失败和调试记录。本轮只迁移 `move.stopFollow`，验证结构后再按领域扩展。

本轮不改变 MCP 工具名称、输入 schema、文本返回、Web endpoint、HTTP 状态、Agent 工具 ID 或 Agent 成功文本。

## 2. 当前问题

`move.stopFollow` 已有一份领域动作 `stopFollowLoop()`，但三个入口仍分别处理结果：

1. MCP handler 捕获异常并返回 `isError: true`。
2. Web `stop-follow` endpoint 调用调试 helper，再单独写入 Web action history。
3. Agent dispatcher 直接返回自己的成功字符串。

因此 MCP 和 Agent 的动作不会进入 Web action history，也没有统一的调用来源、请求 ID、耗时或失败分类。Catalog 只能证明工具元数据存在，不能证明一次动作真实执行到了哪一步。

## 3. 模块边界

新增 `src/commands/command-dispatcher.ts`：

- 注册稳定 `commandId`、Zod 输入 schema 和领域 handler。
- 接收 `source`、`botId`、可选 `requester` 与可选 `requestId`。
- 在 handler 前校验输入。
- 返回统一终态结果并保存有界内存历史。
- 不依赖 MCP、HTTP、Agent 黑板或 Mineflayer。

`src/catalog/` 继续只保存共享元数据，不持有 handler 或输入 schema。`action-tools.ts` 在当前过渡期负责把已有私有领域状态绑定到 dispatcher；待 follow 状态所有权拆出后，再把具体命令定义迁入独立 movement 模块。

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

## 6. 安全与历史

- 命令历史不保存原始输入，避免后续 chat/auth 命令把秘密带入调试面板。
- 历史只保存来源、bot、requester、时间、终态、输出或脱敏后的错误文本。
- 默认保留最近 100 条，读取时返回副本，调用方不能修改内部历史。
- 重复 command ID 注册立即失败；未知 command ID 返回 `command_not_found`，不调用任何 handler。

## 7. 测试顺序

1. 纯 dispatcher：成功、输入失败、handler 失败、未知命令、重复注册、历史上限和副本隔离。
2. Agent：确认 `move.stopFollow` 走统一结果，旧成功字符串和异常语义不变。
3. MCP：确认现有 handler 的成功文本和 `isError` 契约不变。
4. Web：确认 endpoint body、HTTP 错误和原 action history 不变，并能读取跨入口 command history。
5. 完整 lint、源码/测试 typecheck、全部测试和 build。

## 8. 本轮不做

- 不迁移其他命令。
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

本状态不表示阶段 B 全部完成。其他命令、统一权限、异步队列、游戏确认与证据事件仍按本文“本轮不做”保留。
